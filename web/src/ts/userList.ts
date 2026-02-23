import { reactive } from "vue";

import { getId, createEl, saveBooleanCookie, $, onDoc } from "./utils.ts";
import { isOnGuild, isOnMePage } from "./router.ts";
import { fetchCurrentAttachments, updateChatWidth } from "./chat.ts";
import { updateMediaPanelPosition } from "./mediaPanel.ts";
import { friendsCache } from "./friends.ts";
import { userManager, DEFAULT_DISCRIMINATOR } from "./user.ts";
import { handleResize, handleResizeWidth } from "./ui.ts";
import { socketClient } from "./socketEvents.ts";
import { PublicUser, UserInfo } from "./types/interfaces.ts";
import { appState } from "./appState.ts";

export let userList: HTMLElement | null;
export let userLine: HTMLElement | null;
export let activityList: HTMLElement | null;

onDoc("DOMContentLoaded", () => {
  userList = getId("user-list");
  userLine = $(".horizontal-line");
  activityList = getId("activity-list");
});

export let isUsersOpenGlobal: boolean;

export const currentUsers = reactive<UserInfo[]>([]);

export async function updateMemberList(
  members: UserInfo[],
  ignoreisOnMePage = false
) {
  if (isOnMePage && !ignoreisOnMePage) {
    console.log("Got users while on me page.");
    return;
  }

  const seen = new Set<string>();
  currentUsers.length = 0;
  members.forEach((member) => {
    if (!seen.has(member.userId)) {
      currentUsers.push(member);
      seen.add(member.userId);
    }
  });

  const uniqueUserIds = Array.from(seen);
  socketClient.getUserStatus(uniqueUserIds);
}

export async function addUserToMemberList(user: PublicUser) {
  if (!user.userId || !user.nickName || !user.discriminator) return;

  const exists = currentUsers.some((u) => u.userId === user.userId);
  if (!exists) {
    const newUser: UserInfo = {
      userId: user.userId,
      nickName: user.nickName,
      discriminator: user.discriminator,
      description: user.description,
      createdAt: user.createdAt?.toISOString(),
      socialMediaLinks: Array.isArray(user.socialMediaLinks)
        ? user.socialMediaLinks
        : undefined
    };
    currentUsers.push(newUser);
    socketClient.getUserStatus([user.userId]);
  }
}

export async function removeUserFromMemberList(userId: string) {
  const index = currentUsers.findIndex((user) => user.userId === userId);
  if (index !== -1) currentUsers.splice(index, 1);
}

export function toggleUsersList() {
  if (!userList) {
    return;
  }
  const isUsersOpen = userList.style.display === "flex";
  setUsersList(!isUsersOpen);
}

export function createBubble(
  status: string,
  isProfileBubble?: boolean,
  isMemberBubble?: boolean
) {
  const classn = isProfileBubble ? "profile-bubble" : "status-bubble";
  const bubble = createEl("span", { className: classn });
  bubble.classList.add(status);
  if (isMemberBubble && status === "offline") {
    bubble.style.opacity = "0";
  }

  return bubble;
}

export function enableUserList() {
  setUsersList(true);
}

export function setUserListLine() {
  if (!userLine) {
    return;
  }
  if (isUsersOpenGlobal) {
    userLine.style.display = "flex";
  } else {
    userLine.style.display = "none";
  }
}
export function setUsersList(
  isUsersOpen: boolean,
  isLoadingFromCookie = false
) {
  const inputRightToSet = isUsersOpen ? "463px" : "76px";

  const addFriendInputButton = getId("addfriendinputbutton");
  if (addFriendInputButton) {
    addFriendInputButton.style.right = inputRightToSet;
  }
  if (userList) {
    userList.style.display = isUsersOpen ? "flex" : "none";
  }
  if (!isLoadingFromCookie) {
    saveBooleanCookie("isUsersOpen", isUsersOpen ? 1 : 0);
  }
  isUsersOpenGlobal = isUsersOpen;
  updateChatWidth();
  updateMediaPanelPosition();
  handleResize();
  handleResizeWidth();
  if (isOnGuild) {
    fetchCurrentAttachments();
  } else {
    // TODO: Implement dm attachments display support
  }
}
export function updateDmFriendList(friendId: string, friendNick: string) {
  if (!appState.currentUserId) return;
  const usersData = [
    {
      userId: appState.currentUserId,
      nickName: appState.currentUserNick,
      isOnline: userManager.isOnline(appState.currentUserId),
      discriminator: appState.currentDiscriminator || DEFAULT_DISCRIMINATOR
    },
    {
      userId: friendId,
      nickName: friendNick,
      isOnline: userManager.isOnline(friendId),
      discriminator:
        friendsCache.getFriendDiscriminator(friendId) || DEFAULT_DISCRIMINATOR
    }
  ];

  updateMemberList(usersData);
}
