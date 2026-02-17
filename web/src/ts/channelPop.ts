import { createEl, isMobile } from "./utils.ts";
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
import { textChanHtml } from "./ui.ts";
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

type ChannelTypeConfig = {
  id: string;
  icon: string;
  titleKey: string;
  brightness: string;
};

const CHANNEL_TYPES: Record<"text" | "voice", ChannelTypeConfig> = {
  text: {
    id: "create-channel-text-type",
    icon: SVG.hash,
    titleKey: "text-channel",
    brightness: "1.5"
  },
  voice: {
    id: "create-channel-voice-type",
    icon: SVG.voice,
    titleKey: "voice-channel",
    brightness: "1"
  }
};

function createChannelTypeEl(type: "text" | "voice"): HTMLElement {
  const { id, titleKey, brightness } = CHANNEL_TYPES[type];
  const container = createEl("div", { id });
  const title = document.createElement("p");
  title.textContent = translations.getTranslation(titleKey);
  container.appendChild(title);
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
    Object.assign(labels[0].style, { marginTop: "-10px", marginLeft: "30px" });
  if (labels[1])
    Object.assign(labels[1].style, { fontSize: "14px", marginTop: "10px" });

  const toggleBox = wrapper.querySelector<HTMLElement>(
    ".toggle-card .toggle-box"
  );
  if (toggleBox) {
    toggleBox.style.bottom = isMobile ? "50px" : "40px";
    toggleBox.style.right = "20px";
  }
  return wrapper;
}

export function createChannelsPop(guildId: string) {
  let isTextChannel = true;

  const outerParent = createEl("div", { className: "outer-parent" });
  const popDiv = createEl("div", {
    className: "pop-up",
    id: "createChannelPopContainer"
  });

  const titleEl = document.createElement("p");
  titleEl.id = "create-channel-title";
  titleEl.textContent = translations.getTranslation("channel-dropdown-button");

  const typeEl = document.createElement("p");
  typeEl.id = "create-channel-type";
  typeEl.textContent = translations.getTranslation("create-channel-type");

  const nameEl = document.createElement("p");
  nameEl.id = "create-channel-name";
  nameEl.textContent = translations.getTranslation("channel-name");

  const iconEl = document.createElement("p");
  iconEl.id = "channel-icon";
  iconEl.textContent = "#";

  popDiv.append(titleEl, typeEl, nameEl, iconEl);

  const privateIcon = createEl("div", {
    innerHTML: SVG.privateChannel,
    id: "private-channel-icon"
  });
  const privateChanToggle = createPrivateChannelToggle();

  const input = createEl("input", {
    id: "create-channel-send-input",
    placeholder: translations.getTranslation("new-channel-placeholder")
  }) as HTMLInputElement;

  const acceptBtn = createEl("button", {
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
  const refuseBtn = createEl("button", {
    className: "pop-up-refuse",
    textContent: translations.getTranslation("cancel"),
    style: "top: 93%; left:61%; font-size:14px;"
  });

  input.addEventListener("input", () =>
    toggleButtonState(input.value.trim() !== "", acceptBtn)
  );
  acceptBtn.addEventListener("click", () => {
    const name =
      input.value.trim() ||
      translations.getTranslation("new-channel-placeholder");
    createChannel(
      guildId,
      name,
      isTextChannel,
      toggleManager.states["private-channel-toggle"]
    );
    closePopUp(outerParent, popDiv);
  });
  refuseBtn.addEventListener("click", () => closePopUp(outerParent, popDiv));

  const textType = createChannelTypeEl("text");
  const voiceType = createChannelTypeEl("voice");

  function selectType(selected: HTMLElement, isText: boolean) {
    const other = selected === textType ? voiceType : textType;
    selected.style.filter = "brightness(1.5)";
    other.style.filter = "brightness(1)";
    setRadio(selected.querySelector(".radio-bar") as HTMLElement, true);
    setRadio(other.querySelector(".radio-bar") as HTMLElement, false);
    isTextChannel = isText;
  }

  selectType(textType, true);
  textType.addEventListener("click", () => selectType(textType, true));
  voiceType.addEventListener("click", () => selectType(voiceType, false));

  const closeBtn = createPopUpCloseButton(outerParent, popDiv, "popup-close");

  const bottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "create-channel-popup-bottom-container"
  });
  bottomContainer.appendChild(input);

  popDiv.append(
    privateIcon,
    acceptBtn,
    privateChanToggle,
    closeBtn,
    refuseBtn,
    textType,
    voiceType,
    bottomContainer
  );

  outerParent.style.display = "flex";
  outerParent.appendChild(popDiv);
  document.body.appendChild(outerParent);

  toggleManager.setupToggle("private-channel-toggle");
  outerParent.addEventListener("click", (e) => {
    if (e.target === outerParent) closePopUp(outerParent, popDiv);
  });
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
