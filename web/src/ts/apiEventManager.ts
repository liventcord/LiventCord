import { appState } from "./appState.ts";

import {
  getOldMessages,
  showNoMessages,
  unpinEventHandler
} from "./message.ts";
import {
  currentLastDate,
  messageDates,
  handleHistoryResponse,
  handleSelfSentMessage,
  handleOldMessagesResponse,
  appendCurrentAttachments,
  updateAttachmentsCount,
  displayChatMessage,
  getHistoryFromOneChannel
} from "./chat.ts";
import {
  replyCache,
  cacheInterface,
  pinnedMessagesCache,
  guildCache
} from "./cache.ts";
import {
  editChannelName,
  getChannels,
  handleChannelDelete,
  handleNewChannel
} from "./channels.ts";
import { createEl, getId } from "./utils.ts";
import { updateMemberList } from "./userList.ts";
import {
  loadGuild,
  removeFromGuildList,
  updateGuildImage,
  currentGuildId,
  setGuildNameText,
  onLeaveGuild,
  addToGuildsList
} from "./guild.ts";
import { closeSettings, shakeScreen } from "./settingsui.ts";
import { initialiseState, initializeApp, initialState } from "./app.ts";
import { DEFAULT_DISCRIMINATOR, deletedUser, userManager } from "./user.ts";
import {
  updateFriendsList,
  handleFriendEventResponse,
  friendsCache
} from "./friends.ts";
import {
  refreshUserProfile,
  setLastConfirmedGuildImage,
  setLastConfirmedProfileImage,
  updateSelfName
} from "./avatar.ts";
import { apiClient, EventType } from "./api.ts";
import { updatePermissions } from "./guildPermissions.ts";
import { translations } from "./translations.ts";
import { closeCurrentJoinPop } from "./popups.ts";
import { router } from "./router.ts";
import { handleDeleteMessage } from "./socketEvents.ts";
import { appendToDmList, removeFromDmList } from "./friendui.ts";
import { createFireWorks } from "./extras.ts";
import { appendToGuildContextList } from "./contextMenuActions.ts";
import { alertUser } from "./ui.ts";
import { populateEmojis } from "./emoji.ts";
import { chatContent } from "./chatbar.ts";
import {
  AttachmentWithMetaDataAndCount,
  BulkReplies,
  ChangeChannelResponse,
  DeleteMessageResponse,
  DMHistoryResponse,
  Guild,
  GuildHistoryResponse,
  GuildMembersResponse,
  GuildResponse,
  Member,
  Message,
  MessageDatesResponse,
  NewMessageResponseSelf,
  PermissionsRecord,
  UserInfo
} from "./types/interfaces.ts";
import { handleReplies } from "./replyManager.ts";
import { loadDmHome } from "./appUI.ts";

interface JoinGuildData {
  success: boolean;
  joinedChannelId: string;
  guild: Guild;
  permissions: PermissionsRecord;
}

// Events triggered upon successful requests to endpoints

function handleGuildCreationResponse(data: GuildResponse) {
  const popup = getId("guild-pop-up");
  if (popup) {
    const parentNode = popup.parentNode as HTMLElement;
    if (parentNode) {
      parentNode.remove();
    }
  }
  addNewGuild(data.guild, data.permissions);
  createFireWorks();
}
function userInfosToMembers(userInfos: UserInfo[]): Member[] {
  return userInfos.map((userInfo) => {
    return {
      userId: String(userInfo.userId),
      nickName: userInfo.nickName || deletedUser,
      status: userInfo.status ?? "offline",
      discriminator: userInfo.status ?? DEFAULT_DISCRIMINATOR
    } as Member;
  });
}

function initContainer(containerId: string, title: string): HTMLElement | null {
  const container = getId(containerId);
  if (!container) return null;

  if (container.children.length === 0) {
    const heading = createEl("h3");
    heading.textContent = title;
    heading.style.display = "flex";
    heading.style.flexDirection = "column";
    heading.style.alignItems = "center";
    container.appendChild(heading);
  }

  return container;
}

apiClient.on(EventType.GET_INIT_DATA, async (initData: any) => {
  if (!initData) return;
  if (
    initData.message === "User session is no longer valid. Please log in again."
  ) {
    console.error("User session is not valid");
    await router.openLogin();
    return;
  }
  initialiseState(initData);
  initializeApp();
});

