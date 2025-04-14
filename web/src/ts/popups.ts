import Croppie from "croppie";
import "croppie/croppie.css";

import { cacheInterface, guildCache, sharedGuildsCache } from "./cache.ts";
import {
  currentGuildId,
  createGuild,
  joinToGuild,
  createGuildListItem
} from "./guild.ts";
import { getId, getAverageRGB, createEl } from "./utils.ts";
import { friendsCache, addFriendId } from "./friends.ts";
import { createChannel, currentChannelName } from "./channels.ts";
import {
  currentUserId,
  currentUserNick,
  UserInfo,
  userManager,
  currentDiscriminator
} from "./user.ts";
import { loadDmHome, openDm } from "./app.ts";
import { createBubble } from "./userList.ts";
import { isOnGuild } from "./router.ts";
import {
  showContextMenu,
  contextList,
  appendToProfileContextList
} from "./contextMenuActions.ts";
import { textChanHtml, fillDropDownContent } from "./ui.ts";
import { setProfilePic } from "./avatar.ts";
import { translations } from "./translations.ts";
import { createToggle, updateSettingsProfileColor } from "./settingsui.ts";
import { toggleManager } from "./settings.ts";
import { copyText } from "./tooltip.ts";

let isDropdownOpen = false;
export let closeCurrentJoinPop: CallableFunction | null = null;
const hashText =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class="foreground_b545d5"></path></svg>';
const voiceText =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z" class="foreground_b545d5"></path><path fill="currentColor" d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z" class="foreground_b545d5"></path></svg>';
const addFriendSvg = `
<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
    <path d="M19 14a1 1 0 0 1 1 1v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Z" fill="currentColor"></path>
    <path d="M16.83 12.93c.26-.27.26-.75-.08-.92A9.5 9.5 0 0 0 12.47 11h-.94A9.53 9.53 0 0 0 2 20.53c0 .81.66 1.47 1.47 1.47h.22c.24 0 .44-.17.5-.4.29-1.12.84-2.17 1.32-2.91.14-.21.43-.1.4.15l-.26 2.61c-.02.3.2.55.5.55h7.64c.12 0 .17-.31.06-.36C12.82 21.14 12 20.22 12 19a3 3 0 0 1 3-3h.5a.5.5 0 0 0 .5-.5V15c0-.8.31-1.53.83-2.07ZM12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="white"></path>
</svg>
`;
const pendingFriendSvg = `
<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM2 20.53A9.53 9.53 0 0 1 11.53 11h.94c1.28 0 2.5.25 3.61.7.41.18.36.77-.05.96a7 7 0 0 0-3.65 8.6c.11.36-.13.74-.5.74H6.15a.5.5 0 0 1-.5-.55l.27-2.6c.02-.26-.27-.37-.41-.16-.48.74-1.03 1.8-1.32 2.9a.53.53 0 0 1-.5.41h-.22C2.66 22 2 21.34 2 20.53Z" class=""></path><path fill="currentColor" fill-rule="evenodd" d="M19 24a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm1-7a1 1 0 1 0-2 0v2c0 .27.1.52.3.7l1 1a1 1 0 0 0 1.4-1.4l-.7-.71V17Z" clip-rule="evenodd" class=""></path></svg>
`;

const sendMsgIconSvg = `
            <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z" class=""></path></svg>
        `;

export let currentProfileImg: HTMLElement;

const radioStates = new WeakMap<HTMLElement, boolean>();

function toggleRadio(radio: HTMLElement, newValue: boolean) {
  const innerCircle = radio.querySelector("circle:nth-of-type(2)");
  if (innerCircle) {
    innerCircle.setAttribute("fill", newValue ? "white" : "none");
  }
  radioStates.set(radio, newValue);
}

function createRadioBar() {
  const radioSvg = `<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2"></circle>
            <circle cx="12" cy="12" r="6" fill="none" stroke="none"></circle>
          </svg>`;

  const radioBar = document.createElement("div");
  radioBar.className = "radio-bar";
  radioBar.innerHTML = radioSvg;

  radioStates.set(radioBar, false);
  return radioBar;
}

const privateChannelHTML =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="lightgray" fill-rule="evenodd" d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Zm-1 8a2 2 0 0 1-1 1.73V18a1 1 0 1 1-2 0v-2.27A2 2 0 1 1 14 14Z" clip-rule="evenodd" class=""></path></svg>';
function createPrivateChannelToggle() {
  toggleManager.updateState("private-channel-toggle", false);
  const toggleHtml = createToggle(
    "private-channel-toggle",
    translations.getTranslation("private-channel-text"),
    translations.getTranslation("private-channel-description")
  );
  const toggleElement = createEl("div", { innerHTML: toggleHtml });

  toggleElement.style.marginTop = "50px";

  const labels = toggleElement.querySelectorAll("label");
  if (labels.length > 0) {
    labels[0].style.marginTop = "-10px";
    labels[0].style.marginLeft = "30px";
  }
  if (labels.length > 1) {
    labels[1].style.fontSize = "14px";
    labels[1].style.marginTop = "10px";
  }

  const toggleBox = toggleElement
    .querySelector(".toggle-card")
    ?.querySelector(".toggle-box") as HTMLElement;
  if (toggleBox) {
    toggleBox.style.bottom = "40px";
    toggleBox.style.right = "20px";
  }

  return toggleElement;
}

