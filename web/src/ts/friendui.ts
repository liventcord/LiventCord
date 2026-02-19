import { reactive } from "vue";
import { appState } from "./appState";
import {
  createEl,
  getId,
  disableElementHTML,
  disableElement,
  IMAGE_SRCS
} from "./utils";
import { DEFAULT_DISCRIMINATOR, deletedUser, userManager } from "./user";
import { friendsCache, UpdatePendingCounter, removeDm } from "./friends";
import { setProfilePic } from "./avatar";
import { translations } from "./translations";
import { activityList } from "./userList";
import { loadDmHome, openDm } from "./app";
import { isBlackTheme } from "./settings";
import store from "../store";
import { Friend, UserInfo } from "./types/interfaces";
import { friendsState } from "../components/FriendsContainer.vue";

const addfriendhighlightedcolor = () =>
  isBlackTheme() ? "#5865F2" : "#248046";
const highlightedColor = () => (isBlackTheme() ? "#333338" : "#43444b");
const defaultColor = "transparent";
const grayColor = "#c2c2c2";

const buttonElements = {
  online: getId("online-button") as HTMLElement,
  all: getId("all-button") as HTMLElement,
  pending: getId("pending-button") as HTMLElement,
  blocked: getId("blocked-button") as HTMLElement
};

let ButtonsList = Object.values(buttonElements);

disableElementHTML(buttonElements.blocked);

export const friendContainerItem = getId(
  "friend-container-item"
) as HTMLElement;

export function unselectFriendContainer() {
  friendContainerItem.classList.remove("dm-selected");
}

export const friendsContainer = getId("friends-container") as HTMLElement;

export let isAddFriendsOpen = false;

export let currentSelectedFriendMenu: keyof typeof buttonElements = "online";

export interface DmUserInfo {
  userId: string;
  status: string;
  nickName: string;
  activity: string;
  discriminator: string;
  profileVersion: string;
  isPending: boolean;
  isFriendsRequestToUser: boolean;
}

interface DmListState {
  friends: DmUserInfo[];
  currentDmId: string;
}

export const dmListState = reactive<DmListState>({
  friends: [],
  currentDmId: friendsCache.currentDmId ?? ""
});

export function syncCurrentDmId(id: string) {
  dmListState.currentDmId = id;
}

export function openDmHandler(userId: string) {
  openDm(userId);
  syncCurrentDmId(userId);
}

export function removeDmHandler(userId: string) {
  removeDm(userId);
  removeFromDmList(userId);
}

interface DmUserAddResponse {
  userId: string;
  nickName: string;
  discriminator: string;
}

export function appendToDmList(user: DmUserAddResponse, prepend = false) {
  if (dmListState.friends.some((f) => f.userId === user.userId)) {
    if (prepend) {
      const idx = dmListState.friends.findIndex(
        (f) => f.userId === user.userId
      );
      const [existing] = dmListState.friends.splice(idx, 1);
      dmListState.friends.unshift(existing);
    }
    return;
  }

  const entry: DmUserInfo = {
    userId: user.userId,
    nickName: user.nickName,
    discriminator: user.discriminator,
    status: store.getters.getUserStatus(user.userId) || "offline",
    activity: "",
    profileVersion: "",
    isPending: false,
    isFriendsRequestToUser: false
  };

  if (prepend) {
    dmListState.friends.unshift(entry);
  } else {
    dmListState.friends.push(entry);
  }

  return true;
}

export function updateDmsList(friends: DmUserInfo[]) {
  if (!Array.isArray(friends)) {
    console.error(
      "[dmListState] updateDmsList: expected array, got",
      typeof friends
    );
    return;
  }

  dmListState.friends.splice(0, dmListState.friends.length);

  const friendsRecord: { [key: string]: Friend } = friends.reduce(
    (record, friend) => {
      userManager.addUser(
        friend.userId,
        friend.nickName,
        friend.discriminator,
        friend.profileVersion
      );

      dmListState.friends.push({
        ...friend,
        status: store.getters.getUserStatus(friend.userId) || "offline"
      });

      record[friend.userId] = new Friend(friend);
      return record;
    },
    {} as { [key: string]: Friend }
  );

  friendsCache.setupDmFriends(friendsRecord);
}

