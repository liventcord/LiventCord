using Microsoft.AspNetCore.ResponseCompression;
using Serilog;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();
builder.Configuration.AddJsonFile("Properties/appsettings.json", optional: true);

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<MediaProxyController>();
builder.Services.AddSingleton<ApiProxyController>();
builder.Services.AddSingleton<MediaStorageInitializer>();
builder.Services.AddSingleton<MediaCacheSettings>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

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

string? FrontendUrl = builder.Configuration["AppSettings:FrontendUrl"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigin", policy =>
    {
        if (FrontendUrl == "*")
        {
            policy.AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
        else
        {
            var allowedOrigins = FrontendUrl?.Split(';', StringSplitOptions.RemoveEmptyEntries);

            if (allowedOrigins != null && allowedOrigins.Length > 0)
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod().AllowCredentials();
            }
        }
    });
});


var app = builder.Build();

bool isDevelopment = app.Environment.IsDevelopment();
Console.WriteLine($"Is running in development: {isDevelopment}");

app.UseExceptionHandler("/error");

app.UseCors("AllowSpecificOrigin");

app.UseSerilogRequestLogging();

app.UseHttpsRedirection();
app.UseRouting();

app.UseResponseCompression();

app.UseSwagger(c =>
{
    c.RouteTemplate = "swagger/{documentName}/swagger.json";
});

app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "LiventCord Media Proxy API V1");
    c.RoutePrefix = "docs";
});

app.MapGet("/", async context =>
{
    var responseHtml = """
    <html>
        <body>
            <p>Use route <code>/api/proxy/media?url=url</code> to use the proxy API.</p>
            <p>Example: 
                <a href="/api/proxy/media?url=https://picsum.photos/seed/picsum/200/300" target="_blank">
                    /api/proxy/media?url=https://picsum.photos/seed/picsum/200/300
                </a>
            </p>
        </body>
    </html>
    """;

    context.Response.ContentType = "text/html";
    await context.Response.WriteAsync(responseHtml);
});

app.MapControllers();
app.Run();