function createChannelType(isVoice: boolean) {
  const channelData = {
    text: {
      id: "create-channel-text-type",
      icon: hashText,
      title: translations.getTranslation("text-channel"),
      description: translations.getTranslation("channel-type-description"),
      brightness: "1.5"
    },
    voice: {
      id: "create-channel-voice-type",
      icon: voiceText,
      title: translations.getTranslation("voice-channel"),
      description: translations.getTranslation(
        "channel-type-voice-description"
      ),
      brightness: "1"
    }
  };

  const { id, icon, title, description, brightness } = isVoice
    ? channelData.voice
    : channelData.text;
  const container = createEl("div", { id });
  container.innerHTML = `
    <p id="channel-type-icon">${icon}</p>
    <p id="channel-type-title">${title}</p>
    <p id="channel-type-description">${description}</p>
  `;
  container.appendChild(createRadioBar());
  container.style.filter = `brightness(${brightness})`;
  return container;
}

export function createChannelsPop(guildId: string) {
  let isTextChannel = true;

  const newPopOuterParent = createEl("div", { className: "outer-parent" });
  const newPopParent = createEl("div", {
    className: "pop-up",
    id: "createChannelPopContainer"
  });

  newPopParent.innerHTML = `
    <p id="create-channel-title">${translations.getTranslation(
      "channel-dropdown-button"
    )}</p>
    <p id="create-channel-type">${translations.getTranslation(
      "create-channel-type"
    )}</p>
    <p id="create-channel-name">${translations.getTranslation(
      "channel-name"
    )}</p>
    <p id="channel-icon">#</p>
  `;

  const privateChannelIcon = createEl("div", {
    innerHTML: privateChannelHTML,
    id: "private-channel-icon"
  });
  const privateChanToggle = createPrivateChannelToggle();
  const popAcceptButton = createEl("button", {
    className: "pop-up-accept",
    textContent: translations.getTranslation("channel-dropdown-button"),
    style: {
      height: "40px",
      width: "25%",
      top: "93%",
      left: "84%",
      fontSize: "14px",
      whiteSpace: "nowrap"
    }
  });

  const inviteUsersSendInput = createEl("input", {
    id: "create-channel-send-input",
    placeholder: translations.getTranslation("new-channel-placeholder")
  }) as HTMLInputElement;
  inviteUsersSendInput.addEventListener("input", () =>
    toggleButtonState(inviteUsersSendInput.value.trim() !== "", popAcceptButton)
  );

  popAcceptButton.addEventListener("click", () => {
    const channelName =
      inviteUsersSendInput.value.trim() ||
      translations.getTranslation("new-channel-placeholder");
    createChannel(
      guildId,
      channelName,
      isTextChannel,
      toggleManager.states["private-channel-toggle"]
    );
    closePopUp(newPopOuterParent, newPopParent);
  });

  const popRefuseButton = createEl("button", {
    className: "pop-up-refuse",
    textContent: translations.getTranslation("cancel"),
    style: "top: 93%; left:61%; font-size:14px;"
  });
  popRefuseButton.addEventListener("click", () =>
    closePopUp(newPopOuterParent, newPopParent)
  );

  const textChannelContainer = createChannelType(false);
  const voiceChannelContainer = createChannelType(true);

  function updateChannelState(selectedContainer: HTMLElement, isText: boolean) {
    const otherContainer =
      selectedContainer === textChannelContainer
        ? voiceChannelContainer
        : textChannelContainer;
    selectedContainer.style.filter = "brightness(1.5)";
    otherContainer.style.filter = "brightness(1)";
    const selectedRadio = selectedContainer.querySelector(
      ".radio-bar"
    ) as HTMLElement;
    const otherRadio = otherContainer.querySelector(
      ".radio-bar"
    ) as HTMLElement;
    if (otherRadio) {
      toggleRadio(otherRadio, false);
    }
    if (selectedRadio) {
      toggleRadio(selectedRadio, true);
    }
    isTextChannel = isText;
  }

  updateChannelState(textChannelContainer, true);

  textChannelContainer.addEventListener("click", () =>
    updateChannelState(textChannelContainer, true)
  );
  voiceChannelContainer.addEventListener("click", () =>
    updateChannelState(voiceChannelContainer, false)
  );

  const closeButton = createPopUpCloseButton(
    newPopOuterParent,
    newPopParent,
    "popup-close"
  );

  newPopParent.append(
    privateChannelIcon,
    popAcceptButton,
    privateChanToggle,
    closeButton,
    popRefuseButton,
    textChannelContainer,
    voiceChannelContainer
  );

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "create-channel-popup-bottom-container"
  });

  popBottomContainer.appendChild(inviteUsersSendInput);

  newPopParent.appendChild(popBottomContainer);

  newPopOuterParent.style.display = "flex";
  newPopOuterParent.appendChild(newPopParent);
  document.body.appendChild(newPopOuterParent);
  toggleManager.setupToggle("private-channel-toggle");
  newPopOuterParent.addEventListener("click", (event) => {
    if (event.target === newPopOuterParent)
      closePopUp(newPopOuterParent, newPopParent);
  });
}

