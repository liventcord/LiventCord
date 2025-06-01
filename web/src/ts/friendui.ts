import {
  removeElement,
  enableElement,
  createEl,
  getId,
  disableElementHTML,
  disableElement,
  IMAGE_SRCS
} from "./utils.ts";
import {
  currentDiscriminator,
  currentUserId,
  currentUserNick,
  userManager
} from "./user.ts";
import {
  submitAddFriend,
  filterFriendsOnSearch,
  addPendingButtons,
  friendsCache,
  Friend,
  UpdatePendingCounter,
  removeDm
} from "./friends.ts";
import {
  appendToProfileContextList,
  triggerContextMenuById
} from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { translations } from "./translations.ts";
import { activityList, userList } from "./userList.ts";
import { loadDmHome, openDm } from "./app.ts";

const addfriendhighlightedcolor = "#5865F2";
const highlightedColor = "#29292D";
const defaultColor = "transparent";
const grayColor = "#c2c2c2";

let currentUserActivities: Friend[] = [];

export let currentSelectedFriendMenu: keyof typeof buttonElements;
const dmContainerParent = getId("dm-container-parent") as HTMLElement;
export const friendContainerItem = getId(
  "friend-container-item"
) as HTMLElement;

export function unselectFriendContainer() {
  friendContainerItem.classList.remove("dm-selected");
}

export const friendsContainer = getId("friends-container") as HTMLElement;
export let isAddFriendsOpen = false;

export const ButtonTypes = {
  SendMsgBtn:
    '<svg role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z" class=""></path></svg>',
  TickBtn:
    '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M21.7 5.3a1 1 0 0 1 0 1.4l-12 12a1 1 0 0 1-1.4 0l-6-6a1 1 0 1 1 1.4-1.4L9 16.58l11.3-11.3a1 1 0 0 1 1.4 0Z" class=""></path></svg>',
  CloseBtn:
    '<svg role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z" class=""></path></svg>',
  OptionsBtn:
    '<svg role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm2 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" clip-rule="evenodd" class=""></path></svg>'
};
const initialFriendsContainerHtml = `<input id="friendsSearchInput" autocomplete="off" placeholder=${translations.getTranslation(
  "friendsSearchInput"
)} ></input>`;

const HOVER_BUBBLE_TIME = 500;

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

let ButtonsList = Object.values(buttonElements);
initializeButtonsList();

disableElementHTML(buttonElements.blocked);
interface ExistingDmContainer {
  remove(): void;
  dmContainer: HTMLElement;
}

const existingFriendsDmContainers = new Set<ExistingDmContainer>();
const existingFriendsIds = new Set<string>();

export function activateDmContainer(friendId: string) {
  console.warn(existingFriendsDmContainers);
  if (!existingFriendsDmContainers || existingFriendsDmContainers.size < 1) {
    return;
  }

  existingFriendsDmContainers.forEach(({ dmContainer }) => {
    console.warn(dmContainer);
    if (dmContainer.id === friendId) {
      dmContainer.classList.add("dm-selected");
    } else {
      dmContainer.classList.remove("dm-selected");
    }
  });
}

export function disableDmContainers() {
  if (!existingFriendsDmContainers || existingFriendsDmContainers.size < 1) {
    return;
  }

  existingFriendsDmContainers.forEach(({ dmContainer }) => {
    dmContainer.classList.remove("dm-selected");
  });
}
interface DmUserInfo {
  userId: string;
  status: string;
  nickName: string;
  activity: string;
  discriminator: string;
  isPending: boolean;
  isFriendsRequestToUser: boolean;
}

interface ExistingDmContainer {
  dmContainer: HTMLElement;
  remove(): void;
}

class DmUser {
  friend: DmUserInfo;
  friendId: string;
  friendNick: string;
  dmContainer: HTMLElement;

  private constructor(friend: DmUserInfo, dmContainer: HTMLElement) {
    this.friend = friend;
    this.friendId = friend.userId;
    this.friendNick = friend.nickName;
    this.dmContainer = dmContainer;
  }

