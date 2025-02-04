import Croppie from "croppie";
import "croppie/croppie.css";

import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId, createGuild, joinToGuild } from "./guild.ts";
import { getId, getAverageRGB, createEl } from "./utils.ts";
import { friendsCache, addFriend } from "./friends.ts";
import { createChannel, currentChannelName } from "./channels.ts";
import { currentUserId, getUserNick, currentUserNick } from "./user.ts";
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

let isDropdownOpen = false;
export let closeCurrentJoinPop;
const hashText =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class="foreground_b545d5"></path></svg>';
const voiceText =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z" class="foreground_b545d5"></path><path fill="currentColor" d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z" class="foreground_b545d5"></path></svg>';
const addFriSvg = `
<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
    <path d="M19 14a1 1 0 0 1 1 1v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Z" fill="currentColor"></path>
    <path d="M16.83 12.93c.26-.27.26-.75-.08-.92A9.5 9.5 0 0 0 12.47 11h-.94A9.53 9.53 0 0 0 2 20.53c0 .81.66 1.47 1.47 1.47h.22c.24 0 .44-.17.5-.4.29-1.12.84-2.17 1.32-2.91.14-.21.43-.1.4.15l-.26 2.61c-.02.3.2.55.5.55h7.64c.12 0 .17-.31.06-.36C12.82 21.14 12 20.22 12 19a3 3 0 0 1 3-3h.5a.5.5 0 0 0 .5-.5V15c0-.8.31-1.53.83-2.07ZM12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="white"></path>
</svg>
`;
const sendMsgIconSvg = `
            <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z" class=""></path></svg>
        `;
const radioStates = {};

function toggleRadio(radio, newValue) {
  const innerCircle = radio.querySelectorAll("circle")[1];
  innerCircle.setAttribute("fill", newValue ? "white" : "none");
  radioStates[radio] = newValue;
}

function createRadioBar() {
  const radioSvg = `<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2"></circle>
    <circle cx="12" cy="12" r="6" fill="none" stroke="none"></circle>
  </svg>`;
  const radioBar = createEl("div", {
    className: "radio-bar",
    innerHTML: radioSvg
  });
  radioStates[radioBar] = false;
  return radioBar;
}

