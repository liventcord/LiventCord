export interface PermissionsRecord {
  [guildId: string]: Record<string, number>;
}

export interface BaseUser {
  userId: string;
  nickName: string;
  discriminator: string;
}

export interface PublicUser extends Partial<Omit<BaseUser, "userId">> {
  userId?: string;
  createdAt?: Date;
  description?: string;
  socialMediaLinks?: string;
}

export interface Member extends BaseUser {
  status: string;
}

export interface UserMember extends Partial<BaseUser> {
  userId: string;
  status: string;
  isOnline?: boolean;
  isTyping?: boolean;
}

export interface UserState {
  members: UserMember[];
  onlineUsers: UserMember[];
  offlineUsers: UserMember[];
}

export interface VoiceUserStatus {
  isNoisy: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

export interface VoiceUser extends VoiceUserStatus {
  id: string;
}

export interface ChannelBase {
  guildId: string;
  channelId: string;
  channelName: string;
  isTextChannel: boolean;
  lastReadDatetime: Date | null;
  voiceMembers: Member[];
  unreadCount: number;
  voiceUsers: VoiceUser[];
}

export type ChannelData = Partial<Omit<ChannelBase, "guildId" | "channelId">> &
  Pick<ChannelBase, "guildId" | "channelId">;

export class Channel implements ChannelBase {
  guildId!: string;
  channelId!: string;
  channelName!: string;
  isTextChannel!: boolean;
  voiceUsers!: VoiceUser[];

  lastReadDatetime!: Date | null;
  voiceMembers!: Member[];
  unreadCount!: number;

  constructor({
    guildId,
    channelId,
    channelName = "",
    isTextChannel = false,
    lastReadDatetime = null,
    voiceMembers = [],
    unreadCount = 0
  }: ChannelData) {
    if (!channelId) {
      console.error("Invalid channel data in constructor:", {
        channelId,
        channelName,
        isTextChannel
      });
      return;
    }
    this.guildId = guildId;
    this.channelId = channelId;
    this.channelName = channelName;
    this.isTextChannel = isTextChannel;
    this.lastReadDatetime = lastReadDatetime;
    this.voiceMembers = voiceMembers;
    this.unreadCount = unreadCount;
  }
}

export interface CachedChannel extends ChannelBase {
  createElement: () => void;
}

export interface ChannelHoverInfo {
  isTextChannel: boolean;
}

export interface BaseMessage {
  messageId: string;
  userId: string;
  channelId: string | null;
  content: string;
  date: string | null;
  lastEdited: string | null;
  isBot: boolean;
  isSystemMessage: boolean;
  isPinned: boolean;
}
export interface MessageCore {
  messageId: string;
  userId: string;
  channelId: string | null;
  content: string;
  date: string | null;
  lastEdited: string | null;
  isBot: boolean;
  isSystemMessage: boolean;
  isPinned: boolean;
}
export interface MessageRelations {
  replyToId?: string | null;
  replies?: string[];
}
export interface MessageClientState {
  willDisplayProfile?: boolean;
  isNotSent?: boolean;
  addToTop?: boolean;
  temporaryId?: string;
  replyOf?: string;
}
export interface MessageAttachments {
  attachments?: Attachment[];
}
export interface MessageReactions {
  reactionEmojisIds?: string[];
}

export interface MessageMetadata {
  metadata?: Metadata;
  metaData?: MetaData;
  embeds?: Embed[];
}

export type MessageData = MessageCore &
  MessageRelations &
  MessageClientState &
  MessageAttachments &
  MessageReactions &
  MessageMetadata;

export class Message implements MessageCore {
  messageId: string;
  userId: string;
  channelId: string | null;
  content: string;
  date: string | null;
  lastEdited: string | null;
  isBot: boolean;
  isSystemMessage: boolean;
  isPinned: boolean;

  attachments?: Attachment[];
  replyToId?: string | null;
  replies?: string[];

  reactionEmojisIds?: string[];

  metadata?: Metadata;
  metaData?: MetaData;
  embeds?: Embed[];

  willDisplayProfile: boolean;
  isNotSent: boolean;
  replyOf: string;
  temporaryId?: string;
  addToTop: boolean;

