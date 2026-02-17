import { CLYDE_ID } from "./chat.ts";
import { currentGuildId } from "./guild.ts";
import {
  getBase64Image,
  getId,
  blackImage,
  base64ToBlob,
  IMAGE_SRCS,
  createRandomId,
  getMediaBaseURL,
  disableElement
} from "./utils.ts";
import {
  isSettingsOpen,
  currentPopUp,
  isChangedImage,
  setUnsaved,
  regenerateConfirmationPanel,
  setIsChangedImage
} from "./settings.ts";
import {
  currentSettingsCategory,
  ProfileCategoryTypes,
  showConfirmationPanel,
  updateSettingsProfileColor
} from "./settingsui.ts";
import { userList } from "./userList.ts";
import { createCropPop } from "./popups.ts";
import { translations } from "./translations.ts";
import { userManager } from "./user.ts";
import { alertUser } from "./ui.ts";
import { chatContainer } from "./chatbar.ts";
import { apiClient, EventType } from "./api.ts";
import { cacheInterface } from "./cache.ts";
import { appState } from "./appState.ts";

const selfName = getId("self-name") as HTMLElement;
export const selfDiscriminator = getId("self-discriminator") as HTMLElement;
export const selfProfileImage = getId("self-profile-image") as HTMLImageElement;

export function disableSelfName() {
  disableElement(selfName);
}

export let lastConfirmedProfileImg: Blob;
let lastConfirmedGuildImg: Blob;

function setLastGuildImg(newBlob: Blob) {
  lastGuildImage = newBlob;
}
let lastProfileImage: Blob;
let lastGuildImage: Blob;
function setLastProfileImg(newBlob: Blob) {
  lastProfileImage = newBlob;
}

export function setLastConfirmedGuildImage() {
  lastConfirmedGuildImg = lastGuildImage;
}

export function setLastConfirmedProfileImage() {
  console.log("Set lastConfirmedProfileImg to : ", lastProfileImage);
  lastConfirmedProfileImg = lastProfileImage;
}

export let maxAttachmentSize: number; // mb
let maxAvatarSize: number; // mb

function getMaxAvatarBytes() {
  const MB_BYTES = 1024;
  return maxAvatarSize * MB_BYTES * MB_BYTES;
}
function getMaxAvatarMegaBytes() {
  return maxAvatarSize;
}

const allowedAvatarTypes = [
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/svg+xml"
];
const failedImages = new Set();

async function setPicture(
  imgToUpdate: HTMLImageElement,
  srcId: string,
  isProfile: boolean
) {
  if (!srcId) {
    imgToUpdate.src = isProfile
      ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC
      : blackImage;
    return;
  }
  if (!imgToUpdate) return;

  if (srcId === CLYDE_ID) {
    imgToUpdate.src = IMAGE_SRCS.CLYDE_SRC;
    return;
  }

  srcId = String(srcId);

  if (failedImages.has(srcId)) {
    imgToUpdate.src = isProfile
      ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC
      : blackImage;
    return;
  }

  const imageUrl = isProfile ? getProfileUrl(srcId) : getGuildUrl(srcId);
  imgToUpdate.src = imageUrl;
  imgToUpdate.crossOrigin = "anonymous";

  imgToUpdate.addEventListener("error", () => {
    imgToUpdate.src = isProfile
      ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC
      : blackImage;
    failedImages.add(srcId);
  });
}

export function refreshUserProfile(
  userId: string,
  userNick: string | null = null
): void {
  if (userId === appState.currentUserId) {
    updateSelfProfile(userId, "", true);
  }

  // from user list
  if (userList) {
    const profilesList = userList.querySelectorAll(".profile-pic");
    profilesList.forEach((user) => {
      const parentNode = user.parentNode as HTMLElement;
      const userIdDom = parentNode && parentNode.id;

      if (userIdDom === userId) {
        if (userNick) {
          const profileNameElement = parentNode.querySelector(
            ".profileName"
          ) as HTMLElement;
          if (profileNameElement) {
            profileNameElement.innerText = userNick;
          }
        }
        if (user instanceof HTMLImageElement) {
          user.src = getProfileUrl(userId);
        }
      }
    });
  }

  // from chat container
  const usersList = chatContainer.querySelectorAll(".profile-pic");
  usersList.forEach((user) => {
    if (userNick) {
      const datasetUserId = (user as HTMLElement).dataset.userId;
      if (datasetUserId === userId) {
        const authorAndDate = (user.parentNode as HTMLElement).querySelector(
          ".author-and-date"
        );
        const nickElement = authorAndDate?.querySelector(
          ".nick-element"
        ) as HTMLElement;
        if (nickElement) {
          nickElement.innerText = userNick;
        }
      }
    }
    if (userId) {
      const datasetUserId = (user as HTMLElement).dataset.userId;
      if (datasetUserId === userId) {
        if (user instanceof HTMLImageElement) {
          user.src = getProfileUrl(userId);
        }
      }
    }
  });
}

