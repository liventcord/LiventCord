using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("")]
    [ApiController]
    [Authorize]
    public class MembersController : BaseController
    {
        private readonly AppDbContext _dbContext;
        private readonly InviteController _guildInviteService;
        private readonly PermissionsController _permissionsController;
        private static List<string> OnlineMembers = new();

        private static bool IsOnline(string userId)
        {
            return OnlineMembers.Contains(userId);
        }

        public MembersController(
            AppDbContext dbContext,
            InviteController guildInviteService,
            PermissionsController permissionsController
        )
        {
            _dbContext = dbContext;
            _guildInviteService = guildInviteService;
            _permissionsController = permissionsController;
        }

        [HttpGet("/api/guilds/{guildId}/members")]
        public async Task<IActionResult> HandleGetMembers(
            [FromRoute] [IdLengthValidation] string guildId
        )
        {
            if (!await _dbContext.DoesGuildExist(guildId))
            {
                return NotFound(new { Type = "error", Message = "Guild does not exist." });
            }

            if (!await DoesMemberExistInGuild(UserId!, guildId))
            {
                return NotFound(new { Type = "error", Message = "Guild does not exist." });
            }

            var members = await GetGuildMembers(guildId).ConfigureAwait(false);
            if (members == null)
            {
                return BadRequest(new { Type = "error", Message = "Unable to retrieve members." });
            }

            return Ok(new { guildId, members });
        }

        [HttpPost("/api/guilds/{guildId}/members")]
        public async Task<IActionResult> HandleGuildJoin([FromBody] string joinId)
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
                await AddMemberToGuild(UserId!, guildId);
                return Ok(new { message = "Successfully joined the guild." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        private async Task AddMemberToGuild(string userId, string guildId)
        {
            var guild = await _dbContext
                .Guilds.Include(g => g.GuildMembers)
                .FirstOrDefaultAsync(g => g.GuildId == guildId);

            if (guild == null)
                throw new Exception("Guild not found");
            var member = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
            if (member == null)
                throw new Exception("User not found");

            if (!guild.GuildMembers.Any(gu => gu.MemberId == userId))
            {
                guild.GuildMembers.Add(
                    new GuildMember
                    {
                        MemberId = userId,
                        GuildId = guildId,
                        Guild = guild,
                        User = member,
                    }
                );
            }

            var permissions =
                PermissionFlags.ReadMessages
                | PermissionFlags.SendMessages
                | PermissionFlags.MentionEveryone;

            await _permissionsController.AssignPermissions(guildId, userId, permissions);

            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task<bool> DoesMemberExistInGuild(string userId, string guildId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(guildId))
                return false;

            return await _dbContext
                .GuildMembers.Where(gu => gu.MemberId == userId && gu.GuildId == guildId)
                .AnyAsync();
        }

        [NonAction]
        public async Task SetMemberOnlineStatus(string userId, bool isOnline)
        {
            var user = await _dbContext.Users.FindAsync(userId);
            if (user != null)
            {
                if (isOnline && !OnlineMembers.Contains(userId))
                    OnlineMembers.Add(userId);
                else if (!isOnline)
                    OnlineMembers.Remove(userId);
                await _dbContext.SaveChangesAsync();
            }
        }

        [NonAction]
        public async Task<List<string>> GetGuildMembersIds(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return new List<string>();

            return await _dbContext
                .GuildMembers.Where(gu => gu.GuildId == guildId)
                .Select(gu => gu.User.UserId)
                .ToListAsync();
        }

        [NonAction]
        public async Task<List<PublicUser>> GetGuildMembers(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return new List<PublicUser>();

            return await _dbContext
                .GuildMembers.Where(gu => gu.GuildId == guildId)
                .Select(gu => new PublicUser
                {
                    UserId = gu.User.UserId,
                    NickName = gu.User.Nickname,
                    Discriminator = gu.User.Discriminator,
                    Description = gu.User.Description,
                    Status = gu.User.Status,
                    IsOnline = IsOnline(gu.User.UserId),
                    CreatedAt = gu.User.CreatedAt,
                    SocialMediaLinks = gu.User.SocialMediaLinks,
                })
                .Select(user => new PublicUser
                {
                    UserId = user.UserId,
                    NickName = user.NickName,
                    Discriminator = user.Discriminator,
                    Description = user.Description,
                    Status = user.Status,
                    IsOnline = user.IsOnline,
                    CreatedAt = user.CreatedAt,
                    SocialMediaLinks = user.SocialMediaLinks,
                })
                .ToListAsync();
        }

        [NonAction]
        public async Task<List<string>> GetSharedGuilds(string guildId, string userId)
        {
            if (string.IsNullOrEmpty(guildId) || string.IsNullOrEmpty(userId))
                return new List<string>();

            var sharedGuilds = await _dbContext
                .GuildMembers.Where(gu => gu.MemberId == userId)
                .Select(gu => gu.GuildId)
                .ToListAsync();

            return sharedGuilds.Where(g => g != guildId).ToList();
        }

        [NonAction]
        public async Task<List<GuildDto>> GetUserGuilds(string userId)
        {
            var guilds = await _dbContext
                .GuildMembers.Where(gu => gu.MemberId == userId)
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
                    GuildMembers = _dbContext
                        .GuildMembers.Where(g => g.GuildId == gu.Guild.GuildId)
                        .Select(g => g.MemberId)
                        .ToList(),
                    GuildChannels = new List<ChannelWithLastRead>(),
                })
                .ToListAsync();

            var allChannels = await _dbContext
                .Channels.Where(c => guilds.Select(g => g.GuildId).Contains(c.GuildId))
                .Select(c => new
                {
                    c.ChannelId,
                    c.ChannelName,
                    c.IsTextChannel,
                    LastReadDateTime = _dbContext
                        .UserChannels.Where(uc =>
                            uc.UserId == userId && uc.ChannelId == c.ChannelId
                        )
                        .Select(uc => uc.LastReadDatetime)
                        .FirstOrDefault(),
                    c.GuildId,
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
                        LastReadDateTime = c.LastReadDateTime,
                    })
                    .ToList();

            return guilds;
        }
    }
}
