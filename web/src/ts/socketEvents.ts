import { CachedChannel, cacheInterface, guildCache } from "./cache.ts";
import { refreshUserProfile } from "./avatar.ts";
import { currentUserId, UserInfo, userManager } from "./user.ts";
import {
  currentVoiceChannelId,
  setCurrentVoiceChannelId,
  setCurrentVoiceChannelGuild,
  currentChannelName,
  handleChannelDelete,
  ChannelData,
  editChannelName,
  handleNewChannel,
  getChannelsUl,
  currentVoiceChannelGuild
} from "./channels.ts";
import {
  getId,
  enableElement,
  convertKeysToCamelCase,
  disableElement
} from "./utils.ts";
import {
  deleteLocalMessage,
  getLastSecondMessageDate,
  Message
} from "./message.ts";
import {
  bottomestChatDateStr,
  setBottomestChatDateStr,
  setLastMessageDate,
  lastMessageDate,
  handleNewMessage,
  NewMessageResponse,
  EditMessageResponse,
  handleEditMessage,
  TypingData
} from "./chat.ts";
import { isOnGuild } from "./router.ts";
import {
  currentGuildId,
  handleGuildMemberAdded,
  handleKickMemberResponse
} from "./guild.ts";
import { chatContainer } from "./chatbar.ts";
import { friendsCache, handleFriendEventResponse } from "./friends.ts";
import {
  playAudio,
  clearVoiceChannel,
  playAudioType,
  AudioType
} from "./audio.ts";
import { userStatus } from "./app.ts";
import { apiClient } from "./api.ts";
import {
  peerList,
  addVideoElement,
  closeConnection,
  removeVideoElement,
  currentVoiceUserId
} from "./chatroom.ts";
import {
  createPeerConnection,
  handleAnswerMsg,
  handleNewICECandidateMsg,
  handleOfferMsg,
  setRtcStatus
} from "./rtc.ts";
import { alertUser } from "./ui.ts";
import store from "../store.ts";

const typingText = getId("typing-text") as HTMLElement;
export const typingStatusMap = new Map<string, Set<string>>();

export const SocketEvent = Object.freeze({
  CREATE_CHANNEL: "CREATE_CHANNEL",
  JOIN_GUILD: "JOIN_GUILD",
  LEAVE_GUILD: "LEAVE_GUILD",
  DELETE_GUILD: "DELETE_GUILD",
  DELETE_GUILD_IMAGE: "DELETE_GUILD_IMAGE",
  SEND_MESSAGE_GUILD: "SEND_MESSAGE_GUILD",
  SEND_MESSAGE_DM: "SEND_MESSAGE_DM",
  EDIT_MESSAGE_GUILD: "EDIT_MESSAGE_GUILD",
  EDIT_MESSAGE_DM: "EDIT_MESSAGE_DM",
  DELETE_MESSAGE_DM: "DELETE_MESSAGE_DM",
  DELETE_MESSAGE_GUILD: "DELETE_MESSAGE_GUILD",
  UPDATE_GUILD_NAME: "UPDATE_GUILD_NAME",
  UPDATE_GUILD_IMAGE: "UPDATE_GUILD_IMAGE",
  DELETE_CHANNEL: "DELETE_CHANNEL",
  START_TYPING: "START_TYPING",
  STOP_TYPING: "STOP_TYPING",
  ADD_FRIEND: "ADD_FRIEND",
  ACCEPT_FRIEND: "ACCEPT_FRIEND",
  REMOVE_FRIEND: "REMOVE_FRIEND",
  DENY_FRIEND: "DENY_FRIEND",
  CHANGE_NICK: "CHANGE_NICK",
  LEAVE_VOICE_CHANNEL: "LEAVE_VOICE_CHANNEL",
  JOIN_VOICE_CHANNEL: "JOIN_VOICE_CHANNEL",
  UPDATE_USER_NAME: "UPDATE_USER_NAME",
  UPDATE_USER_STATUS: "UPDATE_USER_STATUS",
  UPDATE_CHANNEL_NAME: "UPDATE_CHANNEL_NAME",
  GET_USER_STATUS: "GET_USER_STATUS",
  KICK_MEMBER: "KICK_MEMBER",
  GUILD_MEMBER_ADDED: "GUILD_MEMBER_ADDED"
} as const);

type EventHandler = (...args: any[]) => void;

