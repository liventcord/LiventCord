//ui.js
import DOMPurify from "dompurify";

import {
  activityList,
  setUserListLine,
  toggleUsersList,
  userLine,
  userList
} from "./userList.ts";
import { loadDmHome, initialState } from "./app.ts";
import {
  closePopUp,
  createPopUp,
  createChannelsPop,
  toggleDropdown,
  createInviteUsersPop
} from "./popups.ts";
import { openSettings, SettingType } from "./settingsui.ts";
import {
  currentGuildId,
  guildContainer,
  leaveCurrentGuild,
  wrapWhiteRod
} from "./guild.ts";
import {
  createEl,
  getId,
  disableElement,
  enableElement,
  isMobile,
  formatDateGood,
  formatFileSize,
  getImageExtension,
  estimateImageSizeBytes,
  getResolution,
  getFileNameFromUrl,
  corsDomainManager,
  debounce,
  isURL,
  isImageLoaded
} from "./utils.ts";
import { translations } from "./translations.ts";
import { handleMediaPanelResize } from "./mediaPanel.ts";
import { isOnGuild, isOnMePage, router } from "./router.ts";
import { permissionManager } from "./guildPermissions.ts";
import {
  observe,
  scrollToBottom,
  scrollToMessage,
  updateChatWidth
} from "./chat.ts";
import { apiClient, EventType } from "./api.ts";
import { guildCache } from "./cache.ts";
import { changePassword, userManager } from "./user.ts";
import {
  chatContainer,
  chatContent,
  chatInput,
  FileHandler,
  showReplyMenu
} from "./chatbar.ts";
import {
  attachmentPattern,
  isImageSpoilered,
  setImageUnspoilered
} from "./mediaElements.ts";
import { selfName, setProfilePic } from "./avatar.ts";
import { createTooltip } from "./tooltip.ts";
import { earphoneButton, microphoneButton } from "./audio.ts";
import { isBlackTheme } from "./settings.ts";
import { setWidths } from "./channels.ts";

export const textChanHtml =
  '<svg class="icon_d8bfb3" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>';
export const muteHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m2.7 22.7 20-20a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4ZM10.8 17.32c-.21.21-.1.58.2.62V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 0 0-2 0c0 1.45-.52 2.79-1.38 3.83l-.02.02A5.99 5.99 0 0 1 12.32 16a.52.52 0 0 0-.34.15l-1.18 1.18ZM15.36 4.52c.15-.15.19-.38.08-.56A4 4 0 0 0 8 6v4c0 .3.03.58.1.86.07.34.49.43.74.18l6.52-6.52ZM5.06 13.98c.16.28.53.31.75.09l.75-.75c.16-.16.19-.4.08-.61A5.97 5.97 0 0 1 6 10a1 1 0 0 0-2 0c0 1.45.39 2.81 1.06 3.98Z" class=""></path></svg>';
export const inviteVoiceHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a1 1 0 1 0-2 0v8H3a1 1 0 1 0 0 2h8v8a1 1 0 0 0 2 0v-8h8a1 1 0 0 0 0-2h-8V3Z" class=""></path></svg>';
export const hoveredChanColor = () => (isBlackTheme() ? "#1C1C1F" : "#34353B");
export const selectedChanColor = () => (isBlackTheme() ? "#414248" : "#404249");

const activeIconHref = "/icons/iconactive.webp";
const inactiveIconHref = "/icons/icon.webp";
const favicon = getId("favicon") as HTMLAnchorElement;
const horizontalLineGuild = getId("horizontal-line-guild") as HTMLElement;
let currentFileName = "";
let isAddedDragListeners = false;

const imagePreviewContainer = getId(
  "image-preview-container"
) as HTMLImageElement;
if (imagePreviewContainer) {
  imagePreviewContainer.addEventListener("click", hideImagePreviewRequest);
}

let isOnLeft = false;
export let isOnRight = false;
const mobileBlackBg = getId("mobile-black-bg") as HTMLElement;
const toolbarOptions = getId("toolbaroptions") as HTMLElement;
const navigationBar = getId("navigation-bar") as HTMLElement;

let previewSlideStartX = 0;
let previewSlideEndX = 0;

const channelList = getId("channel-list") as HTMLElement;

export let loadingScreen: HTMLElement;

function enableLoadingScreen() {
  loadingScreen = createEl("div", { id: "loading-screen" });
  document.body.appendChild(loadingScreen);
  const loadingElement = createEl("img", {
    id: "loading-element"
  });
  loadingScreen.appendChild(loadingElement);
  loadingElement.src = "/icons/icon.webp";
}
function isLoadingScreen() {
  if (!loadingScreen) {
    return false;
  }
  return loadingScreen.style.display === "flex";
}
function hideLoadingScreen() {
  loadingScreen.style.display = "none";
}

let isEmailToggled = false;
export function toggleEmail() {
  const eyeIcon = getId("set-info-email-eye");
  const emailIcon = getId("set-info-email");
  if (!eyeIcon || !emailIcon) {
    return;
  }
  isEmailToggled = !isEmailToggled;
  emailIcon.textContent = isEmailToggled
    ? initialState.user.email
    : initialState.user.maskedEmail;
  if (isEmailToggled) {
    eyeIcon.classList.remove("fa-eye");
    eyeIcon.classList.add("fa-eye-slash");
  } else {
    eyeIcon.classList.remove("fa-eye-slash");
    eyeIcon.classList.add("fa-eye");
  }
}

export function handleToggleClick(
  toggleElement: HTMLElement,
  toggleClickCallback: CallableFunction
) {
  toggleElement.addEventListener("click", function () {
    this.classList.toggle("active");
    const toggleSwitch = this.querySelector(".toggle-switch") as HTMLElement;
    toggleSwitch.classList.toggle("active");
    toggleClickCallback();
  });
}

