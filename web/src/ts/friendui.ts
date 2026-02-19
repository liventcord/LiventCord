import { reactive } from "vue";
import { appState } from "./appState";
import {
  removeElement,
  enableElement,
  createEl,
  getId,
  disableElementHTML,
  disableElement,
  IMAGE_SRCS
} from "./utils";
import { DEFAULT_DISCRIMINATOR, deletedUser, userManager } from "./user";
import {
  submitAddFriend,
  filterFriendsOnSearch,
  addPendingButtons,
  friendsCache,
  UpdatePendingCounter,
  removeDm
} from "./friends";
import {
  appendToProfileContextList,
  triggerContextMenuById
} from "./contextMenuActions";
import { setProfilePic } from "./avatar";
import { translations } from "./translations";
import { activityList, userList } from "./userList";
import { loadDmHome, openDm } from "./app";
import { isBlackTheme } from "./settings";
import store from "../store";
import { Friend, UserInfo } from "./types/interfaces";
import { SVG } from "./svgIcons";

const addfriendhighlightedcolor = () =>
  isBlackTheme() ? "#5865F2" : "#248046";
const highlightedColor = () => (isBlackTheme() ? "#29292D" : "#43444b");

const defaultColor = "transparent";
const grayColor = "#c2c2c2";

let currentUserActivities: Friend[] = [];

export let currentSelectedFriendMenu: keyof typeof buttonElements;
export const friendContainerItem = getId(
  "friend-container-item"
) as HTMLElement;

export function unselectFriendContainer() {
  friendContainerItem.classList.remove("dm-selected");
}

export const friendsContainer = getId("friends-container") as HTMLElement;
export let isAddFriendsOpen = false;

const initialFriendsContainerHtml = `<input id="friendsSearchInput" autocomplete="off" placeholder=${translations.getTranslation(
  "friendsSearchInput"
)} ></input>`;

const friendMenuTypes = {
  online: "online",
  all: "all",
  pending: "pending",
  blocked: "blocked"
};

const buttonElements = {
  online: getId("online-button") as HTMLElement,
  all: getId("all-button") as HTMLElement,
  pending: getId("pending-button") as HTMLElement,
  blocked: getId("blocked-button") as HTMLElement
};

document.addEventListener("DOMContentLoaded", () => {
  selectFriendMenu(buttonElements.online);
});

let ButtonsList = Object.values(buttonElements);
initializeButtonsList();

disableElementHTML(buttonElements.blocked);

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
        friendsCache.getFriend(friendsCache.currentDmId).nickName ||
        deletedUser,
      discriminator:
        friendsCache.getFriendDiscriminator(friendsCache.currentDmId) ||
        DEFAULT_DISCRIMINATOR
    }
  ];
}

// ---------------------------------------------------------------------------
// Notification / friend-message popup
// ---------------------------------------------------------------------------

let notifyTimeout: ReturnType<typeof setTimeout> | null;
const NOTIFY_LENGTH = 10000;
export function printFriendMessage(content: string) {
  const messagetext = createEl("div");
  messagetext.className = "messagetext";
  messagetext.textContent = content;
  const parentNode = getId("friends-popup-container") as HTMLElement;
  if (parentNode) {
    parentNode.appendChild(messagetext);
  }
  if (notifyTimeout) clearTimeout(notifyTimeout);
  notifyTimeout = setTimeout(() => {
    messagetext.remove();
    notifyTimeout = null;
  }, NOTIFY_LENGTH);
}

// ---------------------------------------------------------------------------
// Friends menu / button logic
// ---------------------------------------------------------------------------

export function updateFriendMenu() {
  const currentSelectedFriendMenuElement =
    buttonElements[currentSelectedFriendMenu];
  if (currentSelectedFriendMenuElement) {
    selectFriendMenu(currentSelectedFriendMenuElement);
  }
}

