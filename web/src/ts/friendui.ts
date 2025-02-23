import {
  removeElement,
  enableElement,
  createRandomId,
  createEl,
  getId,
  disableElementHTML
} from "./utils.ts";
import { openDm, removeDm } from "./app.ts";
import {
  getUserNick,
  addUser,
  isUserBlocked,
  currentUserNick
} from "./user.ts";
import {
  submitAddFriend,
  filterFriends,
  addPendingButtons,
  friendsCache,
  Friend
} from "./friends.ts";
import {
  appendToProfileContextList,
  contextList,
  showContextMenu
} from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { translations } from "./translations.ts";
import { userList } from "./userList.ts";

const addfriendhighlightedcolor = "#248046";
const highlightedColor = "#43444b";
const defaultColor = "#313338";
const grayColor = "#c2c2c2";

let currentSelectedFriendMenu: string;
const dmContainerParent = getId("dm-container-parent") as HTMLElement;
export const friendContainerItem = getId(
  "friend-container-item"
) as HTMLElement;
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
const HOVER_BUBBLE_TIME = 500;

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
  if (!existingFriendsDmContainers || existingFriendsDmContainers.size < 1) {
    return;
  }

  existingFriendsDmContainers.forEach(({ dmContainer }) => {
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
  isOnline: boolean;
  nickName: string;
  discriminator: string;
}
interface ExistingDmContainer {
  dmContainer: HTMLElement;
}
class DmUser {
  friend: DmUserInfo;
  friendId: string;
  isOnline: boolean;
  friendNick: string;
  dmContainer: HTMLElement;

  constructor(friend: DmUserInfo) {
    this.friend = friend;
    this.friendId = friend.userId;
    this.isOnline = friend.isOnline;
    this.friendNick = friend.nickName;
    this.dmContainer = this.createDmContainer();
  }

  createDmContainer() {
    const dmContainer = createEl("div", {
      className: "dm-container",
      id: this.friendId
    });
    if (this.friendId === friendsCache.currentDmId) {
      dmContainer.classList.add("dm-selected");
    }

    const profileImg = createEl("img", {
      className: "dm-profile-img"
    }) as HTMLImageElement;
    if (profileImg) {
      setProfilePic(profileImg, this.friendId);
    }

    const bubble = createDmBubble(this.isOnline);
    profileImg.style.transition = "border-radius 0.5s ease-out";
    bubble.style.transition = "opacity 0.5s ease-in-out";

    let hoverTimeout: number;
    profileImg.addEventListener("mouseover", () => {
      profileImg.style.borderRadius = "0px";
      if (bubble) {
        clearTimeout(hoverTimeout);
        bubble.style.opacity = "0";
        hoverTimeout = setTimeout(() => {
          bubble.style.display = "none";
        }, HOVER_BUBBLE_TIME);
      }
    });

    profileImg.addEventListener("mouseout", () => {
      profileImg.style.borderRadius = "25px";
      if (bubble) {
        clearTimeout(hoverTimeout);
        bubble.style.display = "block";
        setTimeout(() => {
          bubble.style.opacity = "1";
        }, 10);
      }
    });

    dmContainer.addEventListener("click", () => {
      openDm(this.friendId);
    });

    appendToProfileContextList(this.friend, this.friendId);

    dmContainer.appendChild(bubble);
    dmContainer.appendChild(profileImg);

    const titleContent = createEl("p", {
      className: "content",
      textContent: this.friendNick
    });
    dmContainer.appendChild(titleContent);

    const closeBtn = createEl("div");
    closeBtn.classList.add("close-dm-btn");
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeDm(this.friendId);
    });
    dmContainer.appendChild(closeBtn);

    return dmContainer;
  }
}

export function appendToDmList(user: DmUserInfo): HTMLElement | null {
  if (existingFriendsIds.has(user.userId)) {
    return null;
  }

  const dmUser = new DmUser(user);

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

  existingFriendsDmContainers.forEach(({ dmContainer, remove }) => remove());
  existingFriendsDmContainers.clear();
  existingFriendsIds.clear();

  friends.forEach((friend) => {
    const dmUser = new DmUser(friend);
    dmContainerParent.appendChild(dmUser.dmContainer);

    existingFriendsDmContainers.add({
      dmContainer: dmUser.dmContainer,
      remove() {
        this.dmContainer.remove();
      }
    });

    existingFriendsIds.add(friend.userId);
  });

  const friendsRecord: Record<string, Friend> = Object.fromEntries(
    friends.map((friend) => [
      friend.userId,
      new Friend({
        userId: friend.userId,
        nickName: friend.nickName,
        discriminator: "0000",
        status: "offline",
        isOnline: friend.isOnline,
        description: "",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        socialMediaLinks: [],
        isFriendsRequestToUser: false
      })
    ])
  );

  friendsCache.setupDmFriends(friendsRecord);
}

