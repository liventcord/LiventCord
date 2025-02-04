declare var confetti: any;
import { blackImage, getId } from "./utils.ts";
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
  getGuildImage
} from "./avatar.ts";
import {
  showConfirmationPanel,
  isGuildSettings,
  closeSettings,
  generateConfirmationPanel,
  hideConfirmationPanel
} from "./settingsui.ts";
import { alertUser, hideImagePreviewRequest, handleToggleClick } from "./ui.ts";
import { isDomLoaded } from "./app.ts";
import { permissionManager } from "./guildPermissions.ts";
import { apiClient, EventType } from "./api.ts";
import { currentGuildId } from "./guild.ts";
import { currentUserId, currentUserNick, setUserNick } from "./user.ts";
import { translations } from "./translations.ts";
import { guildCache } from "./cache.ts";

const isImagePreviewOpen = false;
const CHANGE_NICK_COOLDOWN = 1000;

export const settingTypes = {
  MyAccount: "MyAccount",
  SoundAndVideo: "SoundAndVideo",
  Notifications: "Notifications",
  ActivityPresence: "ActivityPresence",
  Appearance: "Appearance"
};

let changeNicknameTimeout, changeGuildNameTimeout;
export let isSettingsOpen = false;
export let currentPopUp = null;
export function setIsSettingsOpen(val) {
  isSettingsOpen = val;
}
export let isUnsaved = false;
export function setUnsaved(val) {
  isUnsaved = val;
}
export let isChangedImage = false;
export function setIsChangedImage(val) {
  isChangedImage = val;
}

export function clearCookies() {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name] = cookie.split("=");
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

export function saveBooleanCookie(name, value) {
  value = value ? 1 : 0;
  const expires = new Date();
  expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
  const expiresStr = `expires=${expires.toUTCString()}`;
  const cookieValue = encodeURIComponent(value);
  document.cookie = `${encodeURIComponent(
    name
  )}=${cookieValue}; ${expiresStr}; path=/`;
}

export function loadBooleanCookie(name) {
  const cookieName = encodeURIComponent(name) + "=";
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith(cookieName)) {
      const result = decodeURIComponent(cookie.substring(cookieName.length));
      return result === "1";
    }
  }
  return false;
}

export const toggleManager = {
  states: {
    "notify-toggle": loadBooleanCookie("notify-toggle") ?? false,
    "snow-toggle": loadBooleanCookie("snow-toggle") ?? false,
    "party-toggle": loadBooleanCookie("party-toggle") ?? false,
    "activity-toggle": loadBooleanCookie("activity-toggle") ?? false,
    "slide-toggle": loadBooleanCookie("slide-toggle") ?? false,
    "private-channel-toggle": false
  },
  updateState(toggleId, newValue) {
    this.states[toggleId] = newValue;
    if (toggleId !== "private-channel-toggle") {
      saveBooleanCookie(toggleId, newValue);
    }
    this.updateToggleDisplay(toggleId, newValue);
    this.triggerActions(toggleId, newValue);
  },
  setupToggles() {
    Object.keys(this.states).forEach((id) => {
      this.setupToggle(id);
    });
  },
  setupToggle(id) {
    const toggleElement = getId(id);
    if (toggleElement) {
      this.updateToggleDisplay(id, this.states[id]);
      handleToggleClick(toggleElement, () => {
        const newValue = !this.states[id];
        this.updateState(id, newValue);
      });
    }
  },
  updateToggleDisplay(toggleId, newValue) {
    const toggleElement = getId(toggleId);
    if (toggleElement) {
      toggleElement
        .querySelector(".toggle-switch")
        .classList.toggle("active", newValue);
      toggleElement.classList.toggle("active", newValue);
    }
  },
  triggerActions(toggleId, newValue) {
    const toggleActions = {
      "snow-toggle": this.toggleEffect.bind(this, "snow", newValue),
      "party-toggle": this.toggleEffect.bind(this, "party", newValue)
    };
    if (toggleActions[toggleId]) {
      toggleActions[toggleId]();
    }
  },
  toggleEffect(effect, enable) {
    if (effect === "snow") {
      enable ? this.startSnowEffect() : this.stopSnowEffect();
    } else if (effect === "party") {
      enable ? this.startPartyEffect() : this.stopPartyEffect();
    }
  },
  isSlide() {
    return this.states["slide-toggle"];
  },
  startSnowEffect() {
    const particeContainer = getId("confetti-container");
    let skew = 1;

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    (function frame() {
      if (!toggleManager.states["snow-toggle"] || !isDomLoaded) return;

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
        particleContainer: particeContainer
      });

      requestAnimationFrame(frame);
    })();
  },
  stopSnowEffect() {},
  startPartyEffect() {
    enableBorderMovement();
  },
  stopPartyEffect() {
    stopAudioAnalysis();
  }
};

