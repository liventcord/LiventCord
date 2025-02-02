import { currentGuildId } from "./guild";

const Permission = {
  READ_MESSAGES: "READ_MESSAGES",
  SEND_MESSAGES: "SEND_MESSAGES",
  MANAGE_MESSAGES: "MANAGE_MESSAGES",
  MANAGE_ROLES: "MANAGE_ROLES",
  MANAGE_GUILD: "MANAGE_GUILD",
  KICK_MEMBERS: "KICK_MEMBERS",
  BAN_MEMBERS: "BAN_MEMBERS",
  MANAGE_CHANNELS: "MANAGE_CHANNELS",
  MENTION_EVERYONE: "MENTION_EVERYONE",
  ADD_REACTION: "ADD_REACTION",
  IS_ADMIN: "IS_ADMIN",
  CAN_INVITE: "CAN_INVITE",
};

export class PermissionManager {
  constructor(permissionsMap = {}) {
    this.permissionsMap = permissionsMap;
  }

  updatePermissions(guildId, newPermissions) {
    console.log(
      "Updating permissions for guild: ",
      currentGuildId,
      " with data: ",
      newPermissions,
    );
    if (!guildId || typeof newPermissions !== "object") return;
    this.permissionsMap[guildId] = {
      ...newPermissions[guildId],
    };
    console.log(
      "Current permissions for guild: ",
      guildId,
      " : ",
      this.permissionsMap[guildId],
    );
  }

  getPermission(permType) {
    if (!currentGuildId || !permType) return 0;
    const perm = this.permissionsMap[currentGuildId];
    return perm;
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

  canManageChannels() {
    return Boolean(this.getPermission(Permission.MANAGE_CHANNELS));
  }
}

export const permissionManager = new PermissionManager();
