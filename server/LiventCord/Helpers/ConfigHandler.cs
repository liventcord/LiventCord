using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using LiventCord.Controllers;

public static class ConfigHandler
{
    public static void HandleConfig(WebApplicationBuilder builder)
    {
        builder.Configuration.AddJsonFile("Properties/appsettings.json", optional: true);

        int port = 5005;
        string host = "0.0.0.0";

        if (int.TryParse(builder.Configuration["AppSettings:port"], out int configPort) && configPort > 0)
            port = configPort;
        else
            Console.WriteLine("Invalid or missing port in configuration. Using default port: 5005");

        string? configHost = builder.Configuration["AppSettings:Host"];
        if (!string.IsNullOrWhiteSpace(configHost))
            host = configHost;
        else
            Console.WriteLine("Invalid or missing host in configuration. Using default host: 0.0.0.0");

        Console.WriteLine($"Running on host: {host}, port: {port}");
        builder.WebHost.UseUrls($"http://{host}:{port}");

        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Information)
            .WriteTo.Console(
                outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}"
            )
            .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
            .CreateLogger();

        builder.Host.UseSerilog();

        HandleDatabase(builder);
        HandleCacheDatabase(builder);
    }

    static void HandleDatabase(WebApplicationBuilder builder)
    {
        var databaseType = builder.Configuration["AppSettings:DatabaseType"]?.ToLower();
        var connectionString = builder.Configuration["AppSettings:RemoteConnection"];

        if (string.IsNullOrWhiteSpace(databaseType))
            databaseType = "sqlite";

        if (databaseType != "sqlite" && string.IsNullOrWhiteSpace(connectionString))
            throw new ArgumentNullException("RemoteConnection", "The connection string is missing or empty.");

        Console.WriteLine($"Configured Database Type: {databaseType ?? "None (defaulting to SQLite)"}");

        if (databaseType != "sqlite" && connectionString != null)
            connectionString = EnsureConnectionPoolSettings(connectionString, databaseType);

        switch (databaseType)
        {
            case "postgres":
            case "postgresql":
                builder.Services.AddDbContextFactory<AppDbContext>(options =>
                    options.UseNpgsql(
                        connectionString,
                        npgsqlOptions => npgsqlOptions
                            .EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)
                            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    )
                );
                break;

            case "mysql":
            case "mariadb":
                builder.Services.AddDbContextFactory<AppDbContext>(options =>
                    options.UseMySql(
                        connectionString,
                        ServerVersion.AutoDetect(connectionString),
                        mySqlOptions => mySqlOptions
                            .EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)
                            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    )
                );
                break;

            case "oracle":
                builder.Services.AddDbContextFactory<AppDbContext>(options =>
                    options.UseOracle(
                        connectionString,
                        oracleOptions => oracleOptions
                            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    )
                );
                break;

            case "firebird":
                builder.Services.AddDbContextFactory<AppDbContext>(options =>
                    options.UseFirebird(
                        connectionString,
                        firebirdOptions => firebirdOptions
                            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    )
                );
                break;

            case "sqlserver":
                builder.Services.AddDbContextFactory<AppDbContext>(options =>
                    options.UseSqlServer(
                        connectionString,
                        sqlOptions => sqlOptions
                            .EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)
                            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    )
                );
                break;

            case "sqlite":
            default:
                Console.WriteLine("Defaulting to Sqlite!");
                var sqlitePath = GetSqliteFullPath("SqlitePath", builder);
                builder.Services.AddDbContextFactory<AppDbContext>(options =>
                    options.UseSqlite(
                        $"Data Source={sqlitePath}",
                        sqliteOptions => sqliteOptions
                            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    )
                );
                break;
        }
    }

    static void HandleCacheDatabase(WebApplicationBuilder builder)
    {
        var cachePath = GetSqliteFullPath("SqliteCachePath", builder);
        builder.Services.AddDbContextFactory<CacheDbContext>(options =>
            options.UseSqlite($"Data Source={cachePath}")
        );
    }

    static string GetSqliteFullPath(string configKey, WebApplicationBuilder builder)
    {
        var path = builder.Configuration[$"AppSettings:{configKey}"];

        if (string.IsNullOrWhiteSpace(path))
            path = ExampleConfig.Get<string>(configKey);

        var fullPath = Path.GetFullPath(path);

        CreateDataDirectory(fullPath);

        return fullPath;
    }

    static void CreateDataDirectory(string fullPath)
    {
        var dataDirectory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(dataDirectory) && !Directory.Exists(dataDirectory))
        {
            Directory.CreateDirectory(dataDirectory);
            Console.WriteLine($"Info: Created missing directory {dataDirectory}");
        }
    }

    private static string EnsureConnectionPoolSettings(string connectionString, string? databaseType)
    {
        switch (databaseType)
        {
            case "sqlserver":
                var sqlServerBuilder = new SqlConnectionStringBuilder(connectionString);
                if (!sqlServerBuilder.ContainsKey("Max Pool Size"))
                    sqlServerBuilder["Max Pool Size"] = 100;
                if (!sqlServerBuilder.ContainsKey("Min Pool Size"))
                    sqlServerBuilder["Min Pool Size"] = 0;
                return sqlServerBuilder.ConnectionString;

            case "postgres":
            case "postgresql":
                if (!connectionString.Contains("Maximum Pool Size", StringComparison.OrdinalIgnoreCase))
                    connectionString += ";Maximum Pool Size=100";
                if (!connectionString.Contains("Minimum Pool Size", StringComparison.OrdinalIgnoreCase))
                    connectionString += ";Minimum Pool Size=0";
                return connectionString;

            case "mysql":
            case "mariadb":
                if (!connectionString.Contains("Max Pool Size", StringComparison.OrdinalIgnoreCase))
                    connectionString += ";Max Pool Size=100";
                if (!connectionString.Contains("Min Pool Size", StringComparison.OrdinalIgnoreCase))
                    connectionString += ";Min Pool Size=0";
                return connectionString;

            default:
                return connectionString;
        }
    }
}