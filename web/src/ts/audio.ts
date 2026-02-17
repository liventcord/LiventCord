import { selfProfileImage } from "./avatar.ts";
import { getChannelsUl } from "./channels.ts";
import { getId, createEl } from "./utils.ts";
import { userList } from "./userList.ts";
import { toggleManager } from "./settings.ts";
import { translations } from "./translations.ts";
import { currentProfileImg } from "./popups.ts";
import { apiClient } from "./api.ts";
import { setAudioMuteState } from "./chatroom.ts";
import { rtcWsClient } from "./socketEvents.ts";
import { initialState } from "./app.ts";
import { appState } from "./appState.ts";

export enum AudioType {
  EnterVC = "/joinvoice",
  ExitVC = "/leavevoice",
  notify = "/notification"
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

let audioContext: AudioContext;

if (window.AudioContext) {
  audioContext = new AudioContext();
} else if (window.webkitAudioContext) {
  audioContext = new window.webkitAudioContext();
} else {
  throw new Error("AudioContext not supported");
}

let currentAudioPlayer: HTMLAudioElement | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaElementAudioSourceNode | null = null;
let isAnalyzing = false;
let isAudioPlaying = false;
let isInitializedAudio = false;

const youtubeIds = ["hOYzB3Qa9DE", "UgSHUZvs8jg"];
let youtubeIndex = 0;
const WIGGLE_DELAY = 500;

export let earphoneButton = getId("earphone-button");
export let microphoneButton = getId("microphone-button");

const containers = document.querySelectorAll(".voice-button-container");

export async function playAudioType(type: AudioType) {
  playAudio(getAudioUrl(type));
}
export function getAudioUrl(type: AudioType) {
  const BASE_AUDIO_URL = apiClient.getGitUrl();
  return BASE_AUDIO_URL + "/web/public/sounds/" + type + ".mp3";
}

export async function playAudioYt(audioId: string) {
  const proxyUrl =
    initialState.mediaWorkerUrl + "/stream/audio/youtube?id=" + audioId;
  playAudio(proxyUrl);
}
export async function playAudioSpotify(audioId: string) {
  const proxyUrl =
    initialState.mediaWorkerUrl + "/stream/audio/spotify?id=" + audioId;
  playAudio(proxyUrl);
}

containers.forEach((container) => {
  container.addEventListener("click", (e) => {
    earphoneButton = getId("earphone-button");
    microphoneButton = getId("microphone-button");
    const svg = (e.target as HTMLElement).closest("svg");
    if (!svg) return;
    if (svg.id === "microphone-button") setMicrophone();
    else if (svg.id === "earphone-button") setEarphones();
  });
});

export function initialiseAudio() {
  if (toggleManager.states["party-toggle"] && isAudioPlaying) {
    enableBorderMovement();
  }
}

const audioCache: Record<string, HTMLAudioElement> = {};

export async function playAudio(audioUrl: string) {
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    stopAudioAnalysis();
    if (source) {
      source.disconnect();
      source = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
  }

  let audioElement = audioCache[audioUrl];
  if (!audioElement) {
    audioElement = new Audio(audioUrl);
    audioElement.crossOrigin = "anonymous";
    audioCache[audioUrl] = audioElement;
  }

  currentAudioPlayer = audioElement;

  audioElement.onplay = () => {
    isAudioPlaying = true;
    audioContext.resume();
    enableBorderMovement();
  };

  audioElement.onpause = () => {
    isAudioPlaying = false;
    stopAudioAnalysis();
  };

  audioElement.onended = () => {
    isAudioPlaying = false;
    stopAudioAnalysis();
  };

  await audioElement.play();
}

export function enableBorderMovement() {
  if (!currentAudioPlayer) return;
  if (!analyser) startAudioAnalysis();
}

export function stopAudioAnalysis() {
  if (!isAnalyzing) return;
  isAnalyzing = false;
  resetWiggleEffect(
    currentProfileImg as HTMLElement,
    selfProfileImage as HTMLElement,
    getSelfFromUserList() as HTMLElement
  );
}

function startAudioAnalysis() {
  if (!currentAudioPlayer) return;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;

  source = audioContext.createMediaElementSource(currentAudioPlayer);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  isAnalyzing = true;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const recentVolumes: number[] = [];
  const bufferSize = 10;

  analyzeAudio(bufferSize, dataArray, recentVolumes);
}
function analyzeAudio(
  bufferSize: number,
  dataArray: any,
  recentVolumes: number[]
) {
  if (!isAnalyzing || !analyser) {
    return;
  }

  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }

  const averageVolume = sum / dataArray.length;

