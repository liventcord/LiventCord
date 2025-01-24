using System.IO.Compression;
using System.Text.Json;
using LiventCord.Controllers;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.SignalR;
using Serilog;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

ConfigHandler.HandleConfig(builder);

builder.Services.AddScoped<FriendController>();
builder.Services.AddScoped<TypingController>();
builder.Services.AddScoped<MessageController>();
builder.Services.AddScoped<RegisterController>();
builder.Services.AddScoped<NickDiscriminatorController>();
builder.Services.AddScoped<MembersController>();
builder.Services.AddScoped<ChannelController>();
builder.Services.AddScoped<AppLogicService>();
builder.Services.AddScoped<SSEManager>();
builder.Services.AddSingleton<FileExtensionContentTypeProvider>();
builder.Services.AddScoped<GuildController>();
builder.Services.AddScoped<PermissionsController>();
builder.Services.AddScoped<ImageController>();
builder.Services.AddScoped<InviteController>();
builder.Services.AddScoped<LoginController>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<MetadataService>();
builder.Services.AddMemoryCache();
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

var app = builder.Build();

bool isDevelopment = app.Environment.IsDevelopment();
Console.WriteLine($"Is running in development: {isDevelopment}");

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    context.Database.EnsureCreated();
}

if (isDevelopment)
{
    Console.WriteLine("Is running development: " + isDevelopment);

    app.Use(
        async (context, next) =>
        {
            context.Response.Headers["Cache-Control"] =
                "no-store, no-cache, must-revalidate, proxy-revalidate";
            context.Response.Headers["Pragma"] = "no-cache";
            context.Response.Headers["Expires"] = "0";
            await next();
        }
    );
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
}

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles();
app.UseResponseCompression();

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

app.MapHub<Hub>("/socket");
app.MapControllers();
app.Run();
