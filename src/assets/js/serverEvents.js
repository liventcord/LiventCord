import { deleteLocalMessage, getLastSecondMessageDate,getOldMessages } from './message';
import {
  currentLastDate,
  lastMessageDate,
  setLastMessageDate,
  handleOldMessagesResponse,
  handleReplies,
  displayChatMessage,
  fetchReplies,
  messageDates,
  handleHistoryResponse,bottomestChatDateStr,setBottomestChatDateStr
} from './chat';
import {
  guildCache,
  messages_raw_cache,
  replyCache,
  cacheInterface,
} from './cache';
import {
  addChannel,
  updateChannels,
  removeChannel,
  editChannel,
  currentChannelName,
  channelsUl,
  setCurrentVoiceChannelGuild,setCurrentVoiceChannelId, currentVoiceChannelId
} from './channels';
import { enableElement, getId } from './utils';
import { updateMemberList } from './userList';
import { loadGuild, removeFromGuildList, updateGuild,currentGuildId } from './guild';
import { closeSettings } from './settingsui';
import { loadDmHome } from './app';
import { alertUser, setActiveIcon } from './ui';
import { updateUserOnlineStatus,currentUserId,setUserNick } from './user';
import {
  friendCache,
  updateFriendsList,
  handleFriendEventResponse,
} from './friends';
import {
  playNotification,
  playAudio,
  clearVoiceChannel,
  convertToArrayBuffer,
  decodeAudioDataAsync,
  playAudioBuffer,
} from './audio';
import { refreshUserProfile } from './avatar';
import { isOnGuild } from './router.js';
import { apiClient, EventType } from './api.js';
import { permissionManager } from './guildPermissions.js';
import { translations } from './translations.js';
import { closeCurrentJoinPop } from './popups.js';


