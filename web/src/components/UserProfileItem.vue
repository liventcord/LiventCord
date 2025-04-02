<template>
  <div
    :id="userData.userId"
    class="profile-container"
    :class="{ activeprofile: isOnline }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <img
      ref="profileImg"
      class="profile-pic"
      width="30"
      height="30"
      style="pointer-events: none"
      :data-user-id="userData.userId"
      @mouseover="onProfileImageHover(true)"
      @mouseout="onProfileImageHover(true)"
    />
    <span class="profileName" style="color: white">
      {{ userData.nickName || deletedUser }}
      <img v-if="isGuildOwner" :src="crownEmojibase64" id="crown-symbol" />
    </span>
    <StatusBubble
      ref="bubble"
      :status="status"
      :is-profile-bubble="true"
      :is-member-bubble="false"
      :is-user-online="isOnline"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from "vue";
import { useStore } from "vuex";
import StatusBubble from "./StatusBubble.vue";
import { crownEmojibase64 } from "../ts/extras.ts";
import { appendToProfileContextList } from "../ts/contextMenuActions";
import { deletedUser, userManager } from "../ts/user.ts";
import { setProfilePic } from "../ts/avatar.ts";

export default {
  name: "UserProfileItem",
  components: {
    StatusBubble
  },
  props: {
    userData: {
      type: Object,
      required: true
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      default: "offline"
    },
    isGuildOwner: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const store = useStore();
    const profileImg = ref(null);
    const bubble = ref(null);
    const status = ref(props.status);
    console.log("User Profile Item Props:", {
      userData: props.userData,
      isOnline: props.isOnline,
      initialStatus: props.status
    });
    const onProfileImageHover = (isHovering) => {
      if (isHovering) {
        profileImg.value.style.borderRadius = "0px";
        bubble.value.$el.style.opacity = "0";
      } else {
        profileImg.value.style.borderRadius = "25px";
        if (props.isOnline) bubble.value.$el.style.opacity = "1";
      }
    };

    const onMouseEnter = () => {
      profileImg.value.parentElement.style.backgroundColor = "rgb(53, 55, 60)";
    };

    const onMouseLeave = () => {
      profileImg.value.parentElement.style.backgroundColor = "initial";
    };

    const updateStatus = async () => {
      status.value = await userManager.getStatusString(props.userData.userId);
    };

    watch(
      () => props.isOnline,
      (newStatus) => {
        if (newStatus && bubble.value) {
          bubble.value.$el.style.opacity = "1";
        }
      }
    );
    watch(
      () => props.status,
      (newStatus) => {
        status.value = newStatus;
      }
    );

    onMounted(async () => {
      await updateStatus();
      setProfilePic(profileImg.value, props.userData.userId);
      appendToProfileContextList(props.userData, props.userData.userId);
    });

    return {
      profileImg,
      bubble,
      status,
      crownEmojibase64,
      onProfileImageHover,
      onMouseEnter,
      onMouseLeave,
      deletedUser
    };
  }
};
</script>
