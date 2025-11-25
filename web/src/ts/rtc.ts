import { cacheInterface } from "./cache";
import { currentVoiceChannelGuild, currentVoiceChannelId } from "./channels";
import { peerList, getVideoObj, getUserMedia } from "./chatroom";
import { DataMessage, rtcWsClient } from "./socketEvents";
import { translations } from "./translations";
import { currentUserId } from "./user";
import { createBlackStream, getId } from "./utils";

const PC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302"
      ]
    }
  ]
};

let localStream: MediaStream | null = null;
const isRenderingBlackScreen = false;
const pendingCandidates: Record<string, RTCIceCandidateInit[]> = {};
const sentCandidates = new Set<string>();

function logError(e: any) {
  console.error("[RTC ERROR]", e);
}

function setupVideoElement(
  el: HTMLVideoElement,
  stream: MediaStream,
  muted = false
) {
  el.srcObject = stream;
  el.muted = muted;
  el.autoplay = true;
  el.playsInline = true;
  el.onloadedmetadata = () => el.play().catch(() => {});
}

async function getOrCreateLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;
  try {
    localStream = await getUserMedia();
  } catch (err) {
    console.error("Failed to get local media, using black stream", err);
    localStream = createBlackStream();
  }

  const el = getId("local_vid") as HTMLVideoElement | null;
  if (el) setupVideoElement(el, localStream, true);
  return localStream;
}

function sendViaServer(data: DataMessage) {
  console.log("Sending via server:", data);
  rtcWsClient.sendToPeer(data.targetId, data);
}

export async function invite(peerId: string) {
  if (peerList[peerId] || peerId === currentUserId) return;
  createPeerConnection(peerId);
  await waitForConnection(peerId);
}

export function startWebRTC() {
  for (const peerId in peerList) {
    if (peerId !== currentUserId) invite(peerId);
  }
}

function waitForConnection(peerId: string) {
  return new Promise<void>((resolve) => {
    const pc = peerList[peerId];
    if (!pc) return resolve();
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") resolve();
    };
  });
}

export function createPeerConnection(peerId: string) {
  if (peerList[peerId]) return;
  const pc = new RTCPeerConnection(PC_CONFIG);
  peerList[peerId] = pc;

  pc.onicecandidate = (event) => handleICECandidateEvent(event, peerId);
  pc.ontrack = (event) => handleTrackEvent(event, peerId);

  getOrCreateLocalStream()
    .then((stream) => {
      if (!stream) return handleNegotiationNeededEvent(peerId);
      const existingTracks = pc
        .getSenders()
        .map((s) => s.track)
        .filter(Boolean);
      stream.getTracks().forEach((track) => {
        if (!existingTracks.includes(track)) pc.addTrack(track, stream);
      });
      handleNegotiationNeededEvent(peerId);
    })
    .catch(logError);
}

function handleNegotiationNeededEvent(peerId: string) {
  const pc = peerList[peerId];
  if (!pc) return;

  pc.createOffer()
    .then((offer) =>
      pc.setLocalDescription(offer).then(() =>
        sendViaServer({
          senderId: currentUserId!,
          targetId: peerId,
          type: "offer",
          sdp: pc.localDescription!
        })
      )
    )
    .catch(logError);
}

export async function handleOfferMsg(msg: DataMessage) {
  const peerId = msg.senderId;
  if (!peerId) return;
  if (!peerList[peerId]) createPeerConnection(peerId);
  const pc = peerList[peerId];
  if (!pc || !msg.sdp) return;

  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  sendViaServer({
    senderId: currentUserId!,
    targetId: peerId,
    type: "answer",
    sdp: pc.localDescription!
  });
  flushPendingCandidates(peerId);
}

export function handleAnswerMsg(msg: DataMessage) {
  const pc = peerList[msg.senderId];
  if (!pc || !msg.sdp) return;
  pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    .then(() => flushPendingCandidates(msg.senderId))
    .catch(logError);
}

function handleICECandidateEvent(
  event: RTCPeerConnectionIceEvent,
  peerId: string
) {
  if (!event.candidate) return;
  const key = `${event.candidate.sdpMid}:${event.candidate.sdpMLineIndex}:${event.candidate.candidate}`;
  if (sentCandidates.has(key)) return;
  sentCandidates.add(key);

  sendOrQueueIceCandidate(peerId, event.candidate);
}

export function handleNewICECandidateMsg(msg: DataMessage) {
  const peerId = msg.senderId;
  if (!peerId || !msg.candidate) return;
  sendOrQueueIceCandidate(peerId, msg.candidate);
}

async function sendOrQueueIceCandidate(
  peerId: string,
  candidate: RTCIceCandidateInit
) {
  const pc = peerList[peerId];
  if (!pc) return;

  if (pc.remoteDescription && pc.remoteDescription.type) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err: any) {
      if (
        err.name === "OperationError" ||
        err.message.includes("Unknown ufrag")
      ) {
        if (!pendingCandidates[peerId]) pendingCandidates[peerId] = [];
        pendingCandidates[peerId].push(candidate);
      } else {
        logError(err);
      }
    }
  } else {
    if (!pendingCandidates[peerId]) pendingCandidates[peerId] = [];
    pendingCandidates[peerId].push(candidate);
  }
}

function flushPendingCandidates(peerId: string) {
  const pc = peerList[peerId];
  if (!pc || !pc.remoteDescription) return;
  if (!pendingCandidates[peerId]) return;

  pendingCandidates[peerId].forEach((c) =>
    pc.addIceCandidate(new RTCIceCandidate(c)).catch(logError)
  );
  delete pendingCandidates[peerId];
}

export function handleTrackEvent(event: RTCTrackEvent, peerId: string) {
  if (!event.streams || !event.streams[0]) return;
  const videoEl = getVideoObj(peerId);
  if (!videoEl) return;

  setupVideoElement(videoEl, event.streams[0]);
  const placeholder = videoEl.parentElement?.querySelector(
    ".video-placeholder"
  ) as HTMLElement | null;
  if (placeholder) placeholder.style.display = "none";
}

const soundStatus = getId("sound-panel-status");
const soundChannel = getId("sound-panel-channel");
const soundConnIcon = getId("sound-connection-icon");

export function setRtcStatus(status: boolean, isWaiting?: boolean) {
  if (!soundStatus || !soundConnIcon || !soundChannel) return;
  soundStatus.textContent = isWaiting
    ? translations.getTranslation("connecting")
    : translations.getTranslation(
        status ? "sound-connection-established" : "sound-connection-failed"
      );

  soundStatus.classList.toggle("voice-critical", !status);

  soundChannel.textContent =
    cacheInterface.getGuildName(currentVoiceChannelGuild) +
    " / " +
    cacheInterface.getChannelName(
      currentVoiceChannelGuild,
      currentVoiceChannelId
    );

  soundConnIcon.style.color = status ? "#29c770" : "red";
}

export function getStream(): MediaStream | null {
  return localStream || (isRenderingBlackScreen ? createBlackStream() : null);
}