export abstract class WebSocketClientBase {
  protected socket!: WebSocket;
  protected socketUrl: string = "";
  protected retryCount: number = 0;
  protected readonly maxRetryDelay: number = 30000;
  protected readonly heartbeatInterval: number = 30000;
  protected heartbeatTimer: number | null = null;
  protected pendingRequests: Array<() => void> = [];
  protected inProgressRequests: Set<string> = new Set();

  constructor(url: string = "") {
    this.socketUrl = url;
    if (this.socketUrl) {
      this.connectSocket();
    }
  }

  protected abstract handleEvent(message: any): void;

  protected async connectSocket(): Promise<void> {
    const cookie = await apiClient.getAuthCookie();
    if (cookie !== "undefined") {
      try {
        this.socket = new WebSocket(this.socketUrl, [`cookie-${cookie}`]);
        this.attachHandlers();
      } catch (err) {
        console.error("WebSocket connection failed", err);
      }
    }
  }

  public async setSocketUrl(url: string) {
    if (!this.socketUrl) {
      this.socketUrl = url;
      await this.connectSocket();
    }
  }

  private attachHandlers() {
    this.socket.onopen = () => {
      this.retryCount = 0;
      this.startHeartbeat();
      this.processPendingRequests();
      this.onOpen();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        this.handleEvent(message);
      } catch (err) {
        console.error("Error parsing WebSocket message", err);
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      if (!event.wasClean) {
        const retryDelay = Math.min(
          Math.pow(2, this.retryCount) * 1000,
          this.maxRetryDelay
        );
        setTimeout(() => this.reconnect(), retryDelay);
        this.retryCount = Math.min(this.retryCount + 1, 10);
      }
      this.onClose();
    };

    this.socket.onerror = (err: Event) => {
      console.error("WebSocket error", err);
      this.onError(err);
    };
  }

  protected onOpen(): void {}
  protected onClose(): void {}
  protected onError(err: any): void {}

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ event: "ping", data: {} }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  private processPendingRequests() {
    while (this.pendingRequests.length > 0) {
      const req = this.pendingRequests.shift();
      if (req) req();
    }
  }

  protected sendRaw(data: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pendingRequests.push(() => this.sendRaw(data));
      return;
    }
    this.socket.send(JSON.stringify(data));
  }

  public close() {
    this.socket.close();
  }

  private async reconnect() {
    await this.connectSocket();
  }
}
export interface VoiceUser {
  id: string;
  isNoisy: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}
interface UserListEvent {
  list: VoiceUser[];
  rtcUserId: string;
}

interface UserConnectEvent {
  sid: string;
}

interface UserDisconnectEvent {
  userId: string;
}

export interface DataMessage {
  type: "offer" | "answer" | "newIceCandidate";
  [key: string]: any;
}
interface Envelope<T = any> {
  event: string;
  data: T;
}

type ExistingUserList = {
  Guilds: {
    [guildId: string]: {
      [channelId: string]: string[];
    };
  };
  RtcUserId: string;
};

export class WebSocketClient extends WebSocketClientBase {
  private eventHandlers: Record<string, EventHandler[]> = {};
  private static instance: WebSocketClient | null = null;

  private constructor(url: string = "") {
    super(url);
  }

  protected handleEvent(message: any) {
    const { event_type, payload } = message;
    if (this.eventHandlers[event_type]) {
      const camelCasedPayload = convertKeysToCamelCase(payload);
      this.eventHandlers[event_type].forEach((handler) =>
        handler(camelCasedPayload)
      );
    } else {
      console.log("No handler for event type:", event_type);
    }
  }

  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  on(eventType: string, handler: EventHandler) {
    if (!this.eventHandlers[eventType]) this.eventHandlers[eventType] = [];
    this.eventHandlers[eventType].push(handler);
  }

  off(eventType: string, handler: EventHandler) {
    const handlers = this.eventHandlers[eventType];
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  }

  send(eventType: string, data: any) {
    this.sendRaw({ event_type: eventType, payload: data });
  }

