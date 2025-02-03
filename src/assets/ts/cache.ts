import { MINUS_INDEX } from "./utils.ts";
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
  rootChannel: string;
  contructor() {
    this.rootChannel = null;
  }
  setRootChannel(rootChannel) {
    console.log("Set root channel: ", rootChannel);
    this.rootChannel = rootChannel;
  }
  setChannels(guildId, channels) {
    this.setArray(guildId, channels);
  }
  addChannel(guildId, channel) {
    const channels = this.getChannels(guildId);
    const index = channels.findIndex(
      (_channel) => _channel.channelId === channel.channelId
    );
    if (index === MINUS_INDEX) {
      channels.push(channel);
      this.setChannels(guildId, channels);
    }
  }
  editChannel(guildId, channel) {
    const channels = this.getChannels(guildId);
    const index = channels.findIndex(
      (_channel) => _channel.channelId === channel.channelId
    );
    if (index !== MINUS_INDEX) {
      channels[index] = { ...channels[index], ...channel };
      this.setChannels(guildId, channels);
    } else {
      console.log("Channel not found for guild:", guildId);
    }
  }

  removeChannel(guildId, channelId) {
    const channels = this.getChannels(guildId).filter(
      (ch) => ch.id !== channelId
    );
    this.setChannels(guildId, channels);
  }
  getChannels(guildId) {
    return this.get(guildId) || [];
  }
  isRootChannel(guildId, channelId): boolean {
    console.log();
    console.log("Root channel unhandled");
    return false;
  }
  getRootChannel(guildId) {
    console.log(this, this.rootChannel);
    const channels = this.getChannels(guildId)[0];
    for (const channel of channels) {
      console.log(channel);
      if (channel.channelId === this.rootChannel) {
        return channel;
      }
    }
    return null;
  }

  updateChannel(guildId, channel, add = true) {
    const channels = this.getChannels(guildId);
    const index = channels.findIndex(
      (_channel) => _channel.channelId === channel.channelId
    );
    if (add && index === MINUS_INDEX) {
      channels.push(channel);
    } else if (!add && index !== MINUS_INDEX) {
      channels.splice(index, 1);
    }
    this.setChannels(guildId, channels);
  }
  addVoiceChannelMember(guildId, channelId, member) {
    const channel = this.getChannels(guildId).find((ch) => ch.id === channelId);
    if (channel) {
      channel.voiceMembers = channel.voiceMembers || [];
      if (
        !channel.voiceMembers.some(
          (existingMember) => existingMember.id === member.id
        )
      ) {
        channel.voiceMembers.push(member);
      }
    }
  }
  removeVoiceChannelMember(guildId, channelId, memberId) {
    const channel = this.getChannels(guildId).find((ch) => ch.id === channelId);
    if (channel) {
      channel.voiceMembers = channel.voiceMembers.filter(
        (member) => member.id !== memberId
      );
    }
  }
  getVoiceChannelMembers(guildId, channelId) {
    const channel = this.getChannels(guildId).find((ch) => ch.id === channelId);
    return channel ? channel.voiceMembers || [] : [];
  }
}
class GuildMembersCache extends BaseCache {
  getMemberIds(guildId) {
    return this.get(`${guildId}:memberIds`) || [];
  }
  getMembers(guildId) {
    return this.get(`${guildId}:members`) || [];
  }
  setMemberIds(guildId, memberIds) {
    this.set(`${guildId}:memberIds`, Array.isArray(memberIds) ? memberIds : []);
  }
  setMembers(guildId, members) {
    this.set(`${guildId}:members`, Array.isArray(members) ? members : []);
  }
  updateMemberId(guildId, memberId, add = true) {
    const memberIds = this.getMemberIds(guildId);
    const index = memberIds.indexOf(memberId);
    if (add && index === MINUS_INDEX) memberIds.push(memberId);
    else if (!add && index !== MINUS_INDEX) memberIds.splice(index, 1);
    this.setMemberIds(guildId, memberIds);
  }
  updateMember(guildId, member, add = true) {
    const members = this.getMembers(guildId);
    const index = members.findIndex((m) => m.id === member.id);
    if (add && index === MINUS_INDEX) members.push(member);
    else if (!add && index !== MINUS_INDEX) members.splice(index, 1);
    this.setMembers(guildId, members);
  }
  updateMemberIds(guildId, newMemberIds, add = true) {
    const uniqueMemberIds = [...new Set(newMemberIds)];
    uniqueMemberIds.forEach((memberId) =>
      this.updateMemberId(guildId, memberId, add)
    );
  }
  updateMembers(guildId, newMembers, add = true) {
    newMembers.forEach((member) => this.updateMember(guildId, member, add));
  }
}
class MessagesCache extends BaseCache {
  setMessages(channelId, messages) {
    this.setArray(channelId, messages);
  }
  getMessages(channelId) {
    return this.get(channelId) || [];
  }
  removeMessage(messageId, channelId) {
    const messages = this.getMessages(channelId).filter(
      (msg) => msg.id !== messageId
    );
    this.setMessages(channelId, messages);
  }
}
class InviteIdsCache extends BaseCache {
  assignInviteIds(guildId, inviteId) {
    this.setObject(guildId, inviteId);
  }
  getInviteId(guildId) {
    const inviteIds = this.get(guildId);
    return inviteIds[0] || [];
  }
  isInvitesEmpty(guildId) {
    const inviteIds = this.get(guildId);
    return inviteIds !== null;
  }
}
class VoiceChannelCache extends BaseCache {
  channelId: string;
  constructor(channelId) {
    super();
    this.channelId = channelId;
  }
  addUserToVoiceChannel(userId) {
    const users = this.get(this.channelId) || [];
    if (!users.includes(userId)) {
      users.push(userId);
      this.set(this.channelId, users);
    }
  }
  removeUserFromVoiceChannel(userId) {
    const users = this.get(this.channelId) || [];
    const updatedUsers = users.filter((user) => user !== userId);
    this.set(this.channelId, updatedUsers);
  }
  getUsersInVoiceChannel() {
    return this.get(this.channelId) || [];
  }
}
class Guild {
  guildId: string;
  guildName: string;
  channels: ChannelCache;
  members: GuildMembersCache;
  messages: MessagesCache;
  invites: InviteIdsCache;
  voiceChannels: VoiceChannelCache;
  ownerId: string | null;