export function handleResize() {
  handleMediaPanelResize();
  if (!userList) {
    return;
  }
  setWidths(getCurrentWidth());

  const isSmallScreen = window.innerWidth < 600;
  setUserListLine();

  if (isSmallScreen) {
    if (!isMobile) {
      disableElement(userList);
      if (userLine) {
        disableElement(userLine);
      }
      if (activityList) {
        disableElement(activityList);
      }
    }
  } else {
    if (isOnMePage) {
      if (activityList) {
        enableElement(activityList);
      }
    } else {
      if (activityList) {
        disableElement(activityList);
      }
    }
  }
  updateChatWidth();

  const inputRightToSet = userList.style.display === "flex" ? "463px" : "76px";
  const addFriendInputButton = getId("addfriendinputbutton");
  if (addFriendInputButton) {
    addFriendInputButton.style.right = inputRightToSet;
  }
}
function handleMobileToolbar() {
  getId("toolbaroptions")
    ?.querySelectorAll(".iconWrapper")
    .forEach((toolbar) => {
      toolbar.classList.add("toolbarIconMobile");
    });
}
export function loadMainToolbar() {
  if (isMobile) {
    handleMobileToolbar();
  }
  disableElement("tb-hamburger");
  disableElement("tb-call");
  disableElement("tb-video-call");
  disableElement("tb-pin");
  disableElement("tb-createdm");
  disableElement("tb-show-members");
  disableElement("tb-search");
}
export function loadGuildToolbar() {
  if (isMobile) {
    handleMobileToolbar();
    enableElement("tb-hamburger");
  } else {
    disableElement("tb-hamburger");
  }
  disableElement("tb-call");
  disableElement("tb-video-call");
  enableElement("tb-pin");
  disableElement("tb-createdm");
  enableElement("tb-show-members");
  enableElement("tb-search");
}
export function loadDmToolbar() {
  if (isMobile) {
    handleMobileToolbar();
    enableElement("tb-hamburger");
  } else {
    disableElement("tb-hamburger");
  }
  enableElement("tb-call");
  enableElement("tb-video-call");
  enableElement("tb-pin");
  enableElement("tb-createdm");
  enableElement("tb-show-members");
  enableElement("tb-search");
}

export function fillDropDownContent() {
  if (permissionManager.canManageChannels()) {
    enableElement("channel-dropdown-button");
  } else {
    disableElement("channel-dropdown-button");
  }
  if (permissionManager.canManageChannels()) {
    enableElement("invite-dropdown-button");
  } else {
    disableElement("invite-dropdown-button");
  }

  if (permissionManager.isSelfOwner()) {
    disableElement("exit-dropdown-button");
  } else {
    enableElement("exit-dropdown-button");
  }
}

export function setActiveIcon() {
  if (favicon.href !== activeIconHref) {
    favicon.href = activeIconHref;
  }
}

export function setInactiveIcon() {
  if (favicon.href !== inactiveIconHref) {
    favicon.href = inactiveIconHref;
  }
}

//Generic

function createPopupContent(
  includeCancel = false,
  subject: string,
  content: string,
  buttonText: string,
  acceptCallback?: CallableFunction,
  isRed?: boolean
) {
  const popUpSubject = createEl("h1", {
    className: "pop-up-subject",
    textContent: subject
  });
  const popUpContent = createEl("p", {
    className: "pop-up-content",
    textContent: content
  });

  const popAcceptButton = createEl("button", {
    className: "pop-up-accept",
    textContent: buttonText
  });
  if (isRed) {
    popAcceptButton.style.backgroundColor = "rgb(218, 55, 60)";
  }
  const buttonContainer = createEl("div", {
    className: "pop-button-container"
  });
  const contentElements = [popUpSubject, popUpContent, buttonContainer];

  const outerParent = createPopUp({
    contentElements,
    id: ""
  });

  const handleEnterKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleAccept();
    }
  };

  const handleAccept = () => {
    if (acceptCallback) {
      acceptCallback();
    }
    if (outerParent && outerParent.firstChild) {
      closePopUp(outerParent, outerParent.firstChild as HTMLElement);
      document.removeEventListener("keydown", handleEnterKeydown);
    }
  };

  if (includeCancel) {
    const popRefuseButton = createEl("button", {
      className: "pop-up-refuse",
      textContent: translations.getTranslation("cancel")
    });

    buttonContainer.appendChild(popRefuseButton);
    popRefuseButton.addEventListener("click", function () {
      if (outerParent && outerParent.firstChild) {
        closePopUp(outerParent, outerParent.firstChild as HTMLElement);
        document.removeEventListener("keydown", handleEnterKeydown);
      }
    });
  }

  buttonContainer.appendChild(popAcceptButton);

  popAcceptButton.addEventListener("click", handleAccept);

  document.addEventListener("keydown", handleEnterKeydown);

  return outerParent;
}

const popupQueue: Array<{ subject: string; content?: string }> = [];
let isPopupVisible = false;

export function alertUser(subject: string, content?: string): void {
  popupQueue.push({ subject, content });

  if (!isPopupVisible) {
    showNextPopup();
  }
}

function showNextPopup() {
  if (popupQueue.length === 0) {
    isPopupVisible = false;
    return;
  }

  isPopupVisible = true;
  const { subject, content } = popupQueue.shift()!;

  if (!content && subject) {
    displayPopup(subject, subject);
  } else {
    displayPopup(subject, content ?? "");
  }
}
let currentPopupEl: HTMLElement | null = null;
function displayPopup(subject: string, content: string) {
  console.error(subject, content);

  const outerParent = createPopupContent(
    false,
    subject,
    content,
    translations.getTranslation("ok"),
    () => {
      isPopupVisible = false;
      showNextPopup();
    }
  );

  outerParent.style.zIndex = "1000";
  currentPopupEl = outerParent;

  document.body.appendChild(outerParent);
}
export function dismissCurrentPopupIf(subject: string) {
  if (!currentPopupEl) return;

  const pop = currentPopupEl.querySelector(".pop-up");

  if (!pop) return;

  const titleEl = pop?.querySelector(".pop-up-subject");

  if (!titleEl) return;
  if (titleEl && titleEl.textContent === subject) {
    currentPopupEl.remove();
    currentPopupEl = null;
    isPopupVisible = false;
    showNextPopup();
  }
}

