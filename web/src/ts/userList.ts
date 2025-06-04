import { reactive } from "vue";
import {
  getId,
  createEl,
  DEFAULT_DISCRIMINATOR,
  saveBooleanCookie
} from "./utils.ts";
import { isOnMePage } from "./router.ts";
import { updateChatWidth } from "./chat.ts";
import { updateMediaPanelPosition } from "./mediaPanel.ts";
import { friendsCache } from "./friends.ts";
import {
  currentUserNick,
  currentUserId,
  currentDiscriminator,
  UserInfo,
  userManager
} from "./user.ts";
import { handleResize } from "./ui.ts";
import { socketClient } from "./socketEvents.ts";

export let userList: HTMLElement | null;
export let userLine: HTMLElement | null;
export let activityList: HTMLElement | null;

document.addEventListener("DOMContentLoaded", () => {
  userList = getId("user-list") as HTMLElement | null;
  userLine = document.querySelector(".horizontal-line") as HTMLElement | null;
  activityList = getId("activity-list") as HTMLElement | null;
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
  currentUsers.length = 0;
  members.forEach((member) => currentUsers.push(member));

  const userIds = members.map((member) => member.userId);
  setTimeout(() => {
    socketClient.getUserStatus(userIds);
  }, 500);
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
  if (!userLine) return;
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
}
export function updateDmFriendList(friendId: string, friendNick: string) {
  const usersData = [
    {
      userId: currentUserId,
      nickName: currentUserNick,
      isOnline: userManager.isOnline(currentUserId),
      discriminator: currentDiscriminator || DEFAULT_DISCRIMINATOR
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
