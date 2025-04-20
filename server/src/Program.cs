using System.IO.Compression;
using System.Text.Json;
using LiventCord.Controllers;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);


ConfigHandler.HandleConfig(builder);

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IBackgroundTaskService, BackgroundTaskService>();

builder.Services.AddSingleton<BaseRedisEmitter>();
builder.Services.AddScoped<RedisEventEmitter>();
builder.Services.AddSingleton<ICacheService, CacheService>();

builder.Services.AddScoped<ITokenValidationService, TokenValidationService>();
builder.Services.AddScoped<DmController>();
builder.Services.AddScoped<FriendDmService>();
builder.Services.AddScoped<FriendController>();
builder.Services.AddScoped<TypingController>();
builder.Services.AddScoped<MessageController>();
builder.Services.AddScoped<RegisterController>();
builder.Services.AddScoped<NickDiscriminatorController>();
builder.Services.AddScoped<MembersController>();
builder.Services.AddScoped<ChannelController>();
builder.Services.AddScoped<AppLogicService>();
builder.Services.AddSingleton<FileExtensionContentTypeProvider>();
builder.Services.AddScoped<GuildController>();
builder.Services.AddScoped<PermissionsController>();
builder.Services.AddScoped<FileController>();
builder.Services.AddScoped<InviteController>();
builder.Services.AddScoped<LoginController>();
builder.Services.AddScoped<MetadataService>();
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
            options.LogoutPath = "/auth/logout";
            options.AccessDeniedPath = null;
            options.Events = new CookieAuthenticationEvents
            {
                OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                },
                OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                }
            };
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
                        entry.Value?.Errors.Select(e => e?.ErrorMessage).ToArray()
                        ?? Array.Empty<string>()
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

string? FRONTEND_URL = builder.Configuration["AppSettings:FrontendUrl"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigin", policy =>
    {
        if (FRONTEND_URL == "*")
        {
            policy.AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
        else
        {
            var allowedOrigins = FRONTEND_URL?.Split(';', StringSplitOptions.RemoveEmptyEntries);

            if (allowedOrigins != null && allowedOrigins.Length > 0)
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            }
        }
    });
});



var app = builder.Build();

bool isDevelopment = app.Environment.IsDevelopment();
Console.WriteLine($"Is running in development: {isDevelopment}");

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    RelationalDatabaseFacadeExtensions.Migrate(context.Database);
}
if (isDevelopment)
{
    Console.WriteLine("Is running development: " + isDevelopment);

    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/profiles") ||
            context.Request.Path.StartsWithSegments("/guilds") ||
            context.Request.Path.StartsWithSegments("/attachments") ||
            context.Request.Path.StartsWithSegments("/api/proxy"))
        {
            await next();
            return;
        }

        context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
        context.Response.Headers["Pragma"] = "no-cache";
        context.Response.Headers["Expires"] = "0";

        await next();
    });

    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
}

app.UseCors("AllowSpecificOrigin");
app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseResponseCompression();
app.UseStaticFiles();

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

app.Lifetime.ApplicationStarted.Register(async () =>
{
    var env = app.Services.GetRequiredService<IHostEnvironment>();
    var configf = builder.Configuration["AppSettings:BuildFrontend"];
    if (!env.IsDevelopment() && configf != "false")
    {
        await Task.Run(() => BuilderService.StartFrontendBuild());
    }

    using (var scope = app.Services.CreateScope())
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        try
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var redisEventEmitter = scope.ServiceProvider.GetRequiredService<RedisEventEmitter>();
            var guildIds = await context.GetAllGuildIds();
            foreach (var guildId in guildIds)
            {
                await redisEventEmitter.EmitGuildMembersToRedis(guildId);
            }
        }
        catch (DbUpdateException ex)
        {
            logger.LogWarning(ex, "Guild table may not be available yet, skipping Redis sync");
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "EF Core operation failed, possibly due to missing table. Skipping Redis sync");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unexpected error during Redis sync");
        }
    }
});



app.Run();

