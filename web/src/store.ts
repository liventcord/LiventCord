import { createStore } from "vuex";
import { userManager } from "./ts/user";
import { Channel } from "./ts/channels";
import { AttachmentWithMetaData } from "./ts/message";

interface UserMember {
  userId: string;
  status: string;
  nickName?: string;
  discriminator?: string;
  isOnline?: boolean;
  isTyping?: boolean;
}

interface UserState {
  members: UserMember[];
  onlineUsers: UserMember[];
  offlineUsers: UserMember[];
}

interface ChannelHoverInfo {
  isTextChannel: boolean;
}

interface RootState {
  hasMoreAttachments: boolean;
  user: UserState;
  channels: Channel[];
  hoveredChannels: Record<string, ChannelHoverInfo>;
  selectedTextChannelId: string | null;
  selectedVoiceChannelId: string | null;
  attachments: AttachmentWithMetaData[];
  currentPage: number;
}

export default createStore<RootState>({
  state: {
    user: {
      members: [],
      onlineUsers: [],
      offlineUsers: []
    },
    channels: [],
    hoveredChannels: {},
    selectedTextChannelId: null,
    selectedVoiceChannelId: null,
    attachments: [],
    hasMoreAttachments: true,
    currentPage: 1
  },
  mutations: {
    setAttachments(state, attachments: AttachmentWithMetaData[]) {
      const seen = new Set();
      state.attachments = attachments.filter(({ attachment }) => {
        if (seen.has(attachment.fileId)) return false;
        seen.add(attachment.fileId);
        return true;
      });
    },

    setChannels(state, channels: Channel[]) {
      state.channels = channels;
    },

    setCurrentPage(state, page: number) {
      state.currentPage = page;
    },

    increaseCurrentPage(state) {
      state.currentPage++;
    },

    setChannel(state, channel: Channel) {
      const index = state.channels.findIndex(
        (c) => c.channelId === channel.channelId
      );
      if (index !== -1) state.channels[index] = channel;
      else state.channels.push(channel);
    },

    addChannel(state, channel: Channel) {
      if (!state.channels.find((c) => c.channelId === channel.channelId))
        state.channels.push(channel);
    },

    editChannel(
      state,
      { channelId, channelName }: { channelId: string; channelName: string }
    ) {
      const index = state.channels.findIndex((c) => c.channelId === channelId);
      if (index !== -1) state.channels[index].channelName = channelName;
    },

    removeChannel(state, channelId: string) {
      const index = state.channels.findIndex((c) => c.channelId === channelId);
      if (index !== -1) state.channels.splice(index, 1);
    },

    updateUserStatus(
      state,
      {
        userId,
        status,
        isTyping
      }: { userId: string; status: string; isTyping?: boolean }
    ) {
      const memberIndex = state.user.members.findIndex(
        (m) => m.userId === userId
      );
      if (memberIndex !== -1)
        state.user.members[memberIndex] = {
          ...state.user.members[memberIndex],
          status
        };
      else state.user.members.push({ userId, status });

      const existingUser = [
        ...state.user.onlineUsers,
        ...state.user.offlineUsers
      ].find((u) => u.userId === userId);
      if (existingUser) {
        const updatedUser = {
          ...existingUser,
          isOnline: status !== "offline",
          status,
          isTyping
        };
        state.user.onlineUsers = state.user.onlineUsers.filter(
          (u) => u.userId !== userId
        );
        state.user.offlineUsers = state.user.offlineUsers.filter(
          (u) => u.userId !== userId
        );
        if (status === "offline") state.user.offlineUsers.push(updatedUser);
        else state.user.onlineUsers.push(updatedUser);
      }
    },

    setUsers(
      state,
      {
        onlineUsers,
        offlineUsers
      }: { onlineUsers: UserMember[]; offlineUsers: UserMember[] }
    ) {
      state.user.onlineUsers = onlineUsers;
      state.user.offlineUsers = offlineUsers;
    },

    SET_HOVERED_CHANNEL(
      state,
      {
        channelId,
        isTextChannel
      }: { channelId: string; isTextChannel: boolean }
    ) {
      state.hoveredChannels[channelId] = { isTextChannel };
    },

    CLEAR_HOVERED_CHANNEL(state, { channelId }: { channelId: string }) {
      delete state.hoveredChannels[channelId];
    },

    SELECT_CHANNEL(
      state,
      {
        channelId,
        isTextChannel
      }: { channelId: string; isTextChannel: boolean }
    ) {
      if (isTextChannel) state.selectedTextChannelId = channelId;
      else state.selectedVoiceChannelId = channelId;
      state.hoveredChannels[channelId] = { isTextChannel };
    },

    CLEAR_SELECTED_VOICE_CHANNEL(state) {
      state.selectedVoiceChannelId = null;
    },

    setHasMoreAttachments(state, value: boolean) {
      state.hasMoreAttachments = value;
    },

    updateVoiceChannelUsers(
      state,
      { channelId, userIds }: { channelId: string; userIds: string[] }
    ) {
      const channel = state.channels.find((c) => c.channelId === channelId);
      if (channel) {
        const uniqueIds = [...new Set(userIds)];
        channel.voiceUsers = uniqueIds.map((userId) => ({
          id: userId,
          name: userManager.getUserNick(userId)
        }));
      }
    },
    removeVoiceUser(
      state,
      { channelId, userId }: { channelId: string; userId: string }
    ) {
      const channel = state.channels.find((c) => c.channelId === channelId);
      if (channel && channel.voiceUsers) {
        channel.voiceUsers = channel.voiceUsers.filter((u) => u.id !== userId);
      }
    }
  },

  actions: {
    async updateStatusInMembersList(
      { commit },
      {
        userId,
        status,
        isTyping
      }: { userId: string; status: string; isTyping?: boolean }
    ) {
      commit("updateUserStatus", { userId, status, isTyping });
      return { userId, status };
    },

    async setChannels({ commit }, channels: Channel[]) {
      commit("setChannels", channels);
    },

    async setAttachments({ commit }, attachments: AttachmentWithMetaData[]) {
      commit("setAttachments", attachments);
    },

    async setChannel({ commit }, channel: Channel) {
      commit("setChannel", channel);
    },

    async addChannel({ commit }, channel: Channel) {
      commit("addChannel", channel);
    },

    async editChannel(
      { commit },
      payload: { channelId: string; channelName: string }
    ) {
      commit("editChannel", payload);
    },

    async categorizeUsers({ commit }, members: UserMember[]) {
      const onlineUsers: UserMember[] = [];
      const offlineUsers: UserMember[] = [];
      for (const member of members) {
        if (!member.userId)
          throw new Error("User ID cannot be null or undefined");
        const isOnline = await userManager.isNotOffline(member.userId);
        const categorizedMember = {
          ...member,
          isOnline,
          status: isOnline ? "online" : "offline"
        };
        if (isOnline) onlineUsers.push(categorizedMember);
        else offlineUsers.push(categorizedMember);
      }
      commit("setUsers", { onlineUsers, offlineUsers });
      return { onlineUsers, offlineUsers };
    },

    setHoveredChannel(
      { commit },
      {
        channelId,
        isTextChannel
      }: { channelId: string; isTextChannel: boolean }
    ) {
      commit("SET_HOVERED_CHANNEL", { channelId, isTextChannel });
    },

    clearHoveredChannel({ commit }, { channelId }: { channelId: string }) {
      commit("CLEAR_HOVERED_CHANNEL", { channelId });
    },

    selectChannel(
      { commit },
      payload: { channelId: string; isTextChannel: boolean }
    ) {
      commit("SELECT_CHANNEL", payload);
    },

    setHasMoreAttachments({ commit }, value: boolean) {
      commit("setHasMoreAttachments", value);
    },

    clearSelectedVoiceChannel({ commit }) {
      commit("CLEAR_SELECTED_VOICE_CHANNEL");
    },
    updateVoiceUsers(
      { commit },
      { channelId, userIds }: { channelId: string; userIds: string[] }
    ) {
      commit("updateVoiceChannelUsers", { channelId, userIds });
    },

    removeVoiceUser(
      { commit },
      { channelId, userId }: { channelId: string; userId: string }
    ) {
      commit("removeVoiceUser", { channelId, userId });
    }
  },

  getters: {
    getUserStatus: (state) => (userId: string) => {
      const member = state.user.members.find((m) => m.userId === userId);
      return member ? member.status : "offline";
    },

    isChannelHovered: (state) => (channelId: string) =>
      !!state.hoveredChannels[channelId],

    isChannelSelected:
      (state) => (channelId: string, isTextChannel: boolean) =>
        isTextChannel
          ? state.selectedTextChannelId === channelId
          : state.selectedVoiceChannelId === channelId,

    getChannelById: (state) => (channelId: string) =>
      state.channels.find((c) => c.channelId === channelId),

    getOnlineUsers: (state) => state.user.onlineUsers,

    getOfflineUsers: (state) => state.user.offlineUsers,

    hasMoreAttachments: (state) => state.hasMoreAttachments,

    currentPage: (state) => state.currentPage
  }
});
