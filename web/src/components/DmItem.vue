<template>
  <div
    :id="friend.userId"
    class="dm-container"
    :class="{ 'dm-selected': isSelected }"
    @click="$emit('open', friend.userId)"
  >
    <span
      class="dm-bubble"
      :class="statusClass"
      :style="{ opacity: bubbleVisible ? '1' : '0' }"
    />
    <img
      class="dm-profile-img"
      :src="profileSrc"
      @mouseover="onImgHover(true)"
      @mouseout="onImgHover(false)"
      ref="imgRef"
    />
    <p class="content">{{ friend.nickName }}</p>
    <div class="close-dm-btn" @click.stop="$emit('remove', friend.userId)">
      X
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  PropType,
  watch
} from "vue";
import store from "../store";
import { setProfilePic } from "../ts/avatar";
import { DmUserInfo } from "../ts/friendui";

export default defineComponent({
  name: "DmItem",
  props: {
    friend: {
      type: Object as PropType<DmUserInfo>,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    }
  },
  emits: ["open", "remove"],
  setup(props) {
    const imgRef = ref<HTMLImageElement | null>(null);
    const bubbleVisible = ref(true);
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    const HOVER_BUBBLE_TIME = 500;

    const liveStatus = ref<string>(
      store.getters.getUserStatus(props.friend.userId) || "offline"
    );

    const statusClass = computed(() => `dm_${liveStatus.value}`);

    const profileSrc = ref<string>("");

    function resolveProfilePic() {
      if (!imgRef.value) {
        return;
      }
      setProfilePic(imgRef.value, props.friend.userId);
      profileSrc.value = imgRef.value.src;
    }

    onMounted(() => {
      resolveProfilePic();
    });

    watch(
      () => props.friend.userId,
      () => {
        resolveProfilePic();
      }
    );

    const unsubscribe = store.subscribe(
      (mutation: {
        type: string;
        payload: { userId: string; status: string };
      }) => {
        if (
          mutation.type === "updateUserStatus" &&
          mutation.payload.userId === props.friend.userId
        ) {
          liveStatus.value = mutation.payload.status;
        }
      }
    );

    onBeforeUnmount(() => {
      unsubscribe();
      if (hoverTimeout) clearTimeout(hoverTimeout);
    });

    function onImgHover(isOver: boolean) {
      if (!imgRef.value) return;
      imgRef.value.style.borderRadius = isOver ? "0px" : "25px";
      if (hoverTimeout) clearTimeout(hoverTimeout);
      if (isOver) {
        hoverTimeout = setTimeout(() => {
          bubbleVisible.value = false;
        }, HOVER_BUBBLE_TIME);
      } else {
        bubbleVisible.value = true;
      }
    }

    return { imgRef, statusClass, profileSrc, onImgHover, bubbleVisible };
  }
});
</script>
