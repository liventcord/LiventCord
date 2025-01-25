import { getOldMessages } from './message';
import {
  currentLastDate,
  handleReplies,
  messageDates,
  handleHistoryResponse} from './chat';
import {
  guildCache,
  replyCache,
  cacheInterface,
} from './cache';
import {
  updateChannels} from './channels';
import { getId } from './utils';
import { updateMemberList } from './userList';
import { loadGuild, removeFromGuildList, updateGuild,currentGuildId, guildName } from './guild';
import { closeSettings } from './settingsui';
import { loadDmHome } from './app';
import { alertUser } from './ui';
import { currentUserId,setUserNick } from './user';
import {
  updateFriendsList,
  handleFriendEventResponse,
} from './friends';
import { refreshUserProfile, selfName } from './avatar';
import { apiClient, EventType } from './api.js';
import { permissionManager } from './guildPermissions.js';
import { translations } from './translations.js';
import { closeCurrentJoinPop } from './popups.js';




apiClient.on(EventType.JOIN_GUILD, (data) => {
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


apiClient.on(EventType.DELETE_GUILD, (data) => {
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
apiClient.on(EventType.GET_INVITES, (data) => {
  if (data && data.invite_ids) {
    guildCache.addInvites(data.guildId, data.invite_ids);
  } else {
    console.warn('Invite ids do not exist. ', data);
  }
});

apiClient.on(EventType.UPDATE_GUILD_NAME, (data) => {
  if (data.guildId === currentGuildId) {
    guildName.innerText = guildCache.currentGuildName;
  }
});
apiClient.on(EventType.UPDATE_GUILD_IMAGE, (data) => {
  updateGuild(data);
});

apiClient.on(EventType.CREATE_CHANNEL, (data) => {
  if (data.success === undefined || data.success === true) return;
  alertUser(`${guildCache.currentGuildName} sunucusunda kanal yönetme iznin yok!`);
});

apiClient.on(EventType.GET_BULK_REPLY, (data) => {
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

apiClient.on(EventType.GET_CHANNELS, (data) => {
  const guildId = data.guildId;
  if (data && data.channels && guildId) {
    cacheInterface.addChannel(guildId, data.channels);
    updateChannels(data.channels);
  }
});



apiClient.on(EventType.GET_MEMBERS, (data) => {
  const members = data.members;
  const guildId = data.guildId;
  if (!data || !members || !guildId) {
    console.error('Malformed members data: ', data);
    return;
  }

  cacheInterface.updateMembers(guildId, members);
  updateMemberList(members);
});




apiClient.on(EventType.GET_HISTORY_GUILD, (data) => {
  handleHistoryResponse(data);
});
apiClient.on(EventType.GET_HISTORY_DM, (data) => {
  handleHistoryResponse(data);
});




apiClient.on(EventType.GET_MESSAGE_DATES, (data) => {
  const message_date = data.message_date;
  messageDates[data.messageId] = message_date;
  console.log(currentLastDate, message_date);
  if (currentLastDate && currentLastDate > message_date) {
    getOldMessages(message_date, data.messageId);
  } else {
    console.log('Is less than!', currentLastDate, message_date);
  }
});


apiClient.on(EventType.CHANGE_NICK, (data) => {
  const userId = data.userId;
  const newNickname = data.userName;
  if (userId === currentUserId) {
    const settingsNameText = getId('settings-self-name');
    const setInfoNick = getId('set-info-nick');

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


apiClient.on(EventType.GET_FRIENDS, (data) => {
  updateFriendsList(data);
});

//friend
apiClient.on(EventType.ADD_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.ACCEPT_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.REMOVE_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.DENY_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

