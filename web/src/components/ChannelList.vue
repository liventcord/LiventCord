<template>
  <Teleport to="#channel-container">
    <ul id="channelul" style="width: 310%">
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

<script>
import { defineComponent, ref, onMounted, watchEffect } from "vue";
import { currentGuildId } from "../ts/guild";
import { cacheInterface } from "../ts/cache";
import Channel from "./Channel.vue";

export default defineComponent({
  name: "ChannelList",
  components: {
    Channel
  },
  setup() {
    const channels = ref([]);

    onMounted(() => {
      setTimeout(() => {
        const fetchedChannels = cacheInterface.getChannels(currentGuildId);
        if (fetchedChannels) {
          channels.value = fetchedChannels;
        }
      }, 1000);
    });

    watchEffect(() => {
      const fetchedChannels = cacheInterface.getChannels(currentGuildId);
      if (fetchedChannels) {
        channels.value = fetchedChannels;
      }
    });

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
  width: 140px;
  scroll-behavior: smooth;
  overflow-x: hidden;
  font-weight: bold;
  background-color: #2b2d31;
  color: #ffffff;
  position: relative;
  padding-left: 125px;
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
#channel-list,
#channel-list-2 {
  width: 140px;
  padding-left: 125px;
  max-height: 100%;
  position: relative;
}
</style>
