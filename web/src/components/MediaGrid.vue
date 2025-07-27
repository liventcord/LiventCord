<template>
  <div id="media-grid" ref="mediaGridRef">
    <div
      v-for="attachment in attachments"
      :key="attachment.attachment.fileId"
      class="image-box"
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
          :style="{ filter: attachment.attachment.isSpoiler ? 'blur(10px)' : 'none' }"
          v-bind="attachment.attachment.isVideoFile ? { controls: true } : {}"
          :alt="attachment.attachment.isImageFile ? 'Image' : undefined"
          @error="handleMediaError(attachment)"
        />
        <img
          v-else-if="isFailedVideo(attachment)"
          :src="getVideoFallbackImg()"
          class="fallback-image"
        />
        <img
          v-if="!isFilesList"
          class="profile-pic top-right"
          :src="getProfileUrl(attachment.userId)"
        />
      </div>

      <div v-if="isFilesList" class="file-info">
        <span class="filename">{{ attachment.attachment.fileName }}</span>
        <span class="filesize">{{ formatFileSize(attachment.attachment.fileSize) }}</span>
        <div class="profile-bottom" v-if="shouldRenderProfile">
          <div class="nick-channel-wrapper">
            <span class="nick">{{ userManager.getUserNick(attachment.userId) }}</span>
            <span class="channel">{{ currentChannelName }}</span>
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
import { ref } from 'vue'
import { getProfileUrl } from '../ts/avatar'
import { formatFileSize } from "../ts/utils"
import { AttachmentWithMetaData } from '../ts/message'
import { userManager } from '../ts/user'
import { currentChannelName } from '../ts/channels'

const props = defineProps<{
  attachments: AttachmentWithMetaData[]
  shouldRenderProfile: boolean
  isFilesList: boolean
  failedVideos: Record<string, boolean>
  getAttachmentSrc: (attachment: AttachmentWithMetaData) => string
  getVideoFallbackImg: () => string
}>()

const emit = defineEmits<{
  (e: 'imageClick', attachment: AttachmentWithMetaData): void
  (e: 'videoError', fileId: string): void
}>()

const mediaGridRef = ref<HTMLElement | null>(null)

function isFailedVideo(attachment: AttachmentWithMetaData) {
  if (!props.failedVideos) return false
  return !!props.failedVideos[attachment.attachment.fileId]
}

function shouldRenderMedia(attachment: AttachmentWithMetaData) {
  const fileId = attachment.attachment.fileId
  const isVideo = attachment.attachment.isVideoFile
  const isImage = attachment.attachment.isImageFile
  return !isFailedVideo(attachment) && (isImage || isVideo)
}

function handleMediaError(attachment: AttachmentWithMetaData) {
  const fileId = attachment.attachment.fileId
  if (attachment.attachment.isVideoFile) {
    emit('videoError', fileId)
  }
}
</script>
<style scoped>
#media-grid {
  display: flex;
  flex-wrap :nowrap !important;
  gap: 12px;
  margin-top: 100px;
}

.image-box {
  position: relative;
  width: 250px;
  display: flex;
  flex-direction: column;
  padding: 2px;
  border-radius: 8px;
  box-sizing: border-box;
}

.media-wrapper {
  position: relative;
  width: 100%;
  max-height: 250px;
  overflow: hidden;
  background: #111;
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

.fallback-image {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
}

.file-info {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #ddd;
  user-select: text;
}

.file-info .filename,
.file-info .filesize {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-bottom {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
}

.nick-channel-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 100px;
  overflow: hidden;
}

.nick {
  font-size: 13px;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 20px;
}

.channel {
  font-size: 13px;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
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
</style>
