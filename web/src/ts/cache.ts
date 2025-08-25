import { initialState } from "./app.ts";
import { appendToMessageContextList } from "./contextMenuActions.ts";
import { Emoji } from "./emoji.ts";
import { DMHistoryResponse, Message, MessageReply } from "./message.ts";
import { currentUserId, Member } from "./user.ts";
import { MINUS_INDEX } from "./utils.ts";

export interface CachedChannel {
  channelId: string;
  channelName: string;
  isTextChannel: boolean;
  lastReadDateTime: Date | null;
  guildId: string;
  voiceMembers: Member[];
  createElement: () => void;
}

class BaseCache {
  private data: { [key: string]: any };

  constructor() {
    this.data = {};
  }

  set(key: string, value: any): void {
    this.data[key] = value;
  }

  get(key: string): any | null {
    return this.data[key] || null;
  }

  setArray(key: string, value: any[]): void {
    this.data[key] = Array.isArray(value) ? value : [];
  }

  setObject(key: string, value: object): void {
    this.data[key] = typeof value === "object" && value !== null ? value : {};
  }

  remove(key: string, id: string): void {
    if (this.data[key]) {
      this.data[key] = this.data[key].filter((item: string) => item !== id);
    }
  }
}

class ChannelCache extends BaseCache {
  setChannels(guildId: string, channels: CachedChannel[]): void {
    this.setArray(guildId, channels);
  }

  getChannels(guildId: string): CachedChannel[] {
    const result = this.get(guildId);
    return Array.isArray(result) ? result : [];
  }
  getChannel(guildId: string, channelId: string): CachedChannel | undefined {
    const result = this.get(guildId);
    return Array.isArray(result)
      ? result.find((channel) => channel.id === channelId)
      : undefined;
  }
  addChannel(guildId: string, channel: CachedChannel): void {
    const channels = this.getChannels(guildId);
    if (!channels.some((ch) => ch.channelId === channel.channelId)) {
      channels.push(channel);
      this.setChannels(guildId, channels);
    } else {
      console.warn(
        `Channel already exists: ${channel.channelId} in guild: ${guildId}`
      );
    }
  }

  removeChannel(guildId: string, channelId: string): void {
    const channels = this.getChannels(guildId).filter(
      (ch) => ch.channelId !== channelId
    );
    this.setChannels(guildId, channels);
  }

  doesChannelExist(guildId: string, channelId: string): boolean {
    const result = this.getChannels(guildId).some(
      (channel) => channel.channelId === channelId
    );
    return result;
  }

  editChannel(guildId: string, channel: CachedChannel): void {
    const channels = this.getChannels(guildId);
    const index = channels.findIndex(
      (ch) => ch.channelId === channel.channelId
    );
    if (index !== -1) {
      channels[index] = { ...channels[index], ...channel };
      this.setChannels(guildId, channels);
    } else {
      console.log("Channel not found for guild:", guildId);
    }
  }

  isVoiceChannel(guildId: string, channelId: string): boolean {
    return this.getChannels(guildId).some(
      (channel) => channel.channelId === channelId && !channel.isTextChannel
    );
  }

  updateChannel(guildId: string, channel: CachedChannel, add = true): void {
    const channels = this.getChannels(guildId);
    const index = channels.findIndex(
      (ch) => ch.channelId === channel.channelId
    );
    if (add && index === -1) {
      channels.push(channel);
    } else if (!add && index !== -1) {
      channels.splice(index, 1);
    }
    this.setChannels(guildId, channels);
  }

  addVoiceChannelMember(
    guildId: string,
    channelId: string,
    member: Member
  ): void {
    const channel = this.getChannels(guildId).find(
      (ch) => ch.channelId === channelId
    );
    if (channel) {
      channel.voiceMembers = channel.voiceMembers || [];
      if (
        !channel.voiceMembers.some(
          (existingMember) => existingMember.userId === member.userId
        )
      ) {
        channel.voiceMembers.push(member);
      }
    }
  }

