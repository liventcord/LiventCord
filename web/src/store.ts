import { createStore } from "vuex";
import { userManager } from "./ts/user";

export default createStore({
  state: {
    guild: {
      currentGuildId: null
    },
    user: {
      currentUserId: null,
      currentUserNick: "",
      currentDiscriminator: "",
      DEFAULT_DISCRIMINATOR: "0000",
      members: [] as Array<{ userId: string; status: string }>
    }
  },
  mutations: {
    updateUserStatus(state, { userId, status }) {
      const _member = state.user.members.find(
        (member) => member.userId === userId
      );
      if (_member) {
        _member.status = status;
      } else {
        state.user.members.push({ userId, status });
      }
    }
  },
  actions: {
    async isNotOffline(_, userId) {
      return await userManager.isNotOffline(userId);
    },
    async isOnline(_, userId) {
      return await userManager.isOnline(userId);
    },
    async updateStatusInMembersList({ commit }, { userId, status }) {
      commit("updateUserStatus", { userId, status });
    }
  },
  getters: {
    "guild/getGuild": (state) => (guildId: string) => {
      return { isOwner: (userId: string) => userId === "1" };
    },
    "friends/getFriendDiscriminator": (state) => (friendId: string) => {
      return state.user.DEFAULT_DISCRIMINATOR;
    },
    getUserStatus: (state) => (userId: string) => {
      const member = state.user.members.find((m) => m.userId === userId);
      return member ? member.status : "offline";
    }
  }
});