  recentVolumes.push(averageVolume);
  if (recentVolumes.length > bufferSize) {
    recentVolumes.shift();
  }

  const dynamicThreshold =
    recentVolumes.reduce((acc, val) => acc + val, 0) / recentVolumes.length;

  const MAX_VOLUME = 128;
  const MAX_COLOR_VALUE = 255;
  const VOLUME_TO_COLOR_MULTIPLIER = 2;

  const scaleFactor = 1 + averageVolume / MAX_VOLUME;
  const borderColor = `rgb(${Math.min(
    MAX_COLOR_VALUE,
    averageVolume * VOLUME_TO_COLOR_MULTIPLIER
  )}, 0, ${Math.max(
    0,
    MAX_COLOR_VALUE - averageVolume * VOLUME_TO_COLOR_MULTIPLIER
  )})`;

  if (currentProfileImg) {
    if (averageVolume > dynamicThreshold) {
      if (currentProfileImg) {
        currentProfileImg.classList.add("dancing-border");
        currentProfileImg.style.transform = `scale(${scaleFactor})`;
        currentProfileImg.style.borderColor = borderColor;
      }
      if (selfProfileImage) {
        selfProfileImage.classList.add("dancing-border");
        selfProfileImage.style.transform = `scale(${scaleFactor})`;
        selfProfileImage.style.borderColor = borderColor;
      }

      const selfUserListProfileList = getSelfFromUserList();
      if (selfUserListProfileList) {
        selfUserListProfileList.classList.add("dancing-border");
        selfUserListProfileList.style.transform = `scale(${scaleFactor})`;
        selfUserListProfileList.style.borderColor = borderColor;
      }
    } else {
      resetStyles();
    }
  }

  requestAnimationFrame(() =>
    analyzeAudio(bufferSize, dataArray, recentVolumes)
  );
}

function resetStyles() {
  const targets = [currentProfileImg, selfProfileImage, getSelfFromUserList()];
  targets.forEach((el) => {
    if (!el) return;
    el.classList.remove("dancing-border");
    el.style.transform = "scale(1)";
    el.style.borderColor = "rgb(17, 18, 20)";
  });
}

function getSelfFromUserList(): HTMLImageElement | null {
  if (!userList) {
    return null;
  }

  const userProfiles = userList.querySelectorAll(".profile-container");
  if (!userProfiles.length) {
    return null;
  }

  for (const profile of Array.from(userProfiles)) {
    if (profile.id === appState.currentUserId) {
      return profile.querySelector(".profile-pic") as HTMLImageElement;
    }
  }
  return null;
}
function applyWiggleEffect(
  profileElement: HTMLElement,
  selfProfileElement: HTMLElement
) {
  if (profileElement) profileElement.classList.add("dancing-border");
  if (selfProfileElement) selfProfileElement.classList.add("dancing-border");
  setTimeout(() => {
    if (profileElement) profileElement.classList.remove("dancing-border");
    if (selfProfileElement)
      selfProfileElement.classList.remove("dancing-border");
  }, WIGGLE_DELAY);
}

function resetWiggleEffect(...elements: HTMLElement[]) {
  elements.forEach((el) => {
    if (!el) return;
    el.style.transition = "none";
    el.style.borderRadius = "0%";
    setTimeout(() => {
      el.style.transition = "border-radius 0.1s";
    }, 0);
  });
}

function initializeMusic() {
  const modal = document.querySelector(".player");

  const playCurrentSong = async () => {
    await playAudioYt(youtubeIds[youtubeIndex]);
    if (currentProfileImg && selfProfileImage) {
      applyWiggleEffect(
        currentProfileImg as HTMLElement,
        selfProfileImage as HTMLElement
      );
    }
    if (currentAudioPlayer) {
      currentAudioPlayer.onended = () => {
        youtubeIndex = (youtubeIndex + 1) % youtubeIds.length;
        playCurrentSong();
      };
    }
  };

  modal?.addEventListener("click", () => {
    if (isInitializedAudio) return;
    isInitializedAudio = true;
    playCurrentSong();
  });
}

setTimeout(() => {
  initializeMusic();
}, 0);

let isMicrophoneOpen = true;
function setMicrophone() {
  if (!microphoneButton) return;
  isMicrophoneOpen = !isMicrophoneOpen;
  microphoneButton.classList.toggle("on", isMicrophoneOpen);
  microphoneButton.classList.toggle("off", !isMicrophoneOpen);
  setAudioMuteState(isMicrophoneOpen);
  rtcWsClient.toggleMute();
}