const privateChannelHTML =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="lightgray" fill-rule="evenodd" d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Zm-1 8a2 2 0 0 1-1 1.73V18a1 1 0 1 1-2 0v-2.27A2 2 0 1 1 14 14Z" clip-rule="evenodd" class=""></path></svg>';
function createPrivateChannelToggle() {
  toggleManager.updateState("private-channel-toggle", 0);
  const toggleHtml = createToggle(
    "private-channel-toggle",
    translations.getTranslation("private-channel-text"),
    translations.getTranslation("private-channel-description")
  );
  const toggleElement = createEl("div", { innerHTML: toggleHtml });
  toggleElement.style.marginTop = "50px";
  const label1 = toggleElement.querySelectorAll("label")[0];
  label1.style.marginTop = "-10px";
  label1.style.marginLeft = "30px";
  const label2 = toggleElement.querySelectorAll("label")[1];
  label2.style.fontSize = "14px";
  label2.style.marginTop = "10px";
  const toggleBox = toggleElement
    .querySelector(".toggle-card")
    .querySelector(".toggle-box");
  toggleBox.style.bottom = "40px";
  toggleBox.style.right = "20px";

  return toggleElement;
}
function createChannelType(isVoice) {
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

export function createChannelsPop() {
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
    style:
      "height:40px; width: 25%; top:93%; left: 84%; font-size:14px; disabled=1; white-space:nowrap;"
  });

  const inviteUsersSendInput = createEl("input", {
    id: "create-channel-send-input",
    placeholder: translations.getTranslation("new-channel-placeholder")
  });
  inviteUsersSendInput.addEventListener("input", () =>
    toggleButtonState(inviteUsersSendInput.value.trim() !== "", popAcceptButton)
  );

  popAcceptButton.addEventListener("click", () => {
    const channelName =
      inviteUsersSendInput.value.trim() ||
      translations.getTranslation("new-channel-placeholder");
    createChannel(
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

  function updateChannelState(selectedContainer, isText) {
    const otherContainer =
      selectedContainer === textChannelContainer
        ? voiceChannelContainer
        : textChannelContainer;
    selectedContainer.style.filter = "brightness(1.5)";
    otherContainer.style.filter = "brightness(1)";
    toggleRadio(selectedContainer.querySelector(".radio-bar"), true);
    toggleRadio(otherContainer.querySelector(".radio-bar"), false);
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

function toggleButtonState(isActive, popAcceptButton) {
  if (isActive) {
    popAcceptButton.classList.remove("inactive");
    popAcceptButton.classList.add("active");
  } else {
    popAcceptButton.classList.remove("active");
    popAcceptButton.classList.add("inactive");
  }
}

export function drawProfilePop(userData) {
  if (!userData) {
    console.error("Null user data requested profile draw", userData);
    return;
  }
  const profileContainer = createEl("div", { id: "profile-container" });

  const discriminator = userData.discriminator;
  const userId = userData.userId;
  const isOnline = userData.isOnline;
  const description = userData.description;

  const profileTitle = createEl("p", {
    id: "profile-title",
    textContent: getUserNick(userId)
  });
  const profileDiscriminator = createEl("p", {
    id: "profile-discriminator",
    textContent: "#" + discriminator
  });
  profileContainer.appendChild(profileTitle);
  profileContainer.appendChild(profileDiscriminator);
  const aboutTitle = createEl("p", {
    id: "profile-about-title",
    textContent: translations.getTranslation("about")
  });
  const aboutDescription = createEl("p", {
    id: "profile-about-description",
    textContent: description
  });
  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-bottom-container"
  });
  popBottomContainer.appendChild(aboutTitle);
  popBottomContainer.appendChild(aboutDescription);
  const popTopContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-top-container"
  });
  const profileOptions = createEl("button", {
    id: userId,
    className: "profile-dots3"
  });
  const profileOptionsText = createEl("p", {
    className: "profile-dots3-text",
    textContent: "⋯"
  });
  profileOptions.appendChild(profileOptionsText);
  popTopContainer.appendChild(profileOptions);
  const profileImg = createEl("img", { id: "profile-display" });
  profileImg.addEventListener("mouseover", function () {
    this.style.borderRadius = "0px";
  });
  profileImg.addEventListener("mouseout", function () {
    this.style.borderRadius = "50%";
  });

  const profileOptionsContainer = createEl("div", {
    className: "profile-options-container"
  });

  if (userId !== currentUserId) {
    if (!friendsCache.isFriend(userId)) {
      const addFriendBtn = createEl("button", {
        id: "profile-add-friend-button"
      });
      addFriendBtn.innerHTML = ` <div class="icon-container">${addFriSvg}</div> ${translations.getTranslation(
        "open-friends-button"
      )}`;

      addFriendBtn.addEventListener("click", () => {
        addFriend(userId);
      });
      profileOptionsContainer.appendChild(addFriendBtn);
    }
    const sendMsgBtn = createEl("button", {
      className: "profile-send-msg-button"
    });
    const sendMsgIco = createEl("div", {
      innerHTML: sendMsgIconSvg
    });

    sendMsgBtn.appendChild(sendMsgIco);

    sendMsgBtn.addEventListener("click", () => {
      loadDmHome();
      openDm(userId);
      const profilePopContainer = getId("profilePopContainer");
      if (profilePopContainer) {
        (profilePopContainer.parentNode as HTMLElement).remove();
      }
    });
    profileOptionsContainer.appendChild(sendMsgBtn);
  }

  profileContainer.appendChild(profileOptionsContainer);
  setProfilePic(profileImg, userId);

  const bubble = createBubble(isOnline, true);
  profileImg.appendChild(bubble);

  profileOptions.addEventListener("click", function (event) {
    showContextMenu(event.pageX, event.pageY, contextList[userId]);
  });
  profileImg.onload = function () {
    console.log(getAverageRGB(profileImg));
    popTopContainer.style.backgroundColor = getAverageRGB(profileImg);
  };

  const contentElements = [
    popTopContainer,
    profileImg,
    profileContainer,
    popBottomContainer
  ];
  createPopUp({
    contentElements,
    id: "profilePopContainer"
  });
  appendToProfileContextList(userData, userId);
}