export function validateAvatar(file: File) {
  if (!allowedAvatarTypes.includes(file.type)) {
    alertUser(translations.getTranslation("avatar-upload-error-message"));
    return false;
  }
  if (file.size > getMaxAvatarBytes()) {
    alertUser(
      translations.getAvatarUploadErrorMsg(String(maxAvatarSize) + "MB")
    );
    return false;
  }
  return true;
}

export function resetImageInput(inputId: string, imgId: string) {
  const input = getId(inputId) as HTMLInputElement;
  input.value = "";
  const img = getId(imgId) as HTMLImageElement;
  img.style.backgroundImage = "";
}

function updateImageSource(imageElement: HTMLImageElement, imagePath: string) {
  imageElement.onerror = (e: any) => {
    if (imageElement.src !== IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC) {
      imageElement.src = IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC;
    }
  };
  imageElement.onload = updateSettingsProfileColor;
  imageElement.src = imagePath;
}
export function updateSelfName(nickName: string) {
  if (!nickName) {
    return;
  }
  const settingsNameText = getId("settings-self-name");
  if (settingsNameText) {
    settingsNameText.innerText = nickName;
  }

  if (selfName) {
    selfName.innerText = nickName;
  }
}
export function getProfileUrl(userId: string): string {
  const version = userManager.getUserProfileVersion(userId);
  if (!version) return IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC;
  const result = `${getMediaBaseURL()}/profiles/${userId}?version=${version}`;
  return result;
}

export function getGuildUrl(guildId: string): string {
  const v = cacheInterface.getGuildImageVersion(guildId);
  if (!v) return blackImage;
  return `${getMediaBaseURL()}/guilds/${guildId}.webp?version=${v}`;
}

export function updateSelfProfile(
  userId: string,
  nickName: string,
  isAfterUploading?: boolean
) {
  if (!userId) {
    return;
  }
  const selfimagepath = getProfileUrl(userId);

  updateImageSource(selfProfileImage, selfimagepath);
  updateSelfName(nickName);

  if (
    isSettingsOpen &&
    currentSettingsCategory === ProfileCategoryTypes.MyAccount
  ) {
    const settingsSelfProfile = getProfileImage();

    if (!settingsSelfProfile) {
      return;
    }
    updateImageSource(settingsSelfProfile, selfimagepath);

    if (isAfterUploading) {
      const base64output = getBase64Image(settingsSelfProfile);
      if (base64output) {
        console.log("Setting self profile as ", userId, nickName);
        lastConfirmedProfileImg = base64ToBlob(base64output);
      }
    }
  }
}

export function setUploadSize(
  _maxAvatarSize: number,
  _maxAttachmentSize: number
): void {
  maxAvatarSize = _maxAvatarSize;
  maxAttachmentSize = _maxAttachmentSize;
}

export function uploadImageGuildOrProfile(isGuild: boolean): void {
  if (!isChangedImage) {
    console.warn("isChangedImage is false. not uploading");
    return;
  }

  const fileSrc = getFileSrc(isGuild);
  if (!isValidBase64(fileSrc)) {
    console.error("Invalid file format or undefined file for avatar update.");
    return;
  }

  const blob = createBlobFromImage(fileSrc);
  if (blob.size > getMaxAvatarBytes()) {
    handleFileSizeError(blob.size, true);
    return;
  }

  const file = new File([blob], `image.${blob.type.split("/")[1]}`, {
    type: blob.type
  });

  sendImageUploadRequest(isGuild, [blob], [file]);
}

function getMaxEmojiBytes(): number {
  return 256 * 1024;
}
function getMaxEmojiMegaBytes() {
  return 256;
}
function uploadImageEmoji(blobs: File[]): void {
  const validFiles: File[] = [];

  for (const blob of blobs) {
    if (blob.size > getMaxEmojiBytes()) {
      handleFileSizeError(blob.size, false);
      continue;
    }

    const file = new File([blob], `emoji-${createRandomId()}`, {
      type: blob.type
    });

    validFiles.push(file);
  }

  if (validFiles.length === 0) {
    return;
  }

  sendImageUploadRequest(
    false,
    validFiles.map((f) => new Blob([f], { type: f.type })),
    validFiles,
    true
  );
}

function resetProfileImageFile() {
  const profileImgFile = getProfileImageFile();
  if (profileImgFile) {
    profileImgFile.value = "";
  }
}
function getFileSrc(isGuild: boolean): string {
  return isGuild
    ? (getGuildImage()?.src ?? "")
    : (getProfileImage()?.src ?? "");
}

function isValidBase64(file: string): boolean {
  return typeof file === "string" && file.startsWith("data:image/");
}

