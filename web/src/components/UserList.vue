<template>
  <div
    id="user-list"
    ref="userList"
    class="black-theme"
    style="display: flex; flex-direction: column"
  >
    <div class="userpanel-container">
      <button
        v-for="btn in filteredPanelButtons"
        :key="btn.id"
        class="userpanel-button"
        :class="{ active: selectedPanelType === btn.type }"
        :id="btn.id"
        @click="handlePanelButtonClick(btn.type)"
        @mouseover="() => showTooltipById(btn.id, btn.title)"
      >
        <i :class="btn.icon" :title="btn.title"></i>
      </button>
    </div>

    <div
      v-if="
        selectedPanelType !== 'media' &&
        selectedPanelType !== 'files' &&
        attachments.length > 0
      "
    >
      <MediaGrid
        :attachments="attachments"
        :failed-videos="failedVideos"
        :shouldRenderProfile="false"
        :getAttachmentSrc="getAttachmentSrc"
        :getVideoFallbackImg="getVideoFallbackImg"
        :isFilesList="false"
        @imageClick="handleImageClick"
        @videoError="onVideoError"
      />
    </div>

    <Teleport to="#chat-container" :disabled="!shouldTeleportMediaPanel">
      <div
        v-if="selectedPanelType === 'media'"
        id="media-table-wrapper"
        :class="mediaWrapperClasses"
        @scroll="handleScroll"
      >
        <MediaGrid
          v-if="attachments.length > 0"
          :attachments="attachments"
          :failed-videos="failedVideos"
          :getAttachmentSrc="getAttachmentSrc"
          :shouldRenderProfile="true"
          :isFilesList="false"
          :getVideoFallbackImg="getVideoFallbackImg"
          @imageClick="handleImageClick"
          @videoError="onVideoError"
        />
        <h3
          v-else
          style="flex-direction: column; align-items: center; display: flex"
        >
          No Media
        </h3>
      </div>
    </Teleport>

    <div
      v-if="selectedPanelType === 'files'"
      class="media-table-wrapper panel-wrapper"
    >
      <div v-if="attachments.length > 0">
        <MediaGrid
          v-if="attachments.length > 0"
          :attachments="attachments"
          :failed-videos="failedVideos"
          :getAttachmentSrc="getAttachmentSrc"
          :getVideoFallbackImg="getVideoFallbackImg"
          :shouldRenderProfile="true"
          :isFilesList="true"
          @imageClick="handleImageClick"
          @videoError="onVideoError"
        />
      </div>
      <h3
        v-else
        style="flex-direction: column; align-items: center; display: flex"
      >
        No Files
      </h3>
    </div>

    <div
      v-else-if="selectedPanelType === 'pins'"
      class="user-table-wrapper panel-wrapper"
    >
      <div id="pin-container"></div>
    </div>

    <div
      v-else-if="selectedPanelType === 'links'"
      class="user-table-wrapper panel-wrapper"
    >
      <div id="links-container"></div>
    </div>
    <div
      v-if="isMobile && canInviteUser()"
      id="invite-button"
      @click="createInvitePop"
    >
      {{ translations.getTranslation("invite-dropdown-button") }}
    </div>

    <div class="user-table-wrapper">
      <table class="user-table">
        <tbody>
          <template v-if="onlineUsers.length > 0">
            <CategoryTitle
              :title="`${translations.getTranslation('online')} — ${onlineUsers.length}`"
            />
            <UserProfileItem
              v-for="user in onlineUsers"
              :key="user.userId"
              :user-data="user"
              :is-online="true"
              :status="user.status"
              :is-guild-owner="
                cacheInterface.isGuildOwner(currentGuildId, user.userId)
              "
            />
          </template>

          <template v-if="offlineUsers.length > 0">
            <CategoryTitle
              :title="`${translations.getTranslation('offline')} — ${offlineUsers.length}`"
            />
            <UserProfileItem
              v-for="user in offlineUsers"
              :key="user.userId"
              :user-data="user"
              :is-online="false"
              :is-guild-owner="
                cacheInterface.isGuildOwner(currentGuildId, user.userId)
              "
            />
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
<style>
#invite-button {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 90%;
  padding: 5px;
  margin-left: 10px;
  margin-bottom: 20px;
  background-color: #505cdc;
  color: white;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background-color 0.3s,
    color 0.3s;
}
</style>
<script lang="ts" setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import UserProfileItem from "./UserProfileItem.vue";
import CategoryTitle from "./CategoryTitle.vue";
import { isOnMePage } from "../ts/router.ts";
import { translations } from "../ts/translations.ts";
import { currentUsers } from "../ts/userList.ts";
import { cacheInterface } from "../ts/cache.ts";
import { currentGuildId } from "../ts/guild.ts";
import { getId, IMAGE_SRCS, isTenorURL, isMobile } from "../ts/utils.ts";
import { permissionManager } from "../ts/guildPermissions.ts";
import { createInvitePop, displayImagePreview } from "../ts/ui.ts";
import { fetchMoreAttachments } from "../ts/message.ts";
import {
  closeMediaPanel,
  currentAttachments,
  openMediaPanel
} from "../ts/chat.ts";
import { apiClient } from "../ts/api.ts";
import { createTooltip } from "../ts/tooltip.ts";
import MediaGrid from "./MediaGrid.vue";
const shouldTeleportMediaPanel = computed(
  () => isMediaPanelTeleported && selectedPanelType.value === "media"
);
const isFirstRender = ref(true);
function canInviteUser() {
  return permissionManager.canInvite();
}

