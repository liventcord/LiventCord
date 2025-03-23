import { createStore } from "vuex";

export default createStore({
  state: {
    guild: {
      currentGuildId: null
    },
    user: {
      currentUserId: null,
      currentUserNick: "",
      currentDiscriminator: "",
      DEFAULT_DISCRIMINATOR: "0000"
    }
  },
  mutations: {
    updateUserStatus(state, { userId, status }) {
      // Update user status logic
    }
  },
  actions: {
    async isNotOffline(_, userId) {
      // Simulated API call to check online status
      return true;
    },
    async isOnline(_, userId) {
      return true;
    }
  },
  getters: {
    "guild/getGuild": (state) => (guildId:string) => {
      return { isOwner: (userId:string) => userId === "1" };
    },
    "friends/getFriendDiscriminator": (state) => (friendId:string) => {
      return state.user.DEFAULT_DISCRIMINATOR;
    }
  }
});
