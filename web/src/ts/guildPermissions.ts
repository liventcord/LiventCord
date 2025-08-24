/* eslint-disable no-unused-vars */
import { createGuildContextLists, currentGuildId } from "./guild.ts";

export enum Permission {
  READ_MESSAGES,
  SEND_MESSAGES,
  MENTION_EVERYONE,
  MANAGE_ROLES,
  KICK_MEMBERS,
  BAN_MEMBERS,
  MANAGE_CHANNELS,
  ADD_REACTION,
  IS_ADMIN,
  CAN_INVITE,
  MANAGE_MESSAGES,
  MANAGE_GUILD,
  ALL
}

export interface PermissionsRecord {
  [guildId: string]: Record<string, number>;
}

class PermissionManager {
  permissionsMap: Map<string, Set<Permission>>;

  constructor(permissionsMap: Map<string, Set<Permission>> = new Map()) {
    this.permissionsMap = permissionsMap;
  }
  initialiseGuild(guildId: string) {
    const permissionsMap = this.permissionsMap;

    if (!permissionsMap.has(guildId)) {
      permissionsMap.set(guildId, new Set<Permission>());
    }
  }

  updatePermissions(guildId: string, newPermissions: PermissionsRecord) {
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

      if (rawPermissions["All"] === 1) {
        Object.values(Permission)
          .filter((perm) => typeof perm === "number")
          .forEach((perm) => permissionSet.add(perm));
      } else {
        for (const [key, value] of Object.entries(rawPermissions)) {
          if (value === 1) {
            const normalizedKey = key
              .replace(/([a-z])([A-Z])/g, "$1_$2")
              .toUpperCase();

            if (
              Permission[normalizedKey as keyof typeof Permission] !== undefined
            ) {
              permissionSet.add(
                Permission[normalizedKey as keyof typeof Permission]
              );
            } else {
              console.log(`Skipping invalid permission: ${key}`);
            }
          }
        }
      }

      this.permissionsMap.set(guildId, permissionSet);
      console.log("Updated permissionsMap:", this.permissionsMap);
      createGuildContextLists();
    }
  }

  getPermission(permType: Permission) {
    if (!currentGuildId || !permType) {
      return false;
    }

    const permissions = this.permissionsMap.get(currentGuildId);

    if (permissions && permissions.has(Permission.ALL)) {
      return true;
    }

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
  canKickMember() {
    return this.getPermission(Permission.KICK_MEMBERS);
  }

  canManageChannels() {
    return this.getPermission(Permission.MANAGE_CHANNELS);
  }
}

export const permissionManager = new PermissionManager();

export function updatePermissions(
  guildId: string,
  permissionsObject: PermissionsRecord | undefined
) {
  if (permissionsObject) {
    permissionManager.updatePermissions(guildId, permissionsObject);
  } else {
    console.error("Permissions not found for the given guildId:", guildId);
  }
}
