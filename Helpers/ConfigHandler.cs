using LiventCord.Controllers;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;

public static class ConfigHandler {
    public static void HandleConfig(WebApplicationBuilder builder) {
        builder.Configuration.AddJsonFile("Properties/appsettings.json", optional: true);

        int port = 5005;  

        if (int.TryParse(builder.Configuration["AppSettings:port"], out int configPort) && configPort > 0)
        {
            port = configPort;  
        }
        else
        {
            Console.WriteLine("Invalid or missing port in configuration. Using default port: 5005");
        }
        Console.WriteLine($"Running on port: {port}");
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");


        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
            .Filter.ByExcluding(logEvent => logEvent.MessageTemplate.Text.Contains("db query"))
            .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
            .CreateLogger();

        builder.Host.UseSerilog();

        HandleDatabase(builder);
    }
    static void HandleDatabase(WebApplicationBuilder builder)
    {
        var databaseType = builder.Configuration["AppSettings:DatabaseType"];
        var connectionString = builder.Configuration.GetConnectionString("RemoteConnection");

        if (string.IsNullOrEmpty(connectionString))
        {
            Console.WriteLine("Connection string is missing in the configuration. Defaulting to SQLite.");
            connectionString = "Data/liventcord.db";
        }

        Console.WriteLine($"Configured Database Type: {databaseType ?? "None (defaulting to SQLite)"}");

        switch (databaseType?.ToLowerInvariant())
        {
            case "postgresql":
                builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
                break;

            case "mysql":
            case "mariadb":
                builder.Services.AddDbContext<AppDbContext>(options => options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));
                break;

            case "sqlite":
            default:
                var fullPath = Path.GetFullPath(connectionString);
                var dataDirectory = Path.GetDirectoryName(fullPath);
                if (!string.IsNullOrEmpty(dataDirectory) && !Directory.Exists(dataDirectory))
                {
                    Directory.CreateDirectory(dataDirectory);
                    Console.WriteLine($"Info: Created missing directory {dataDirectory}");
                }
                builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={fullPath}"));
                break;

        }
    }



}