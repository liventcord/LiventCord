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
        private readonly InviteController _inviteController;
        private readonly PermissionsController _permissionsController;
        private readonly ICacheService _cacheService;
        private readonly RedisEventEmitter _redisEventEmitter;

        public MembersController(
            AppDbContext dbContext,
            InviteController inviteController,
            PermissionsController permissionsController,
            ICacheService cacheService
            , RedisEventEmitter redisEventEmitter
        )
        {
            _dbContext = dbContext;
            _inviteController = inviteController;
            _permissionsController = permissionsController;
            _cacheService = cacheService;
            _redisEventEmitter = redisEventEmitter;
        }

        [HttpGet("/api/guilds/{guildId}/members")]
        public async Task<IActionResult> HandleGetMembers(
            [FromRoute][IdLengthValidation] string guildId
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

        [HttpPost("/api/guilds/{inviteId}/members")]
        public async Task<IActionResult> HandleGuildJoin([FromRoute] string inviteId)
        {
            if (string.IsNullOrEmpty(inviteId))
            {
                return Ok(new { success = false, message = "Join ID is required." });
            }

            var (guildId, joinedChannelId) = await _inviteController.GetGuildIdByInviteAsync(inviteId);

            if (string.IsNullOrEmpty(guildId))
                return Ok(new { success = false, message = "Invalid or expired invite." });

            try
            {
                await AddMemberToGuild(UserId!, guildId);
                var guild = await GetUserGuildAsync(UserId!, guildId);
                await InvalidateGuildMemberCaches(UserId!, guildId);
                return Ok(new { success = true, guild, joinedChannelId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }


        [HttpDelete("/api/guilds/{guildId}/members")]
        public async Task<IActionResult> HandleGuildLeave([FromRoute][IdLengthValidation] string guildId)
        {
            await RemoveMemberFromGuild(UserId!, guildId);
            await InvalidateGuildMemberCaches(UserId!, guildId);
            return Ok(new { guildId });
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
            PermissionFlags combinedPermissions = PermissionFlags.ReadMessages | PermissionFlags.SendMessages | PermissionFlags.MentionEveryone;
            await _permissionsController.AddPermissions(guildId, userId, combinedPermissions);

            await _dbContext.SaveChangesAsync();


            await _redisEventEmitter.EmitGuildMembersToRedis(guildId);
        }

        private async Task RemoveMemberFromGuild(string userId, string guildId)
        {
            var guild = await _dbContext
                .Guilds.Include(g => g.GuildMembers)
                .FirstOrDefaultAsync(g => g.GuildId == guildId);

            if (guild == null)
                throw new Exception("Guild not found");

            var guildMember = guild.GuildMembers.FirstOrDefault(gu => gu.MemberId == userId);

            if (guildMember == null)
                throw new Exception("User is not a member of this guild");

            guild.GuildMembers.Remove(guildMember);

            await _permissionsController.RemovePermissions(guildId, userId, PermissionFlags.ReadMessages);
            await _permissionsController.RemovePermissions(guildId, userId, PermissionFlags.SendMessages);
            await _permissionsController.RemovePermissions(guildId, userId, PermissionFlags.MentionEveryone);

            await _dbContext.SaveChangesAsync();
            await _redisEventEmitter.EmitGuildMembersToRedis(guildId);

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
                    CreatedAt = gu.User.CreatedAt,
                    SocialMediaLinks = gu.User.SocialMediaLinks,
                })
                .Select(user => new PublicUser
                {
                    UserId = user.UserId,
                    NickName = user.NickName,
                    Discriminator = user.Discriminator,
                    Description = user.Description,
                    CreatedAt = user.CreatedAt,
                    SocialMediaLinks = user.SocialMediaLinks,
                })
                .ToListAsync();
        }

        [NonAction]
        public async Task<Dictionary<string, List<string>>> GetSharedGuilds(string userId, List<PublicUserWithFriendData?>? friends, List<GuildDto> guilds)
        {
            if (string.IsNullOrEmpty(userId) || friends == null || !friends.Any())
                return new Dictionary<string, List<string>>();

            var sharedGuildsWithFriends = new Dictionary<string, List<string>>();

            foreach (var friend in friends)
            {
                if (friend == null || string.IsNullOrEmpty(friend.UserId))
                    continue;

                var sharedGuildsForFriend = await _dbContext
                    .GuildMembers.Where(gu => gu.MemberId == friend.UserId)
                    .Select(gu => gu.GuildId)
                    .ToListAsync();

                foreach (var guild in guilds)
                {
                    var guildId = guild.GuildId;

                    if (string.IsNullOrEmpty(guildId))
                        continue;

                    if (sharedGuildsForFriend.Contains(guildId))
                    {
                        if (!sharedGuildsWithFriends.ContainsKey(guildId))
                        {
                            sharedGuildsWithFriends[guildId] = new List<string>();
                        }

                        if (!sharedGuildsWithFriends[guildId].Contains(friend.UserId))
                        {
                            sharedGuildsWithFriends[guildId].Add(friend.UserId);
                        }
                    }
                }
            }

            return sharedGuildsWithFriends;
        }


        [NonAction]
        public async Task<GuildDto?> GetUserGuildAsync(string userId, string guildId)
        {
            var guild = await _dbContext.GuildMembers
                .Where(gm => gm.MemberId == userId && gm.GuildId == guildId)
                .Include(gm => gm.Guild)
                .ThenInclude(g => g.Channels)
                .Select(gm => new GuildDto
                {
                    GuildId = gm.Guild.GuildId,
                    OwnerId = gm.Guild.OwnerId,
                    GuildName = gm.Guild.GuildName,
                    RootChannel = gm.Guild.RootChannel,
                    Region = gm.Guild.Region,
                    IsGuildUploadedImg = gm.Guild.IsGuildUploadedImg,
                    GuildMembers = _dbContext.GuildMembers
                        .Where(g => g.GuildId == gm.Guild.GuildId)
                        .Select(g => g.MemberId)
                        .ToList(),
                    GuildChannels = new List<ChannelWithLastRead>()
                })
                .FirstOrDefaultAsync();

            if (guild == null) return null;

            var allChannels = await _dbContext.Channels
                .Where(c => c.GuildId == guildId)
                .Select(c => new
                {
                    c.ChannelId,
                    c.ChannelName,
                    c.IsTextChannel,
                    LastReadDateTime = _dbContext.UserChannels
                        .Where(uc => uc.UserId == userId && uc.ChannelId == c.ChannelId)
                        .Select(uc => uc.LastReadDatetime)
                        .FirstOrDefault()
                })
                .ToListAsync();

            guild.GuildChannels = allChannels.Select(c => new ChannelWithLastRead
            {
                ChannelId = c.ChannelId,
                ChannelName = c.ChannelName,
                IsTextChannel = c.IsTextChannel,
                LastReadDateTime = c.LastReadDateTime
            }).ToList();

            return guild;
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

        public async Task InvalidateGuildMemberCaches(string userId, string guildId)
        {
            _cacheService.InvalidateCache(userId);
            var guild = await _dbContext.Guilds
                .Include(g => g.GuildMembers)
                .FirstOrDefaultAsync(g => g.GuildId == guildId);
            if (guild != null)
            {

                var cachedUserIds = _cacheService.GetCachedUserIds();

                var memberIdsToInvalidate = await _dbContext.GuildMembers
                    .Where(m => m.GuildId == guildId && cachedUserIds.Contains(m.MemberId))
                    .Select(m => m.MemberId)
                    .ToArrayAsync();

                _cacheService.InvalidateGuildMemberCaches(memberIdsToInvalidate);
            }
        }


    }

}