  removeVoiceChannelMember(
    guildId: string,
    channelId: string,
    memberId: string
  ): void {
    const channel = this.getChannels(guildId).find(
      (ch) => ch.channelId === channelId
    );
    if (channel && channel.voiceMembers) {
      channel.voiceMembers = channel.voiceMembers.filter(
        (member) => member.userId !== memberId
      );
    }
  }

  getVoiceChannelMembers(guildId: string, channelId: string): Member[] {
    const channel = this.getChannels(guildId).find(
      (ch) => ch.channelId === channelId
    );
    return channel ? channel.voiceMembers || [] : [];
  }
}

class GuildMembersCache extends BaseCache {
  getMemberIds(guildId: string): string[] {
    return this.get(`${guildId}:memberIds`) || [];
  }

  getMembers(guildId: string): Member[] {
    return this.get(`${guildId}:members`) || [];
  }

  setMemberIds(guildId: string, memberIds: string[]): void {
    this.set(`${guildId}:memberIds`, Array.isArray(memberIds) ? memberIds : []);
  }

  setMembers(guildId: string, members: Member[]): void {
    this.set(`${guildId}:members`, Array.isArray(members) ? members : []);
  }

  updateMemberId(guildId: string, memberId: string, add = true): void {
    const memberIds = this.getMemberIds(guildId);
    const index = memberIds.indexOf(memberId);
    if (add && index === MINUS_INDEX) {
      memberIds.push(memberId);
    } else if (!add && index !== MINUS_INDEX) {
      memberIds.splice(index, 1);
    }
    this.setMemberIds(guildId, memberIds);
  }

  updateMember(guildId: string, member: Member, add = true): void {
    const members = this.getMembers(guildId);
    const index = members.findIndex((m) => m.userId === member.userId);
    if (add && index === MINUS_INDEX) {
      members.push(member);
    } else if (!add && index !== MINUS_INDEX) {
      members.splice(index, 1);
    }
    this.setMembers(guildId, members);
  }

  updateMemberIds(guildId: string, newMemberIds: string[], add = true): void {
    const uniqueMemberIds = [...new Set(newMemberIds)];
    uniqueMemberIds.forEach((memberId) =>
      this.updateMemberId(guildId, memberId, add)
    );
  }

  updateMembers(guildId: string, newMembers: Member[], add = true): void {
    newMembers.forEach((member) => this.updateMember(guildId, member, add));
  }

  updateMemberStatus(guildId: string, memberId: string, status: string): void {
    const members = this.getMembers(guildId);
    const member = members.find((m) => m.userId === memberId);
    if (member) {
      member.status = status;
      this.setMembers(guildId, members);
    }
  }
}

class MessagesCache extends BaseCache {
  setMessages(channelId: string, messages: Message[]): void {
    this.setArray(channelId, messages);
  }

  getMessages(channelId: string): Message[] {
    return this.get(channelId) || [];
  }
  addMessage(channelId: string, message: Message): void {
    const messages = this.getMessages(channelId);
    messages.push(message);
    this.setMessages(channelId, messages);
  }

  removeMessage(messageId: string, channelId: string): void {
    const messages = this.getMessages(channelId).filter(
      (msg) => msg.messageId !== messageId
    );
    this.setMessages(channelId, messages);
  }
}
class EmojisCache extends BaseCache {
  setEmojis(guildId: string, emojis: Emoji[]): void {
    this.setArray(guildId, emojis);
  }

  addUploadedEmojis(guildId: string, emojiIds: string[]): void {
    const emojis = this.getEmojis(guildId);

    emojiIds.forEach((fileId) => {
      const fileName = `emoji-${fileId}`;
      const emoji: Emoji = {
        guildId,
        userId: currentUserId,
        fileId,
        fileName
      };

      const index = emojis.findIndex((e) => e.fileId === fileId);

      if (index !== -1) {
        emojis[index] = emoji;
      } else {
        emojis.push(emoji);
      }
    });

    this.setEmojis(guildId, emojis);
  }

  getEmojis(channelId: string): Emoji[] {
    return this.get(channelId) || [];
  }

