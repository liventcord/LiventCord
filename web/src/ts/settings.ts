import confettiImport from "canvas-confetti";
import { appState } from "./appState.ts";

import {
  blackImage,
  getId,
  loadBooleanCookie,
  onDoc,
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
  onEditGuildProfile,
  onEditProfile,
  getProfileImageFile,
  getGuildImageFile,
  getGuildImage,
  clearAvatarInput,
  uploadImageGuildOrProfile
} from "./avatar.ts";
import {
  showConfirmationPanel,
  isGuildSettings,
  closeSettings,
  generateConfirmationPanel,
  hideConfirmationPanel,
  isChannelSettings,
  isProfileSettings,
  selectTheme,
  Themes
} from "./settingsui.ts";
import { alertUser, hideImagePreviewRequest, handleToggleClick } from "./ui.ts";
import { isDomLoaded } from "./app.ts";
import { permissionManager } from "./guildPermissions.ts";
import { apiClient, EventType } from "./api.ts";
import { currentGuildId } from "./guild.ts";
import { userManager } from "./user.ts";
import { translations } from "./translations.ts";
import { guildCache } from "./cache.ts";
import { disableBgVideo, createBGVideo } from "./extras.ts";
import {
  updateAutoGain,
  updateEchoCancellation,
  updateNoiseSuppression
} from "./chatroom.ts";

const confetti = confettiImport as unknown as (options: any) => void;

const isImagePreviewOpen = false;
const CHANGE_NAME_COOLDOWN = 1000;

let changeNicknameTimeout: ReturnType<typeof setTimeout> | null = null;
let changeGuildNameTimeout: ReturnType<typeof setTimeout> | null = null;
let changeChannelNameTimeout: ReturnType<typeof setTimeout> | null = null;
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

export function saveTransparencyValue(value: string): void {
  localStorage.setItem("transparencySliderValue", value);
}
export function readTransparencyValue(): string | null {
  return localStorage.getItem("transparencySliderValue");
}

type ToggleState = {
  "notify-toggle": boolean;
  "snow-toggle": boolean;
  "party-toggle": boolean;
  "activity-toggle": boolean;
  "slide-toggle": boolean;
  "video-toggle": boolean;
  "private-channel-toggle": boolean;
  "developer-toggle": boolean;
  "noise-suppression-toggle": boolean;
  "echo-cancellation-toggle": boolean;
  "auto-gain-toggle": boolean;
};
const bgVideoKey = "videoUrl";
export function saveBgVideo(url: string) {
  localStorage.setItem(bgVideoKey, url);
}
export const defaultVideoUrl =
  "https://cdn.fastly.steamstatic.com/steamcommunity/public/images/items/1406990/915b1b4a05133186525a956d7ca5c142a3c3c9f3.webm";

export function loadBgVideo() {
  const result = localStorage.getItem(bgVideoKey) ?? defaultVideoUrl;
  return result;
}
class ToggleManager {
  private static instance: ToggleManager;
  states: ToggleState;

  private constructor() {
    const toggleKeys: (keyof ToggleState)[] = [
      "notify-toggle",
      "snow-toggle",
      "party-toggle",
      "activity-toggle",
      "slide-toggle",
      "video-toggle",
      "developer-toggle",
      "noise-suppression-toggle",
      "echo-cancellation-toggle",
      "auto-gain-toggle"
    ];

    this.states = {} as ToggleState;
    for (const key of toggleKeys) {
      this.states[key] = loadBooleanCookie(key) ?? false;
    }
    this.states["private-channel-toggle"] = false;

    if (this.states["snow-toggle"]) this.startSnowEffect();

    if (this.states["video-toggle"]) {
      const savedValue = readTransparencyValue();
      setTimeout(() => createBGVideo(savedValue), 0);
    }
  }

  static getInstance(): ToggleManager {
    if (!ToggleManager.instance) {
      ToggleManager.instance = new ToggleManager();
    }
    return ToggleManager.instance;
  }