export function askUser(
  subject: string,
  content: string,
  actionText: string,
  acceptCallback: CallableFunction,
  isRed = false
) {
  createPopupContent(true, subject, content, actionText, acceptCallback, isRed);
}
export function openChangePasswordPop() {
  const title = translations.getSettingsTranslation("UpdatePasswordTitle");
  const description = translations.getSettingsTranslation(
    "UpdatePasswordDescription"
  );
  const currentPassword = translations.getSettingsTranslation(
    "UpdatePasswordCurrent"
  );
  const newPassword = translations.getSettingsTranslation("UpdatePasswordNew");
  const newPasswordConfirm = translations.getSettingsTranslation(
    "UpdatePasswordNewConfirm"
  );

  const popUpSubject = createEl("h1", {
    className: "pop-up-subject",
    textContent: title
  });
  const popUpContent = createEl("p", {
    className: "pop-up-content",
    textContent: description
  });
  popUpContent.style.marginLeft = "50px";
  popUpContent.style.marginTop = "0px";

  const popAcceptButton = createEl("button", {
    className: "pop-up-accept",
    textContent: translations.getTranslation("done")
  });

  const popRefuseButton = createEl("button", {
    className: "pop-up-refuse",
    textContent: translations.getTranslation("cancel")
  });
  popRefuseButton.style.marginTop = "60px";
  popAcceptButton.style.marginTop = "60px";

  const contentElements = [popUpSubject, popUpContent];

  const outerParent = createPopUp({
    contentElements,
    id: ""
  });

  const handleEnterKeydown = (event: KeyboardEvent) => {
    event.preventDefault();
    if (event.key === "Enter") {
      acceptCallback(event);
    }
  };
  const currentPasswordInputTitle = createEl("p", {
    id: "current-password-input-title",
    textContent: currentPassword
  });
  currentPasswordInputTitle.classList.add("password-title");

  const currentInput = createEl("input", {
    id: "current-password-input",
    type: "password"
  });
  currentInput.classList.add("password-input");

  const newInput = createEl("input", {
    id: "new-password-input",
    type: "password"
  });
  newInput.classList.add("password-input");

  const newPasswordInputTitle = createEl("p", {
    id: "new-password-input-title",
    textContent: newPassword
  });
  newPasswordInputTitle.classList.add("password-title");

  const newPasswordConfirmTitle = createEl("p", {
    id: "new-password-input-confirm-title",
    textContent: newPasswordConfirm
  });
  newPasswordConfirmTitle.classList.add("password-title");

  const newInputConfirm = createEl("input", {
    id: "new-password-input-confirm",
    type: "password"
  });
  newInputConfirm.classList.add("password-input");

  const parentElement = outerParent.firstChild as HTMLElement;
  parentElement.style.animation = "pop-up-animation-password 0.3s forwards";
  parentElement.style.backgroundColor = "#37373E";

  parentElement.appendChild(currentPasswordInputTitle);
  parentElement.appendChild(currentInput);
  parentElement.appendChild(newPasswordInputTitle);
  parentElement.appendChild(newInput);
  parentElement.appendChild(newPasswordConfirmTitle);
  parentElement.appendChild(newInputConfirm);
  const successCallback = () => {
    if (outerParent && outerParent.firstChild) {
      closePopUp(outerParent, outerParent.firstChild as HTMLElement);
      document.removeEventListener("keydown", handleEnterKeydown);
    }
  };
  const acceptCallback = (event: KeyboardEvent | null) => {
    changePassword(
      event,
      currentInput,
      newInput,
      newInputConfirm,
      successCallback
    );
  };

  parentElement.appendChild(popRefuseButton);
  popRefuseButton.addEventListener("click", function () {
    if (outerParent && outerParent.firstChild) {
      closePopUp(outerParent, outerParent.firstChild as HTMLElement);
      document.removeEventListener("keydown", handleEnterKeydown);
    }
  });

  parentElement.appendChild(popAcceptButton);

  document.addEventListener("keydown", handleEnterKeydown);

  popAcceptButton.addEventListener("click", function () {
    acceptCallback(null);
  });
}
let logoClicked = 0;

export function clickMainLogo(logo: HTMLElement) {
  logoClicked++;
  if (logoClicked >= 14) {
    logoClicked = 0;
    try {
      const audio = new Audio("/liventocordolowpitch.mp3");
      audio.play();
    } catch (error) {
      console.log(error);
    }
  }
  wrapWhiteRod(logo);
  loadDmHome();
}

export function logOutPrompt() {
  const logOut = translations.getTranslation("log-out-button");
  askUser(
    logOut,
    translations.getTranslation("log-out-prompt"),
    logOut,
    router.logOutApp,
    true
  );
}

// media preview
export function beautifyJson(jsonData: string) {
  try {
    const beautifiedJson = JSON.stringify(jsonData, null, "\t");
    return beautifiedJson;
  } catch (error) {
    console.error("Error beautifying JSON:", error);
    return null;
  }
}

function focusOnMessage(imageElement: HTMLElement) {
  hideImagePreview();
  if (isOnMediaPanel) {
    setTimeout(() => {
      const imagesParent = imageElement.parentElement;
      if (imagesParent && imagesParent.dataset.messageid) {
        const imagesMessage = chatContent.querySelector(
          `div[id=${CSS.escape(imagesParent.dataset.messageid)}]`
        ) as HTMLElement;
        if (imagesMessage) {
          scrollToMessage(imagesMessage);
        }
      }
    }, 50);
  } else {
    setTimeout(() => {
      const imagesParent = imageElement.parentElement?.parentElement;
      if (imagesParent) {
        const imagesMessage = chatContent.querySelector(
          `div[id=${CSS.escape(imagesParent.id)}]`
        ) as HTMLElement;

        if (imagesMessage) {
          scrollToMessage(imagesMessage);
        }
      }
    }, 50);
  }
}