  removeEmojis(emojiId: string, guildId: string): void {
    const messages = this.getEmojis(guildId).filter(
      (e) => e.fileId !== emojiId
    );
    this.setEmojis(guildId, messages);
  }
}

class InviteIdsCache extends BaseCache {
  assignInviteId(guildId: string, inviteId: string): void {
    this.setObject(guildId, { inviteId });
  }

  getInviteId(guildId: string): string | null {
    const inviteData = this.get(guildId);
    return inviteData?.inviteId || null;
  }

  isInvitesEmpty(guildId: string): boolean {
    const inviteData = this.get(guildId);
    return inviteData === null || !inviteData.inviteId;
  }
}

class VoiceChannelCache extends BaseCache {
  channelId: string;

  constructor(channelId: string) {
    super();
    this.channelId = channelId;
  }

  addUserToVoiceChannel(userId: string) {
    const users = this.get(this.channelId) || [];
    if (!users.includes(userId)) {
      users.push(userId);
      this.set(this.channelId, users);
    }
  }

  removeUserFromVoiceChannel(userId: string) {
    const users = this.get(this.channelId) || [];
    const updatedUsers = users.filter((user: string) => user !== userId);
    this.set(this.channelId, updatedUsers);
  }

  getUsersInVoiceChannel() {
    return this.get(this.channelId) || [];
  }
}

class SharedGuildsCache extends BaseCache {
  private readonly guildFriendIdsMap: Map<string, string[]> = new Map();

  hasSharedGuild(friendId: string): boolean {
    const friendGuildIds = new Set<string>(
      this.getFriendGuilds(friendId).map((guild) => guild)
    );
    return Object.values(guildCache.guilds).some(
      (guild) =>
        guild.members.getMemberIds(guild.guildId).includes(friendId) ||
        friendGuildIds.has(guild.guildId)
    );
  }

  getFriendGuilds(friendId: string, guildId?: string): string[] {
    const guilds = new Set<string>();

    this.guildFriendIdsMap.forEach((friendIds, currentGuildId) => {
      if (friendIds.includes(friendId)) {
        guilds.add(currentGuildId);
      }
    });

    if (guildId) {
      const memberIds = guildCache
        .getGuild(guildId)
        ?.members.getMemberIds(guildId);
      if (memberIds?.includes(friendId)) {
        guilds.add(guildId);
      }
    }

    return [...guilds];
  }

  getFriendIds(guildId: string): string[] {
    return this.guildFriendIdsMap.get(guildId) || [];
  }

  setFriendIds(guildId: string, friendIds: string[]): void {
    if (Array.isArray(friendIds)) {
      this.guildFriendIdsMap.set(guildId, friendIds);
    }
  }

  addFriendId(guildId: string, friendId: string): void {
    const friendIds = this.getFriendIds(guildId);
    if (!friendIds.includes(friendId)) {
      friendIds.push(friendId);
      this.setFriendIds(guildId, friendIds);
    }
  }

  removeFriendId(guildId: string, friendId: string): void {
    const friendIds = this.getFriendIds(guildId);
    const index = friendIds.indexOf(friendId);
    if (index !== -1) {
      friendIds.splice(index, 1);
      this.setFriendIds(guildId, friendIds);
    }
  }

  updateGuildFriends(guildId: string, newFriendIds: string[]): void {
    this.setFriendIds(guildId, newFriendIds);
  }

  updateSharedGuildsCache(guildsWithFriends: {
    [guildId: string]: string[];
  }): void {
    Object.keys(guildsWithFriends).forEach((guildId) => {
      this.setFriendIds(guildId, guildsWithFriends[guildId]);
    });
  }
}

class CacheGuild {
  guildId: string;
  guildName: string;
  isGuildUploadedImg: boolean;
  channels: ChannelCache;
  members: GuildMembersCache;
  messages: MessagesCache;
  invites: InviteIdsCache;
  emojis: EmojisCache;
  voiceChannels?: VoiceChannelCache;
  ownerId: string | null;
  guildVersion: string | null;
  rootChannel: string | null = null;

