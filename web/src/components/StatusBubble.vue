<template>
  <span :class="bubbleClass" :style="{ opacity: computedOpacity }">
    <template v-if="props.status === 'typing'">
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
import { computed } from "vue";

export default {
  name: "StatusBubble",
  props: {
    status: {
      type: String,
      default: "offline"
    },
    isTyping: {
      type: Boolean,
      default: false
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

      if (props.status === "typing") {
        return [baseClass, "typing"];
      }

      return [baseClass, props.isUserOnline ? "online" : "offline"];
    });

    const computedOpacity = computed(() => {
      if (props.isMemberBubble && props.status === "offline") {
        return "0";
      }
      return props.isUserOnline ? "1" : "0";
    });

    return {
      bubbleClass,
      computedOpacity,
      props
    };
  }
};
</script>

<style scoped>
.profile-bubble.typing,
.status-bubble.typing {
  width: 15px;
  background-color: #23a55a;
}

.typing-dots {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 10px;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.dot {
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  opacity: 0.6;
  animation: typing-dot-bounce 1.2s infinite ease-in-out;
}

@keyframes typing-dot-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.6;
  }
  40% {
    transform: translateY(-6px);
    opacity: 1;
  }
}
</style>
