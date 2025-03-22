import {
  getId,
  createEl,
  DEFAULT_DISCRIMINATOR,
  saveBooleanCookie
} from "./utils.ts";
import { guildCache } from "./cache.ts";
import { isOnGuild, isOnMe } from "./router.ts";
import { crownEmojibase64 } from "./extras.ts";
import { updateChatWidth } from "./chat.ts";
import { updateMediaPanelPosition } from "./mediaPanel.ts";
import { friendsCache } from "./friends.ts";
import { setProfilePic } from "./avatar.ts";
import { appendToProfileContextList } from "./contextMenuActions.ts";
import { translations } from "./translations.ts";
import {
  currentUserNick,
  currentUserId,
  currentDiscriminator,
  deletedUser,
  UserInfo,
  userManager
} from "./user.ts";
import { currentGuildId } from "./guild.ts";

export const userLine = document.querySelector(
  ".horizontal-line"
) as HTMLElement;
export const userList = getId("user-list") as HTMLElement;
export const activityList = getId("activity-list") as HTMLElement;

export let isUsersOpenGlobal: boolean;

function renderTitle(
  titleText: string,
  container: HTMLElement,
  headingLevel = 1
) {
  const titleElement = createEl(
    `h${headingLevel}` as keyof HTMLElementTagNameMap
  );
  titleElement.innerText = titleText;
  titleElement.style.fontSize = "12px";
  titleElement.style.color = "rgb(148, 155, 153)";
  container.appendChild(titleElement);
}

function createUserProfile(
  userId: string,
  nickName: string,
  isUserOnline: boolean,
  status: string
) {
  const profileContainer = createEl("div", {
    className: "profile-container",
    id: userId
  });
  if (isUserOnline) {
    profileContainer.classList.add("activeprofile");
  }

  const userNameDiv = createEl("span", {
    textContent: nickName ?? deletedUser,
    className: "profileName"
  });
  userNameDiv.style.color = "white";

  const profileImg = createEl("img", {
    className: "profile-pic"
  }) as HTMLImageElement;
  profileImg.width = 30;
  profileImg.height = 30;
  profileImg.style.pointerEvents = "none";
  profileImg.dataset.userId = userId;

  const bubble = createBubble(status, true, true);

  profileContainer.appendChild(profileImg);
  profileContainer.appendChild(userNameDiv);

  return { profileContainer, userNameDiv, profileImg, bubble };
}

function setUpEventListeners(
  profileImg: HTMLElement,
  profileContainer: HTMLElement,
  bubble: HTMLElement,
  isUserOnline: boolean
) {
  profileImg.addEventListener("mouseover", function () {
    this.style.borderRadius = "0px";
    bubble.style.opacity = "0";
  });
  profileImg.addEventListener("mouseout", function () {
    this.style.borderRadius = "25px";
    if (isUserOnline) bubble.style.opacity = "1";
  });

  profileContainer.addEventListener("mouseenter", function () {
    profileContainer.style.backgroundColor = "rgb(53, 55, 60)";
  });
  profileContainer.addEventListener("mouseleave", function () {
    profileContainer.style.backgroundColor = "initial";
  });
}

async function renderUsers(
  users: UserInfo[],
  tbody: HTMLElement,
  isOnline: boolean
) {
  const fragment = document.createDocumentFragment();

  for (const userData of users) {
    const userId = userData.userId;
    const isUserOnline = await userManager.isOnline(userId);
    const status = await userManager.getStatusString(userId);
    const nickName = userData.nickName;
    if (isUserOnline === isOnline) {
      const { profileContainer, userNameDiv, profileImg, bubble } =
        createUserProfile(userId, nickName, isUserOnline, status);
      const guild = guildCache.getGuild(currentGuildId);
      if (isOnGuild && currentGuildId && guild && guild.isOwner(userId)) {
        const crownEmoji = createEl("img", {
          src: crownEmojibase64,
          id: "crown-symbol"
        });
        userNameDiv.appendChild(crownEmoji);
      }

      setUpEventListeners(profileImg, profileContainer, bubble, isUserOnline);

      appendToProfileContextList(userData, userId);
      setProfilePic(profileImg, userId);

      profileContainer.appendChild(bubble);
      fragment.appendChild(profileContainer);
    } else {
    }
  }

  tbody.appendChild(fragment);
}

export async function updateMemberList(
  members: UserInfo[],
  ignoreIsOnMe = false
) {
  if (isOnMe && !ignoreIsOnMe) {
    console.log("Got users while on me page.");
    return;
  }

  const { onlineUsers, offlineUsers } = await categorizeMembers(members);

  userList.innerHTML = "";
  const tableWrapper = createEl("div", { className: "user-table-wrapper" });
  const table = createEl("table", { className: "user-table" });
  const tbody = createEl("tbody");

  if (onlineUsers.length > 0) {
    renderTitle(
      `${translations.getTranslation("online")} — ${onlineUsers.length}`,
      tbody
    );
    renderUsers(onlineUsers, tbody, true);
  }

  if (offlineUsers.length > 0) {
    setTimeout(() => {
      renderTitle(
        `${translations.getTranslation("offline")} — ${offlineUsers.length}`,
        tbody
      );
      renderUsers(offlineUsers, tbody, false);
    }, 0);
  }

  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  userList.appendChild(tableWrapper);

  console.log("Updating members with:", members);
}

async function categorizeMembers(members: UserInfo[]) {
  const onlineUsers: UserInfo[] = [];
  const offlineUsers: UserInfo[] = [];

  const statusPromises = members.map(async (member) => {
    const isOnline = await userManager.isNotOffline(member.userId);
    return { member, isOnline };
  });

  const statuses = await Promise.all(statusPromises);

  statuses.forEach(({ member, isOnline }) => {
    if (isOnline) {
      onlineUsers.push(member);
    } else {
      offlineUsers.push(member);
    }
  });

  return { onlineUsers, offlineUsers };
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

export function toggleUsersList() {
  const isUsersOpen = userList.style.display === "flex";
  setUsersList(!isUsersOpen);
}
export function enableUserList() {
  setUsersList(true);
}

export function setUserListLine() {
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
  if (!isLoadingFromCookie) {
    saveBooleanCookie("isUsersOpen", isUsersOpen ? 1 : 0);
  }
  isUsersOpenGlobal = isUsersOpen;
  updateChatWidth();
  updateMediaPanelPosition();
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

export function updateStatusInMembersList(userId: string, status: string) {
  const profilesList = userList.querySelectorAll(".profile-pic");
  profilesList.forEach((user) => {
    const parentNode = user.parentNode as HTMLElement;
    const userIdDom = parentNode && parentNode.id;

    if (userIdDom === userId) {
      const selfBubble = parentNode.querySelector(
        ".profile-bubble"
      ) as HTMLElement;
      if (selfBubble) {
        if (status === "offline") {
          selfBubble.style.opacity = "0";
          return;
        }
        selfBubble.style.opacity = "1";
        selfBubble.classList.value = "";
        selfBubble.className = "profile-bubble";
        selfBubble.classList.add(status);
      }
    }
  });
}