let isEarphonesOpen = true;
function setEarphones() {
  if (!earphoneButton) return;
  isEarphonesOpen = !isEarphonesOpen;
  earphoneButton.classList.toggle("on", isEarphonesOpen);
  earphoneButton.classList.toggle("off", !isEarphonesOpen);
  rtcWsClient.toggleDeafen();
}

function activateSoundOutput() {
  async function requestSoundOutputPermissions() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      return true;
    } catch {
      return false;
    }
  }

  function getSoundOutputList() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => devices.filter((d) => d.kind === "audiooutput"));
  }

  async function updateSoundOutputOptions() {
    const dropdown = getId("sound-output-dropdown") as HTMLElement;
    dropdown.innerHTML = "";

    try {
      const hasPermission = await requestSoundOutputPermissions();
      if (hasPermission) {
        const soundOutputs = await getSoundOutputList();
        soundOutputs.forEach((output, index) => {
          const option = createEl("option", {
            value: output.deviceId,
            textContent: output.label || `Sound Output ${index + 1}`,
            style: { fontSize: "12px" }
          });
          dropdown.appendChild(option);
        });
      }
      dropdown.appendChild(
        createEl("option", {
          value: "default",
          textContent: "Default Sound Output",
          style: { fontSize: "12px" }
        })
      );
    } catch {
      dropdown.appendChild(
        createEl("option", {
          value: "default",
          textContent: "Default Sound Output",
          style: { fontSize: "12px" }
        })
      );
    }
  }

  updateSoundOutputOptions();
  navigator.mediaDevices.addEventListener(
    "devicechange",
    updateSoundOutputOptions
  );
}

function activateMicAndCamera() {
  async function requestMediaPermissions() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      return true;
    } catch {
      return false;
    }
  }

  function getMediaDevicesList() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) =>
        devices.filter(
          (d) => d.kind === "audioinput" || d.kind === "videoinput"
        )
      );
  }

  function createDropdownOption(label: string, value: string) {
    return createEl("option", {
      textContent: label,
      value,
      style: { fontSize: "12px" }
    });
  }

  async function updateMediaOptions() {
    const micDropdown = getId("sound-mic-dropdown") as HTMLElement;
    const cameraDropdown = getId("camera-dropdown") as HTMLElement;
    micDropdown.innerHTML = "";
    cameraDropdown.innerHTML = "";

    try {
      const hasPermission = await requestMediaPermissions();
      if (hasPermission) {
        const mediaDevices = await getMediaDevicesList();
        mediaDevices.forEach((device, index) => {
          const label =
            device.label ||
            (device.kind === "audioinput"
              ? `Microphone ${index + 1}`
              : `Camera ${index + 1}`);
          const dropdown =
            device.kind === "audioinput" ? micDropdown : cameraDropdown;
          dropdown.appendChild(createDropdownOption(label, device.deviceId));
        });
      }

      micDropdown.appendChild(
        createDropdownOption(
          translations.getTranslation("default-microphone"),
          "default"
        )
      );
      cameraDropdown.appendChild(
        createDropdownOption("Default Camera", "default")
      );
    } catch {
      micDropdown.appendChild(
        createDropdownOption(
          translations.getTranslation("default-microphone"),
          "default"
        )
      );
      cameraDropdown.appendChild(
        createDropdownOption("Default Camera", "default")
      );
    }
  }

  updateMediaOptions();
  navigator.mediaDevices.addEventListener("devicechange", updateMediaOptions);
}

async function activateMicAndSoundOutput() {
  activateMicAndCamera();
  activateSoundOutput();
}

export async function sendAudioData() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
  } catch {}
}

class VoiceHandler {
  async handleAudio(data: ArrayBuffer | { buffer: ArrayBuffer } | null) {
    if (
      data &&
      ("byteLength" in data ? data.byteLength : data.buffer.byteLength) > 0
    ) {
      const buffer = data instanceof ArrayBuffer ? data : data.buffer;
      const decoded = await audioContext.decodeAudioData(buffer);
      const src = audioContext.createBufferSource();
      src.buffer = decoded;
      src.connect(audioContext.destination);
      src.start();
    }
  }
}

const voiceHandler = new VoiceHandler();

export function clearVoiceChannel(channelId: string) {
  const channelButton = getChannelsUl().querySelector(`li[id="${channelId}"]`);
  if (!channelButton) return;

  const buttons = channelButton.querySelectorAll(".channel-button");
  buttons.forEach((btn) => btn.remove());

  const channelUsersContainer = channelButton.querySelector(
    ".channel-users-container"
  );
  if (channelUsersContainer) channelUsersContainer.remove();

  const existingContentWrapper = channelButton.querySelector(
    ".content-wrapper"
  ) as HTMLElement;
  existingContentWrapper.style.marginRight = "100px";
}