  static async create(friend: DmUserInfo): Promise<DmUser> {
    const existing = dmContainerParent.querySelector(
      `#${CSS.escape(friend.userId)}`
    ) as HTMLElement;
    if (existing) {
      return new DmUser(friend, existing);
    }

    const dmContainer = await DmUser.createDmContainer(friend);
    return new DmUser(friend, dmContainer);
  }

  private static async createDmContainer(
    friend: DmUserInfo
  ): Promise<HTMLElement> {
    const dmContainer = createEl("div", {
      className: "dm-container",
      id: friend.userId
    });

    if (friend.userId === friendsCache.currentDmId) {
      dmContainer.classList.add("dm-selected");
    }

    const profileImg = createEl("img", {
      className: "dm-profile-img"
    }) as HTMLImageElement;
    setProfilePic(profileImg, friend.userId);

    const status = await userManager.getStatusString(friend.userId);
    const bubble = createDmBubble(status);
    profileImg.style.transition = "border-radius 0.5s ease-out";
    bubble.style.transition = "opacity 0.5s ease-in-out";

    let hoverTimeout: number;
    profileImg.addEventListener("mouseover", () => {
      profileImg.style.borderRadius = "0px";
      clearTimeout(hoverTimeout);
      bubble.style.opacity = "0";
      hoverTimeout = setTimeout(() => {
        bubble.style.display = "none";
      }, HOVER_BUBBLE_TIME);
    });

    profileImg.addEventListener("mouseout", () => {
      profileImg.style.borderRadius = "25px";
      clearTimeout(hoverTimeout);
      bubble.style.display = "block";
      setTimeout(() => {
        bubble.style.opacity = "1";
      }, 10);
    });

    dmContainer.addEventListener("click", () => {
      openDm(friend.userId);
    });

    appendToProfileContextList(friend, friend.userId);

    dmContainer.appendChild(bubble);
    dmContainer.appendChild(profileImg);

    const titleContent = createEl("p", {
      className: "content",
      textContent: friend.nickName
    });
    dmContainer.appendChild(titleContent);

    const closeBtn = createEl("div");
    closeBtn.classList.add("close-dm-btn");
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeDm(friend.userId);
    });
    dmContainer.appendChild(closeBtn);

    return dmContainer;
  }
}

interface DmUserAddResponse {
  userId: string;
  nickName: string;
  discriminator: string;
}

export async function appendToDmList(
  user: DmUserAddResponse
): Promise<HTMLElement | null> {
  if (existingFriendsIds.has(user.userId)) {
    return null;
  }

  const dmUserInfo: DmUserInfo = {
    userId: user.userId,
    status: "",
    nickName: user.nickName,
    activity: "",
    discriminator: user.discriminator,
    isPending: false,
    isFriendsRequestToUser: false
  };

  const dmUser = await DmUser.create(dmUserInfo);

  const existingContainer = dmContainerParent.querySelector(
    `#${CSS.escape(user.userId)}`
  );
  if (existingContainer) {
    return dmUser.dmContainer;
  }

  dmContainerParent.appendChild(dmUser.dmContainer);

  existingFriendsDmContainers.add({
    dmContainer: dmUser.dmContainer,
    remove(): void {
      this.dmContainer.remove();
    }
  });

  existingFriendsIds.add(user.userId);

  return dmUser.dmContainer;
}

export function updateDmsList(friends: DmUserInfo[]) {
  if (!Array.isArray(friends)) {
    console.error("Expected an array of users");
    return;
  }

  existingFriendsDmContainers.forEach(({ remove }) => remove());
  existingFriendsDmContainers.clear();
  existingFriendsIds.clear();

  const friendsRecord: { [key: string]: Friend } = friends.reduce(
    (record, friend) => {
      async function setupDmUser(_friend: DmUserInfo) {
        const dmUser = await DmUser.create(_friend);

        const existingContainer = dmContainerParent.querySelector(
          `#${CSS.escape(_friend.userId)}`
        );
        if (!existingContainer) {
          dmContainerParent.appendChild(dmUser.dmContainer);
        }

        existingFriendsDmContainers.add({
          dmContainer: dmUser.dmContainer,
          remove() {
            dmUser.dmContainer.remove();
          }
        });
      }
      setupDmUser(friend);

      existingFriendsIds.add(friend.userId);

      record[friend.userId] = new Friend(friend);

      return record;
    },
    {} as { [key: string]: Friend }
  );

  friendsCache.setupDmFriends(friendsRecord);
}