  constructor(guildId: string, guildName: string) {
    this.guildId = guildId;
    this.guildName = guildName;
    this.channels = new ChannelCache();
    this.members = new GuildMembersCache();
    this.messages = new MessagesCache();
    this.invites = new InviteIdsCache();
    this.ownerId = null;
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

  hasMembers(): boolean {
    return this.members.getMembers(this.guildId).length > 0;
  }
}
interface GuildCache {
  guilds: { [key: string]: Guild };
}

class GuildCache {
  public guilds: { [key: string]: Guild };
  public currentGuildId: string;
  public currentChannelId: string;
  public currentGuildName: string;

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

  getGuild(guildId: string): Guild | null {
    if (!guildId) return null;
    if (!this.guilds[guildId]) {
      this.guilds[guildId] = new Guild(guildId, "Default Guild");
    }
    return this.guilds[guildId];
  }

  addGuild(guildData: { guildId: string; guildName: string }): void {
    if (!guildData) return;
    const { guildId, guildName } = guildData;
    if (!this.guilds[guildId]) {
      this.guilds[guildId] = new Guild(guildId, guildName);
    }
  }

  doesGuildExist(guildId: string): boolean {
    return Boolean(this.guilds[guildId]);
  }
}

GuildCache.instance = undefined;
class GuildCacheInterface {
  guildCache: GuildCache;
  constructor() {
    this.guildCache = new GuildCache();
  }
  //guild
  addGuild(guildData) {
    this.guildCache.addGuild(guildData);
  }
  getGuild(guildId) {
    return this.guildCache.getGuild(guildId);
  }
  setName(guildId, guildName) {
    this.getGuild(guildId)?.setName(guildName);
  }
  setGuildOwner(guildId, ownerId) {
    this.getGuild(guildId)?.setOwner(ownerId);
  }
  doesGuildExist(guildId) {
    return this.guildCache.doesGuildExist(guildId);
  }
  getGuildName(guildId) {
    return this.guildCache.getGuild(guildId).guildName;
  }
  //invite
  addInvites(guildId, inviteIds) {
    this.guildCache
      .getGuild(guildId)
      .invites.assignInviteIds(guildId, inviteIds);
  }
  getInviteId(guildId) {
    return this.guildCache.getGuild(guildId).invites.getInviteId(guildId);
  }
  isInvitesEmpty(guildId) {
    return this.guildCache.getGuild(guildId).invites.isInvitesEmpty(guildId);
  }
  //voice
  getVoiceChannelMembers(channelId: string) {
    if (!channelId) return null;
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

  setVoiceChannelMembers(channelId: string, usersArray: string[]) {
    if (!channelId) return;
    const guilds = Object.values(this.guildCache.guilds);

    guilds.forEach((guild) => {
      if (
        guild.voiceChannels &&
        guild.voiceChannels.channelId === channelId &&
        guild.voiceChannels
      ) {
        usersArray.forEach((userId) => {
          guild.voiceChannels.addUserToVoiceChannel(userId);
        });
      }
    });
  }
  //member
  getMembers(guildId) {
    return this.getGuild(guildId)?.members.getMembers(guildId) || [];
  }
  setMemberIds(guildId, membersArray) {
    this.getGuild(guildId).members.setMemberIds(guildId, membersArray);
  }
  updateMembers(guildId, newMembers, add = true) {
    this.getGuild(guildId)?.members.updateMembers(guildId, newMembers, add);
  }
  addMember(guildId, member) {
    this.updateMembers(guildId, [member], true);
  }
  removeMember(guildId, memberId) {
    this.updateMembers(guildId, [{ id: memberId }], false);
  }
  isMembersEmpty(guildId) {
    return this.getMembers(guildId).length === 0;
  }
  //channels
  getChannels(guildId) {
    return this.getGuild(guildId)?.channels.getChannels(guildId)[0] || [];
  }
  removeChannel(guildId, channelId) {
    this.getGuild(guildId)?.channels.removeChannel(guildId, channelId);
  }
  isRootChannel(guildId, channelId): boolean {
    return this.getGuild(guildId)?.channels.isRootChannel(guildId, channelId);
  }
  getRootChannel(guildId) {
    return this.getGuild(guildId)?.channels.getRootChannel(guildId);
  }
  setRootChannel(guildId, channelId) {
    this.getGuild(guildId)?.channels.setRootChannel(channelId);
  }
  setChannels(guildId, channelsData) {
    this.getGuild(guildId)?.channels.setChannels(guildId, channelsData);
  }
  addChannel(guildId, channel) {
    this.getGuild(guildId)?.channels.addChannel(guildId, channel);
  }
  editChannel(guildId, channel) {
    this.getGuild(guildId)?.channels.editChannel(guildId, channel);
  }
  getGuildVoiceChannelMembers(guildId, channelId) {
    return (
      this.getGuild(guildId)?.channels.getVoiceChannelMembers(
        guildId,
        channelId
      ) || []
    );
  }
  addMemberToVoiceChannel(guildId, channelId, member) {
    this.getGuild(guildId)?.channels.addVoiceChannelMember(
      guildId,
      channelId,
      member
    );
  }
  removeMemberFromVoiceChannel(guildId, channelId, memberId) {
    this.getGuild(guildId)?.channels.removeVoiceChannelMember(
      guildId,
      channelId,
      memberId
    );
  }
  //messages
  setMessages(guildId, channelId, messages) {
    this.getGuild(guildId)?.messages.setMessages(channelId, messages);
  }
  getMessages(guildId, channelId) {
    return this.getGuild(guildId)?.messages.getMessages(channelId) || [];
  }
  removeMessage(messageId, channelId, guildId) {
    this.getGuild(guildId)?.messages.removeMessage(messageId, channelId);
  }
}
export let currentMessagesCache = {}; //<messageId> <messageElements>
export function setMessagesCache(id, msg) {
  currentMessagesCache[id] = msg;
}
export function clearMessagesCache() {
  currentMessagesCache = {};
}
interface Reply {
  userId: string;
  content: string;
  attachmentUrls: string[];
}

interface Message {
  messageId: string;
  replies: Reply[];
}

export const replyCache: Record<string, Message> = {};

export const guildChatMessages = {}; //<channelId> <messageObjects>
export const messages_raw_cache = {}; //<channelId> <messageRawJsons>
export const shared_guilds_map: Record<string, any> = {};
export function hasSharedGuild(friend_id): boolean {
  return shared_guilds_map.hasOwnProperty(friend_id);
}
export const guildCache = new GuildCache();
export const cacheInterface = new GuildCacheInterface();
