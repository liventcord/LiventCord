import { getOldMessages, Message } from "./message.ts";
import {
  currentLastDate,
  handleReplies,
  messageDates,
  handleHistoryResponse,
  handleSelfSentMessage,
  handleOldMessagesResponse
} from "./chat.ts";
import { replyCache, cacheInterface } from "./cache.ts";
import {
  editChannelName,
  handleChannelDelete,
  handleNewChannel
} from "./channels.ts";
import { getId } from "./utils.ts";
import { updateMemberList } from "./userList.ts";
import {
  loadGuild,
  removeFromGuildList,
  updateGuildImage,
  currentGuildId,
  setGuildNameText,
  Guild
} from "./guild.ts";
import { closeSettings, shakeScreen } from "./settingsui.ts";
import { initialiseState, initializeApp, loadDmHome } from "./app.ts";
import { alertUser } from "./ui.ts";
import { currentUserId, Member, UserInfo, userManager } from "./user.ts";
import {
  updateFriendsList,
  handleFriendEventResponse,
  friendsCache
} from "./friends.ts";
import { refreshUserProfile, selfName } from "./avatar.ts";
import { apiClient, EventType } from "./api.ts";
import { Permission, permissionManager } from "./guildPermissions.ts";
import { translations } from "./translations.ts";
import { closeCurrentJoinPop } from "./popups.ts";
import { router } from "./router.ts";
import {
  handleDeleteMessageEmit,
  handleDeleteMessageResponse
} from "./socketEvents.ts";
import { appendToDmList, removeFromDmList } from "./friendui.ts";

// Events triggered upon successful requests to endpoints

interface JoinGuildData {
  success: boolean;
  joinedChannelId: string;
  guild: Guild;
}
apiClient.on(EventType.GET_INIT_DATA, async (initData: any) => {
  if (
    initData.message === "User session is no longer valid. Please log in again."
  ) {
    if (import.meta.env.MODE === "development") {
      alertUser(
        "User session is not valid. Please log in at localhost:5005/login."
      );
      return;
    }
    await router.changeToLogin();
    return;
  }
  initialiseState(initData);
  initializeApp();
});
apiClient.on(EventType.JOIN_GUILD, (data: JoinGuildData) => {
  const guild = data.guild;
  if (!data.success) {
    const errormsg = translations.getTranslation("join-error-response");
    const createGuildTitle = getId("create-guild-title") as HTMLElement;
    createGuildTitle.textContent = errormsg;
    createGuildTitle.style.color = "red";
    shakeScreen();
    return;
  }

  const permissionsMap = permissionManager.permissionsMap;

  if (!permissionsMap.has(guild.guildId)) {
    permissionsMap.set(guild.guildId, new Set<Permission>());
  }

  //permissionsMap.set(guild.guildId, data.permissionsMap);

  loadGuild(data.guild.guildId, data.joinedChannelId, data.guild.guildName);

  location.reload();

  if (closeCurrentJoinPop) {
    closeCurrentJoinPop();
  }
});

apiClient.on(EventType.LEAVE_GUILD, (data: any) => {
  closeSettings();
  const guildId = data.guildId;
  cacheInterface.removeGuild(guildId);
  console.log(guildId);
  loadDmHome();
  removeFromGuildList(guildId);
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
  if (!guildId || !inviteId) return;
  if (data && inviteId) {
    cacheInterface.addInvite(guildId, inviteId);
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
  handleNewChannel(data);
});

apiClient.on(EventType.DELETE_CHANNEL, (data) => {
  handleChannelDelete(data);
});

apiClient.on(EventType.DELETE_MESSAGE_GUILD, (data) => {
  handleDeleteMessageEmit(data, false);
});

apiClient.on(EventType.DELETE_MESSAGE_DM, (data) => {
  handleDeleteMessageResponse(data, true);
});

interface BulkReplies {
  replies: Message[];
}

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

interface GuildMembersResponse {
  members: UserInfo[];
  guildId: string;
}
function userInfosToMembers(userInfos: UserInfo[]): Member[] {
  return userInfos.map((userInfo) => {
    return {
      userId: String(userInfo.userId),
      nickName: userInfo.nickName || "",
      status: userInfo.status ?? "offline"
    } as Member;
  });
}

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
      userInfo.discriminator
    );
  });
});

interface MessageResponse {
  isOldMessages: boolean;
  isDm: boolean;
  history: Message[];
}

interface GuildHistoryResponse extends MessageResponse {
  messages: Message[];
  channelId: string;
  guildId: string;
  oldestMessageDate: string | null;
  isOldMessages: boolean;
  isDm: false;
  history: Message[];
}

interface DMHistoryResponse extends MessageResponse {
  messages: Message[];
  channelId: string;
  oldestMessageDate: string | null;
  isOldMessages: boolean;
  isDm: true;
  history: Message[];
}

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

interface MessageDatesResponse {
  messageId: string;
  messageDate: Date;
}

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
  if (userId === currentUserId) {
    const setInfoNick = getId("set-info-nick");

    selfName.innerText = newNickname;
    if (setInfoNick) {
      setInfoNick.innerText = newNickname;
    }
    userManager.setUserNick(newNickname);
    return;
  }

  refreshUserProfile(userId, newNickname);
});
type ChangeChannelResponse = {
  channelId: string;
  guildId: string;
  channelName: string;
};
apiClient.on(EventType.UPDATE_CHANNEL_NAME, (data: ChangeChannelResponse) => {
  if (data.guildId === currentGuildId) {
    editChannelName(data.channelId, data.channelName);
  }
});

apiClient.on(EventType.GET_FRIENDS, (data) => {
  friendsCache.initialiseFriends(data as any);
  updateFriendsList(data);
});

apiClient.on(EventType.SEND_MESSAGE_GUILD, (data: Message) => {
  handleSelfSentMessage(data);
});
apiClient.on(EventType.SEND_MESSAGE_DM, (data: Message) => {
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
