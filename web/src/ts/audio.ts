import { selfProfileImage } from "./avatar.ts";
import {
  currentVoiceChannelId,
  setCurrentVoiceChannelGuild,
  currentVoiceChannelGuild,
  getChannelsUl
} from "./channels.ts";
import { apiClient, EventType } from "./api.ts";
import { getId, createEl, IMAGE_SRCS } from "./utils.ts";
import { userList } from "./userList.ts";
import { toggleManager } from "./settings.ts";
import { currentUserId } from "./user.ts";
import { isOnGuild } from "./router.ts";
import { translations } from "./translations.ts";
import { currentProfileImg } from "./popups.ts";

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
  throw new Error(
    "Your browser does not support AudioContext or webkitAudioContext."
  );
}

let currentAudioPlayer: HTMLAudioElement;
let isAudioPlaying = false;
let analyser: AnalyserNode | null;
let source: MediaElementAudioSourceNode | null;

let isAnalyzing = false;
const youtubeIds = ["hOYzB3Qa9DE", "UgSHUZvs8jg"];
let youtubeIndex = 0;
const WIGGLE_DELAY = 500;
let isInitializedAudio: boolean;
export const earphoneButton = getId("earphone-button");
export const microphoneButton = getId("microphone-button");
const containers = document.querySelectorAll(".voice-button-container");
containers.forEach((container) => {
  container.addEventListener("click", function (event) {
    const target = event.target as HTMLElement;
    if (target.id === "microphone-button") {
      setMicrophone();
    } else if (target.id === "earphone-button") {
      setEarphones();
    }
  });
});

//initializeMp3Yt();

export function initialiseAudio() {
  if (toggleManager.states["party-toggle"] && isAudioPlaying) {
    enableBorderMovement();
  }
}
const playIconSvg =
  '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 5v20l15-10L10 5z" fill="black"/></svg>';
const stopIconSvg =
  '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 5h10v20H5V5zm10 0h10v20H15V5z" fill="black"/></svg>';