apiClient.on(EventType.REMOVE_MESSAGE, (data) => {
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

apiClient.on('join_guild_response', (data) => {
  if (!data.success) {
    const errormsg = translations.getTranslation('join-error-response');
    getId('create-guild-title').textContent = errormsg;
    getId('create-guild-title').style.color = 'red';
    return;
  }
  if (!permissionManager.permissionsMap[data.guildId]) {
    permissionManager.permissionsMap[data.guildId] = [];
  }

  permissionManager.permissionsMap[data.guildId] = data.permissionsMap;
  loadGuild(data.joinedGuildId, data.joinedChannelId, data.joinedGuildName);

  if (closeCurrentJoinPop) {
    closeCurrentJoinPop();
  }
});

apiClient.on('message_readen', (data) => {
  if (data) {
    console.log(data);
    Object.keys(data).forEach((key) => {});
  }
});
apiClient.on('deleted_guild', (data) => {
  if (typeof data === 'object') {
    if (data.success) {
      closeSettings();
      removeFromGuildList(data.guildId);
      loadDmHome();
    } else {
      alertUser(data);
    }
  } else {
    alertUser(data);
  }
});
apiClient.on('get_invites', (data) => {
  if (data && data.invite_ids) {
    guildCache.addInvites(data.guildId, data.invite_ids);
  } else {
    console.warn('Invite ids do not exist. ', data);
  }
});

apiClient.on('update_guild_name', (data) => {
  if (data.guildId === currentGuildId) {
    getId('guild-name').innerText = guildCache.currentGuildName;
  }
});
apiClient.on('update_guild_image', (data) => {
  updateGuild(data);
});
apiClient.on('old_messages_response', function (data) {
  handleOldMessagesResponse(data);
});

apiClient.on('create_channel_response', (data) => {
  if (data.success === undefined || data.success === true) return;
  alertUser(`${guildCache.currentGuildName} sunucusunda kanal yönetme iznin yok!`);
});

apiClient.on('bulk_reply_response', (data) => {
  const replies = data.bulk_replies;
  replies.forEach((reply) => {
    const { messageId, userId, content, attachmentUrls } = reply;
    if (!replyCache[messageId]) {
      replyCache[messageId] = {
        messageId: messageId,
        replies: [],
      };
    }
    replyCache[messageId].replies.push({ userId, content, attachmentUrls });
  });
  setTimeout(() => {
    handleReplies();
  }, 100);
});

apiClient.on('get_channels', (data) => {
  const guildId = data.guildId;
  if (data && data.channels && guildId) {
    cacheInterface.addChannel(guildId, data.channels);
    updateChannels(data.channels);
  }
});

apiClient.on('channel_update', (data) => {
  if (!data) return;
  // TODO edit this to use post put delete
  const updateType = data.type;
  const removeType = 'remove';
  const editType = 'edit';
  const createType = 'create';

  if (updateType === createType) {
    const channel = {
      guildId: data.guildId,
      channelId: data.channelId,
      channel_name: data.channel_name,
      is_text_channel: data.is_text_channel,
    };

    addChannel(channel);
  } else if (updateType === removeType) {
    removeChannel(data);
  } else if (updateType === editType) {
    editChannel(data);
  }
});

apiClient.on('get_members', (data) => {
  const members = data.members;
  const guildId = data.guildId;
  if (!data || !members || !guildId) {
    console.error('Malformed members data: ', data);
    return;
  }

  cacheInterface.updateMembers(guildId, members);
  updateMemberList(members);
});

apiClient.on('user_status', (data) => {
  const userId = data.userId;
  const is_online = data.is_online;
  updateUserOnlineStatus(userId, is_online);
});

apiClient.on('message', (data) => {
  try {
    const {
      isDm,
      messageId,
      userId,
      content,
      channelId,
      date,
      attachmentUrls,
      replyToId,
      is_bot,
      guildId,
      lastEdited,
      reactionEmojisIds,
    } = data;
    const idToCompare = isDm
      ? friendCache.currentDmId
      : guildCache.currentChannelId;

    if (data.guildId !== currentGuildId || idToCompare !== channelId) {
      console.log(`${idToCompare} is not ${channelId} so returning`);
      if (userId !== currentUserId) {
        playNotification();
        setActiveIcon();
      }
      return;
    }

    displayChatMessage(data);

    fetchReplies(data);
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

apiClient.on('message_date_response', (data) => {
  const message_date = data.message_date;
  messageDates[data.messageId] = message_date;
  console.log(currentLastDate, message_date);
  if (currentLastDate && currentLastDate > message_date) {
    getOldMessages(message_date, data.messageId);
  } else {
    console.log('Is less than!', currentLastDate, message_date);
  }
});

apiClient.on('get_history', (data) => {
  handleHistoryResponse(data);
});

apiClient.on('update_nick', (data) => {
  const userId = data.userId;
  const newNickname = data.userName;
  if (userId === currentUserId) {
    const settingsNameText = getId('settings-self-name');
    const setInfoNick = getId('set-info-nick');
    const selfName = getId('self-name');

    selfName.innerText = newNickname;
    if (setInfoNick) {
      setInfoNick.innerText = newNickname;
    }
    if (settingsNameText) {
      settingsNameText.innerText = newNickname;
    }
    setUserNick(newNickname);
    return;
  }

  refreshUserProfile(userId, newNickname);
});

apiClient.on('update_user_profile', (data) => {
  refreshUserProfile(data.userId);
});

apiClient.on('users_data_response', (data) => {
  updateFriendsList(data.users, data.isPending);
});

//friend
apiClient.on(EventType.ADD_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.ACCEPT_FRIEND_REQUEST, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.REMOVE_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.deny_friend_request, function (message) {
  handleFriendEventResponse(message);
});

//audio

apiClient.on('voice_users_response', function (data) {
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
apiClient.on('incoming_audio', async (data) => {
  if (data && data.byteLength > 0) {
    try {
      const arrayBuffer = convertToArrayBuffer(data);
      const decodedData = await decodeAudioDataAsync(arrayBuffer);
      if (decodedData) {
        playAudioBuffer(decodedData);
      } else {
        console.log('Decoded audio data is empty or invalid');
      }
    } catch (e) {
      console.log('Error decoding audio data:',e);
    }
  } else {
    console.log('Received silent or invalid audio data');
  }
});
