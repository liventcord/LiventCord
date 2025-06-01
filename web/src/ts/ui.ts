//ui.js
import DOMPurify from "dompurify";
import {
  activityList,
  isUsersOpenGlobal,
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
  getFileNameFromUrl
} from "./utils.ts";
import { translations } from "./translations.ts";
import { handleMediaPanelResize } from "./mediaPanel.ts";
import { isOnGuild, isOnMePage, router } from "./router.ts";
import { permissionManager } from "./guildPermissions.ts";
import { observe, scrollToMessage, updateChatWidth } from "./chat.ts";
import { apiClient, EventType } from "./api.ts";
import { guildCache } from "./cache.ts";
import { changePassword, userManager } from "./user.ts";
import {
  chatContainer,
  chatContent,
  FileHandler,
  showReplyMenu
} from "./chatbar.ts";
import {
  attachmentPattern,
  getProxy,
  isImageSpoilered,
  setImageUnspoilered
} from "./mediaElements.ts";
import { selfName, setProfilePic } from "./avatar.ts";
import { createTooltip } from "./tooltip.ts";
import { pinMessage } from "./contextMenuActions.ts";
import { earphoneButton, microphoneButton } from "./audio.ts";

export const textChanHtml =
  '<svg class="icon_d8bfb3" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>';
export const muteHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m2.7 22.7 20-20a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4ZM10.8 17.32c-.21.21-.1.58.2.62V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 0 0-2 0c0 1.45-.52 2.79-1.38 3.83l-.02.02A5.99 5.99 0 0 1 12.32 16a.52.52 0 0 0-.34.15l-1.18 1.18ZM15.36 4.52c.15-.15.19-.38.08-.56A4 4 0 0 0 8 6v4c0 .3.03.58.1.86.07.34.49.43.74.18l6.52-6.52ZM5.06 13.98c.16.28.53.31.75.09l.75-.75c.16-.16.19-.4.08-.61A5.97 5.97 0 0 1 6 10a1 1 0 0 0-2 0c0 1.45.39 2.81 1.06 3.98Z" class=""></path></svg>';
export const inviteVoiceHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a1 1 0 1 0-2 0v8H3a1 1 0 1 0 0 2h8v8a1 1 0 0 0 2 0v-8h8a1 1 0 0 0 0-2h-8V3Z" class=""></path></svg>';
export const selectedChanColor = "rgb(64, 66, 73)";
export const hoveredChanColor = "rgb(53, 55, 60";

const activeIconHref = "/icons/iconactive.webp";
const inactiveIconHref = "/icons/icon.webp";
const favicon = getId("favicon") as HTMLAnchorElement;
let isAddedDragListeners = false;
const imagePreviewContainer = getId(
  "image-preview-container"
) as HTMLImageElement;
if (imagePreviewContainer) {
  imagePreviewContainer.addEventListener("click", hideImagePreviewRequest);
}

export let loadingScreen: HTMLElement;
function enableLoadingScreen() {
  loadingScreen = createEl("div", { id: "loading-screen" });
  document.body.appendChild(loadingScreen);
  const loadingElement = createEl("img", {
    id: "loading-element"
  }) as HTMLImageElement;
  loadingScreen.appendChild(loadingElement);
  loadingElement.src = "/icons/icon.webp";
}
function isLoadingScreen() {
  if (!loadingScreen) {
    return false;
  }
  return loadingScreen.style.display === "flex";
}

