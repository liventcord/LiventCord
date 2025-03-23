<template>
  <div id="app">
    <UserList ref="userListRef" />
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import UserList from "./components/UserList.vue";

export default {
  name: "App",
  components: {
    UserList
  },
  setup() {
    const userListRef = ref(null);

    onMounted(() => {
      if (userListRef.value) {
        // Accessing and calling the updateStatusInMembersList method
        userListRef.value.updateStatusInMembersList("user123", "online");
      }
    });

    return {
      userListRef
    };
  }
};
</script>
