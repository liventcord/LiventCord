import { getId, disableElement, enableElement, createEl } from "./utils.ts";
import { guildCache } from "./cache.ts";
import { isOnGuild, isOnMe } from "./router.ts";
import { saveBooleanCookie } from "./settings.ts";
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
  deletedUser
} from "./user.ts";
import { currentGuildId } from "./guild.ts";
import { handleResize } from "./ui.ts";

export const userLine = document.querySelector(
  ".horizontal-line"
) as HTMLElement;
export const userList = getId("user-list");
export let isUsersOpenGlobal;

export function renderTitle(titleText, container, headingLevel = 1) {
  const titleElement = createEl(`h${headingLevel}`);
  titleElement.innerText = titleText;
  titleElement.style.fontSize = "12px";
  titleElement.style.color = "rgb(148, 155, 153)";
  container.appendChild(titleElement);
}
export function createUserProfile(userId, nickName, isUserOnline) {
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

  const profileImg = createEl("img", { className: "profile-pic" });
  profileImg.width = "30px";
  profileImg.height = "30px";
  profileImg.style.pointerEvents = "none";
  profileImg.dataset.userId = userId;

  const bubble = createBubble(isUserOnline);

  profileContainer.appendChild(profileImg);
  profileContainer.appendChild(userNameDiv);

  return { profileContainer, userNameDiv, profileImg, bubble };
}

export function setUpEventListeners(
  profileImg,
  profileContainer,
  bubble,
  isUserOnline
) {
  profileImg.addEventListener("mouseover", function () {
    this.style.borderRadius = "0px";
    bubble.style.opacity = 0;
  });
  profileImg.addEventListener("mouseout", function () {
    this.style.borderRadius = "25px";
    if (isUserOnline) bubble.style.opacity = 1;
  });

  profileContainer.addEventListener("mouseenter", function () {
    profileContainer.style.backgroundColor = "rgb(53, 55, 60)";
  });
  profileContainer.addEventListener("mouseleave", function () {
    profileContainer.style.backgroundColor = "initial";
  });
}

export function renderUsers(users, tbody, isOnline) {
  const fragment = document.createDocumentFragment();

  for (const userData of users) {
    const isUserOnline = userData.isOnline === true;
    const userId = userData.userId;
    const nickName = userData.nickName;
    if (isUserOnline === isOnline) {
      const { profileContainer, userNameDiv, profileImg, bubble } =
        createUserProfile(userId, nickName, isUserOnline);
      const guild = guildCache.getGuild(currentGuildId);
      if (isOnGuild && currentGuildId && guild.isOwner(userId)) {
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

let isUpdatingUsers = false;

export function updateMemberList(members, ignoreIsOnMe = false) {
  if (isOnMe && !ignoreIsOnMe) {
    console.log("Got users while on me page.");
    return;
  }
  if (isUpdatingUsers) {
    console.warn("Already updating members!");
    return;
  }
  console.log("Updating members with:", members);

  isUpdatingUsers = true;
  const { onlineUsers, offlineUsers } = categorizeMembers(members);

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
    renderTitle(
      `${translations.getTranslation("offline")} — ${offlineUsers.length}`,
      tbody
    );

    renderUsers(offlineUsers, tbody, false);
  }

  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  userList.appendChild(tableWrapper);

  isUpdatingUsers = false;
}
export function categorizeMembers(members) {
  const onlineUsers = members.filter((member) => member.isOnline);
  const offlineUsers = members.filter((member) => !member.isOnline);
  return { onlineUsers, offlineUsers };
}

export function createBubble(isOnline, isProfileBubble?) {
  const classn = isProfileBubble ? "profile-bubble" : "status-bubble";
  const bubble = createEl("span", { className: classn });
  if (isOnline) {
    bubble.style.backgroundColor = "#23a55a";
  } else {
    bubble.style.opacity = 0;
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
    enableElement("user-list");
    userLine.style.display = "flex";
  } else {
    disableElement("user-list");
    userLine.style.display = "none";
  }
}
export function setUsersList(isUsersOpen, isLoadingFromCookie = false) {
  const displayToSet = isUsersOpen ? "flex" : "none";
  const inputRightToSet = isUsersOpen ? "463px" : "76px";

  userList.style.display = displayToSet;

  if (userLine) {
    userLine.style.display = displayToSet;
  }
  const addFriendInputButton = getId("addfriendinputbutton");
  if (addFriendInputButton) {
    addFriendInputButton.style.right = inputRightToSet;
  }
  if (!isLoadingFromCookie) {
    saveBooleanCookie("isUsersOpen", isUsersOpen);
  }
  isUsersOpenGlobal = isUsersOpen;
  updateChatWidth();
  updateMediaPanelPosition();
}
export function updateDmFriendList(friendId, friendNick) {
  const usersData = [
    {
      userId: currentUserId,
      nickName: currentUserNick,
      isOnline: true,
      discriminator: currentDiscriminator
    },
    {
      userId: friendId,
      nickName: friendNick,
      isOnline: friendsCache.isOnline(friendId),
      discriminator: friendsCache.getFriendDiscriminator(friendId)
    }
  ];

  updateMemberList(usersData);
}

export function updateUserListText() {
  const userListTitleHTML = `
    <h1 id="nowonline" style="font-weight: bolder;">${translations.getTranslation(
      "nowonline"
    )}</h1>
    <h1 id="activity-detail" style="font-weight: bolder;">${translations.getTranslation(
      "activity-detail"
    )}</h1>
    <h1 id="activity-detail-2" style="font-weight: bolder;">${translations.getTranslation(
      "activity-detail-2"
    )}</h1>
    <ul></ul>`;

  if (userList) {
    userList.innerHTML = userListTitleHTML;
  }
  handleResize();
}
