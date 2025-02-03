/* eslint-disable no-unused-vars */
import { currentGuildId } from "./guild.ts";

export enum Permission {
  READ_MESSAGES = "READ_MESSAGES",
  SEND_MESSAGES = "SEND_MESSAGES",
  MENTION_EVERYONE = "MENTION_EVERYONE",
  MANAGE_ROLES = "MANAGE_ROLES",
  KICK_MEMBERS = "KICK_MEMBERS",
  BAN_MEMBERS = "BAN_MEMBERS",
  MANAGE_CHANNELS = "MANAGE_CHANNELS",
  ADD_REACTION = "ADD_REACTION",
  IS_ADMIN = "IS_ADMIN",
  CAN_INVITE = "CAN_INVITE",
  MANAGE_MESSAGES = "MANAGE_MESSAGES",
  MANAGE_GUILD = "MANAGE_GUILD"
}

export class PermissionManager {
  permissionsMap: Map<string, Set<Permission>>;

  constructor(permissionsMap: Map<string, Set<Permission>> = new Map()) {
    this.permissionsMap = permissionsMap;
  }

  updatePermissions(guildId: string, newPermissions: Record<string, any>) {
    console.log("updatePermissions called with:", { guildId, newPermissions });

    if (!guildId || typeof newPermissions !== "object") {
      console.log(
        "Invalid input: Missing guildId or newPermissions is not an object"
      );
      return;
    }

    const rawPermissions = newPermissions[guildId];
    console.log("Raw permissions:", rawPermissions);

    if (rawPermissions) {
      const permissionSet = new Set<Permission>();
      for (const [key, value] of Object.entries(rawPermissions)) {
        if (value === 1) {
          const normalizedKey = key
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .toUpperCase() as Permission;

          if (Permission[normalizedKey]) {
            permissionSet.add(normalizedKey);
          } else {
            console.log(`Skipping invalid permission: ${key}`);
          }
        }
      }

      this.permissionsMap.set(guildId, permissionSet);
      console.log("Updated permissionsMap:", this.permissionsMap);
    }
  }

  getPermission(permType: Permission) {
    if (!currentGuildId || !permType) {
      console.log("Invalid input: Missing currentGuildId or permType");
      return false;
    }

    const permissions = this.permissionsMap.get(currentGuildId);
    const result = permissions ? permissions.has(permType) : false;

    return result;
  }

  canInvite() {
    return this.getPermission(Permission.CAN_INVITE);
  }

  isSelfOwner() {
    return this.getPermission(Permission.IS_ADMIN);
  }

  canManageMessages() {
    return this.getPermission(Permission.MANAGE_MESSAGES);
  }

  canManageGuild() {
    return this.getPermission(Permission.MANAGE_GUILD);
  }

  canManageChannels() {
    return this.getPermission(Permission.MANAGE_CHANNELS);
  }
}

export const permissionManager = new PermissionManager();