export async function addToDmList(userData: DmUserInfo): Promise<void> {
  appendToDmList(
    {
      userId: userData.userId,
      nickName: userData.nickName,
      discriminator: userData.discriminator
    },
    true
  );
}

export async function removeFromDmList(userId: string): Promise<void> {
  const idx = dmListState.friends.findIndex((f) => f.userId === userId);
  if (idx !== -1) {
    dmListState.friends.splice(idx, 1);
    friendsCache.removeDmFriend(userId);
    if (userId === friendsCache.currentDmId) {
      dmListState.currentDmId = "";
      loadDmHome();
    }
  } else {
    console.warn("[dmListState] removeFromDmList: userId not found:", userId);
  }
}

export function activateDmContainer(friendId: string) {
  dmListState.currentDmId = friendId;
}

export function disableDmContainers() {
  dmListState.currentDmId = "";
}

export function getCurrentDmFriends(): UserInfo[] {
  return [
    {
      userId: appState.currentUserId || "",
      nickName: appState.currentUserNick,
      discriminator: appState.currentDiscriminator
    },
    {
      userId: friendsCache.currentDmId,
      nickName:
        friendsCache.getFriend(friendsCache.currentDmId)?.nickName ||
        deletedUser,
      discriminator:
        friendsCache.getFriendDiscriminator(friendsCache.currentDmId) ||
        DEFAULT_DISCRIMINATOR
    }
  ];
}

// ── Friends-menu button logic

export function updateFriendMenu() {
  const currentEl = buttonElements[currentSelectedFriendMenu];
  if (currentEl) selectFriendMenu(currentEl);
}

function selectFriendMenu(clickedButton: HTMLElement) {
  const openFriendsBtn = getId("open-friends-button") as HTMLElement;
  if (openFriendsBtn) {
    openFriendsBtn.style.backgroundColor = addfriendhighlightedcolor();
    openFriendsBtn.style.color = "white";
  }

  isAddFriendsOpen = false;
  friendsState.isAddFriendsOpen.value = false;

  currentSelectedFriendMenu = getRequestType(clickedButton);
  friendsState.currentSelectedFriendMenu.value = currentSelectedFriendMenu;

  const friends = friendsCache.cacheFriendToFriendConverter();
  populateFriendsContainer(friends, clickedButton === buttonElements.pending);

  if (!ButtonsList) ButtonsList = Object.values(buttonElements);
  ButtonsList.forEach((button) => {
    if (!button) return;
    const reqType = getRequestType(button);
    button.style.backgroundColor =
      reqType === currentSelectedFriendMenu ? highlightedColor() : defaultColor;
    button.style.color =
      reqType === currentSelectedFriendMenu ? "white" : grayColor;
  });

  UpdatePendingCounter();
}

function getRequestType(btn: HTMLElement): keyof typeof buttonElements {
  return (
    (Object.keys(buttonElements) as Array<keyof typeof buttonElements>).find(
      (key) => buttonElements[key] === btn
    ) || "online"
  );
}

function initializeButtonsList() {
  Array.from(ButtonsList).forEach((el) => {
    if (!el) return;
    const reqType = getRequestType(el);
    el.addEventListener("click", () => selectFriendMenu(el));
    el.addEventListener("mouseenter", () => {
      el.style.backgroundColor = highlightedColor();
      el.style.color = "white";
    });
    el.addEventListener("mouseleave", () => {
      const isActive =
        reqType === currentSelectedFriendMenu && !isAddFriendsOpen;
      el.style.backgroundColor = isActive ? highlightedColor() : defaultColor;
      el.style.color = isActive ? "white" : grayColor;
    });
  });
}

function resetButtons() {
  for (const element of ButtonsList) {
    if (element) {
      element.style.backgroundColor = defaultColor;
      element.style.color = grayColor;
    }
  }
}