function toggleButtonState(isActive: boolean, popAcceptButton: HTMLElement) {
  if (isActive) {
    popAcceptButton.classList.remove("inactive");
    popAcceptButton.classList.add("active");
  } else {
    popAcceptButton.classList.remove("active");
    popAcceptButton.classList.add("inactive");
  }
}
export function constructUserData(userId: string): UserInfo {
  return {
    userId,
    discriminator: userManager.getUserDiscriminator(userId),
    nickName: userManager.getUserDiscriminator(userId)
  };
}

export async function drawProfilePopId(
  id: string,
  shouldDrawPanel: boolean = false
) {
  const userData = constructUserData(id);
  return await drawProfilePop(userData, shouldDrawPanel);
}
let currentProfileDisplay: HTMLElement;
function closeCurrentProfileDisplay() {
  closePopUp(
    currentProfileDisplay,
    currentProfileDisplay.firstChild as HTMLElement
  );
}
export async function drawProfilePop(
  userData: UserInfo,
  shouldDrawPanel?: boolean
): Promise<HTMLElement | null> {
  if (!userData) {
    console.error("Null user data requested profile draw", userData);
    return null;
  }

  const profileContainer = createProfileContainer(userData);
  const profileImg = createProfileImage(userData);
  const popTopContainer = createPopTopContainer(
    userData,
    profileImg,
    !shouldDrawPanel
  );
  const userId = userData.userId;
  const sharedGuilds = sharedGuildsCache.getFriendGuilds(
    userId,
    currentGuildId
  );

  const popBottomContainer = !shouldDrawPanel
    ? createPopBottomContainer(
        userData.description,
        sharedGuilds,
        null,
        userId,
        userData.createdAt
      )
    : null;

  profileContainer.appendChild(profileImg);
  profileContainer.appendChild(popTopContainer);
  if (popBottomContainer) profileContainer.appendChild(popBottomContainer);

  const status = await userManager.getStatusString(userId);
  const bubble = createBubble(status);

  const contentElements = [
    popTopContainer,
    profileImg,
    bubble,
    profileContainer,
    ...(popBottomContainer ? [popBottomContainer] : [])
  ];

  const createdPop = createPopUp({
    contentElements,
    id: "profilePopContainer",
    shouldDrawPanel
  });
  if (!shouldDrawPanel) {
    currentProfileDisplay = createdPop;
  }

  appendToProfileContextList(userData, userId);
  return createdPop;
}

function createProfileContainer(userData: UserInfo): HTMLElement {
  const container = createEl("div", { id: "profile-container" });

  const profileTitle = createEl("p", {
    id: "profile-title",
    textContent: userManager.getUserNick(userData.userId)
  });
  if (userData.userId === currentUserId) {
    userData.discriminator = currentDiscriminator;
  }
  const profileDiscriminator = createEl("p", {
    id: "profile-discriminator",
    textContent: "#" + userData.discriminator
  });

  container.appendChild(profileTitle);
  container.appendChild(profileDiscriminator);

  const profileOptionsContainer = createProfileOptionsContainer(userData);

  container.appendChild(profileOptionsContainer);

  return container;
}
function createProfileImage(userData: UserInfo): HTMLImageElement {
  const profileImg = createEl("img", {
    className: "profile-display"
  }) as HTMLImageElement;
  currentProfileImg = profileImg;
  profileImg.addEventListener("mouseover", function () {
    this.style.borderRadius = "0px";
  });
  profileImg.addEventListener("mouseout", function () {
    this.style.borderRadius = "50%";
  });

  setProfilePic(profileImg, userData.userId);

  return profileImg;
}

function createPopTopContainer(
  userData: UserInfo,
  profileImg: HTMLImageElement,
  shouldAddOuterHtml: boolean = true
): HTMLElement {
  const topContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-top-container"
  });
  if (shouldAddOuterHtml) {
    const profileOptions = createProfileOptionsButton(userData);
    topContainer.appendChild(profileOptions);

    profileOptions.addEventListener("click", (event) =>
      handleContextMenuClick(userData.userId, event)
    );
  }

  profileImg.onload = function () {
    if (topContainer) {
      topContainer.style.backgroundColor = getAverageRGB(profileImg);
    }
  };

  return topContainer;
}

function createProfileOptionsButton(userData: UserInfo): HTMLElement {
  const profileOptions = createEl("button", {
    id: userData.userId,
    className: "profile-dots3"
  });
  const profileOptionsText = createEl("p", {
    className: "profile-dots3-text",
    textContent: "⋯"
  });

  profileOptions.appendChild(profileOptionsText);

  return profileOptions;
}
function createGuildTextElement(guildName: string): HTMLElement {
  return createEl("p", {
    textContent: guildName,
    style: {
      marginLeft: "20px"
    }
  });
}
const SECTION_TYPES = {
  ABOUT: "about",
  SHARED_GUILDS: "sharedGuilds",
  SHARED_FRIENDS: "sharedFriends"
};

