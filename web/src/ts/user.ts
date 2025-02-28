import {
  selfDiscriminator,
  selfName,
  selfStatus,
  updateSelfProfile
} from "./avatar.ts";
import { initialState } from "./app.ts";
import { cacheInterface } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { translations } from "./translations.ts";

export interface Member {
  userId: string;
  nickName: string;
}

export let currentUserId: string;

export let currentDiscriminator: string;
export let currentUserNick: string;
export interface UserInfo {
  userId: string;
  nickName: string;
  discriminator: string;
  status?: string;
  activity?: string;
  isOnline?: boolean;
  description?: string;
  isFriendsRequestToUser?: boolean;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isBlocked?: boolean;
}

export const userNames: { [userId: string]: UserInfo } = {};
export const deletedUser = "Deleted User";
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
let lastTopSenderId = null;

export function setLastTopSenderId(id: string) {
  if (!id) return;
  lastTopSenderId = id;
}
userNames["1"] = {
  userId: "1",
  nickName: "Clyde",
  discriminator: "0000",
  isBlocked: false,
  isOnline: false,
  description: ""
};
export function setUserNick(newNickname: string) {
  currentUserNick = newNickname;
}
function setCurrentUserId(id: string) {
  currentUserId = id;
}
export const statusTypes = {
  offline: "offline",
  online: "online",
  "dont-disturb": "dont-disturb",
  idle: "idle"
};

export function setSelfStatus() {
  const status =
    translations.getTranslation(
      statusTypes[initialState.user.status as keyof typeof statusTypes]
    ) ??
    translations.getTranslation(statusTypes.offline) ??
    "Unknown";

  selfStatus.textContent = status;
}

export function initializeProfile() {
  setCurrentUserId(initialState.user.id);
  currentUserNick = initialState.user.nickname;
  currentDiscriminator = initialState.user.discriminator;
  selfName.textContent = currentUserNick;
  selfDiscriminator.textContent = "#" + initialState.user.discriminator;
  setSelfStatus();
  updateSelfProfile(currentUserId, currentUserNick);
}

export function getSelfFullDisplay() {
  return initialState.user.nickname + "#" + initialState.user.discriminator;
}

export function getUserNick(userId: string): string {
  if (userId && currentUserId && currentUserId === userId) {
    return currentUserNick;
  }
  return userNames[userId]?.nickName ?? deletedUser;
}

export function getUserDiscriminator(userId: string): string {
  return userNames[userId]?.discriminator ?? "0000";
}

export function getUserIdFromNick(nick: string): string | null {
  for (const [userId, userInfo] of Object.entries(userNames)) {
    if (userInfo.nickName === nick) {
      return userId;
    }
  }
  return null;
}
export function isUserBlocked(userId: string): boolean {
  return userNames[userId]?.isBlocked ?? false;
}

export function addUser(
  userId: string,
  nick: string = "",
  discriminator: string = "",
  isBlocked?: boolean
) {
  userNames[userId] = {
    nickName: nick,
    discriminator,
    isBlocked: Boolean(isBlocked),
    userId
  };
}

export function updateUserOnlineStatus(userId: string, isOnline: boolean) {
  if (userId === currentUserId) return;

  const guildMembers = cacheInterface.getMembers(currentGuildId);

  for (const guildId in guildMembers) {
    const user = guildMembers[guildId];

    if (user && user.userId === userId) {
      console.log(
        `User ${userId} online status updated to ${isOnline} in guild ${guildId}`
      );
      return;
    }
  }

  console.log(`User ${userId} not found in any guild`);
}
