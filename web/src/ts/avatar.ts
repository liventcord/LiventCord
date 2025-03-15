import { CLYDE_ID } from "./chat.ts";
import { updateGuildImage, currentGuildId } from "./guild.ts";
import {
  getProfileUrl,
  getBase64Image,
  getId,
  blackImage,
  STATUS_200,
  base64ToBlob,
  IMAGE_SRCS
} from "./utils.ts";
import {
  isSettingsOpen,
  settingTypes,
  currentPopUp,
  isChangedImage,
  setUnsaved,
  regenerateConfirmationPanel,
  setIsChangedImage
} from "./settings.ts";
import {
  currentSettingsCategory,
  showConfirmationPanel,
  updateSettingsProfileColor
} from "./settingsui.ts";
import { userList } from "./userList.ts";
import { createCropPop } from "./popups.ts";
import { translations } from "./translations.ts";
import { currentUserId, currentUserNick } from "./user.ts";
import { alertUser } from "./ui.ts";
import { chatContainer } from "./chatbar.ts";

export const selfName = getId("self-name") as HTMLElement;
export const selfDiscriminator = getId("self-discriminator") as HTMLElement;
export const selfProfileImage = getId("self-profile-image") as HTMLImageElement;
export const selfStatus = getId("self-status") as HTMLElement;

export let lastConfirmedProfileImg: Blob;
let lastConfirmedGuildImg: Blob;
export let maxAttachmentSize: number; // mb
let maxAvatarSize: number; // mb

function getMaxAvatarBytes() {
  const MB_BYTES = 1024;
  return maxAvatarSize * MB_BYTES * MB_BYTES;
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
const imageCache = new Map();
const failedImages = new Set();

export async function setPicture(
  imgToUpdate: HTMLImageElement,
  srcId: string,
  isProfile: boolean,
  isTimestamp?: boolean
) {
  if (!srcId) {
    imgToUpdate.src = isProfile ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC : blackImage;
    return;
  }
  if (!imgToUpdate) return;

  if (srcId === CLYDE_ID) {
    imgToUpdate.src = IMAGE_SRCS.CLYDE_SRC;
    return;
  }

  srcId = String(srcId);

  if (failedImages.has(srcId)) {
    imgToUpdate.src = isProfile ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC : blackImage;
    return;
  }

  if (imageCache.has(srcId)) {
    imgToUpdate.src = imageCache.get(srcId);
    return;
  }

  const timestamp = new Date().getTime();
  const imageUrl = !isProfile
    ? `/guilds/${srcId}.webp${isTimestamp ? `?ts=${timestamp}` : ""}`
    : `${getProfileUrl(srcId)}${isTimestamp ? `?ts=${timestamp}` : ""}`;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      imgToUpdate.src = isProfile ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC : blackImage;
      failedImages.add(srcId);
      return;
    }
    imageCache.set(srcId, imageUrl);
    imgToUpdate.src = imageUrl;
  } catch (e) {
    imgToUpdate.src = isProfile ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC : blackImage;
    failedImages.add(srcId);
    console.error(e);
  }

  imgToUpdate.addEventListener("error", function () {
    imgToUpdate.src = isProfile ? IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC : blackImage;
    failedImages.add(srcId);
  });
}

export function refreshUserProfile(
  userId: string,
  userNick: string | null = null
): void {
  if (userId === currentUserId) {
    updateSelfProfile(userId, "", true, true);
  }

  // from user list
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
        user.src = `/profiles/${userId}.webp`;
      }
    }
  });

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
          user.src = `/profiles/${userId}.webp`;
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
    alertUser(translations.getAvatarUploadErrorMsg(maxAvatarSize));
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