  constructor(guildId: string, guildName: string, isGuildUploadedImg: boolean) {
    this.guildId = guildId;
    this.guildName = guildName;
    this.isGuildUploadedImg = isGuildUploadedImg;
    this.channels = new ChannelCache();
    this.members = new GuildMembersCache();
    this.messages = new MessagesCache();
    this.invites = new InviteIdsCache();
    this.emojis = new EmojisCache();
    this.ownerId = null;
    this.guildVersion = null;
    if (initialState.sharedGuildsMap) {
      const sharedGuildsMap = new Map<string, string[]>(
        Object.entries(initialState.sharedGuildsMap)
      );
      const friendIds = sharedGuildsMap.get(guildId);
      if (Array.isArray(friendIds)) {
        sharedGuildsCache.setFriendIds(guildId, friendIds);
      }
    } else {
      console.error("sharedGuildsMap is not a valid object or is missing");
    }
  }
  setRootChannel(rootChannel: string): void {
    this.rootChannel = rootChannel;
  }

  getRootChannel() {
    const channels = this.channels.getChannels(this.guildId);
    for (const channel of channels) {
      if (channel.channelId === this.rootChannel) {
        return channel;
      }
    }
    return null;
  }

  isRootChannel(channelId: string): boolean {
    return this.rootChannel === channelId;
  }

  setName(guildName: string): void {
    this.guildName = guildName;
  }

  setOwner(ownerId: string): void {
    this.ownerId = ownerId;
  }

  getOwner(): string | null {
    return this.ownerId;
  }

  isOwner(userId: string): boolean {
    return this.ownerId === userId;
  }
  setGuildVersion(version: string): void {
    this.guildVersion = version;
  }

  hasMembers(): boolean {
    return this.members.getMembers(this.guildId).length > 0;
  }
}
interface GuildCache {
  guilds: { [key: string]: CacheGuild };
}
export const sharedGuildsCache = new SharedGuildsCache();

class GuildCache {
  public guilds!: { [key: string]: CacheGuild };
  public currentGuildId!: string;
  public currentChannelId!: string;
  public currentGuildName!: string;

  public static instance: GuildCache | null = null;

  public constructor() {
    if (GuildCache.instance) {
      return GuildCache.instance;
    }
    this.guilds = {};
    this.currentGuildId = "";
    this.currentChannelId = "";
    this.currentGuildName = "";
    GuildCache.instance = this;
  }

  public static getInstance(): GuildCache {
    if (!GuildCache.instance) {
      GuildCache.instance = new GuildCache();
    }
    return GuildCache.instance;
  }

  getGuild(guildId: string): CacheGuild | null {
    if (!guildId) {
      return null;
    }
    if (!this.guilds[guildId]) {
      this.guilds[guildId] = new CacheGuild(guildId, "Default Guild", false);
    }
    return this.guilds[guildId];
  }

  addGuild(guildData?: {
    guildId: string;
    guildName: string;
    isGuildUploadedImg: boolean;
  }): void {
    console.log(guildData);
    if (guildData && !this.guilds[guildData.guildId]) {
      this.guilds[guildData.guildId] = new CacheGuild(
        guildData.guildId,
        guildData.guildName,
        guildData.isGuildUploadedImg
      );
    }
  }

  removeGuild(guildId: string) {
    delete this.guilds[guildId];
  }

  doesGuildExist(guildId: string): boolean {
    return Boolean(this.guilds[guildId]);
  }
}

class GuildCacheInterface {
  guildCache: GuildCache;
  defaultGuild = "Default Guiild";

  constructor() {
    this.guildCache = GuildCache.getInstance();
  }

  // Guild
  addGuild(
    guildId: string,
    guildName: string,
    isGuildUploadedImg: boolean
  ): void {
    this.guildCache.addGuild({
      guildId,
      guildName,
      isGuildUploadedImg
    });
  }
  removeGuild(guildId: string) {
    this.guildCache.removeGuild(guildId);
  }

  getGuild(guildId: string): CacheGuild | null {
    return this.guildCache.getGuild(guildId);
  }

