declare var confetti: any;
import {
  blackImage,
  getId,
  loadBooleanCookie,
  randomInRange,
  saveBooleanCookie
} from "./utils.ts";
import {
  enableBorderMovement,
  stopAudioAnalysis,
  sendAudioData
} from "./audio.ts";
import {
  refreshUserProfile,
  updateSelfName,
  uploadImage,
  onEditGuildProfile,
  onEditProfile,
  getProfileImageFile,
  getGuildImageFile,
  getGuildImage,
  clearAvatarInput
} from "./avatar.ts";
import {
  showConfirmationPanel,
  isGuildSettings,
  closeSettings,
  generateConfirmationPanel,
  hideConfirmationPanel,
  isChannelSettings,
  isProfileSettings,
  currentSettingsChannelId
} from "./settingsui.ts";
import { alertUser, hideImagePreviewRequest, handleToggleClick } from "./ui.ts";
import { isDomLoaded } from "./app.ts";
import { permissionManager } from "./guildPermissions.ts";
import { apiClient, EventType } from "./api.ts";
import { currentGuildId } from "./guild.ts";
import { currentUserId, currentUserNick, userManager } from "./user.ts";
import { translations } from "./translations.ts";
import { guildCache } from "./cache.ts";

const isImagePreviewOpen = false;
const CHANGE_NAME_COOLDOWN = 1000;

export const settingTypes = {
  MyAccount: "MyAccount",
  SoundAndVideo: "SoundAndVideo",
  Notifications: "Notifications",
  ActivityPresence: "ActivityPresence",
  Appearance: "Appearance"
};

let changeNicknameTimeout: number;
let changeGuildNameTimeout: number;
let changeChannelNameTimeout: number;
export let isSettingsOpen = false;
export let currentPopUp: HTMLElement | undefined;
export function setIsSettingsOpen(val: boolean) {
  isSettingsOpen = val;
}
export let isUnsaved = false;
export function setUnsaved(val: boolean) {
  isUnsaved = val;
}
export let isChangedImage = false;
export function setIsChangedImage(val: boolean) {
  isChangedImage = val;
}

function clearCookies() {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name] = cookie.split("=");
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

type ToggleState = {
  "notify-toggle": boolean;
  "snow-toggle": boolean;
  "party-toggle": boolean;
  "activity-toggle": boolean;
  "slide-toggle": boolean;
  "private-channel-toggle": boolean;
};

class ToggleManager {
  private static instance: ToggleManager;
  states: ToggleState;

  private constructor() {
    this.states = {
      "notify-toggle": loadBooleanCookie("notify-toggle") ?? false,
      "snow-toggle": loadBooleanCookie("snow-toggle") ?? false,
      "party-toggle": loadBooleanCookie("party-toggle") ?? false,
      "activity-toggle": loadBooleanCookie("activity-toggle") ?? false,
      "slide-toggle": loadBooleanCookie("slide-toggle") ?? false,
      "private-channel-toggle": false
    };

    if (this.states["snow-toggle"]) {
      this.startSnowEffect();
    }
  }

  static getInstance(): ToggleManager {
    if (!ToggleManager.instance) {
      ToggleManager.instance = new ToggleManager();
    }
    return ToggleManager.instance;
  }

  updateState(toggleId: keyof ToggleState, newValue: boolean) {
    this.states[toggleId] = newValue;
    if (toggleId !== "private-channel-toggle") {
      saveBooleanCookie(toggleId, newValue ? 1 : 0);
    }
    this.updateToggleDisplay(toggleId, newValue);
    this.triggerActions(toggleId, newValue);
  }

  setupToggles() {
    Object.keys(this.states).forEach((id) => {
      this.setupToggle(id as keyof ToggleState);
    });
  }

  setupToggle(id: keyof ToggleState) {
    const toggleElement = getId(id);
    if (toggleElement) {
      this.updateToggleDisplay(id, this.states[id]);
      handleToggleClick(toggleElement, () => {
        const newValue = !this.states[id];
        this.updateState(id, newValue);
      });
    }
  }

  updateToggleDisplay(toggleId: keyof ToggleState, newValue: boolean) {
    const toggleElement = getId(toggleId);
    if (toggleElement) {
      const switchElement = toggleElement.querySelector(".toggle-switch");
      if (switchElement) {
        switchElement.classList.toggle("active", newValue);
      }
      toggleElement.classList.toggle("active", newValue);
    }
  }

  triggerActions(toggleId: keyof ToggleState, newValue: boolean) {
    const toggleActions: Record<string, () => void> = {
      "snow-toggle": this.toggleEffect.bind(this, "snow", newValue),
      "party-toggle": this.toggleEffect.bind(this, "party", newValue)
    };
    if (toggleActions[toggleId]) {
      toggleActions[toggleId]();
    }
  }

  toggleEffect(effect: string, enable: boolean) {
    if (effect === "snow") {
      enable ? this.startSnowEffect() : this.stopSnowEffect();
    } else if (effect === "party") {
      enable ? this.startPartyEffect() : this.stopPartyEffect();
    }
  }

  isSlide() {
    return this.states["slide-toggle"];
  }

  startSnowEffect() {
    const particleContainer = getId("confetti-container");
    let skew = 1;

    const frame = () => {
      if (!ToggleManager.getInstance().states["snow-toggle"] || !isDomLoaded)
        return;

      skew = Math.max(0.8, skew - 0.001);

      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: 300,
        origin: {
          x: Math.random(),
          y: Math.random() * skew - 0.2
        },
        colors: ["#ffff"],
        shapes: ["circle"],
        gravity: randomInRange(0.4, 0.6),
        scalar: randomInRange(0.4, 1),
        drift: randomInRange(-0.4, 0.4),
        particleContainer
      });

