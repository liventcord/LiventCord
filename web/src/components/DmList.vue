<template>
  <div class="dm-list-root">
    <DmItem
      v-for="dm in dmList"
      :key="dm.userId"
      :friend="dm"
      :is-selected="dm.userId === currentDmId"
      @open="onOpenDm"
      @remove="onRemoveDm"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted, watch } from "vue";
import DmItem from "./DmItem.vue";
import { dmListState, openDmHandler, removeDmHandler } from "../ts/friendui";

export default defineComponent({
  name: "DmList",
  components: { DmItem },
  setup() {
    const dmList = computed(() => dmListState.friends);
    const currentDmId = computed(() => dmListState.currentDmId);

    watch(
      () => dmListState.friends.length,
      (newLen, oldLen) => {
        console.debug(
          "[DmList] friends list length changed:",
          oldLen,
          "->",
          newLen
        );
      }
    );

    function onOpenDm(userId: string) {
      openDmHandler(userId);
    }

    function onRemoveDm(userId: string) {
      removeDmHandler(userId);
    }

    return { dmList, currentDmId, onOpenDm, onRemoveDm };
  }
});
</script>
