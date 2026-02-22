<template>
  <span
    :class="bubbleClass"
    :style="{ opacity: computedOpacity, ...typingBubbleStyle }"
  >
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
    realStatus: {
      type: String,
      default: "online"
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
    const statusColors: Record<string, string> = {
      online: "#23a55a",
      idle: "#d8db1c",
      "do-not-disturb": "#F23F43",
      offline: "#80848E"
    };

    const bubbleClass = computed(() => {
      const baseClass = props.isProfileBubble
        ? "profile-bubble"
        : "status-bubble";
      if (props.status === "typing") {
        return [baseClass, "typing"];
      }
      return [baseClass, props.status];
    });

    const typingBubbleStyle = computed(() => {
      if (props.status !== "typing") return {};
      return {
        backgroundColor: statusColors[props.realStatus] ?? statusColors.online
      };
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
      typingBubbleStyle,
      props
    };
  }
};
</script>

<style>
.profile-bubble.typing,
.status-bubble.typing {
  width: 15px;
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
