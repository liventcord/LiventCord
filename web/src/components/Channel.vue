<template>
  <div class="channel-container">
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
        <span @click.stop="createInvitePop($event)">
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

    <div
      class="channel-user-bar"
      v-if="!isTextChannel && voiceChannelUsers.length > 0"
    >
      <div class="voice-users-container">
        <div
          v-for="user in voiceChannelUsers"
          :key="user.id"
          :data-user-id="user.id"
          :data-cid="user.id"
          class="voice-user-item"
        >
          <img class="profile-pic channel-avatar" :alt="`User ${user.id}`" />
          <span class="channel-user-name">{{ user.name }}</span>
          <div class="content-wrapper" style="margin-right: -6px">
            <span v-if="user.isMuted">
              <svg
                class="icon_cdc675"
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
                  d="m2.7 22.7 20-20a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4ZM10.8 17.32c-.21.21-.1.58.2.62V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 0 0-2 0c0 1.45-.52 2.79-1.38 3.83l-.02.02A5.99 5.99 0 0 1 12.32 16a.52.52 0 0 0-.34.15l-1.18 1.18ZM15.36 4.52c.15-.15.19-.38.08-.56A4 4 0 0 0 8 6v4c0 .3.03.58.1.86.07.34.49.43.74.18l6.52-6.52ZM5.06 13.98c.16.28.53.31.75.09l.75-.75c.16-.16.19-.4.08-.61A5.97 5.97 0 0 1 6 10a1 1 0 0 0-2 0c0 1.45.39 2.81 1.06 3.98Z"
                ></path>
              </svg>
            </span>
          </div>
          <span v-if="user.isDeafened">
            <svg
              class="deafened"
              aria-describedby=":r77:"
              aria-hidden="true"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4l20-20ZM17.06 2.94a.48.48 0 0 0-.11-.77A11 11 0 0 0 2.18 16.94c.14.3.53.35.76.12l3.2-3.2c.25-.25.15-.68-.2-.76a5 5 0 0 0-1.02-.1H3.05a9 9 0 0 1 12.66-9.2c.2.09.44.05.59-.1l.76-.76ZM20.2 8.28a.52.52 0 0 1 .1-.58l.76-.76a.48.48 0 0 1 .77.11 11 11 0 0 1-4.5 14.57c-1.27.71-2.73.23-3.55-.74a3.1 3.1 0 0 1-.17-3.78l1.38-1.97a5 5 0 0 1 4.1-2.13h1.86a9.1 9.1 0 0 0-.75-4.72ZM10.1 17.9c.25-.25.65-.18.74.14a3.1 3.1 0 0 1-.62 2.84 2.85 2.85 0 0 1-3.55.74.16.16 0 0 1-.04-.25l3.48-3.48Z"
              ></path>
            </svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, nextTick, computed } from "vue";
import { useStore } from "vuex";
import { guildCache } from "../ts/cache";
import { changeChannel, currentVoiceChannelId } from "../ts/channels";
import { createInvitePop } from "../ts/ui";
import { openChannelSettings } from "../ts/settingsui";
import { appendToChannelContextList } from "../ts/contextMenuActions";
import { currentGuildId } from "../ts/guild";
import { enterVoiceChannel } from "../ts/chatroom";
import { setProfilePic } from "../ts/avatar.ts";
import { VoiceUser } from "../ts/socketEvents.ts";
import { userManager } from "../ts/user.ts";

const props = defineProps<{
  channelId: string;
  channelName: string;
  isTextChannel: boolean;
  isPrivate?: boolean;
}>();

const store = useStore();
const isHovered = ref(false);

const voiceChannelUsers = ref<
  {
    id: string;
    name: string;
    isNoisy: boolean;
    isMuted: boolean;
    isDeafened: boolean;
  }[]
>([]);

async function updateVoiceUsers() {
  const channel = store.getters.getChannelById(props.channelId);
  if (!channel?.voiceUsers) {
    voiceChannelUsers.value = [];
    return;
  }

  const users = await Promise.all(
    channel.voiceUsers.map(async (u: VoiceUser) => {
      const status = store.getters.getVoiceUserStatus(u.id);
      let name = await userManager.fetchUserNickOnce(u.id);
      return {
        id: u.id,
        name,
        isNoisy: status.isNoisy,
        isMuted: status.isMuted,
        isDeafened: status.isDeafened
      };
    })
  );

  voiceChannelUsers.value = users;
}

