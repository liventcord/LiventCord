<template>
  <div id="app">
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

export default {
  name: "App",
  components: {
    UserList,
    ChannelList,
    SuggestionsDropdown
  },
  setup() {
    const userListRef = ref(null);
    const channelListRef = ref(null);
    const suggestionsDropdownRef = ref(null);

    return {
      userListRef,
      channelListRef,
      suggestionsDropdownRef
    };
  }
};
</script>