  updateState(
    toggleId: keyof ToggleState,
    newValue: boolean,
    disabled: boolean = false
  ) {
    console.log("updateState called with:", { toggleId, newValue, disabled });

    if (!disabled) {
      this.states[toggleId] = newValue;
      console.log(`State updated: ${toggleId} = ${newValue}`);

      if (toggleId !== "private-channel-toggle") {
        saveBooleanCookie(toggleId, newValue ? 1 : 0);
        console.log(`Cookie saved: ${toggleId} = ${newValue ? 1 : 0}`);
      }

      this.triggerActions(toggleId, newValue);
      console.log(`Actions triggered for: ${toggleId}`);
    } else {
      this.states[toggleId] = false;
      console.log(`Toggle is disabled. State forced to false for: ${toggleId}`);

      if (toggleId !== "private-channel-toggle") {
        saveBooleanCookie(toggleId, 0);
        console.log(`Cookie saved with 0 for disabled toggle: ${toggleId}`);
      }
    }

    this.updateToggleDisplay(toggleId, this.states[toggleId], disabled);
    console.log(
      `Toggle display updated for: ${toggleId} with value: ${this.states[toggleId]}, disabled: ${disabled}`
    );
  }

  setupToggles() {
    Object.keys(this.states).forEach((id) => {
      this.setupToggle(id as keyof ToggleState);
    });
  }

  setupToggle(id: keyof ToggleState) {
    const toggleElement = getId(id);
    if (toggleElement) {
      const isDisabled =
        toggleElement.hasAttribute("disabled") ||
        toggleElement.classList.contains("disabled");

      if (isDisabled) {
        this.updateState(id, false, true);
      } else {
        this.updateToggleDisplay(id, this.states[id], isDisabled);
      }

      handleToggleClick(toggleElement, () => {
        const isCurrentlyDisabled =
          toggleElement.hasAttribute("disabled") ||
          toggleElement.classList.contains("disabled");

        if (!isCurrentlyDisabled) {
          const newValue = !this.states[id];
          this.updateState(id, newValue, false);
        }
      });

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.attributeName === "disabled" ||
            (mutation.attributeName === "class" &&
              toggleElement.classList.contains("disabled"))
          ) {
            const isNowDisabled =
              toggleElement.hasAttribute("disabled") ||
              toggleElement.classList.contains("disabled");
            if (isNowDisabled) {
              this.updateState(id, false, true);
            }
          }
        });
      });

      observer.observe(toggleElement, { attributes: true });
    }
  }

  updateToggleDisplay(
    toggleId: keyof ToggleState,
    newValue: boolean,
    disabled: boolean = false
  ) {
    const toggleElement = getId(toggleId);
    if (toggleElement) {
      const switchElement = toggleElement.querySelector(".toggle-switch");

      if (switchElement) {
        if (disabled) {
          switchElement.classList.remove("active");
        } else {
          switchElement.classList.toggle("active", newValue);
        }
      }

      if (disabled) {
        toggleElement.classList.remove("active");
      } else {
        toggleElement.classList.toggle("active", newValue);
      }
    }
  }

  triggerActions(toggleId: keyof ToggleState, newValue: boolean) {
    const effectsMap: Record<string, (enable: boolean) => void> = {
      "snow-toggle": (enable) =>
        enable ? this.startSnowEffect() : this.stopSnowEffect(),
      "party-toggle": (enable) =>
        enable ? this.startPartyEffect() : this.stopPartyEffect(),
      "video-toggle": (enable) => (enable ? createBGVideo() : disableBgVideo()),
      "noise-suppression-toggle": (enable) => updateNoiseSuppression(enable),
      "echo-cancellation-toggle": (enable) => updateEchoCancellation(enable),
      "auto-gain-toggle": (enable) => updateAutoGain(enable)
    };

    const action = effectsMap[toggleId];
    if (action) action(newValue);
  }

  isSlide() {
    return this.states["slide-toggle"];
  }

  startSnowEffect() {
    const particleContainer = getId("confetti-container");
    let skew = 1;

    const frame = () => {
      if (!ToggleManager.getInstance().states["snow-toggle"] || !isDomLoaded) {
        return;
      }

      skew = Math.max(0.8, skew - 0.001);
      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: 300,
        origin: { x: Math.random(), y: Math.random() * skew - 0.2 },
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
const themeCookieKey = "is-dark-theme";
export function initializeCookies() {
  Object.entries(toggleManager.states).forEach(([key, value]) => {
    toggleManager.setupToggle(key as keyof ToggleState);
  });

  if (toggleManager.states["snow-toggle"]) {
    toggleManager.triggerActions("snow-toggle", true);
  }

  if (toggleManager.states["party-toggle"]) {
    toggleManager.triggerActions("party-toggle", true);
  }

  const black = isBlackTheme();
  selectTheme(black ? Themes.Dark : Themes.Ash);
}

export function saveThemeCookie(val: boolean) {
  return saveBooleanCookie(themeCookieKey, val ? 1 : 0);
}
export function isBlackTheme() {
  return loadBooleanCookie(themeCookieKey);
}
export const isDeveloperMode = () => toggleManager.states["developer-toggle"];
export const useNoiseSuppression = () =>
  toggleManager.states["noise-suppression-toggle"];
export const useEchoCancellation = () =>
  toggleManager.states["echo-cancellation-toggle"];
export const useAutoGain = () => toggleManager.states["auto-gain-toggle"];

export function triggerFileInput() {
  const profileImageInput = getProfileImageFile();
  if (profileImageInput) {
    profileImageInput.click();
    profileImageInput.addEventListener("change", onEditProfile);
  }
}

export function triggerGuildImageUpdate() {
  if (!permissionManager.canManageGuild()) {
    return;
  }
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
        uploadImageGuildOrProfile(true);
      }
    } else if (isChannelSettings()) {
      changeChannelName();
    } else if (isProfileSettings()) {
      console.log("Applying profile settings");
      changeNickname();
      uploadImageGuildOrProfile(false);
    }

    isUnsaved = false;
  }
}

