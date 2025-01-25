/* global Croppie */
import { guildCache } from "./cache";
import { currentGuildId, createGuild, joinToGuild } from "./guild";
import { getId, getAverageRGB, createEl } from "./utils";
import { friendCache, addFriend } from "./friends";
import { currentChannelName } from "./channels";
import { apiClient, EventType } from "./api";
import { currentUserId, getUserNick, currentUserNick } from "./user";
import { loadDmHome, openDm } from "./app";
import { createBubble } from "./userList";
import { isOnGuild } from "./router";
import { showContextMenu, contextList } from "./contextMenuActions";
import { textChanHtml, fillDropDownContent } from "./ui";
import { setProfilePic } from "./avatar";
import { appendToProfileContextList } from "./contextMenuActions";
import { translations } from "./translations";
import { updateSettingsProfileColor } from "./settingsui";

let isDropdownOpen = false;
export let closeCurrentJoinPop;

//Pop ui
export function createChannelsPop() {
  let isTextChannel = true;
  const newPopOuterParent = createEl("div", { className: "outer-parent" });
  const newPopParent = createEl("div", {
    className: "pop-up",
    id: "createChannelPopContainer",
  });
  const title = translations.getTranslation("createChannelTitle");
  const sendText = translations.getTranslation("sendText");

  const inviteTitle = createEl("p", {
    id: "create-channel-title",
    textContent: title,
  });
  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "create-channel-popup-bottom-container",
  });
  const sendInvText = createEl("p", {
    id: "create-channel-send-text",
    textContent: sendText,
  });
  const closeBtn = createEl("button", {
    className: "popup-close",
    id: "invite-close-button",
    textContent: "X",
  });
  const newChannelPlaceholder = translations.getTranslation(
    "new-channel-placeholder",
  );
  const inviteUsersSendInput = createEl("input", {
    id: "create-channel-send-input",
    placeholder: newChannelPlaceholder,
  });
  inviteUsersSendInput.addEventListener("input", () => {
    const inputValue = inviteUsersSendInput.value.trim();
    toggleButtonState(inputValue !== "");
  });

  const channeltypetitle = createEl("p", {
    id: "create-channel-type",
    textContent: translations.getTranslation("channelTypeTitle"),
  });

  const hashText = `<svg class="icon_b545d5" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class="foreground_b545d5"></path></svg>`;
  const voiceText = `<svg class="icon_b545d5" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z" class="foreground_b545d5"></path><path fill="currentColor" d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z" class="foreground_b545d5"></path></svg>`;
  const channeltypetexticon = createEl("p", {
    id: "channel-type-icon",
    innerHTML: hashText,
  });
  const channeltypevoiceicon = createEl("p", {
    id: "channel-type-icon",
    innerHTML: voiceText,
  });
  const channeltypetexttitle = createEl("p", {
    id: "channel-type-title",
    textContent: translations.getTranslation("textChannelTitle"),
  });
  const channeltypevoicetitle = createEl("p", {
    id: "channel-type-title",
    textContent: translations.getTranslation("voiceChannelTitle"),
  });
  const channeltypedescription = createEl("p", {
    id: "channel-type-description",
    textContent: translations.getTranslation("channel-type-description"),
  });
  const channelTypeVoiceDescription = createEl("p", {
    id: "channel-type-description",
    textContent: translations.getTranslation("channel-type-voice-description"),
  });
  const channelnametitle = createEl("p", {
    id: "create-channel-name",
    textContent: translations.getTranslation("create-channel-name"),
  });
  const channelIcon = createEl("p", { id: "channel-icon", textContent: "#" });

  const textChannelContainer = createEl("div", {
    id: "create-channel-text-type",
  });
  const textChannelTitle = createEl("p", { id: "text-channel-title" });
  const voiceChannelTitle = createEl("p", { id: "voice-channel-title" });
  const voiceChannelContainer = createEl("div", {
    id: "create-channel-voice-type",
  });

  const specialchanHtml = `<svg class="switchIcon_b545d5" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="lightgray" fill-rule="evenodd" d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Zm-1 8a2 2 0 0 1-1 1.73V18a1 1 0 1 1-2 0v-2.27A2 2 0 1 1 14 14Z" clip-rule="evenodd" class=""></path></svg>`;
  const specialChanIcon = createEl("div", {
    innerHTML: specialchanHtml,
    id: "special-channel-icon",
  });
  const specialChanText = createEl("div", {
    id: "special-channel-text",
    textContent: translations.getTranslation("special-channel-text"),
  });
  const specialChanToggle = createEl("toggle", {
    id: "special-channel-toggle",
  });
  textChannelContainer.style.filter = "brightness(1.5)";
  voiceChannelContainer.style.filter = "brightness(1)";

  textChannelContainer.addEventListener("click", function () {
    isTextChannel = true;
    textChannelContainer.style.filter = "brightness(1.5)";
    voiceChannelContainer.style.filter = "brightness(1)";
  });

  voiceChannelContainer.addEventListener("click", function () {
    isTextChannel = false;
    textChannelContainer.style.filter = "brightness(1)";
    voiceChannelContainer.style.filter = "brightness(1.5)";
  });

  const popAcceptButton = createEl("button", {
    className: "pop-up-accept",
    textContent: translations.getTranslation("popAcceptButton"),
    style:
      "height:40px; width: 25%; top:93%; left: 84%; font-size:14px; disabled=1; white-space:nowrap;",
  });

  popAcceptButton.addEventListener("click", function () {
    const inviteUsersSendInput = getId("create-channel-send-input");
    let newchanname = inviteUsersSendInput.value.replace(/^\s+/, "");

    if (!newchanname) {
      newchanname = newChannelPlaceholder;
    }
    const data = {
      channelName: newchanname,
      guildId: currentGuildId,
      isTextChannel: isTextChannel,
    };

    apiClient.send(EventType.CREATE_CHANNEL, data);
    isTextChannel = true;
    closePopUp(newPopOuterParent, newPopParent);
  });
  function toggleButtonState(isActive) {
    if (isActive) {
      popAcceptButton.classList.remove("inactive");
      popAcceptButton.classList.add("active");
    } else {
      popAcceptButton.classList.remove("active");
      popAcceptButton.classList.add("inactive");
    }
  }
  const popRefuseButton = createEl("button", {
    className: "pop-up-refuse",
    textContent: translations.getTranslation("cancel"),
    style: "top: 93%; left:61%; font-size:14px;",
  });
  popRefuseButton.addEventListener("click", function () {
    isTextChannel = true;
    closePopUp(newPopOuterParent, newPopParent);
  });
  newPopParent.appendChild(specialChanIcon);
  newPopParent.appendChild(popAcceptButton);
  newPopParent.appendChild(specialChanText);
  newPopParent.appendChild(specialChanToggle);

  newPopParent.appendChild(popRefuseButton);

  textChannelContainer.appendChild(channeltypetexticon);
  voiceChannelContainer.appendChild(channeltypevoiceicon);

  textChannelContainer.appendChild(channeltypetexttitle);
  textChannelContainer.appendChild(channeltypedescription);
  voiceChannelContainer.appendChild(channeltypevoicetitle);
  voiceChannelContainer.appendChild(channelTypeVoiceDescription);

  newPopParent.appendChild(closeBtn);
  newPopParent.appendChild(inviteTitle);

  newPopParent.appendChild(channeltypetitle);
  newPopParent.appendChild(channelnametitle);
  newPopParent.appendChild(channelIcon);

  const centerWrapper = createEl("div", { id: "center-wrapper" });
  centerWrapper.appendChild(textChannelTitle);
  centerWrapper.appendChild(voiceChannelTitle);
  newPopParent.appendChild(centerWrapper);

  newPopParent.append(textChannelContainer);
  newPopParent.append(voiceChannelContainer);

  popBottomContainer.appendChild(sendInvText);
  popBottomContainer.appendChild(inviteUsersSendInput);
  newPopParent.appendChild(popBottomContainer);
  newPopOuterParent.style.display = "flex";
  closeBtn.addEventListener("click", function () {
    closePopUp(newPopOuterParent, newPopParent);
  });

  newPopOuterParent.addEventListener("click", function (event) {
    if (event.target === newPopOuterParent) {
      closePopUp(newPopOuterParent, newPopParent);
    }
  });

  newPopOuterParent.appendChild(newPopParent);
  document.body.appendChild(newPopOuterParent);
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
    textContent: getUserNick(userId),
  });
  const profileDiscriminator = createEl("p", {
    id: "profile-discriminator",
    textContent: "#" + discriminator,
  });
  profileContainer.appendChild(profileTitle);
  profileContainer.appendChild(profileDiscriminator);
  const aboutTitle = createEl("p", {
    id: "profile-about-title",
    textContent: translations.getTranslation("about"),
  });
  const aboutDescription = createEl("p", {
    id: "profile-about-description",
    textContent: description,
  });
  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-bottom-container",
  });
  popBottomContainer.appendChild(aboutTitle);
  popBottomContainer.appendChild(aboutDescription);
  const popTopContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-top-container",
  });
  const profileOptions = createEl("button", {
    id: userId,
    className: "profile-dots3",
  });
  const profileOptionsText = createEl("p", {
    className: "profile-dots3-text",
    textContent: "⋯",
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
    className: "profile-options-container",
  });

  if (userId !== currentUserId) {
    if (!friendCache.isFriend(userId)) {
      const addFriendBtn = createEl("button", {
        id: "profile-add-friend-button",
      });
      addFriendBtn.innerHTML = ` <div class="icon-container">${createAddFriSVG()}</div> ${translations.getTranslation(
        "open-friends-button",
      )}`;
      function createAddFriSVG() {
        return `
                    <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
                        <path d="M19 14a1 1 0 0 1 1 1v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Z" fill="currentColor"></path>
                        <path d="M16.83 12.93c.26-.27.26-.75-.08-.92A9.5 9.5 0 0 0 12.47 11h-.94A9.53 9.53 0 0 0 2 20.53c0 .81.66 1.47 1.47 1.47h.22c.24 0 .44-.17.5-.4.29-1.12.84-2.17 1.32-2.91.14-.21.43-.1.4.15l-.26 2.61c-.02.3.2.55.5.55h7.64c.12 0 .17-.31.06-.36C12.82 21.14 12 20.22 12 19a3 3 0 0 1 3-3h.5a.5.5 0 0 0 .5-.5V15c0-.8.31-1.53.83-2.07ZM12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="white"></path>
                    </svg>
                `;
      }
      addFriendBtn.addEventListener("click", () => {
        addFriend(userId);
      });
      profileOptionsContainer.appendChild(addFriendBtn);
    }
    const sendMsgBtn = createEl("button", {
      className: "profile-send-msg-button",
    });
    const sendMsgIco = createEl("div", {
      innerHTML: `
            <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z" class=""></path></svg>
        `,
    });

    sendMsgBtn.appendChild(sendMsgIco);

    sendMsgBtn.addEventListener("click", () => {
      loadDmHome();
      openDm(userId);
      const profilePopContainer = getId("profilePopContainer");
      if (profilePopContainer) {
        profilePopContainer.parentNode.remove();
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
    popTopContainer.style.backgroundColor = getAverageRGB(profileImg);
  };

  const contentElements = [
    popTopContainer,
    profileImg,
    profileContainer,
    popBottomContainer,
  ];
  createPopUp({
    contentElements: contentElements,
    id: "profilePopContainer",
  });
  appendToProfileContextList(userData, userId);
}

export function createPopUp({ contentElements, id, closeBtnId = null }) {
  const popOuterParent = createEl("div", { className: "outer-parent" });
  const parentContainer = createEl("div", { className: "pop-up", id: id });
  popOuterParent.style.display = "flex";

  contentElements.forEach((element) => parentContainer.appendChild(element));
  if (closeBtnId) {
    const closeBtn = createEl("button", {
      className: "popup-close",
      id: closeBtnId,
      textContent: "X",
    });
    parentContainer.appendChild(closeBtn);

    closeBtn.addEventListener("click", function () {
      closePopUp(popOuterParent, parentContainer);
    });
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
  }/join-guild/${guildCache.getInviteId(currentGuildId)}`;

  const inviteTitle = createEl("p", {
    id: "invite-users-title",
    textContent: title,
  });
  const channelnamehash = createEl("p", {
    id: "invite-users-channel-name-hash",
    innerHTML: textChanHtml,
  });

  const channelNameText = createEl("p", {
    id: "invite-users-channel-name-text",
    textContent: currentChannelName,
  });
  const sendInvText = createEl("p", {
    id: "invite-users-send-text",
    textContent: sendText,
  });
  const inviteUsersSendInput = createEl("input", {
    id: "invite-users-send-input",
    value: invitelink,
  });

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "invite-popup-bottom-container",
  });
  popBottomContainer.appendChild(sendInvText);
  popBottomContainer.appendChild(inviteUsersSendInput);

  const contentElements = [
    inviteTitle,
    channelnamehash,
    channelNameText,
    popBottomContainer,
  ];

  createPopUp({
    contentElements: contentElements,
    id: "inviteUsersPopContainer",
    closeBtnId: "invite-close-button",
  });
}

export function hideGuildSettingsDropdown() {
  isDropdownOpen = false;
}
export function toggleDropdown() {
  if (!isOnGuild) {
    return;
  }
  let guildSettingsDropdown = getId("guild-settings-dropdown");

  if (!isDropdownOpen) {
    isDropdownOpen = true;
    guildSettingsDropdown.style.display = "flex";
    guildSettingsDropdown.style.animation = "fadeIn 0.3s forwards";
    fillDropDownContent();
  } else {
    guildSettingsDropdown.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => {
      guildSettingsDropdown.style.display = "none";
      isDropdownOpen = false;
    }, 300);
  }
}
export function openSearchPop() {}

export async function showGuildPop() {
  const { createEl } = await import("./utils");
  const subject = translations.getTranslation("create-your-guild");
  const content = translations.getTranslation("create-your-guild-detail");

  const newPopParent = createEl("div", {
    className: "pop-up",
    id: "guild-pop-up",
  });
  const newPopOuterParent = createEl("div", { className: "outer-parent" });
  const guildPopSubject = createEl("h1", {
    className: "guild-pop-up-subject",
    textContent: subject,
  });
  const guildPopContent = createEl("p", {
    className: "guild-pop-up-content",
    textContent: content,
  });
  const guildPopButtonContainer = createEl("div", {
    className: "guild-pop-button-container",
  });

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
  });
  const popOptionButton = createEl("button", {
    id: "popOptionButton",
    className: "guild-pop-up-accept",
    textContent: translations.getTranslation("create-myself"),
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
      closeCallback,
    );
  });

  const option2Title = createEl("p", {
    className: "guild-pop-up-content",
    id: "guild-popup-option2-title",
    textContent: translations.getTranslation("already-have-invite"),
  });
  const popOptionButton2 = createEl("button", {
    id: "popOptionButton2",
    className: "guild-pop-up-accept",
    textContent: translations.getTranslation("join-a-guild"),
  });
  popOptionButton2.addEventListener("click", function () {
    ChangePopUpToGuildJoining(
      newPopParent,
      guildPopButtonContainer,
      guildPopContent,
      guildPopSubject,
      closeCallback,
    );
  });

  popBottomContainer.appendChild(option2Title);
  popBottomContainer.appendChild(popOptionButton2);

  const closeButton = createEl("button", {
    className: "pop-up-accept",
    className: "popup-close",
    textContent: "X",
  });
  closeButton.addEventListener("click", function () {
    closePopUp(newPopOuterParent, newPopParent);
  });

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
      closeCallback();
    }
  });

  document.body.appendChild(newPopOuterParent);
}

export async function clickToJoinGuildBackButton(event, closeCallback) {
  closeCallback(event);
  await showGuildPop();
}

export function changePopUpToGuildCreation(
  newPopParent,
  popButtonContainer,
  newPopContent,
  newPopSubject,
  closeCallback,
) {
  if (popButtonContainer && popButtonContainer.parentNode) {
    popButtonContainer.parentNode.removeChild(popButtonContainer);
  }
  newPopSubject.textContent = translations.getTranslation("customize-guild");
  newPopContent.textContent = translations.getTranslation(
    "customize-guild-detail",
  );

  const text = translations.generateGuildName(currentUserNick);
  const newInput = createEl("input", { value: text, id: "guild-name-input" });
  const createButton = createEl("button", {
    textContent: translations.getTranslation("create"),
    className: "create-guild-verify common-button",
  });
  const backButton = createEl("button", {
    textContent: translations.getTranslation("back"),
    className: "create-guild-back common-button",
  });

  backButton.addEventListener("click", async function (event) {
    await clickToJoinGuildBackButton(event, closeCallback);
  });
  const guildNameTitle = createEl("h1", {
    textContent: translations.getTranslation("guildname"),
    className: "create-guild-title",
  });

  const guildImageForm = createEl("div", {
    id: "guildImageForm",
    accept: "image/*",
  });
  const guildImageInput = createEl("input", {
    type: "file",
    id: "guildImageInput",
    accept: "image/*",
    style: "display: none;",
  });

  const guildImage = createEl("div", {
    id: "guildImg",
    className: "fas fa-camera",
  });
  const uploadText = createEl("p", {
    id: "uploadText",
    textContent: translations.getTranslation("upload"),
  });
  const clearButton = createEl("button", {
    id: "clearButton",
    textContent: "X",
    style: "display: none;",
  });
  guildImage.appendChild(uploadText);
  guildImage.appendChild(clearButton);
  function triggerGuildInput() {
    guildImageInput.click();
  }
  function handleImageUpload(event) {
    console.log(event);
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        guildImage.style.backgroundImage = `url(${e.target.result})`;
        guildImage.style.backgroundSize = "cover";
        guildImage.style.backgroundPosition = "center";
        uploadText.style.display = "none";
        clearButton.style.display = "flex";
        guildImage.className = "guildImage";
      };
      reader.readAsDataURL(file);
    }
  }

  guildImage.addEventListener("click", triggerGuildInput);
  createButton.addEventListener("click", createGuild);

  guildImageInput.addEventListener("change", handleImageUpload);
  clearButton.addEventListener("click", clearImage);

  function clearImage(event) {
    event.stopPropagation();
    guildImage.style.backgroundImage = "";
    uploadText.style.display = "block";
    clearButton.style.display = "none";
    guildImageInput.value = "";
  }

  guildImageForm.appendChild(guildImageInput);
  guildImageForm.appendChild(guildImage);

  newPopParent.style.animation =
    "guild-pop-up-create-guild-animation 0.3s forwards";
  newPopParent.appendChild(guildImageForm);
  newPopParent.appendChild(guildNameTitle);
  newPopParent.appendChild(newInput);
  newPopParent.appendChild(createButton);
  newPopParent.appendChild(backButton);
}
export function ChangePopUpToGuildJoining(
  newPopParent,
  popButtonContainer,
  newPopContent,
  newPopSubject,
  closeCallback,
) {
  if (popButtonContainer) {
    popButtonContainer.remove();
  }

  newPopSubject.textContent = translations.getTranslation("join-a-guild");
  newPopContent.textContent = translations.getTranslation(
    "join-a-guild-detail",
  );
  const text = `${window.location.protocol}//${window.location.hostname}/hTKzmak`;
  const newInput = createEl("input", {
    placeholder: text,
    id: "guild-name-input",
  });

  const joinButton = createEl("button", {
    textContent: translations.getTranslation("join-guild"),
    className: "create-guild-verify common-button",
  });
  joinButton.style.fontSize = "14px";
  joinButton.style.whiteSpace = "nowrap";
  joinButton.style.padding = "0px";
  joinButton.style.width = "120px";

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
    className: "create-guild-back common-button",
  });
  backButton.addEventListener("click", async function (event) {
    await clickToJoinGuildBackButton(event, closeCallback);
  });
  const guildNameTitle = createEl("h1", {
    textContent: translations.getTranslation("invite-link"),
    className: "create-guild-title",
    id: "create-guild-title",
  });
  guildNameTitle.style.top = "25%";
  const guildNameDescription = createEl("h1", {
    textContent: translations.getTranslation("invites-look-like"),
    className: "create-guild-title",
  });
  const descriptionText = `
    hTKzmak<br>
    ${window.location.protocol}//${window.location.hostname}/hTKzmak<br>
    ${window.location.protocol}//${window.location.hostname}/cool-people
    `;
  const guildNameDescriptionContent = createEl("h1", {
    innerHTML: descriptionText,
    className: "create-guild-title",
  });
  guildNameDescriptionContent.style.width = "55%";
  guildNameDescriptionContent.style.textAlign = "left";

  guildNameDescriptionContent.style.color = "white";
  guildNameDescriptionContent.style.top = "60%";
  guildNameDescription.style.top = "55%";
  newInput.style.bottom = "50%";

  const guildImage = createEl("div", {
    id: "guildImg",
    className: "fas fa-camera",
  });
  const uploadText = createEl("p", { id: "uploadText", textContent: "UPLOAD" });
  const clearButton = createEl("button", {
    id: "clearButton",
    textContent: "X",
    style: "display: none;",
  });
  guildImage.appendChild(uploadText);
  guildImage.appendChild(clearButton);

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
  });

  const guildPopButtonContainer = createEl("div", {
    className: "guild-pop-button-container",
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
    textContent: cropTitle,
  });

  const imageContainer = createEl("div", { id: "image-container" });
  const appendButton = createEl("button", {
    className: "pop-up-append",
    textContent: translations.getTranslation("append"),
  });
  let parentContainer;

  appendButton.addEventListener("click", () => {
    croppie
      .result({
        type: "base64",
        format: "jpeg",
        quality: 1,
        size: { width: 430, height: 430 },
        circle: false,
      })
      .then(function (base64) {
        callbackAfterAccept(base64);
        parentContainer.remove();
        updateSettingsProfileColor();
      });
  });

  const backButton = createEl("button", {
    textContent: translations.getTranslation("cancel"),
    className: "create-guild-back common-button",
  });

  backButton.addEventListener("click", () => {
    parentContainer.remove();
  });

  const popBottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "invite-popup-bottom-container",
  });
  popBottomContainer.style.bottom = "-5%";
  popBottomContainer.style.top = "auto";
  popBottomContainer.style.height = "10%";
  popBottomContainer.style.zIndex = "-1";
  backButton.style.left = "20px";

  const contentElements = [
    inviteTitle,
    imageContainer,
    backButton,
    appendButton,
    popBottomContainer,
  ];

  parentContainer = createPopUp({
    contentElements: contentElements,
    id: "cropPopContainer",
    closeBtnId: "invite-close-button",
  });

  const imageElement = createEl("img");
  imageElement.src = inputSrc;

  const croppie = new Croppie(imageContainer, {
    viewport: { width: 430, height: 430, type: "circle" },
    boundary: { width: 440, height: 440 },
    showZoomer: true,
    enableExif: true,
  });

  croppie.bind({
    url: inputSrc,
  });

  getId("cropPopContainer").style.setProperty("height", "600px", "important");
  getId("cropPopContainer").style.setProperty("width", "600px", "important");

  imageContainer
    .querySelector(".cr-slider-wrap")
    .querySelector(".cr-slider").style.transform = "scale(1.5);";
}