export function initializeCookies() {
  Object.entries(toggleManager.states).forEach(([key, value]) => {
    toggleManager.setupToggle(key);
  });

  console.log("init cookies", toggleManager.states);

  if (toggleManager.states["snow-toggle"])
    toggleManager.toggleEffect("snow", true);
  if (toggleManager.states["party-toggle"])
    toggleManager.toggleEffect("party", true);
}

export function triggerFileInput() {
  const profileImageInput = getProfileImageFile();
  profileImageInput.click();
  profileImageInput.addEventListener("change", onEditProfile);
}

export function triggerGuildImageUpdate() {
  if (!permissionManager.canManageGuild()) return;
  const guildImageInput = getGuildImageFile();
  guildImageInput.click();
  guildImageInput.addEventListener("change", onEditGuildProfile);
}
export function onEditNick() {
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

  showConfirmationPanel(currentPopUp);
}

export function applySettings() {
  if (currentPopUp) {
    hideConfirmationPanel(currentPopUp);
  }
  if (isUnsaved) {
    if (isGuildSettings()) {
      console.log(
        "Applying guild settings. can manage guild: ",
        permissionManager.canManageGuild()
      );
      changeGuildName();

      if (permissionManager.canManageGuild()) {
        uploadImage(true);
      }
    } else {
      console.log("Applying profile settings");
      // in user profile settings
      changeNickname();
      uploadImage(false);
    }

    isUnsaved = false;
  }
}

export function removeguildImage() {
  apiClient.send(EventType.DELETE_GUILD_IMAGE, { guildId: currentGuildId });
  getGuildImageFile().value = "";
  getGuildImage().src = blackImage;
}

export function changeNickname() {
  if (changeNicknameTimeout) return;

  const newNicknameInput = getId("new-nickname-input") as HTMLInputElement;
  const newNickname = newNicknameInput.value.trim();

  if (newNickname && newNickname !== currentUserNick) {
    console.log("Changed your nickname to: " + newNickname);
    refreshUserProfile(currentUserId, newNickname);
    setUserNick(newNickname);
    const setInfoNick = getId("set-info-nick");
    if (setInfoNick) setInfoNick.innerText = newNickname;
    updateSelfName(newNickname);
    apiClient.send(EventType.CHANGE_NICK, { newNickname });
    newNicknameInput.value = newNickname;

    changeNicknameTimeout = setTimeout(() => {
      changeNicknameTimeout = null;
    }, CHANGE_NICK_COOLDOWN);
  }
}

export function changeGuildName() {
  if (changeGuildNameTimeout) return;
  const newGuildInput = getId("guild-overview-name-input") as HTMLInputElement;
  if (!newGuildInput) {
    console.warn("Guild input does not exist");
    return;
  }
  const newGuildName = newGuildInput.value.trim();
  if (newGuildName && newGuildName !== guildCache.currentGuildName) {
    console.log("Changed guild name to: " + newGuildName);
    apiClient.send(EventType.CHANGE_GUILD_NAME, {
      guildName: newGuildName,
      guildId: currentGuildId
    });
    newGuildInput.value = newGuildName;
    changeGuildNameTimeout = setTimeout(
      () => (changeGuildNameTimeout = null),
      CHANGE_NICK_COOLDOWN
    );
  }
}

export async function requestMicrophonePermissions() {
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

export function keydownHandler(event) {
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