export function updateImageSource(
  imageElement: HTMLImageElement,
  imagePath: string
) {
  imageElement.onerror = () => {
    if (imageElement.src !== IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC) {
      imageElement.src = IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC;
    }
  };
  imageElement.onload = updateSettingsProfileColor;
  imageElement.src = imagePath;
}
export function updateSelfName(nickName: string) {
  if (!nickName) return;
  const settingsNameText = getId("settings-self-name");
  if (settingsNameText) {
    settingsNameText.innerText = nickName;
  }

  const selfNameText = getId("self-name");
  if (selfNameText) {
    selfNameText.innerText = nickName;
  }
}
export function updateSelfProfile(
  userId: string,
  nickName: string,
  isTimestamp?: boolean,
  isAfterUploading?: boolean
) {
  if (!userId) return;
  const timestamp = isTimestamp ? `?ts=${new Date().getTime()}` : "";
  const selfimagepath = `/profiles/${userId}.webp${timestamp}`;

  updateImageSource(selfProfileImage, selfimagepath);

  if (isSettingsOpen && currentSettingsCategory === settingTypes.MyAccount) {
    const settingsSelfProfile = getProfileImage();

    if (!settingsSelfProfile) return;
    updateSelfName(nickName);

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

export function uploadImage(isGuild: boolean): void {
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
    handleFileSizeError(blob.size);
    return;
  }

  const file = new File([blob], `profile-image.${blob.type.split("/")[1]}`, {
    type: blob.type
  });

  sendImageUploadRequest(isGuild, blob, file);
}

function resetProfileImageFile() {
  const profileImgFile = getProfileImageFile();
  if (profileImgFile) profileImgFile.value = "";
}
function getFileSrc(isGuild: boolean): string {
  return isGuild ? getGuildImage()?.src ?? "" : getProfileImage()?.src ?? "";
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

function handleFileSizeError(size: number) {
  console.error("Max avatar size exceeded. Uploaded file size:", size);
  alertUser(translations.getAvatarUploadErrorMsg(getMaxAvatarBytes()));
  resetProfileImageFile();
}

function sendImageUploadRequest(isGuild: boolean, blob: Blob, file: File) {
  const formData = new FormData();
  const fileName = `profile-image.${blob.type.split("/")[1]}`;
  formData.append("photo", blob, fileName);
  if (isGuild) {
    formData.append("guildId", currentGuildId);
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", isGuild ? "/api/images/guild" : "/api/images/profile");
  xhr.onload = () => handleUploadResponse(xhr, isGuild, file, blob);
  xhr.onerror = () => revertToLastConfirmedImage(isGuild);
  xhr.send(formData);
}

function handleUploadResponse(
  xhr: XMLHttpRequest,
  isGuild: boolean,
  file: File,
  blob: Blob
) {
  if (xhr.status === STATUS_200) {
    if (isGuild) {
      updateGuildImage(currentGuildId);
      lastConfirmedGuildImg = blob;
    } else {
      refreshUserProfile(currentUserId, currentUserNick);
      lastConfirmedProfileImg = blob;
    }
  } else {
    console.error("Error uploading profile pic!");
  }
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
  if (fileInput) fileInput.value = "";
}

function revertToLastConfirmedImage(isGuild: boolean) {
  if (isGuild) {
    if (lastConfirmedGuildImg) {
      const guildImage = getGuildImage();
      if (guildImage)
        guildImage.src = URL.createObjectURL(lastConfirmedGuildImg);
    }
  } else {
    if (lastConfirmedProfileImg) {
      const profileImage = getProfileImage();
      if (profileImage)
        profileImage.src = URL.createObjectURL(lastConfirmedProfileImg);
    }
  }
}

export function onEditImage(isGuild: boolean) {
  const fileInput = isGuild ? getGuildImageFile() : getProfileImageFile();
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;

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
      if (currentPopUp) showConfirmationPanel(currentPopUp);
    }
    if (e.target && typeof e.target.result === "string") {
      createCropPop(e.target.result as string, callbackAfterAccept);
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

export function onEditGuildProfile() {
  onEditImage(true);
}
export async function setGuildPic(guildImg: HTMLImageElement, guildId: string) {
  setPicture(guildImg, guildId, false);
}
export async function setProfilePic(
  profileImg: HTMLImageElement,
  userId: string,
  isTimestamp = false
) {
  setPicture(profileImg, userId, true, isTimestamp);
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
