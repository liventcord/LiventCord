using System.Security.Claims;
using LiventCord.Controllers;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Helpers
{
    public static class SharedAppConfig
    {
        public static string GifWorkerUrl { get; private set; }
        public static string ProxyWorkerUrl { get; private set; }
        public static string MediaWorkerUrl { get; private set; }

        public static string WsUrl { get; private set; }

        public static float MaxAvatarSize { get; private set; }
        public static float MaxAttachmentSize { get; private set; }
        public static string? AdminKey { get; private set; }

        static SharedAppConfig()
        {
            GifWorkerUrl = "https://gif-worker.liventcord-a60.workers.dev";
            ProxyWorkerUrl = "https://proxy.liventcord-a60.workers.dev";
            MediaWorkerUrl = "https://media-api.liventcord-a60.workers.dev";
            MaxAvatarSize = 3; // MB
            MaxAttachmentSize = 30; // MB
            WsUrl = "ws://localhost:8080";
            AdminKey = "";
        }

        public static void Initialize(IConfiguration configuration)
        {
            GifWorkerUrl = configuration["AppSettings:GifWorkerUrl"] ?? GifWorkerUrl;
            ProxyWorkerUrl = configuration["AppSettings:ProxyWorkerUrl"] ?? ProxyWorkerUrl;
            MediaWorkerUrl = configuration["AppSettings:MediaWorkerUrl"] ?? ProxyWorkerUrl;
            WsUrl = configuration["AppSettings:WsUrl"] ?? WsUrl;

            MaxAvatarSize = float.TryParse(
                configuration["AppSettings:MaxAvatarSize"],
                out var avatarSize
            )
                ? avatarSize
                : MaxAvatarSize;

            MaxAttachmentSize = float.TryParse(
                configuration["AppSettings:MaxAttachmentSize"],
                out var attachmentSize
            )
                ? attachmentSize
                : MaxAttachmentSize;
            AdminKey = configuration["AppSettings:AdminKey"];
        }

        public static long GetMaxAttachmentSize()
        {
            return (long)(MaxAttachmentSize * 1024 * 1024);
        }

        public static long GetMaxAvatarsSize()
        {
            return (long)(MaxAttachmentSize * 1024 * 1024);
        }
    }

    public class AppLogicService
    {
        private readonly AppDbContext _dbContext;
        private readonly MembersController _membersController;
        private readonly FriendController _friendController;
        private readonly ILogger<AppLogicService> _logger;
        private readonly PermissionsController _permissionsController;
        private readonly ICacheService _cacheService;

        public AppLogicService(
            AppDbContext dbContext,
            FriendController friendController,
            MembersController membersController,
            ILogger<AppLogicService> logger,
            PermissionsController permissionsController,
            ICacheService cacheService
        )
        {
            _dbContext = dbContext;
            _friendController = friendController;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _cacheService = cacheService;
            _logger = logger;
        }

        private async Task<string> GetProfileImgVersion(string userId)
        {
            var result = await _dbContext.ProfileFiles.FirstOrDefaultAsync(f => f.UserId == userId);
            return result?.Version ?? "0";
        }

        public async Task HandleInitRequest(HttpContext context)
        {
            async Task RejectStaleSession()
            {
                await context.Response.WriteAsJsonAsync(
                    new { message = "User session is no longer valid. Please log in again." }
                );
            }

            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    await RejectStaleSession();
                    return;
                }

                var cacheKey = $"UserInitData_{userId}";
                if (_cacheService.TryGet(cacheKey, out var cachedData))
                {
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(cachedData);
                    return;
                }

                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);

                if (user == null)
                {
                    await RejectStaleSession();
                    return;
                }

                var guilds = await _membersController.GetUserGuilds(userId);
                var friendsStatus = await _friendController.GetFriends(userId);

                var jsonData = new
                {
                    userId,
                    email = user.Email ?? "",
                    nickName = user.Nickname ?? "",
                    userDiscriminator = user.Discriminator ?? "",
                    profileVersion = await GetProfileImgVersion(userId),
                    sharedGuildsMap = await _membersController.GetSharedGuilds(
                        userId,
                        friendsStatus,
                        guilds
                    ),
                    permissionsMap = await _permissionsController.GetPermissionsMapForUser(userId),
                    friendsStatus,
                    dmFriends = await GetDmUsers(userId),
                    guilds,
                    gifWorkerUrl = SharedAppConfig.GifWorkerUrl,
                    proxyWorkerUrl = SharedAppConfig.ProxyWorkerUrl,
                    MediaWorkerUrl = SharedAppConfig.MediaWorkerUrl,
                    maxAvatarSize = SharedAppConfig.MaxAvatarSize,
                    maxAttachmentSize = SharedAppConfig.MaxAttachmentSize,
                    wsUrl = SharedAppConfig.WsUrl,
                };

                _cacheService.Set(cacheKey, jsonData, TimeSpan.FromSeconds(100));

                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(jsonData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while fetching the initial data.");

                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await context.Response.WriteAsJsonAsync(
                        new { message = "An internal server error occurred." }
                    );
                }
            }
        }

        public async Task HandleChannelRequest(HttpContext context)
        {
            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    context.Response.Redirect("/login");
                    return;
                }

                var filePath = Path.Combine(
                    context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootPath,
                    "index.html"
                );
                var htmlContent = await File.ReadAllTextAsync(filePath);

                context.Response.ContentType = "text/html";
                await context.Response.WriteAsync(htmlContent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while processing the channel request.");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync("An internal server error occurred.");
            }
        }

        public async Task<List<PublicUser>> GetDmUsers(string userId)
        {
            return await _dbContext
                .UserDms.Where(d => d.UserId == userId)
                .Join(
                    _dbContext.Users,
                    friend => friend.FriendId,
                    user => user.UserId,
                    (friend, user) => user.GetPublicUser()
                )
                .ToListAsync();
        }
    }
}
