import { CLYDE_ID } from "./chat.ts";
import { updateGuildImage, currentGuildId } from "./guild.ts";
import {
  getProfileUrl,
  defaultProfileImageSrc,
  clydeSrc,
  getBase64Image,
  getId,
  blackImage,
  STATUS_404,
  STATUS_200,
  urlToBase64,
  setDefaultProfileImageSrc,
  setDefaultMediaImageSrc,
  defaultMediaImageSrc
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

export const selfName = getId("self-name");
export const selfDiscriminator = getId("self-discriminator");
export let lastConfirmedProfileImg: string;
export const selfProfileImage = getId("self-profile-image") as HTMLImageElement;
export const selfStatus = getId("self-status");

let lastConfirmedGuildImg: string;
export let maxAttachmentSize: number; // mb
let maxAvatarSize: number; // mb

const profileCache = {};
const guildImageCache = {};
const failedProfiles = new Set();
const failedGuilds = new Set();
const requestInProgress = {};
const base64Of404 = "data:application/json;base64,W1wiNDA0XCIsNDA0XQ==";

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

export async function setPicture(
  imgToUpdate: HTMLImageElement,
  srcId: string,
  isProfile: boolean,
  isTimestamp?: boolean
) {
  if (!srcId) {
    imgToUpdate.src = isProfile ? defaultProfileImageSrc : blackImage;
    return;
  }
  if (!imgToUpdate) return;

  if (srcId === CLYDE_ID) {
    imgToUpdate.src = clydeSrc;
    return;
  }

  const timestamp = new Date().getTime();
  const imageUrl = !isProfile
    ? `/guilds/${srcId}.png${isTimestamp ? `?ts=${timestamp}` : ""}`
    : `${getProfileUrl(srcId)}${isTimestamp ? `?ts=${timestamp}` : ""}`;

  srcId = String(srcId);

  if (isProfile) {
    if (failedProfiles.has(srcId)) {
      imgToUpdate.src = defaultProfileImageSrc;
      return;
    }
  } else {
    if (failedGuilds.has(srcId)) {
      imgToUpdate.src = blackImage;
      return;
    }
  }

  const cachedBase64 = isProfile ? profileCache[srcId] : guildImageCache[srcId];
  if (cachedBase64 && cachedBase64 !== base64Of404) {
    imgToUpdate.src = cachedBase64;
    return;
  }

  if (requestInProgress[srcId]) {
    try {
      const base64data = await requestInProgress[srcId];
      imgToUpdate.src =
        base64data || (isProfile ? defaultProfileImageSrc : blackImage);
    } catch {
      imgToUpdate.src = isProfile ? defaultProfileImageSrc : blackImage;
    }
    return;
  }

  requestInProgress[srcId] = (async () => {
    try {
      const response = await fetch(imageUrl);
      if (response.status === STATUS_404) {
        imgToUpdate.src = isProfile ? defaultProfileImageSrc : blackImage;
        isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
        return null;
      }

      const blob = await response.blob();
      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = function () {
          const data = reader.result;
          if (data !== base64Of404) {
            (isProfile ? profileCache : guildImageCache)[srcId] = data;
            resolve(data);
          } else {
            (isProfile ? profileCache : guildImageCache)[srcId] = base64Of404;
            reject(new Error("Image is 404"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return base64data;
    } catch (e) {
      imgToUpdate.src = isProfile ? defaultProfileImageSrc : blackImage;
      isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
      console.error(e);
      return null;
    } finally {
      delete requestInProgress[srcId];
    }
  })();

  try {
    const base64data = await requestInProgress[srcId];
    imgToUpdate.src =
      base64data || (isProfile ? defaultProfileImageSrc : blackImage);
  } catch {
    imgToUpdate.src = isProfile ? defaultProfileImageSrc : blackImage;
  }

  imgToUpdate.addEventListener("error", function () {
    imgToUpdate.src = isProfile ? defaultProfileImageSrc : blackImage;
    isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
  });
}

export function refreshUserProfile(
  userId: string,
  userNick: string | null = null
): void {
  if (userId === currentUserId) {
    updateSelfProfile(userId, null, true, true);
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
        user.src = `/profiles/${userId}.png`;
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
          user.src = `/profiles/${userId}.png`;
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
    if (imageElement.src !== defaultProfileImageSrc) {
      imageElement.src = defaultProfileImageSrc;
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
  const selfimagepath = `/profiles/${userId}.png${timestamp}`;

  updateImageSource(selfProfileImage, selfimagepath);

  if (isSettingsOpen && currentSettingsCategory === settingTypes.MyAccount) {
    const settingsSelfProfile = getProfileImage();

    updateSelfName(nickName);

    updateImageSource(settingsSelfProfile, selfimagepath);

    if (isAfterUploading) {
      const base64output = getBase64Image(settingsSelfProfile);
      if (base64output) {
        console.log("Setting self profile as ", userId, nickName);
        lastConfirmedProfileImg = base64output;
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

  const file = getFileSrc(isGuild);
  if (!isValidBase64(file)) {
    console.error("Invalid file format or undefined file for avatar update.");
    return;
  }

  const blob = createBlobFromImage(file);
  if (blob.size > getMaxAvatarBytes()) {
    handleFileSizeError(blob.size);
    return;
  }

  sendImageUploadRequest(isGuild, blob, file);
}

function getFileSrc(isGuild: boolean): string {
  return isGuild ? getGuildImage().src : getProfileImage().src;
}

function isValidBase64(file: string): boolean {
  return file && file.startsWith("data:image/");
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

function handleFileSizeError(size) {
  console.error("Max avatar size exceeded. Uploaded file size:", size);
  alertUser(translations.getAvatarUploadErrorMsg(getMaxAvatarBytes()));
  getProfileImageFile().value = "";
}

function sendImageUploadRequest(isGuild, blob, file) {
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

function handleUploadResponse(xhr, isGuild, file, blob) {
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

function clearAvatarInput(isGuild) {
  if (isGuild) {
    getGuildImageFile().value = "";
  } else {
    getProfileImageFile().value = "";
  }
}
function revertToLastConfirmedImage(isGuild: boolean) {
  if (isGuild) {
    if (lastConfirmedGuildImg) {
      getGuildImage().src = lastConfirmedGuildImg;
    }
  } else {
    if (lastConfirmedProfileImg) {
      getProfileImage().src = lastConfirmedProfileImg;
    }
  }
}

export function onEditImage(isGuild: boolean) {
  const filedata = isGuild
    ? getGuildImageFile().files[0]
    : getProfileImageFile().files[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    function callbackAfterAccept(outputBase64) {
      if (isGuild) {
        lastConfirmedGuildImg = getBase64Image(getGuildImage());
      } else {
        lastConfirmedProfileImg = getBase64Image(getProfileImage());
      }
      if (isGuild) {
        getGuildImage().src = outputBase64;
      } else {
        getProfileImage().src = outputBase64;
      }
      setIsChangedImage(true);

      regenerateConfirmationPanel();

      showConfirmationPanel(currentPopUp);
    }
    createCropPop(e.target.result, callbackAfterAccept);
  };
  reader.onerror = (error) => {
    console.error("Error reading file:", error);
  };
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
export async function setGuildPic(guildImg, guildId) {
  setPicture(guildImg, guildId, false);
}
export async function setProfilePic(profileImg, userId, isTimestamp = false) {
  setPicture(profileImg, userId, true, isTimestamp);
}

async function init() {
  try {
    const base64Profile = await urlToBase64(defaultProfileImageSrc);
    setDefaultProfileImageSrc(base64Profile);

    const base64Media = await urlToBase64(defaultMediaImageSrc);
    setDefaultMediaImageSrc(base64Media);

    selfProfileImage.addEventListener("mouseover", function () {
      this.style.borderRadius = "0px";
    });
    selfProfileImage.addEventListener("mouseout", function () {
      this.style.borderRadius = "50%";
    });
  } catch (error) {
    console.error(error);
  }
}

init();
