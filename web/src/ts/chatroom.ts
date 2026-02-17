import store from "../store";
import { getProfileUrl } from "./avatar";
import {
  currentVoiceChannelId,
  setCurrentVoiceChannelGuild,
  setCurrentVoiceChannelId
} from "./channels";
import { joinVoiceChannel } from "./guild";
import { setRtcStatus } from "./rtc";
import {
  useAutoGain,
  useEchoCancellation,
  useNoiseSuppression
} from "./settings";
import { RTCWebSocketClient, rtcWsClient } from "./socketEvents";
import { alertUser } from "./ui";
import { userManager } from "./user";
import { appState } from "./appState.ts";

import { createEl, disableElement, enableElement, getId } from "./utils";
import { checkVideoLayout, initialiseSelfVideo } from "./videoManager";

export const peerList: Record<string, RTCPeerConnection | undefined> = {};
export const rtcWS: RTCWebSocketClient | null = null;
export const myRoomID = "1";

let localStream: MediaStream | null = null;
let audioMuted = false;
let videoMuted = true;
let myVideo = getId("local_vid") as HTMLVideoElement | null;
const callContainer = getId("call-container");

let isClicked = false;

myVideo?.addEventListener("click", () => {
  if (isClicked) {
    showCallContainer();
    isClicked = false;
    return;
  }
  isClicked = true;
});

export function currentVoiceUserId() {
  return appState.currentUserId;
}

export async function initializeVideoComponent() {
  initialiseSelfVideo();
}

export async function enterVoiceChannel(guildId: string, channelId: string) {
  if (currentVoiceChannelId === channelId) {
    console.warn("Already in this voice channel");
    showCallContainer();
    return;
  }

  joinVoiceChannel(channelId, guildId);
  showLocalVid();
  toggleSoundPanel(true);
  attachButtonHandlers();

  setRtcStatus(false, true);

  await startCamera();
}

function attachButtonHandlers() {
  const muteButton = getId("microphone-button");
  const cameraButton = getId("camera-sound-panel");
  const closeCallButton = getId("close-call-button");

  if (muteButton) {
    muteButton.addEventListener("click", () => {
      audioMuted = !audioMuted;
      setAudioMuteState(audioMuted);
      toggleIconClass(muteButton, audioMuted);
    });
    toggleIconClass(muteButton, audioMuted);
  }

  if (cameraButton) {
    cameraButton.addEventListener("click", async () => {
      videoMuted = !videoMuted;
      setVideoMuteState(videoMuted);
      if (videoMuted) stopCamera();
      else await startCamera();
      toggleCameraUI(videoMuted);
    });
  }

  if (closeCallButton) closeCallButton.addEventListener("click", closeCall);
}

function applyAudioConstraint(
  constraint: keyof MediaTrackSettings,
  value: boolean
) {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;

  const capabilities = audioTrack.getCapabilities() as Record<string, boolean>;
  if (capabilities[constraint] === undefined) return;

  const settings: Record<string, boolean> = { [constraint]: value };
  audioTrack.applyConstraints(settings).catch((err) => {
    console.error(`Failed to update ${constraint}:`, err);
  });
}

export function updateNoiseSuppression(value: boolean) {
  applyAudioConstraint("noiseSuppression", value);
}

export function updateEchoCancellation(value: boolean) {
  applyAudioConstraint("echoCancellation", value);
}

export function updateAutoGain(value: boolean) {
  applyAudioConstraint("autoGainControl", value);
}

export function getUserMedia() {
  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: useEchoCancellation(),
      noiseSuppression: useNoiseSuppression(),
      autoGainControl: useAutoGain(),
      deviceId: undefined,
      channelCount: 1
    },
    video: !videoMuted ? true : false
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}
let isFirstTime = true;
export async function startCamera() {
  try {
    console.log("Start camera");

    const newStream = await getUserMedia();
    const oldStream = localStream;
    localStream = newStream;

    updateLocalVideoElement(localStream);
    showLocalVid();
    oldStream
      ? replaceTracksOnPeers(oldStream, newStream)
      : addTracksToPeers(newStream);
    if (oldStream) stopStream(oldStream);

    if (isFirstTime) {
      hideLocalVid();
    }
    isFirstTime = false;

    setAudioMuteState(audioMuted);
    setVideoMuteState(videoMuted);
  } catch (err: any) {
    handleMediaError(err);
  }
}

export function stopCamera() {
  if (localStream) stopStream(localStream);
  localStream = null;
  if (myVideo) myVideo.srcObject = null;
  hideLocalVid();
}

export function setAudioMuteState(flag: boolean) {
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !flag));
}

export function setVideoMuteState(flag: boolean) {
  localStream?.getVideoTracks().forEach((t) => (t.enabled = !flag));
}

export function isCameraActive(): boolean {
  return localStream?.getTracks().some((t) => t.readyState === "live") ?? false;
}

export function closeCall() {
  stopCamera();
  toggleSoundPanel(false);
  hideCallContainer();
  hideLocalVid();
  rtcWsClient.exitRoom();
  setCurrentVoiceChannelId("");
  setCurrentVoiceChannelGuild("");
  store.dispatch("clearSelectedVoiceChannel");
}