function createBlobFromImage(file: string): Blob {
  const byteString = atob(file.split(",")[1]);
  const mimeString = file.split(",")[0].split(":")[1].split(";")[0];
  const ab = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ab[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

function handleFileSizeError(size: number, isAvatar: boolean) {
  console.error("Max avatar size exceeded. Uploaded file size:", size);
  alertUser(
    translations.getAvatarUploadErrorMsg(
      `${isAvatar ? getMaxAvatarMegaBytes() : getMaxEmojiMegaBytes()}KB`
    )
  );
  resetProfileImageFile();
}

function sendImageUploadRequest(
  isGuild: boolean,
  blobs: Blob[],
  files: File[],
  isEmoji?: boolean
) {
  const formData = new FormData();

  for (let i = 0; i < files.length; i++) {
    const fileName = isEmoji
      ? `emoji-${createRandomId()}.${blobs[i].type.split("/")[1]}`
      : `image.${blobs[i].type.split("/")[1]}`;

    formData.append(isEmoji ? "photos" : "photo", blobs[i], fileName);
  }

  if (isGuild || isEmoji) {
    formData.append("guildId", currentGuildId);
  }

  if (isGuild) {
    lastGuildImage = blobs[0];
  } else if (!isEmoji) {
    lastProfileImage = blobs[0];
  }
  const eventType = isGuild
    ? EventType.UPLOAD_GUILD_IMAGE
    : isEmoji
      ? EventType.UPLOAD_EMOJI_IMAGE
      : EventType.UPLOAD_PROFILE_IMAGE;
  apiClient.sendForm(eventType, formData);
}

/**
 * Get the guild profile image element.
 * @returns {HTMLImageElement} The image element.
 */
export function getGuildImage() {
  const element = getId("guild-image");
  if (element instanceof HTMLImageElement) {
    return element;
  }
  return null;
}

/**
 * Get the profile image element.
 * @returns {HTMLImageElement} The image element.
 */
export function getProfileImage() {
  const element = getId("settings-self-profile");
  if (element instanceof HTMLImageElement) {
    return element;
  }
  return null;
}

/**
 * Get the file input element for the guild image.
 * @returns {HTMLInputElement} The file input element.
 */
export function getGuildImageFile() {
  const element = getId("guildImage");
  if (element instanceof HTMLInputElement) {
    return element;
  }
  return null;
}

/**
 * Get the file input element for the profile image.
 * @returns {HTMLInputElement} The file input element.
 */
export function getProfileImageFile() {
  const element = getId("profileImage");
  if (element instanceof HTMLInputElement) {
    return element;
  }
  return null;
}

export function clearAvatarInput(isGuild: boolean) {
  const fileInput = isGuild ? getGuildImageFile() : getProfileImageFile();
  if (fileInput) {
    fileInput.value = "";
  }
}

export function revertToLastConfirmedImage(isGuild: boolean) {
  if (isGuild) {
    if (lastConfirmedGuildImg) {
      const guildImage = getGuildImage();
      if (guildImage) {
        guildImage.src = URL.createObjectURL(lastConfirmedGuildImg);
      }
    }
  } else {
    if (lastConfirmedProfileImg) {
      const profileImage = getProfileImage();
      if (profileImage) {
        profileImage.src = URL.createObjectURL(lastConfirmedProfileImg);
      }
    }
  }
}

function onEditImage(isGuild: boolean) {
  const fileInput = isGuild ? getGuildImageFile() : getProfileImageFile();
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    return;
  }

  const filedata = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    function callbackAfterAccept(outputBase64: string) {
      const targetImage = isGuild ? getGuildImage() : getProfileImage();
      if (targetImage) {
        fetch(outputBase64)
          .then((res) => res.blob())
          .then((blob) => {
            if (isGuild) {
              lastConfirmedGuildImg = blob;
            } else {
              lastConfirmedProfileImg = blob;
            }
            targetImage.src = outputBase64;
          })
          .catch((err) =>
            console.error("Error converting base64 to Blob:", err)
          );
      }
      setIsChangedImage(true);
      regenerateConfirmationPanel();
      if (currentPopUp) {
        showConfirmationPanel(currentPopUp);
      }
    }
    if (e.target && typeof e.target.result === "string") {
      createCropPop(e.target.result, callbackAfterAccept);
    }
  };

  reader.onerror = (error) => console.error("Error reading file:", error);
  reader.readAsDataURL(filedata);

  clearAvatarInput(isGuild);
  setUnsaved(true);
}

export function onEditProfile() {
  onEditImage(false);
}

export async function onEditEmoji() {
  const emojiFileInput = getId("emoijImage") as HTMLInputElement;
  if (
    !emojiFileInput ||
    !emojiFileInput.files ||
    emojiFileInput.files.length === 0
  ) {
    return;
  }

  const files: File[] = Array.from(emojiFileInput.files);

  uploadImageEmoji(files);
}

export function onEditGuildProfile() {
  onEditImage(true);
}
export async function setGuildPic(guildImg: HTMLImageElement, guildId: string) {
  guildImg.src = getGuildUrl(guildId);
}
export function setGuildImage(
  guildId: string,
  imageElement: HTMLImageElement,
  isUploaded: boolean
) {
  imageElement.src = isUploaded ? getGuildUrl(guildId) : blackImage;
}

export async function setProfilePic(
  profileImg: HTMLImageElement,
  userId: string
) {
  setPicture(profileImg, userId, true);
}

async function init() {
  selfProfileImage.addEventListener("mouseover", function () {
    this.style.borderRadius = "0px";
  });
  selfProfileImage.addEventListener("mouseout", function () {
    this.style.borderRadius = "50%";
  });
}

init();
