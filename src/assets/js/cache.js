import { MINUS_INDEX } from "./utils";
class BaseCache {
  constructor() {
    this.data = {};
  }
  set(key, value) {
    this.data[key] = value;
  }
  get(key) {
    return this.data[key] || null;
  }
  setArray(key, value) {
    this.data[key] = Array.isArray(value) ? value : [];
  }
  setObject(key, value) {
    this.data[key] = typeof value === "object" && value !== null ? value : {};
  }
  remove(key, id) {
    if (this.data[key]) {
      this.data[key] = this.data[key].filter((item) => item !== id);
    }
  }
}
class ChannelCache extends BaseCache {
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
      (_channel) => _channel.channelId === channel.channelId,
    );
    if (index === MINUS_INDEX) {
      channels.push(channel);
      this.setChannels(guildId, channels);
    }
  }
  removeChannel(guildId, channelId) {
    const channels = this.getChannels(guildId).filter(
      (ch) => ch.id !== channelId,
    );
    this.setChannels(guildId, channels);
  }
  getChannels(guildId) {
    return this.get(guildId) || [];
  }
  isRootChannel(guildId, channelId) {
    console.log();
    console.log("Root channel unhandled");
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
      (_channel) => _channel.channelId === channel.channelId,
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
          (existingMember) => existingMember.id === member.id,
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
        (member) => member.id !== memberId,
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
      this.updateMemberId(guildId, memberId, add),
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
      (msg) => msg.id !== messageId,
    );
    this.setMessages(channelId, messages);
  }
}
class InviteIdsCache extends BaseCache {
  assignInviteIds(guildId, inviteId) {
    this.setObject(guildId, inviteId);
  }
  getInviteIds(guildId) {
    return this.get(guildId) || [];
  }
}
class VoiceChannelCache extends BaseCache {
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
  constructor(guildId, guildName) {
    this.guildId = guildId;
    this.guildName = guildName;
    this.channels = new ChannelCache();
    this.members = new GuildMembersCache();
    this.messages = new MessagesCache();
    this.invites = new InviteIdsCache();
    this.voiceChannels = new VoiceChannelCache();
    this.ownerId = null;
  }
  setName(guildName) {
    this.guildName = guildName;
  }
  setOwner(ownerId) {
    this.ownerId = ownerId;
  }
  getOwner() {
    return this.ownerId;
  }
  isOwner(userId) {
    return this.ownerId === userId;
  }
  hasMembers() {
    return this.members.getMembers(this.guildId).length > 0;
  }
}
class GuildCache {
  constructor() {
    if (GuildCache.instance) {
      return GuildCache.instance;
    }
    this.guilds = {};
    this.currentGuildId = "";
    this.currentChannelId = "";
    GuildCache.instance = this;
  }

  getGuild(guildId) {
    if (!guildId) return null;
    if (!this.guilds[guildId]) {
      this.guilds[guildId] = new Guild(guildId);
    }
    return this.guilds[guildId];
  }
  addGuild(guildData) {
    if (!guildData) return;
    const guildId = guildData.guildId;
    const guildName = guildData.guildName;
    if (!this.guilds[guildId]) {
      this.guilds[guildId] = new Guild(guildId, guildName);
    }
  }
  doesGuildExist(guildId) {
    return Boolean(this.guilds[guildId]);
  }
}
class GuildCacheInterface {
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
  isInvitesEmpty(guildId) {
    return (
      this.guildCache.getGuild(guildId).invites.getInviteIds(guildId) !== null
    );
  }
  //voice
  getVoiceChannelMembers(channelId) {
    if (!channelId) return null;
    for (const guild of this.guildCache.guilds) {
      if (guild.channelId === channelId && guild.voiceChannels) {
        return guild.voiceChannels.getUsersInVoiceChannel();
      }
    }
    return null;
  }

  setVoiceChannelMembers(channelId, usersArray) {
    if (!channelId) return;
    this.guildCache.guilds.forEach((guild) => {
      if (guild.channelId === channelId && guild.voiceChannels) {
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
    this.getGuild(guildId).members.setMemberIds(membersArray);
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
    return this.getGuild(guildId)?.channels.getChannels() || [];
  }
  removeChannel(guildId, channelId) {
    this.getGuild(guildId)?.channels.removeChannel(guildId, channelId);
  }
  isRootChannel(guildId, channelId) {
    return this.getGuild(guildId)?.channels.isRootChannel(guildId, channelId);
  }
  getRootChannel(guildId) {
    return this.getGuild(guildId)?.channels.getRootChannel(guildId);
  }
  setRootChannel(guildId, channelId) {
    this.getGuild(guildId)?.channels.setRootChannel(channelId);
  }
  setChannels(guildId, channelsData) {
    this.getGuild(guildId)?.channels.setChannels(channelsData);
  }
  addChannel(guildId, channel) {
    this.getGuild(guildId)?.channels.addChannel(guildId, channel);
  }
  getGuildVoiceChannelMembers(guildId, channelId) {
    return this.getGuild(guildId)?.getVoiceChannelMembers(channelId) || [];
  }
  addMemberToVoiceChannel(guildId, channelId, member) {
    this.getGuild(guildId)?.addMemberToVoiceChannel(channelId, member);
  }
  removeMemberFromVoiceChannel(guildId, channelId, memberId) {
    this.getGuild(guildId)?.removeMemberFromVoiceChannel(channelId, memberId);
  }
  //messages
  setMessages(guildId, channelId, messages) {
    this.getGuild(guildId)?.messages.setMessages(channelId, messages);
  }
  getMessages(guildId, channelId) {
    return this.getGuild(guildId)?.messages.getMessages(channelId) || [];
  }
}
export let currentMessagesCache = {}; //<messageId> <messageElements>
export function setMessagesCache(id, msg) {
  currentMessagesCache[id] = msg;
}
export function clearMessagesCache() {
  currentMessagesCache = {};
}

export const replyCache = {}; //<messageId> <replies>
export const guildChatMessages = {}; //<channelId> <messageObjects>
export const messages_raw_cache = {}; //<channelId> <messageRawJsons>
export function hasSharedGuild(friend_id) {
  //return shared_guilds_map.hasOwnProperty(friend_id);
}
export const guildCache = new GuildCache();
export const cacheInterface = new GuildCacheInterface();