  setName(guildId: string, guildName: string): void {
    this.getGuild(guildId)?.setName(guildName);
  }

  setGuildOwner(guildId: string, ownerId: string): void {
    this.getGuild(guildId)?.setOwner(ownerId);
  }
  setGuildVersion(guildId: string, ownerId: string): void {
    this.getGuild(guildId)?.setGuildVersion(ownerId);
  }
  isGuildOwner(guildId: string, ownerId: string): boolean {
    return this.getGuild(guildId)?.getOwner() === ownerId;
  }

  doesGuildExist(guildId: string): boolean {
    return this.guildCache.doesGuildExist(guildId);
  }

  getGuildName(guildId: string): string | null {
    const guild = this.getGuild(guildId);
    return guild ? guild.guildName : null;
  }
  getIsUploaded(guildId: string): boolean | null {
    const guild = this.getGuild(guildId);
    return guild ? guild.isGuildUploadedImg : null;
  }

  // Invite
  addInvite(guildId: string, inviteId: string): void {
    console.log("Adding invites: ", guildId, inviteId);
    this.guildCache
      .getGuild(guildId)
      ?.invites.assignInviteId(guildId, inviteId);
  }

  getInviteId(guildId: string): string | null {
    guildId;
    const result = this.guildCache
      .getGuild(guildId)
      ?.invites.getInviteId(guildId);
    console.log("Invites for guild  ", Array.isArray(result), result);
    return result ?? null;
  }

  isInvitesEmpty(guildId: string): boolean {
    return (
      this.guildCache.getGuild(guildId)?.invites.isInvitesEmpty(guildId) ||
      false
    );
  }

  // Voice
  getVoiceChannelMembers(channelId: string): string[] | null {
    if (!channelId) {
      return null;
    }
    const guilds = Object.values(this.guildCache.guilds);

    for (const guild of guilds) {
      if (
        guild.voiceChannels &&
        guild.voiceChannels.channelId === channelId &&
        guild.voiceChannels
      ) {
        return guild.voiceChannels.getUsersInVoiceChannel();
      }
    }
    return null;
  }

  setVoiceChannelMembers(channelId: string, usersArray: string[]): void {
    if (!channelId) {
      return;
    }
    const guilds = Object.values(this.guildCache.guilds);

    guilds.forEach((guild) => {
      if (guild.voiceChannels && guild.voiceChannels.channelId === channelId) {
        usersArray.forEach((userId) => {
          if (guild.voiceChannels) {
            guild.voiceChannels.addUserToVoiceChannel(userId);
          }
        });
      }
    });
  }

  // Member
  getMembers(guildId: string): Member[] {
    return this.getGuild(guildId)?.members.getMembers(guildId) || [];
  }

  setMemberIds(guildId: string, membersArray: string[]): void {
    this.getGuild(guildId)?.members.setMemberIds(guildId, membersArray);
  }

  updateMembers(guildId: string, newMembers: Member[], add = true): void {
    this.getGuild(guildId)?.members.updateMembers(guildId, newMembers, add);
  }

  addMember(guildId: string, member: Member): void {
    this.updateMembers(guildId, [member], true);
  }

  removeMember(guildId: string, memberId: string): void {
    const member = this.getGuild(guildId)
      ?.members.getMembers(guildId)
      .find((m) => m.userId === memberId);
    if (member) {
      this.updateMembers(guildId, [member], false);
    }
  }

  isMembersEmpty(guildId: string): boolean {
    return this.getMembers(guildId).length === 0;
  }

  updateMemberStatus(guildId: string, memberId: string, status: string): void {
    this.getGuild(guildId)?.members.updateMemberStatus(
      guildId,
      memberId,
      status
    );
  }
  getGuildImageVersion(guildId: string) {
    return this.getGuild(guildId)?.guildVersion ?? "";
  }

  //Channel

  getChannels(guildId: string): CachedChannel[] {
    return this.getGuild(guildId)?.channels.getChannels(guildId) || [];
  }