export async function playAudio(audioUrl: string) {
  try {
    if (currentAudioPlayer) {
      currentAudioPlayer.pause();
      currentAudioPlayer.remove();
    }

    const audioElement = new Audio(audioUrl);
    audioElement.crossOrigin = "anonymous";
    currentAudioPlayer = audioElement;

    const playButton = document.querySelector("#player01 .play") as HTMLElement;
    playButton.addEventListener("click", () => {
      if (isAudioPlaying) {
        audioElement.pause();
        playButton.innerHTML = playIconSvg;
      } else {
        audioElement.play();
        playButton.innerHTML = stopIconSvg;
      }
      isAudioPlaying = !isAudioPlaying;
    });

    const nextButton = document.querySelector("#player01 .next") as HTMLElement;
    nextButton.addEventListener("click", async () => {
      if (youtubeIndex < youtubeIds.length - 1) {
        youtubeIndex++;
        const nextYtId = youtubeIds[youtubeIndex];
        const audioStreamUrl = await fetchAudioStreamUrl(nextYtId);
        if (audioStreamUrl) {
          playAudio(audioStreamUrl);
        } else {
          console.error("Failed to retrieve audio stream URL for next track.");
        }
      }
    });

    const prevButton = document.querySelector("#player01 .prev") as HTMLElement;
    prevButton.addEventListener("click", async () => {
      if (youtubeIndex > 0) {
        youtubeIndex--;
        const prevYtId = youtubeIds[youtubeIndex];
        const audioStreamUrl = await fetchAudioStreamUrl(prevYtId);
        if (audioStreamUrl) {
          playAudio(audioStreamUrl);
        } else {
          console.error(
            "Failed to retrieve audio stream URL for previous track."
          );
        }
      }
    });

    audioElement.addEventListener("timeupdate", () => {
      const totalTime = document.querySelector(
        "#player01 .total-time"
      ) as HTMLElement;
      const lastTime = document.querySelector(
        "#player01 .last-time"
      ) as HTMLElement;
      totalTime.innerText = formatTime(audioElement.duration);
      lastTime.innerText = formatTime(audioElement.currentTime);

      const track = document.querySelector("#player01 .track") as HTMLElement;
      const PERCENTAGE = 100;
      track.style.width = `${
        (audioElement.currentTime / audioElement.duration) * PERCENTAGE
      }%`;
    });

    const track = document.querySelector("#player01 .track") as HTMLElement;
    track.addEventListener("click", (e: MouseEvent) => {
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const clickRatio = x / width;
      audioElement.currentTime = clickRatio * audioElement.duration;
    });

    audioElement.addEventListener("ended", function () {
      isAudioPlaying = false;
      playButton.innerHTML =
        '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 5v20l15-10L10 5z" fill="black"/></svg>'; // Play icon
    });

    await audioElement.play();
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}

function formatTime(seconds: number) {
  const SECONDS_IN_MINUTE = 60;
  const MINIMUM_SECONDS_DISPLAY = 10;

  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
  const secs = Math.floor(seconds % SECONDS_IN_MINUTE);
  return `${minutes}:${secs < MINIMUM_SECONDS_DISPLAY ? "0" + secs : secs}`;
}

function initializeMp3Yt() {
  const modal = createEl("div", { className: "modal" });
  document.body.appendChild(modal);

  const handleClick = async function () {
    if (isAudioPlaying || isInitializedAudio) {
      return;
    }

    const ytId = youtubeIds[youtubeIndex];
    document.removeEventListener("click", handleClick);
    modal.remove();

    isAudioPlaying = true;
    isInitializedAudio = true;

    const audioStreamUrl = await fetchAudioStreamUrl(ytId);
    if (audioStreamUrl) {
      playAudio(audioStreamUrl);
    } else {
      console.error("Failed to retrieve audio stream URL.");
    }
  };

  document.addEventListener("click", handleClick);
}
async function fetchAudioStreamUrl(videoId?: string) {
  if (!videoId) {
    return null;
  }
  try {
    const response = await fetch(
      `/ytstream/?videoId=${encodeURIComponent(videoId)}`
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return response.url;
  } catch (error) {
    console.error("Error fetching audio stream URL:", error);
    return null;
  }
}

export function enableBorderMovement() {
  if (isAudioPlaying && currentAudioPlayer) {
    if (!isAnalyzing) {
      startAudioAnalysis();
    }
  }
}

export function stopAudioAnalysis() {
  if (!isAnalyzing) {
    return;
  }

  isAnalyzing = false;

  const selfcurrentProfileImgList = getSelfFromUserList() as HTMLElement;
  if (selfcurrentProfileImgList) {
    selfcurrentProfileImgList.style.borderRadius = "50%";
  }

  resetWiggleEffect(
    currentProfileImg,
    selfProfileImage,
    selfcurrentProfileImgList
  );
}

function startAudioAnalysis() {
  audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();

  if (!(currentAudioPlayer instanceof HTMLMediaElement)) {
    console.error("currentAudioPlayer is not a valid HTMLMediaElement.");
    return;
  }

  analyser = audioContext.createAnalyser();
  const _source = audioContext.createMediaElementSource(currentAudioPlayer);
  _source.connect(analyser);
  analyser.connect(audioContext.destination);

  isAnalyzing = true;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const recentVolumes: number[] = [];
  const bufferSize = 10;

  analyzeAudio(bufferSize, dataArray, recentVolumes);
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
    if (profile.id === currentUserId) {
      return profile.querySelector(".profile-pic") as HTMLImageElement;
    }
  }
  return null;
}

function analyzeAudio(
  bufferSize: number,
  dataArray: Uint8Array,
  recentVolumes: number[]
) {
  if (!isAnalyzing || !analyser) {
    return;
  }

  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const dataIndex = dataArray[i];
    if (dataIndex) {
      sum += dataIndex;
    }
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
      resetStyles(currentProfileImg);
    }
  }

  requestAnimationFrame(() =>
    analyzeAudio(bufferSize, dataArray, recentVolumes)
  );
}

function resetStyles(currentProfileImg: HTMLElement) {
  if (currentProfileImg) {
    currentProfileImg.classList.remove("dancing-border");
    currentProfileImg.style.transform = "scale(1)";
    currentProfileImg.style.borderColor = "rgb(17, 18, 20)";
  }
  if (selfProfileImage) {
    selfProfileImage.classList.remove("dancing-border");
    selfProfileImage.style.transform = "scale(1)";
    selfProfileImage.style.borderColor = "rgb(17, 18, 20)";
  }
  const selfUserListProfileList = getSelfFromUserList();
  if (selfUserListProfileList) {
    selfUserListProfileList.classList.remove("dancing-border");
    selfUserListProfileList.style.transform = "scale(1)";
    selfUserListProfileList.style.borderColor = "rgb(17, 18, 20)";
  }
}

