import { CLYDE_ID } from "./chat";
import { updateGuild } from "./guild";
import {
  getProfileUrl,
  defaultProfileImageUrl,
  clydeSrc,
  getBase64Image,
} from "./utils";
import {
  isSettingsOpen,
  settingTypes,
  currentPopUp,
  isChangedProfile,
  setUnsaved,
  regenerateConfirmationPanel,
  setIsChangedProfile,
} from "./settings";
import {
  currentSettingsType,
  showConfirmationPanel,
  updateSettingsProfileColor,
} from "./settingsui";
import { userList } from "./userList";
import { createCropPop } from "./popups";
import { getId, blackImage } from "./utils";
import { translations } from "./translations";
import { currentUserId } from "./user";
import { alertUser } from "./ui";
import { guildCache } from "./cache";
import { chatContainer } from "./chatbar";
import { initialState } from "./app";

export const selfName = getId("self-name");
export const selfDiscriminator = getId("self-discriminator");
export let lastConfirmedProfileImg;
export const selfProfileImage = getId("self-profile-image");
export const selfStatus = getId("self-status");

let lastConfirmedGuildImg;
let maxAttachmentSize; // mb
let maxAvatarSize; // mb

function getMaxAvatarBytes() {
  return maxAvatarSize * 1024 * 1024;
}

const allowedAvatarTypes = [
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
];

const profileCache = {};
const guildImageCache = {};
const failedProfiles = new Set();
const failedGuilds = new Set();
const requestInProgress = {};
const base64Of404 = "data:application/json;base64,W1wiNDA0XCIsNDA0XQ==";

