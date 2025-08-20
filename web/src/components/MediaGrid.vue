<template>
  <div
    id="media-grid"
    :class="{ 'limited-grid': shouldLimit9 }"
    ref="mediaGridRef"
  >
    <div
      v-for="attachment in shouldLimit9 ? attachments.slice(0, 9) : attachments"
      :key="attachment.attachment.fileId"
      class="image-box"
      :class="{ 'limited-grid': shouldLimit9 }"
      :data-isspoiler="attachment.attachment.isSpoiler"
      :id="attachment.attachment.fileId"
      @click="() => emit('imageClick', attachment)"
    >
      <div class="media-wrapper">
        <component
          v-if="shouldRenderMedia(attachment)"
          :is="attachment.attachment.isImageFile ? 'img' : 'video'"
          :src="getAttachmentSrc(attachment)"
          :data-filesize="attachment.attachment.fileSize"
          :style="{
            filter: attachment.attachment.isSpoiler ? 'blur(10px)' : 'none'
          }"
          v-bind="attachment.attachment.isVideoFile ? { controls: true } : {}"
          :alt="attachment.attachment.isImageFile ? 'Image' : undefined"
          @error="handleMediaError(attachment)"
        />

        <img
          v-else-if="isFailedVideo(attachment)"
          :src="getVideoFallbackImg()"
          class="fallback-image"
        />

        <div
          v-else
          class="generic-file-preview"
          :title="attachment.attachment.fileName"
        >
          <i class="fas fa-file"></i>
          <span class="filename">{{ attachment.attachment.fileName }}</span>
          <span class="filesize">{{
            formatFileSize(attachment.attachment.fileSize)
          }}</span>
        </div>

        <img
          v-if="!isFilesList && shouldRenderProfile"
          class="profile-pic top-right"
          :src="getProfileUrl(attachment.userId)"
        />
      </div>

      <div v-if="isFilesList" class="file-info">
        <span class="filename">{{ attachment.attachment.fileName }}</span>
        <span class="filesize">{{
          formatFileSize(attachment.attachment.fileSize)
        }}</span>
        <div class="profile-bottom" v-if="shouldRenderProfile">
          <div class="nick-channel-wrapper">
            <span class="nick">{{
              userManager.getUserNick(attachment.userId)
            }}</span>
            <span class="channel"># {{ currentChannelName }}</span>
          </div>
        </div>
      </div>

      <img
        v-if="isFilesList"
        class="profile-pic top-right"
        :src="getProfileUrl(attachment.userId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getProfileUrl } from "../ts/avatar";
import { formatFileSize } from "../ts/utils";
import { AttachmentWithMetaData } from "../ts/message";
import { userManager } from "../ts/user";
import { currentChannelName } from "../ts/channels";
import { shouldRenderMedia } from "../ts/mediaElements";

const props = defineProps<{
  attachments: AttachmentWithMetaData[];
  shouldRenderProfile: boolean;
  isFilesList: boolean;
  shouldLimit9?: boolean;
  failedVideos: Record<string, boolean>;
  getAttachmentSrc: (attachment: AttachmentWithMetaData) => string;
  getVideoFallbackImg: () => string;
}>();

const emit = defineEmits<{
  (e: "imageClick", attachment: AttachmentWithMetaData): void;
  (e: "videoError", fileId: string): void;
}>();

const mediaGridRef = ref<HTMLElement | null>(null);

function isFailedVideo(attachment: AttachmentWithMetaData) {
  if (!props.failedVideos) return false;
  return !!props.failedVideos[attachment.attachment.fileId];
}

function handleMediaError(attachment: AttachmentWithMetaData) {
  const fileId = attachment.attachment.fileId;
  if (attachment.attachment.isVideoFile) {
    emit("videoError", fileId);
  }
}
</script>
<style scoped>
.image-box {
  position: relative;
  width: 200px;
  display: flex;
  flex-direction: column;
  padding: 2px;
  border-radius: 8px;
  box-sizing: border-box;
  background: #1f1f1f;
  overflow: hidden;
}

.media-wrapper {
  position: relative;
  width: 100%;
  max-height: 200px;
  overflow: hidden;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-wrapper img:not(.profile-pic),
.media-wrapper video {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
  max-height: 200px;
  user-select: none;
}

.file-info {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #ddd;
  text-align: center;
  padding: 4px 6px;
  box-sizing: border-box;
}

.file-info .filename,
.file-info .filesize {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 90%;
}

.file-info .nick-channel-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 90%;
}

.file-info .nick,
.file-info .channel {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 18px;
}

.profile-pic {
  width: 50px !important;
  height: 50px !important;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid #222;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
  user-select: none;
  -webkit-user-drag: none;
  position: absolute;
}

.top-right {
  top: 6px;
  right: 6px;
}

.generic-file-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 8px;
  text-align: center;
  width: 100%;
  height: 100%;
}

.generic-file-preview .filename {
  font-weight: 500;
  margin-top: 4px;
  max-width: 90%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.generic-file-preview .filesize {
  font-size: 0.75rem;
}
.filesize {
  color: #666;
}
</style>