function stopCurrentMusic() {
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
    isAudioPlaying = false;

    resetProfileBorders();

    if (source) {
      source.disconnect();
      source = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }

    isAnalyzing = false;
  }
}

function resetProfileBorders() {
  const currentProfileImg = getId("profile-display");

  const selfcurrentProfileImgList = getSelfFromUserList();
  if (selfcurrentProfileImgList) {
    selfcurrentProfileImgList.style.borderRadius = "50%";
    selfcurrentProfileImgList.style.borderColor = "";
    selfcurrentProfileImgList.style.transform = "";
  }

  if (currentProfileImg) {
    currentProfileImg.style.borderRadius = "50%";
    currentProfileImg.style.borderColor = "";
    currentProfileImg.style.transform = "";
  }
  if (selfProfileImage) {
    selfProfileImage.style.borderRadius = "50%";
    selfProfileImage.style.borderColor = "";
    selfProfileImage.style.transform = "";
  }
}

function activateSoundOutput() {
  async function requestSoundOutputPermissions() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function getSoundOutputList() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) =>
        devices.filter((device) => device.kind === "audiooutput")
      );
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
            style: { fontSize: "12px", border: "none" },
            value: output.deviceId,
            textContent: output.label || `Sound Output ${index + 1}`
          });
          dropdown.appendChild(option);
        });
      }

      const defaultOption = createEl("option");
      defaultOption.style.fontSize = "12px";
      defaultOption.value = "default";
      defaultOption.textContent = "Default Sound Output";
      dropdown.appendChild(defaultOption);
    } catch (error) {
      console.error("Error updating sound output options:", error);

      const defaultOption = createEl("option");
      defaultOption.style.fontSize = "12px";
      defaultOption.value = "default";
      defaultOption.textContent = "Default Sound Output";
      dropdown.appendChild(defaultOption);
    }
  }

  updateSoundOutputOptions();
  navigator.mediaDevices.addEventListener(
    "devicechange",
    updateSoundOutputOptions
  );
}

let isMicrophoneOpen = true;
function setMicrophone() {
  console.log("Set microphone! to ", isMicrophoneOpen);
  if (!microphoneButton) {
    return;
  }
  microphoneButton.classList.toggle("fa-microphone", !isMicrophoneOpen);
  microphoneButton.classList.toggle("fa-microphone-slash", isMicrophoneOpen);

  isMicrophoneOpen = !isMicrophoneOpen;
}

let isEarphonesOpen = true;
function setEarphones() {
  console.log("Set earphones! to ", isEarphonesOpen);
  isEarphonesOpen = !isEarphonesOpen;
}

async function activateMicAndSoundOutput() {
  activateMicAndCamera();
  activateSoundOutput();
}
export async function sendAudioData() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = async (e) => {};
    mediaRecorder.start();
  } catch (err) {
    console.error("Error accessing microphone:", err);
  }
}

function activateMicAndCamera() {
  async function requestMediaPermissions() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function getMediaDevicesList() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) =>
        devices.filter(
          (device) =>
            device.kind === "audioinput" || device.kind === "videoinput"
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
    } catch (error) {
      console.error("Error updating media options:", error);

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
  if (navigator && navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener("devicechange", updateMediaOptions);
  }
}

