<template>
  <div id="app">
    <UserList ref="userListRef" />
  </div>
</template>

<script>
import { ref } from "vue";
import UserList from "./components/UserList.vue";

export default {
  name: "App",
  components: {
    UserList
  },
  setup() {
    const userListRef = ref(null);

    return {
      userListRef
    };
  }
};
</script>
