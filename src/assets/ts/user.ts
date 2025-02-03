import {
  selfDiscriminator,
  selfName,
  selfStatus,
  updateSelfProfile
} from "./avatar.ts";
import { initialState } from "./app.ts";
import { cacheInterface } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { createEl } from "./utils.ts";
import { offline } from "./friends.ts";
import { translations } from "./translations.ts";

export let currentUserId;

export let currentDiscriminator = null;
export let currentUserNick;
export interface UserInfo {
  userId: string;
  nick: string;
  discriminator: string;
  isBlocked?: boolean;
  isOnline?: boolean;
  description?: string;
}

export const userNames: { [userId: string]: UserInfo } = {};
export const deletedUser = "Deleted User";
// eslint-disable-next-line no-unused-vars
let lastTopSenderId = null;

export function setLastTopSenderId(id) {
  if (!id) return;
  lastTopSenderId = id;
}
userNames["1"] = {
  userId: "1",
  nick: "Clyde",
  discriminator: "0000",
  isBlocked: false,
  isOnline: false,
  description: ""
};
export function setUserNick(newNickname) {
  currentUserNick = newNickname;
}
function setCurrentUserId(id) {
  currentUserId = id;
}
const statusTypes = {
  offline: "offline",
  online: "online",
  "dont-disturb": "dont-disturb",
  idle: "idle"
};

export function setSelfStatus() {
  let status = "";

  status =
    translations.getTranslation(statusTypes[initialState.user.status]) ||
    translations.getTranslation(statusTypes[offline]);
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

export function copySelfName(event: MouseEvent) {
  if (!currentUserNick || !currentDiscriminator) return;

  navigator.clipboard.writeText(`${currentUserNick}#${currentDiscriminator}`);

  const copiedTextBox = createEl("div", {
    textContent: "Copied",
    className: "copied-pop"
  });

  document.body.appendChild(copiedTextBox);

  copiedTextBox.style.left = `${event.clientX}px`;
  copiedTextBox.style.top = `${event.clientY - 30}px`;

  setTimeout(() => copiedTextBox.remove(), 2500);
}

export function getUserNick(userId: string): string {
  if (userId && currentUserId && currentUserId === userId) {
    return currentUserNick;
  }
  return userId in userNames ? userNames[userId].nick : deletedUser;
}
export function getUserDiscriminator(userId: string): string {
  return userId in userNames ? userNames[userId].discriminator : "0000";
}

export function getUserIdFromNick(nick: string): string | null {
  for (const [userId, userInfo] of Object.entries(userNames)) {
    if (userInfo.nick === nick) {
      return userId;
    }
  }
  return null;
}
export function isUserBlocked(userId) {
  if (!userNames.hasOwnProperty(userId)) {
    return false;
  }
  return userNames[userId].isBlocked;
}

export function addUser(
  userId,
  nick?: string,
  discriminator?: string,
  isBlocked?: boolean
) {
  userNames[userId] = {
    nick,
    discriminator,
    isBlocked: Boolean(isBlocked),
    userId
  };
}

export function updateUserOnlineStatus(userId, isOnline) {
  if (userId === currentUserId) return;

  const guildMembers = cacheInterface.getMembers(currentGuildId);

  for (const guildId in guildMembers) {
    const users = guildMembers[guildId];

    const user = users.find((_user) => _user.userId === userId);
    if (user) {
      user.is_online = isOnline;
      console.log(
        `User ${userId} online status updated to ${isOnline} in guild ${guildId}`
      );
      return;
    }
  }

  console.log(`User ${userId} not found in any guild`);
}
