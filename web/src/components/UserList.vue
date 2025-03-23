<template>
  <div>
    <div
      class="horizontal-line"
      ref="userLine"
      :style="{ display: isUsersOpenGlobal ? 'flex' : 'none' }"
    ></div>
    <div id="user-list" ref="userList">
      <div v-if="loading"></div>
      <div v-else class="user-table-wrapper">
        <table class="user-table">
          <tbody>
            <template v-if="onlineUsers.length > 0">
              <CategoryTitle
                :title="`${translations.getTranslation('online')} — ${onlineUsers.length}`"
              />
              <UserProfileItem
                v-for="user in onlineUsers"
                :key="user.userId"
                :user-data="user"
                :is-online="true"
                :is-guild-owner="isGuildOwner(user.userId)"
              />
            </template>
            <template v-if="offlineUsers.length > 0">
              <CategoryTitle
                :title="`${translations.getTranslation('offline')} — ${offlineUsers.length}`"
              />
              <UserProfileItem
                v-for="user in offlineUsers"
                :key="user.userId"
                :user-data="user"
                :is-online="false"
                :is-guild-owner="isGuildOwner(user.userId)"
              />
            </template>
          </tbody>
        </table>
      </div>
    </div>
    <div id="activity-list" ref="activityList"></div>
  </div>
</template>
<script>
import { ref, watch, onMounted } from "vue";
import { useStore } from "vuex";
import UserProfileItem from "./UserProfileItem.vue";
import CategoryTitle from "./CategoryTitle.vue";
import { isOnMe, isOnGuild } from "../ts/router.ts";
import { translations } from "../ts/translations.ts";
import { currentUsers } from "../ts/userList.ts";

export default {
  name: "UserList",
  components: {
    UserProfileItem,
    CategoryTitle
  },
  props: {
    members: {
      type: Array,
      default: () => []
    },
    ignoreIsOnMe: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const store = useStore();

    const userList = ref(null);
    const userLine = ref(null);
    const activityList = ref(null);
    const loading = ref(true);
    const isUsersOpenGlobal = ref(false);

    const onlineUsers = ref([]);
    const offlineUsers = ref([]);

    const isGuildOwner = (userId) => {
      if (isOnGuild.value && currentGuildId.value) {
        const guild = store.getters["guild/getGuild"](currentGuildId.value);
        return guild && guild.isOwner(userId);
      }
      return false;
    };

    const categorizeMembers = async (members) => {
      const online = [];
      const offline = [];

      const statusPromises = members.map(async (member) => {
        const isOnline = await store.dispatch("isNotOffline", member.userId);
        return { member, isOnline };
      });

      const statuses = await Promise.all(statusPromises);

      statuses.forEach(({ member, isOnline }) => {
        if (isOnline) {
          online.push(member);
        } else {
          offline.push(member);
        }
      });

      return { onlineUsers: online, offlineUsers: offline };
    };

    const processMembers = async (newMembers) => {
      if (isOnMe.value && !props.ignoreIsOnMe) {
        console.log("Got users while on me page.");
        return;
      }

      loading.value = true;
      const categorizedMembers = await categorizeMembers(newMembers);
      onlineUsers.value = categorizedMembers.onlineUsers;
      offlineUsers.value = categorizedMembers.offlineUsers;
      loading.value = false;
      console.log("Updated members list:", newMembers);
    };

    const toggleUsersList = () => {
      setUsersList(!isUsersOpenGlobal.value);
    };

    const enableUserList = () => {
      setUsersList(true);
    };

    const setUsersList = (isUsersOpen, isLoadingFromCookie = false) => {
      const inputRightToSet = isUsersOpen ? "463px" : "76px";

      const addFriendInputButton = document.getElementById(
        "addfriendinputbutton"
      );
      if (addFriendInputButton) {
        addFriendInputButton.style.right = inputRightToSet;
      }

      if (!isLoadingFromCookie) {
        saveBooleanCookie("isUsersOpen", isUsersOpen ? 1 : 0);
      }

      isUsersOpenGlobal.value = isUsersOpen;
      updateChatWidth();
      updateMediaPanelPosition();
    };

    const updateDmFriendList = (friendId, friendNick) => {
      const currentUserId = store.state.user.currentUserId;
      const currentUserNick = store.state.user.currentUserNick;
      const currentDiscriminator = store.state.user.currentDiscriminator;
      const DEFAULT_DISCRIMINATOR = store.state.user.DEFAULT_DISCRIMINATOR;

      const usersData = [
        {
          userId: currentUserId,
          nickName: currentUserNick,
          isOnline: store.dispatch("user/isOnline", currentUserId),
          discriminator: currentDiscriminator || DEFAULT_DISCRIMINATOR
        },
        {
          userId: friendId,
          nickName: friendNick,
          isOnline: store.dispatch("user/isOnline", friendId),
          discriminator:
            store.getters["friends/getFriendDiscriminator"](friendId) ||
            DEFAULT_DISCRIMINATOR
        }
      ];

      processMembers(usersData);
    };

    const updateStatusInMembersList = async (userId, status) => {
      store.commit("updateUserStatus", { userId, status });

      if (!userList.value) return;

      const profilesList = userList.value.querySelectorAll(".profile-pic");
      profilesList.forEach((user) => {
        const parentNode = user.parentNode;
        const userIdDom = parentNode && parentNode.id;

        if (userIdDom === userId) {
          const selfBubble = parentNode.querySelector(".profile-bubble");
          if (selfBubble) {
            if (status === "offline") {
              selfBubble.style.opacity = "0";
            } else {
              selfBubble.style.opacity = "1";
              selfBubble.classList.value = "";
              selfBubble.className = "profile-bubble";
              selfBubble.classList.add(status);
            }
          }
        }
      });

      if (currentUsers.value && currentUsers.value.length > 0) {
        const userInOnline = onlineUsers.value.find(
          (user) => user.userId === userId
        );
        const userInOffline = offlineUsers.value.find(
          (user) => user.userId === userId
        );

        if (
          (userInOnline && status === "offline") ||
          (userInOffline && status !== "offline")
        ) {
          const currentUsersClone = [...currentUsers.value];
          await processMembers(currentUsersClone);
        }
      }
    };

    watch(
      currentUsers,
      (newUsers) => {
        if (newUsers && newUsers.length > 0) {
          processMembers(newUsers);
        }
      },
      { immediate: true, deep: true }
    );

    return {
      userList,
      userLine,
      activityList,
      isUsersOpenGlobal,
      onlineUsers,
      offlineUsers,
      loading,
      isGuildOwner,
      toggleUsersList,
      enableUserList,
      setUsersList,
      updateDmFriendList,
      updateStatusInMembersList,
      translations,
      updateMemberList: processMembers
    };
  }
};
</script>
