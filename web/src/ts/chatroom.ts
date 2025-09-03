import { initialState } from "./app";
import { joinVoiceChannel } from "./guild";
import { setRtcStatus } from "./rtc";
import { setRTCWsClient, RTCWebSocketClient } from "./socketEvents";
import { alertUser } from "./ui";
import { disableElement, enableElement, getId } from "./utils";
import { checkVideoLayout, initialiseSelfVideo } from "./videoManager";

export let currentVoiceUserId: string | null = null;
export const peerList: Record<string, RTCPeerConnection | undefined> = {};
export let rtcWS: RTCWebSocketClient | null = null;
export let myRoomID = "1";
let localStream: MediaStream | null = null;

const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: true
};

let audioMuted = false;
let videoMuted = false;

let myVideo = getId("local_vid") as HTMLVideoElement | null;

export async function initializeVideoComponent() {
  initialiseSelfVideo();
}
export async function enterVoiceChannel(
  newVoiceChannelGuildId: string,
  newVoiceChannelId: string
) {
  const muteButton = getId("microphone-button");
  const toggleCamera = getId("camera-sound-panel");
  const closeCallButton = getId("close-call-button");
  joinVoiceChannel(newVoiceChannelId, newVoiceChannelGuildId);

  toggleSoundPanel(true);
  setAudioMuteState(audioMuted);

  if (muteButton) {
    toggleIconClass(muteButton, audioMuted);
    muteButton.addEventListener("click", () => {
      audioMuted = !audioMuted;
      setAudioMuteState(audioMuted);
      toggleIconClass(muteButton, audioMuted);
    });
  }

  if (toggleCamera) {
    toggleCamera.addEventListener("click", async () => {
      videoMuted = !videoMuted;
      toggleCameraUI(videoMuted);
      if (videoMuted) {
        stopCamera();
      } else {
        await startCamera();
      }
      toggleCameraUI(videoMuted);
    });
  }

  if (closeCallButton) {
    closeCallButton.addEventListener("click", closeCall);
  }

  setRTCWsClient(initialState.rtcWsUrl);
  setRtcStatus(false, true);

  await startCamera();
}
function toggleSoundPanel(val: boolean) {
  if (val) {
    enableElement("sound-panel");
  } else {
    disableElement("sound-panel");
  }
}
function closeCall() {
  stopCamera();
  toggleSoundPanel(false);
}

export async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    localStream = stream;

    if (myVideo) {
      myVideo.srcObject = stream;
      myVideo.onloadedmetadata = () => myVideo?.play().catch(console.error);
    }

    setAudioMuteState(audioMuted);
    setVideoMuteState(videoMuted);
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      alertUser("Permission denied by the user.");
    } else if (err.name === "NotFoundError") {
      alertUser("No media devices found.");
    } else {
      alertUser("Error accessing camera: " + err);
    }
    console.error("Error accessing camera:", err);
  }
}

export function stopCamera() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (myVideo) myVideo.srcObject = null;
}

export function isCameraActive(): boolean {
  return (
    localStream !== null &&
    localStream.getTracks().some((track) => track.readyState === "live")
  );
}

