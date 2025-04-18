using LiventCord.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

            app.MapGet(
                path,
                async context =>
                {
                    var env = context.RequestServices.GetService<IWebHostEnvironment>();
                    if (env == null)
                    {
                        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                        await context.Response.WriteAsync(
                            "Internal Server Error: Environment not found."
                        );
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
                        string redirectUrl = "/404";
                        context.Response.Redirect(redirectUrl);
                    }
                }
            );
        }

        MapRoute("/", "templates/index.html");
        MapRoute("/download", "templates/download.html");
        MapRoute("/register", "register/register.html");

        app.MapFallback(async context =>
        {
            var acceptHeader = context.Request.Headers["Accept"].ToString();

            if (acceptHeader.Contains("text/html"))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                context.Response.ContentType = "text/html";
                var filePath = Path.Combine(app.Environment.WebRootPath, "404", "404.html");
                await context.Response.SendFileAsync(filePath);
            }
            else
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                context.Response.ContentType = "text/plain";
                await context.Response.WriteAsync("404 Not Found");
            }
        });

        app.MapGet(
            "/login",
            async context =>
            {
                if (context.User.Identity?.IsAuthenticated == true)
                {
                    context.Response.Redirect("/app");
                    return;
                }

                context.Response.ContentType = "text/html";
                var filePath = Path.Combine(app.Environment.WebRootPath, "login", "login.html");
                await context.Response.SendFileAsync(filePath);
            }
        );
        app.MapGet(
            "/app",
            context =>
            {
                context.Response.Redirect("/channels/@me");
                return Task.CompletedTask;
            }
        );

        app.MapGet(
            "/channels/{guildId}/{channelId}",
            async (
                HttpContext context,
                [FromServices] AppLogicService appLogicService) =>
            {
                await appLogicService.HandleChannelRequest(context);
            }
        );

        app.MapGet(
            "/channels/{friendId}",
            async (
                HttpContext context,
                [FromServices] AppLogicService appLogicService
            ) =>
            {
                await appLogicService.HandleChannelRequest(context);
            }
        );

        app.MapGet(
            "/join-guild/{inviteId}",
            async (
                HttpContext context,
                [FromServices] AppLogicService appLogicService
            ) =>
            {
                await appLogicService.HandleChannelRequest(context);
            }
        );


        app.Map(
            "/api/init",
            appBuilder =>
            {
                appBuilder.Run(async context =>
                {
                    var appLogicService =
                        context.RequestServices.GetRequiredService<AppLogicService>();
                    await appLogicService.HandleInitRequest(context);
                });
            }
        );
        app.MapGet(
            "/api/download",
            async (HttpContext context) =>
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
            }
        );



    }
}