  getUserStatus(userIds: string[]) {
    if (
      userIds.length < 1 ||
      userIds.some((id) => typeof id !== "string" || id.trim() === "")
    ) {
      return;
    }

    userIds.forEach((userId) => {
      if (this.inProgressRequests.has(userId)) return;
      this.inProgressRequests.add(userId);

      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.pendingRequests.push(() => this.getUserStatus([userId]));
        return;
      }
      this.send(SocketEvent.GET_USER_STATUS, { user_ids: [userId] });
    });
  }

  onUserIdAvailable() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.getUserStatus([currentUserId]);
    } else {
      this.pendingRequests.push(() => this.getUserStatus([currentUserId]));
    }
  }

  startTyping(channelId: string, guildId: string | null = null) {
    this.send(SocketEvent.START_TYPING, {
      channelId,
      guildId,
      routeType: guildId ? "guild" : "dm"
    });
    userStatus.updateUserOnlineStatus(currentUserId, "", true);
  }

  stopTyping(channelId: string, guildId: string | null = null) {
    this.send(SocketEvent.STOP_TYPING, {
      channelId,
      guildId,
      routeType: guildId ? "guild" : "dm"
    });
    userStatus.updateUserOnlineStatus(currentUserId, "", false);
  }
}

export class RTCWebSocketClient extends WebSocketClientBase {
  private static instance: RTCWebSocketClient | null = null;
  private currentRoomID = "";
  private myId: string = "";

  private constructor() {
    super();
  }

  public static getInstance(): RTCWebSocketClient {
    if (!RTCWebSocketClient.instance) {
      RTCWebSocketClient.instance = new RTCWebSocketClient();
    }
    return RTCWebSocketClient.instance;
  }

  public async setTokenAndUrl(serverUrl: string) {
    if (!this.socketUrl) {
      await this.setSocketUrl(`${serverUrl}/ws`);
    }
  }

  protected onOpen(): void {
    setRtcStatus(true);
  }

  protected onClose(): void {
    setRtcStatus(false);
  }
  public isOnRoom(channelId: string): boolean {
    return this.currentRoomID === channelId;
  }

  public joinRoom(guildId: string, channelId: string) {
    this.currentRoomID = channelId;
    this.sendRaw({
      event: "joinRoom",
      data: { guildId, roomId: channelId }
    });
  }
  public exitRoom() {
    if (
      !this.currentRoomID ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    )
      return;
    playAudioType(AudioType.ExitVC);
    this.sendRaw({
      event: "leaveRoom",
      data: { roomId: this.currentRoomID }
    });

    this.currentRoomID = "";
    store.dispatch("removeVoiceUser", {
      guildId: currentVoiceChannelGuild,
      channelId: currentVoiceChannelId,
      userId: currentUserId
    });
  }

  public switchRoom(newRoomID: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pendingRequests.push(() => this.switchRoom(newRoomID));
      return;
    }

    if (this.currentRoomID === newRoomID) return;

    if (this.currentRoomID) {
      this.sendRaw({
        event: "leaveRoom",
        data: { roomId: this.currentRoomID }
      });
    }

