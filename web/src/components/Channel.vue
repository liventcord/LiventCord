<template>
  <li
    :id="channelId"
    class="channel-button"
    :style="channelButtonStyle"
    @mouseover="handleMouseOver"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
    ref="channelButton"
  >
    <span>
      <svg
        aria-hidden="true"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          v-if="isTextChannel"
          fill="currentColor"
          fill-rule="evenodd"
          d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z"
        ></path>
        <path
          v-else
          fill="currentColor"
          d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z"
          class=""
        ></path>
        <path
          fill="currentColor"
          d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z"
        ></path>
      </svg>
    </span>
    <span class="channelSpan">{{ channelName }}</span>
    <div class="content-wrapper" :style="contentWrapperStyle">
      <span @click.stop="createInvitePop()">
        <svg
          class="invite-channel-button"
          aria-hidden="true"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M14.5 8a3 3 0 1 0-2.7-4.3c-.2.4.06.86.44 1.12a5 5 0 0 1 2.14 3.08c.01.06.06.1.12.1ZM16.62 13.17c-.22.29-.65.37-.92.14-.34-.3-.7-.57-1.09-.82-.52-.33-.7-1.05-.47-1.63.11-.27.2-.57.26-.87.11-.54.55-1 1.1-.92 1.6.2 3.04.92 4.15 1.98.3.27-.25.95-.65.95a3 3 0 0 0-2.38 1.17ZM15.19 15.61c.13.16.02.39-.19.39a3 3 0 0 0-1.52 5.59c.2.12.26.41.02.41h-8a.5.5 0 0 1-.5-.5v-2.1c0-.25-.31-.33-.42-.1-.32.67-.67 1.58-.88 2.54a.2.2 0 0 1-.2.16A1.5 1.5 0 0 1 2 20.5a7.5 7.5 0 0 1 13.19-4.89ZM9.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 22Z"
            class=""
          ></path>
          <path
            fill="currentColor"
            d="M19 14a1 1 0 0 1 1 1v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Z"
            class=""
          ></path>
        </svg>
      </span>
      <span @click.stop="handleChannelSettings">
        <svg
          class="channel-settings-button"
          aria-hidden="true"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
            clip-rule="evenodd"
            class=""
          ></path>
        </svg>
      </span>
    </div>
  </li>
</template>
<script lang="ts">
import { defineComponent, computed, ref, onMounted } from "vue";
import { useStore } from "vuex";
import { guildCache } from "../ts/cache";
import { changeChannel, currentVoiceChannelId } from "../ts/channels";
import {
  selectedChanColor,
  hoveredChanColor,
  alertUser,
  createInvitePop
} from "../ts/ui";
import { openChannelSettings } from "../ts/settingsui";
import { appendToChannelContextList } from "../ts/contextMenuActions";
import { currentGuildId } from "../ts/guild";
export default defineComponent({
  name: "Channel",
  props: {
    channelId: { type: String, required: true },
    channelName: { type: String, required: true },
    isTextChannel: { type: Boolean, required: true },
    isPrivate: { type: Boolean }
  },
  setup(props) {
    const store = useStore();
    const isHovered = ref(false);

    onMounted(() => {
      if (props.channelId === guildCache.currentChannelId) {
        store.dispatch("selectChannel", {
          channelId: props.channelId,
          isTextChannel: props.isTextChannel
        });

        changeChannel({
          guildId: currentGuildId,
          channelId: props.channelId,
          channelName: props.channelName,
          isTextChannel: props.isTextChannel
        });
      }

      appendToChannelContextList(props.channelId);
    });

    const channelButtonStyle = computed(() => {
      const isSelected = store.getters.isChannelSelected(props.channelId);
      return {
        backgroundColor:
          isHovered.value || isSelected
            ? isSelected
              ? selectedChanColor()
              : hoveredChanColor()
            : "transparent",
        color: isSelected ? "white" : "rgb(148, 155, 164)"
      };
    });

    const contentWrapperStyle = computed(() => {
      const isSelected = store.getters.isChannelSelected(props.channelId);
      return {
        display:
          isSelected ||
          isHovered.value ||
          isChannelMatching(props.channelId, props.isTextChannel)
            ? "flex"
            : "none"
      };
    });

    const handleMouseOver = () => {
      isHovered.value = true;
      store.dispatch("setHoveredChannel", {
        channelId: props.channelId,
        isTextChannel: props.isTextChannel
      });
    };

    const handleMouseLeave = () => {
      isHovered.value = false;
      const isMatch = isChannelMatching(props.channelId, props.isTextChannel);
      if (!isMatch) {
        store.dispatch("clearHoveredChannel", {
          channelId: props.channelId,
          isTextChannel: props.isTextChannel
        });
      }
    };

    const handleClick = () => {
      if (!props.isTextChannel) {
        alertUser("Voice channels are not supported yet");
        return;
      }
      store.dispatch("selectChannel", {
        channelId: props.channelId,
        isTextChannel: props.isTextChannel
      });

      changeChannel({
        guildId: currentGuildId,
        channelId: props.channelId,
        channelName: props.channelName,
        isTextChannel: props.isTextChannel
      });
    };

    const handleChannelSettings = (event) => {
      event.stopPropagation();
      openChannelSettings(props.channelId, props.channelName);
    };

    function isChannelMatching(channelId, isTextChannel) {
      const currentChannel = isTextChannel
        ? guildCache.currentChannelId
        : currentVoiceChannelId;
      return channelId === currentChannel;
    }

    return {
      channelButtonStyle,
      contentWrapperStyle,
      handleMouseOver,
      handleMouseLeave,
      handleClick,
      handleChannelSettings,
      isHovered,
      createInvitePop
    };
  }
});
</script>
<style>
.channel-button {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  margin-top: 2px;
  width: 42%;
  height: auto;
  margin-left: -80px;
  border-radius: 5px;
  border: none;
  font-size: 15px;
  background-color: transparent;
  position: relative;
  padding-right: 20px;
}

.channelSpan {
  pointer-events: none;
  margin-left: 0px;
  overflow: hidden;
  width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  align-items: center;
}
.channel-button > span {
  margin-right: 10px;
}
.content-wrapper {
  margin-top: 5px;
}
</style>
