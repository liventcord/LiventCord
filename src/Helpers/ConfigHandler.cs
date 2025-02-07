using LiventCord.Controllers;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;

public static class ConfigHandler
{
    public static void HandleConfig(WebApplicationBuilder builder)
    {
        builder.Configuration.AddJsonFile("Properties/appsettings.json", optional: true);

        int port = 5005;
        string host = "0.0.0.0";

        if (
            int.TryParse(builder.Configuration["AppSettings:port"], out int configPort)
            && configPort > 0
        )
        {
            port = configPort;
        }
        else
        {
            Console.WriteLine("Invalid or missing port in configuration. Using default port: 5005");
        }

        string? configHost = builder.Configuration["AppSettings:Host"];
        if (!string.IsNullOrWhiteSpace(configHost))
        {
            host = configHost;
        }
        else
        {
            Console.WriteLine(
                "Invalid or missing host in configuration. Using default host: 0.0.0.0"
            );
        }

        Console.WriteLine($"Running on host: {host}, port: {port}");
        builder.WebHost.UseUrls($"http://{host}:{port}");

        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
            .Filter.ByExcluding(logEvent =>
                logEvent.Properties.TryGetValue("SourceContext", out var sourceContext)
                && (
                    sourceContext.ToString().Contains("Microsoft.AspNetCore")
                    || sourceContext
                        .ToString()
                        .Contains("Microsoft.EntityFrameworkCore.Database.Command")
                )
                && logEvent.Level < LogEventLevel.Warning
            )
            .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
            .CreateLogger();

        builder.Host.UseSerilog();

        HandleDatabase(builder);
    }

    static void HandleDatabase(WebApplicationBuilder builder)
    {
        var databaseType = builder.Configuration["AppSettings:DatabaseType"];
        var connectionString = builder.Configuration["AppSettings:RemoteConnection"]; 
        var sqlitePath = builder.Configuration["AppSettings:SqlitePath"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentNullException("RemoteConnection", "The connection string is missing or empty.");
        }

        if (databaseType?.ToLower() != "sqlite" && string.IsNullOrEmpty(connectionString))
        {
            throw new ArgumentNullException(
                "Connection string is missing in the configuration and non-SQLite database type is selected."
            );
        }

        Console.WriteLine($"Configured Database Type: {databaseType ?? "None (defaulting to SQLite)"}");

        switch (databaseType?.ToLowerInvariant())
        {
            case "postgresql":
                builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseNpgsql(connectionString)
                );
                break;

            case "mysql":
            case "mariadb":
                builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString))
                );
                break;
            case "oracle":
                builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseOracle(connectionString)
                );
                break;
            case "firebird":
                builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseFirebird(connectionString)
                );
                break;
            case "sqlserver":
                builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseSqlServer(connectionString)
                );
                break;
            case "sqlite":
            default:
                if (sqlitePath == null)
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
                builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseSqlite($"Data Source={fullPath}")
                );
                break;
        }
    }

}
