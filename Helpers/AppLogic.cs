using System.Security.Claims;
using LiventCord.Controllers;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Helpers
{
    public class AppLogicService
    {
        private readonly string defaultGifWorkerUrl = "https://liventcord-gif-worker.efekantunc0.workers.dev";
        private readonly AppDbContext _dbContext;
        private readonly GuildController _guildController;
        private readonly MembersController _membersController;
        private readonly FriendController _friendController;
        private readonly TypingController _typingController;
        private readonly LoginController _loginController;
        private readonly ILogger<AppLogicService> _logger;
        private readonly PermissionsController _permissionsController;
        private readonly string? _gifWorkerUrl;

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
            _gifWorkerUrl = configuration["AppSettings:GifWorkerUrl"] != null ? configuration["AppSettings:GifWorkerUrl"]  : defaultGifWorkerUrl;
        }

        public async Task HandleInitRequest(HttpContext context)
        {
            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new { message = "User not found." });
                    return;
                }

                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (user == null)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(
                        new { message = "User session is no longer valid. Please log in again." }
                    );
                    await _loginController.Logout();
                    return;
                }

                var guilds = await _membersController.GetUserGuilds(userId);

                var jsonData = new
                {
                    email = user.Email ?? "",
                    userId,
                    nickName = user.Nickname ?? "",
                    userStatus = user.Status ?? "",
                    userDiscriminator = user.Discriminator ?? "",
                    guildMembers = new List<PublicUser>(),
                    sharedGuildsMap = new List<string>(),
                    permissionsMap = new Dictionary<string, string>(),
                    friendsStatus = await _friendController.GetFriendsStatus(userId),
                    dmFriends = new List<string>(),
                    guildsJson = guilds,
                    gifWorkerUrl = _gifWorkerUrl 
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
        public async Task HandleChannelRequest(
            HttpContext context,
            string? guildId,
            string? channelId,
            string? friendId = null
        )
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
                    "app.html"
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
