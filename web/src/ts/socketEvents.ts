import { CachedChannel, cacheInterface, guildCache } from "./cache.ts";
import { refreshUserProfile } from "./avatar.ts";
import { updateUserOnlineStatus } from "./user.ts";
import {
  addChannel,
  currentVoiceChannelId,
  setCurrentVoiceChannelId,
  setCurrentVoiceChannelGuild,
  currentChannelName,
  channelsUl,
  handleChannelDelete,
  ChannelData
} from "./channels.ts";
import { getId, enableElement } from "./utils.ts";
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
  handleMessage,
  MessageResponse
} from "./chat.ts";
import { isOnGuild } from "./router.ts";
import { playAudio, VoiceHandler, clearVoiceChannel } from "./audio.ts";
import { currentGuildId } from "./guild.ts";
import { chatContainer } from "./chatbar.ts";

const SocketEvent = Object.freeze({
  CREATE_CHANNEL: "CREATE_CHANNEL",
  JOIN_GUILD: "JOIN_GUILD",
  LEAVE_GUILD: "LEAVE_GUILD",
  DELETE_GUILD: "DELETE_GUILD",
  DELETE_GUILD_IMAGE: "DELETE_GUILD_IMAGE",
  SEND_MESSAGE_GUILD: "SEND_MESSAGE_GUILD",
  SEND_MESSAGE_DM: "SEND_MESSAGE_DM",
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
  CHANGE_GUILD_NAME: "CHANGE_GUILD_NAME",
  UPDATE_USER_NAME: "UPDATE_USER_NAME",
  UPDATE_USER_STATUS: "UPDATE_USER_STATUS"
} as const);

type SocketEventType = keyof typeof SocketEvent;

class WebSocketClient {
  private socket!: WebSocket;
  private eventHandlers: Record<string, Function[]> = {};
  private socketUrl: string = "";
  private retryCount: number = 0;
  private maxRetryDelay: number = 30000;
  private static instance: WebSocketClient | null = null;

  private constructor(url: string = "") {
    this.socketUrl = url;
    if (this.socketUrl) {
      this.socket = new WebSocket(this.socketUrl);
      this.attachHandlers();
    }
  }

  private attachHandlers() {
    this.socket.onopen = () => {
      console.log("Connected to WebSocket server");
      this.retryCount = 0;
    };

    this.socket.onmessage = (event) => {
      console.log("Received message:", event.data);
      try {
        const message = JSON.parse(event.data);
        const { event_type, payload } = message;

        const convertKeysToCamelCase = (obj: any): any => {
          if (Array.isArray(obj)) {
            return obj.map(convertKeysToCamelCase);
          } else if (
            obj !== null &&
            obj !== undefined &&
            typeof obj === "object"
          ) {
            return Object.keys(obj).reduce((acc, key) => {
              const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
              acc[camelKey] = convertKeysToCamelCase(obj[key]);
              return acc;
            }, {} as Record<string, any>);
          }
          return obj;
        };

        if (Object.values(SocketEvent).includes(event_type)) {
          const eventEnumValue = event_type as SocketEventType;
          if (this.eventHandlers[eventEnumValue]) {
            const camelCasedPayload = convertKeysToCamelCase(payload);
            this.eventHandlers[eventEnumValue].forEach((handler) => {
              console.log(camelCasedPayload);
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
    };
  }

  private reconnect() {
    const previousHandlers = this.eventHandlers;
    this.socket = new WebSocket(this.socketUrl);
    this.eventHandlers = previousHandlers;
    this.attachHandlers();
  }

  public static getInstance(url: string = ""): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient(url);
    }
    return WebSocketClient.instance;
  }

  on(eventType: SocketEventType, handler: Function) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  send(data: any) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  close() {
    this.socket.close();
  }

  async setSocketUrl(url: string) {
    if (!this.socketUrl) {
      this.socketUrl = url;
      const cookie = await getAuthCookie();
      this.socket = new WebSocket(url, [`cookie-${cookie}`]);
      this.attachHandlers();
    }
  }
}
async function getAuthCookie(): Promise<string> {
  const response = await fetch("/auth/ws-token");
  if (!response.ok) throw new Error("Failed to retrieve cookie");
  const data = await response.json();
  console.log(data);
  return encodeURIComponent(data.cookieValue);
}

const socketClient = WebSocketClient.getInstance();

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
  isOnline: boolean;
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
socketClient.on(SocketEvent.SEND_MESSAGE_GUILD, (data: GuildMessageData) => {
  const messageData: MessageResponse = {
    guildId: data.guildId,
    isOldMessages: false,
    isDm: false,
    messages: data.messages,
    channelId: data.channelId
  };

  handleMessage(messageData);
});

socketClient.on(SocketEvent.SEND_MESSAGE_DM, (data: DMMessageData) => {
  const messageData: MessageResponse = {
    isOldMessages: false,
    messages: data.message,
    isDm: true,
    channelId: data.channelId
  };

  handleMessage(messageData);
});

socketClient.on(SocketEvent.UPDATE_USER_NAME, (data: UpdateUserData) => {
  refreshUserProfile(data.userId);
});

socketClient.on(SocketEvent.UPDATE_USER_STATUS, (data: UserStatusData) => {
  const userId = data.userId;
  const isOnline = data.isOnline;
  updateUserOnlineStatus(userId, isOnline);
});

socketClient.on(SocketEvent.CREATE_CHANNEL, (data: CreateChannelData) => {
  if (!data) return;
  const { guildId, channelId, channelName = "", isTextChannel } = data;

  const channel = {
    guildId,
    channelId,
    channelName,
    isTextChannel
  };
  addChannel(channel);

  //} else if (type === removeType) {
  //  removeChannel(data);
  //} else if (type === editType) {
  //  editChannel(data);
  //}
});

interface DeleteMessageEmit {
  messageId: string;
  guildId: string;
  channelId: string;
  msgDate: string;
}

interface DeleteMessageResponse {
  messageId: string;
}

function processDeleteMessage(
  msgDate: string,
  messageId: string,
  isDm: boolean
) {
  const messageElement = chatContainer.querySelector(
    `[data-message-id="${messageId}"]`
  ) as HTMLElement;
  const msgDateElement = messageElement?.dataset.date;
  deleteLocalMessage(
    messageId,
    currentGuildId,
    guildCache.currentChannelId,
    isDm
  );
  cacheInterface.removeMessage(
    messageId,
    guildCache.currentChannelId,
    currentGuildId
  );

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
  processDeleteMessage(data.messageId, data.messageId, isDm);
}

export function handleDeleteMessageEmit(
  data: DeleteMessageEmit,
  isDm: boolean
) {
  processDeleteMessage(data.msgDate, data.messageId, isDm);
}

socketClient.on(SocketEvent.DELETE_CHANNEL, (data: ChannelData) => {
  handleChannelDelete(data);
});

socketClient.on(SocketEvent.DELETE_MESSAGE_DM, (data: DeleteMessageEmit) => {
  handleDeleteMessageEmit(data, true);
});

socketClient.on(SocketEvent.DELETE_MESSAGE_GUILD, (data: DeleteMessageEmit) => {
  handleDeleteMessageEmit(data, false);
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

    const buttonContainer = channelsUl.querySelector(
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

export const voiceHandler = new VoiceHandler();

//socketClient.on(
//  SocketEvent.INCOMING_AUDIO,
//  async (data: IncomingAudioResponse) => {
//    await voiceHandler.handleAudio(data);
//  }
//);