function setupPreviewMetadata(
  imageElement: HTMLImageElement,
  sourceImage: string,
  senderId?: string,
  date?: Date
) {
  const previewAuthor = getId("preview-author");
  const previewNick = getId("preview-nick");
  const descriptionName = getId("details-container-description-1");
  const descriptionSize = getId("details-container-description-2");
  const previewDate = getId("preview-date");
  const previewContent = getId("preview-content");

  const senderAvatar = previewAuthor?.querySelector(
    ".preview-avatar"
  ) as HTMLImageElement;
  if (senderId && senderAvatar) {
    senderAvatar.id = senderId;
    setProfilePic(senderAvatar, senderId);
  }

  if (previewNick && senderId) {
    previewNick.textContent = userManager.getUserNick(senderId);
  }

  const filename =
    imageElement.dataset.filename ||
    getFileNameFromUrl(sourceImage) ||
    sourceImage;

  currentFileName = sourceImage;
  if (descriptionName && filename) {
    descriptionName.textContent = filename;
    descriptionName.addEventListener("mouseover", () =>
      createTooltip(descriptionName, filename)
    );
  }

  const dataFileSize = imageElement.dataset.filesize;
  const extension = getImageExtension(imageElement);
  let size = Number(dataFileSize);
  let isEstimated = false;

  if (!size || isNaN(size)) {
    size = estimateImageSizeBytes(
      imageElement.naturalWidth,
      imageElement.naturalHeight,
      extension
    );
    isEstimated = true;
  }

  if (descriptionSize) {
    const formattedSize = formatFileSize(size);
    const sizeText = `${getResolution(imageElement)} (${formattedSize}${isEstimated ? " roughly" : ""})`;
    descriptionSize.textContent = sizeText;
    descriptionSize.addEventListener("mouseover", () =>
      createTooltip(descriptionSize, sizeText)
    );
  }

  if (previewDate && date) {
    previewDate.textContent = formatDateGood(date);
    previewDate.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault();
      focusOnMessage(imageElement);
    });
  }

  let content: string | undefined;
  if (isOnMediaPanel) {
    content = imageElement.parentElement?.dataset.content;
  } else {
    const grandParent = imageElement.parentNode
      ?.parentNode as HTMLElement | null;
    content = grandParent?.dataset.content;
  }

  if (previewContent) {
    previewContent.textContent = content || "";
    previewContent.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault();
      focusOnMessage(imageElement);
    });

    previewContent?.addEventListener("mouseover", () =>
      createTooltip(previewContent, content || "")
    );
  }
}

let isPreviewZoomed = false;
let isDragging = false;
let startX = 0;
let startY = 0;

const zoomInSVG = `
  <svg aria-hidden="true" role="img"
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" fill="none"
        viewBox="0 0 24 24">
    <path fill="var(--interactive-normal)" fill-rule="evenodd"
          d="M15.62 17.03a9 9 0 1 1 1.41-1.41l4.68 4.67a1 1 0 0 1-1.42 1.42l-4.67-4.68ZM17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
          clip-rule="evenodd"></path>
    <path fill="var(--interactive-normal)"
          d="M11 7a1 1 0 1 0-2 0v2H7a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V7Z">
    </path>
  </svg>
`;

const zoomOutSVG = `
  <svg aria-hidden="true" role="img"
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" fill="none"
        viewBox="0 0 24 24">
    <path fill="var(--interactive-normal)" fill-rule="evenodd"
          d="M15.62 17.03a9 9 0 1 1 1.41-1.41l4.68 4.67a1 1 0 0 1-1.42 1.42l-4.67-4.68ZM17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
          clip-rule="evenodd"></path>
    <rect x="6" y="9" width="8" height="2" fill="var(--interactive-normal)" rx="1" />
  </svg>
`;

function toggleZoom() {
  console.error(isPreviewZoomed);
  const previewImage = getId("preview-image");
  if (!previewImage) {
    return;
  }
  isPreviewZoomed = !isPreviewZoomed;
  const previewZoomButton = getId("preview-image-zoom") as HTMLButtonElement;
  const divZoom = previewZoomButton.querySelector("div");

  if (isPreviewZoomed) {
    previewImage.classList.add("zoomed");
    previewImage.style.left = "50%";
    previewImage.style.top = "50%";
    previewImage.style.transform = "translate(-50%, -50%)";
    previewImage.style.width = "auto";
    previewImage.style.height = "auto";
  } else {
    previewImage.classList.remove("zoomed");
    previewImage.style.left = "0%";
    previewImage.style.top = "0%";
    previewImage.style.transform = "translate(-50%, -50%)";
    previewImage.style.width = "";
    previewImage.style.height = "";
  }
  if (divZoom) divZoom.innerHTML = isPreviewZoomed ? zoomOutSVG : zoomInSVG;
}
function handlePreviewDownloadButton(sanitizedSourceImage: string) {
  const previewImageDownload = getId(
    "preview-image-download"
  ) as HTMLButtonElement;
  const previewImage = getId("preview-image") as HTMLImageElement;

  previewImageDownload.onclick = async () => {
    if (!sanitizedSourceImage) {
      return;
    }

    try {
      if (previewImage?.complete && previewImage.naturalWidth !== 0) {
        const canvas = createEl("canvas", {
          width: previewImage.naturalWidth,
          height: previewImage.naturalHeight
        });

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(previewImage, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            triggerDownload(url, sanitizedSourceImage);
            URL.revokeObjectURL(url);
          } else {
            fallbackDownload();
          }
        }, "image/jpeg");
      } else {
        fallbackDownload();
      }
    } catch {
      fallbackDownload();
    }

    function fallbackDownload() {
      router.downloadLink(sanitizedSourceImage);
    }

    function triggerDownload(url: string, originalUrl: string) {
      const a = createEl("a", {
        href: url,
        download: originalUrl.split("/").pop() || "image.jpg"
      });
      a.click();
    }
  };
}