onMounted(() => {
  appendToChannelContextList(props.channelId);
  updateVoiceUsers();
  if (props.isTextChannel && props.channelId === guildCache.currentChannelId) {
    selectChannel(props.channelId, true);
  }
  if (!props.isTextChannel && props.channelId === currentVoiceChannelId) {
    selectChannel(props.channelId, false);
  }
});

watch(
  () => store.getters.getChannelById(props.channelId)?.voiceUsers,
  updateVoiceUsers,
  { deep: true }
);

watch(voiceChannelUsers, async () => {
  await nextTick();
  voiceChannelUsers.value.forEach((user) => {
    const imgEl = document.querySelector<HTMLImageElement>(
      `.voice-user-item[data-user-id="${user.id}"] img.profile-pic`
    );
    if (imgEl) setProfilePic(imgEl, user.id);
  });
});

function selectChannel(channelId: string, isText: boolean) {
  if (isText) {
    guildCache.currentChannelId = channelId;
    store.dispatch("selectChannel", { channelId, isTextChannel: true });
    changeChannel({
      guildId: currentGuildId,
      channelId,
      channelName: props.channelName,
      isTextChannel: true
    });
  } else {
    store.dispatch("selectChannel", { channelId, isTextChannel: false });
    enterVoiceChannel(currentGuildId, channelId);
  }
}

const isSelected = computed(() =>
  store.getters.isChannelSelected(props.channelId, props.isTextChannel)
);

const channelButtonStyle = computed(() => {
  let bgColor = "transparent";
  const hasVoiceUsers =
    !props.isTextChannel && voiceChannelUsers.value.length > 0;

  if (isSelected.value) {
    if (!props.isTextChannel) {
      bgColor = isHovered.value
        ? selectedVoiceChanHoverColor()
        : selectedVoiceChanColor();
    } else {
      bgColor = isHovered.value
        ? selectedTextChanHoverColor()
        : selectedTextChanColor();
    }
  } else if (isHovered.value) {
    bgColor = !props.isTextChannel
      ? hoveredVoiceChanColor()
      : hoveredTextChanColor();
  }

  return {
    backgroundColor: bgColor,
    color: isSelected.value || hasVoiceUsers ? "white" : "rgb(148, 155, 164)"
  };
});

function selectedVoiceChanColor() {
  return "#36393F";
}
function selectedVoiceChanHoverColor() {
  return "#2F3136";
}
function hoveredVoiceChanColor() {
  return "#2C2F33";
}
function selectedTextChanColor() {
  return "#36393F";
}
function selectedTextChanHoverColor() {
  return "#2F3136";
}
function hoveredTextChanColor() {
  return "#2C2F33";
}

const contentWrapperStyle = computed(() => ({
  display: isHovered.value || isSelected.value ? "flex" : "none"
}));

const handleMouseOver = () => {
  isHovered.value = true;
  store.dispatch("setHoveredChannel", {
    channelId: props.channelId,
    isTextChannel: props.isTextChannel
  });
};

const handleMouseLeave = () => {
  isHovered.value = false;
  store.dispatch("clearHoveredChannel", { channelId: props.channelId });
};

const handleClick = () => selectChannel(props.channelId, props.isTextChannel);

const handleChannelSettings = (event: MouseEvent) => {
  event.stopPropagation();
  openChannelSettings(props.channelId, props.channelName);
};
</script>

<style>
.channel-container {
  position: relative;
}

.channel-button {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  margin-top: 2px;
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
  margin-right: -10px;
}

.channel-user-bar {
  display: flex;
  flex-direction: column;
  background-color: transparent;
  margin-left: -70px;
  margin-top: 4px;
}

.voice-users-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voice-user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;

  border-radius: 5px;
  padding: 0px 10px;
  height: 32px;
}
.voice-user-item:hover {
  background-color: #2c2f33;
}
.channel-avatar {
  width: 24px;
  pointer-events: none;
  height: 24px;
  margin-right: 10px;
  flex-shrink: 0;
}

.channel-user-name {
  color: rgb(148, 155, 164);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-grow: 1;
  pointer-events: none;
  margin-right: 10px;
}

.icon_cdc675 {
  color: rgb(148, 155, 164);
  margin-left: 8px;
  pointer-events: none;
}

.icon_cdc675:hover {
  color: rgb(220, 221, 222);
}
</style>
