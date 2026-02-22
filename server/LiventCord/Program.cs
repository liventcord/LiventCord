using System.IO.Compression;
using System.Text;
using System.Text.Json;
using LiventCord.Controllers;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

ConfigHandler.HandleConfig(builder);

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

builder.Services.AddScoped(typeof(IAppLogger<>), typeof(AppLogger<>));
builder.Services.AddSingleton<IAppStatsService, AppStatsService>();
builder.Services.AddSingleton<IBackgroundTaskService, BackgroundTaskService>();

builder.Services.AddSingleton<BaseRedisEmitter>();
builder.Services.AddScoped<RedisEventEmitter>();
builder.Services.AddSingleton<ICacheService, CacheService>();

builder.Services.AddScoped<ITokenValidationService, TokenValidationService>();
builder.Services.AddScoped<DmController>();
builder.Services.AddScoped<FriendDmService>();
builder.Services.AddScoped<FriendController>();
builder.Services.AddScoped<MessageController>();
builder.Services.AddScoped<RegisterController>();
builder.Services.AddScoped<NickDiscriminatorController>();
builder.Services.AddScoped<MembersController>();
builder.Services.AddScoped<ChannelController>();
builder.Services.AddScoped<AppLogicService>();
builder.Services.AddScoped<IFileCacheService, FileCacheService>();
builder.Services.AddSingleton<FileExtensionContentTypeProvider>();
builder.Services.AddScoped<GuildController>();
builder.Services.AddScoped<PermissionsController>();
builder.Services.AddScoped<HealthController>();
builder.Services.AddScoped<FileController>();
builder.Services.AddScoped<InviteController>();
builder.Services.AddScoped<AuthController>();
builder.Services.AddScoped<MediaProxyController>();
builder.Services.AddScoped<MetadataController>();
builder.Services.AddScoped<AttachmentDeduplicationService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
SharedAppConfig.Initialize(builder.Configuration);

builder
    .Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = AuthController._jwtIssuer,
            ValidAudience = AuthController._jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    builder.Configuration["AppSettings:JwtKey"] ?? Utils.DefaultJwtKey
                )
            ),
            ClockSkew = TimeSpan.Zero,
        };

        options.Events = new JwtBearerEvents
        {
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"message\":\"Authentication failed\"}");
            },
            OnForbidden = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"message\":\"Access denied\"}");
            },
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

string? FRONTEND_URL = builder.Configuration["AppSettings:FrontendUrl"] ?? ExampleConfig.Get<string>("FrontendUrl");
var allowedOrigins = FRONTEND_URL?.Split(';', StringSplitOptions.RemoveEmptyEntries);
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowSpecificOrigin",
        policy =>
        {
            if (FRONTEND_URL == "*")
            {
                policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            }
            else
            {
                var allowedOrigins = FRONTEND_URL?.Split(
                    ';',
                    StringSplitOptions.RemoveEmptyEntries
                );

                if (allowedOrigins != null && allowedOrigins.Length > 0)
                {
                    policy
                        .WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                }
            }
        }
    );
});

var app = builder.Build();



app.Use(async (context, next) =>
{
    string? requestOrigin = context.Request.Headers["Origin"];

    if (!string.IsNullOrEmpty(requestOrigin) && allowedOrigins?.Contains(requestOrigin) == true)
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = requestOrigin;
        context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
    }

    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 204;
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";

        if (context.Request.Headers.TryGetValue("Access-Control-Request-Headers", out var reqHeaders))
            context.Response.Headers["Access-Control-Allow-Headers"] = reqHeaders.ToString();

        await context.Response.CompleteAsync();
        return;
    }

    await next();
});



bool isDevelopment = app.Environment.IsDevelopment();
Console.WriteLine($"Is running in development: {isDevelopment}");

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    RelationalDatabaseFacadeExtensions.Migrate(context.Database);

    var cacheContext = scope.ServiceProvider.GetRequiredService<CacheDbContext>();
    cacheContext.Database.EnsureCreated();
}
if (isDevelopment)
{
    Console.WriteLine("Is running development: " + isDevelopment);

    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
}


app.UseMiddleware<RequestCountingMiddleware>();
app.UseSerilogRequestLogging();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRouting();
app.UseCors("AllowSpecificOrigin");
app.UseAuthentication();
app.UseAuthorization();

app.UseResponseCompression();
app.UseStaticFiles();

app.MapControllers();

RouteConfig.ConfigureRoutes(app, builder);

app.UseSwagger(c =>
{
    c.RouteTemplate = "swagger/{documentName}/swagger.json";
});

app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "LiventCord API V1");
    c.RoutePrefix = "docs";
});

app.MapControllers().RequireCors("AllowSpecificOrigin");

var statsService = app.Services.GetRequiredService<IAppStatsService>();
app.Lifetime.ApplicationStopping.Register(() =>
{
    statsService.Save();
});

app.Lifetime.ApplicationStarted.Register(async () =>
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<IAppLogger<Program>>();

    try
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var redisEventEmitter = scope.ServiceProvider.GetRequiredService<RedisEventEmitter>();
        var guildIds = await context.GetAllGuildIds();

        await redisEventEmitter.EmitGuildsParallel(guildIds, async guildId =>
        {
            await redisEventEmitter.EmitGuildMembersToRedis(guildId);
        });
    }
    catch (DbUpdateException ex)
    {
        logger.LogWarning(ex, "Guild table may not be available yet, skipping Redis sync");
    }
    catch (InvalidOperationException ex)
    {
        logger.LogWarning(
            ex,
            "EF Core operation failed, possibly due to missing table. Skipping Redis sync"
        );
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Unexpected error during Redis sync");
    }

    try
    {
        var dedupService = scope.ServiceProvider.GetRequiredService<AttachmentDeduplicationService>();
        await dedupService.DeduplicateAsync(CancellationToken.None);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Error during attachment deduplication");
    }

    try
    {
        var userService = scope.ServiceProvider.GetRequiredService<RegisterController>();
        await userService.EnsureSystemUserExistsAsync();
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Error ensuring system user exists");
    }
});

app.Run();