let isEmailToggled = false;
export function toggleEmail() {
  const eyeIcon = getId("set-info-email-eye") as HTMLElement;
  const emailIcon = getId("set-info-email") as HTMLElement;
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
  if (!userList) return;

  const isSmallScreen = window.innerWidth < 1200;
  setUserListLine();

  if (isSmallScreen) {
    if (!isMobile) {
      disableElement(userList);
      if (userLine) disableElement(userLine);
      if (activityList) disableElement(activityList);
    }
  } else {
    console.log(isUsersOpenGlobal);
    if (isOnMePage) {
      if (activityList) enableElement(activityList);
    } else {
      if (activityList) disableElement(activityList);
    }
  }
  updateChatWidth();

  const inputRightToSet = userList.style.display === "flex" ? "463px" : "76px";
  const addFriendInputButton = getId("addfriendinputbutton");
  if (addFriendInputButton) addFriendInputButton.style.right = inputRightToSet;
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

function isProfilePopOpen() {
  return Boolean(getId("profilePopContainer"));
}

function hideLoadingScreen() {
  loadingScreen.style.display = "none";
}

//Generic

let errorCount = 0;

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
    if (acceptCallback) acceptCallback();
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

export function alertUser(subject: string, content?: string): void {
  if (!content && subject) {
    content = subject;
  }
  if (content) {
    console.error(subject, content);
  } else {
    console.error(subject);
  }

  const outerParent = createPopupContent(
    false,
    subject,
    content ?? "",
    translations.getTranslation("ok")
  );

  outerParent.style.zIndex = "1000" + errorCount;
  errorCount++;
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
  }) as HTMLParagraphElement;
  currentPasswordInputTitle.classList.add("password-title");

  const currentInput = createEl("input", {
    id: "current-password-input",
    type: "password"
  }) as HTMLInputElement;
  currentInput.classList.add("password-input");

  const newInput = createEl("input", {
    id: "new-password-input",
    type: "password"
  }) as HTMLInputElement;
  newInput.classList.add("password-input");

  const newPasswordInputTitle = createEl("p", {
    id: "new-password-input-title",
    textContent: newPassword
  }) as HTMLParagraphElement;
  newPasswordInputTitle.classList.add("password-title");

  const newPasswordConfirmTitle = createEl("p", {
    id: "new-password-input-confirm-title",
    textContent: newPasswordConfirm
  }) as HTMLParagraphElement;
  newPasswordConfirmTitle.classList.add("password-title");

  const newInputConfirm = createEl("input", {
    id: "new-password-input-confirm",
    type: "password"
  }) as HTMLInputElement;
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

export const preventDrag = (element: HTMLElement) => {
  if (element) {
    element.addEventListener("dragstart", function (event) {
      event.preventDefault();
    });
  }
};

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
        if (imagesMessage) scrollToMessage(imagesMessage);
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
  }
}

let isPreviewZoomed = false;
let isDragging = false;
let startX = 0;
let startY = 0;

