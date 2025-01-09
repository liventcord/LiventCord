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

        List<string> urls = new List<string>
        {
            "/assets/10bb7b2e55f0a34f23d903121de6b9bc.png",
            "/assets/d24e290703f8b31b56744a69df613fcb.png",
            "/assets/44a7840b2161275358742595c9257e76.png",
            "/assets/3590df6f2ae2f7202dab15c0bd3aca9a.png",
            "/assets/7fa2adf98f26db34178bb30a63dabe8c.png",
            "/assets/d19290ba3158e138bb241ae669a3bc37.png",
            "/assets/e6d6b255259ac878d00819a9555072ad.png",
            "/assets/02e75e392ab5d5a8ed5ab4f8fcae9c77.png",
            "/assets/8d1d548a64761f0c5b1d7c9e00ae66a6.png",
            "/assets/78cbfbf0381b8c7f5a192c4a46bd0b0e.png",
            "/assets/cfc9643cb00e44fae64bfeda3556bfd9.png",
            "/assets/08d0c70a708cd25acecb7a8b0cb0eb23.png",
            "/assets/cbf50c2e3287d2118f741e827a3ddaf5.png",
            "/assets/f23c5c28c4429691f7c54af93876d661.png",
            "/assets/ab02db863b7edeaa46bf4cd49b6646a9.png",
            "/assets/7eb9487d4dac00095f8ed2d2c80b21a8.png",
            "/assets/c9f51873ae719a6b4b8c6724362e999e.png",
            "/assets/fcdf14841cd468de3f43704be16fa303.png",
            "/assets/894cceea2dd5b523936930d1d7e333c5.png",
            "/assets/7beab7b17eaa9ff7ceed3e5b1af274c2.png",
            "/assets/d5073ab2ca9ee7c06c3f4d761968ac44.png",
            "/assets/64f37efd5319b9b581557604864f042a.png",
            "/assets/2ac1239c26c4ae1d27817a9d7b85dc53.png",
            "/assets/da07da4bde6f81f16366b62e8fcc90ec.png",
            "/assets/8e1cf1f1cf2a1a917002b8b583270c32.png",
            "/assets/d52ce383ca6d8eb53588bcc042574cae.png",
            "/assets/b1309f8892f138383d8b0b6ff8e23463.png",
            "/assets/b2da62f020089ccee92860e4defafdb4.png",
            "/assets/4db0790f7a81e49025d7fbfb9aeb182c.png"
        };

        foreach (string url in urls)
        {
            MapRoute(url,url);
        }



        MapRoute("/w/loader/loader.js", "static/w/loader.js");
        MapRoute("/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/index-react.js", "static/w/assets/index-react.js");
        MapRoute("/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/styles.css", "static/w/assets/b960ac7f559c3a04d18e7cce9de42c4b94a33dd4/styles.css");
        MapRoute("/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/styles.js", "static/w/assets/b960ac7f559c3a04d18e7cce9de42c4b94a33dd4/styles.css");


        MapRoute("/assets/532.423e048cce31881cf30d.css", "static/404/532.423e048cce31881cf30d.css");
        MapRoute("/assets/oneTrust/v4/scripttemplates/otSDKStub.js", "static/404/otSDKStub.js");
        MapRoute("/assets/5cb4337fbb45898bd5dce9a7a1a5a6c1.svg", "static/404/5cb4337fbb45898bd5dce9a7a1a5a6c1.svg");
        MapRoute("/assets/71d3e9dc2bcb8e91225ba9fab588c8f2.woff2", "static/404/71d3e9dc2bcb8e91225ba9fab588c8f2.woff2");
        MapRoute("/assets/7f63813838e283aea62f1a68ef1732c2.woff2", "static/404/7f63813838e283aea62f1a68ef1732c2.woff2");
        MapRoute("/assets/3d07f5abf272fbb5670d02ed687453d0.woff2", "static/404/3d07f5abf272fbb5670d02ed687453d0.woff2");

        MapRoute("/assets/3d6549bf2f38372c054eafb93fa358a9.woff2", "static/404/3d6549bf2f38372c054eafb93fa358a9.woff2");
        MapRoute("/assets/e55012627a8f6e7203b72a8de730c483.woff2", "static/404/e55012627a8f6e7203b72a8de730c483.woff2");
        MapRoute("/assets/05422eb499ddf5616e44a52c4f1063ae.woff2", "static/404/05422eb499ddf5616e44a52c4f1063ae.woff2");
        MapRoute("/assets/980082c4328266be3342a03dcb37c432.woff2", "static/404/980082c4328266be3342a03dcb37c432.woff2");
        MapRoute("/assets/d6db7b5639c7ed70f8b582984dda6c62.woff2", "static/404/d6db7b5639c7ed70f8b582984dda6c62.woff2");

        MapRoute("/assets/oneTrust/v4/consent/04da1d72-0626-4fff-b3c6-150c719cc115/04da1d72-0626-4fff-b3c6-150c719cc115.json","static/404/04da1d72-0626-4fff-b3c6-150c719cc115.json");
        MapRoute("/assets/779a770c34fcb823a598a7277301adaf.svg", "static/404/779a770c34fcb823a598a7277301adaf.svg");

        MapRoute("/assets/847541504914fd33810e70a0ea73177e.ico", "static/images/icons/favicon.png");

        MapRoute("/assets/58f8e0ecf25f53dec19a.js", "static/404/58f8e0ecf25f53dec19a.js");

        MapRoute("/assets/8857dcdebff6c45e7520.js" ,"static/404/8857dcdebff6c45e7520.js");
        MapRoute("/assets/e2da2847207d551757ed.js" ,"static/404/e2da2847207d551757ed.js");
        MapRoute("/assets/1b2cf71cb7b204c39c1d.js" ,"static/404/1b2cf71cb7b204c39c1d.js");
        MapRoute("/assets/1793a0a8eed8b4b93cce.js" ,"static/404/1793a0a8eed8b4b93cce.js");
        MapRoute("/assets/15715574cc27ad6a8fd4.js" ,"static/404/15715574cc27ad6a8fd4.js");
        MapRoute("/assets/bee87546919a0d6706fd.js" ,"static/404/bee87546919a0d6706fd.js");
        MapRoute("/assets/9052f8012f6bc01e3428.js" ,"static/404/9052f8012f6bc01e3428.js");
        MapRoute("/assets/7e166837033f5a0d5605.js" ,"static/404/7e166837033f5a0d5605.js");
        MapRoute("/assets/f65ae4a181d71f0f228b.js" ,"static/404/f65ae4a181d71f0f228b.js");
        MapRoute("/assets/117bb37978692314989c.js" ,"static/404/117bb37978692314989c.js");
        MapRoute("/assets/3e7a5606b1fe9c3670aa.js" ,"static/404/3e7a5606b1fe9c3670aa.js");
        MapRoute("/assets/ff7c61e43efdc4db149f.js" ,"static/404/ff7c61e43efdc4db149f.js");
        MapRoute("/assets/385abefa8127a53733e5.js" ,"static/404/385abefa8127a53733e5.js");
        MapRoute("/assets/9052f8012f6bc01e3428.js" ,"static/404/9052f8012f6bc01e3428.js");
        MapRoute("/assets/114fde1ca1b65f359804.js" ,"static/404/114fde1ca1b65f359804.js");
        MapRoute("/assets/08a803f6f5418b47ab79.js" ,"static/404/08a803f6f5418b47ab79.js");
        MapRoute("/assets/a83df5bf121ba6348ea4.js" ,"static/404/a83df5bf121ba6348ea4.js");
        MapRoute("/assets/d9815571aea841d19d40.js" ,"static/404/d9815571aea841d19d40.js");
        MapRoute("/assets/03f49385698d3e304f48.js" ,"static/404/03f49385698d3e304f48.js");
        MapRoute("/assets/53c1b19a8d26ff118620.js" ,"static/404/53c1b19a8d26ff118620.js");
        MapRoute("/assets/08a803f6f5418b47ab79.js" ,"static/404/08a803f6f5418b47ab79.js");
        MapRoute("/assets/a83df5bf121ba6348ea4.js" ,"static/404/a83df5bf121ba6348ea4.js");
        MapRoute("/assets/d9815571aea841d19d40.js" ,"static/404/d9815571aea841d19d40.js");
        MapRoute("/assets/b0f8fbfc13b86a0ad39f.js" ,"static/404/b0f8fbfc13b86a0ad39f.js");
        MapRoute("/assets/c1308bcab7021e780b5f.js" ,"static/404/c1308bcab7021e780b5f.js");
        MapRoute("/assets/665d9479017e1d9d259a.js" ,"static/404/665d9479017e1d9d259a.js");
        MapRoute("/assets/c2abebfcbb49cd828cd6.js" ,"static/404/c2abebfcbb49cd828cd6.js");
        MapRoute("/assets/04cb8e6fac0296266c6f.js" ,"static/404/04cb8e6fac0296266c6f.js");
        MapRoute("/assets/ce3f9ee01df48c67a4d4.js" ,"static/404/ce3f9ee01df48c67a4d4.js");
        MapRoute("/assets/943632481bf5a2ac65f4.js" ,"static/404/943632481bf5a2ac65f4.js");
        MapRoute("/assets/714a56bc82ca57749b92.js" ,"static/404/714a56bc82ca57749b92.js");
        MapRoute("/assets/871fab9ff4f7acf7aee4.js" ,"static/404/871fab9ff4f7acf7aee4.js");
        MapRoute("/assets/0be804690e444e9af377.js" ,"static/404/0be804690e444e9af377.js");
        MapRoute("/assets/17cd7ab0e09827337c7e.js" ,"static/404/17cd7ab0e09827337c7e.js");
        MapRoute("/assets/54fb5393665165d7bd1d.js" ,"static/404/54fb5393665165d7bd1d.js");


        MapRoute("/assets/oneTrust/v4/consent/04da1d72-0626-4fff-b3c6-150c719cc115/40451c6c-36d5-41b4-a718-aca26f058456/en.json","static/404/en.json");

        MapRoute("/assets/oneTrust/v4/scripttemplates/6.33.0/otBannerSdk.js", "static/404/otBannerSdk.js");
        MapRoute("/assets/oneTrust/v4/scripttemplates/6.33.0/assets/otCommonStyles.css","static/404/otCommonStyles.css");

        MapRoute("/static/w/assets/otSDKStub.js/consent/04da1d72-0626-4fff-b3c6-150c719cc115/04da1d72-0626-4fff-b3c6-150c719cc115.json","static/404/04da1d72-0626-4fff-b3c6-150c719cc115.json");
        MapRoute("/static/w/assets/otSDKStub.js/scripttemplates/6.33.0/otBannerSdk.js/consent/.json","static/w/assets/otSDKStub.js");
        MapRoute("/static/w/assets/otSDKStub.js/scripttemplates/6.33.0/otBannerSdk.js/consent/{*rest}", "static/w/assets/otSDKStub.js");
        MapRoute("/static/w/assets/otSDKStub.js/scripttemplates/6.33.0/otBannerSdk.js", "static/w/assets/otBannerSdk.js");
        MapRoute("/static/w/assets/otSDKStub.js/consent/04da1d72-0626-4fff-b3c6-150c719cc115/40451c6c-36d5-41b4-a718-aca26f058456/en.json","static/404/en.json");

        MapRoute("/service-worker.js", "pwa/service-worker.js");
        MapRoute("/manifest.json", "pwa/manifest.json");

        

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
