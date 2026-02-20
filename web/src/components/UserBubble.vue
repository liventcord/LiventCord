<template>
  <span
    class="dm-bubble"
    :class="statusClass"
    :style="{ opacity: visible ? '1' : '0' }"
  />
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
    }
  },
  setup(props) {
    const localStatus = ref(props.status);

    watch(
      () => props.status,
      (newVal) => {
        localStatus.value = newVal;
      }
    );

    const statusClass = computed(() => `dm_${localStatus.value}`);

    return { statusClass };
  }
});
</script>