      if (ToggleManager.getInstance().states["snow-toggle"]) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  }

  stopSnowEffect() {}

  startPartyEffect() {
    enableBorderMovement();
  }

  stopPartyEffect() {
    stopAudioAnalysis();
  }
}
export const toggleManager = ToggleManager.getInstance();

export function initializeCookies() {
  Object.entries(toggleManager.states).forEach(([key, value]) => {
    toggleManager.setupToggle(key as keyof ToggleState);
  });

  console.log("init cookies", toggleManager.states);

  if (toggleManager.states["snow-toggle"])
    toggleManager.toggleEffect("snow", true);
  if (toggleManager.states["party-toggle"])
    toggleManager.toggleEffect("party", true);
}

export function triggerFileInput() {
  const profileImageInput = getProfileImageFile();
  if (profileImageInput) {
    profileImageInput.click();
    profileImageInput.addEventListener("change", onEditProfile);
  }
}

export function triggerGuildImageUpdate() {
  if (!permissionManager.canManageGuild()) return;
  const guildImageInput = getGuildImageFile();
  if (guildImageInput) {
    guildImageInput.click();
    guildImageInput.addEventListener("change", onEditGuildProfile);
  }
}
export function onEditNick() {
  isUnsaved = true;
  regenerateConfirmationPanel();
}
export function onEditChannelName() {
  isUnsaved = true;
  regenerateConfirmationPanel();
}
export function onEditGuildName() {
  isUnsaved = true;
  regenerateConfirmationPanel();
}

export function regenerateConfirmationPanel() {
  if (!currentPopUp) {
    currentPopUp = generateConfirmationPanel();
  }
  if (currentPopUp) {
    showConfirmationPanel(currentPopUp);
  }
}

export function applySettings() {
  if (currentPopUp) {
    hideConfirmationPanel(currentPopUp);
  }
  if (isUnsaved) {
    if (isGuildSettings()) {
      changeGuildName();

      if (permissionManager.canManageGuild()) {
        uploadImage(true);
      }
    } else if (isChannelSettings()) {
      changeChannelName();
    } else if (isProfileSettings()) {
      console.log("Applying profile settings");
      changeNickname();
      uploadImage(false);
    }

    isUnsaved = false;
  }
}

function removeguildImage() {
  apiClient.send(EventType.DELETE_GUILD_IMAGE, { guildId: currentGuildId });
  clearAvatarInput(true);
  const guildImg = getGuildImage();
  if (guildImg) guildImg.src = blackImage;
}

function changeNickname() {
  if (changeNicknameTimeout) return;

  const newNicknameInput = getId("new-nickname-input") as HTMLInputElement;
  const newNickname = newNicknameInput.value.trim();

  if (newNickname && newNickname !== currentUserNick) {
    console.log("Changed your nickname to: " + newNickname);
    refreshUserProfile(currentUserId, newNickname);
    userManager.setUserNick(newNickname);
    const setInfoNick = getId("set-info-nick");
    if (setInfoNick) setInfoNick.innerText = newNickname;
    updateSelfName(newNickname);
    apiClient.send(EventType.CHANGE_NICK, { newNickname });
    newNicknameInput.value = newNickname;

    changeNicknameTimeout = setTimeout(() => {
      changeNicknameTimeout = 0;
    }, CHANGE_NAME_COOLDOWN);
  }
}

function changeGuildName() {
  if (changeGuildNameTimeout) return;
  const newGuildInput = getId("guild-overview-name-input") as HTMLInputElement;
  if (!newGuildInput) {
    console.warn("Guild input does not exist");
    return;
  }
  const newGuildName = newGuildInput.value.trim();
  if (newGuildName && newGuildName !== guildCache.currentGuildName) {
    console.log("Changed guild name to: " + newGuildName);
    apiClient.send(EventType.UPDATE_GUILD_NAME, {
      guildName: newGuildName,
      guildId: currentGuildId
    });
    newGuildInput.value = newGuildName;
    changeGuildNameTimeout = setTimeout(
      () => (changeGuildNameTimeout = 0),
      CHANGE_NAME_COOLDOWN
    );
  }
}
function changeChannelName() {
  if (changeChannelNameTimeout) return;
  const channelNameInput = getId(
    "channel-overview-name-input"
  ) as HTMLInputElement;
  if (!channelNameInput) {
    console.warn("Guild input does not exist");
    return;
  }
  const newChannelName = channelNameInput.value.trim();
  if (newChannelName && newChannelName !== guildCache.currentGuildName) {
    console.log("Changed channel name to: " + newChannelName);
    apiClient.send(EventType.UPDATE_CHANNEL_NAME, {
      channelName: newChannelName,
      guildId: currentGuildId,
      channelId: currentSettingsChannelId
    });
    channelNameInput.value = newChannelName;
    changeChannelNameTimeout = setTimeout(
      () => (changeChannelNameTimeout = 0),
      CHANGE_NAME_COOLDOWN
    );
  }
}

async function requestMicrophonePermissions() {
  try {
    await sendAudioData();
  } catch (error) {
    console.log(error);
    alertUser(
      translations.getTranslation("microphone-failed"),
      translations.getTranslation("microphone-failed-2")
    );
  }
}

function keydownHandler(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    if (isSettingsOpen) {
      closeSettings();
      return;
    }
    if (isImagePreviewOpen) {
      hideImagePreviewRequest(event);
    }
  }
}

document.addEventListener("keydown", keydownHandler);
