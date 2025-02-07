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
        private Dictionary<string, int> GetPermissionsDictionary(PermissionFlags permissions)
        {
            var permissionsDict = new Dictionary<string, int>();

            foreach (PermissionFlags permissionFlag in Enum.GetValues(typeof(PermissionFlags)))
            {
                if (permissionFlag != PermissionFlags.None)
                {
                    permissionsDict[permissionFlag.ToString()] =
                        (permissions & permissionFlag) != 0 ? 1 : 0;
                }
            }

            return permissionsDict;
        }

        [NonAction]
        public async Task<Dictionary<string, Dictionary<string, int>>> GetPermissionsMapForUser(
            string userId
        )
        {
            var permissionsMap = new Dictionary<string, Dictionary<string, int>>();

            var userPermissions = await _dbContext
                .GuildPermissions.Where(gp => gp.UserId == userId)
                .Include(gp => gp.Guild)
                .ToListAsync();

            foreach (var perm in userPermissions)
            {
                permissionsMap[perm.GuildId] = GetPermissionsDictionary(perm.Permissions);
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
    ManageGuild = 1 << 11,
    ManageMessages = 1 << 12,
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
        | CanInvite
        | ManageGuild
        | ManageMessages
}
