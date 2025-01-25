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
  CAN_INVITE: "can_invite",
};

export class PermissionManager {
  constructor(permissionsMap = {}) {
    // Default to empty object if no argument is passed
    this.permissionsMap = permissionsMap;
  }

  updatePermissions(guildId, newPermissions) {
    this.permissionsMap[guildId] = {
      ...this.permissionsMap[guildId],
      ...newPermissions,
    };
  }

  getPermission(guildId, permType) {
    return this.permissionsMap[guildId]?.[permType] || 0;
  }

  canInvite(guildId) {
    return Boolean(this.getPermission(guildId, Permission.CAN_INVITE));
  }

  isSelfOwner(guildId) {
    return Boolean(this.getPermission(guildId, Permission.IS_ADMIN));
  }

  canManageMessages(guildId) {
    return this.getPermission(guildId, Permission.MANAGE_MESSAGES);
  }

  canManageGuild(guildId) {
    return this.getPermission(guildId, Permission.MANAGE_GUILD);
  }

  canManageChannels(guildId) {
    return Boolean(this.getPermission(guildId, Permission.MANAGE_CHANNELS));
  }

  addGuildSelfCreated(guildId) {
    this.permissionsMap[guildId] = {
      read_messages: 1,
      send_messages: 1,
      manage_messages: 1,
      manage_roles: 1,
      manage_guild: 1,
      kick_members: 1,
      ban_members: 1,
      manage_channels: 1,
      mention_everyone: 1,
      add_reaction: 1,
      is_admin: 1,
      can_invite: 1,
    };
  }
}

export let permissionManager = new PermissionManager();
