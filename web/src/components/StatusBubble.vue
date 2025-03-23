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

<style scoped>
.status-bubble,
.profile-bubble {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-left: 5px;
}

.profile-bubble {
  position: absolute;
  bottom: 8px;
  left: 23px;
  border: 2px solid rgb(43, 45, 49);
}

.online {
  background-color: #43b581;
}

.idle {
  background-color: #faa61a;
}

.dnd {
  background-color: #f04747;
}

.offline {
  background-color: #747f8d;
}
</style>
