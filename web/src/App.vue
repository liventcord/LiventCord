<template>
  <div id="app">
    <UserList ref="userListRef" />
    <button @click="addUsers">Update Members</button>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import UserList from "./components/UserList.vue";
import { getCurrentUsers } from "./ts/userList.ts";

export default {
  name: "App",
  components: {
    UserList
  },
  setup() {
    const userListRef = ref(null);

    onMounted(() => {
      console.log("UserList ref:", userListRef.value); 
    });

    const addUsers = () => {
      if (userListRef.value && userListRef.value.updateMemberList) {
        userListRef.value.updateMemberList(getCurrentUsers());
      } else {
        console.error("updateMemberList is not defined on userListRef.value", userListRef.value);
      }
    };

    return { userListRef, addUsers };
  }
};
</script>