    this.currentRoomID = newRoomID;
    this.sendRaw({ event: "joinRoom", data: { roomId: newRoomID } });
  }
  public toggleMute() {
    this.sendRaw({ event: "toggleMute" });
  }
  public toggleDeafen() {
    this.sendRaw({ event: "toggleDeafen" });
  }

  protected async handleEvent(message: Envelope) {
    const { event, data } = message;
    console.log("Rtc ws event received: ", event);

    const processUserList = (channelId: string, users: VoiceUser[]) => {
      store.dispatch("updateVoiceUsers", { channelId, users });

      for (const user of users) {
        const peer_id = user.id;
        if (peer_id === currentVoiceUserId()) continue;

        if (!peerList[peer_id]) {
          const isOnSameChannel = currentVoiceChannelId === channelId;
          if (isOnSameChannel) {
            addVideoElement(peer_id, peer_id);
            createPeerConnection(peer_id);
          }
          store.dispatch("addVoiceUser", {
            channelId,
            userId: peer_id,
            isNoisy: user.isNoisy,
            isMuted: user.isMuted,
            isDeafened: user.isDeafened
          });
        } else {
          store.dispatch("updateVoiceUserStatus", {
            userId: peer_id,
            isNoisy: user.isNoisy,
            isMuted: user.isMuted,
            isDeafened: user.isDeafened
          });
        }
      }
    };

    switch (event) {
      case "userList": {
        const payload = data as UserListEvent;
        processUserList(currentVoiceChannelId, payload.list);
        break;
      }

      case "existingUserList": {
        const payload = data as ExistingUserList;
        if (!payload?.Guilds) return;

        for (const guildId in payload.Guilds) {
          const userIds = payload.Guilds[guildId];
          if (!Array.isArray(userIds)) continue;
          processUserList(guildId, userIds);
        }
        break;
      }

      case "userConnect": {
        const payload = data as UserConnectEvent;
        const peer_id: string = payload.sid;
        peerList[peer_id] = undefined;
        addVideoElement(peer_id, userManager.getUserNick(peer_id));
        store.dispatch("addVoiceUser", {
          channelId: currentVoiceChannelId,
          userId: peer_id
        });
        break;
      }

      case "userDisconnect": {
        const payload = data as UserDisconnectEvent;
        const left_peer_id = payload.userId;
        closeConnection(left_peer_id);
        removeVideoElement(left_peer_id);
        delete peerList[left_peer_id];
        store.dispatch("removeVoiceUser", {
          guildId: currentVoiceChannelGuild,
          channelId: currentVoiceChannelId,
          userId: left_peer_id
        });
        break;
      }

      case "data": {
        console.log("Received data : ", data);
        const msg = data as DataMessage;
        switch (msg.type) {
          case "offer":
            handleOfferMsg(msg);
            break;
          case "answer":
            handleAnswerMsg(msg);
            break;
          case "newIceCandidate":
            handleNewICECandidateMsg(msg);
            break;
          default:
            console.warn("Unknown signaling message:", msg);
        }
        break;
      }
      case "joined": {
        playAudioType(AudioType.EnterVC);
        setRtcStatus(true, false);
        break;
      }

      case "disconnect":
        console.log("Disconnected from server.", data);
        playAudioType(AudioType.ExitVC);
        break;
      case "userStatusUpdate":
        const status = data as {
          id: string;
          isNoisy: boolean;
          isMuted: boolean;
          isDeafened: boolean;
        };
        console.log("userStatusUpdate received:", status);
        store.commit("updateVoiceUserStatusMutation", {
          userId: status.id,
          isNoisy: status.isNoisy,
          isMuted: status.isMuted,
          isDeafened: status.isDeafened
        });
        break;

      default:
        console.error(message);
        alertUser("Unknown event received:", String(message));
    }
  }

  public sendToPeer(targetId: string, payload: DataMessage) {
    if (!targetId || targetId === this.myId) {
      console.warn("Attempted to send signaling to self, skipping:", targetId);
      return;
    }
    this.sendRaw({
      event: "data",
      data: {
        targetId,
        type: payload.type,
        sdp: payload.sdp,
        candidate: payload.candidate
      }
    });
  }
}
export const socketClient = WebSocketClient.getInstance();
export const rtcWsClient = RTCWebSocketClient.getInstance();

export async function setSocketClient(wsUrl: string) {
  await socketClient.setSocketUrl(wsUrl);
}

export async function setRTCWsClient(wsUrl: string) {
  await rtcWsClient.setSocketUrl(wsUrl);
}

interface UpdateUserData {
  userId: string;
  username?: string;
  avatarUrl?: string;
  status?: string;
}
interface UserStatusData {
  userId: string;
  status: string;
}

interface CreateChannelData extends CachedChannel {
  guildId: string;
  channelId: string;
  channelName: string;
  isTextChannel: boolean;
}

interface GuildMessageData {
  messages: Message[];
  guildId: string;
  channelId: string;
}

interface DMMessageData {
  message: Message[];
  channelId: string;
}
interface GuildEditMessageData {
  guildId: string;
  channelId: string;
  messageId: string;
  content: string;
}

interface DMEditMessageData {
  channelId: string;
  messageId: string;
  content: string;
}

const handleNewGuildMessage = (data: GuildMessageData) => {
  const messageData: NewMessageResponse = {
    guildId: data.guildId,
    isOldMessages: false,
    isDm: false,
    messages: data.messages,
    channelId: data.channelId
  };
  handleNewMessage(messageData);

  if (
    data.guildId === currentGuildId &&
    data.channelId === guildCache.currentChannelId
  ) {
    const typingData: TypingData = {
      userId: data.messages[0].userId,
      guildId: data.guildId,
      channelId: data.channelId
    };
    handleStopTyping(typingData);
  }
};

const handleNewDmMessage = (data: DMMessageData) => {
  const messageData: NewMessageResponse = {
    isOldMessages: false,
    messages: data.message,
    isDm: true,
    channelId: data.channelId
  };
  handleNewMessage(messageData);
};