function handlePreviewOpenButton(sanitizedSourceImage: string) {
  const previewOpenButton = getId("preview-image-open") as HTMLButtonElement;
  const previewImage = getId("preview-image") as HTMLImageElement;

  previewOpenButton.onclick = () => {
    if (sanitizedSourceImage) {
      const link = isURL(currentFileName)
        ? currentFileName
        : sanitizedSourceImage;
      router.openLink(link, previewImage);
    }
  };
}
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    hideImagePreview();
  }
}
document.addEventListener("keydown", handleKeyDown);
export async function displayImagePreviewBlob(imageElement: HTMLImageElement) {
  const blobUrl = imageElement.src;
  const response = await fetch(blobUrl);
  const blob = await response.blob();

  const objectUrl = URL.createObjectURL(blob);
  const newImage = createEl("img", { src: objectUrl });

  await displayImagePreview(newImage);
  URL.revokeObjectURL(objectUrl);
}

export async function displayImagePreview(
  imageElement: HTMLImageElement,
  senderId?: string,
  date?: Date,
  isSpoiler = false,
  isFromMediaPanel = false
): Promise<void> {
  enableElement("image-preview-container");
  const previewImage = getId("preview-image") as HTMLImageElement;
  const sourceImage = getSourceImage(imageElement);
  const sanitizedSourceImage = DOMPurify.sanitize(sourceImage);

  previewImage.style.animation = "preview-image-animation 0.2s forwards";
  const _isImageLoaded = isImageLoaded(imageElement);
  previewImage.src = _isImageLoaded
    ? imageElement.src
    : await corsDomainManager.getProxy(sanitizedSourceImage);
  updateCurrentIndex(sourceImage, isFromMediaPanel);
  handleImageSpoiler(previewImage, isSpoiler);

  setupPreviewMetadata(imageElement, sourceImage, senderId, date);

  addEventListeners(
    previewImage,
    imageElement,
    sanitizedSourceImage,
    senderId,
    isSpoiler
  );
}

function getSourceImage(imageElement: any): string {
  console.log(imageElement);
  if (
    !imageElement ||
    typeof imageElement !== "object" ||
    typeof imageElement.getAttribute !== "function"
  ) {
    return "";
  }
  return (
    imageElement.dataset?.originalSrc ||
    imageElement.getAttribute("data-original-src") ||
    imageElement.src ||
    ""
  );
}

function handleImageSpoiler(
  previewImage: HTMLImageElement,
  isSpoiler: boolean
): void {
  if (isSpoiler) {
    FileHandler.blurImage(previewImage);
  } else {
    FileHandler.unBlurImage(previewImage);
  }
}

function addEventListeners(
  previewImage: HTMLImageElement,
  imageElement: HTMLImageElement,
  sanitizedSourceImage: string,
  senderId?: string,
  isSpoiler = false
): void {
  const spoilerText = previewImage.querySelector(
    ".spoiler-text"
  ) as HTMLElement;

  if (spoilerText) {
    spoilerText.onclick = (event) => {
      event.stopPropagation();
      handlePreviewClick(previewImage, isSpoiler, imageElement.id);
    };
  }

  previewImage.onclick = () => {
    handlePreviewClick(previewImage, isSpoiler, imageElement.id);
  };
  setupZoomButton();
  handlePreviewOpenButton(sanitizedSourceImage);
  handlePreviewDownloadButton(sanitizedSourceImage);

  setupReplyButton(imageElement, senderId);
  if (isAddedDragListeners) {
    return;
  }
  isAddedDragListeners = true;
  setupImagePreviewDrag(previewImage);
}

function handlePreviewClick(
  previewImage: HTMLImageElement,
  isSpoiler: boolean,
  imageId: string
): void {
  if (isSpoiler) {
    FileHandler.unBlurImage(previewImage);
    setImageUnspoilered(imageId);
    isSpoiler = false;
  } else {
    toggleZoom();
  }
}

function setupZoomButton(): void {
  const previewZoomButton = getId("preview-image-zoom") as HTMLButtonElement;
  if (previewZoomButton) {
    previewZoomButton.addEventListener("click", () => {
      toggleZoom();
    });
  }
}

function setupReplyButton(
  imageElement: HTMLImageElement,
  senderId?: string
): void {
  const previewReplyButton = getId("preview-image-reply") as HTMLButtonElement;
  if (previewReplyButton) {
    previewReplyButton.onclick = () => {
      hideImagePreview();
      const imagesMessage = imageElement.parentNode?.parentNode as HTMLElement;
      if (imagesMessage) {
        scrollToMessage(imagesMessage);
        const messageId = (
          imageElement.parentElement?.parentElement as HTMLElement
        ).id;
        if (senderId && messageId) {
          showReplyMenu(messageId, senderId);
        }
      }
    };
  }
}

