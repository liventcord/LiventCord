/* eslint-disable no-unused-vars */
import { createGuildContextLists, currentGuildId } from "./guild.ts";
import { PermissionsRecord } from "./types/interfaces.ts";

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

  updatePermissions(guildId: string, newPermissions: Record<string, number>) {
    if (!guildId || typeof newPermissions !== "object") {
      console.log(
        "Invalid input: Missing guildId or newPermissions is not an object"
      );
      return;
    }

    const permissionSet = new Set<Permission>();

    if (newPermissions["All"] === 1) {
      Object.values(Permission)
        .filter((perm) => typeof perm === "number")
        .forEach((perm) => permissionSet.add(perm as Permission));
    } else {
      for (const [key, value] of Object.entries(newPermissions)) {
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
    createGuildContextLists();
  }

  getPermission(permType: Permission, guildId?: string) {
    if (!guildId) guildId = currentGuildId;

    if (!guildId || !permType) {
      return false;
    }

    const permissions = this.permissionsMap.get(guildId);

    if (!permissions) {
      return false;
    }

    if (permissions.has(Permission.ALL)) {
      return true;
    }

    const result = permissions.has(permType);
    return result;
  }

  canInvite(guildId?: string) {
    return this.getPermission(Permission.CAN_INVITE, guildId);
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

  canManageChannels(guildId?: string) {
    return this.getPermission(Permission.MANAGE_CHANNELS, guildId);
  }
}

export const permissionManager = new PermissionManager();

export function updatePermissions(
  guildId: string,
  permissionsObject: PermissionsRecord | undefined
) {
  if (permissionsObject) {
    const inner = (permissionsObject as any)[guildId] ?? permissionsObject;
    permissionManager.updatePermissions(
      guildId,
      inner as Record<string, number>
    );
  } else {
    console.error("Permissions not found for the given guildId:", guildId);
  }
}
