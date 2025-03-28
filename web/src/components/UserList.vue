<template>
  <div>
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
                :status="user.status"
                :is-guild-owner="cacheInterface.isGuildOwner(user.userId)"
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
                :is-guild-owner="cacheInterface.isGuildOwner(user.userId)"
              />
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import UserProfileItem from "./UserProfileItem.vue";
import CategoryTitle from "./CategoryTitle.vue";
import { isOnMePage } from "../ts/router.ts";
import { translations } from "../ts/translations.ts";
import { currentUsers } from "../ts/userList.ts";
import { cacheInterface } from "../ts/cache.ts";

const props = defineProps({
  members: {
    type: Array,
    default: () => []
  },
  ignoreisOnMePage: {
    type: Boolean,
    default: false
  }
});

const store = useStore();
const loading = ref(true);

const onlineUsers = computed(() => store.state.user.onlineUsers);
const offlineUsers = computed(() => store.state.user.offlineUsers);

const processMembers = async (newMembers) => {
  if (isOnMePage.value && !props.ignoreisOnMePage) return;

  loading.value = true;
  await store.dispatch("categorizeUsers", newMembers);
  loading.value = false;
};

watch(
  currentUsers,
  (newUsers) => {
    if (newUsers?.length) {
      processMembers(newUsers);
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => store.state.user,
  (newUserState) => {
    console.log("User state detailed:", {
      onlineUsers: newUserState.onlineUsers.map((user) => ({
        userId: user.userId,
        status: user.status,
        isOnline: true
      })),
      offlineUsers: newUserState.offlineUsers.map((user) => ({
        userId: user.userId,
        status: user.status,
        isOnline: false
      }))
    });
  },
  { deep: true }
);
</script>

<style scoped>
.profile-container {
  display: flex;
  align-items: center;
  position: relative;
  border-radius: 5px;
  margin-top: 10px;
  filter: opacity(0.3);
}
.activeprofile {
  filter: opacity(1);
}
.profile-container:hover {
  filter: opacity(1);
}
.profile-container .status-bubble {
  margin-left: 20px;
  margin-top: 20px;
  padding: 5px 5px;
}
#user-list,
#activity-list {
  padding-top: 65px;
  width: 238px;
  display: flex;
  flex-direction: column;
  z-index: 0;
  height: 100vh;
}
#activity-list {
  background-color: transparent;
  padding-left: 178px;
}
.user-table-wrapper {
  max-height: 90%;
  min-height: 90%;
  overflow-y: auto;
  width: 90%;
  overflow-x: hidden;
  margin-left: 5%;
  padding: 0;
  flex-grow: 1;
}
.user-table-wrapper::-webkit-scrollbar {
  width: 4px;
}
.user-table-wrapper::-webkit-scrollbar-thumb {
  background-color: #1d1d1d;
  border-radius: 6px;
}
.user-table-wrapper::-webkit-scrollbar-track {
  background-color: #2f3136;
}
.user-table {
  width: 100%;
}
.user-table tr:hover {
  background-color: #36373d;
}
.user-table td {
  padding-top: 5%;
}
</style>
