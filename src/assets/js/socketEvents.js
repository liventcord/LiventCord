import { cacheInterface } from "./cache";
import { refreshUserProfile } from "./avatar";
import { updateUserOnlineStatus } from "./user";
import { addChannel,removeChannel,editChannel } from "./channels";
import { playAudio,clearVoiceChannel } from "./audio";
import { currentVoiceChannelId,setCurrentVoiceChannelId,setCurrentVoiceChannelGuild } from "./channels";
import { enableElement } from "./utils";
import { convertToArrayBuffer } from "./audio";




SocketEvent = Object.freeze({
  GUILD_MESSAGE : "GUILD_MESSAGE",
})


socketClient = new SocketClient();
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

const voiceHandler = new VoiceChandler();

socketClient.on(SocketEvent.INCOMING_AUDIO, async (data) => {
  await voiceHandler.handleAudio(data);
});
