using LiventCord.Helpers;
using Microsoft.AspNetCore.StaticFiles;
using System.Net.Http;

public static class RouteConfig
{
    private static string? _cachedIndexHtml = null;
    private static readonly object _cacheLock = new object();
    private static readonly HttpClient _httpClient = new HttpClient();

    public static void ConfigureRoutes(WebApplication app)
    {
        async Task<string> GetIndexHtmlAsync()
        {
            if (_cachedIndexHtml != null)
                return _cachedIndexHtml;

            lock (_cacheLock)
            {
                if (_cachedIndexHtml != null)
                    return _cachedIndexHtml;
            }

            var url = "https://raw.githubusercontent.com/liventcord/liventcord.github.io/refs/heads/main/index.html";
            var html = await _httpClient.GetStringAsync(url);

            lock (_cacheLock)
            {
                _cachedIndexHtml = html;
            }

            return _cachedIndexHtml;
        }

        app.MapGet("/", async context =>
        {
            var html = await GetIndexHtmlAsync();
            context.Response.ContentType = "text/html";
            await context.Response.WriteAsync(html);
        });

        app.MapFallback(async context =>
        {
            var acceptHeader = context.Request.Headers["Accept"].ToString();
            var filePath = acceptHeader.Contains("text/html")
                ? Path.Combine(app.Environment.WebRootPath, "404", "404.html")
                : null;

            context.Response.StatusCode = StatusCodes.Status404NotFound;
            if (filePath != null && File.Exists(filePath))
            {
                context.Response.ContentType = "text/html";
                await context.Response.SendFileAsync(filePath);
            }
            else
            {
                context.Response.ContentType = "text/plain";
                await context.Response.WriteAsync("404 Not Found");
            }
        });

        void MapRedirectRoute(string path, string baseUrl)
        {
            app.MapGet(path, async context =>
            {
                var originalRoute = context.Request.Query["route"].ToString();
                var redirectUrl = baseUrl + (string.IsNullOrEmpty(originalRoute) ? "" : "?route=" + Uri.EscapeDataString(originalRoute));
                context.Response.Redirect(redirectUrl);
                await Task.CompletedTask;
            });
        }

        MapRedirectRoute("/login", "https://liventcord.github.io/LiventCord/app");
        MapRedirectRoute("/register", "https://liventcord.github.io/LiventCord/app");
        MapRedirectRoute("/app", "https://liventcord.github.io/LiventCord/app");

        app.MapGet("/channels/{*subPath}", async context =>
        {
            var subPath = context.Request.RouteValues["subPath"]?.ToString() ?? "";
            var redirectUrl = $"https://liventcord.github.io/LiventCord/app/?route=channels/{Uri.EscapeDataString(subPath)}";
            context.Response.Redirect(redirectUrl);
            await Task.CompletedTask;
        });

        MapRedirectRoute("/join-guild/{-subPath}", "https://liventcord.github.io/LiventCord/app?route=/join-guild/{subPath}");

        app.Map("/api/init", appBuilder =>
        {
            appBuilder.Run(async context =>
            {
                var appLogicService = context.RequestServices.GetRequiredService<AppLogicService>();
                await appLogicService.HandleInitRequest(context);
            });
        });

        app.MapGet("/api/download", async context =>
        {
            var platform = context.Request.Query["platform"].ToString().ToLower();
            string url = platform switch
            {
                "android" => "https://github.com/liventcord/Mobile/releases/download/v3.0.0/app-release.apk",
                "windows" => "https://github.com/liventcord/Desktop/releases/download/v1.0.1/liventcord-win_x64.exe.zip",
                "mac" => "https://github.com/liventcord/Desktop/releases/download/v1.0.1/liventcord-mac_universal.zip",
                "linux" =>
                    context.Request.Query["arch"].ToString().ToLower() switch
                    {
                        "arm64" => "https://github.com/liventcord/Desktop/releases/download/v1.0.1/liventcord-linux_arm64.zip",
                        "armhf" => "https://github.com/liventcord/Desktop/releases/download/v1.0.1/liventcord-linux_armhf.zip",
                        "x64" => "https://github.com/liventcord/Desktop/releases/download/v1.0.1/liventcord-linux_x64.zip",
                        _ => "https://github.com/liventcord/Desktop/releases"
                    },
                _ => "https://github.com/liventcord/Desktop/releases/tag/v1.0.0",
            };

            context.Response.Redirect(url);
            await Task.CompletedTask;
        });
    }
}
