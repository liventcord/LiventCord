declare var signalR: any;

import { CachedChannel, cacheInterface, guildCache } from "./cache.ts";
import { refreshUserProfile } from "./avatar.ts";
import { updateUserOnlineStatus } from "./user.ts";
import {
  addChannel,
  removeChannel,
  editChannel,
  currentVoiceChannelId,
  setCurrentVoiceChannelId,
  setCurrentVoiceChannelGuild,
  currentChannelName,
  channelsUl
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

const socketClient = new signalR.HubConnectionBuilder()
  .withUrl("/socket")
  .configureLogging(signalR.LogLevel.Information)
  .build();

const SocketEvent = Object.freeze({
  GUILD_MESSAGE: "GUILD_MESSAGE",
  DM_MESSAGE: "DM_MESSAGE",
  UPDATE_USER: "UPDATE_USER",
  USER_STATUS: "USER_STATUS",
  UPDATE_CHANNEL: "UPDATE_CHANNEL",
  DELETE_MESSAGE_DM: "DELETE_MESSAGE_DM",
  DELETE_MESSAGE_GUILD: "DELETE_MESSAGE_GUILD",
  JOIN_VOICE_CHANNEL: "JOIN_VOICE_CHANNEL",
  INCOMING_AUDIO: "INCOMING_AUDIO"
});

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
export interface UpdateChannelData extends CachedChannel {
  type: "create" | "edit" | "remove";
  guildId: string;
  channelId: string;
  channelName: string; // No longer optional
  isTextChannel: boolean;
}

interface GuildMessageData {
  message: Message;
  guildId: string;
  channelId: string;
}

interface DMMessageData {
  message: Message;
  channelId: string;
}

socketClient.on(SocketEvent.GUILD_MESSAGE, (data: GuildMessageData) => {
  const messageData: MessageResponse = {
    guildId: data.guildId,
    isOldMessages: false,
    messages: [],
    isDm: false,
    ...data.message
  };

  handleMessage(messageData);
});

socketClient.on(SocketEvent.DM_MESSAGE, (data: DMMessageData) => {
  const messageData: MessageResponse = {
    isOldMessages: false,
    messages: [],
    isDm: true,
    ...data.message
  };

  handleMessage(messageData);
});

socketClient.on(SocketEvent.UPDATE_USER, (data: UpdateUserData) => {
  refreshUserProfile(data.userId);
});

socketClient.on(SocketEvent.USER_STATUS, (data: UserStatusData) => {
  const userId = data.userId;
  const isOnline = data.isOnline;
  updateUserOnlineStatus(userId, isOnline);
});

socketClient.on(SocketEvent.UPDATE_CHANNEL, (data: UpdateChannelData) => {
  if (!data) return;
  const { type, guildId, channelId, channelName = "", isTextChannel } = data;

  const removeType = "remove";
  const editType = "edit";
  const createType = "create";

  if (type === createType) {
    const channel = {
      guildId,
      channelId,
      channelName,
      isTextChannel
    };

    addChannel(channel);
  } else if (type === removeType) {
    removeChannel(data);
  } else if (type === editType) {
    editChannel(data);
  }
});

interface DeleteMessageResponse {
  messageId: string;
  guildId: string;
  channelId: string;
  msgdate: string;
}

function handleDelete(data: DeleteMessageResponse, isDm: boolean) {
  deleteLocalMessage(data.messageId, data.guildId, data.channelId, isDm);
  cacheInterface.removeMessage(data.messageId, data.channelId, data.guildId);

  if (typeof lastMessageDate === "number") {
    const msgDateTimestamp = new Date(data.msgdate).setHours(0, 0, 0, 0);
    if (lastMessageDate === msgDateTimestamp) {
      setLastMessageDate(
        new Date(new Date(getLastSecondMessageDate()).setHours(0, 0, 0, 0))
      );
    }
  }

  if (bottomestChatDateStr === data.msgdate) {
    setBottomestChatDateStr(getLastSecondMessageDate());
  }
}

socketClient.on(
  SocketEvent.DELETE_MESSAGE_DM,
  (data: DeleteMessageResponse) => {
    handleDelete(data, true);
  }
);

socketClient.on(
  SocketEvent.DELETE_MESSAGE_GUILD,
  (data: DeleteMessageResponse) => {
    handleDelete(data, false);
  }
);

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

socketClient.on(
  SocketEvent.INCOMING_AUDIO,
  async (data: IncomingAudioResponse) => {
    await voiceHandler.handleAudio(data);
  }
);

socketClient
  .start()
  .then(() => {
    console.log("SignalR connection established.");
  })
  .catch((err: Error) => {
    console.error("Error while establishing connection: ", err.message);
  });
