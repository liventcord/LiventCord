using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public class PermissionsController : BaseController
    {
        private readonly AppDbContext _dbContext;

        public PermissionsController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [NonAction]
        public async Task<bool> CanManageChannels(string userId, string guildId)
        {
            var ownerId = await GetGuildOwner(guildId);
            return ownerId == userId
                || await HasPermission(userId, guildId, PermissionFlags.ManageChannels);
        }

        [NonAction]
        public async Task<bool> CanSendMessages(
            string userId,
            string guildId,
            string? oldSenderId = null
        )
        {
            if (oldSenderId != null && oldSenderId != userId)
            {
                return false;
            }
            var ownerId = await GetGuildOwner(guildId);
            if (ownerId == userId)
                return true;

            bool canSendMessages = await HasPermission(
                userId,
                guildId,
                PermissionFlags.SendMessages
            );

            return canSendMessages;
        }

        [NonAction]
        public async Task<bool> IsUserAdmin(string guildId, string userId)
        {
            var ownerId = await GetGuildOwner(guildId);
            return ownerId == userId
                || await HasPermission(userId, guildId, PermissionFlags.IsAdmin);
        }

        private async Task<string> GetGuildOwner(string guildId)
        {
            var guild = await _dbContext.Guilds.FirstOrDefaultAsync(g => g.GuildId == guildId);
            return guild?.OwnerId ?? throw new Exception("Guild not found");
        }

        [NonAction]
        public async Task<bool> HasPermission(
            string userId,
            string guildId,
            PermissionFlags permission
        )
        {
            var userPermissions = await _dbContext.GuildPermissions.FirstOrDefaultAsync(gp =>
                gp.UserId == userId && gp.GuildId == guildId
            );

            if (userPermissions == null)
                return false;

            if (userPermissions.Permissions.HasFlag(PermissionFlags.IsAdmin))
                return true;

            return userPermissions.Permissions.HasFlag(permission);
        }

        [NonAction]
        public Dictionary<string, Dictionary<string, int>> GetPermissionsMapForUser(string userId)
        {
            var permissionsMap = new Dictionary<string, Dictionary<string, int>>();

            var userPermissions = _dbContext
                .GuildPermissions.Where(gp => gp.UserId == userId)
                .Include(gp => gp.Guild)
                .ToList();

            foreach (var perm in userPermissions)
            {
                if (!permissionsMap.TryGetValue(perm.GuildId, out var permDict))
                {
                    permDict = new Dictionary<string, int>
                    {
                        { "read_messages", perm.ReadMessages },
                        { "send_messages", perm.SendMessages },
                        { "manage_roles", perm.ManageRoles },
                        { "kick_members", perm.KickMembers },
                        { "ban_members", perm.BanMembers },
                        { "manage_channels", perm.ManageChannels },
                        { "mention_everyone", perm.MentionEveryone },
                        { "add_reaction", perm.AddReaction },
                        { "is_admin", perm.IsAdmin },
                        { "can_invite", perm.CanInvite },
                    };
                    permissionsMap[perm.GuildId] = permDict;
                }
            }

            return permissionsMap;
        }

        public async Task AssignPermissions(
            string guildId,
            string userId,
            PermissionFlags permissions
        )
        {
            var existingPermissions = await _dbContext.GuildPermissions.FirstOrDefaultAsync(gp =>
                gp.GuildId == guildId && gp.UserId == userId
            );

            if (existingPermissions != null)
            {
                existingPermissions.Permissions = permissions;
                _dbContext.GuildPermissions.Update(existingPermissions);
            }
            else
            {
                var guildPermissions = new GuildPermissions
                {
                    GuildId = guildId,
                    UserId = userId,
                    Permissions = permissions,
                };
                _dbContext.GuildPermissions.Add(guildPermissions);
            }
            await _dbContext.SaveChangesAsync();
        }
    }
}

public enum PermissionType
{
    ReadMessages,
    SendMessages,
    ManageRoles,
    KickMembers,
    BanMembers,
    ManageChannels,
    MentionEveryone,
    AddReaction,
    IsAdmin,
    CanInvite,
}

[Flags]
public enum PermissionFlags
{
    None = 0,
    ReadMessages = 1 << 0,
    SendMessages = 1 << 1,
    MentionEveryone = 1 << 2,
    ManageRoles = 1 << 3,
    KickMembers = 1 << 4,
    BanMembers = 1 << 5,
    ManageChannels = 1 << 6,
    AddReaction = 1 << 7,
    IsAdmin = 1 << 8,
    CanInvite = 1 << 9,
    All =
        ReadMessages
        | SendMessages
        | MentionEveryone
        | ManageRoles
        | KickMembers
        | BanMembers
        | ManageChannels
        | AddReaction
        | IsAdmin
        | CanInvite,
}
