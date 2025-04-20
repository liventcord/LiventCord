import { CachedChannel, cacheInterface, guildCache } from "./cache.ts";
import { refreshUserProfile } from "./avatar.ts";
import { currentUserId } from "./user.ts";
import {
  currentVoiceChannelId,
  setCurrentVoiceChannelId,
  setCurrentVoiceChannelGuild,
  currentChannelName,
  handleChannelDelete,
  ChannelData,
  editChannelName,
  handleNewChannel,
  getChannelsUl
} from "./channels.ts";
import { getId, enableElement, convertKeysToCamelCase } from "./utils.ts";
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
  handleEditMessage
} from "./chat.ts";
import { isOnGuild } from "./router.ts";
import { currentGuildId } from "./guild.ts";
import { chatContainer } from "./chatbar.ts";
import { handleFriendEventResponse } from "./friends.ts";
import { playAudio, clearVoiceChannel } from "./audio.ts";
import { userStatus } from "./app.ts";
import { apiClient } from "./api.ts";

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
  GET_USER_STATUS: "GET_USER_STATUS"
} as const);

type SocketEventType = keyof typeof SocketEvent;

class WebSocketClient {
  private socket!: WebSocket;
  private eventHandlers: Record<string, ((...args: any[]) => any)[]> = {};
  private socketUrl: string = "";
  private retryCount: number = 0;
  private maxRetryDelay: number = 30000;
  private static instance: WebSocketClient | null = null;
  private heartbeatInterval: number = 30000;
  private heartbeatTimer: number | null = null;
  private pendingRequests: Array<() => void> = [];
  private inProgressRequests: Set<string> = new Set();
  private hasReconnected: boolean = false;

  private constructor(url: string = "") {
    this.socketUrl = url;
    if (this.socketUrl) {
      this.connectSocket();
    }
  }

  private async connectSocket() {
    const cookie = await getAuthCookie();
    this.socket = new WebSocket(this.socketUrl, [`cookie-${cookie}`]);
    this.attachHandlers();
  }

  getUserStatus(userIds: string[]) {
    if (
      userIds.length < 1 ||
      userIds.some((id) => typeof id !== "string" || id.trim() === "")
    )
      return;

    userIds.forEach((userId) => {
      if (this.inProgressRequests.has(userId)) {
        return;
      }

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
  private attachHandlers() {
    this.socket.onopen = () => {
      console.log("Connected to WebSocket server");
      this.retryCount = 0;
      this.startHeartbeat();
      this.processPendingRequests();
      if (this.hasReconnected) {
        apiClient.onWebsocketReconnect();
      }
      this.hasReconnected = true;
    };

    this.socket.onmessage = (event) => {
      console.log("Received message:", event.data);
      try {
        const message = JSON.parse(event.data);
        const { event_type, payload } = message;

        if (Object.values(SocketEvent).includes(event_type)) {
          const eventEnumValue = event_type as SocketEventType;
          const camelCasedPayload = convertKeysToCamelCase(payload);

          if (this.eventHandlers[eventEnumValue]) {
            this.eventHandlers[eventEnumValue].forEach((handler) => {
              console.log("Calling handler with payload:", camelCasedPayload);
              handler(camelCasedPayload);
            });
          } else {
            console.log("No handler for event type:", event_type);
          }
        } else {
          console.log("Invalid event type:", event_type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    this.socket.onclose = (event) => {
      if (event.wasClean) {
        console.log("Closed cleanly:", event.code, event.reason);
      } else {
        console.error("Connection interrupted");
        const retryDelay = Math.min(
          Math.pow(2, this.retryCount) * 1000,
          this.maxRetryDelay
        );
        console.log(`Retrying connection in ${retryDelay / 1000} seconds...`);
        setTimeout(() => this.reconnect(), retryDelay);
        this.retryCount = Math.min(this.retryCount + 1, 10);
      }
      this.stopHeartbeat();
    };
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "ping" }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  private async reconnect() {
    const previousHandlers = this.eventHandlers;
    await this.connectSocket();
    this.eventHandlers = previousHandlers;
  }

  private processPendingRequests() {
    while (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      if (request) {
        request();
      }
    }
  }

  public static getInstance(url: string = ""): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient(url);
    }
    return WebSocketClient.instance;
  }

  on(eventType: SocketEventType, handler: (...args: any[]) => any) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  off(eventType: SocketEventType, handler: (...args: any[]) => any) {
    const handlers = this.eventHandlers[eventType];
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  send(event: SocketEventType, data: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pendingRequests.push(() => this.send(event, data));
      return;
    }
    const eventMessage = {
      event_type: event,
      payload: data
    };
    this.socket.send(JSON.stringify(eventMessage));
  }

  close() {
    this.socket.close();
  }

  async setSocketUrl(url: string) {
    if (!this.socketUrl) {
      this.socketUrl = url;
      await this.connectSocket();
    }
  }
}

let authCookie: string;
async function getAuthCookie(): Promise<string> {
  if (authCookie) return encodeURIComponent(authCookie);
  const response = await fetch(import.meta.env.VITE_BACKEND_URL + "/auth/ws-token");
  if (!response.ok) throw new Error("Failed to retrieve cookie");
  const data = await response.json();
  authCookie = data.cookieValue;
  return encodeURIComponent(data.cookieValue);
}

export const socketClient = WebSocketClient.getInstance();

export async function setSocketClient(wsUrl: string) {
  await socketClient.setSocketUrl(wsUrl);
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

export interface CreateChannelData extends CachedChannel {
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
    cacheInterface.setVoiceChannelMembers(channelId, voiceUsers);
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
