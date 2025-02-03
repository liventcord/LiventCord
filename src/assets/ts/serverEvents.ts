import { getOldMessages } from "./message.ts";
import {
  currentLastDate,
  handleReplies,
  messageDates,
  handleHistoryResponse
} from "./chat.ts";
import { guildCache, replyCache, cacheInterface } from "./cache.ts";
import {
  addChannel,
  changeChannel,
  removeChannel,
  updateChannels
} from "./channels.ts";
import { getId } from "./utils.ts";
import { updateMemberList } from "./userList.ts";
import {
  loadGuild,
  removeFromGuildList,
  updateGuildImage,
  currentGuildId,
  setGuildNameText
} from "./guild.ts";
import { closeSettings } from "./settingsui.ts";
import { loadDmHome } from "./app.ts";
import { alertUser } from "./ui.ts";
import { currentUserId, setUserNick } from "./user.ts";
import { updateFriendsList, handleFriendEventResponse } from "./friends.ts";
import { refreshUserProfile, selfName } from "./avatar.ts";
import { apiClient, EventType } from "./api.ts";
import { permissionManager } from "./guildPermissions.ts";
import { translations } from "./translations.ts";
import { closeCurrentJoinPop } from "./popups.ts";
import { createFireWorks } from "./extras.ts";

apiClient.on(EventType.JOIN_GUILD, (data) => {
  if (!data.success) {
    const errormsg = translations.getTranslation("join-error-response");
    getId("create-guild-title").textContent = errormsg;
    getId("create-guild-title").style.color = "red";
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
  if (typeof data === "object") {
    closeSettings();
    removeFromGuildList(data.guildId);
    loadDmHome();
  } else {
    alertUser(data);
  }
});
apiClient.on(EventType.GET_INVITES, (data) => {
  const inviteIds = data.inviteIds;
  const guildId = data.guildId;
  if (!guildId || !inviteIds) return;
  if (data && inviteIds) {
    cacheInterface.addInvites(guildId, inviteIds);
  } else {
    console.warn("Invite ids do not exist. ", data);
  }
});

apiClient.on(EventType.UPDATE_GUILD_NAME, (data) => {
  const newGuildName = data.newGuildName;
  const guildId = data.guildId;
  if (!newGuildName || !guildId) return;
  if (guildId === currentGuildId) {
    setGuildNameText(newGuildName);
  }
});
apiClient.on(EventType.UPDATE_GUILD_IMAGE, (data) => {
  updateGuildImage(data);
});

apiClient.on(EventType.CREATE_CHANNEL, (data) => {
  const guildId = data.guildId;
  const channelId = data.channelId;
  const isTextChannel = data.isTextChannel;
  if (!guildId || !channelId) return;
  addChannel(data);
  if (isTextChannel) {
    changeChannel(data);
  }
  createFireWorks();
});
apiClient.on(EventType.DELETE_CHANNEL, (data) => {
  const guildId = data.guildId;
  const channelId = data.channelId;
  if (!guildId || !channelId) return;
  if (guildCache.currentChannelId === channelId) {
    const rootChannel = cacheInterface.getRootChannel(guildId);
    console.log(rootChannel);
    closeSettings();
    if (rootChannel) {
      changeChannel(rootChannel);
    } else {
      loadDmHome();
    }
  }
  removeChannel(data);
});

apiClient.on(EventType.GET_BULK_REPLY, (data) => {
  const replies = data.bulk_replies;
  replies.forEach((reply) => {
    const { messageId, userId, content, attachmentUrls } = reply;
    if (!replyCache[messageId]) {
      replyCache[messageId] = {
        messageId,
        replies: []
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
    console.error("Malformed members data: ", data);
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
    console.log("Is less than!", currentLastDate, message_date);
  }
});

apiClient.on(EventType.CHANGE_NICK, (data) => {
  const userId = data.userId;
  const newNickname = data.userName;
  if (userId === currentUserId) {
    const setInfoNick = getId("set-info-nick");

    selfName.innerText = newNickname;
    if (setInfoNick) {
      setInfoNick.innerText = newNickname;
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