function getTranslation(
  name: string,
  friendsCount?: number,
  guildsCount?: number
) {
  switch (name) {
    case SECTION_TYPES.SHARED_FRIENDS:
      return translations.getSharedFriendsPlaceholder(friendsCount ?? 0);
    case SECTION_TYPES.SHARED_GUILDS:
      return translations.getSharedGuildsPlaceholder(guildsCount ?? 0);
    default:
      return translations.getTranslation(name);
  }
}

function createPopBottomContainer(
  description: string | undefined,
  sharedGuilds: string[],
  sharedFriends: string[] | null,
  userId: string,
  memberSince?: string
) {
  const bottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-bottom-container"
  });

  const sectionsBar = createEl("div", { className: "profile-sections-bar" });
  const sectionsLine = createEl("hr", { className: "profile-sections-line" });

  const sectionsData: {
    name: string;
    content: HTMLElement;
    button?: HTMLElement;
    line?: HTMLElement;
  }[] = [
    {
      name: SECTION_TYPES.ABOUT,
      content: createEl("div", {
        innerHTML: `
          <p id="profile-about-description">${description ?? ""}</p>
          ${
            memberSince
              ? `<p>${translations.getTranslation(
                  "member-since"
                )}:</p><p id="profile-member-since">${new Date(
                  memberSince
                ).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}</p>`
              : ""
          }
        `
      })
    }
  ];

  if (userId !== currentUserId) {
    const sharedGuildsSection = createEl("div", {
      className: "shared-guilds-content",
      style: "display: none; overflow-y: auto; max-height: 200px;"
    });
    const guildsList = createEl("ul", {
      className: "guilds-list shared-guilds-list",
      id: "guilds-list"
    });
    sharedGuilds.forEach((guildId: string) => {
      const rootChannel = cacheInterface.getRootChannel(guildId);
      if (!rootChannel) return;
      const guildName = cacheInterface.getGuildName(guildId) as string;
      const isUploaded = cacheInterface.getIsUploaded(guildId) as boolean;
      const guildImage = createGuildListItem(
        guildId,
        rootChannel.channelId,
        guildName,
        isUploaded,
        false
      );
      const guildText = createGuildTextElement(guildName);
      guildImage.appendChild(guildText);
      guildsList.appendChild(guildImage);

      guildsList.addEventListener("click", () => {
        closeCurrentProfileDisplay();
      });
    });
    sharedGuildsSection.appendChild(guildsList);
    sectionsData.push({
      name: SECTION_TYPES.SHARED_GUILDS,
      content: sharedGuildsSection
    });

    const sharedFriendsSection = createEl("div", {
      className: "shared-friends-content",
      style: "display: none; overflow-y: auto; max-height: 200px;"
    });
    sharedFriendsSection.innerHTML = sharedFriends
      ? sharedFriends.map((friend: string) => `<p>${friend}</p>`).join("")
      : "";
    sectionsData.push({
      name: SECTION_TYPES.SHARED_FRIENDS,
      content: sharedFriendsSection
    });
  }

  const contentContainer = createEl("div", { className: "profile-content" });
  sectionsData.forEach((section) =>
    contentContainer.appendChild(section.content)
  );

  function showContent(
    content: HTMLElement,
    button?: HTMLElement,
    line?: HTMLElement
  ) {
    sectionsData.forEach((sec) => {
      sec.content.style.display = "none";
      if (sec.line) {
        sec.line.classList.remove("selected");
      }
    });
    content.style.display = "block";
    if (line) {
      line.classList.add("selected");
    }
  }

  sectionsData.forEach((section) => {
    const sectionButton = createEl("button", {
      className: "profile-section-button",
      textContent: getTranslation(
        section.name,
        section.name === SECTION_TYPES.SHARED_FRIENDS
          ? sharedFriends?.length
          : undefined,
        section.name === SECTION_TYPES.SHARED_GUILDS
          ? sharedGuilds?.length
          : undefined
      )
    });
    const sectionLine = createEl("hr", {
      className: "profile-sections-line profile-section-line-button"
    });
    sectionButton.appendChild(sectionLine);
    sectionButton.addEventListener("click", () =>
      showContent(section.content, sectionButton, sectionLine)
    );
    sectionsBar.appendChild(sectionButton);
    section.line = sectionLine;
  });

  showContent(
    sectionsData[0].content,
    sectionsData[0].button,
    sectionsData[0].line
  );

  bottomContainer.appendChild(sectionsBar);
  bottomContainer.appendChild(sectionsLine);
  bottomContainer.appendChild(contentContainer);
  return bottomContainer;
}

function createProfileOptionsContainer(userData: UserInfo): HTMLElement {
  const container = createEl("div", { className: "profile-options-container" });

  if (userData.userId !== currentUserId) {
    container.appendChild(createSendMsgButton(userData));
    if (!friendsCache.isFriend(userData.userId)) {
      container.appendChild(createAddFriendButton(userData));
    }
  }

  return container;
}