const mediaWrapperClasses = computed(() => {
  return props.attachments && props.attachments.length > 0
    ? "media-table-wrapper-on-right"
    : "table-wrapper";
});

onMounted(() => {
  handlePanelButtonClick("media");
  setTimeout(() => {
    handlePanelButtonClick("media");
    isFirstRender.value = false;
    setTimeout(() => {
      closeMediaPanel();
    }, 100);
  }, 0);
});

const props = defineProps({
  members: {
    type: Array,
    default: () => []
  },
  ignoreisOnMePage: {
    type: Boolean,
    default: false
  },
  selectedPanelType: String,
  attachments: Array,
  failedVideos: Object,
  getAttachmentSrc: Function,
  onVideoError: Function,
  handleImageClick: Function,
  formatFileSize: Function,
  handleScroll: Function
});

const panelButtons = [
  {
    id: "members-title",
    icon: "fas fa-user-group",
    title: "Members",
    type: "members"
  },
  {
    id: "media-title",
    icon: "fas fa-photo-film",
    title: "Media",
    type: "media"
  },
  { id: "pins-title", icon: "fas fa-thumbtack", title: "Pins", type: "pins" },
  { id: "links-title", icon: "fas fa-link", title: "Links", type: "links" },
  { id: "files-title", icon: "fas fa-file", title: "Files", type: "files" }
];

const filteredPanelButtons = computed(() => {
  return panelButtons.filter((btn) => {
    if (btn.id === "members-title" && !isMobile) return false;
    return true;
  });
});

import {
  handlePanelButtonClickExternal,
  hasTeleportedOnce,
  isMediaPanelTeleported,
  selectedPanelType
} from "../ts/panelHandler.ts";

function handlePanelButtonClick(type: string) {
  handlePanelButtonClickExternal(
    type,
    {
      selectedPanelType,
      isMediaPanelTeleported,
      hasTeleportedOnce
    },
    {
      openMediaPanel,
      closeMediaPanel
    }
  );
}

const store = useStore();
const loading = ref(true);
let isMediaPanelOpen = false;
const currentPage = computed(() => store.getters.currentPage);

const pageSize = 50;

const hasMoreAttachments = computed(() => store.getters.hasMoreAttachments);

const failedVideos = {};

function onVideoError(fileId) {
  failedVideos[fileId] = true;
}
function getVideoFallbackImg() {
  return IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC;
}

function showTooltipById(id: string, title: string) {
  const el = getId(id);
  if (el) {
    createTooltip(el, title);
  }
}

const loadMoreMedia = async () => {
  loading.value = true;
  try {
    console.log("Loading more media... " + currentPage.value);
    const newAttachments = await fetchMoreAttachments(
      currentPage.value,
      pageSize
    );

    store.commit("increaseCurrentPage");
    store.commit("setHasMoreAttachments", false);
  } catch (error) {
    console.error("Error loading more media:", error);
  } finally {
    loading.value = false;
  }
};

const handleScroll = () => {
  console.log("Has more attachments: " + hasMoreAttachments.value);
  const mediaScroll = getId("media-table-wrapper");
  if (mediaScroll) {
    const bottomOfGrid =
      mediaScroll.scrollHeight ===
      mediaScroll.scrollTop + mediaScroll.clientHeight;
    if (bottomOfGrid && !loading.value) {
      loadMoreMedia();
    }
  }
};

const handleImageClick = (attachment) => {
  console.log("Clicked attachment: ", attachment);
  if (attachment.attachment.isVideoFile) return;
  const mediaGrid = getId("media-grid");
  if (!mediaGrid) return;
  const parent = mediaGrid.querySelector(
    `div[id='${attachment.attachment.fileId}']`
  ) as HTMLElement;
  if (!parent) return;
  const isSpoiler = parent.dataset.isspoiler === "true" || false;
  const imgElement = parent.children[0]?.children[0] as HTMLImageElement;
  if (imgElement) {
    displayImagePreview(
      imgElement,
      attachment.userId,
      new Date(attachment.date),
      isSpoiler,
      true
    );
  }
};

