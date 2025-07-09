using LiventCord.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using MySqlConnector;
using Npgsql;
using Oracle.ManagedDataAccess.Client;
using System.Data.Common;
using System.Diagnostics;
using System.Runtime.InteropServices;

[ApiController]
[Route("/health")]
public class HealthController : ControllerBase
{
    private static PerformanceCounter? cpuCounter;
    private static PerformanceCounter? memCounter;
    private readonly IAppStatsService _statsService;
    private readonly string? adminKey;
    private readonly IConfiguration _configuration;
    public HealthController(IAppStatsService statsService, IConfiguration configuration)
    {
        adminKey = configuration["AppSettings:AdminKey"];
        _statsService = statsService;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            cpuCounter ??= new PerformanceCounter("Processor", "% Processor Time", "_Total");
            memCounter ??= new PerformanceCounter("Memory", "Available MBytes");
        }
        _configuration = configuration;
    }
    private double? _cachedCpuPercent = null;
    private DateTime _lastCpuFetchTime = DateTime.MinValue;
    private readonly TimeSpan _cpuCacheDuration = TimeSpan.FromSeconds(30);
    [HttpGet]
    public async Task<IActionResult> GetHealth([FromHeader(Name = "Authorization")] string? token)
    {
        if (string.IsNullOrEmpty(adminKey)) return Unauthorized();
        if (token != adminKey) return Unauthorized();
        var data = await GetServiceDataAsync();
        return Ok(new { data });
    }

    private async Task<ServiceData> GetServiceDataAsync()
    {
        var serviceName = "LiventCord";
        var hardwareInfo = new Hardware.Info.HardwareInfo();
        hardwareInfo.RefreshMemoryStatus();

        ulong totalMemoryBytes = hardwareInfo.MemoryStatus.TotalPhysical;
        ulong availableMemoryBytes = hardwareInfo.MemoryStatus.AvailablePhysical;
        ulong usedMemoryBytes = totalMemoryBytes - availableMemoryBytes;

        double totalMemMB = totalMemoryBytes / (1024.0 * 1024.0);
        double usedMemMB = usedMemoryBytes / (1024.0 * 1024.0);

        double usedPercent = totalMemMB > 0 ? usedMemMB / totalMemMB * 100 : 0;

        var cpuPercent = await GetCpuUsagePercentAsync();

        var systemMemory = new SystemMemory
        {
            UsedPercent = usedPercent,
            Used = $"{usedMemMB:F1} MB",
            Total = $"{totalMemMB:F1} MB"
        };

        var memory = new MemoryInfo
        {
            System = systemMemory,
            OS = RuntimeInformation.OSDescription,
            NumGc = GC.CollectionCount(0)
        };
        var usedDbSize = await GetDbUsedSize();

        var data = new ServiceData
        {
            Service = serviceName,
            Status = "Running",
            Uptime = Utils.GetProcessUptime(),
            ServedFilesSinceStartup = _statsService.ServedFilesSinceStartup,
            Memory = memory,
            CpuUsagePercent = cpuPercent,
            CpuCores = Environment.ProcessorCount,
            usedDbSize = usedDbSize,
            totalRequestsServed = _statsService.RespondedRequestsSinceStartup
        };


        return data;
    }

    public async Task<double> GetDbUsedSize()
    {
        var dbType = _configuration["AppSettings:DatabaseType"]?.ToLower();
        var connectionString = _configuration["AppSettings:RemoteConnection"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("Connection string is not configured.");
        }

        DbConnection conn;
        DbCommand cmd;
        string sizeQuery;

        switch (dbType)
        {
            case "postgres":
            case "postgresql":
                conn = new NpgsqlConnection(connectionString);
                sizeQuery = "SELECT pg_database_size(current_database())";
                break;

            case "mysql":
            case "mariadb":
                conn = new MySqlConnection(connectionString);
                sizeQuery = "SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = DATABASE()";
                break;

            case "oracle":
                conn = new OracleConnection(connectionString);
                sizeQuery = "SELECT SUM(bytes) FROM dba_segments";
                break;
            case "sqlite":
                var sqlitePath = _configuration["AppSettings:SqlitePath"];
                if (string.IsNullOrWhiteSpace(sqlitePath))
                {
                    sqlitePath = "Data/liventcord.db";
                }

                var fullPath = Path.GetFullPath(sqlitePath);
                var dataDirectory = Path.GetDirectoryName(fullPath);
                if (!string.IsNullOrEmpty(dataDirectory) && !Directory.Exists(dataDirectory))
                {
                    Directory.CreateDirectory(dataDirectory);
                    Console.WriteLine($"Info: Created missing directory {dataDirectory}");
                }

                if (!System.IO.File.Exists(fullPath))
                {
                    throw new FileNotFoundException("SQLite database file not found.", fullPath);
                }

                var fileInfo = new FileInfo(fullPath);
                double fileSizeInGB = fileInfo.Length / (1024.0 * 1024.0 * 1024.0);
                return Math.Round(fileSizeInGB, 2);

            case "sqlserver":
                conn = new SqlConnection(connectionString);
                sizeQuery = @"
                    SELECT SUM(size) * 8 * 1024 
                    FROM sys.master_files 
                    WHERE database_id = DB_ID()";
                break;

            default:
                throw new NotSupportedException($"Unsupported database type: {dbType}");
        }

        await using (conn)
        {
            await conn.OpenAsync();
            cmd = conn.CreateCommand();
            cmd.CommandText = sizeQuery;

            var result = await cmd.ExecuteScalarAsync();

            if (result != null && long.TryParse(result.ToString(), out long sizeInBytes))
            {
                double sizeInGB = sizeInBytes / (1024.0 * 1024.0 * 1024.0);
                return Math.Round(sizeInGB, 2);
            }

            throw new Exception("Failed to retrieve database size.");
        }
    }




    private async Task<double> GetCpuUsagePercentAsync()
    {
        if (_cachedCpuPercent.HasValue && (DateTime.UtcNow - _lastCpuFetchTime) < _cpuCacheDuration)
        {
            return _cachedCpuPercent.Value;
        }

        double cpuValue = 0;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                _ = cpuCounter?.NextValue();
                await Task.Delay(500);
                cpuValue = cpuCounter?.NextValue() ?? 0;
            }
            catch
            {
                cpuValue = 0;
            }
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            try
            {
                var cpu1 = await ReadCpuStatAsync();
                await Task.Delay(500);
                var cpu2 = await ReadCpuStatAsync();

                var totalDiff = cpu2.Total - cpu1.Total;
                var idleDiff = cpu2.Idle - cpu1.Idle;

                if (totalDiff == 0)
                {
                    cpuValue = 0;
                }
                else
                {
                    cpuValue = (1.0 - ((double)idleDiff / totalDiff)) * 100;
                }
            }
            catch
            {
                cpuValue = 0;
            }
        }

        cpuValue = Math.Round(cpuValue, 1);

        _cachedCpuPercent = cpuValue;
        _lastCpuFetchTime = DateTime.UtcNow;

        return cpuValue;
    }

    private async Task<(ulong Idle, ulong Total)> ReadCpuStatAsync()
    {
        var lines = await System.IO.File.ReadAllLinesAsync("/proc/stat");
        var cpuLine = lines[0];
        var parts = cpuLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        ulong user = ulong.Parse(parts[1]);
        ulong nice = ulong.Parse(parts[2]);
        ulong system = ulong.Parse(parts[3]);
        ulong idle = ulong.Parse(parts[4]);
        ulong iowait = parts.Length > 5 ? ulong.Parse(parts[5]) : 0;
        ulong irq = parts.Length > 6 ? ulong.Parse(parts[6]) : 0;
        ulong softirq = parts.Length > 7 ? ulong.Parse(parts[7]) : 0;
        ulong steal = parts.Length > 8 ? ulong.Parse(parts[8]) : 0;

        ulong total = user + nice + system + idle + iowait + irq + softirq + steal;

        return (idle + iowait, total);
    }


}