  getChannel(guildId: string, channelId: string): CachedChannel | null {
    return (
      this.getGuild(guildId)
        ?.channels.getChannels(guildId)
        .find((channel) => channel.channelId === channelId) || null
    );
  }
  getChannelName(guildId: string, channelId: string): string {
    return this.getChannel(guildId, channelId)?.channelName || "";
  }

  getChannelNameWithoutGuild(channelId: string): string {
    const guilds = Object.values(this.guildCache.guilds);
    for (const guild of guilds) {
      const channels = this.getChannels(guild.guildId);
      for (const c of channels) {
        if (c.channelId === channelId) {
          return c.channelName ?? "";
        }
      }
    }
    return "";
  }
  getChannelWithoutGuild(channelId: string): CachedChannel | null {
    const guilds = Object.values(this.guildCache.guilds);
    for (const guild of guilds) {
      const channels = this.getChannels(guild.guildId);
      for (const c of channels) {
        if (c.channelId === channelId) {
          return c;
        }
      }
    }
    return null;
  }

  removeChannel(guildId: string, channelId: string): void {
    this.getGuild(guildId)?.channels.removeChannel(guildId, channelId);
  }

  isRootChannel(guildId: string, channelId: string): boolean {
    return !!this.getGuild(guildId)?.isRootChannel(channelId);
  }

  doesChannelExists(guildId: string, channelId: string) {
    return (
      this.getGuild(guildId)?.channels.doesChannelExist(guildId, channelId) ||
      false
    );
  }
  getRootChannel(guildId: string) {
    const result = this.getGuild(guildId)?.getRootChannel();
    return result;
  }

  getRootChannelData(guildId: string): CachedChannel | null {
    return this.getGuild(guildId)?.getRootChannel() ?? null;
  }
  setRootChannel(guildId: string, channelId: string): void {
    this.getGuild(guildId)?.setRootChannel(channelId);
  }

  isVoiceChannel(guildId: string, channelId: string): boolean {
    return (
      this.getGuild(guildId)?.channels.isVoiceChannel(guildId, channelId) ||
      false
    );
  }

  setChannels(guildId: string, channelsData: CachedChannel[]): void {
    this.getGuild(guildId)?.channels.setChannels(guildId, channelsData);
  }

  addChannel(guildId: string, channel: any): void {
    this.getGuild(guildId)?.channels.addChannel(guildId, channel);
  }

  editChannel(guildId: string, channel: CachedChannel): void {
    this.getGuild(guildId)?.channels.editChannel(guildId, channel);
  }

  getGuildVoiceChannelMembers(guildId: string, channelId: string): string[] {
    const members =
      this.getGuild(guildId)?.channels.getVoiceChannelMembers(
        guildId,
        channelId
      ) || [];
    return members.map((member) => member.userId);
  }

  addMemberToVoiceChannel(
    guildId: string,
    channelId: string,
    member: Member
  ): void {
    this.getGuild(guildId)?.channels.addVoiceChannelMember(
      guildId,
      channelId,
      member
    );
  }

  removeMemberFromVoiceChannel(
    guildId: string,
    channelId: string,
    memberId: string
  ): void {
    this.getGuild(guildId)?.channels.removeVoiceChannelMember(
      guildId,
      channelId,
      memberId
    );
  }

  // Messages
  setMessages(guildId: string, channelId: string, messages: Message[]): void {
    this.getGuild(guildId)?.messages.setMessages(channelId, messages);
  }

  getMessages(guildId: string, channelId: string): Message[] {
    return this.getGuild(guildId)?.messages.getMessages(channelId) || [];
  }
  getMessage(
    guildId: string,
    channelId: string,
    messageId: string
  ): Message | null {
    const messages = this.getMessages(guildId, channelId);
    return messages.find((msg) => msg.messageId === messageId) || null;
  }

  removeMessage(messageId: string, channelId: string, guildId: string): void {
    this.getGuild(guildId)?.messages.removeMessage(messageId, channelId);
  }
  addMessage(guildId: string, channelId: string, message: Message): void {
    this.getGuild(guildId)?.messages.addMessage(channelId, message);
  }