function selectFriendMenu(clickedButton: HTMLElement) {
  const openFriendsBtn = getId("open-friends-button") as HTMLElement;
  openFriendsBtn.style.backgroundColor = addfriendhighlightedcolor();
  openFriendsBtn.style.color = "white";
  displayWumpus();
  isAddFriendsOpen = false;
  currentSelectedFriendMenu = getRequestType(clickedButton);

  const friends = friendsCache.cacheFriendToFriendConverter();
  populateFriendsContainer(friends, clickedButton === buttonElements.pending);

  if (!ButtonsList) ButtonsList = Object.values(buttonElements);

  ButtonsList.forEach((button) => {
    if (button) {
      const reqType = getRequestType(button);
      button.style.backgroundColor =
        reqType === currentSelectedFriendMenu
          ? highlightedColor()
          : defaultColor;
      button.style.color =
        reqType === currentSelectedFriendMenu ? "white" : grayColor;
    }
  });
  UpdatePendingCounter();
}

function getRequestType(btn: HTMLElement) {
  return (
    (Object.keys(buttonElements) as Array<keyof typeof buttonElements>).find(
      (key) => buttonElements[key] === btn
    ) || "online"
  );
}

function initializeButtonsList() {
  Array.from(ButtonsList).forEach((element) => {
    const el = element;
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

// ---------------------------------------------------------------------------
// Gray-sphere / button helpers
// ---------------------------------------------------------------------------

function createGraySphere(
  content: string,
  element: HTMLElement,
  contentClass = "",
  hoverText = ""
) {
  const graySphere = createEl("div", {
    className: "gray-sphere friend_button_element"
  });

  graySphere.addEventListener("click", (event) => event.stopPropagation());

  if (hoverText) {
    graySphere.addEventListener("mouseenter", () => {
      const descriptionRectangle = createEl("div", {
        className: "description-rectangle"
      });
      const textEl = createEl("div", {
        className: "description-rectangle-text",
        textContent: hoverText
      });
      descriptionRectangle.appendChild(textEl);
      graySphere.appendChild(descriptionRectangle);
    });
    graySphere.addEventListener("mouseleave", () => {
      graySphere.querySelector(".description-rectangle")?.remove();
    });
  }

  if (element) {
    graySphere.appendChild(element);
  } else if (content) {
    const textElement = createEl("div", {
      className: contentClass,
      textContent: content
    });
    graySphere.appendChild(textElement);
  }

  return graySphere;
}

export function createButtonWithBubblesImg(
  button: HTMLElement,
  html: string,
  hoverText: string
) {
  const icon = createEl("div", { innerHTML: html });
  icon.style.pointerEvents = "none";
  const iconSphere = createGraySphere("", icon, "", hoverText);
  button.appendChild(iconSphere);
  return iconSphere;
}

// ---------------------------------------------------------------------------
// Activity list
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Add-friend UI
// ---------------------------------------------------------------------------

export function openAddFriend() {
  resetButtons();
  isAddFriendsOpen = true;
  updateFriendButton();
  clearFriendContainer();
  createAddFriendForm();
  adjustButtonPosition();
}

function updateFriendButton() {
  const friendsBtn = getId("open-friends-button") as HTMLElement;
  if (!friendsBtn) return;
  friendsBtn.style.color = "#2fc770";
  friendsBtn.style.backgroundColor = "transparent";
}

function clearFriendContainer() {
  friendsContainer.innerHTML = "";
}

function createAddFriendForm() {
  const addfriendtext = createEl("div", {
    id: "addfriendtext",
    textContent: translations.getTranslation("addfriendtext")
  });
  const addfrienddetailtext = createEl("div", {
    id: "addfrienddetailtext",
    textContent: translations.getTranslation("addfrienddetailtext")
  });
  const addfriendinputcontainer = createEl("div", {
    id: "addfriendinputcontainer"
  });
  const addfriendinput = createEl("input", {
    id: "addfriendinputfield",
    placeholder: translations.getTranslation("addfrienddetailtext"),
    autocomplete: "off"
  });
  addfriendinput.value = "Nick#0000";

  const addfriendinputbutton = createEl("button", {
    id: "addfriendinputbutton",
    textContent: translations.getTranslation("addfriendinputbutton")
  });

  const userlistline = createEl("hr", { className: "vertical-line-long" });
  addfriendinputbutton.classList.add("inactive");

  addfriendinput.addEventListener("input", () => {
    const isActive = addfriendinput.value.trim() !== "";
    addfriendinputbutton.classList.toggle("inactive", !isActive);
    addfriendinputbutton.classList.toggle("active", isActive);
  });

  addfriendinputbutton.addEventListener("click", () => submitAddFriend());

  addfriendinputcontainer.appendChild(addfriendinput);
  addfriendinputcontainer.appendChild(addfriendinputbutton);
  friendsContainer.appendChild(addfriendtext);
  friendsContainer.appendChild(addfrienddetailtext);
  friendsContainer.appendChild(addfriendinputcontainer);
  friendsContainer.appendChild(userlistline);
}

function adjustButtonPosition() {
  if (!userList) return;
  const inputrighttoset = userList.style.display === "flex" ? "463px" : "76px";
  const addfriendinputbutton = getId("addfriendinputbutton");
  if (addfriendinputbutton) addfriendinputbutton.style.right = inputrighttoset;
}

// ---------------------------------------------------------------------------
// Friends container population
// ---------------------------------------------------------------------------

export function displayWumpus() {
  if (friendsContainer.querySelector("#wumpusalone")) return;
  removeElement("addfriendmenu");
  friendsContainer.innerHTML = "";
  const imgElement = createEl("img", {
    id: "wumpusalone",
    src: IMAGE_SRCS.WUMPUS_SRC
  });
  imgElement.style.userSelect = "none";
  friendsContainer.appendChild(imgElement);
}

async function filterFriendsByCategory(friends: Friend[]): Promise<Friend[]> {
  const filterConditions: Record<string, (f: Friend) => Promise<boolean>> = {
    [friendMenuTypes.online]: async (f) =>
      (await userManager.isOnline(f.userId)) && !f.isPending,
    [friendMenuTypes.all]: async (f) => !f.isPending,
    [friendMenuTypes.blocked]: async (f) =>
      userManager.isUserBlocked(f.userId) && !f.isPending,
    [friendMenuTypes.pending]: async (f) => f.isPending
  };

  const filterFn = filterConditions[currentSelectedFriendMenu];
  if (!filterFn) {
    console.warn("Unhandled status: " + currentSelectedFriendMenu);
    return [];
  }

  const results = await Promise.all(
    friends.map(async (friend) => ({ friend, keep: await filterFn(friend) }))
  );
  return results.filter(({ keep }) => keep).map(({ friend }) => friend);
}

export async function populateFriendsContainer(
  friends: Friend[],
  isPending?: boolean
) {
  if (friends.length === 0) return;

  try {
    friends = await filterFriendsByCategory(friends);
    if (friends.length === 0) {
      displayWumpus();
      return;
    }

    const friendsTitleContainer = createFriendsTitle(friends.length);
    friendsContainer.innerHTML = initialFriendsContainerHtml;
    const friendsSearchInput = getId("friendsSearchInput");
    friendsSearchInput?.addEventListener("onkeyup", filterFriendsOnSearch);
    friendsContainer.appendChild(friendsTitleContainer);

    updateFriendsList(friends, !!isPending);
    enableElement("friendsTitleContainer");
  } catch (error) {
    console.error("Error populating friends container:", error);
  }
}

async function updateFriendsList(friends: Friend[], isPending: boolean) {
  for (const friend of friends) {
    const status = await userManager.getStatusString(friend.userId);
    const isOnline = await userManager.isOnline(friend.userId);
    createFriendCard(
      friend,
      friend.userId,
      friend.nickName,
      friend.discriminator,
      status,
      isOnline,
      isPending,
      friend.isFriendsRequestToUser
    );
  }
  updateUsersActivities(friends);
  filterFriendsOnSearch();
}

function createFriendCard(
  friend: Friend,
  userId: string,
  nickName: string,
  discriminator: string,
  status: string,
  isOnline: boolean,
  isPending: boolean,
  isFriendsRequestToUser: boolean
) {
  if (friendsContainer.querySelector(`#${CSS.escape(userId)}`)) return;

  const friendCard = createEl("div", { className: "friend-card", id: userId });
  const img = createEl("img");
  setProfilePic(img, userId);
  img.classList.add("friend-image");

  const bubble = createEl("span", { className: `profile-bubble ${status}` });
  bubble.style.transition = "display 0.5s ease-in-out";
  if (!isPending) friendCard.appendChild(bubble);

  img.addEventListener("mouseover", () =>
    handleImageHover(img, bubble, isPending, isOnline, true)
  );
  img.addEventListener("mouseout", () =>
    handleImageHover(img, bubble, isPending, isOnline, false)
  );
  friendCard.addEventListener("click", () => openDm(userId));
  appendToProfileContextList({ userId, nickName, discriminator }, userId);

  const friendInfo = createEl("div", { className: "friend-info" });
  friendInfo.appendChild(
    createEl("div", { className: "friend-name", textContent: nickName })
  );
  friendInfo.appendChild(
    createEl("div", {
      className: "friend-discriminator",
      textContent: `#${discriminator}`
    })
  );

  const onlineStatus = translations.getTranslation(
    friend.isPending
      ? isFriendsRequestToUser
        ? "incoming-friend-request"
        : "outgoing-friend-request"
      : isOnline
        ? "online"
        : "offline"
  );
  friendInfo.appendChild(
    createEl("div", { className: "friend-status", textContent: onlineStatus })
  );

  const friendButton = createEl("div", { className: "friend-button" });
  if (isPending) {
    addPendingButtons(friendButton, friend);
  } else {
    addFriendButtons(friendButton, friend);
  }

  friendCard.appendChild(img);
  friendCard.appendChild(friendInfo);
  friendCard.appendChild(friendButton);
  friendCard.dataset.name = nickName;
  friendsContainer.appendChild(friendCard);
}

export function removeFriendCard(userId: string) {
  friendsContainer.querySelector(`#${CSS.escape(userId)}`)?.remove();
}

function handleImageHover(
  img: HTMLElement,
  bubble: HTMLElement,
  isPending: boolean,
  isOnline: boolean,
  isMouseOver: boolean
) {
  img.style.borderRadius = isMouseOver ? "0px" : "25px";
  if (bubble && !isPending)
    bubble.style.display = isMouseOver || isOnline ? "none" : "block";
}

function addFriendButtons(friendButton: HTMLElement, friend: Friend) {
  const sendMsgBtn = createButtonWithBubblesImg(
    friendButton,
    SVG.sendMsgBtn,
    translations.getTranslation("send-message")
  );
  sendMsgBtn.addEventListener("click", () => openDm(friend.userId));

  const optionsButton = createButtonWithBubblesImg(
    friendButton,
    SVG.optionsBtn,
    translations.getTranslation("more")
  );
  optionsButton.id = friend.userId;

  friendButton.addEventListener("mouseover", () => {
    sendMsgBtn.style.backgroundColor = "#2b2d31;";
    optionsButton.style.backgroundColor = "#2b2d31;";
  });

  const cachedFriend = friendsCache.getFriend(friend.userId);
  appendToProfileContextList(cachedFriend, friend.userId);
  optionsButton.addEventListener("click", () =>
    triggerContextMenuById(optionsButton)
  );
}

export function getFriendsTranslation() {
  return translations.getTranslation(currentSelectedFriendMenu);
}

function createFriendsTitle(friendsCount: number) {
  const textToWrite =
    friendsCount !== 0 ? getFriendsTranslation() + " — " + friendsCount : "";
  return createEl("h2", {
    marginRight: "50px",
    marginTop: "100px",
    textContent: textToWrite,
    id: "friendsTitleContainer"
  });
}
