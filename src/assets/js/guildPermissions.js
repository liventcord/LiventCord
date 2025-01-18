const Permission = {
    READ_MESSAGES: "read_messages",
    SEND_MESSAGES: "send_messages",
    MANAGE_MESSAGES: "manage_messages",
    MANAGE_ROLES: "manage_roles",
    MANAGE_GUILD: "manage_guild",
    KICK_MEMBERS: "kick_members",
    BAN_MEMBERS: "ban_members",
    MANAGE_CHANNELS: "manage_channels",
    MENTION_EVERYONE: "mention_everyone",
    ADD_REACTION: "add_reaction",
    IS_ADMIN: "is_admin",
    CAN_INVITE: "can_invite"
};
class PermissionManager {
    constructor(permissionsMap) {
        this.permissionsMap = permissionsMap;
    }

    getPermission(permType) {
        return this.permissionsMap[currentGuildId]?.[permType] || 0;
    }
    canInvite() {
        return Boolean(this.getPermission(Permission.CAN_INVITE));
    }
    isSelfOwner() {
        return Boolean(this.getPermission(Permission.IS_ADMIN));
    }

    canManageMessages() {
        return this.getPermission(Permission.MANAGE_MESSAGES);
    }
    canManageGuild() {
        return this.getPermission(Permission.MANAGE_GUILD);
    }

    canInvite() {
        return Boolean(this.getPermission(Permission.CAN_INVITE));
    }

    canManageChannels() {
        return Boolean(this.getPermission(Permission.MANAGE_CHANNELS));
    }
    

    addGuildSelfCreated(guildId) {
        this.permissionsMap[guildId] = {
            "read_messages": 1,
            "send_messages": 1,
            "manage_messages": 1,
            "manage_roles": 1,
            "manage_guild": 1,
            "kick_members": 1,
            "ban_members": 1,
            "manage_channels": 1,
            "mention_everyone": 1,
            "add_reaction": 1,
            "is_admin": 1,
            "can_invite": 1
        }
    }
}


let permissionManager;