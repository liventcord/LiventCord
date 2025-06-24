<template>
  <div id="user-list" ref="userList">
    <div
      v-if="attachments.length > 0"
      id="media-table-wrapper"
      class="user-table-wrapper media-table-wrapper-on-right"
      @scroll="handleScroll"
    >
      <button id="media-title" @click="handleMediaButtonClick()"></button>
      <div id="media-grid">
        <div
          v-for="attachment in attachments"
          :key="attachment.attachment.fileId"
          :id="attachment.attachment.fileId"
          class="image-box"
          :data-isspoiler="attachment.attachment.isSpoiler"
        >
          <img
            :src="getAttachmentSrc(attachment)"
            alt="Image"
            :data-filesize="attachment.attachment.fileSize"
            @click="handleImageClick(attachment)"
            ref="imageBox"
            :style="{
              filter: attachment.attachment.isSpoiler ? 'blur(10px)' : 'none'
            }"
          />
        </div>
      </div>

      <div v-if="loading"></div>
      <div v-else class="user-table-wrapper">
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
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import UserProfileItem from "./UserProfileItem.vue";
import CategoryTitle from "./CategoryTitle.vue";
import { isOnMePage } from "../ts/router.ts";
import { translations } from "../ts/translations.ts";
import { currentUsers } from "../ts/userList.ts";
import { cacheInterface } from "../ts/cache.ts";
import { currentGuildId } from "../ts/guild.ts";
import { getId, isTenorURL } from "../ts/utils.ts";
import { displayImagePreview } from "../ts/ui.ts";
import { fetchMoreAttachments } from "../ts/message.ts";
import {
  closeMediaPanel,
  currentAttachments,
  openMediaPanel
} from "../ts/chat.ts";
import { apiClient } from "../ts/api.ts";
const props = defineProps({
  members: {
    type: Array,
    default: () => []
  },
  ignoreisOnMePage: {
    type: Boolean,
    default: false
  }
});

const store = useStore();
const loading = ref(true);
let isMediaPanelOpen = false;
const currentPage = computed(() => store.getters.currentPage);

const pageSize = 50;

const hasMoreAttachments = computed(() => store.getters.hasMoreAttachments);

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

const handleMediaButtonClick = () => {
  isMediaPanelOpen = !isMediaPanelOpen;
  isMediaPanelOpen ? openMediaPanel() : closeMediaPanel();
};

const handleImageClick = (attachment) => {
  const mediaGrid = getId("media-grid");
  if (!mediaGrid) return;
  const parent = mediaGrid.querySelector(
    `div[id='${attachment.attachment.fileId}']`
  ) as HTMLElement;
  if (!parent) return;
  const isSpoiler = parent.dataset.isspoiler === "true" || false;
  const imgElement = parent.firstChild as HTMLImageElement;
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
  await store.dispatch("setAttachments", newAttachments);
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

<style scoped>
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
  overflow-x: hidden;
  margin-left: 5%;
  padding: 0;
  flex-grow: 1;
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
#media-title {
  align-self: center;
  margin-bottom: 5px;
  background-color: #151515;
  width: 200px;
  color: white;
  font-size: 1em;
  padding: 5px;
  border: 1px solid #6a6969;
  border-radius: 10px;
}
.media-open-metadata {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
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