function toggleZoom() {
  console.error(isPreviewZoomed);
  const previewImage = getId("preview-image");
  if (!previewImage) return;
  isPreviewZoomed = !isPreviewZoomed;
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
}
function handlePreviewDownloadButton(sanitizedSourceImage: string) {
  const previewImageDownload = getId(
    "preview-image-download"
  ) as HTMLButtonElement;
  const previewImage = getId("preview-image") as HTMLImageElement;

  previewImageDownload.onclick = async () => {
    if (!sanitizedSourceImage) return;

    try {
      if (previewImage?.complete && previewImage.naturalWidth !== 0) {
        const canvas = createEl("canvas", {
          width: previewImage.naturalWidth,
          height: previewImage.naturalHeight
        }) as HTMLCanvasElement;

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

  previewOpenButton.onclick = () => {
    if (sanitizedSourceImage) {
      router.openLink(sanitizedSourceImage);
    }
  };
}
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    hideImagePreview();
  }
}
document.addEventListener("keydown", handleKeyDown);
export function displayImagePreview(
  imageElement: HTMLImageElement,
  senderId?: string,
  date?: Date,
  isSpoiler = false,
  isFromMediaPanel = false
): void {
  enableElement("image-preview-container");
  const previewImage = getId("preview-image") as HTMLImageElement;
  const sourceImage = getSourceImage(imageElement);
  const sanitizedSourceImage = DOMPurify.sanitize(sourceImage);

  previewImage.style.animation = "preview-image-animation 0.2s forwards";
  previewImage.src = getProxy(sanitizedSourceImage);
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

function getSourceImage(imageElement: HTMLImageElement): string {
  return (
    imageElement.dataset.originalSrc ||
    imageElement.getAttribute("data-original-src") ||
    imageElement.getAttribute("src") ||
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
  if (isAddedDragListeners) return;
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
        if (senderId && messageId) showReplyMenu(messageId, senderId);
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
      const newX = event.clientX - startX;
      const newY = event.clientY - startY;

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
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
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
  if (images.length === 0) return;

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
  if (images.length === 0) return;

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
    handlers[clickedId as keyof typeof handlers]();
  }
}

function setDynamicAnimations() {
  const dynamicAnimElements =
    "#tb-inbox, #tb-pin, #tb-show-members, #tb-help, #tb-call, #tb-video-call, #tb-createdm, #hash-sign, #gifbtn, #friend-icon-sign, #friendiconsvg, #earphone-button, #microphone-button";

  document.querySelectorAll(dynamicAnimElements).forEach(function (element) {
    if (element instanceof HTMLElement) {
      element.addEventListener("mousemove", function (event: MouseEvent) {
        const rect = element.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const distanceX = (mouseX - centerX) / centerX;
        const distanceY = (mouseY - centerY) / centerY;

        const shakeIntensity = Math.max(
          Math.abs(distanceX),
          Math.abs(distanceY)
        );

        element.style.transform = `rotate(${
          shakeIntensity * (distanceX < 0 ? -1 : 1)
        }deg) translate(${distanceX * 3}px, ${distanceY * 3}px)`;
      });

      element.addEventListener("mouseleave", function () {
        element.style.transform = "rotate(0deg) translate(0, 0)";
      });
    }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  if (!isMobile) {
    setDynamicAnimations();
  }
});

let previewSlideStartX = 0;
let previewSlideEndX = 0;

const channelList = getId("channel-list") as HTMLElement;

document.addEventListener("touchstart", (e: TouchEvent) => {
  previewSlideStartX = e.touches[0].clientX;
});

document.addEventListener("touchend", (e: TouchEvent) => {
  previewSlideEndX = e.changedTouches[0].clientX;
  const diff = previewSlideEndX - previewSlideStartX;

  if (Math.abs(diff) < 50) return;

  if (isImagePreviewOpen()) {
    if (diff > 50) {
      moveToPreviousImage();
    } else if (diff < -50) {
      moveToNextImage();
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
    disableElement("channel-info");
    disableElement("hash-sign");

    if (isOnLeft) {
      chatContainer.style.flexDirection = "";
      toolbarOptions.style.zIndex = "1";
      mobileMoveToCenter(true);
    } else {
      mobileMoveToCenter(true);
      mobileMoveToRight();
      enableElement(mobileBlackBg);
      if (isOnGuild) {
        enableElement("channel-info");
        enableElement("hash-sign");
      }
      return;
    }

    channelList.classList.remove("visible");
    guildContainer.classList.remove("visible");
  }
}
function handleRightCenterCheck() {
  if (isOnLeft) {
    disableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "";
    toolbarOptions.style.zIndex = "1";

    mobileMoveToCenter();
  }
  return isOnLeft;
}
let isOnLeft = false;
let isOnRight = false;
const mobileBlackBg = getId("mobile-black-bg") as HTMLElement;
const toolbarOptions = getId("toolbaroptions") as HTMLElement;
const navigationBar = getId("navigation-bar") as HTMLElement;
export function handleMembersClick() {
  if (isOnLeft) {
    toggleHamburger(true, false);
    return;
  }
  isMobile ? toggleHamburger(false, !isOnLeft) : toggleUsersList();
}
export function toggleHamburger(toLeft: boolean, toRight: boolean) {
  if (!userList) return;

  if (isOnRight) {
    disableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "";
    toolbarOptions.style.zIndex = "1";

    mobileMoveToCenter();
    return;
  }
  if (isOnLeft && toRight) {
    disableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "";
    toolbarOptions.style.zIndex = "1";

    mobileMoveToCenter();
    return;
  }
  if (toRight) {
    enableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "column";
    toolbarOptions.style.zIndex = "";

    mobileMoveToRight();
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
  if (!userList) return;
  isOnLeft = false;
  isOnRight = true;

  enableElement(userList);
  disableElement("scroll-to-bottom");
}

function mobileMoveToCenter(excludeChannelList: boolean = false) {
  if (!userList) return;

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
  getId("guilds-list")?.classList.remove("guilds-list-mobile-left");
  getId("guild-container")?.classList.remove("guilds-list-mobile-left");
  getId("message-input-container")?.classList.remove(
    "message-input-container-mobile-left"
  );

  enableElement(chatContainer);

  guildContainer.classList.remove("visible");

  chatContainer.classList.remove("chat-container-mobile-left");
  if (isOnGuild) {
    enableElement("hash-sign");
    enableElement("channel-info");
  }
  disableElement(navigationBar);

  disableElement(mobileBlackBg);
}

function mobileMoveToLeft() {
  if (!userList) return;

  isOnLeft = true;
  isOnRight = false;
  disableElement(userList);
  disableElement("media-menu");
  disableElement("scroll-to-bottom");
  channelList.classList.remove("visible");
  guildContainer.classList.add("visible");
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
  const tbPinMessage = getId("tb-pin");
  tbPinMessage?.addEventListener("click", () => {
    pinMessage("");
  });
  const tbHamburger = getId("tb-hamburger");
  tbHamburger?.addEventListener("click", () => toggleHamburger(true, false));
  mobileBlackBg.addEventListener("click", () => {
    toggleHamburger(!isOnLeft, !isOnRight);
  });
}
