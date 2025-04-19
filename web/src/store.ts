import { createStore } from "vuex";
import { userManager } from "./ts/user";
import { Channel } from "./ts/channels";
import { guildCache } from "./ts/cache";
import { AttachmentWithMetaData } from "./ts/message";
interface UserMember {
  userId: string;
  status: string;
  nickName?: string;
  discriminator?: string;
  isOnline?: boolean;
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
  user: UserState;
  channels: Channel[];
  hoveredChannels: Record<string, ChannelHoverInfo>;
  selectedChannelId: string | null;
  selectedChannelType: boolean | null;
  attachments: AttachmentWithMetaData[];
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
    selectedChannelId: null,
    selectedChannelType: null,
    attachments: []
  },
  mutations: {
    setAttachments(state, attachments: AttachmentWithMetaData[]) {
      console.log(state.attachments);
      state.attachments = attachments;
    },
    setChannels(state, channels: Channel[]) {
      state.channels = channels;
    },

    setChannel(state, channel: Channel) {
      const existingChannelIndex = state.channels.findIndex(
        (c) => c.channelId === channel.channelId
      );

      if (existingChannelIndex !== -1) {
        state.channels[existingChannelIndex] = channel;
      } else {
        state.channels.push(channel);
      }
    },

    addChannel(state, channel: Channel) {
      const existingChannelIndex = state.channels.findIndex(
        (c) => c.channelId === channel.channelId
      );

      if (existingChannelIndex === -1) {
        state.channels.push(channel);
      }
    },
    editChannel(
      state,
      { channelId, channelName }: { channelId: string; channelName: string }
    ) {
      const channelIndex = state.channels.findIndex(
        (channel) => channel.channelId === channelId
      );
      if (channelIndex !== -1) {
        state.channels[channelIndex].channelName = channelName;
      }
    },
    removeChannel(state, channelId: string) {
      const channelIndex = state.channels.findIndex(
        (channel) => channel.channelId === channelId
      );
      if (channelIndex !== -1) {
        state.channels.splice(channelIndex, 1);
      }
    },

    changeChannel(state, channelId: string) {
      guildCache.currentChannelId = channelId;
    },

    updateUserStatus(state, { userId, status }) {
      if (!userId) {
        throw new Error("User ID cannot be null or undefined");
      }

      const memberIndex = state.user.members.findIndex(
        (member) => member.userId === userId
      );

      if (memberIndex !== -1) {
        state.user.members[memberIndex] = {
          ...state.user.members[memberIndex],
          status
        };
      } else {
        state.user.members.push({ userId, status });
      }

      const existingUser = [
        ...state.user.onlineUsers,
        ...state.user.offlineUsers
      ].find((user) => user.userId === userId);

      if (existingUser) {
        const updatedUser = {
          ...existingUser,
          isOnline: status !== "offline",
          status
        };

        state.user.onlineUsers = state.user.onlineUsers.filter(
          (u) => u.userId !== userId
        );
        state.user.offlineUsers = state.user.offlineUsers.filter(
          (u) => u.userId !== userId
        );

        if (status === "offline") {
          state.user.offlineUsers.push(updatedUser);
        } else {
          state.user.onlineUsers.push(updatedUser);
        }
      }
    },

    setUsers(state, { onlineUsers, offlineUsers }) {
      state.user.onlineUsers = onlineUsers;
      state.user.offlineUsers = offlineUsers;
    },

    SET_HOVERED_CHANNEL(state, { channelId, isTextChannel }) {
      state.hoveredChannels[channelId] = { isTextChannel };
    },

    CLEAR_HOVERED_CHANNEL(state, { channelId }) {
      delete state.hoveredChannels[channelId];
    },

    SELECT_CHANNEL(state, { channelId, isTextChannel }) {
      state.selectedChannelId = channelId;
      state.selectedChannelType = isTextChannel;

      state.hoveredChannels = {
        [channelId]: { isTextChannel }
      };
    }
  },

  actions: {
    async updateStatusInMembersList({ commit }, { userId, status }) {
      if (!userId) {
        throw new Error("User ID cannot be null or undefined");
      }
      commit("updateUserStatus", { userId, status });
      return { userId, status };
    },

    async setChannels({ commit }, channels) {
      commit("setChannels", channels);
    },

    async setAttachments({ commit }, attachments) {
      commit("setAttachments", attachments);
    },

    async setChannel({ commit }, channel) {
      commit("setChannel", channel);
    },

    async addChannel({ commit }, channel) {
      commit("addChannel", channel);
    },
    async editChannel({ commit }, channel) {
      commit("editChannel", channel);
    },

    async categorizeUsers({ commit }, members) {
      const onlineUsers: UserMember[] = [];
      const offlineUsers: UserMember[] = [];

      for (const member of members) {
        if (!member.userId) {
          throw new Error("User ID cannot be null or undefined");
        }

        const isOnline = await userManager.isNotOffline(member.userId);
        const categorizedMember = {
          ...member,
          isOnline,
          status: isOnline ? "online" : "offline"
        };

        if (isOnline) {
          onlineUsers.push(categorizedMember);
        } else {
          offlineUsers.push(categorizedMember);
        }
      }

      commit("setUsers", { onlineUsers, offlineUsers });
      return { onlineUsers, offlineUsers };
    },

    setHoveredChannel({ commit }, { channelId, isTextChannel }) {
      commit("SET_HOVERED_CHANNEL", { channelId, isTextChannel });
    },

    clearHoveredChannel({ commit }, { channelId }) {
      commit("CLEAR_HOVERED_CHANNEL", { channelId });
    },

    selectChannel({ commit }, props) {
      commit("SELECT_CHANNEL", {
        channelId: props.channelId,
        isTextChannel: props.isTextChannel
      });
    }
  },

  getters: {
    getUserStatus: (state) => (userId: string) => {
      const member = state.user.members.find((m) => m.userId === userId);
      return member ? member.status : "offline";
    },

    isChannelHovered: (state) => (channelId: string) => {
      return !!state.hoveredChannels[channelId];
    },

    isChannelSelected: (state) => (channelId: string) => {
      return state.selectedChannelId === channelId;
    },

    getChannelById: (state) => (channelId: string) => {
      return state.channels.find((channel) => channel.channelId === channelId);
    },

    getOnlineUsers: (state) => {
      return state.user.onlineUsers;
    },

    getOfflineUsers: (state) => {
      return state.user.offlineUsers;
    }
  }
});
