using Microsoft.EntityFrameworkCore;
using LiventCord.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using LiventCord.Models;
using System.ComponentModel.DataAnnotations;


namespace LiventCord.Controllers
{
    [Route("api/guilds/{guildId}/members")]
    [ApiController]
    [Authorize]

    public class MembersController : ControllerBase
    {
        private readonly AppDbContext _dbContext;
        private readonly GuildInviteService _guildInviteService;
        private readonly PermissionsController _permissionsController;
        private static List<string> OnlineUsers = new();
        private static bool IsOnline(string userId){return OnlineUsers.Contains(userId);}
        public MembersController(AppDbContext dbContext,GuildInviteService guildInviteService,PermissionsController permissionsController)
        {
            _dbContext = dbContext;
            _guildInviteService = guildInviteService;
            _permissionsController = permissionsController;

        }

        // GET /api/guilds/{guildId}/members
        [HttpGet("{guildId}/members")]
        public async Task<IActionResult> HandleGetUsers([FromQuery] GetGuildMembersRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (!await DoesUserExistInGuild(request.UserId, request.GuildId))
                return BadRequest(new { Type = "error", Message = "User not in guild." });

            var users = await GetGuildUsers(request.GuildId).ConfigureAwait(false);
            if (users == null)
                return BadRequest(new { Type = "error", Message = "Unable to retrieve users." });

            var updateUsersMessage = new
            {
                Type = "update_users",
                Data = new { guildId = request.GuildId, users }
            };

            return Ok(updateUsersMessage);
        }

        // POST /api/guilds/{guild_id}/members
        [HttpPost("/api/guilds/{guild_id}/members")]
        public async Task<IActionResult> HandleGuildJoin([FromBody] string joinId, [FromHeader] string userId)
        {
            if (string.IsNullOrEmpty(joinId))
            {
                return BadRequest(new { message = "Join ID is required." });
            }

            var guildId = await _guildInviteService.GetGuildIdByInviteAsync(joinId);

            if (string.IsNullOrEmpty(guildId))
                return NotFound(new { message = "Invalid or expired invite." });
            

            try
            {
                await AddUserToGuild(userId, guildId);
                return Ok(new { message = "Successfully joined the guild." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

                
    

        private async Task AddUserToGuild(string userId, string guildId)
        {
            var guild = await _dbContext.Guilds
                .Include(g => g.GuildMembers)
                .FirstOrDefaultAsync(g => g.GuildId == guildId);

            if (guild == null) 
                throw new Exception("Guild not found");
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null)
                throw new Exception("User not found");

            if (!guild.GuildMembers.Any(gu => gu.MemberId == userId))
            {
                guild.GuildMembers.Add(new GuildUser { MemberId = userId , GuildId = guildId, Guild = guild, User=user});
            }

            var permissions = PermissionFlags.ReadMessages 
                            | PermissionFlags.SendMessages 
                            | PermissionFlags.MentionEveryone;

            await _permissionsController.AssignPermissions(guildId, userId, permissions);


            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task SetUserOnlineStatus(string userId, bool isOnline)
        {
            var user = await _dbContext.Users.FindAsync(userId);
            if (user != null)
            {
                if(isOnline && !OnlineUsers.Contains(userId)) OnlineUsers.Add(userId);
                else if(!isOnline) OnlineUsers.Remove(userId);
                await _dbContext.SaveChangesAsync();
            }
        }


        [NonAction]
        public async Task<List<string>> GetGuildUsersIds(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return new List<string>();

            return await _dbContext.GuildUsers
                .Where(gu => gu.GuildId == guildId)
                .Select(gu => gu.User.UserId)
                .ToListAsync();
        }
        [NonAction]
        public async Task<List<PublicUser>> GetGuildUsers(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return new List<PublicUser>();

            return await _dbContext.GuildUsers
                .Where(gu => gu.GuildId == guildId)
                .Select(gu => new PublicUser
                {
                    UserId = gu.User.UserId,
                    Nickname = gu.User.Nickname,
                    Discriminator = gu.User.Discriminator,
                    Description = gu.User.Description,
                    Status = gu.User.Status,
                    IsOnline = IsOnline(gu.User.UserId),
                    CreatedAt = gu.User.CreatedAt,
                    SocialMediaLinks = gu.User.SocialMediaLinks
                })
                .ToListAsync();
        }
        [NonAction]
        public async Task<List<string>> GetSharedGuilds(string guildId, string userId)
        {
            if (string.IsNullOrEmpty(guildId) || string.IsNullOrEmpty(userId))
                return new List<string>();

            var sharedGuilds = await _dbContext.GuildUsers
                .Where(gu => gu.MemberId == userId)
                .Select(gu => gu.GuildId)
                .ToListAsync();

            return sharedGuilds.Where(g => g != guildId).ToList();
        }

        [NonAction]
        public async Task<bool> DoesUserExistInGuild(string userId, string guildId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(guildId))
                return false;

            return await _dbContext.GuildUsers
                .AnyAsync(gu => gu.MemberId == userId && gu.GuildId == guildId);
        }

        [NonAction]
        public async Task<List<GuildDto>> GetUserGuilds(string userId)
        {
            var guilds = await _dbContext.GuildUsers
                .Where(gu => gu.MemberId == userId)
                .Include(gu => gu.Guild)
                .ThenInclude(g => g.Channels)
                .Select(gu => new GuildDto
                {
                    GuildId = gu.Guild.GuildId,
                    OwnerId = gu.Guild.OwnerId,
                    GuildName = gu.Guild.GuildName,
                    RootChannel = gu.Guild.RootChannel,
                    Region = gu.Guild.Region,
                    IsGuildUploadedImg = gu.Guild.IsGuildUploadedImg,
                    GuildMembers = _dbContext.GuildUsers
                        .Where(g => g.GuildId == gu.Guild.GuildId)
                        .Select(g => g.MemberId)
                        .ToList(),
                    GuildChannels = new List<ChannelWithLastRead>()
                })
                .ToListAsync();

            var allChannels = await _dbContext.Channels
                .Where(c => guilds.Select(g => g.GuildId).Contains(c.GuildId))
                .Select(c => new
                {
                    c.ChannelId,
                    c.ChannelName,
                    c.IsTextChannel,
                    LastReadDateTime = _dbContext.UserChannels
                        .Where(uc => uc.UserId == userId && uc.ChannelId == c.ChannelId)
                        .Select(uc => uc.LastReadDatetime)
                        .FirstOrDefault(),
                    c.GuildId
                })
                .ToListAsync();

            foreach (var guild in guilds)
                guild.GuildChannels = allChannels
                    .Where(c => c.GuildId == guild.GuildId)
                    .Select(c => new ChannelWithLastRead
                    {
                        ChannelId = c.ChannelId,
                        ChannelName = c.ChannelName,
                        IsTextChannel = c.IsTextChannel,
                        LastReadDateTime = c.LastReadDateTime
                    })
                    .ToList();

            return guilds;
        }

        
    }
}
public class GetGuildMembersRequest
{
    [Required(ErrorMessage = "Guild ID is required.")]
    public required string GuildId { get; set; }

    [Required(ErrorMessage = "User ID is required.")]
    public required string UserId { get; set; }
}