const handleEditGuildMessage = (data: GuildEditMessageData) => {
  const messageData: EditMessageResponse = {
    guildId: data.guildId,
    isDm: false,
    messageId: data.messageId,
    channelId: data.channelId,
    content: data.content
  };
  handleEditMessage(messageData);
};

const handleEditDmMessage = (data: DMEditMessageData) => {
  const messageData: EditMessageResponse = {
    isDm: true,
    channelId: data.channelId,
    messageId: data.messageId,
    content: data.content
  };
  handleEditMessage(messageData);
};
socketClient.on(SocketEvent.SEND_MESSAGE_GUILD, (data: any) => {
  handleNewGuildMessage(data);
});
socketClient.on(SocketEvent.SEND_MESSAGE_DM, (data: any) => {
  handleNewDmMessage(data);
});
socketClient.on(SocketEvent.EDIT_MESSAGE_GUILD, (data: any) => {
  handleEditGuildMessage(data);
});
socketClient.on(SocketEvent.EDIT_MESSAGE_DM, (data: any) => {
  handleEditDmMessage(data);
});

socketClient.on(SocketEvent.UPDATE_USER_NAME, (data: UpdateUserData) => {
  refreshUserProfile(data.userId);
});

socketClient.on(SocketEvent.GET_USER_STATUS, (data: UserStatusData[]) => {
  data.forEach((_userStatus) => {
    const userId = _userStatus.userId;
    userStatus.updateUserOnlineStatus(userId, _userStatus.status);
  });
});
socketClient.on(SocketEvent.UPDATE_USER_STATUS, (data: UserStatusData) => {
  userStatus.updateUserOnlineStatus(data.userId, data.status);
});

socketClient.on(SocketEvent.CREATE_CHANNEL, (data: CreateChannelData) => {
  handleNewChannel(data);
});
socketClient.on(SocketEvent.UPDATE_CHANNEL_NAME, (data) => {
  if (data.guildId === currentGuildId) {
    editChannelName(data.channelId, data.channelName);
  }
});

export interface GuildMemberAddedMessage {
  guildId: string;
  userId: string;
  userData: UserInfo;
}
socketClient.on(
  SocketEvent.GUILD_MEMBER_ADDED,
  (data: GuildMemberAddedMessage) => {
    handleGuildMemberAdded(data);
  }
);

socketClient.on(SocketEvent.KICK_MEMBER, (data: any) => {
  handleKickMemberResponse(data);
});

socketClient.on(SocketEvent.START_TYPING, (data: TypingData) => {
  const isGuild = !!data.guildId;
  const isCurrent =
    (isGuild && data.channelId === guildCache.currentChannelId) ||
    (!isGuild && data.channelId === friendsCache.currentDmId);

  if (!isCurrent) return;

  if (!typingStatusMap.has(data.channelId)) {
    typingStatusMap.set(data.channelId, new Set());
  }

  typingStatusMap.get(data.channelId)!.add(data.userId);
  userStatus.updateUserOnlineStatus(data.userId, "", true);

  updateTypingText(data.channelId);
});

socketClient.on(SocketEvent.STOP_TYPING, (data: TypingData) => {
  handleStopTyping(data);
});
export function handleStopTyping(data: TypingData) {
  const isGuild = !!data.guildId;
  const isCurrent =
    (isGuild && data.channelId === guildCache.currentChannelId) ||
    (!isGuild && data.channelId === friendsCache.currentDmId);

  if (!isCurrent) return;

  const typingSet = typingStatusMap.get(data.channelId);
  if (typingSet) {
    typingSet.delete(data.userId);
    if (typingSet.size === 0) {
      typingStatusMap.delete(data.channelId);
    }
  }
  userStatus.updateUserOnlineStatus(data.userId, "", false);

  updateTypingText(data.channelId);
}

const typingBubbles = getId("typing-bubbles") as HTMLElement;

function updateTypingText(channelId: string) {
  const typingUsers = typingStatusMap.get(channelId);
  if (!typingUsers || typingUsers.size === 0) {
    typingText.textContent = "";
    disableElement(typingBubbles);
    return;
  }
  enableElement(typingBubbles);

  const names = Array.from(typingUsers).map((userId) =>
    userManager.getUserNick(userId)
  );
  if (names.length > 5) {
    typingText.textContent = "Several people are typing";
  } else if (names.length === 1) {
    typingText.textContent = `${names[0]} is typing`;
  } else {
    typingText.textContent = `${names.slice(0, 2).join(", ")}${names.length > 2 ? ", and others" : ""} are typing`;
  }
}