  //Emojis
  private loadingCache: { [key: string]: boolean } = {}; // Track emoji loading state per guild

  getEmojis(guildId: string): Emoji[] {
    return this.getGuild(guildId)?.emojis.getEmojis(guildId) || [];
  }

  setEmojis(guildId: string, emojis: Emoji[]): void {
    this.getGuild(guildId)?.emojis.setEmojis(guildId, emojis) || [];
  }
  addUploadedEmojis(guildId: string, emojiIds: string[]): void {
    this.getGuild(guildId)?.emojis.addUploadedEmojis(guildId, emojiIds) || [];
  }

  removeEmojis(guildId: string, emojiId: string): void {
    this.getGuild(guildId)?.emojis.removeEmojis(emojiId, guildId) || [];
  }

  getEmojiName(emojiId: string): string {
    const guilds = Object.values(this.guildCache.guilds);
    for (const guild of guilds) {
      const emojis = this.getEmojis(guild.guildId);
      const emoji = emojis.find((e) => e.fileId === emojiId);
      if (emoji) {
        return emojiId;
      }
    }
    return "";
  }

  doesEmojisForGuildExist(guildId: string): boolean {
    const emojis = this.getEmojis(guildId);
    return emojis && emojis.length > 0;
  }

  isEmojisLoading(guildId: string): boolean {
    return this.loadingCache[guildId] || false;
  }

  setEmojisLoading(guildId: string, isLoading: boolean): void {
    this.loadingCache[guildId] = isLoading;
  }
  // Shared guilds
  hasSharedGuild(friendId: string): boolean {
    return sharedGuildsCache.hasSharedGuild(friendId);
  }
}

class PinnedMessagesCache {
  private cachedPinnedMessages: Record<
    string,
    Record<string, DMHistoryResponse>
  > = {};

  getCachedPinnedMessages(
    guildId: string,
    channelId: string
  ): DMHistoryResponse | undefined {
    console.warn(this.cachedPinnedMessages);
    return this.cachedPinnedMessages[guildId]?.[channelId];
  }

  removeCachedPinnedMessage(messageId: string): void {
    for (const guildId in this.cachedPinnedMessages) {
      const channels = this.cachedPinnedMessages[guildId];
      for (const channelId in channels) {
        const messages = channels[channelId].messages;
        const index = messages.findIndex((msg) => msg.messageId === messageId);
        if (index !== -1) {
          const [removedMessage] = messages.splice(index, 1);
          if (messages.length === 0) {
            delete channels[channelId];
            if (Object.keys(channels).length === 0) {
              delete this.cachedPinnedMessages[guildId];
            }
          }
          if (removedMessage && removedMessage.userId) {
            appendToMessageContextList(messageId, removedMessage.userId, false);
          }
          return;
        }
      }
    }
  }

  cachePinnedMessages(data: DMHistoryResponse): void {
    if (!this.cachedPinnedMessages[data.guildId]) {
      this.cachedPinnedMessages[data.guildId] = {};
    }
    this.cachedPinnedMessages[data.guildId][data.channelId] = data;
    data.messages.forEach((m: Message) => {
      appendToMessageContextList(m.messageId, m.userId, false);
    });
  }

  doesMessageExist(
    guildId: string,
    channelId: string,
    messageId: string
  ): boolean {
    const messages = this.cachedPinnedMessages[guildId]?.[channelId]?.messages;
    if (!messages) return false;
    return messages.some((msg) => msg.messageId === messageId);
  }
}
export const pinnedMessagesCache = new PinnedMessagesCache();

export let currentMessagesCache: { [messageId: string]: HTMLElement } = {};

export function setMessagesCache(id: string, msg: HTMLElement) {
  currentMessagesCache[id] = msg;
}

export function clearMessagesCache() {
  currentMessagesCache = {};
}

export const replyCache: Record<string, MessageReply> = {};

const guildChatMessages: { [channelId: string]: Message[] } = {};

export const guildCache = new GuildCache();
export const cacheInterface = new GuildCacheInterface();
