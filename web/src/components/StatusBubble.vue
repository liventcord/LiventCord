<template>
  <span :class="bubbleClass" :style="{ opacity: computedOpacity }"></span>
</template>

<script>
import { computed } from "vue";

export default {
  name: "StatusBubble",
  props: {
    status: {
      type: String,
      default: "offline"
    },
    isProfileBubble: {
      type: Boolean,
      default: false
    },
    isMemberBubble: {
      type: Boolean,
      default: false
    },
    isUserOnline: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    const bubbleClass = computed(() => {
      const baseClass = props.isProfileBubble
        ? "profile-bubble"
        : "status-bubble";
      return [baseClass, props.status];
    });

    const computedOpacity = computed(() => {
      if (props.isMemberBubble && props.status === "offline") {
        return "0";
      }
      return "1";
    });

    return {
      bubbleClass,
      computedOpacity
    };
  }
};
</script>