function setupImagePreviewDrag(previewImage: HTMLImageElement): void {
  previewImage.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  previewImage.addEventListener("mousedown", (event) => {
    if (event.button === 2 && isPreviewZoomed) {
      event.preventDefault();
      isDragging = true;
      startX = event.clientX - previewImage.offsetLeft;
      startY = event.clientY - previewImage.offsetTop;
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (isDragging) {
      dragMove(event.clientX, event.clientY);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  previewImage.addEventListener("touchstart", (event) => {
    if (isPreviewZoomed && event.touches.length === 1) {
      const touch = event.touches[0];
      isDragging = true;
      startX = touch.clientX - previewImage.offsetLeft;
      startY = touch.clientY - previewImage.offsetTop;
    }
  });

  document.addEventListener(
    "touchmove",
    (event) => {
      if (isDragging && event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        dragMove(touch.clientX, touch.clientY);
      }
    },
    { passive: false }
  );

  document.addEventListener("touchend", () => {
    isDragging = false;
  });

  function dragMove(clientX: number, clientY: number) {
    const newX = clientX - startX;
    const newY = clientY - startY;

    const overflowX = previewImage.width * 0.8;
    const overflowY = previewImage.height * 0.8;

    const minX = -overflowX;
    const minY = -overflowY;
    const maxX =
      imagePreviewContainer.clientWidth - previewImage.width + overflowX;
    const maxY =
      imagePreviewContainer.clientHeight - previewImage.height + overflowY;

    const clampedX = Math.min(Math.max(newX, minX), maxX);
    const clampedY = Math.min(Math.max(newY, minY), maxY);

    previewImage.style.left = `${clampedX}px`;
    previewImage.style.top = `${clampedY}px`;
  }
}

export function isImagePreviewOpen() {
  return imagePreviewContainer.style.display === "flex";
}
let currentChatPreviewIndex = 0;
let currentMediaPreviewIndex = 0;

const popUpClose = getId("popup-close");
if (popUpClose) {
  popUpClose.addEventListener("click", hideImagePreview);
}
function addNavigationListeners() {
  document.addEventListener("keydown", (event) => {
    if (isImagePreviewOpen()) {
      if (event.key === "ArrowRight") {
        moveToNextImage();
      } else if (event.key === "ArrowLeft") {
        moveToPreviousImage();
      }
    }
  });
}
let isOnMediaPanel = false;
function movePreviewImg(images: HTMLImageElement[]) {
  const img =
    images[
      isOnMediaPanel ? currentMediaPreviewIndex : currentChatPreviewIndex
    ] ?? null;
  if (img) {
    displayImagePreview(
      img,
      img.dataset.userid ?? "",
      img.dataset.date ? new Date(img.dataset.date) : new Date(),
      isImageSpoilered(img.id)
    );
  }
}
function getImages(): HTMLImageElement[] {
  const mediaGrid = getId("media-grid") as HTMLElement;
  const container = isOnMediaPanel ? mediaGrid : chatContent;

  const selector = isOnMediaPanel ? ".image-box img" : ".chat-image";

  const images = Array.from(container.querySelectorAll(selector)).filter(
    (img): img is HTMLImageElement =>
      img instanceof HTMLImageElement &&
      img.src !== "" &&
      !img.classList.contains("profile-pic")
  );

  const uniqueImages = Array.from(new Set(images));

  return uniqueImages;
}

function moveToNextImage() {
  const images = getImages();
  if (images.length === 0) {
    return;
  }

  if (isOnMediaPanel) {
    currentMediaPreviewIndex = (currentMediaPreviewIndex + 1) % images.length;
  } else {
    console.log("Images lenght: ", images.length);
    console.log("Old index: ", currentChatPreviewIndex);
    currentChatPreviewIndex = (currentChatPreviewIndex + 1) % images.length;
    console.log(
      `Moving to next image: ${currentChatPreviewIndex}/${images.length - 1}`
    );
    console.log("New index: ", currentChatPreviewIndex);
  }

  movePreviewImg(images);
}

function moveToPreviousImage() {
  const images = getImages();
  if (images.length === 0) {
    return;
  }

  if (isOnMediaPanel) {
    currentMediaPreviewIndex =
      (currentMediaPreviewIndex - 1 + images.length) % images.length;
  } else {
    currentChatPreviewIndex =
      (currentChatPreviewIndex - 1 + images.length) % images.length;
    console.log(
      `Moving to previous image: ${currentChatPreviewIndex}/${images.length - 1}`
    );
  }

  movePreviewImg(images);
}

function compareSrcs(image1: string, image2: string): boolean {
  const match1 = image1.match(attachmentPattern);

  const regex2 = /\/attachments\/(\d+)/;
  const match2 = image2.match(regex2);

  const id1 = match1 ? match1[1] : null;
  const id2 = match2 ? match2[1] : null;

  return id1 === id2;
}

function updateCurrentIndex(sourceimg: string, isFromMediaPanel: boolean) {
  const images = getImages();

  isOnMediaPanel = isFromMediaPanel;

  const newIndex = images.findIndex((img) => compareSrcs(img.src, sourceimg));

  if (newIndex !== -1) {
    if (isFromMediaPanel) {
      currentMediaPreviewIndex = newIndex;
    }
  }
}

export function displayJsonPreview(sourceJson: string) {
  jsonPreviewContainer.style.display = "flex";

  jsonPreviewElement.dataset.content_observe = sourceJson;
  jsonPreviewElement.style.userSelect = "text";
  jsonPreviewElement.style.whiteSpace = "pre-wrap";
  observe(jsonPreviewElement);
}

export function hideImagePreviewRequest(event: Event) {
  const target = event.target as HTMLElement;

  if (target.id === "image-preview-container") {
    hideImagePreview();
  }
}

export function hideImagePreview() {
  const previewImage = getId("preview-image") as HTMLImageElement;
  previewImage.style.animation =
    "preview-image-disappear-animation 0.15s forwards";

  if (isPreviewZoomed) {
    toggleZoom();
  }
  setTimeout(() => {
    disableElement(imagePreviewContainer);

    previewImage.src = "";
  }, 150);
}
const jsonPreviewContainer = getId("json-preview-container") as HTMLElement;
const jsonPreviewElement = getId("json-preview-element") as HTMLElement;
function hideJsonPreview(event: Event) {
  const target = event.target as HTMLElement;

  if (target && target.id === "json-preview-container") {
    jsonPreviewContainer.style.display = "none";
  }
}

export async function createInvitePop() {
  await apiClient.send(EventType.GET_INVITES, {
    guildId: currentGuildId,
    channelId: guildCache.currentChannelId
  });
  createInviteUsersPop();
}
export function openGuildSettingsDropdown(event: Event) {
  const handlers: Record<string, () => void> = {
    "invite-dropdown-button": createInvitePop,
    "settings-dropdown-button": () => {
      openSettings(SettingType.GUILD);
    },
    "channel-dropdown-button": () => {
      createChannelsPop(currentGuildId);
    },
    "exit-dropdown-button": () => {
      askUser(
        translations.getTranslation("exit-dropdown-button"),
        translations.getTranslation("leave-guild-detail"),
        translations.getTranslation("exit-dropdown-button"),
        leaveCurrentGuild
      );
    }
  };

  const clickedId = (event.target as HTMLElement).id;

  toggleDropdown();

  if (clickedId in handlers) {
    handlers[clickedId]();
  }
}

document.addEventListener("touchstart", (e: TouchEvent) => {
  previewSlideStartX = e.touches[0].clientX;
});

document.addEventListener("touchend", (e: TouchEvent) => {
  previewSlideEndX = e.changedTouches[0].clientX;
  const diff = previewSlideEndX - previewSlideStartX;

  if (Math.abs(diff) < 50) {
    return;
  }

  if (isImagePreviewOpen()) {
    if (!isPreviewZoomed) {
      if (diff > 50) {
        moveToPreviousImage();
      } else if (diff < -50) {
        moveToNextImage();
      }
    }
    return;
  }

  handleSwapNavigation(e);
});

function handleSwapNavigation(e: TouchEvent) {
  previewSlideEndX = e.changedTouches[0].clientX;
  const diff = previewSlideEndX - previewSlideStartX;

  if (diff > 0) {
    if (isOnRight) {
      mobileMoveToCenter(true);
      return;
    }
    enableElement(mobileBlackBg);
    if (isOnGuild) {
      enableElement("channel-info");
      enableElement("hash-sign");
    }

    mobileMoveToLeft();
  } else {
    disableElement(mobileBlackBg);

    if (isOnLeft) {
      chatContainer.style.flexDirection = "";
      mobileMoveToCenter(true);
    } else {
      if (!isOnMePage) {
        mobileMoveToCenter(true);
        mobileMoveToRight();
        enableElement(mobileBlackBg);

        if (isOnGuild) {
          enableElement("channel-info");
          enableElement("hash-sign");
        }
      }
      return;
    }

    channelList.classList.remove("visible");
    guildContainer.classList.remove("visible");
  }
}
function handleRightCenterCheck() {
  disableElement(mobileBlackBg);
  chatContainer.style.flexDirection = "";
}

export function handleMembersClick() {
  if (isOnLeft) {
    toggleHamburger(true, false);
    return;
  }
  isMobile ? toggleHamburger(false, !isOnLeft) : toggleUsersList();
}
export function toggleHamburger(toLeft: boolean, toRight: boolean) {
  if (!userList) {
    return;
  }

  if (isOnRight) {
    handleRightCenterCheck();

    mobileMoveToCenter();
    return;
  }
  if (isOnLeft && toRight) {
    handleRightCenterCheck();
    mobileMoveToCenter();
    return;
  }
  if (toRight) {
    if (!isOnMePage) {
      enableElement(mobileBlackBg);
      chatContainer.style.flexDirection = "column";
      toolbarOptions.style.zIndex = "";
      mobileMoveToRight();
    }
    return;
  }

  if (toLeft) {
    enableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "column";
    toolbarOptions.style.zIndex = "";

    mobileMoveToLeft();
  } else {
    mobileMoveToCenter();
  }
}
export function isOnCenter(): boolean {
  return !isOnLeft && !isOnRight;
}
function mobileMoveToRight() {
  if (!userList) {
    return;
  }
  isOnLeft = false;
  isOnRight = true;

  enableElement(userList);
  disableElement("channel-info");
  disableElement("hash-sign");

  getId("channelSearchInput")?.classList.add("search-input-mobile");
  document.querySelector(".close-button")?.classList.add("search-input-mobile");

  disableElement("scroll-to-bottom");
}

function mobileMoveToCenter(excludeChannelList: boolean = false) {
  if (!userList) {
    return;
  }
  console.log("move mobile to center");

  isOnRight = false;
  isOnLeft = false;
  disableElement(userList);
  if (excludeChannelList) {
    setTimeout(() => {
      disableElement(channelList);
    }, 100);
  } else {
    disableElement(channelList);
  }
  enableElement(chatInput);
  getId("guilds-list")?.classList.remove("guilds-list-mobile-left");
  getId("guild-container")?.classList.remove("guilds-list-mobile-left");
  getId("message-input-container")?.classList.remove(
    "message-input-container-mobile-left"
  );
  getId("channelSearchInput")?.classList.remove("search-input-mobile");
  document
    .querySelector(".close-button")
    ?.classList.remove("search-input-mobile");

  if (!isOnMePage) {
    enableElement(chatContainer);
  }
  guildContainer.classList.remove("visible");
  disableElement(horizontalLineGuild);

  chatContainer.classList.remove("chat-container-mobile-left");
  scrollToBottom();

  setTimeout(() => {
    scrollToBottom();
  }, 100);
  if (!isOnMePage) {
    enableElement("hash-sign");
    enableElement("channel-info");
  }
  disableElement(navigationBar);
  disableElement(mobileBlackBg);
}

function mobileMoveToLeft() {
  if (!userList) {
    return;
  }

  isOnLeft = true;
  isOnRight = false;
  disableElement(userList);
  disableElement("media-menu");
  disableElement("scroll-to-bottom");
  channelList.classList.remove("visible");
  guildContainer.classList.add("visible");
  enableElement(horizontalLineGuild);
  disableElement(chatInput);

  disableElement(chatContainer);
  chatContainer.classList.add("chat-container-mobile-left");
  getId("guilds-list")?.classList.add("guilds-list-mobile-left");
  getId("message-input-container")?.classList.add(
    "message-input-container-mobile-left"
  );

  enableElement(channelList, false, true);

  requestAnimationFrame(() => {
    channelList.classList.add("visible");
  });

  setTimeout(() => {
    getId("guild-container")?.classList.add("guilds-list-mobile-left");
    channelList.classList.add("channel-list-mobile-left");
  }, 200);

  enableElement(navigationBar);
}

channelList.classList.add("visible");
guildContainer.classList.add("visible");

addNavigationListeners();

export function initialiseMobile() {
  if (earphoneButton) {
    const earphoneParent = earphoneButton.parentElement;
    if (earphoneParent) {
      earphoneParent.remove();
    }
  }
  if (microphoneButton) {
    const microphoneParent = microphoneButton.parentElement;
    if (microphoneParent) {
      microphoneParent.remove();
    }
  }
  disableElement(selfName);
  disableElement("self-status");

  const friendIconSign = getId("friend-icon-sign");
  if (friendIconSign) {
    friendIconSign.style.position = "";
    friendIconSign.classList.add("navigationButton");
    navigationBar.appendChild(friendIconSign);

    const svgElement = friendIconSign.querySelector("svg") as SVGElement;
    if (svgElement) {
      svgElement.style.width = "30px";
      svgElement.style.height = "30px";
    }
  }

  const settingsButton = getId("settings-button");
  if (settingsButton) {
    navigationBar.appendChild(settingsButton);
    settingsButton.classList.add("navigationButton");

    const svgElement = settingsButton.querySelector("svg") as SVGElement;
    if (svgElement) {
      svgElement.style.width = "30px";
      svgElement.style.height = "30px";
    }
  }
  const avatarWrapper = getId("avatar-wrapper");
  if (avatarWrapper) {
    navigationBar.appendChild(avatarWrapper);
    avatarWrapper.classList.add("navigationButton");
  }
  initialiseListeners();
  if (isMobile) {
    setTimeout(() => {
      toggleHamburger(true, false);
    }, 0);
  }
}
function initialiseListeners() {
  const tbHamburger = getId("tb-hamburger");
  tbHamburger?.addEventListener("click", () => toggleHamburger(true, false));
  mobileBlackBg.addEventListener("click", () => {
    toggleHamburger(!isOnLeft, !isOnRight);
  });
}
function updateDmContainers() {
  const par = getId("dm-container-parent");

  if (par) {
    const dmContainers = par.querySelectorAll(".dm-container");
    const width = getCurrentWidth();

    dmContainers.forEach((el) => {
      if (el instanceof HTMLDivElement) {
        (el as HTMLElement).style.width = `${width + 70}px`;
      }
    });
  }
}
function updateUIWidths(newWidth: number) {
  const hashSign = getId("hash-sign");
  if (hashSign) {
    hashSign.style.left = `${newWidth + 180}px`;
  }

  const chanInfo = getId("channel-info");
  if (chanInfo) {
    chanInfo.style.marginLeft = `${newWidth + 200}px`;
  }

  const panel = getId("user-info-panel");
  if (panel) {
    panel.style.width = `${newWidth + 115}px`;
  }

  const input = getId("global-search-input");
  if (input) {
    input.style.width = `${newWidth + 83}px`;
  }

  const fileBtn = getId("file-button");
  if (fileBtn) {
    fileBtn.style.left = `${newWidth + 200}px`;
  }
  const profsign = getId("dm-profile-sign");
  if (profsign) {
    profsign.style.left = `${newWidth + 180}px`;
  }

  const bubble = getId("dm-profile-sign-bubble");
  if (bubble) {
    bubble.style.left = `${newWidth + 195}px`;
  }

  const infoContainer = getId("channel-info-container-for-friend");
  if (infoContainer) {
    infoContainer.style.paddingLeft = isMobile ? "40px" : `${newWidth + 20}px`;
  }

  updateDmContainers();
}

export function setAllWidths(newWidth: number) {
  setWidths(newWidth);
  updateUIWidths(newWidth);
}

export const clamp = (width: number) => Math.min(Math.max(width, 100), 260);

const defaultWidth = 150;
export function getCurrentWidth(): number {
  const savedWidth = localStorage.getItem("channelListWidth");
  const initialWidth = savedWidth
    ? clamp(parseInt(savedWidth, 10))
    : isMobile
      ? -510
      : defaultWidth;

  return isMobile ? 150 : initialWidth;
}
export const handleResizeWidth = () => {
  if (!channelList) {
    return;
  }

  const computedStyle = window.getComputedStyle(channelList);
  const currentWidth = clamp(parseInt(computedStyle.width, 10));
  setAllWidths(currentWidth);
  localStorage.setItem("channelListWidth", currentWidth.toString());
};

export function initialiseChannelDrag() {
  if (!channelList) {
    return;
  }

  setAllWidths(getCurrentWidth());
  setTimeout(() => {
    handleResizeWidth();
  }, 0);

  window.addEventListener("resize", debounce(handleResize, defaultWidth));

  if (channelList) {
    channelList.addEventListener("mousedown", (e) => {
      let isDraggingChannel = true;
      const startXChannel = e.clientX;
      const computedStyle = window.getComputedStyle(channelList);
      const startWidth = clamp(parseInt(computedStyle.width, 10));

      document.body.style.userSelect = "none";

      const onMouseMove = (event: MouseEvent) => {
        if (!isDraggingChannel) {
          return;
        }

        const newWidth = clamp(startWidth + (event.clientX - startXChannel));
        setAllWidths(newWidth);
      };

      const onMouseUp = () => {
        isDraggingChannel = false;
        setTimeout(() => {
          setAllWidths(getCurrentWidth());
        }, 50);

        const computed = window.getComputedStyle(channelList);
        const finalWidth = clamp(parseInt(computed.width, 10));
        localStorage.setItem("channelListWidth", finalWidth.toString());
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
}
document.addEventListener("dragstart", (e: DragEvent) => {
  const target = e.target as HTMLElement | null;
  if (target?.tagName === "IMG") {
    e.preventDefault();
  }
});