export async function setPicture(imgToUpdate, srcId, isProfile, isTimestamp) {
  if (!srcId) {
    imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
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
      imgToUpdate.src = defaultProfileImageUrl;
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
        base64data || (isProfile ? defaultProfileImageUrl : blackImage);
    } catch {
      imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
    }
    return;
  }

  requestInProgress[srcId] = (async () => {
    try {
      const response = await fetch(imageUrl);
      if (response.status === 404) {
        imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
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
      imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
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
      base64data || (isProfile ? defaultProfileImageUrl : blackImage);
  } catch {
    imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
  }

  imgToUpdate.addEventListener("error", function () {
    imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
    isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
  });
}

export function refreshUserProfile(userId, userNick = null) {
  if (userId === currentUserId) {
    updateSelfProfile(userId, null, true, true);
  }
  // from user list
  const profilesList = userList.querySelectorAll(".profile-pic");
  profilesList.forEach((user) => {
    if (userNick) {
      if (user.id === userId) {
        user.parentNode.querySelector(".profileName").innerText = userNick;
      }
    }
    if (userId) {
      if (user.id === userId) {
        user.src = `/profiles/${userId}.png`;
      }
    }
  });

  // from chat container
  const usersList = chatContainer.querySelectorAll(".profile-pic");
  usersList.forEach((user) => {
    if (userNick) {
      if (user.dataset.userId === userId) {
        user.parentNode.querySelector(".profileName").innerText = userNick;
      }
    }
    if (userId) {
      if (user.dataset.userId === userId) {
        user.src = `/profiles/${userId}.png`;
      }
    }
  });
}

export function validateAvatar(file) {
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

export function resetImageInput(inputId, imgId) {
  getId(inputId).value = "";
  getId(imgId).style.backgroundImage = "";
}

export function updateImageSource(imageElement, imagePath) {
  imageElement.onerror = () => {
    if (imageElement.src !== defaultProfileImageUrl) {
      imageElement.src = defaultProfileImageUrl;
    }
  };
  imageElement.onload = updateSettingsProfileColor;
  imageElement.src = imagePath;
}

export function updateSelfProfile(
  userId,
  userName,
  isTimestamp = false,
  isAfterUploading = false,
) {
  if (!userId) return;
  const timestamp = isTimestamp ? `?ts=${new Date().getTime()}` : "";
  const selfimagepath = `/profiles/${userId}.png${timestamp}`;

  updateImageSource(selfProfileImage, selfimagepath);

  if (isSettingsOpen && currentSettingsType === settingTypes.MyAccount) {
    const settingsSelfNameElement = getId("settings-self-name");
    const settingsSelfProfile = getId("settings-self-profile");

    if (userName) {
      settingsSelfNameElement.innerText = userName;
      selfName.innerText = userName;
    }

    updateImageSource(settingsSelfProfile, selfimagepath);

    if (isAfterUploading) {
      const base64output = getBase64Image(settingsSelfProfile);
      if (base64output) {
        console.log("Setting self profile as ", userId, userName);
        lastConfirmedProfileImg = base64output;
      }
    }
  }
}

export function setUploadSize(_maxAvatarSize, _maxAttachmentSize) {
  maxAvatarSize = initialState.maxAvatarSize;
  maxAttachmentSize = initialState.maxAttachmentSize;
}
export function uploadImage(isGuild) {
  if (!isChangedProfile) {
    console.warn("isChangedProfile is false. not uploading");
    return;
  }

  let formData = new FormData();
  const uploadedGuildId = guildCache.currentGuildId;
  const file = isGuild
    ? getId("guild-image").src
    : getId("settings-self-profile").src;

  if (file && file.startsWith("data:image/")) {
    const byteString = atob(file.split(",")[1]);
    const mimeString = file.split(",")[0].split(":")[1].split(";")[0];
    const ab = new Uint8Array(byteString.length);
    const maxAvatarBytes = getMaxAvatarBytes();

    for (let i = 0; i < byteString.length; i++) {
      ab[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeString });

    if (blob.size <= maxAvatarBytes) {
      const fileName = `profile-image.${mimeString.split("/")[1]}`;
      formData.append("photo", blob, fileName);

      if (isGuild) {
        formData.append("guildId", uploadedGuildId);
      }

      console.log("Sending req...");
      let xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/images");
      xhr.onload = function () {
        if (xhr.status === 200) {
          if (isGuild) {
            updateGuild(uploadedGuildId);
            lastConfirmedGuildImg = file;
          } else {
            updateSelfProfile(currentUserId, null, true);
            lastConfirmedProfileImg = file;
          }
        } else {
          console.error("Error uploading profile pic!");
        }
      };
      xhr.onerror = function () {
        if (isGuild) {
          getId("guild-image").src = lastConfirmedGuildImg;
        } else {
          getId("settings-self-profile").src = lastConfirmedProfileImg;
        }
      };
      xhr.send(formData);
    } else {
      console.error(
        "Max avatar size is: ",
        maxAvatarBytes,
        " while uploaded file size is: ",
        blob.size,
      );
      alertUser(translations.getAvatarUploadErrorMsg(maxAvatarSize));
      getId("profileImage").value = "";
    }
  } else {
    console.error("Invalid file format or undefined file.");
  }
}

export function onEditImage(isGuild) {
  const filedata = getId(isGuild ? "guildImage" : "profileImage").files[0];
  if (!filedata) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    function callbackAfterAccept(outputBase64) {
      if (isGuild) {
        lastConfirmedGuildImg = getBase64Image(getId("guild-image"));
      } else {
        lastConfirmedProfileImg = getBase64Image(
          getId("settings-self-profile"),
        );
      }

      getId(isGuild ? "guild-image" : "settings-self-profile").src =
        outputBase64;
      setIsChangedProfile(true);

      regenerateConfirmationPanel();

      showConfirmationPanel(currentPopUp);
    }
    createCropPop(e.target.result, callbackAfterAccept);
  };
  reader.onerror = (error) => {
    console.error("Error reading file:", error);
  };
  reader.readAsDataURL(filedata);
  getId(isGuild ? "guildImage" : "profileImage").value = "";

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
    const {
      urlToBase64,
      defaultMediaImageUrl,
      defaultProfileImageUrl,
      setDefaultMediaImageUrl,
      setDefaultProfileImageUrl,
    } = await import("./utils");

    const base64Profile = await urlToBase64(defaultProfileImageUrl);
    setDefaultProfileImageUrl(base64Profile);

    const base64Media = await urlToBase64(defaultMediaImageUrl);
    setDefaultMediaImageUrl(base64Media);

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
