<template>
  <div id="app">
    <FriendsContainer ref="friendsContainerRef" />
    <UserList ref="userListRef" />
    <ChannelList ref="channelListRef" />
    <SuggestionsDropdown ref="suggestionsDropdownRef" />

    <Teleport to="#channel-info-container-for-index">
      <UserBubble
        v-if="showHeaderBubble"
        id="dm-profile-sign-bubble"
        :status="headerStatus"
        :visible="true"
        style="transition: display 0.5s ease-in-out"
      />
    </Teleport>
  </div>
</template>
<script lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import UserList from "./components/UserList.vue";
import ChannelList from "./components/ChannelList.vue";
import SuggestionsDropdown from "./components/SuggestionsDropdown.vue";
import FriendsContainer from "./components/FriendsContainer.vue";
import UserBubble from "./components/UserBubble.vue";
import store from "./store";

export default {
  name: "App",
  components: {
    UserList,
    ChannelList,
    SuggestionsDropdown,
    FriendsContainer,
    UserBubble
  },
  setup() {
    const userListRef = ref(null);
    const channelListRef = ref(null);
    const suggestionsDropdownRef = ref(null);
    const friendsContainerRef = ref(null);

    const headerStatus = ref("offline");
    const showHeaderBubble = ref(true);

    const unsubscribe = store.subscribe(
      (mutation: {
        type: string;
        payload: { userId: string; status: string };
      }) => {
        if (mutation.type === "updateUserStatus") {
          headerStatus.value = mutation.payload.status;
        }
      }
    );

    onBeforeUnmount(() => {
      unsubscribe();
    });

    return {
      userListRef,
      channelListRef,
      suggestionsDropdownRef,
      friendsContainerRef,
      headerStatus,
      showHeaderBubble
    };
  }
};
</script>
