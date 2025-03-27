import { createStore } from "vuex";
import { userManager } from "./ts/user";

export default createStore({
  state: {
    user: {
      members: [] as Array<{
        userId: string;
        status: string;
        nickName?: string;
        discriminator?: string;
        isOnline?: boolean;
      }>,
      onlineUsers: [] as Array<any>,
      offlineUsers: [] as Array<any>
    }
  },
  mutations: {
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
    }
  },
  actions: {
    async updateStatusInMembersList({ commit, state }, { userId, status }) {
      if (!userId) {
        throw new Error("User ID cannot be null or undefined");
      }
      commit("updateUserStatus", { userId, status });
      return { userId, status };
    },
    async categorizeUsers({ commit, state }, members) {
      const onlineUsers = [];
      const offlineUsers = [];

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
    }
  },
  getters: {
    getUserStatus: (state) => (userId: string) => {
      const member = state.user.members.find((m) => m.userId === userId);
      return member ? member.status : "offline";
    }
  }
});
