using Microsoft.EntityFrameworkCore;
using LiventCord.Helpers;
using System.Security.Claims;
using System.Text.Json;
using LiventCord.Controllers;
using LiventCord.Models;

namespace LiventCord.Helpers
{
    public class AppLogic
    {
        private readonly AppDbContext _dbContext;
        private readonly GuildController _guildController;
        private readonly MembersController _membersController;
        private readonly FriendController _friendController;
        private readonly TypingController _typingController;
        private readonly ILogger<AppLogic> _logger;
        private readonly PermissionsController _permissionsController;

        public AppLogic(AppDbContext dbContext, FriendController friendController, GuildController guildController, 
            MembersController membersController, TypingController typingController, ILogger<AppLogic> logger, 
            PermissionsController permissionsController)
        {
            _dbContext = dbContext;
            _guildController = guildController;
            _friendController = friendController;
            _typingController = typingController;
            _logger = logger;
            _permissionsController = permissionsController;
            _membersController = membersController;
        }
        public async Task HandleInitRequest(HttpContext context)
        {
            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                _logger.LogInformation("userId: {UserId}", userId);

                if (string.IsNullOrEmpty(userId))
                {
                    context.Response.Redirect("/login");
                    return;
                }

                _logger.LogInformation("Attempting to retrieve user from database...");
                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (user == null)
                {
                    context.Response.Redirect("/login");
                    return;
                }

                _logger.LogInformation("Fetching guilds for user...");
                var guilds = await _membersController.GetUserGuilds(userId);

                var jsonData = new
                {
                    email = user.Email ?? "",
                    userId,
                    nickName = user.Nickname ?? "",
                    userDiscriminator = user.Discriminator ?? "",
                    guildMembers = new List<PublicUser>(),
                    sharedGuildsMap = new List<string>(),
                    permissionsMap = new Dictionary<string, string>(),
                    friendsStatus = await _friendController.GetFriendsStatus(userId),
                    dmFriends = new List<string>(),
                    guildsJson = guilds
                };

                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(jsonData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while fetching the initial data.");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync("An internal server error occurred.");
            }
        }

        public async Task HandleChannelRequest(HttpContext context, string? guildId, string? channelId, string? friendId = null)
        {
            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                _logger.LogInformation("userId: {UserId}", userId);

                if (string.IsNullOrEmpty(userId))
                {
                    context.Response.Redirect("/login");
                    return;
                }

                var filePath = Path.Combine(context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootPath, "app.html");
                _logger.LogInformation("Reading HTML file from path: {FilePath}", filePath);
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
