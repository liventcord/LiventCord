import { createEl, generateInviteLink, isMobile } from "./utils.ts";
import { createChannel, currentChannelName } from "./channels.ts";
import { translations } from "./translations.ts";
import { createToggle } from "./settingsui.ts";
import { toggleManager } from "./settings.ts";
import { SVG } from "./svgIcons.ts";
import {
  createPopUp,
  closePopUp,
  createPopUpCloseButton,
  toggleButtonState
} from "./popups.ts";
import { copyText } from "./tooltip.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";

// --- Radio button

const radioStates = new WeakMap<HTMLElement, boolean>();

function setRadio(radio: HTMLElement, value: boolean) {
  const inner = radio.querySelector("circle:nth-of-type(2)");
  if (inner) inner.setAttribute("fill", value ? "white" : "none");
  radioStates.set(radio, value);
}

function createRadioBar(): HTMLElement {
  const el = createEl("div", { className: "radio-bar", innerHTML: SVG.radio });
  radioStates.set(el, false);
  return el;
}

// --- Channel type selector

function createChannelTypeEl(isVoice: boolean) {
  const channelData = {
    text: {
      id: "create-channel-text-type",
      icon: SVG.textChannel,
      title: translations.getTranslation("text-channel"),
      description: translations.getTranslation("channel-type-description"),
      brightness: "1.5"
    },
    voice: {
      id: "create-channel-voice-type",
      icon: SVG.voice,
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
  const iconEl = createEl("p", { id: "channel-type-icon", innerHTML: icon });
  const titleEl = createEl("p", {
    id: "channel-type-title",
    textContent: title
  });
  const descEl = createEl("p", {
    id: "channel-type-description",
    textContent: description
  });

  container.appendChild(iconEl);
  container.appendChild(titleEl);
  container.appendChild(descEl);
  container.appendChild(createRadioBar());
  container.style.filter = `brightness(${brightness})`;
  return container;
}

// --- Private channel toggle

function createPrivateChannelToggle(): HTMLElement {
  toggleManager.updateState("private-channel-toggle", false);
  const wrapper = createEl("div", {
    innerHTML: createToggle(
      "private-channel-toggle",
      translations.getTranslation("private-channel-text"),
      translations.getTranslation("private-channel-description")
    )
  });
  wrapper.style.marginTop = "18px";

  const labels = wrapper.querySelectorAll<HTMLElement>("label");
  if (labels[0])
    Object.assign(labels[0].style, { marginTop: "-20px", marginLeft: "30px" });
  if (labels[1])
    Object.assign(labels[1].style, { fontSize: "14px", marginTop: "10px" });

  const toggleBox = wrapper.querySelector<HTMLElement>(
    ".toggle-card .toggle-box"
  );
  if (toggleBox) {
    toggleBox.style.bottom = isMobile ? "50px" : "54px";
    toggleBox.style.right = "20px";
  }
  return wrapper;
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
    innerHTML: SVG.privateChannel,
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
  });
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

  const textChannelContainer = createChannelTypeEl(false);
  const voiceChannelContainer = createChannelTypeEl(true);

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
      setRadio(otherRadio, false);
    }
    if (selectedRadio) {
      setRadio(selectedRadio, true);
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
    if (event.target === newPopOuterParent) {
      closePopUp(newPopOuterParent, newPopParent);
    }
  });
}

export function createInviteUsersPop() {
  const title = translations.getInviteGuildText(guildCache.currentGuildName);
  const sendText = translations.getTranslation("invites-guild-detail");

  const inviteId = cacheInterface.getInviteId(currentGuildId);
  const invitelink = inviteId ? generateInviteLink(inviteId) : "";

  const inviteTitle = createEl("p", {
    id: "invite-users-title",
    textContent: title
  });

  const channelnamehash = createEl("p", {
    id: "invite-users-channel-name-hash",
    innerHTML: SVG.textChannel
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
  });

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
