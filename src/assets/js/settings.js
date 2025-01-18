import { blackImage, getId } from './utils';
import {
  enableBorderMovement,
  stopAudioAnalysis,
  sendAudioData,
} from './audio';
import { uploadImage } from './avatar';
import { showConfirmationPanel } from './settingsui';
import { alertUser, hideImagePreviewRequest } from './ui';
import { closeSettings } from './settingsui';

let isImagePreviewOpen = false;
let closeCurrentJoinPop;

export let settingTypes = {
  MyAccount: 'MyAccount',
  SoundAndVideo: 'SoundAndVideo',
  Notifications: 'Notifications',
  ActivityPresence: 'ActivityPresence',
  Appearance: 'Appearance',
};

export let isSettingsOpen = false;
export function setIsSettingsOpen(val) {
  isSettingsOpen = val;
}
export let isUnsaved = false;
export function setUnsaved(val) {
  isUnsaved = val;
}
export let isChangedProfile = false;
export function setIsChangedProfile() {
  isChangedProfile = false;
}
let isInitialized = false;
let resetTimeout;
export let currentPopUp = null;

let logoClicked = 0;
let isGuildSettings = false;

export function clearCookies() {
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [name] = cookie.split('=');
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
    name,
  )}=${cookieValue}; ${expiresStr}; path=/`;
}

export function loadBooleanCookie(name) {
  const cookieName = encodeURIComponent(name) + '=';
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    if (cookie.startsWith(cookieName)) {
      const result = decodeURIComponent(cookie.substring(cookieName.length));
      return result == 1;
    }
  }
  return false;
}

export const toggleManager = {
  states: {
    'notify-toggle': loadBooleanCookie('notify-toggle') ?? false,
    'snow-toggle': loadBooleanCookie('snow-toggle') ?? false,
    'party-toggle': loadBooleanCookie('party-toggle') ?? false,
    'activity-toggle': loadBooleanCookie('activity-toggle') ?? false,
    'slide-toggle': loadBooleanCookie('slide-toggle') ?? false,
  },
  updateState(toggleId, newValue) {
    this.states[toggleId] = newValue;
    saveBooleanCookie(toggleId, newValue);
    this.updateToggleDisplay(toggleId, newValue);
    this.triggerActions(toggleId, newValue);
  },
  updateToggleDisplay(toggleId, newValue) {
    const toggleElement = getId(toggleId);
    if (toggleElement) {
      toggleElement
        .querySelector('.toggle-switch')
        .classList.toggle('active', newValue);
      toggleElement.classList.toggle('active', newValue);
    }
  },
  triggerActions(toggleId, newValue) {
    const toggleActions = {
      'snow-toggle': this.toggleEffect.bind(this, 'snow', newValue),
      'party-toggle': this.toggleEffect.bind(this, 'party', newValue),
    };
    if (toggleActions[toggleId]) {
      toggleActions[toggleId]();
    }
  },
  toggleEffect(effect, enable) {
    if (effect === 'snow') {
      enable ? this.startSnowEffect() : this.stopSnowEffect();
    } else if (effect === 'party') {
      enable ? this.startPartyEffect() : this.stopPartyEffect();
    }
  },
  isSlide() {
    return this.states['slide-toggle'];
  },
  startSnowEffect() {
    const particeContainer = getId('confetti-container');
    let skew = 1;

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    (function frame() {
      if (
        !toggleManager.states['snow-toggle'] ||
        !isConfettiLoaded ||
        !isDomLoaded
      )
        return;

      skew = Math.max(0.8, skew - 0.001);

      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: 300,
        origin: {
          x: Math.random(),
          y: Math.random() * skew - 0.2,
        },
        colors: ['#ffff'],
        shapes: ['circle'],
        gravity: randomInRange(0.4, 0.6),
        scalar: randomInRange(0.4, 1),
        drift: randomInRange(-0.4, 0.4),
        particleContainer: particeContainer,
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
  },
};

export function setupToggle(id) {
  const toggleElement = getId(id);
  if (toggleElement) {
    toggleManager.updateToggleDisplay(id, toggleManager.states[id]);
    handleToggleClick(toggleElement, () => {
      const newValue = !toggleManager.states[id];
      toggleManager.updateState(id, newValue);
    });
  }
}

export function initializeCookies() {
  [
    'activity-toggle',
    'snow-toggle',
    'party-toggle',
    'notify-toggle',
    'slide-toggle',
  ].forEach(setupToggle);

  console.log('init cookies', toggleManager.states);
  if (toggleManager.states['snow-toggle'])
    toggleManager.toggleEffect('snow', true);
  if (toggleManager.states['party-toggle'])
    toggleManager.toggleEffect('party', true);
}

export function triggerFileInput() {
  const profileImageInput = getId('profileImage');
  profileImageInput.click();
  profileImageInput.addEventListener('change', onEditProfile);
}

export function triggerguildImageUpdate() {
  const guildImageInput = getId('guildImage');
  guildImageInput.click();
  guildImageInput.addEventListener('change', onEditGuildProfile);
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
  console.log(isUnsaved);
  if (isUnsaved) {
    if (isGuildSettings) {
      changeGuildName();

      if (permissionManager.canManageGuild()) {
        uploadImage(true);
      }
    } else {
      // in default settings
      changeNickname();
      uploadImage(false);
    }

    isUnsaved = false;
  }
}

export function onEditNick() {
  isUnsaved = true;
  regenerateConfirmationPanel();
}

export function removeguildImage() {
  apiClient.send(EventType.DELETE_GUILD_IMAGE, { guildId: currentGuildId });
  getId('guildImage').value = '';
  getId('guild-image').src = blackImage;
}

let changeNicknameTimeout;
export function changeNickname() {
  const newNicknameInput = getId('new-nickname-input');
  const newNickname = newNicknameInput.value.trim();

  if (
    newNickname !== '' &&
    !changeNicknameTimeout &&
    newNickname != currentUserNick
  ) {
    console.log('Changed your nickname to: ' + newNickname);
    userNick = newNickname;
    apiClient.send(EventType.CHANGE_NICK, { newNickname: newNickname });

    newNicknameInput.value = newNickname;
    changeNicknameTimeout = setTimeout(() => {
      changeNicknameTimeout = null;
    }, 1000);
  }
}

let changeGuildNameTimeout;
export function changeGuildName() {
  const newGuildInput = getId('guild-overview-name-input');
  const newGuildName = newGuildInput.value.trim();
  if (
    newGuildName !== '' &&
    !changeGuildNameTimeout &&
    newGuildName != currentGuildName
  ) {
    console.log('Changed guild name to: ' + newGuildName);
    const objecttosend = { '': newGuildName, guildId: currentGuildId };
    apiClient.send(EventType.CHANGE_GUILD_NAME, objecttosend);
    const setInfoNick = getId('set-info-nick');
    if (setInfoNick) {
      setInfoNick.innerText = newGuildName;
    }
    newGuildInput.value = newGuildName;
    changeGuildNameTimeout = setTimeout(() => {
      changeGuildNameTimeout = null;
    }, 1000);
  }
}

export async function requestMicrophonePermissions() {
  try {
    const isNoMic = false;
    if (isNoMic) {
      const response = await fetch('/notification.mp3');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = function () {
        const bytes = new Uint8Array(reader.result);
        audioManager.emit('audio_data', bytes);
      };
      reader.readAsArrayBuffer(blob);
    } else {
      await sendAudioData();
    }
  } catch (error) {
    console.log(error);
    alertUser('MİKROFON ERİŞİMİ ENGELLENDİ', 'Mikrofon izni reddedildi.');
    return false;
  }
}

export function keydownHandler(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (isSettingsOpen) {
      closeSettings();
      return;
    }
    if (isImagePreviewOpen) {
      hideImagePreviewRequest();
    }
  }
}

document.addEventListener('keydown', keydownHandler);