function closeCurrentCall() {
  currentAudioPlayer = getId("audio-player") as HTMLAudioElement;
  playAudio("/sounds/leavevoice.mp3");

  const sp = getId("sound-panel") as HTMLElement;
  const oldVoiceId = currentVoiceChannelId;
  sp.style.display = "none";
  clearVoiceChannel(oldVoiceId);
  setCurrentVoiceChannelGuild("");
  if (isOnGuild) {
    setCurrentVoiceChannelGuild("");
  }
  const buttonContainer = getChannelsUl().querySelector(
    `li[id="${oldVoiceId}"]`
  ) as HTMLElement;

  const data = {
    guildId: currentVoiceChannelGuild,
    channelId: currentVoiceChannelId
  };
  apiClient.send(EventType.LEAVE_VOICE_CHANNEL, data);
}
export function clearVoiceChannel(channelId: string) {
  const channelButton = getChannelsUl().querySelector(`li[id="${channelId}"]`);
  if (!channelButton) {
    return;
  }
  const buttons = channelButton.querySelectorAll(".channel-button");
  buttons.forEach((btn) => {
    btn.remove();
  });
  const channelUsersContainer = channelButton.querySelector(
    ".channel-users-container"
  );
  if (channelUsersContainer) {
    channelUsersContainer.remove();
  }
  const existingContentWrapper = channelButton.querySelector(
    ".content-wrapper"
  ) as HTMLElement;
  console.log(existingContentWrapper.style.marginRight);
  existingContentWrapper.style.marginRight = "100px";
}

let cachedAudioNotify: HTMLAudioElement;

export function playNotification() {
  try {
    if (!cachedAudioNotify) {
      cachedAudioNotify = new Audio("/sounds/notification.mp3");
    }
    cachedAudioNotify.play();
  } catch (error) {
    console.log(error);
  }
}

function initializeMusic() {
  const modal = createEl("div", { className: "modal" });
  document.body.appendChild(modal);

  const songs = [
    "/sounds/musics/2.mp3",
    "/sounds/musics/1.mp3",
    "/sounds/musics/3.mp3",
    "/sounds/musics/4.mp3"
  ];

  let currentSongIndex = 0;

  function playCurrentSong() {
    const currentSong = songs[currentSongIndex];

    if (currentSong) {
      playAudio(currentSong);
    }

    const audio = new Audio(currentSong);
    audio.onended = function () {
      currentSongIndex++;
      if (currentSongIndex >= songs.length) {
        currentSongIndex = 0;
      }

      playCurrentSong();
    };
  }

  modal.addEventListener("click", function () {
    playCurrentSong();
    modal.style.display = "none";
  });
}
class VoiceHandler {
  async handleAudio(
    data: ArrayBuffer | { buffer: ArrayBuffer } | null
  ): Promise<void> {
    if (
      data &&
      ("byteLength" in data ? data.byteLength : data.buffer.byteLength) > 0
    ) {
      try {
        const arrayBuffer = this.convertToArrayBuffer(data);
        const decodedData = await this.decodeAudioDataAsync(arrayBuffer);
        if (decodedData) {
          this.playAudioBuffer(decodedData);
        } else {
          console.log("Decoded audio data is empty or invalid");
        }
      } catch (e) {
        console.log("Error decoding audio data:", e);
      }
    } else {
      console.log("Received silent or invalid audio data");
    }
  }

  convertToArrayBuffer(
    data: ArrayBuffer | { buffer: ArrayBuffer }
  ): ArrayBuffer {
    if (data instanceof ArrayBuffer) {
      return data;
    } else if (data.buffer instanceof ArrayBuffer) {
      return data.buffer;
    } else {
      throw new Error("Unsupported data format");
    }
  }

  decodeAudioDataAsync(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }

  playAudioBuffer(audioBuffer: AudioBuffer): void {
    const _source = audioContext.createBufferSource();
    _source.buffer = audioBuffer;
    _source.connect(audioContext.destination);
    _source.start(0);
  }
}

function applyWiggleEffect(
  profileElement: HTMLElement,
  selfProfileElement: HTMLElement
) {
  if (profileElement) {
    profileElement.classList.add("dancing-border");
  }
  if (selfProfileElement) {
    selfProfileElement.classList.add("dancing-border");
  }
  setTimeout(() => {
    if (profileElement) {
      profileElement.classList.remove("dancing-border");
    }
    if (selfProfileElement) {
      selfProfileElement.classList.remove("dancing-border");
    }
  }, WIGGLE_DELAY);
}

function resetWiggleEffect(...elements: HTMLElement[]) {
  elements.forEach((element) => {
    if (element) {
      element.style.transition = "none";
      element.style.borderRadius = "0%";
      setTimeout(() => {
        element.style.transition = "border-radius 0.1s";
      }, 0);
    }
  });
}

const voiceHandler = new VoiceHandler();