function createSendMsgButton(userData: UserInfo): HTMLElement {
  const sendMsgBtn = createEl("button", {
    className: "profile-send-msg-button"
  });
  const sendMsgIco = createEl("div", { innerHTML: sendMsgIconSvg });
  sendMsgBtn.appendChild(sendMsgIco);

  const messageText = createEl("span", {
    textContent: translations.getTranslation("message")
  });
  sendMsgBtn.appendChild(messageText);

  sendMsgBtn.addEventListener("click", () => {
    loadDmHome();
    openDm(userData.userId);
    const profilePopContainer = getId("profilePopContainer");
    if (profilePopContainer) {
      (profilePopContainer.parentNode as HTMLElement).remove();
    }
  });

  return sendMsgBtn;
}

function createAddFriendButton(userData: UserInfo): HTMLElement {
  let addFriendBtn: HTMLElement;

  if (friendsCache.hasRequestToFriend(userData.userId)) {
    addFriendBtn = createEl("button", {
      className: "profile-add-friend-button profile-add-friend-button-pending"
    });
    addFriendBtn.innerHTML = `<div class="icon-container">${pendingFriendSvg}</div>`;
    addFriendBtn.addEventListener("click", () => {
      addFriendId(userData.userId);
      setCurrentProfilePopButtonToPending(addFriendBtn);
    });
  } else {
    addFriendBtn = createEl("button", {
      className: "profile-add-friend-button"
    });
    addFriendBtn.innerHTML = `<div class="icon-container">${addFriendSvg}</div> ${translations.getTranslation(
      "open-friends-button"
    )}`;
    addFriendBtn.addEventListener("click", () => {
      addFriendId(userData.userId);
      setCurrentProfilePopButtonToPending(addFriendBtn);
    });
  }

  return addFriendBtn;
}

function handleContextMenuClick(userId: string, event: MouseEvent): void {
  if (contextList[userId]) {
    showContextMenu(event.pageX, event.pageY, contextList[userId]);
  } else {
    console.warn(`No context found for userId: ${userId}`);
  }
}

export function createPopUp({
  contentElements = [],
  id,
  closeBtnId = null,
  shouldDrawPanel = false
}: {
  contentElements?: HTMLElement[];
  id: string;
  closeBtnId?: string | null;
  shouldDrawPanel?: boolean;
}) {
  const popOuterParent = createEl("div", { className: "outer-parent" });
  const parentContainer = createEl("div", { className: "pop-up", id });
  popOuterParent.style.display = "flex";

  contentElements.forEach((element) => parentContainer.appendChild(element));
  if (closeBtnId) {
    const closeBtn = createPopUpCloseButton(
      popOuterParent,
      parentContainer,
      "popup-close",
      closeBtnId
    );
    parentContainer.appendChild(closeBtn);
  }
  if (!shouldDrawPanel) {
    let isMouseDownOnPopOuter = false;

    popOuterParent.addEventListener("mousedown", function (event) {
      if (event.target === popOuterParent) {
        isMouseDownOnPopOuter = true;
      }
    });

    popOuterParent.addEventListener("mouseup", function (event) {
      if (isMouseDownOnPopOuter && event.target === popOuterParent) {
        closePopUp(popOuterParent, parentContainer);
      }
      isMouseDownOnPopOuter = false;
    });

    popOuterParent.appendChild(parentContainer);
    document.body.appendChild(popOuterParent);
    return popOuterParent;
  }

  document.body.appendChild(parentContainer);
  return parentContainer;
}

export function createInviteUsersPop() {
  const title = translations.getInviteGuildText(guildCache.currentGuildName);
  const sendText = translations.getTranslation("invites-guild-detail");
  const invitelink = `${window.location.protocol}//${window.location.hostname}${
    window.location.port ? `:${window.location.port}` : ""
  }/join-guild/${cacheInterface.getInviteId(currentGuildId)}`;

  const inviteTitle = createEl("p", {
    id: "invite-users-title",
    textContent: title
  });
  const channelnamehash = createEl("p", {
    id: "invite-users-channel-name-hash",
    innerHTML: textChanHtml
  });

  const channelNameText = createEl("p", {
    id: "invite-users-channel-name-text",
    textContent: currentChannelName
  });
  const sendInvText = createEl("p", {
    id: "invite-users-send-text",
    textContent: sendText
  });

  const inputContainer = createEl("div", {
    className: "input-container"
  });

  const inviteUsersSendInput = createEl("input", {
    id: "invite-users-send-input",
    value: invitelink,
    readonly: true
  }) as HTMLInputElement;

  const copyButton = createEl("button", {
    className: "copy-button",
    textContent: "Copy"
  });

  copyButton.addEventListener("click", (event: MouseEvent) => {
    inviteUsersSendInput.select();
    inviteUsersSendInput.setSelectionRange(
      0,
      inviteUsersSendInput.value.length
    );

    copyText(event, invitelink);
  });

  inputContainer.appendChild(inviteUsersSendInput);
  inputContainer.appendChild(copyButton);

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "invite-popup-bottom-container"
  });

  popBottomContainer.appendChild(sendInvText);
  popBottomContainer.appendChild(inputContainer);

  const contentElements = [
    inviteTitle,
    channelnamehash,
    channelNameText,
    popBottomContainer
  ];

  createPopUp({
    contentElements,
    id: "inviteUsersPopContainer",
    closeBtnId: "invite-close-button"
  });
}