const attachments = computed(() => store.state.attachments);
const onlineUsers = computed(() => store.state.user.onlineUsers);
const offlineUsers = computed(() => store.state.user.offlineUsers);

const processMembers = async (newMembers) => {
  if (isOnMePage && !props.ignoreisOnMePage) return;

  loading.value = true;
  await store.dispatch("categorizeUsers", newMembers);
  loading.value = false;
};
const processAttachments = async (newAttachments) => {
  const combinedAttachments = [...store.state.attachments, ...newAttachments];
  await store.dispatch("setAttachments", combinedAttachments);
};

function getAttachmentSrc(attachment) {
  const file = attachment.attachment;
  const isTenor = isTenorURL(file.proxyUrl);

  if (isTenor) {
    return file.proxyUrl;
  } else if (file.isProxyFile) {
    return apiClient.getProxyUrl(file.proxyUrl);
  } else if (file.isImageFile) {
    return `${apiClient.getBackendUrl()}/attachments/${file.fileId}`;
  } else {
    return "https://liventcord.github.io/LiventCord/app/images/defaultmediaimage.webp";
  }
}

watch(
  currentUsers,
  (newUsers) => {
    if (newUsers?.length) {
      processMembers(newUsers);
    }
  },
  { immediate: true, deep: true }
);
watch(currentAttachments, (newAttachments) => {
  if (newAttachments.length) {
    processAttachments(newAttachments);
  }
});
watch(
  () => store.state.attachments,
  (attachments) => {
    setTimeout(() => {
      attachments.forEach((attachment) => {
        const element = getId("media-grid")?.querySelector(
          "#" + CSS.escape(attachment.attachment.fileId)
        );
        if (element) {
          element.setAttribute("data-date", attachment.date);
          element.setAttribute("data-userid", attachment.userId);
          element.setAttribute("data-content", attachment.content);
          element.setAttribute(
            "data-messageid",
            attachment.attachment.messageId
          );
        }
      });
    }, 0);
  }
);
</script>

<style>
.profile-container {
  display: flex;
  align-items: center;
  position: relative;
  border-radius: 5px;
  margin-top: 10px;
  filter: opacity(0.3);
}
.activeprofile {
  filter: opacity(1);
}
.profile-container:hover {
  filter: opacity(1);
}
.profile-container .status-bubble {
  margin-left: 20px;
  margin-top: 20px;
  padding: 5px 5px;
}
#user-list,
#activity-list {
  padding-top: 55px;
  width: 238px;
  display: flex;
  flex-direction: column;
  height: 100vh;
}
#activity-list {
  background-color: transparent;
  padding-left: 178px;
}
.user-table-wrapper {
  max-height: 90%;
  min-height: 90%;
  overflow-y: auto;
  width: 90%;
  margin-top: 25px;
  overflow-x: hidden;
  margin-left: 5%;
  padding: 0;
  flex-grow: 1;
}
.panel-wrapper {
  min-height: unset;
}
#media-table-wrapper {
  margin-bottom: 5px;
  display: flex;
  flex-direction: column;
}
.media-table-wrapper-on-right {
  max-height: 25vh;
  min-height: 25vh;
}

#media-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
  width: 100%;
}
@media (max-width: 600px) {
  #media-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  #media-table-wrapper {
    margin-bottom: 50px;
  }
  #user-list,
  #activity-list {
    padding-top: 65px;
  }
}
.userpanel-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 10px;
}

.userpanel-button {
  flex: 1 0 0;
  min-width: 0;
  height: 35px;
  background-color: #151515;
  color: #505cdc;
  border: 1px solid #6a6969;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  cursor: pointer;
  transition:
    background-color 0.3s,
    color 0.3s;
}

.media-open-metadata {
  position: absolute;
  top: 50%;
  width: 50%;
  left: 53%;
  transform: translate(-50%, -50%);
}

.image-box {
  background-color: #2f3136;
  padding: 5px;
  border-radius: 5px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1;
  transition:
    background-color 0.3s ease,
    transform 0.3s ease;
}

.image-box:hover {
  background-color: #3a3b41;
  transform: scale(1.05);
}

.image-box img {
  width: 100%;
  object-fit: cover;
  border-radius: 5px;
  transition: opacity 0.3s ease;
}
.image-box video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  transition: opacity 0.3s ease;
  display: block;
}

.image-box:hover img {
  opacity: 0.8;
}

.user-table-wrapper::-webkit-scrollbar {
  width: 4px;
}
.user-table-wrapper::-webkit-scrollbar-thumb {
  background-color: #1d1d1d;
  border-radius: 6px;
}
.user-table-wrapper::-webkit-scrollbar-track {
  background-color: #2f3136;
}
.user-table {
  width: 100%;
}
.user-table tr:hover {
  background-color: #36373d;
}
.user-table td {
  padding-top: 5%;
}
</style>