  constructor(data: MessageData) {
    this.messageId = data.messageId;
    this.userId = data.userId;
    this.channelId = data.channelId;
    this.content = data.content;
    this.date = data.date;
    this.lastEdited = data.lastEdited;
    this.isBot = data.isBot;
    this.isSystemMessage = data.isSystemMessage;
    this.isPinned = data.isPinned;

    this.attachments = data.attachments;
    this.replyToId = data.replyToId;
    this.replies = data.replies;

    this.reactionEmojisIds = data.reactionEmojisIds;

    this.metadata = data.metadata;
    this.metaData = data.metaData;
    this.embeds = data.embeds;

    this.willDisplayProfile = data.willDisplayProfile ?? false;
    this.isNotSent = data.isNotSent ?? false;
    this.temporaryId = data.temporaryId;
    this.addToTop = data.addToTop ?? false;
    this.replyOf = data.replyOf ?? "";
  }
}

interface BaseSocketMessage {
  senderId: string;
  targetId: string;
}

export type DataMessage =
  | (BaseSocketMessage & {
      type: "offer";
      sdp: RTCSessionDescriptionInit;
    })
  | (BaseSocketMessage & {
      type: "answer";
      sdp: RTCSessionDescriptionInit;
    })
  | (BaseSocketMessage & {
      type: "candidate";
      candidate: RTCIceCandidateInit;
    });

export interface Attachment {
  proxyUrl: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  isImageFile: boolean;
  isVideoFile: boolean;
  isSpoiler: boolean;
  isProxyFile: boolean;
}

export interface AttachmentWithMetaData {
  attachment: Attachment;
  userId: string;
  content: string;
  date: string;
}

export interface MessageReply {
  messageId: string;
  replies: Message[];
}

export interface MessageResponseBase {
  isOldMessages: boolean;
  isDm: boolean;
  messages: Message[];
  channelId: string;
  guildId: string;
  oldestMessageDate: string | null;
}

export interface GuildHistoryResponse extends MessageResponseBase {
  isDm: false;
}

export interface DMHistoryResponse extends MessageResponseBase {
  isDm: true;
}

export interface SearchMessagesResponse {
  messages?: Message[];
  totalCount?: string;
}

export interface BulkReplies {
  replies: Message[];
}

export interface MessageDatesResponse {
  messageId: string;
  messageDate: Date;
}

export interface AttachmentWithMetaDataAndCount {
  attachments: AttachmentWithMetaData[];
  count: number;
}

export interface ChangeChannelResponse {
  channelId: string;
  guildId: string;
  channelName: string;
}

export interface NewMessageResponse {
  guildId?: string;
  isOldMessages: boolean;
  isDm: boolean;
  messages: Message[];
  channelId: string;
  oldestMessageDate?: string | null;
}
export interface NewMessageResponseSelf {
  message: Message;
  guildId: string;
}
export interface EditMessageResponse {
  guildId?: string;
  isDm: boolean;
  messageId: string;
  content: string;
  channelId: string;
  lastEdited: string;
}
export interface GuildMembersResponse {
  members: UserInfo[];
  guildId: string;
}

export interface GuildMemberAddedMessage {
  guildId: string;
  userId: string;
  userData: PublicUser;
}
export interface GuildMemberRemovedMessage {
  guildId: string;
  userId: string;
}

export interface DeleteMessageResponse {
  messageId: string;
  channelId: string;
}
export interface GuildResponse {
  guild: Guild;
  permissions: PermissionsRecord;
}
export interface UpdateGuildNameResponse {
  guildId: string;
  guildName: string;
}
export interface UpdateGuildImageResponse {
  guildId: string;
  guildVersion: string;
}
export interface Guild {
  guildId: string;
  rootChannel: string;
  guildName: string;
  guildVersion?: string;
  isGuildUploadedImg: boolean;
  guildMembers: string[];
}
export interface GuildMember {
  name: string;
  image: string;
  userId: string;
  discriminator: string;
}

export interface UserInfo extends BaseUser {
  status?: string;
  activity?: string;
  description?: string;
  profileVersion?: string;
  isFriendsRequestToUser?: boolean;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isPending?: boolean;
  isBlocked?: boolean;
}

export interface TypingData {
  userId: string;
  guildId?: string;
  channelId: string;
}

export interface FriendData extends BaseUser {
  activity?: string;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  profileVersion?: string;
  socialMediaLinks?: string[];
  isPending: boolean;
  isFriendsRequestToUser: boolean;
}
export class Friend implements FriendData {
  userId: string;
  nickName: string;
  discriminator: string;
  activity?: string;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  profileVersion?: string;
  socialMediaLinks?: string[];
  isPending: boolean;
  isFriendsRequestToUser: boolean;

  constructor(friend: FriendData) {
    this.userId = friend.userId;
    this.nickName = friend.nickName;
    this.discriminator = friend.discriminator;
    this.activity = friend.activity;
    this.description = friend.description;
    this.createdAt = friend.createdAt;
    this.lastLogin = friend.lastLogin;
    this.profileVersion = friend.profileVersion;
    this.socialMediaLinks = friend.socialMediaLinks;
    this.isPending = friend.isPending;
    this.isFriendsRequestToUser = friend.isFriendsRequestToUser;
  }
}

export interface FriendMessage {
  friendId: string;
  friendNick: string;
  friendData?: UserInfo;
  isSuccess: boolean;
  type: string;
}

export type Metadata = {
  type?: string;
  pinnerUserId?: string;
  pinnedAt?: string;
};

export interface ChatBarState {
  rawContent: string;
  renderedContent: string;
  cursorPosition: number;
  isProcessing: boolean;
  emojiSuggestionsVisible: boolean;
  selectionStart: number;
  selectionEnd: number;
}

export type SettingType = "GUILD" | "PROFILE" | "CHANNEL";

export const SettingType = Object.freeze({
  GUILD: "GUILD",
  PROFILE: "PROFILE",
  CHANNEL: "CHANNEL"
});

export interface Embed {
  id: string;
  title: string;
  type: number;
  description: string | null;
  url: string | null;
  color: number;
  fields: any[];
  thumbnail: { url?: string } | null;
  video: { url?: string } | null;
  author: { name?: string } | null;
  image: {
    url: string;
    proxyUrl?: string;
    width?: number;
    height?: number;
  } | null;
  footer: { text?: string } | null;
}
export class MetaData {
  siteName: string;
  title: string;
  description: string;

  constructor(siteName: string, title: string, description: string) {
    this.siteName = siteName;
    this.title = title;
    this.description = description;
  }
}

export type Emoji = {
  guildId: string;
  userId: string;
  fileId: string;
  fileName: string;
};

export interface InitialStateData {
  email: string;
  userId: string;
  nickName: string;
  userStatus: string;
  userDiscriminator: string;
  profileVersion: string;
  guildName: string;
  ownerId: string;
  sharedGuildsMap: Map<string, any>;
  permissionsMap: Map<string, any>;
  friendsStatus: any;
  dmFriends?: any[];
  guilds: any[];
  mediaWorkerUrl: string;
  maxAvatarSize: number;
  maxAttachmentSize: number;
  wsUrl: string;
  rtcWsUrl: string;
}