export function hideGuildSettingsDropdown() {
  isDropdownOpen = false;
}

export function closeDropdown() {
  const guildSettingsDropdown = getId("guild-settings-dropdown");

  if (guildSettingsDropdown && isDropdownOpen) {
    guildSettingsDropdown.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => {
      guildSettingsDropdown.style.display = "none";
      isDropdownOpen = false;
    }, 300);
  }
}

export function toggleDropdown() {
  if (!isOnGuild) {
    return;
  }

  const guildSettingsDropdown = getId("guild-settings-dropdown");

  if (guildSettingsDropdown && !isDropdownOpen) {
    isDropdownOpen = true;
    guildSettingsDropdown.style.display = "flex";
    guildSettingsDropdown.style.animation = "fadeIn 0.3s forwards";
    fillDropDownContent();
  } else {
    closeDropdown();
  }
}
function createPopUpCloseButton(
  popOuterParent: HTMLElement,
  parentContainer: HTMLElement,
  className: string,
  id?: string
) {
  const closeButton = createEl("button", { className });
  if (id) closeButton.id = id;
  closeButton.innerHTML =
    '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z"></path></svg>';
  closeButton.addEventListener("click", function () {
    closePopUp(popOuterParent, parentContainer);
  });
  return closeButton;
}

export function openSearchPop() {}

export async function showGuildPop(inviteId?: string) {
  const subject = translations.getTranslation("create-your-guild");
  const content = translations.getTranslation("create-your-guild-detail");

  const newPopParent = createEl("div", {
    className: "pop-up",
    id: "guild-pop-up"
  });
  const newPopOuterParent = createEl("div", { className: "outer-parent" });
  const guildPopSubject = createEl("h1", {
    className: "guild-pop-up-subject",
    textContent: subject
  });
  const guildPopContent = createEl("p", {
    className: "guild-pop-up-content",
    textContent: content
  });
  const guildPopButtonContainer = createEl("div", {
    className: "guild-pop-button-container"
  });

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container"
  });
  const popOptionButton = createEl("button", {
    id: "popOptionButton",
    className: "guild-pop-up-accept",
    textContent: translations.getTranslation("create-myself")
  });
  const closeCallback = function () {
    closePopUp(newPopOuterParent, newPopParent);
  };

  popOptionButton.addEventListener("click", function () {
    changePopUpToGuildCreation(
      newPopParent,
      guildPopButtonContainer,
      guildPopContent,
      guildPopSubject,
      closeCallback
    );
  });

  const option2Title = createEl("p", {
    className: "guild-pop-up-content",
    id: "guild-popup-option2-title",
    textContent: translations.getTranslation("already-have-invite")
  });
  const popOptionButton2 = createEl("button", {
    id: "popOptionButton2",
    className: "guild-pop-up-accept",
    textContent: translations.getTranslation("join-a-guild")
  });
  popOptionButton2.addEventListener("click", function () {
    ChangePopUpToGuildJoining(
      newPopParent,
      guildPopButtonContainer,
      guildPopContent,
      guildPopSubject,
      closeCallback
    );
  });

  popBottomContainer.appendChild(option2Title);
  popBottomContainer.appendChild(popOptionButton2);

  const closeButton = createPopUpCloseButton(
    newPopOuterParent,
    newPopParent,
    "popup-close"
  );

  newPopParent.appendChild(guildPopSubject);
  newPopParent.appendChild(guildPopContent);
  guildPopButtonContainer.appendChild(popOptionButton);
  guildPopButtonContainer.appendChild(popBottomContainer);
  newPopParent.appendChild(guildPopButtonContainer);
  newPopParent.appendChild(closeButton);

  newPopOuterParent.appendChild(newPopParent);
  newPopOuterParent.style.display = "flex";

  newPopOuterParent.addEventListener("click", function (event: Event) {
    if (event.target === newPopOuterParent) {
      closeCallback();
    }
  });

  if (inviteId) {
    ChangePopUpToGuildJoining(
      newPopParent,
      guildPopButtonContainer,
      guildPopContent,
      guildPopSubject,
      closeCallback,
      inviteId
    );
  }

  document.body.appendChild(newPopOuterParent);
}

async function clickToJoinGuildBackButton(
  event: Event,
  closeCallback: CallableFunction
) {
  closeCallback(event);
  await showGuildPop();
}
function handleImageUpload(
  guildImage: HTMLImageElement | null,
  uploadText: HTMLElement | null,
  clearButton: HTMLElement | null,
  event: Event
) {
  const inputTarget = event.target as HTMLInputElement | null;
  if (inputTarget && inputTarget.files) {
    const file = inputTarget.files[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = function (e) {
        const result = e.target?.result;
        if (typeof result === "string") {
          const svg = document.getElementById("guildImg");

          if (svg) {
            const img = new Image();
            img.src = result;
            img.id = "guildImg";
            svg.replaceWith(img);
          }

          if (guildImage && uploadText && clearButton) {
            guildImage.style.backgroundImage = `url(${result})`;
            guildImage.style.backgroundSize = "cover";
            guildImage.style.backgroundPosition = "center";
            uploadText.style.display = "none";
            clearButton.style.display = "flex";
            guildImage.className = "guildImage";
          } else {
            console.error("One or more elements are missing or null.");
          }
        } else {
          console.error("Error: Loaded file is not a valid image string.");
        }
      };

      reader.readAsDataURL(file);
    }
  }
}