apiClient.on(EventType.UPLOAD_EMOJI_IMAGE, (data: any) => {
  alertUser(translations.getSettingsTranslation("SuccessEmoji"));
  cacheInterface.addUploadedEmojis(data.guildId, data.emojiIds);
  populateEmojis();
});
apiClient.on(EventType.UPLOAD_GUILD_IMAGE, (data: any) => {
  cacheInterface.setGuildVersion(data.guildId, data.guildVersion);
  updateGuildImage(currentGuildId);
  setLastConfirmedGuildImage();
});
apiClient.on(EventType.UPLOAD_PROFILE_IMAGE, (data: any) => {
  if (!appState.currentUserId) return;
  setLastConfirmedProfileImage();
  userManager.setProfileVersion(appState.currentUserId, data.profileVersion);
  initialState.user.profileVersion = data.profileVersion;
  refreshUserProfile(appState.currentUserId);
});
function addNewGuild(guild: Guild, permissions: PermissionsRecord) {
  updatePermissions(guild.guildId, permissions);

  cacheInterface.addGuild(
    guild.guildId,
    guild.guildName,
    guild.isGuildUploadedImg
  );

  addToGuildsList({
    guildId: guild.guildId,
    guildName: guild.guildName,
    isGuildUploadedImg: guild.isGuildUploadedImg,
    rootChannel: guild.rootChannel,
    guildMembers: guild.guildMembers,
    ownerId: appState.currentUserId || "",
    guildVersion: guild.guildVersion || ""
  });

  appendToGuildContextList(guild.guildId);
  loadGuild(guild.guildId, guild.rootChannel, guild.guildName, true);
  getChannels();
  getHistoryFromOneChannel(guildCache.currentChannelId);
}
apiClient.on(EventType.JOIN_GUILD, (data: JoinGuildData) => {
  if (!data.success) {
    const errormsg = translations.getTranslation("join-error-response");
    const createGuildTitle = getId("create-guild-title") as HTMLElement;
    createGuildTitle.textContent = errormsg;
    createGuildTitle.style.color = "red";
    shakeScreen();
    return;
  }

  if (closeCurrentJoinPop) {
    closeCurrentJoinPop();
  }

  addNewGuild(data.guild, data.permissions);
});

apiClient.on(EventType.LEAVE_GUILD, (data: any) => {
  onLeaveGuild(data.guildId);
});

apiClient.on(EventType.DELETE_GUILD, (data) => {
  if (typeof data === "object") {
    closeSettings();
    removeFromGuildList(data.guildId);
    loadDmHome();
  } else {
    console.error(data);
  }
});
apiClient.on(EventType.GET_INVITES, (data) => {
  const inviteId = data.inviteId;
  const guildId = currentGuildId;
  if (!guildId || !inviteId) {
    return;
  }
  if (data && inviteId) {
    cacheInterface.addInvite(guildId, inviteId);
  } else {
    console.warn("Invite ids do not exist. ", data);
  }
});

apiClient.on(EventType.UPDATE_GUILD_NAME, (data) => {
  const newGuildName = data.guildName;
  const guildId = data.guildId;
  if (!newGuildName || !guildId) {
    return;
  }
  if (guildId === currentGuildId) {
    setGuildNameText(newGuildName);
  }
});
apiClient.on(EventType.UPDATE_GUILD_IMAGE, (data) => {
  updateGuildImage(data);
});

apiClient.on(EventType.CREATE_CHANNEL, (data) => {
  handleNewChannel(data);
});

apiClient.on(EventType.GET_CHANNELS, (data: any) => {
  cacheInterface.setChannels(data.guildId, data.channels);
  getChannels();
});

apiClient.on(EventType.CREATE_GUILD, (data: GuildResponse) => {
  handleGuildCreationResponse(data);
});

apiClient.on(EventType.DELETE_CHANNEL, (data) => {
  handleChannelDelete(data);
});

apiClient.on(EventType.DELETE_MESSAGE_DM, (data: DeleteMessageResponse) => {
  handleDeleteMessage(data.messageId, data.channelId, undefined, true);
});
apiClient.on(EventType.DELETE_MESSAGE_GUILD, (data: DeleteMessageResponse) => {
  handleDeleteMessage(data.messageId, data.channelId, undefined, true);
});

apiClient.on(EventType.GET_BULK_REPLY, (data: BulkReplies) => {
  const replies: Message[] = data.replies;

  replies.forEach((reply) => {
    const messageId = reply.messageId;
    if (!replyCache[messageId]) {
      replyCache[messageId] = {
        messageId,
        replies: []
      };
    }

    replyCache[messageId].replies.push(reply);
  });

  setTimeout(() => {
    handleReplies();
  }, 100);
});

apiClient.on(EventType.GET_MEMBERS, (data: GuildMembersResponse) => {
  if (!data || !data.members || !data.guildId) {
    console.error("Malformed members data: ", data);
    return;
  }

  const userInfos = data.members;
  const guildId = data.guildId;

  cacheInterface.updateMembers(guildId, userInfosToMembers(userInfos));
  updateMemberList(userInfos);
  userInfos.forEach((userInfo) => {
    userManager.addUser(
      userInfo.userId,
      userInfo.nickName,
      userInfo.discriminator,
      userInfo.profileVersion
    );
  });
});

