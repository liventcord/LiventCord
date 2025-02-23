import { getOldMessages, Message } from "./message.ts";
import {
  currentLastDate,
  handleReplies,
  messageDates,
  handleHistoryResponse
} from "./chat.ts";
import { guildCache, replyCache, cacheInterface } from "./cache.ts";
import { addChannel, changeChannel, removeChannel } from "./channels.ts";
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
import { initialiseState, initializeApp, loadDmHome } from "./app.ts";
import { alertUser } from "./ui.ts";
import { currentUserId, Member, setUserNick, UserInfo } from "./user.ts";
import { updateFriendsList, handleFriendEventResponse } from "./friends.ts";
import { refreshUserProfile, selfName } from "./avatar.ts";
import { apiClient, EventType } from "./api.ts";
import { Permission, permissionManager } from "./guildPermissions.ts";
import { translations } from "./translations.ts";
import { closeCurrentJoinPop } from "./popups.ts";
import { createFireWorks } from "./extras.ts";
import { router } from "./router.ts";

interface JoinGuildData {
  success: boolean;
  guildId: string;
  permissionsMap: Set<Permission>;
  joinedGuildId: string;
  joinedChannelId: string;
  joinedGuildName: string;
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
  if (!data.success) {
    const errormsg = translations.getTranslation("join-error-response");
    const createGuildTitle = getId("create-guild-title") as HTMLElement;
    createGuildTitle.textContent = errormsg;
    createGuildTitle.style.color = "red";
    return;
  }

  const permissionsMap = permissionManager.permissionsMap;

  if (!permissionsMap.has(data.guildId)) {
    permissionsMap.set(data.guildId, new Set<Permission>());
  }

  permissionsMap.set(data.guildId, data.permissionsMap);

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

interface BulkReplies {
  replies: Message[];
}

apiClient.on(EventType.GET_BULK_REPLY, (data: BulkReplies) => {
  const replies: Message[] = data.replies;

  replies.forEach((reply) => {
    const { messageId, userId, content, attachmentUrls } = reply;

    if (!replyCache[messageId]) {
      replyCache[messageId] = {
        messageId,
        replies: []
      };
    }

    replyCache[messageId].replies.push({
      messageId,
      userId,
      content,
      attachmentUrls,
      channelId: "defaultChannel",
      date: new Date(),
      lastEdited: null,
      replyToId: null,
      isBot: false,
      reactionEmojisIds: [],
      addToTop: false,
      metadata: reply.metadata || {},
      embeds: reply.embeds || [],
      willDisplayProfile: reply.willDisplayProfile || false,
      replyOf: reply.replyOf || undefined,
      replies: reply.replies || []
    });
  });

  setTimeout(() => {
    handleReplies();
  }, 100);
});

interface GuildMembersResponse {
  members: Member[];
  guildId: string;
}
apiClient.on(EventType.GET_MEMBERS, (data: GuildMembersResponse) => {
  const members = data.members;
  const guildId = data.guildId;

  if (!data || !members || !guildId) {
    console.error("Malformed members data: ", data);
    return;
  }

  const userInfoList: UserInfo[] = members.map((member) => ({
    userId: member.userId,
    nickName: member.nickName,
    discriminator: "0000"
  }));

  cacheInterface.updateMembers(guildId, members);
  updateMemberList(userInfoList);
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