function changePopUpToGuildCreation(
  newPopParent: HTMLElement,
  popButtonContainer: HTMLElement,
  newPopContent: HTMLElement,
  newPopSubject: HTMLElement,
  closeCallback: CallableFunction
) {
  if (popButtonContainer?.parentNode)
    popButtonContainer.parentNode.removeChild(popButtonContainer);

  newPopSubject.textContent = translations.getTranslation("customize-guild");
  newPopContent.textContent = translations.getTranslation(
    "customize-guild-detail"
  );

  const text = translations.generateGuildName(currentUserNick);
  const newInput = createEl("input", { value: text, id: "guild-name-input" });
  const createButton = createEl("button", {
    textContent: translations.getTranslation("create"),
    className: "create-guild-verify common-button"
  });
  const backButton = createEl("button", {
    textContent: translations.getTranslation("back"),
    className: "create-guild-back common-button"
  });

  backButton.addEventListener(
    "click",
    async (event) => await clickToJoinGuildBackButton(event, closeCallback)
  );

  const guildNameTitle = createEl("h1", {
    textContent: translations.getTranslation("guildname"),
    className: "create-guild-title"
  });

  const guildImageForm = createEl("div", {
    id: "guildImageForm",
    accept: "image/*"
  });
  const guildImageInput = createEl("input", {
    type: "file",
    id: "guildImageInput",
    accept: "image/*",
    style: { display: "none" }
  }) as HTMLInputElement;

  const guildImage = createEl("div", {
    id: "guildImg",
    className: "fas fa-camera"
  }) as HTMLImageElement;
  const uploadText = createEl("p", {
    id: "uploadText",
    textContent: translations.getTranslation("upload")
  });
  const clearButton = createEl("button", {
    id: "clearButton",
    textContent: "X",
    style: { display: "none" }
  });

  guildImageForm.append(uploadText, clearButton);

  function triggerGuildInput() {
    guildImageInput.click();
  }
  function clearGuildInput() {
    guildImageInput.value = "";
  }

  function clearImage(event: Event) {
    event.stopPropagation();
    guildImage.style.backgroundImage = "";
    uploadText.style.display = "block";
    clearButton.style.display = "none";
    clearGuildInput();
  }

  guildImage.addEventListener("click", triggerGuildInput);
  let isGuildCreated = false;
  function tryCreateGuild() {
    if (!isGuildCreated) {
      createGuild();
      isGuildCreated = true;
    }
  }
  createButton.addEventListener("click", tryCreateGuild);
  guildImageInput.addEventListener("change", (event) =>
    handleImageUpload(guildImage, uploadText, clearButton, event)
  );
  clearButton.addEventListener("click", clearImage);

  document.body.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("#guildImg")) triggerGuildInput();
  });

  guildImageForm.append(guildImageInput, guildImage);
  newPopParent.style.animation =
    "guild-pop-up-create-guild-animation 0.3s forwards";
  newPopParent.append(
    guildImageForm,
    guildNameTitle,
    newInput,
    createButton,
    backButton
  );
}

