import { cacheInterface } from "./cache";
import { currentVoiceChannelGuild, currentVoiceChannelId } from "./channels";
import { getVideoObj, getUserMedia } from "./chatroom";
import { rtcWsClient } from "./socketEvents";
import { translations } from "./translations";
import { DataMessage } from "./types/interfaces";
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
  } catch {
    localStream = createBlackStream();
  }

  const el = getId("local_vid") as HTMLVideoElement | null;
  if (el) setupVideoElement(el, localStream, true);
  return localStream;
}

function sendViaServer(data: DataMessage) {
  rtcWsClient.sendToPeer(data.targetId, data);
}

class PeerConnectionWrapper {
  private pc: RTCPeerConnection;
  private peerId: string;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private sentCandidates = new Set<string>();

  constructor(peerId: string) {
    this.peerId = peerId;
    this.pc = new RTCPeerConnection(PC_CONFIG);
    this.registerEvents();
    this.attachLocalStream();
  }

  private registerEvents() {
    this.pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      const key = `${event.candidate.sdpMid}:${event.candidate.sdpMLineIndex}:${event.candidate.candidate}`;
      if (this.sentCandidates.has(key)) return;
      this.sentCandidates.add(key);

      sendViaServer({
        senderId: currentUserId!,
        targetId: this.peerId,
        type: "candidate",
        candidate: event.candidate.toJSON()
      });
    };

    this.pc.ontrack = (event) => {
      if (!event.streams || !event.streams[0]) return;
      const videoEl = getVideoObj(this.peerId);
      if (!videoEl) return;
      setupVideoElement(videoEl, event.streams[0]);
      const placeholder = videoEl.parentElement?.querySelector(
        ".video-placeholder"
      ) as HTMLElement | null;
      if (placeholder) placeholder.style.display = "none";
    };
  }

  private async attachLocalStream() {
    const stream = await getOrCreateLocalStream();
    const existingTracks = this.pc
      .getSenders()
      .map((s) => s.track)
      .filter(Boolean);

    stream.getTracks().forEach((track) => {
      if (!existingTracks.includes(track)) {
        this.pc.addTrack(track, stream);
      }
    });
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    sendViaServer({
      senderId: currentUserId!,
      targetId: this.peerId,
      type: "offer",
      sdp: this.pc.localDescription!
    });
  }

  async handleOffer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    sendViaServer({
      senderId: currentUserId!,
      targetId: this.peerId,
      type: "answer",
      sdp: this.pc.localDescription!
    });

    this.flushPending();
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.flushPending();
  }

  async handleCandidate(candidate: RTCIceCandidateInit) {
    if (this.pc.remoteDescription) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        this.pendingCandidates.push(candidate);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  private flushPending() {
    this.pendingCandidates.forEach((c) =>
      this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(logError)
    );
    this.pendingCandidates = [];
  }

  getConnectionState() {
    return this.pc.iceConnectionState;
  }

  close() {
    this.pc.close();
  }
}

const peers = new Map<string, PeerConnectionWrapper>();

export async function invite(peerId: string) {
  if (peerId === currentUserId) return;
  if (peers.has(peerId)) return;

  const wrapper = new PeerConnectionWrapper(peerId);
  peers.set(peerId, wrapper);
  await wrapper.createOffer();
}

export function handleSignalingMessage(msg: DataMessage) {
  const peerId = msg.senderId;
  if (!peerId) return;

  if (!peers.has(peerId)) {
    peers.set(peerId, new PeerConnectionWrapper(peerId));
  }

  const wrapper = peers.get(peerId)!;

  switch (msg.type) {
    case "offer":
      wrapper.handleOffer(msg.sdp);
      break;
    case "answer":
      wrapper.handleAnswer(msg.sdp);
      break;
    case "candidate":
      wrapper.handleCandidate(msg.candidate);
      break;
  }
}

export function closeConnection(peerId: string) {
  const wrapper = peers.get(peerId);
  if (!wrapper) return;
  wrapper.close();
  peers.delete(peerId);
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