export function closeConnection(peer_id: string) {
  const pc = peerList[peer_id];
  if (pc) {
    pc.close();
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onnegotiationneeded = null;
    delete peerList[peer_id];
  } else {
    console.warn(`Peer connection for peer_id ${peer_id} does not exist.`);
  }
}
function toggleCameraUI(bool: boolean) {
  const closedVideoSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" width="24" height="24" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px); content-visibility: visible;" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="__lottie_element_330"><rect width="24" height="24" x="0" y="0"></rect></clipPath><clipPath id="__lottie_element_332"><path d="M0,0 L600,0 L600,600 L0,600z"></path></clipPath><clipPath id="__lottie_element_336"><path d="M0,0 L1000,0 L1000,1000 L0,1000z"></path></clipPath><clipPath id="__lottie_element_343"><path d="M0,0 L1000,0 L1000,1000 L0,1000z"></path></clipPath><clipPath id="__lottie_element_353"><path d="M0,0 L600,0 L600,600 L0,600z"></path></clipPath><mask id="__lottie_element_354"><rect fill="#ffffff" width="600" height="600" transform="matrix(1,0,0,1,0,0)"></rect><path fill="#000000" clip-rule="nonzero" d=" M481.2200012207031,12.795999526977539 C481.2200012207031,12.795999526977539 15.696999549865723,481.75 15.696999549865723,481.75 C15.696999549865723,481.75 -48.2400016784668,549.2319946289062 1.1369999647140503,598.8619995117188 C55,653 119.68000030517578,585.0560302734375 119.68000030517578,585.0560302734375 C119.68000030517578,585.0560302734375 585.2030029296875,116.10199737548828 585.2030029296875,116.10199737548828 C585.2030029296875,116.10199737548828 668,34 616.2150268554688,-15.553999900817871 C564.781005859375,-64.77200317382812 481.2200012207031,12.795999526977539 481.2200012207031,12.795999526977539" fill-opacity="1"></path></mask><clipPath id="__lottie_element_361"><path d="M0,0 L600,0 L600,600 L0,600z"></path></clipPath><mask id="__lottie_element_362"><rect fill="#ffffff" width="600" height="600" transform="matrix(1,0,0,1,0,0)"></rect><path fill="#000000" clip-rule="nonzero" d=" M-132.55599975585938,623.5819702148438 C-132.55599975585938,623.5819702148438 -326.1109924316406,817.5659790039062 -326.1109924316406,817.5659790039062 C-326.1109924316406,817.5659790039062 -276.4460144042969,866.9080200195312 -276.4460144042969,866.9080200195312 C-276.4460144042969,866.9080200195312 -222.1280059814453,920.8720092773438 -222.1280059814453,920.8720092773438 C-222.1280059814453,920.8720092773438 -28.572999954223633,726.8880004882812 -28.572999954223633,726.8880004882812 C-28.572999954223633,726.8880004882812 39.9010009765625,660.1279907226562 -12.895000457763672,609.9000244140625 C-69.7760009765625,555.7860107421875 -132.55599975585938,623.5819702148438 -132.55599975585938,623.5819702148438" fill-opacity="1"></path></mask></defs><g clip-path="url(#__lottie_element_330)"><g clip-path="url(#__lottie_element_332)" style="display: block;" transform="matrix(0.03999999910593033,0,0,0.03999999910593033,0,0)" opacity="1"><g clip-path="url(#__lottie_element_361)" style="display: none;" transform="matrix(1,0,0,1,0,0)" opacity="1"><g mask="url(#__lottie_element_362)"><g style="display: block;" transform="matrix(25,0,0,25,0,0)" opacity="1"><g opacity="1" transform="matrix(1,0,0,1,9.5,12)"><path fill="rgb(88,101,242)" fill-opacity="1" d=" M-5.5,-8 C-5.5,-8 -1.253999948501587,-8 -1.253999948501587,-8 C-1.253999948501587,-8 5.5,-8 5.5,-8 C7.1570000648498535,-8 8.5,-6.6570000648498535 8.5,-5 C8.5,-5 8.5,5 8.5,5 C8.5,6.6570000648498535 7.1570000648498535,8 5.5,8 C5.5,8 0.13199999928474426,8 0.13199999928474426,8 C0.13199999928474426,8 -5.5,8 -5.5,8 C-7.1570000648498535,8 -8.5,6.6570000648498535 -8.5,5 C-8.5,5 -8.5,-5 -8.5,-5 C-8.5,-6.6570000648498535 -7.1570000648498535,-8 -5.5,-8z"></path></g><g opacity="1" transform="matrix(1,0,0,1,20.5,12)"><path fill="rgb(88,101,242)" fill-opacity="1" d=" M-2.5,-2.881999969482422 C-2.5,-3.260999917984009 -2.2860000133514404,-3.6070001125335693 -1.9470000267028809,-3.7760000228881836 C-1.9470000267028809,-3.7760000228881836 1.0529999732971191,-5.276000022888184 1.0529999732971191,-5.276000022888184 C1.718000054359436,-5.609000205993652 2.5,-5.125 2.5,-4.381999969482422 C2.5,-4.381999969482422 2.5,4.381999969482422 2.5,4.381999969482422 C2.5,5.125 1.718000054359436,5.609000205993652 1.0529999732971191,5.276000022888184 C1.0529999732971191,5.276000022888184 -1.9470000267028809,3.7760000228881836 -1.9470000267028809,3.7760000228881836 C-2.2860000133514404,3.6070001125335693 -2.5,3.260999917984009 -2.5,2.881999969482422 C-2.5,2.881999969482422 -4.019999980926514,0 -4.019999980926514,0 C-4.019999980926514,0 -2.5,-2.881999969482422 -2.5,-2.881999969482422z"></path></g></g></g></g><g clip-path="url(#__lottie_element_353)" style="display: block;" transform="matrix(1,0,0,1,0,0)" opacity="1"><g mask="url(#__lottie_element_354)"><g style="display: block;" transform="matrix(25,0,0,25,0,0)" opacity="1"><g opacity="1" transform="matrix(1,0,0,1,9.5,12)"><path fill="rgb(88,101,242)" fill-opacity="1" d=" M-5.5,-8 C-5.5,-8 -1.253999948501587,-8 -1.253999948501587,-8 C-1.253999948501587,-8 5.5,-8 5.5,-8 C7.1570000648498535,-8 8.5,-6.6570000648498535 8.5,-5 C8.5,-5 8.5,5 8.5,5 C8.5,6.6570000648498535 7.1570000648498535,8 5.5,8 C5.5,8 0.13199999928474426,8 0.13199999928474426,8 C0.13199999928474426,8 -5.5,8 -5.5,8 C-7.1570000648498535,8 -8.5,6.6570000648498535 -8.5,5 C-8.5,5 -8.5,-5 -8.5,-5 C-8.5,-6.6570000648498535 -7.1570000648498535,-8 -5.5,-8z"></path></g><g opacity="1" transform="matrix(1,0,0,1,20.5,12)"><path fill="rgb(88,101,242)" fill-opacity="1" d=" M-2.5,-2.881999969482422 C-2.5,-3.260999917984009 -2.2860000133514404,-3.6070001125335693 -1.9470000267028809,-3.7760000228881836 C-1.9470000267028809,-3.7760000228881836 1.0529999732971191,-5.276000022888184 1.0529999732971191,-5.276000022888184 C1.718000054359436,-5.609000205993652 2.5,-5.125 2.5,-4.381999969482422 C2.5,-4.381999969482422 2.5,4.381999969482422 2.5,4.381999969482422 C2.5,5.125 1.718000054359436,5.609000205993652 1.0529999732971191,5.276000022888184 C1.0529999732971191,5.276000022888184 -1.9470000267028809,3.7760000228881836 -1.9470000267028809,3.7760000228881836 C-2.2860000133514404,3.6070001125335693 -2.5,3.260999917984009 -2.5,2.881999969482422 C-2.5,2.881999969482422 -3.1675777435302734,-0.012422150000929832 -3.1675777435302734,-0.012422150000929832 C-3.1675777435302734,-0.012422150000929832 -2.5,-2.881999969482422 -2.5,-2.881999969482422z"></path></g></g></g></g><g clip-path="url(#__lottie_element_343)" style="display: none;" transform="matrix(1,0,0,1,-200,-200)" opacity="1"><g style="display: none;" transform="matrix(25,0,0,25,200,200)" opacity="1"><g opacity="1" transform="matrix(1,0,0,1,12,12)"><path stroke-linecap="round" stroke-linejoin="miter" fill-opacity="0" stroke-miterlimit="4" stroke="rgb(88,101,242)" stroke-opacity="1" stroke-width="2" d=" M-10,10 C-10,10 10,-10 10,-10"></path></g></g><g style="display: none;"><g><path stroke-linecap="round" stroke-linejoin="miter" fill-opacity="0" stroke-miterlimit="4"></path></g></g></g><g clip-path="url(#__lottie_element_336)" style="display: block;" transform="matrix(1,0,0,1,-200,-200)" opacity="1"><g style="display: block;" transform="matrix(25,0,0,25,200,200)" opacity="1"><g opacity="1" transform="matrix(1,0,0,1,12,12)"><path stroke-linecap="round" stroke-linejoin="miter" fill-opacity="0" stroke-miterlimit="4" stroke="rgb(88,101,242)" stroke-opacity="1" stroke-width="2" d=" M-10,10 C-10,10 10,-10 10,-10"></path></g></g></g></g></g></svg>`;
  if (bool) {
    const panelbtn = getId("sound-panel-button");
    if (panelbtn) panelbtn.innerHTML = closedVideoSvg;
  }
}
function toggleIconClass(button: HTMLElement, isMuted: boolean) {
  const icon = button.querySelector(".icon") as HTMLElement | null;
  if (!icon) return;
  if (isMuted) {
    icon.classList.remove("fa-microphone");
    icon.classList.add("fa-microphone-slash", "icon-off");
  } else {
    icon.classList.remove("fa-microphone-slash", "icon-off");
    icon.classList.add("fa-microphone");
  }
}

function makeVideoElementCustom(
  element_id: string,
  display_name: string
): HTMLVideoElement {
  const vid = document.createElement("video");
  vid.id = "vid_" + element_id;
  vid.style.zIndex = "10";
  vid.autoplay = true;
  return vid;
}

export function addVideoElement(element_id: string, display_name: string) {
  console.log("Displaying video for: ", element_id, display_name);
  if (element_id === currentVoiceUserId) {
    console.warn(element_id, currentVoiceUserId);
    return;
  }
  const grid = getId("video_grid");
  if (grid) {
    grid.appendChild(makeVideoElementCustom(element_id, display_name));
  }
  checkVideoLayout();
}

export function removeVideoElement(element_id: string) {
  const v = getVideoObj(element_id) as HTMLVideoElement | null;
  if (!v) return;

  if (v.srcObject) {
    (v.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
  }
  v.removeAttribute("srcObject");
  v.removeAttribute("src");

  const el = getId("vid_" + element_id);
  if (el) el.remove();
}

export function getVideoObj(element_id: string): HTMLVideoElement | null {
  const el = getId("vid_" + element_id);
  return el instanceof HTMLVideoElement ? el : null;
}

function setAudioMuteState(flag: boolean) {
  if (!myVideo) return;
  const local_stream = myVideo.srcObject as MediaStream | null;
  if (local_stream) {
    local_stream.getAudioTracks().forEach((track) => {
      track.enabled = !flag;
    });
  }
}

function setVideoMuteState(flag: boolean) {
  const local_stream = myVideo?.srcObject as MediaStream | null;
  if (local_stream) {
    local_stream.getVideoTracks().forEach((track) => {
      track.enabled = !flag;
    });
  }
}