export function addToDmList(userData: DmUserInfo) {
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

  const newContainer = appendToDmList(userData);

  if (newContainer) {
    dmContainerParent.insertBefore(newContainer, dmContainerParent.firstChild);
  }
}

const sampleData = {
  user1: {
    userId: createRandomId(),
    nickName: "Alice",
    isOnline: true,
    discriminator: "1234",
    isPending: false
  },
  user2: {
    userId: createRandomId(),
    nickName: "Bob",
    isOnline: false,
    discriminator: "5678",
    isPending: false
  }
};

export function setupSampleUsers() {
  Object.entries(sampleData).forEach(([userId, userData]) => {
    appendToDmList(userData);
  });
}

export function getCurrentDmFriends() {
  return {
    currentUserId: {
      userId: "someUserId",
      nick: currentUserNick,
      discriminator: "1234"
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

export function selectFriendMenu(clickedButton: HTMLElement) {
  const openFriendsBtn = getId("open-friends-button") as HTMLElement;
  openFriendsBtn.style.backgroundColor = addfriendhighlightedcolor;
  openFriendsBtn.style.color = "white";
  displayWumpus();
  isAddFriendsOpen = false;
  currentSelectedFriendMenu = getRequestType(clickedButton);
  console.log("Selected: ", currentSelectedFriendMenu);

  populateFriendsContainer(
    Object.values(friendsCache.friendsCache),
    clickedButton === buttonElements.pending
  );

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
}

export function getRequestType(btn: HTMLElement) {
  return (
    (Object.keys(buttonElements) as Array<keyof typeof buttonElements>).find(
      (key) => buttonElements[key] === btn
    ) || "online"
  );
}

export function initializeButtonsList() {
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

export function resetButtons() {
  for (const element of ButtonsList) {
    if (element) {
      element.style.backgroundColor = defaultColor;
      element.style.color = grayColor;
    }
  }
}

export function createGraySphere(
  content: string,
  element: HTMLElement,
  contentClass = "",
  hoverText = ""
) {
  const graySphere = createEl("div", {
    className: "gray-sphere friend_button_element"
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
export function updateUsersStatus(friend: Friend) {
  const activityCard = createEl("div", {
    className: "activity-card",
    id: friend.userId
  });
  const contentDiv = createEl("div", { className: "activity-card-content" });
  const avatarImg = createEl("img", {
    className: "activity-card-avatar"
  }) as HTMLImageElement;
  setProfilePic(avatarImg, friend.userId);
  const nickHeading = createEl("h2", { className: "activity-card-nick" });
  nickHeading.textContent = friend.nickName || getUserNick(friend.userId);
  const titleSpan = createEl("span", { className: "activity-card-title" });
  titleSpan.textContent = friend.status || "";
  contentDiv.appendChild(avatarImg);
  contentDiv.appendChild(nickHeading);
  contentDiv.appendChild(titleSpan);

  const iconImg = createEl("img", {
    className: "activity-card-icon",
    src: "/defaultmediaimage.webp"
  });

  activityCard.appendChild(contentDiv);
  activityCard.appendChild(iconImg);

  userList.appendChild(activityCard);
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

export function createAddFriendForm() {
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
  addfriendinput.value = "Reeyuki#1234";

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

export function adjustButtonPosition() {
  const inputrighttoset = userList.style.display === "flex" ? "463px" : "76px";
  const addfriendinputbutton = getId("addfriendinputbutton");
  if (addfriendinputbutton) {
    addfriendinputbutton.style.right = inputrighttoset;
  }
}

export function createFriendCardBubble(isOnline: boolean) {
  const bubble = createEl("span", { className: "status-bubble" });
  bubble.style.marginLeft = "20px";
  bubble.style.marginTop = "25px";
  bubble.style.padding = "5px";
  bubble.style.border = "3px solid #2f3136";

  if (isOnline) {
    bubble.classList.add("online");
  } else {
    bubble.classList.add("offline");
  }

  return bubble;
}

export function createDmBubble(isOnline: boolean) {
  const bubble = createEl("span", { className: "dm-bubble" });

  if (isOnline) {
    bubble.classList.add("online");
  } else {
    bubble.classList.add("offline");
  }

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
    src: "/images/wumpusalone.webp"
  });
  imgElement.style.userSelect = "none";
  friendsContainer.appendChild(imgElement);
}

export const friendMenuTypes = {
  online: "online",
  all: "all",
  pending: "pending",
  blocked: "blocked"
};
export function populateFriendsContainer(
  friends: Friend[],
  isPending?: boolean
) {
  if (friends.length === 0) {
    return;
  }

  friends.forEach((friend) => {
    const { userId, nickName, discriminator } = friend;
    addUser(userId, nickName, discriminator);
  });

  try {
    if (currentSelectedFriendMenu === friendMenuTypes.online) {
      friends = friends.filter((friend) => friend.status === "online");
    } else if (currentSelectedFriendMenu === friendMenuTypes.all) {
    } else if (currentSelectedFriendMenu === friendMenuTypes.blocked) {
      friends = friends.filter((friend) => isUserBlocked(friend.userId));
    } else if (currentSelectedFriendMenu === friendMenuTypes.pending) {
    } else {
      console.warn("Unhandled status:" + currentSelectedFriendMenu);
      return;
    }

    const friendsCount = friends.length;
    const textToWrite =
      friendsCount !== 0 ? getFriendsTranslation() + " — " + friendsCount : "";
    const friendsTitleContainer = createEl("h2", {
      marginRight: "50px",
      marginTop: "100px",
      textContent: textToWrite,
      id: "friendsTitleContainer"
    });

    if (friendsCount === 0) {
      displayWumpus();
    } else {
      const initialFriendsContainerHtml = `<input id="friendsSearchInput" autocomplete="off" placeholder=${translations.getTranslation(
        "friendsSearchInput"
      )} onkeyup="filterFriends()"></input>`;
      friendsContainer.innerHTML = initialFriendsContainerHtml;
      friendsContainer.appendChild(friendsTitleContainer);
      setTimeout(() => {
        filterFriends();
      }, 10);
      for (const friend of friends) {
        const {
          userId,
          nickName,
          discriminator,
          isOnline,
          isFriendsRequestToUser
        } = friend;
        createFriendCard(
          friend,
          userId,
          nickName,
          discriminator,
          isOnline || false,
          isPending || false,
          isFriendsRequestToUser
        );
        if (friend.status) {
          updateUsersStatus(friend);
        }
      }
      enableElement("friendsTitleContainer");
    }
  } catch (error) {
    console.error("Error populating friends container:", error);
  }
}
export function createFriendCard(
  friend: Friend,
  userId: string,
  nickName: string,
  discriminator: string,
  isOnline: boolean,
  isPending: boolean,
  isFriendsRequestToUser: boolean
) {
  const friendCard = createEl("div", { className: "friend-card", id: userId });
  const img = createEl("img") as HTMLImageElement;
  setProfilePic(img, userId);
  img.classList.add("friend-image");
  img.style.transition = "border-radius 0.5s ease-out";

  const bubble = createFriendCardBubble(isOnline);
  bubble.style.transition = "display 0.5s ease-in-out";
  if (!isPending) friendCard.appendChild(bubble);

  img.addEventListener("mouseover", () =>
    handleImageHover(img, bubble, isPending, isOnline, true)
  );
  img.addEventListener("mouseout", () =>
    handleImageHover(img, bubble, isPending, isOnline, false)
  );

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
    isPending
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
  friendsContainer.appendChild(friendCard);
  friendCard.dataset.name = nickName;
}

export function handleImageHover(
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

export function handleOptionsClick(
  event: MouseEvent,
  optionsButton: HTMLElement
) {
  event.preventDefault();

  const options = contextList[optionsButton.id];

  if (options) {
    const actionContext = options[optionsButton.id];
    if (actionContext && typeof actionContext.action === "function") {
      showContextMenu(event.pageX, event.pageY, { main: actionContext });
    } else {
      console.error(
        `Missing or invalid 'action' for options with ID ${optionsButton.id}`
      );
    }
  }
}

export function addFriendButtons(friendButton: HTMLElement, friend: Friend) {
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
  optionsButton.addEventListener("click", (event) =>
    handleOptionsClick(event, optionsButton)
  );
}

export function getFriendsTranslation() {
  return translations.getTranslation(currentSelectedFriendMenu);
}
