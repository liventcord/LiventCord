import { selfDiscriminator, selfName, selfStatus, updateSelfProfile } from './avatar';
import { initialState } from './app';
import { cacheInterface } from './cache';
import { currentGuildId } from './guild';
import { createEl } from './utils';


export let currentUserId;

export let currentDiscriminator = null;
export let currentUserNick;
export let userNames = {};
export const deletedUser = 'Deleted User';
// eslint-disable-next-line no-unused-vars
let lastTopSenderId = null;

export function setLastTopSenderId(id) {
  if(!id) return;
  lastTopSenderId = id;
} 
userNames['1'] = {
  nick: 'Clyde',
  discriminator: '0000',
  is_blocked: false,
};

export function setUserNick(newNickname) {
  currentUserNick = newNickname;
}
function setCurrentUserId(id) {
  currentUserId = id;
}

export function initializeProfile() {
  setCurrentUserId(initialState.user.id);
  currentUserNick = initialState.user.nickname;
  currentDiscriminator = initialState.user.discriminator;
  selfName.textContent = currentUserNick;
  selfDiscriminator.textContent =
    '#' + initialState.user.discriminator;
  selfStatus.textContent = initialState.user.status;
  updateSelfProfile(currentUserId);
}

export function getSelfFullDisplay() {
  return initialState.user.nickname + '#' + initialState.user.discriminator;
}

export function copySelfName() {
  if (!currentUserNick | !currentDiscriminator) return;
  navigator.clipboard.writeText(`${currentUserNick}#${currentDiscriminator}`);
  const copiedTextBox = createEl("div", {
    textContent: 'Copied',
    className : "copied-pop",
  })
  document.body.appendChild(copiedTextBox);
  copiedTextBox.style.left = `${event.clientX}px`;
  copiedTextBox.style.top = `${event.clientY - 30}px`;
  setTimeout(() => copiedTextBox.remove(), 2500);
}

export function getUserNick(userId) {
  if (userId && currentUserId && currentUserId === userId) {
    return currentUserNick;
  }
  return userId in userNames ? userNames[userId].nick : deletedUser;
}
export function getUserDiscriminator(userId) {
  return userId in userNames ? userNames[userId].discriminator : '0000';
}


export function getUserIdFromNick(nick) {
  for (const [userId, userInfo] of Object.entries(userNames)) {
    if (userInfo.nick === nick) {
      return userId;
    }
  }
  return null;
}

export function isBlocked(userId) {
  if (!userNames.hasOwnProperty(userId)) {
    return false;
  }
  return userNames[userId].is_blocked;
}

export function addUser(userId, nick, discriminator, isBlocked) {
  userNames[userId] = {
    nick: nick,
    discriminator: discriminator,
    is_blocked: Boolean(isBlocked),
  };
}

export function updateUserOnlineStatus(userId, isOnline) {
  if (userId === currentUserId) return;

  const guildMembers = cacheInterface.getMembers(currentGuildId);

  for (const guildId in guildMembers) {
    const users = guildMembers[guildId];

    const user = users.find((user) => user.userId === userId);
    if (user) {
      user.is_online = isOnline;
      console.log(
        `User ${userId} online status updated to ${isOnline} in guild ${guildId}`,
      );
      return;
    }
  }

  console.log(`User ${userId} not found in any guild`);
}
