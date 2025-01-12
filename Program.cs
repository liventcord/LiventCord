using System.IO.Compression;
using System.Text.Json;
using LiventCord.Controllers;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("Properties/appsettings.json", optional: true);

int port;
if (int.TryParse(builder.Configuration["AppSettings:port"], out port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}
else
{
    builder.WebHost.UseUrls("http://0.0.0.0:5005");
}

bool usePostgres =
    bool.TryParse(builder.Configuration["AppSettings:usePostgres"], out var result) && result;

if (usePostgres)
{
    var connectionString = builder.Configuration.GetConnectionString("RemoteConnection");
    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException(
            "RemoteConnection string is missing in the configuration."
        );
    }
    builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
}
else
{
    var connectionString = builder.Configuration.GetConnectionString("SqlitePath");

    if (string.IsNullOrEmpty(connectionString))
    {
        connectionString = Path.Combine("Data", "liventcord.db");
        Console.WriteLine("Warning: SqlitePath is missing. Using default path: Data/liventcord.db");
    }

    var fullPath = Path.GetFullPath(connectionString);
    var dataDirectory = Path.GetDirectoryName(fullPath);
    if (!string.IsNullOrEmpty(dataDirectory) && !Directory.Exists(dataDirectory))
    {
        Directory.CreateDirectory(dataDirectory);
        Console.WriteLine($"Info: Created missing directory {dataDirectory}");
    }

    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite($"Data Source={fullPath}")
    );
}
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
    .Filter.ByExcluding(logEvent => logEvent.MessageTemplate.Text.Contains("db query"))
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();
builder.Services.AddSingleton<IConfiguration>(builder.Configuration);
builder.Services.AddScoped<FriendController>();
builder.Services.AddScoped<TypingController>();
builder.Services.AddScoped<MessageController>();
builder.Services.AddScoped<RegisterController>();
builder.Services.AddScoped<NickDiscriminatorController>();
builder.Services.AddScoped<MembersController>();
builder.Services.AddScoped<ChannelController>();
builder.Services.AddScoped<AppLogicService>();
builder.Services.AddScoped<SSEManager>();
builder.Services.AddSingleton<FileExtensionContentTypeProvider>();
builder.Services.AddScoped<GuildController>();
builder.Services.AddScoped<PermissionsController>();
builder.Services.AddScoped<UploadController>();
builder.Services.AddScoped<InviteController>();
builder.Services.AddScoped<LoginController>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<MetadataService>();
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

builder
    .Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
        options.LoginPath = "/auth/login";
    });
builder
    .Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context
                .ModelState.Where(entry => entry.Value?.Errors.Count > 0)
                .ToDictionary(
                    entry => entry.Key,
                    entry =>
                        entry
                            .Value?.Errors.Where(e => e != null)
                            .Select(e => e.ErrorMessage)
                            .ToArray() ?? Array.Empty<string>()
                );

            return new BadRequestObjectResult(errors);
        };
    })
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    );

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
    options.Providers.Add<BrotliCompressionProvider>();
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

var app = builder.Build();

bool isDevelopment = app.Environment.IsDevelopment();
Console.WriteLine("Is running development: " + isDevelopment);
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
}
if (isDevelopment)
{
    app.Use(
        async (context, next) =>
        {
            context.Response.Headers["Cache-Control"] =
                "no-store, no-cache, must-revalidate, proxy-revalidate";
            context.Response.Headers["Pragma"] = "no-cache";
            context.Response.Headers["Expires"] = "0";

            await next();
        }
    );
}
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    context.Database.EnsureCreated();
}

app.UseExceptionHandler("/error");

if (isDevelopment)
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
}

app.Map(
    "/error",
    (HttpContext context) =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "text/plain";
        return context.Response.WriteAsync("500 Internal Server Error");
    }
);

app.UseStatusCodePages(async context =>
{
    var httpContext = context.HttpContext;
    var statusCode = httpContext.Response.StatusCode;

    var isApiRequest = httpContext
        .Request.Headers["Accept"]
        .ToString()
        .Contains("application/json");

    if (statusCode == StatusCodes.Status404NotFound)
    {
        if (isApiRequest)
        {
            httpContext.Response.ContentType = "text/plain";
            await httpContext.Response.WriteAsync("404 Not Found");
        }
    }
    else if (statusCode == StatusCodes.Status500InternalServerError)
    {
        if (isApiRequest)
        {
            httpContext.Response.ContentType = "application/json";
            await httpContext.Response.WriteAsync("{\"error\": \"500 Internal Server Error\"}");
        }
        else
        {
            httpContext.Response.ContentType = "text/plain";
            await httpContext.Response.WriteAsync("500 Internal Server Error");
        }
    }
    else
    {
        var reasonPhrase = ReasonPhrases.GetReasonPhrase(statusCode);
        httpContext.Response.ContentType = "text/plain";
        await httpContext.Response.WriteAsync($"{statusCode} {reasonPhrase}");
    }
});


app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles();
app.UseResponseCompression();

RouteConfig.ConfigureRoutes(app);

app.UseSwagger(c =>
{
    c.RouteTemplate = "swagger/{documentName}/swagger.json";
});

app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "LiventCord API V1");
    c.RoutePrefix = "docs";
});

app.MapControllers();
app.Run();
