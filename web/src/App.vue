<template>
  <div id="app">
    <FriendsContainer ref="friendsContainerRef" />
    <UserList ref="userListRef" />
    <ChannelList ref="channelListRef" />
    <SuggestionsDropdown ref="suggestionsDropdownRef" />
  </div>
</template>

<script>
import { ref } from "vue";
import UserList from "./components/UserList.vue";
import ChannelList from "./components/ChannelList.vue";
import SuggestionsDropdown from "./components/SuggestionsDropdown.vue";
import FriendsContainer from "./components/FriendsContainer.vue";

export default {
  name: "App",
  components: {
    UserList,
    ChannelList,
    SuggestionsDropdown,
    FriendsContainer
  },
  setup() {
    const userListRef = ref(null);
    const channelListRef = ref(null);
    const suggestionsDropdownRef = ref(null);
    const friendsContainerRef = ref(null);
    return {
      userListRef,
      channelListRef,
      suggestionsDropdownRef,
      friendsContainerRef
    };
  }
};
</script>