export function openAddFriend() {
  resetButtons();
  isAddFriendsOpen = true;
  friendsState.isAddFriendsOpen.value = true;

  const friendsBtn = getId("open-friends-button") as HTMLElement;
  if (friendsBtn) {
    friendsBtn.style.color = "#798df9";
    friendsBtn.style.backgroundColor = "#242640";
  }
}

// ── Activity list

let currentUserActivities: Friend[] = [];

export function clearActivityList() {
  if (currentUserActivities.length === 0) {
    const activityListEmptyHTML = `
      <h1 id="nowonline" style="font-weight: bolder;">${translations.getTranslation("nowonline")}</h1>
      <h1 id="activity-detail" style="font-weight: bolder;">${translations.getTranslation("activity-detail")}</h1>
      <h1 id="activity-detail-2" style="font-weight: bolder;">${translations.getTranslation("activity-detail-2")}</h1>
      <ul></ul>`;
    if (activityList) activityList.innerHTML = activityListEmptyHTML;
  }
}

export function updateUsersActivities(friends?: Friend[]) {
  if (friends) currentUserActivities = friends;
  if (currentUserActivities && Array.isArray(currentUserActivities)) {
    clearActivityList();
    currentUserActivities.forEach((friend) => createActivityCard(friend));
  }
}

function createActivityCard(friend: Friend) {
  if (!userManager.isOnline(friend.userId)) return;
  if (!activityList) return;
  if (!friend.activity) return;

  disableElement("activity-detail");
  disableElement("activity-detail-2");

  let activityCard = activityList.querySelector(
    `#${CSS.escape(friend.userId)}`
  );

  if (!activityCard) {
    activityCard = createEl("div", {
      className: "activity-card",
      id: friend.userId
    });
    const contentDiv = createEl("div", { className: "activity-card-content" });
    const avatarImg = createEl("img", { className: "activity-card-avatar" });
    setProfilePic(avatarImg, friend.userId);
    const nickHeading = createEl("h2", { className: "activity-card-nick" });
    nickHeading.textContent =
      friend.nickName || userManager.getUserNick(friend.userId);
    const titleSpan = createEl("span", { className: "activity-card-title" });
    titleSpan.textContent = friend.activity || "";
    contentDiv.appendChild(avatarImg);
    contentDiv.appendChild(nickHeading);
    contentDiv.appendChild(titleSpan);

    const iconImg = createEl("img", {
      className: "activity-card-icon",
      src: IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC
    });

    activityCard.appendChild(contentDiv);
    activityCard.appendChild(iconImg);
    activityList.appendChild(activityCard);
  } else {
    const contentDiv = activityCard.querySelector(".activity-card-content");
    const nickHeading = contentDiv?.querySelector(".activity-card-nick");
    if (nickHeading)
      nickHeading.textContent =
        friend.nickName || userManager.getUserNick(friend.userId);
    const titleSpan = contentDiv?.querySelector(".activity-card-title");
    if (titleSpan && titleSpan.textContent !== friend.activity)
      titleSpan.textContent = friend.activity || "";
  }
}

export function displayEmptyFriends() {
  friendsState.friends.value = [];
}

export async function populateFriendsContainer(
  friends: Friend[],
  isPending?: boolean
) {
  if (!friends || friends.length === 0) {
    friendsState.friends.value = [];
    return;
  }
  friendsState.friends.value = friends;
  friendsState.currentSelectedFriendMenu.value = currentSelectedFriendMenu;
}

export function updateFriendsList(friends: Friend[]): void {
  if (!friends || friends.length === 0) {
    console.warn("Empty friend list data.");
    return;
  }
  if (isAddFriendsOpen) return;
  friendsState.friends.value = [...friends];
}

export function removeFriendCard(userId: string) {
  friendsState.friends.value = friendsState.friends.value.filter(
    (f: Friend) => f.userId !== userId
  );
}

export function getFriendsTranslation() {
  return translations.getTranslation(currentSelectedFriendMenu);
}

export function initializeFriends() {
  selectFriendMenu(buttonElements.online);
  initializeButtonsList();
}