updateTypingText("");

interface DeleteMessageEmit {
  messageId: string;
  guildId: string;
  channelId: string;
  msgDate: string;
}

interface DeleteMessageResponse {
  messageId: string;
  channelId: string;
}

function processDeleteMessage(
  msgDate: string,
  channelId: string,
  messageId: string,
  isDm: boolean
) {
  const messageElement = chatContainer.querySelector(
    `[data-message-id="${messageId}"]`
  ) as HTMLElement;
  const msgDateElement = messageElement?.dataset.date;
  deleteLocalMessage(messageId, currentGuildId, channelId, isDm);
  cacheInterface.removeMessage(messageId, channelId, currentGuildId);

  if (msgDateElement && typeof lastMessageDate === "number") {
    const msgDateTimestamp = new Date(msgDateElement).setHours(0, 0, 0, 0);
    if (lastMessageDate === msgDateTimestamp) {
      setLastMessageDate(
        new Date(new Date(getLastSecondMessageDate()).setHours(0, 0, 0, 0))
      );
    }
  }

  if (bottomestChatDateStr === msgDateElement) {
    setBottomestChatDateStr(getLastSecondMessageDate());
  }
}

export function handleDeleteMessageResponse(
  data: DeleteMessageResponse,
  isDm: boolean
) {
  console.log(data);
  processDeleteMessage(data.messageId, data.channelId, data.messageId, isDm);
}

export function handleDeleteMessageEmit(
  data: DeleteMessageEmit,
  isDm: boolean
) {
  processDeleteMessage(data.msgDate, data.channelId, data.messageId, isDm);
}

socketClient.on(SocketEvent.DELETE_CHANNEL, (data: ChannelData) => {
  handleChannelDelete(data);
});

socketClient.on(SocketEvent.DELETE_CHANNEL, (data: ChannelData) => {
  handleChannelDelete(data);
});

socketClient.on(SocketEvent.DELETE_MESSAGE_DM, (data: DeleteMessageEmit) => {
  handleDeleteMessageEmit(data, true);
});

socketClient.on(SocketEvent.DELETE_MESSAGE_GUILD, (data: DeleteMessageEmit) => {
  handleDeleteMessageEmit(data, false);
});

socketClient.on(SocketEvent.ADD_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

socketClient.on(SocketEvent.ACCEPT_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

socketClient.on(SocketEvent.REMOVE_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

socketClient.on(SocketEvent.DENY_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

//audio
interface JoinVoiceResponse {
  channelId: string;
  guildId: string;
  usersList: string[];
}
socketClient.on(
  SocketEvent.JOIN_VOICE_CHANNEL,
  function (data: JoinVoiceResponse) {
    const channelId = data.channelId;
    const guildId = data.guildId;
    const voiceUsers = data.usersList;
    console.log(voiceUsers);
    if (!channelId) {
      console.error("Channel id is null on voice users response");
      return;
    }
    if (!guildId) {
      console.error("Guild id is null on voice users response");
      return;
    }
    playAudio("/sounds/joinvoice.mp3");
    clearVoiceChannel(currentVoiceChannelId);
    enableElement("sound-panel");

    setCurrentVoiceChannelId(channelId);
    if (isOnGuild) {
      setCurrentVoiceChannelGuild(guildId);
    }
    const soundInfoIcon = getId("sound-info-icon") as HTMLElement;
    soundInfoIcon.innerText = `${currentChannelName} / ${guildCache.currentGuildName}`;

    const buttonContainer = getChannelsUl().querySelector(
      `li[id="${currentVoiceChannelId}"]`
    ) as HTMLElement;
    const channelSpan = buttonContainer.querySelector(
      ".channelSpan"
    ) as HTMLElement;
    channelSpan.style.marginRight = "30px";
  }
);
interface IncomingAudioResponse {
  buffer: ArrayBuffer;
}

//socketClient.on(
//  SocketEvent.INCOMING_AUDIO,
//  async (data: IncomingAudioResponse) => {
//    await voiceHandler.handleAudio(data);
//  }
//);