async function addToDmList(userData: DmUserInfo): Promise<void> {
  const existingDmContainer = dmContainerParent.querySelector(
    `#${CSS.escape(userData.userId)}`
  );

  if (existingDmContainer) {
    dmContainerParent.insertBefore(
      existingDmContainer,
      dmContainerParent.firstChild
    );
    return;
  }

  const newContainer = await appendToDmList(userData);

  if (newContainer) {
    dmContainerParent.insertBefore(newContainer, dmContainerParent.firstChild);
  }
}

export async function removeFromDmList(userId: string): Promise<void> {
  console.log("removeFromDmList: ", userId);
  const existingDmContainer = dmContainerParent.querySelector(
    `#${CSS.escape(userId)}`
  );
  if (existingDmContainer) {
    dmContainerParent.removeChild(existingDmContainer);
    friendsCache.removeDmFriend(userId);
    if (userId === friendsCache.currentDmId) {
      loadDmHome();
    }
  }
}

export function getCurrentDmFriends() {
  return {
    currentUserId: {
      userId: currentUserId,
      nick: currentUserNick,
      discriminator: currentDiscriminator
    },
    currentDmId: {
      userId: friendsCache.currentDmId,
      nick: currentUserNick,
      discriminator: "5678"
    }
  };
}

let notifyTimeout: number;
const NOTIFY_LENGTH = 10000;
export function printFriendMessage(content: string) {
  const messagetext = createEl("div");
  messagetext.className = "messagetext";
  messagetext.textContent = content;
  const parentNode = getId("friends-popup-container") as HTMLElement;
  if (parentNode) {
    parentNode.appendChild(messagetext);
  }

  if (notifyTimeout) {
    clearTimeout(notifyTimeout);
  }

  notifyTimeout = setTimeout(() => {
    messagetext.remove();
    notifyTimeout = 0;
  }, NOTIFY_LENGTH);
}

selectFriendMenu(buttonElements.online);

