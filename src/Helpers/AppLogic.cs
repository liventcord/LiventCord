using System.Security.Claims;
using LiventCord.Controllers;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Helpers
{
    public class AppLogicService
    {
        private readonly AppDbContext _dbContext;
        private readonly GuildController _guildController;
        private readonly MembersController _membersController;
        private readonly FriendController _friendController;
        private readonly TypingController _typingController;
        private readonly LoginController _loginController;
        private readonly ILogger<AppLogicService> _logger;
        private readonly PermissionsController _permissionsController;
        private readonly string? _gifWorkerUrl;
        private readonly float? _maxAvatarSize;
        private readonly float? _maxAttachmentSize;
        private readonly float defaultAvatarSize = 3; //megabytes
        private readonly float defaultAttachmentSize = 30; //megabytes
        private readonly string defaultGifWorkerUrl =
            "https://liventcord-gif-worker.efekantunc0.workers.dev";

        public AppLogicService(
            AppDbContext dbContext,
            FriendController friendController,
            GuildController guildController,
            MembersController membersController,
            TypingController typingController,
            ILogger<AppLogicService> logger,
            LoginController loginController,
            PermissionsController permissionsController,
            IConfiguration configuration
        )
        {
            _dbContext = dbContext;
            _guildController = guildController;
            _friendController = friendController;
            _typingController = typingController;
            _loginController = loginController;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _logger = logger;
            _gifWorkerUrl =
                configuration["AppSettings:GifWorkerUrl"] != null
                    ? configuration["AppSettings:GifWorkerUrl"]
                    : defaultGifWorkerUrl;

            _maxAvatarSize = float.TryParse(
                configuration["AppSettings:MaxAvatarSize"],
                out var avatarSize
            )
                ? avatarSize
                : defaultAvatarSize;
            _maxAttachmentSize = float.TryParse(
                configuration["AppSettings:MaxAttachmentSize"],
                out var uploadSize
            )
                ? uploadSize
                : defaultAttachmentSize;
        }

        public async Task HandleInitRequest(HttpContext context)
        {
            async Task RejectStaleSession()
            {
                await context.Response.WriteAsJsonAsync(
                    new { message = "User session is no longer valid. Please log in again." }
                );
                await _loginController.Logout();
            }

            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    await RejectStaleSession();
                    return;
                }

                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);

                if (user == null)
                {
                    await RejectStaleSession();
                    return;
                }

                var guilds = await _membersController.GetUserGuilds(userId);

                var jsonData = new
                {
                    userId,
                    email = user.Email ?? "",
                    nickName = user.Nickname ?? "",
                    userStatus = user.Status ?? "",
                    userDiscriminator = user.Discriminator ?? "",
                    guildMembers = new List<PublicUser>(),
                    sharedGuildsMap = new List<string>(),
                    permissionsMap = await _permissionsController.GetPermissionsMapForUser(userId),
                    friendsStatus = await _friendController.GetFriendsStatus(userId),
                    dmFriends = new List<string>(),
                    guildsJson = guilds,
                    gifWorkerUrl = _gifWorkerUrl,
                    maxAvatarSize = _maxAvatarSize,
                    maxUploadsize = _maxAttachmentSize,
                };

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
                    "app",
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
    }
}
