using LiventCord.Helpers;
using Microsoft.AspNetCore.StaticFiles;

public static class RouteConfig
{
    public static void ConfigureRoutes(WebApplication app)
    {
        void MapRoute(string path, string fileName)
        {
            var provider = new FileExtensionContentTypeProvider();
            provider.TryGetContentType(fileName, out var contentType);
            contentType ??= "application/octet-stream";

            app.MapGet(path, async context =>
            {
                var env = context.RequestServices.GetService<IWebHostEnvironment>();
                if (env == null)
                {
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await context.Response.WriteAsync("Internal Server Error: Environment not found.");
                    return;
                }

                var filePath = Path.Combine(env.WebRootPath, fileName);
                if (File.Exists(filePath))
                {
                    context.Response.ContentType = contentType;
                    await context.Response.SendFileAsync(filePath);
                }
                else
                {
                    context.Response.Redirect("/404");
                }
            });
        }

        MapRoute("/", "templates/index.html");
        MapRoute("/download", "templates/download.html");
        MapRoute("/register", "register/register.html");

        app.MapFallback(async context =>
        {
            var acceptHeader = context.Request.Headers["Accept"].ToString();
            var filePath = acceptHeader.Contains("text/html")
                ? Path.Combine(app.Environment.WebRootPath, "404", "404.html")
                : null;

            context.Response.StatusCode = StatusCodes.Status404NotFound;
            if (filePath != null)
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
                var redirectUrl = baseUrl + (string.IsNullOrEmpty(originalRoute) 
                    ? "" 
                    : "?route=" + Uri.EscapeDataString(originalRoute)); 

                context.Response.Redirect(redirectUrl);
                await Task.CompletedTask;
            });
        }


        MapRedirectRoute("/login", "https://liventcord.github.io/LiventCord/app");
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
            var url = platform switch
            {
                "android" => "https://github.com/liventcord/Mobile/releases/download/v1.0.0/app-release.apk",
                "windows" => "https://github.com/liventcord/Desktop/releases/download/v1.0.0/liventcord-win_x64.exe.zip",
                "mac" => "https://github.com/liventcord/Desktop/releases/download/v1.0.0/liventcord-mac_universal.zip",
                "linux" => "https://github.com/liventcord/Desktop/releases",
                _ => "https://github.com/liventcord/Desktop/releases/tag/v1.0.0"
            };
            context.Response.Redirect(url);
            await Task.CompletedTask;
        });
    }
}
