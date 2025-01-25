/*global signalR */
import { cacheInterface,guildCache,messages_raw_cache } from "./cache";
import { refreshUserProfile } from "./avatar";
import { updateUserOnlineStatus } from "./user";
import { addChannel,removeChannel,editChannel } from "./channels";
import { currentVoiceChannelId,setCurrentVoiceChannelId,setCurrentVoiceChannelGuild,currentChannelName,channelsUl } from "./channels";
import { getId,enableElement } from "./utils";
import { deleteLocalMessage, getLastSecondMessageDate } from "./message";
import { bottomestChatDateStr, setBottomestChatDateStr, setLastMessageDate,lastMessageDate,handleMessage } from "./chat";
import { isOnGuild } from "./router";
import { playAudio,VoiceHandler,clearVoiceChannel } from "./audio";



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
  DELETE_MESSAGE: "DELETE_MESSAGE"
});


socketClient.on(SocketEvent.GUILD_MESSAGE), (data) => {
  handleMessage(data);
}
socketClient.on(SocketEvent.DM_MESSAGE), (data) => {
  handleMessage(data);
}
socketClient.on(SocketEvent.UPDATE_USER, (data) => {
  refreshUserProfile(data.userId);
});

socketClient.on(SocketEvent.USER_STATUS, (data) => {
  const userId = data.userId;
  const isOnline = data.isOnline;
  updateUserOnlineStatus(userId, isOnline);
});
socketClient.on(SocketEvent.UPDATE_CHANNEL, (data) => {
  if (!data) return;
  const updateType = data.type;
  const removeType = 'remove';
  const editType = 'edit';
  const createType = 'create';

  if (updateType === createType) {
    const channel = {
      guildId: data.guildId,
      channelId: data.channelId,
      channelName: data.channelName,
      isTextChannel: data.isTextChannel,
    };

    addChannel(channel);
  } else if (updateType === removeType) {
    removeChannel(data);
  } else if (updateType === editType) {
    editChannel(data);
  }
});



socketClient.on(SocketEvent.DELETE_MESSAGE, (data) => {
  deleteLocalMessage(data.messageId, data.guildId, data.channelId, data.isDm);
  guildCache.removeMessage(data.messageId, data.channelId, data.guildId);
  const msgdate = messages_raw_cache[data.messageId].date;
  if (lastMessageDate === new Date(msgdate).setHours(0, 0, 0, 0)) {
    setLastMessageDate(
      new Date(getLastSecondMessageDate()).setHours(0, 0, 0, 0),
    );
  }
  if (bottomestChatDateStr === msgdate) {
      setBottomestChatDateStr(getLastSecondMessageDate());
  }
  delete messages_raw_cache[data.messageId];
});
//audio

socketClient.on(SocketEvent.JOIN_VOICE_CHANNEL, function (data) {
  const channelId = data.channelId;
  const guildId = data.guildId;
  const voiceUsers = data.usersList;
  if(!channelId) {
    console.error("Channel id is null on voice users response");
    return;
  }
  if(!guildId) {
    console.error("Guild id is null on voice users response");
    return;
  }
  playAudio('/sounds/joinvoice.mp3');
  clearVoiceChannel(currentVoiceChannelId);
  enableElement('sound-panel');

  setCurrentVoiceChannelId(channelId);
  if (isOnGuild) {
    setCurrentVoiceChannelGuild(guildId);
  }
  cacheInterface.setVoiceChannelMembers(channelId,voiceUsers);
  const soundInfoIcon = getId('sound-info-icon');
  soundInfoIcon.innerText = `${currentChannelName} / ${guildCache.currentGuildName}`;

  const buttonContainer = channelsUl.querySelector(
    `li[id="${currentVoiceChannelId}"]`,
  );
  const channelSpan = buttonContainer.querySelector('.channelSpan');
  channelSpan.style.marginRight = '30px';
  
});


const voiceHandler = new VoiceHandler();

socketClient.on(SocketEvent.INCOMING_AUDIO, async (data) => {
  await voiceHandler.handleAudio(data);
});


socketClient.start()
    .then(() => {
        console.log("SignalR connection established.");
    })
    .catch((err) => {
        console.error("Error while establishing connection: ", err);
    });
