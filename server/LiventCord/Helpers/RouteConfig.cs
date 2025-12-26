using LiventCord.Helpers;
using Microsoft.AspNetCore.StaticFiles;
using System.Collections.Concurrent;

public static class RouteConfig
{
    private static string? _cachedLandingHtml = null;
    private static string? _cachedAppIndexHtml = null;
    private static readonly object _cacheLock = new object();
    private static readonly HttpClient _httpClient = new HttpClient();

    private const string GitHubPagesBase = "https://liventcord.github.io/LiventCord/app";

    private static readonly ConcurrentDictionary<string, byte[]> _assetCache = new();
    private static readonly ConcurrentDictionary<string, string> _assetContentTypes = new();

    public static void ConfigureRoutes(WebApplication app, WebApplicationBuilder builder)
    {
        var serveLanding = builder.Configuration.GetValue<bool>("AppSettings:ServeLanding");
        var serveFrontend = builder.Configuration.GetValue<bool>("AppSettings:ServeFrontend");

        if (serveLanding)
        {
            async Task<string> GetLandingHtmlAsync()
            {
                if (_cachedLandingHtml != null) return _cachedLandingHtml;

                lock (_cacheLock)
                {
                    if (_cachedLandingHtml != null) return _cachedLandingHtml;
                }

                var url = "https://raw.githubusercontent.com/liventcord/liventcord.github.io/refs/heads/main/index.html";
                var html = await _httpClient.GetStringAsync(url);

                lock (_cacheLock)
                {
                    _cachedLandingHtml = html;
                }

                return _cachedLandingHtml;
            }

            app.MapGet("/", async context =>
            {
                var html = await GetLandingHtmlAsync();
                context.Response.ContentType = "text/html";
                await context.Response.WriteAsync(html);
            });
        }
        if (serveFrontend)
        {
            async Task<string> GetAppIndexHtmlAsync()
            {
                if (_cachedAppIndexHtml != null) return _cachedAppIndexHtml;

                lock (_cacheLock)
                {
                    if (_cachedAppIndexHtml != null) return _cachedAppIndexHtml;
                }

                var url = $"{GitHubPagesBase}/index.html";
                var html = await _httpClient.GetStringAsync(url);

                lock (_cacheLock)
                {
                    _cachedAppIndexHtml = html;
                }

                return _cachedAppIndexHtml;
            }

            app.MapGet("/LiventCord/app", async context =>
            {
                var html = await GetAppIndexHtmlAsync();
                context.Response.ContentType = "text/html";
                await context.Response.WriteAsync(html);
            });

            app.MapGet("/LiventCord/app/{*assetPath}", async context =>
            {
                var path = context.Request.Path.Value?.Replace("/LiventCord/app/", "") ?? "";
                if (string.IsNullOrEmpty(path))
                {
                    var html = await GetAppIndexHtmlAsync();
                    context.Response.ContentType = "text/html";
                    await context.Response.WriteAsync(html);
                    return;
                }

                if (_assetCache.TryGetValue(path, out var cachedBytes))
                {
                    context.Response.ContentType = _assetContentTypes[path];
                    context.Response.Headers["Cache-Control"] = "public,max-age=31536000";
                    await context.Response.Body.WriteAsync(cachedBytes);
                    return;
                }

                try
                {
                    var assetUrl = $"{GitHubPagesBase}/{path}";
                    var bytes = await _httpClient.GetByteArrayAsync(assetUrl);
                    var provider = new FileExtensionContentTypeProvider();
                    if (!provider.TryGetContentType(path, out var contentType))
                        contentType = "application/octet-stream";

                    _assetCache[path] = bytes;
                    _assetContentTypes[path] = contentType;

                    context.Response.ContentType = contentType;
                    context.Response.Headers["Cache-Control"] = "public,max-age=31536000";
                    await context.Response.Body.WriteAsync(bytes);
                }
                catch
                {
                    context.Response.StatusCode = 404;
                    await context.Response.WriteAsync("Asset not found");
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

            MapRedirectRoute("/login", "/LiventCord/app");
            MapRedirectRoute("/register", "/LiventCord/app");
            MapRedirectRoute("/app", "/LiventCord/app");

            app.MapGet("/channels/{*subPath}", async context =>
            {
                var subPath = context.Request.RouteValues["subPath"]?.ToString() ?? "";
                var redirectUrl = $"/LiventCord/app/?route=channels/{Uri.EscapeDataString(subPath)}";
                context.Response.Redirect(redirectUrl);
                await Task.CompletedTask;
            });

            MapRedirectRoute("/join-guild/{*subPath}", "/LiventCord/app?route=/join-guild/{subPath}");
        }

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
