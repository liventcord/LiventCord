using LiventCord.Helpers;
using Microsoft.AspNetCore.StaticFiles;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;

public static class RouteConfig
{
    private static string? _cachedLandingHtml = null;
    private static string? _cachedAppIndexHtml = null;
    private static readonly object _cacheLock = new object();
    private static readonly HttpClient _httpClient = new HttpClient();

    private const string GitHubPagesBase = "https://liventcord.github.io/LiventCord/app";

    public static void ConfigureRoutes(WebApplication app)
    {
        // Landing page
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

        // SPA app from GitHub Pages
        async Task<string> GetAppIndexHtmlAsync()
        {
            if (_cachedAppIndexHtml != null) return _cachedAppIndexHtml;

            lock (_cacheLock)
            {
                if (_cachedAppIndexHtml != null) return _cachedAppIndexHtml;
            }

            var url = $"{GitHubPagesBase}/index.html";
            var html = await _httpClient.GetStringAsync(url);

            html = ReplaceUrlsWithGitHubPages(html);

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

        app.MapGet("/LiventCord/app/{*any}", async context =>
        {
            var path = context.Request.Path.Value ?? "";

            if (Path.HasExtension(path))
            {
                var redirectUrl = $"https://liventcord.github.io{path}";
                context.Response.Redirect(redirectUrl);
                return;
            }

            var html = await GetAppIndexHtmlAsync();
            context.Response.ContentType = "text/html";
            await context.Response.WriteAsync(html);
        });


        // SPA redirects
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
            var redirectUrl = $"{GitHubPagesBase}/?route=channels/{Uri.EscapeDataString(subPath)}";
            context.Response.Redirect(redirectUrl);
            await Task.CompletedTask;
        });

        MapRedirectRoute("/join-guild/{*subPath}", $"{GitHubPagesBase}?route=/join-guild/{{subPath}}");

        // API endpoints
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

    private static string ReplaceUrlsWithGitHubPages(string html)
    {
        html = Regex.Replace(html, @"(src|href)\s*=\s*[""']?(?!https?:|/)([^""'\s>]+)[""']?", m =>
        {
            var attr = m.Groups[1].Value;
            var path = m.Groups[2].Value.Replace("\\", "/");
            return $"{attr}=\"{GitHubPagesBase}/{path}\"";
        }, RegexOptions.IgnoreCase);

        html = Regex.Replace(html, @"(src|href)\s*=\s*[""']?/LiventCord/app/([^""'\s>]+)[""']?", m =>
        {
            var attr = m.Groups[1].Value;
            var path = m.Groups[2].Value.Replace("\\", "/");
            return $"{attr}=\"{GitHubPagesBase}/{path}\"";
        }, RegexOptions.IgnoreCase);

        return html;
    }


}