function updateLocalVideoElement(stream: MediaStream) {
  if (!myVideo) myVideo = getId("local_vid") as HTMLVideoElement | null;
  if (!myVideo) return;
  myVideo.srcObject = stream;
  myVideo.muted = true;
  myVideo.autoplay = true;
  myVideo.playsInline = true;
  myVideo.onloadedmetadata = () => myVideo!.play().catch(() => {});
}

function replaceTracksOnPeers(oldStream: MediaStream, newStream: MediaStream) {
  const newVideo = newStream.getVideoTracks()[0] || null;
  const newAudio = newStream.getAudioTracks()[0] || null;
  Object.values(peerList).forEach((pc) => {
    if (!pc) return;
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === "video" && newVideo)
        sender.replaceTrack(newVideo).catch(console.error);
      if (sender.track?.kind === "audio" && newAudio)
        sender.replaceTrack(newAudio).catch(console.error);
    });
  });
}

function addTracksToPeers(stream: MediaStream) {
  Object.values(peerList).forEach((pc) => {
    if (!pc) return;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  });
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

function handleMediaError(err: any) {
  const msg =
    err.name === "NotAllowedError"
      ? "Permission denied by the user."
      : err.name === "NotFoundError"
        ? "No media devices found."
        : "Error accessing camera: " + err;
  alertUser(msg);
  console.error("Error accessing camera:", err);
}

function toggleSoundPanel(show: boolean) {
  const action = show ? enableElement : disableElement;
  action("sound-panel");
}

function toggleCameraUI(active: boolean) {
  const panelBtn = getId("sound-panel-button");
  if (panelBtn && active) panelBtn.innerHTML = "";
}

function toggleIconClass(button: HTMLElement, isMuted: boolean) {
  const icon = button.querySelector(".icon") as HTMLElement | null;
  if (!icon) return;
  icon.classList.toggle("fa-microphone", !isMuted);
  icon.classList.toggle("fa-microphone-slash", isMuted);
  icon.classList.toggle("icon-off", isMuted);
}

export function makeVideoElementCustom(elementId: string, userId: string) {
  const wrapper = createEl("div", { className: "video-wrapper" });
  const vid = createEl("video", {
    id: "vid_" + elementId,
    autoplay: true,
    playsInline: true,
    width: "100%",
    height: "100%",
    style: "object-fit: cover; border-radius: 8px; background-color: #111;"
  });
  const placeholder = createEl("img", {
    src: getProfileUrl(userId),
    className: "video-placeholder"
  });
  const overlay = createEl("div", { className: "bottom-overlay" });
  const micBtn = createEl("i", {
    className: "fa-solid fa-microphone mic-button"
  });
  const nameOverlay = createEl("span", {
    className: "name-overlay",
    textContent: userManager.getUserNick(userId)
  });

  overlay.append(micBtn, nameOverlay);
  wrapper.append(vid, placeholder, overlay);
  return wrapper;
}

export function addVideoElement(elementId: string, userId: string) {
  if (elementId === currentVoiceUserId()) return;
  const grid = getId("video_grid");
  if (!grid) return;
  grid.appendChild(makeVideoElementCustom(elementId, userId));
  checkVideoLayout();
  return getVideoObj(elementId);
}

export function removeVideoElement(elementId: string) {
  const videoEl = getVideoObj(elementId);
  if (!videoEl) return;
  if (videoEl.srcObject) stopStream(videoEl.srcObject as MediaStream);
  videoEl.removeAttribute("srcObject");
  videoEl.removeAttribute("src");
  getId("vid_" + elementId)?.remove();
}

export function getVideoObj(elementId: string) {
  const el = getId("vid_" + elementId);
  return el instanceof HTMLVideoElement ? el : null;
}
export function resetMyVideoPos() {
  if (!myVideo) return;
  myVideo.style.top = "0";
  myVideo.style.left = "0";
}
function moveLocalVidInsideContainer() {
  if (!callContainer || !myVideo) return;
  callContainer.appendChild(myVideo);
  myVideo.classList.add("fullscreen-video");
  resetMyVideoPos();
  setTimeout(() => {
    resetMyVideoPos();
  }, 50);
}

function moveLocalVidOutsideContainer() {
  if (!myVideo) return;
  myVideo.classList.remove("fullscreen-video");
  document.body.appendChild(myVideo);
  myVideo.style.top = "";
  myVideo.style.left = "";
}

export function showCallContainer() {
  callContainer?.style.setProperty("display", "grid");
  moveLocalVidInsideContainer();
}

export function hideCallContainer() {
  callContainer?.style.setProperty("display", "none");
  moveLocalVidOutsideContainer();
}

export function showLocalVid() {
  if (myVideo) enableElement(myVideo);
}

export function hideLocalVid() {
  if (myVideo) disableElement(myVideo);
}

export function closeConnection(peerId: string) {
  const pc = peerList[peerId];
  if (!pc) return console.warn(`Peer connection for ${peerId} does not exist.`);
  pc.close();
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.onnegotiationneeded = null;
  delete peerList[peerId];
}