apiClient.on(
  EventType.GET_SCROLL_HISTORY_GUILD,
  (data: GuildHistoryResponse) => {
    handleOldMessagesResponse(data);
  }
);

apiClient.on(EventType.GET_SCROLL_HISTORY_DM, (data: DMHistoryResponse) => {
  handleOldMessagesResponse(data);
});

apiClient.on(EventType.GET_HISTORY_GUILD, (data: GuildHistoryResponse) => {
  handleHistoryResponse(data);
});

apiClient.on(EventType.GET_HISTORY_DM, (data: DMHistoryResponse) => {
  handleHistoryResponse(data);
});

apiClient.on(EventType.GET_PINNED_MESSAGES, (data: DMHistoryResponse) => {
  pinnedMessagesCache.cachePinnedMessages(data);

  const pinContainer = initContainer("pin-container", "Pinned Messages");
  if (!pinContainer) return;

  if (data.messages.length === 0) {
    showNoMessages(pinContainer);
    return;
  }

  handleHistoryResponse(data, pinContainer);
});

apiClient.on(EventType.UNPIN_MESSAGE, (data: { messageId: string }) => {
  unpinEventHandler(data.messageId);
});
apiClient.on(
  EventType.PIN_MESSAGE,
  (data: { pinNotificationMessage: Message }) => {
    cacheInterface.addMessage(
      currentGuildId,
      guildCache.currentChannelId,
      data.pinNotificationMessage
    );
    displayChatMessage(data.pinNotificationMessage, chatContent);
  }
);

apiClient.on(EventType.GET_GUILD_MESSAGE_LINKS, (data: DMHistoryResponse) => {
  const linksContainer = initContainer("links-container", "Message Links");
  if (!linksContainer) return;

  if (data.messages.length === 0) {
    showNoMessages(linksContainer);
  }

  handleHistoryResponse(data, linksContainer);
});

apiClient.on(
  EventType.GET_ATTACHMENTS_GUILD,
  (data: AttachmentWithMetaDataAndCount) => {
    if (data.attachments.length > 0) {
      appendCurrentAttachments(data.attachments);
    }
    setTimeout(() => {
      updateAttachmentsCount(data.count);
    }, 0);
  }
);

apiClient.on(EventType.GET_MESSAGE_DATES, (data: MessageDatesResponse) => {
  const message_date = data.messageDate;
  const messageId = data.messageId;
  messageDates[messageId] = message_date;
  console.log(currentLastDate, message_date);

  if (currentLastDate && currentLastDate > message_date) {
    getOldMessages(message_date, messageId);
  } else {
    console.log("Is less than!", currentLastDate, message_date);
  }
});

apiClient.on(EventType.CHANGE_NICK, (data) => {
  const userId = data.userId;
  const newNickname = data.userName;
  if (userId === appState.currentUserId) {
    const setInfoNick = getId("set-info-nick");

    if (setInfoNick) {
      setInfoNick.innerText = newNickname;
    }
    userManager.setUserNick(newNickname);
    updateSelfName(newNickname);
    return;
  }

  refreshUserProfile(userId, newNickname);
});

apiClient.on(EventType.UPDATE_CHANNEL_NAME, (data: ChangeChannelResponse) => {
  if (data.guildId === currentGuildId) {
    editChannelName(data.channelId, data.channelName);
  }
});

apiClient.on(EventType.GET_FRIENDS, (data) => {
  friendsCache.initialiseFriends(data);
  updateFriendsList(data);
});

apiClient.on(EventType.SEND_MESSAGE_GUILD, (data: NewMessageResponseSelf) => {
  handleSelfSentMessage(data);
});
apiClient.on(EventType.SEND_MESSAGE_DM, (data: NewMessageResponseSelf) => {
  handleSelfSentMessage(data);
});

//friend
apiClient.on(EventType.ADD_FRIEND, function (message) {
  handleFriendEventResponse(message);
  apiClient.send(EventType.GET_FRIENDS);
});
apiClient.on(EventType.ADD_FRIEND_ID, function (message) {
  handleFriendEventResponse(message);
  apiClient.send(EventType.GET_FRIENDS);
});

apiClient.on(EventType.ACCEPT_FRIEND, function (message) {
  handleFriendEventResponse(message);
  apiClient.send(EventType.GET_FRIENDS);
});

apiClient.on(EventType.REMOVE_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.DENY_FRIEND, function (message) {
  handleFriendEventResponse(message);
});

apiClient.on(EventType.ADD_DM, function (data) {
  appendToDmList(data);
});

apiClient.on(EventType.REMOVE_DM, function (data) {
  removeFromDmList(data.friendId);
});