function ChangePopUpToGuildJoining(
  newPopParent: HTMLElement,
  popButtonContainer: HTMLElement,
  newPopContent: HTMLElement,
  newPopSubject: HTMLElement,
  closeCallback: CallableFunction,
  inviteId?: string
) {
  if (popButtonContainer) {
    popButtonContainer.remove();
  }

  newPopSubject.textContent = translations.getTranslation("join-a-guild");
  newPopContent.textContent = translations.getTranslation(
    "join-a-guild-detail"
  );
  const text = `${window.location.protocol}//${window.location.hostname}/hTKzmak`;
  const newInput = createEl("input", {
    placeholder: text,
    id: "guild-name-input"
  }) as HTMLInputElement;
  if (inviteId) {
    newInput.value = inviteId;
  }

  const joinButton = createEl("button", {
    textContent: translations.getTranslation("join-guild"),
    className: "create-guild-verify common-button",
    style: {
      fontSize: "14px",
      whiteSpace: "nowrap",
      padding: "0px",
      width: "120px"
    }
  });
  const guildNameTitle = createEl("h1", {
    textContent: translations.getTranslation("invite-link"),
    className: "create-guild-title",
    id: "create-guild-title",
    style: {
      top: "25%"
    }
  });
  joinButton.addEventListener("click", function () {
    if (newInput.value === "") {
      guildNameTitle.textContent = translations.getTranslation(
        "guild-join-invite-title"
      );
      guildNameTitle.style.color = "red";
      setTimeout(() => {
        guildNameTitle.textContent = translations.getTranslation("invite-link");
        guildNameTitle.style.color = "white";
      }, 5000);

      return;
    }
    joinToGuild(newInput.value);
    closeCurrentJoinPop = closeCallback;
  });

  const backButton = createEl("button", {
    textContent: translations.getTranslation("back"),
    className: "create-guild-back common-button"
  });
  backButton.addEventListener("click", async function (event) {
    await clickToJoinGuildBackButton(event, closeCallback);
  });

  const guildNameDescription = createEl("h1", {
    textContent: translations.getTranslation("invites-look-like"),
    className: "create-guild-title"
  });
  const descriptionText = `
    hTKzmak<br>
    ${window.location.protocol}//${window.location.hostname}${
      window.location.port ? `:${window.location.port}` : ""
    }/join-guild/hTKzmak<br>
    ${window.location.protocol}//${window.location.hostname}${
      window.location.port ? `:${window.location.port}` : ""
    }/join-guild/cool-people
    `;
  const guildNameDescriptionContent = createEl("h1", {
    innerHTML: descriptionText,
    className: "create-guild-title"
  });
  guildNameDescriptionContent.style.textAlign = "left";

  guildNameDescriptionContent.style.color = "white";
  guildNameDescriptionContent.style.top = "60%";
  guildNameDescription.style.top = "55%";
  newInput.style.bottom = "50%";
  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container"
  });

  const guildPopButtonContainer = createEl("div", {
    className: "guild-pop-button-container"
  });
  guildPopButtonContainer.appendChild(popBottomContainer);
  newPopParent.appendChild(guildPopButtonContainer);

  newPopParent.style.animation =
    "guild-pop-up-join-guild-animation 0.3s forwards";

  newPopParent.appendChild(guildNameTitle);
  newPopParent.appendChild(guildNameDescription);
  newPopParent.appendChild(guildNameDescriptionContent);
  newPopParent.appendChild(newInput);
  newPopParent.appendChild(joinButton);
  newPopParent.appendChild(backButton);
}

export function closePopUp(outerParent: HTMLElement, popParent: HTMLElement) {
  popParent.style.animation = "pop-up-shrink-animation 0.2s forwards";
  popParent.style.overflow = "hidden";

  setTimeout(() => {
    outerParent.remove();
  }, 200);
}

export function createCropPop(
  inputSrc: string,
  callbackAfterAccept: CallableFunction
) {
  const cropTitle = translations.getTranslation("crop-title");
  const inviteTitle = createEl("p", {
    id: "invite-users-title",
    textContent: cropTitle
  });

  const imageContainer = createEl("div", { id: "image-container" });

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "invite-popup-bottom-container"
  });
  popBottomContainer.style.bottom = "-5%";
  popBottomContainer.style.top = "auto";
  popBottomContainer.style.height = "10%";
  popBottomContainer.style.zIndex = "-1";
  const backButton = createEl("button", {
    textContent: translations.getTranslation("cancel"),
    className: "create-guild-back common-button"
  });
  const appendButton = createEl("button", {
    className: "pop-up-append",
    textContent: translations.getTranslation("append")
  });
  const contentElements = [
    inviteTitle,
    imageContainer,
    backButton,
    appendButton,
    popBottomContainer
  ];

  const parentContainer = createPopUp({
    contentElements,
    id: "cropPopContainer",
    closeBtnId: "invite-close-button"
  });

  appendButton.addEventListener("click", () => {
    croppie
      .result({
        type: "base64",
        format: "jpeg",
        quality: 1,
        size: { width: 430, height: 430 },
        circle: false
      })
      .then(function (base64) {
        callbackAfterAccept(base64);
        parentContainer.remove();
        updateSettingsProfileColor();
      });
  });

  backButton.style.left = "20px";

  backButton.addEventListener("click", () => {
    parentContainer.remove();
  });

  const imageElement = createEl("img") as HTMLImageElement;
  imageElement.src = inputSrc;

  const croppie = new Croppie(imageContainer, {
    viewport: { width: 430, height: 430, type: "circle" },
    boundary: { width: 440, height: 440 },
    showZoomer: true,
    enableExif: true
  });

  croppie.bind({
    url: inputSrc
  });

  const cropPopContainer = getId("cropPopContainer");
  if (cropPopContainer) {
    cropPopContainer.style.setProperty("height", "600px", "important");
    cropPopContainer.style.setProperty("width", "600px", "important");
  }

  const sliderWrap = imageContainer.querySelector(".cr-slider-wrap");
  if (sliderWrap) {
    const slider = sliderWrap.querySelector(".cr-slider") as HTMLElement;
    if (slider) {
      slider.style.transform = "scale(1.5)";
    } else {
      console.error("Slider element not found.");
    }
  } else {
    console.error("Slider wrap element not found.");
  }
}

function setCurrentProfilePopButtonToPending(addFriendBtn: HTMLElement) {
  addFriendBtn.classList.add("profile-add-friend-button-pending");
  addFriendBtn.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      (node as HTMLElement).innerHTML = pendingFriendSvg;
    }
  });
}