export function createPopUp({
  contentElements = [],
  id,
  closeBtnId = null
}: {
  contentElements?: HTMLElement[];
  id: string;
  closeBtnId?: string | null;
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
export function createInviteUsersPop() {
  const title = translations.getInviteGuildText(guildCache.currentGuildName);
  const sendText = translations.getTranslation("invites-guild-detail");
  const invitelink = `${window.location.protocol}//${
    window.location.hostname
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
  const inviteUsersSendInput = createEl("input", {
    id: "invite-users-send-input",
    value: invitelink
  });

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "invite-popup-bottom-container"
  });
  popBottomContainer.appendChild(sendInvText);
  popBottomContainer.appendChild(inviteUsersSendInput);

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

  if (!isDropdownOpen) {
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

export async function showGuildPop() {
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
  const closeCallback = function (event) {
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

  newPopOuterParent.addEventListener("click", function () {
    if (event.target === newPopOuterParent) {
      closeCallback(event);
    }
  });

  document.body.appendChild(newPopOuterParent);
}

async function clickToJoinGuildBackButton(event, closeCallback) {
  closeCallback(event);
  await showGuildPop();
}
function handleImageUpload(guildImage, uploadText, clearButton, event) {
  console.log(event);
  const file = event.target.files[0];

  if (file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const result = e.target.result;
      if (typeof result === "string") {
        const svg = getId("guildImg");
        if (svg) {
          const img = new Image();
          img.src = result;
          img.id = "guildImg";
          svg.replaceWith(img);
        }

        guildImage.style.backgroundImage = `url(${result})`;
        guildImage.style.backgroundSize = "cover";
        guildImage.style.backgroundPosition = "center";
        uploadText.style.display = "none";
        clearButton.style.display = "flex";
        guildImage.className = "guildImage";
      } else {
        console.error("Error: Loaded file is not a valid image string.");
      }
    };

    reader.readAsDataURL(file);
  }
}

function changePopUpToGuildCreation(
  newPopParent,
  popButtonContainer,
  newPopContent,
  newPopSubject,
  closeCallback
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
    style: "display: none;"
  });

  const guildImage = createEl("div", {
    id: "guildImg",
    className: "fas fa-camera"
  });
  const uploadText = createEl("p", {
    id: "uploadText",
    textContent: translations.getTranslation("upload")
  });
  const clearButton = createEl("button", {
    id: "clearButton",
    textContent: "X",
    style: "display: none;"
  });

  guildImageForm.append(uploadText, clearButton);

  function triggerGuildInput() {
    guildImageInput.click();
  }

  function clearImage(event) {
    event.stopPropagation();
    guildImage.style.backgroundImage = "";
    uploadText.style.display = "block";
    clearButton.style.display = "none";
    guildImageInput.value = "";
  }

  guildImage.addEventListener("click", triggerGuildInput);
  createButton.addEventListener("click", createGuild);
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

export function ChangePopUpToGuildJoining(
  newPopParent,
  popButtonContainer,
  newPopContent,
  newPopSubject,
  closeCallback
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
  });

  const joinButton = createEl("button", {
    textContent: translations.getTranslation("join-guild"),
    className: "create-guild-verify common-button"
  });
  joinButton.style.fontSize = "14px";
  joinButton.style.whiteSpace = "nowrap";
  joinButton.style.padding = "0px";
  joinButton.style.width = "120px";
  const guildNameTitle = createEl("h1", {
    textContent: translations.getTranslation("invite-link"),
    className: "create-guild-title",
    id: "create-guild-title"
  });
  joinButton.addEventListener("click", function () {
    if (newInput.value === "") {
      guildNameTitle.textContent = "guild-join-invite-title";
      guildNameTitle.textAlign = "left";
      guildNameTitle.style.color = "red";
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

  guildNameTitle.style.top = "25%";
  const guildNameDescription = createEl("h1", {
    textContent: translations.getTranslation("invites-look-like"),
    className: "create-guild-title"
  });
  const descriptionText = `
    hTKzmak<br>
    ${window.location.protocol}//${window.location.hostname}/hTKzmak<br>
    ${window.location.protocol}//${window.location.hostname}/cool-people
    `;
  const guildNameDescriptionContent = createEl("h1", {
    innerHTML: descriptionText,
    className: "create-guild-title"
  });
  guildNameDescriptionContent.style.width = "55%";
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

export function closePopUp(outerParent, popParent) {
  popParent.style.animation = "pop-up-shrink-animation 0.2s forwards";
  popParent.style.overflow = "hidden";

  setTimeout(() => {
    outerParent.remove();
  }, 200);
}

export function createCropPop(inputSrc, callbackAfterAccept) {
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

  const imageElement = createEl("img");
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

  getId("cropPopContainer").style.setProperty("height", "600px", "important");
  getId("cropPopContainer").style.setProperty("width", "600px", "important");

  imageContainer
    .querySelector(".cr-slider-wrap")
    .querySelector(".cr-slider").style.transform = "scale(1.5);";
}
