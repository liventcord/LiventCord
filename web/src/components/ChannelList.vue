<template>
  <Teleport to="#channel-container">
    <ul id="channelul" style="width: 100%">
      <Channel
        v-for="channel in channels"
        :key="channel.channelId"
        :guildId="channel.guildId"
        :channelId="channel.channelId"
        :channelName="channel.channelName"
        :isTextChannel="channel.isTextChannel"
        :isPrivate="false"
      />
    </ul>
  </Teleport>
</template>
<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "vuex";
import Channel from "./Channel.vue";

export default defineComponent({
  name: "ChannelList",
  components: {
    Channel
  },
  setup() {
    const store = useStore();
    const channels = computed(() => store.state.channels);

    return {
      channels
    };
  }
});
</script>
<style>
#channel-list {
  z-index: 1;
  padding: 36px 47px;

  height: calc(100vh);
  overflow-y: scroll;
  overflow-x: hidden;
  font-weight: bold;
  background-color: #2b2d31;
  color: #ffffff;
  position: relative;
  padding-left: 125px;
  width: 205px;
  max-height: 100%;
}

.channel-users-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-right: 0px;
}

#channel-list::-webkit-scrollbar {
  width: 6px;
}
#channel-list::-webkit-scrollbar-thumb {
  background-color: #272626;
  border-radius: 6px;
}
#channel-list::-webkit-scrollbar-track {
  background-color: #2f3136;
}
#channel-container {
  padding-bottom: 150px;
  margin-top: 20px;
}
</style>