export function updateFriendMenu() {
  const currentSelectedFriendMenuElement =
    buttonElements[currentSelectedFriendMenu];
  if (currentSelectedFriendMenuElement)
    selectFriendMenu(currentSelectedFriendMenuElement);
}
function selectFriendMenu(clickedButton: HTMLElement) {
  const openFriendsBtn = getId("open-friends-button") as HTMLElement;
  openFriendsBtn.style.backgroundColor = addfriendhighlightedcolor;
  openFriendsBtn.style.color = "white";
  displayWumpus();
  isAddFriendsOpen = false;
  currentSelectedFriendMenu = getRequestType(clickedButton);
  console.log("Selected: ", currentSelectedFriendMenu);

  const friends = friendsCache.cacheFriendToFriendConverter();

  populateFriendsContainer(friends, clickedButton === buttonElements.pending);

  if (!ButtonsList) {
    ButtonsList = Object.values(buttonElements);
  }

  ButtonsList.forEach((button) => {
    if (button) {
      const reqType = getRequestType(button);

      button.style.backgroundColor =
        reqType === currentSelectedFriendMenu ? highlightedColor : defaultColor;
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
    const el = element as HTMLElement;
    const reqType = getRequestType(el);

    el.addEventListener("click", () => selectFriendMenu(el));

    el.addEventListener("mouseenter", () => {
      el.style.backgroundColor = highlightedColor;
      el.style.color = "white";
    });

    el.addEventListener("mouseleave", () => {
      const isActive =
        reqType === currentSelectedFriendMenu && !isAddFriendsOpen;
      el.style.backgroundColor = isActive ? highlightedColor : defaultColor;
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

function createGraySphere(
  content: string,
  element: HTMLElement,
  contentClass = "",
  hoverText = ""
) {
  const graySphere = createEl("div", {
    className: "gray-sphere friend_button_element"
  });

  graySphere.addEventListener("click", function (event) {
    event.stopPropagation();
  });

  if (hoverText) {
    graySphere.addEventListener("mouseenter", function () {
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

    graySphere.addEventListener("mouseleave", function () {
      const descriptionRectangle = graySphere.querySelector(
        ".description-rectangle"
      );
      if (descriptionRectangle) {
        descriptionRectangle.remove();
      }
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

export function clearActivityList() {
  if (currentUserActivities.length === 0) {
    const activityListEmptyHTML = `
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
    if (activityList) activityList.innerHTML = activityListEmptyHTML;
  }
}

export function updateUsersActivities(friends?: Friend[]) {
  if (friends) currentUserActivities = friends;
  console.log(String(Array.isArray(currentUserActivities)));
  if (currentUserActivities && Array.isArray(currentUserActivities)) {
    clearActivityList();
    currentUserActivities.forEach((friend) => {
      createActivityCard(friend);
    });
  }
}

function createActivityCard(friend: Friend) {
  if (!userManager.isOnline(friend.userId)) return;
  if (!activityList) return;
  if (friend.activity === "" || friend.activity === undefined) return;

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
    const avatarImg = createEl("img", {
      className: "activity-card-avatar"
    }) as HTMLImageElement;
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
    //const avatarImg = contentDiv?.querySelector(
    //  ".activity-card-avatar"
    //) as HTMLImageElement;
    //setProfilePic(avatarImg, friend.userId);

    const nickHeading = contentDiv?.querySelector(".activity-card-nick");
    if (nickHeading)
      nickHeading.textContent =
        friend.nickName || userManager.getUserNick(friend.userId);

    const titleSpan = contentDiv?.querySelector(".activity-card-title");
    if (titleSpan && titleSpan.textContent !== friend.activity) {
      titleSpan.textContent = friend.activity || "";
    }
  }
}

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
  const addfriendinputcontainer = createEl("div");
  const addfriendinput = createEl("input", {
    id: "addfriendinputfield",
    placeholder: translations.getTranslation("addfrienddetailtext"),
    autocomplete: "off"
  }) as HTMLInputElement;
  addfriendinput.value = "Nick#0000";

  const addfriendinputbutton = createEl("button", {
    id: "addfriendinputbutton",
    textContent: translations.getTranslation("addfriendinputbutton")
  });

  const userlistline = createEl("hr", { className: "vertical-line-long" });

  addfriendinputbutton.classList.add("inactive");

  addfriendinput.addEventListener("input", () => {
    const inputValue = addfriendinput.value.trim();
    toggleButtonState(inputValue !== "");
  });

  function toggleButtonState(isActive: boolean) {
    if (isActive) {
      addfriendinputbutton.classList.remove("inactive");
      addfriendinputbutton.classList.add("active");
    } else {
      addfriendinputbutton.classList.remove("active");
      addfriendinputbutton.classList.add("inactive");
    }
  }

  addfriendinputbutton.addEventListener("click", () => {
    submitAddFriend();
  });

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
  if (addfriendinputbutton) {
    addfriendinputbutton.style.right = inputrighttoset;
  }
}

function createFriendCardBubble(status: string) {
  const bubble = createEl("span", { className: `profile-bubble ${status}` });
  return bubble;
}

function createDmBubble(status: string) {
  const bubble = createEl("span", { className: "dm-bubble" });

  bubble.classList.add("dm_" + status);

  return bubble;
}
export function displayWumpus() {
  if (friendsContainer.querySelector("#wumpusalone")) {
    return;
  }
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
  const filterConditions = {
    [friendMenuTypes.online]: async (friend: Friend) =>
      (await userManager.isOnline(friend.userId)) && !friend.isPending,
    [friendMenuTypes.all]: async (friend: Friend) => !friend.isPending,
    [friendMenuTypes.blocked]: async (friend: Friend) =>
      userManager.isUserBlocked(friend.userId) && !friend.isPending,
    [friendMenuTypes.pending]: async (friend: Friend) => friend.isPending
  };

  const filterFn = filterConditions[currentSelectedFriendMenu];

  if (filterFn) {
    const filteredFriends = await Promise.all(
      friends.map(async (friend) => ({
        friend,
        keep: await filterFn(friend)
      }))
    );

    return filteredFriends
      .filter(({ keep }) => keep)
      .map(({ friend }) => friend);
  }

  console.warn("Unhandled status: " + currentSelectedFriendMenu);
  return [];
}

export async function populateFriendsContainer(
  friends: Friend[],
  isPending?: boolean
) {
  if (friends.length === 0) {
    return;
  }

  try {
    console.log(friends);
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
//TODO: make this call userManager in bulk
async function updateFriendsList(friends: Friend[], isPending: boolean) {
  for (const friend of friends) {
    const status = await userManager.getStatusString(friend.userId);
    console.warn(status, friend);
    const isOnline = await userManager.isOnline(friend.userId);
    createFriendCard(
      friend,
      friend.userId,
      friend.nickName,
      friend.discriminator,
      status,
      isOnline,
      isPending || false,
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
  const foundFriend = friendsContainer.querySelector(`#${CSS.escape(userId)}`);
  if (foundFriend) return;
  const friendCard = createEl("div", { className: "friend-card", id: userId });
  const img = createEl("img") as HTMLImageElement;
  setProfilePic(img, userId);
  img.classList.add("friend-image");

  const bubble = createFriendCardBubble(status);
  bubble.style.transition = "display 0.5s ease-in-out";
  if (!isPending) friendCard.appendChild(bubble);

  img.addEventListener("mouseover", () =>
    handleImageHover(img, bubble, isPending, isOnline, true)
  );
  img.addEventListener("mouseout", () =>
    handleImageHover(img, bubble, isPending, isOnline, false)
  );
  friendCard.addEventListener("click", () => {
    openDm(userId);
  });
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
  const friCard = friendsContainer.querySelector(`#${CSS.escape(userId)}`);
  if (friCard) {
    friCard.remove();
  }
}

function handleImageHover(
  img: HTMLElement,
  bubble: HTMLElement,
  isPending: boolean,
  isOnline: boolean,
  isMouseOver: boolean
) {
  img.style.borderRadius = isMouseOver ? "0px" : "25px";
  if (bubble && !isPending) {
    bubble.style.display = isMouseOver || isOnline ? "none" : "block";
  }
}

function addFriendButtons(friendButton: HTMLElement, friend: Friend) {
  const sendMsgBtn = createButtonWithBubblesImg(
    friendButton,
    ButtonTypes.SendMsgBtn,
    translations.getTranslation("send-message")
  );
  sendMsgBtn.addEventListener("click", () => openDm(friend.userId));

  const optionsButton = createButtonWithBubblesImg(
    friendButton,
    ButtonTypes.OptionsBtn,
    translations.getTranslation("more")
  );
  optionsButton.id = friend.userId;
  const cachedFriend = friendsCache.getFriend(friend.userId);
  appendToProfileContextList(cachedFriend, friend.userId);
  optionsButton.addEventListener("click", () => {
    triggerContextMenuById(optionsButton);
  });
}

export function getFriendsTranslation() {
  return translations.getTranslation(currentSelectedFriendMenu);
}
function createFriendsTitle(friendsCount: number) {
  const textToWrite =
    friendsCount !== 0 ? getFriendsTranslation() + " — " + friendsCount : "";
  const friendsTitleContainer = createEl("h2", {
    marginRight: "50px",
    marginTop: "100px",
    textContent: textToWrite,
    id: "friendsTitleContainer"
  });
  return friendsTitleContainer;
}
