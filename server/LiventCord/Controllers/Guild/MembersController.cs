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
            ICacheService cacheService,
            RedisEventEmitter redisEventEmitter
        )
        {
            _dbContext = dbContext;
            _inviteController = inviteController;
            _permissionsController = permissionsController;
            _cacheService = cacheService;
            _redisEventEmitter = redisEventEmitter;
        }

        [HttpGet("/api/v1/guilds/{guildId}/members")]
        public async Task<IActionResult> HandleGetMembers([FromRoute][IdLengthValidation] string guildId)
        {
            var members = await (
                from gm in _dbContext.GuildMembers
                join u in _dbContext.Users on gm.MemberId equals u.UserId
                join pf in _dbContext.ProfileFiles on u.UserId equals pf.UserId into pfs
                from pf in pfs.DefaultIfEmpty()
                where gm.GuildId == guildId
                select new PublicUser
                {
                    UserId = u.UserId,
                    NickName = u.Nickname,
                    Discriminator = u.Discriminator,
                    Description = u.Description,
                    CreatedAt = u.CreatedAt,
                    SocialMediaLinks = u.SocialMediaLinks,
                    ProfileVersion = pf.Version
                }
            ).ToListAsync();

            if (!members.Any(m => m.UserId == UserId))
                return NotFound(new { Type = "error", Message = "Guild does not exist." });

            return Ok(new { guildId, members });
        }

        [HttpPost("/api/v1/guilds/{inviteId}/members")]
        public async Task<IActionResult> HandleGuildJoin([FromRoute] string inviteId)
        {
            if (string.IsNullOrEmpty(inviteId))
                return Ok(new { success = false, message = "Join ID is required." });

            var (guildId, joinedChannelId) = await _inviteController.GetGuildIdByInviteAsync(inviteId);

            if (string.IsNullOrEmpty(guildId))
                return Ok(new { success = false, message = "Invalid or expired invite." });

            try
            {
                await AddMemberToGuild(UserId!, guildId);
                var guild = await GetUserGuildAsync(UserId!, guildId);
                await InvalidateGuildMemberCaches(UserId!, guildId);
                var permissions = await _permissionsController.GetPermissionsMapForUser(UserId!);
                return Ok(new { success = true, guild, joinedChannelId, permissions });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpDelete("/api/v1/guilds/{guildId}/members")]
        public async Task<IActionResult> HandleGuildLeave([FromRoute][IdLengthValidation] string guildId)
        {
            var isMember = await _dbContext.GuildMembers
                .AnyAsync(gm => gm.GuildId == guildId && gm.MemberId == UserId);

            if (!isMember)
                return NotFound(new { Type = "error", Message = "You are not a member of this guild." });

            await RemoveMemberFromGuild(UserId!, guildId);
            await InvalidateGuildMemberCaches(UserId!, guildId);
            return Ok(new { guildId });
        }

        [HttpDelete("/api/v1/guilds/{guildId}/members/{memberId}")]
        public async Task<IActionResult> HandleGuildKick(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][UserIdLengthValidation] string memberId
        )
        {
            var canKickUser = await _permissionsController.CanKickUser(guildId, UserId!, memberId);
            if (!canKickUser)
                return Forbid();

            var userId = memberId;
            var payload = new { guildId, userId };
            await _redisEventEmitter.EmitToGuild(EventType.KICK_MEMBER, payload, guildId);
            await RemoveMemberFromGuild(memberId, guildId);
            await InvalidateGuildMemberCaches(memberId, guildId);

            return Ok(payload);
        }

        private async Task AddMemberToGuild(string userId, string guildId)
        {
            var guild = await _dbContext.Guilds
                .AsNoTracking()
                .FirstOrDefaultAsync(g => g.GuildId == guildId);

            if (guild == null)
                throw new Exception("Guild not found");

            var alreadyMember = await _dbContext.GuildMembers
                .AnyAsync(gm => gm.GuildId == guildId && gm.MemberId == userId);

            if (alreadyMember)
                return;

            var member = await _dbContext.Users
                .FirstOrDefaultAsync(u => u.UserId == userId);

            if (member == null)
                throw new Exception("User not found");

            _dbContext.GuildMembers.Add(new GuildMember
            {
                MemberId = userId,
                GuildId = guildId
            });

            await _permissionsController.AddPermissions(
                guildId,
                userId,
                PermissionFlags.ReadMessages | PermissionFlags.SendMessages | PermissionFlags.MentionEveryone
            );

            await _dbContext.SaveChangesAsync();

            var latestProfileVersion = await _dbContext.ProfileFiles
                .Where(f => f.UserId == userId)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => f.Version)
                .FirstOrDefaultAsync();

            var userData = new PublicUser
            {
                UserId = member.UserId,
                NickName = member.Nickname,
                Discriminator = member.Discriminator,
                Description = member.Description,
                CreatedAt = member.CreatedAt,
                SocialMediaLinks = member.SocialMediaLinks,
                ProfileVersion = latestProfileVersion
            };

            var payload = new { guildId, userId, userData };

            await _redisEventEmitter.EmitToGuild(EventType.GUILD_MEMBER_ADDED, payload, guildId, userId);
            await _redisEventEmitter.EmitGuildMembersToRedis(guildId);
            await InvalidateGuildMemberCaches(userId, guildId);
        }

        private async Task RemoveMemberFromGuild(string userId, string guildId)
        {
            var guildMember = await _dbContext.GuildMembers
                .FirstOrDefaultAsync(gm => gm.GuildId == guildId && gm.MemberId == userId);

            if (guildMember == null)
                throw new Exception("User is not a member of this guild");

            _dbContext.GuildMembers.Remove(guildMember);
            await _permissionsController.RemoveAllPermissions(guildId, userId);
            await _dbContext.SaveChangesAsync();

            var payload = new { guildId, userId };
            await _redisEventEmitter.EmitToUser(EventType.GUILD_MEMBER_REMOVED, payload, guildId);
            await _redisEventEmitter.EmitGuildMembersToRedis(guildId);
            await InvalidateGuildMemberCaches(userId, guildId);
        }

        [NonAction]
        public async Task<bool> DoesMemberExistInGuild(string userId, string guildId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(guildId))
                return false;

            return await _dbContext.GuildMembers
                .AnyAsync(gu => gu.MemberId == userId && gu.GuildId == guildId);
        }

        [NonAction]
        public async Task<List<string>> GetGuildMembersIds(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return new List<string>();

            return await _dbContext.GuildMembers
                .Where(gu => gu.GuildId == guildId)
                .Select(gu => gu.MemberId)
                .ToListAsync();
        }

        [NonAction]
        public async Task<List<PublicUser>> GetGuildMembers(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return new List<PublicUser>();

            return await (
                from gm in _dbContext.GuildMembers
                where gm.GuildId == guildId
                join u in _dbContext.Users on gm.MemberId equals u.UserId
                join pf in _dbContext.ProfileFiles on u.UserId equals pf.UserId into pfs
                from pf in pfs.DefaultIfEmpty()
                select new PublicUser
                {
                    UserId = u.UserId,
                    NickName = u.Nickname,
                    Discriminator = u.Discriminator,
                    Description = u.Description,
                    CreatedAt = u.CreatedAt,
                    SocialMediaLinks = u.SocialMediaLinks,
                    ProfileVersion = pf != null ? pf.Version : null
                }
            ).ToListAsync();
        }

        [NonAction]
        public async Task<Dictionary<string, List<string>>> GetSharedGuilds(
            string userId,
            List<PublicUserWithFriendData?>? friends,
            List<GuildDto> guilds)
        {
            if (string.IsNullOrEmpty(userId) || friends == null || !friends.Any())
                return new Dictionary<string, List<string>>();

            var friendIds = friends
                .Where(f => f != null && !string.IsNullOrEmpty(f.UserId))
                .Select(f => f!.UserId)
                .ToList();

            var userGuildIds = guilds
                .Where(g => !string.IsNullOrEmpty(g.GuildId))
                .Select(g => g.GuildId)
                .ToHashSet();

            var friendGuildPairs = await _dbContext.GuildMembers
                .Where(gm => friendIds.Contains(gm.MemberId) && userGuildIds.Contains(gm.GuildId))
                .Select(gm => new { gm.GuildId, gm.MemberId })
                .ToListAsync();

            var intermediate = new Dictionary<string, HashSet<string>>();
            foreach (var pair in friendGuildPairs)
            {
                if (!intermediate.TryGetValue(pair.GuildId, out var set))
                {
                    set = new HashSet<string>();
                    intermediate[pair.GuildId] = set;
                }
                set.Add(pair.MemberId);
            }

            return intermediate.ToDictionary(kv => kv.Key, kv => kv.Value.ToList());
        }

        [NonAction]
        public async Task<PublicUser?> GetMemberInfo(string guildId, string userId)
        {
            if (string.IsNullOrEmpty(guildId) || string.IsNullOrEmpty(userId))
                return null;

            return await _dbContext.GuildMembers
                .Where(gu => gu.GuildId == guildId && gu.User.UserId == userId)
                .Select(gu => new PublicUser
                {
                    UserId = gu.User.UserId,
                    NickName = gu.User.Nickname,
                    Discriminator = gu.User.Discriminator,
                    Description = gu.User.Description,
                    CreatedAt = gu.User.CreatedAt,
                    SocialMediaLinks = gu.User.SocialMediaLinks,
                })
                .FirstOrDefaultAsync();
        }

        [NonAction]
        public async Task<GuildDto?> GetUserGuildAsync(string userId, string guildId)
        {
            var isMember = await _dbContext.GuildMembers
                .AnyAsync(gm => gm.GuildId == guildId && gm.MemberId == userId);

            if (!isMember)
                return null;

            var memberIds = await _dbContext.GuildMembers
                .Where(gm => gm.GuildId == guildId)
                .Select(gm => gm.MemberId)
                .ToListAsync();

            var guild = await _dbContext.Guilds
                .Where(g => g.GuildId == guildId)
                .Select(g => new GuildDto
                {
                    GuildId = g.GuildId,
                    OwnerId = g.OwnerId,
                    GuildName = g.GuildName,
                    RootChannel = g.RootChannel,
                    Region = g.Region,
                    IsGuildUploadedImg = g.IsGuildUploadedImg,
                    GuildMembers = memberIds,
                    GuildChannels = new List<ChannelWithLastRead>(),
                    GuildVersion = _dbContext.GuildFiles
                        .Where(f => f.GuildId == g.GuildId)
                        .OrderByDescending(f => f.CreatedAt)
                        .Select(f => f.Version)
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (guild == null)
                return null;

            guild.GuildChannels = await (
                from c in _dbContext.Channels
                join uc in _dbContext.UserChannels.Where(uc => uc.UserId == userId)
                    on c.ChannelId equals uc.ChannelId into ucs
                from uc in ucs.DefaultIfEmpty()
                where c.GuildId == guildId
                select new ChannelWithLastRead
                {
                    ChannelId = c.ChannelId,
                    ChannelName = c.ChannelName,
                    IsTextChannel = c.IsTextChannel,
                    LastReadDateTime = uc.LastReadDatetime
                }
            ).ToListAsync();

            return guild;
        }

        [NonAction]
        public async Task<List<GuildDto>> GetUserGuilds(string userId)
        {
            var userGuildIds = _dbContext.GuildMembers
                .Where(gm => gm.MemberId == userId)
                .Select(gm => gm.GuildId);

            var rawGuilds = await _dbContext.Guilds
                .AsNoTracking()
                .Where(g => userGuildIds.Contains(g.GuildId))
                .ToListAsync();

            if (!rawGuilds.Any())
                return new List<GuildDto>();

            var guildIds = rawGuilds
                .Where(g => g.GuildId != null)
                .Select(g => g.GuildId!)
                .ToList();

            var members = await _dbContext.GuildMembers
                .AsNoTracking()
                .Where(gm => gm.GuildId != null && guildIds.Contains(gm.GuildId))
                .Select(gm => new { gm.GuildId, gm.MemberId })
                .ToListAsync();

            var channels = await (
                from c in _dbContext.Channels.AsNoTracking()
                join uc in _dbContext.UserChannels.AsNoTracking().Where(uc => uc.UserId == userId)
                    on c.ChannelId equals uc.ChannelId into ucs
                from uc in ucs.DefaultIfEmpty()
                where c.GuildId != null && guildIds.Contains(c.GuildId)
                select new
                {
                    GuildId = c.GuildId!,
                    Channel = new ChannelWithLastRead
                    {
                        ChannelId = c.ChannelId,
                        ChannelName = c.ChannelName,
                        IsTextChannel = c.IsTextChannel,
                        LastReadDateTime = uc.LastReadDatetime
                    }
                }
            ).ToListAsync();

            var versionsMap = await _dbContext.GuildFiles
                .AsNoTracking()
                .Where(f => f.GuildId != null && guildIds.Contains(f.GuildId))
                .GroupBy(f => f.GuildId)
                .Select(g => new
                {
                    GuildId = g.Key!,
                    Version = g.OrderByDescending(f => f.CreatedAt).Select(f => f.Version).FirstOrDefault()
                })
                .ToDictionaryAsync(x => x.GuildId, x => x.Version);

            var membersLookup = members.ToLookup(m => m.GuildId!, m => m.MemberId);
            var channelsLookup = channels.ToLookup(c => c.GuildId, c => c.Channel);

            return rawGuilds.Select(g => new GuildDto
            {
                GuildId = g.GuildId,
                OwnerId = g.OwnerId,
                GuildName = g.GuildName,
                RootChannel = g.RootChannel,
                Region = g.Region,
                IsGuildUploadedImg = g.IsGuildUploadedImg,
                GuildVersion = versionsMap.GetValueOrDefault(g.GuildId ?? "", null),
                GuildMembers = membersLookup[g.GuildId ?? ""].ToList(),
                GuildChannels = channelsLookup[g.GuildId ?? ""].ToList()
            }).ToList();
        }

        [NonAction]
        public async Task InvalidateGuildMemberCaches(string? userId, string guildId)
        {
            if (userId != null)
                _cacheService.InvalidateCache(userId);

            var cachedUserIds = _cacheService.GetCachedUserIds();
            if (!cachedUserIds.Any())
                return;

            var memberIdsToInvalidate = await _dbContext.GuildMembers
                .Where(m => m.GuildId == guildId && cachedUserIds.Contains(m.MemberId))
                .Select(m => m.MemberId)
                .ToArrayAsync();

            _cacheService.InvalidateGuildMemberCaches(memberIdsToInvalidate);
        }
    }
}