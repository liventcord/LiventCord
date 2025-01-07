using System.Collections.Generic;
using System.IO;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Builder;
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

        MapRoute("/", "index.html");
        MapRoute("/beta", "beta.html");
        MapRoute("/download", "download.html");
        MapRoute("/register", "register.html");
        MapRoute("/test", "test.html");
        MapRoute("/test2", "test2.html");
        MapRoute("favicon.ico", "static/images/icons/favicon.ico");

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
                var filePath = Path.Combine(app.Environment.WebRootPath, "login.html");
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
                [FromServices] AppLogicService appLogicService,
                string guildId,
                string channelId
            ) =>
            {
                await appLogicService.HandleChannelRequest(context, guildId, channelId);
            }
        );

        app.MapGet(
            "/channels/{friendId}",
            async (
                HttpContext context,
                [FromServices] AppLogicService appLogicService,
                string friendId
            ) =>
            {
                await appLogicService.HandleChannelRequest(context, null, null, friendId);
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
            "/docs2",
            async context =>
            {
                var filePath = Path.Combine(app.Environment.WebRootPath, "redocs.html");

                if (!File.Exists(filePath))
                {
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    await context.Response.WriteAsync("Documentation not yet generated.");
                }
                else
                {
                    context.Response.ContentType = "text/html";
                    await context.Response.SendFileAsync(filePath);
                }
            }
        );
    }
}
