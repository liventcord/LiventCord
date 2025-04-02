<template>
  <div id="app">
    <UserList ref="userListRef" />
    <ChannelList ref="channelListRef" />
  </div>
</template>

<script>
import { ref } from "vue";
import UserList from "./components/UserList.vue";
import ChannelList from "./components/ChannelList.vue";

export default {
  name: "App",
  components: {
    UserList,
    ChannelList
  },
  setup() {
    const userListRef = ref(null);

    return {
      userListRef
    };
  }
};
</script>