function removeguildImage() {
  apiClient.send(EventType.DELETE_GUILD_IMAGE, { guildId: currentGuildId });
  clearAvatarInput(true);
  const guildImg = getGuildImage();
  if (guildImg) {
    guildImg.src = blackImage;
  }
}

function changeNickname() {
  if (changeNicknameTimeout || !appState.currentUserId) {
    return;
  }

  const newNicknameInput = getId("new-nickname-input") as HTMLInputElement;
  const newNickname = newNicknameInput.value.trim();

  if (newNickname && newNickname !== appState.currentUserNick) {
    console.log("Changed your nickname to: " + newNickname);
    refreshUserProfile(appState.currentUserId, newNickname);
    userManager.setUserNick(newNickname);
    const setInfoNick = getId("set-info-nick");
    if (setInfoNick) {
      setInfoNick.innerText = newNickname;
    }
    updateSelfName(newNickname);
    apiClient.send(EventType.CHANGE_NICK, { newNickname });

    changeNicknameTimeout = setTimeout(() => {
      changeNicknameTimeout = null;
    }, CHANGE_NAME_COOLDOWN);
  }
}

function changeGuildName() {
  if (changeGuildNameTimeout) {
    return;
  }
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
      () => (changeGuildNameTimeout = null),
      CHANGE_NAME_COOLDOWN
    );
  }
}
function changeChannelName() {
  if (changeChannelNameTimeout) {
    return;
  }
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
      channelId: guildCache.currentChannelId
    });
    channelNameInput.value = newChannelName;
    changeChannelNameTimeout = setTimeout(
      () => (changeChannelNameTimeout = null),
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

onDoc("keydown", keydownHandler);
