<template>
  <span
    class="dm-bubble"
    :class="statusClass"
    :style="{ opacity: visible ? '1' : '0', ...typingBubbleStyle }"
  >
    <template v-if="isTyping">
      <div class="typing-dots">
        <span
          class="dot"
          v-for="n in 3"
          :key="n"
          :style="{ animationDelay: `${(n - 1) * 0.3}s` }"
        ></span>
      </div>
    </template>
  </span>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from "vue";

export default defineComponent({
  name: "UserBubble",
  props: {
    status: {
      type: String,
      required: true
    },
    visible: {
      type: Boolean,
      default: true
    },
    isTyping: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const statusColors: Record<string, string> = {
      online: "#23a55a",
      idle: "#d8db1c",
      "do-not-disturb": "#F23F43",
      offline: "#80848E"
    };

    const localStatus = ref(props.status);

    watch(
      () => props.status,
      (newVal) => {
        localStatus.value = newVal;
      }
    );

    const statusClass = computed(() =>
      props.isTyping
        ? `dm_${localStatus.value} dm_typing`
        : `dm_${localStatus.value}`
    );

    const typingBubbleStyle = computed(() => {
      if (!props.isTyping) return {};
      return {
        backgroundColor: statusColors[localStatus.value] ?? statusColors.online
      };
    });

    return { statusClass, typingBubbleStyle };
  }
});
</script>

<style scoped>
.dm_typing {
  width: 15px;
}
</style>
