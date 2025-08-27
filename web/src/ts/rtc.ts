import { cacheInterface } from "./cache";
import { currentVoiceChannelGuild, currentVoiceChannelId } from "./channels";
import { peerList, getVideoObj, currentVoiceUserId } from "./chatroom";
import { DataMessage, rtcWsClient } from "./socketEvents";
import { translations } from "./translations";
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

let isRenderingBlackScreen = false;

function logError(e: any) {
  console.error("[ERROR]", e);
}

function sendViaServer(data: DataMessage) {
  rtcWsClient.sendToPeer(data.target_id, data);
}

export function startWebRTC() {
  for (const peerId in peerList) {
    if (peerId !== currentVoiceUserId) {
      invite(peerId);
    }
  }
}

async function invite(peerId: string) {
  if (peerList[peerId]) return;
  if (peerId === currentVoiceUserId) return;

  createPeerConnection(peerId);

  const localStream = getStream();
  if (localStream) {
    localStream
      .getTracks()
      .forEach((track) => peerList[peerId]?.addTrack(track, localStream));
  }
  await waitForConnection(peerId);
}

function waitForConnection(peerId: string) {
  return new Promise<void>((resolve) => {
    const pc = peerList[peerId];
    if (!pc) return resolve();
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        console.log(`Peer <${peerId}> connected.`);
        resolve();
      }
    };
  });
}

function createPeerConnection(peerId: string) {
  const pc = new RTCPeerConnection(PC_CONFIG);
  peerList[peerId] = pc;

  pc.onicecandidate = (event) => handleICECandidateEvent(event, peerId);
  pc.ontrack = (event) => handleTrackEvent(event, peerId);
  pc.onnegotiationneeded = () => handleNegotiationNeededEvent(peerId);
}

function handleNegotiationNeededEvent(peerId: string) {
  const pc = peerList[peerId];
  if (!pc) return;

  pc.createOffer()
    .then((offer) => pc.setLocalDescription(offer))
    .then(() => {
      console.log(`Sending offer to <${peerId}>...`);
      sendViaServer({
        sender_id: currentVoiceUserId!,
        target_id: peerId,
        type: "offer",
        sdp: pc.localDescription!
      });
    })
    .catch(logError);
}

function getStream(): MediaStream | null {
  const myVideo = getId("myVideo") as HTMLVideoElement | null;
  if (myVideo && myVideo.srcObject) return myVideo.srcObject as MediaStream;
  if (isRenderingBlackScreen) return createBlackStream();
  return null;
}

export function handleOfferMsg(msg: DataMessage) {
  const peerId = msg.sender_id;
  createPeerConnection(peerId);

  const pc = peerList[peerId];
  if (!pc || !msg.sdp) return;

  pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    .then(() => {
      const localStream = getStream();
      if (localStream) {
        localStream
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStream));
      }
    })
    .then(() => pc.createAnswer())
    .then((answer) => pc.setLocalDescription(answer))
    .then(() => {
      console.log(`Sending answer to <${peerId}>...`);
      sendViaServer({
        sender_id: currentVoiceUserId!,
        target_id: peerId,
        type: "answer",
        sdp: pc.localDescription!
      });
    })
    .catch(logError);
}

export function handleAnswerMsg(msg: DataMessage) {
  const peerId = msg.sender_id;
  const pc = peerList[peerId];
  if (!pc || !msg.sdp) return;

  pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(logError);
}

function handleICECandidateEvent(
  event: RTCPeerConnectionIceEvent,
  peerId: string
) {
  if (event.candidate) {
    sendViaServer({
      sender_id: currentVoiceUserId!,
      target_id: peerId,
      type: "newIceCandidate",
      candidate: event.candidate.toJSON()
    });
  }
}

export function handleNewICECandidateMsg(msg: DataMessage) {
  const peerId = msg.sender_id;
  const pc = peerList[peerId];
  if (!pc || !msg.candidate) return;

  pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(logError);
}

function handleTrackEvent(event: RTCTrackEvent, peerId: string) {
  console.log(`Track event received from <${peerId}>`);
  if (event.streams && event.streams[0]) {
    const videoEl = getVideoObj(peerId);
    if (videoEl) videoEl.srcObject = event.streams[0];
  }
}
const soundStatus = getId("sound-panel-status");
const soundChannel = getId("sound-panel-channel");
const soundConnIcon = getId("sound-connection-icon");

export function setRtcStatus(status: boolean, isWaiting?: boolean) {
  if (!soundStatus) return;
  if (!soundConnIcon) return;
  if (!soundChannel) return;

  if (isWaiting) {
    soundStatus.textContent = translations.getTranslation("connecting");
    return;
  }

  const translation = status
    ? "sound-connection-established"
    : "sound-connection-failed";
  soundChannel.textContent =
    cacheInterface.getGuildName(currentVoiceChannelGuild) +
    cacheInterface.getChannelName(
      currentVoiceChannelGuild,
      currentVoiceChannelId
    );
  soundStatus.textContent = translations.getTranslation(translation);
  soundStatus.classList.toggle("voice-critical", !status);
  soundConnIcon.style.color = status ? "#29c770" : "red";
}
