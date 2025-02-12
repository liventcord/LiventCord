//ui.js
import DOMPurify from "dompurify";
import {
  enableUserList,
  setUserListLine,
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
import { leaveCurrentGuild, wrapWhiteRod } from "./guild.ts";
import { createEl, getId, disableElement, enableElement } from "./utils.ts";
import { translations } from "./translations.ts";
import { handleMediaPanelResize } from "./mediaPanel.ts";
import { isOnMe, router } from "./router.ts";
import { permissionManager } from "./guildPermissions.ts";
import { observe } from "./chat.ts";
import { chatContainer } from "./chatbar.ts";

export const textChanHtml =
  '<svg class="icon_d8bfb3" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>';
export const voiceChanHtml =
  '<svg class="icon_d8bfb3" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z" class=""></path><path fill="currentColor" d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z" class=""></path></svg>';
export const inviteHtml =
  '<svg class="actionIcon_f6f816" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M14.5 8a3 3 0 1 0-2.7-4.3c-.2.4.06.86.44 1.12a5 5 0 0 1 2.14 3.08c.01.06.06.1.12.1ZM16.62 13.17c-.22.29-.65.37-.92.14-.34-.3-.7-.57-1.09-.82-.52-.33-.7-1.05-.47-1.63.11-.27.2-.57.26-.87.11-.54.55-1 1.1-.92 1.6.2 3.04.92 4.15 1.98.3.27-.25.95-.65.95a3 3 0 0 0-2.38 1.17ZM15.19 15.61c.13.16.02.39-.19.39a3 3 0 0 0-1.52 5.59c.2.12.26.41.02.41h-8a.5.5 0 0 1-.5-.5v-2.1c0-.25-.31-.33-.42-.1-.32.67-.67 1.58-.88 2.54a.2.2 0 0 1-.2.16A1.5 1.5 0 0 1 2 20.5a7.5 7.5 0 0 1 13.19-4.89ZM9.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 22Z" class=""></path><path fill="currentColor" d="M19 14a1 1 0 0 1 1 1v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Z" class=""></path></svg>';
export const settingsHtml =
  '<svg class="actionIcon_f6f816" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clip-rule="evenodd" class=""></path></svg>';
export const muteHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m2.7 22.7 20-20a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4ZM10.8 17.32c-.21.21-.1.58.2.62V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 0 0-2 0c0 1.45-.52 2.79-1.38 3.83l-.02.02A5.99 5.99 0 0 1 12.32 16a.52.52 0 0 0-.34.15l-1.18 1.18ZM15.36 4.52c.15-.15.19-.38.08-.56A4 4 0 0 0 8 6v4c0 .3.03.58.1.86.07.34.49.43.74.18l6.52-6.52ZM5.06 13.98c.16.28.53.31.75.09l.75-.75c.16-.16.19-.4.08-.61A5.97 5.97 0 0 1 6 10a1 1 0 0 0-2 0c0 1.45.39 2.81 1.06 3.98Z" class=""></path></svg>';
export const inviteVoiceHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a1 1 0 1 0-2 0v8H3a1 1 0 1 0 0 2h8v8a1 1 0 0 0 2 0v-8h8a1 1 0 0 0 0-2h-8V3Z" class=""></path></svg>';
export const selectedChanColor = "rgb(64, 66, 73)";
export const hoveredChanColor = "rgb(53, 55, 60";

const activeIconHref = "/images/icons/iconactive.png";
const inactiveIconHref = "/images/icons/icon.png";
const favicon = getId("favicon") as HTMLAnchorElement;

export let loadingScreen;
export function enableLoadingScreen() {
  loadingScreen = createEl("div", { id: "loading-screen" });
  document.body.appendChild(loadingScreen);
  const loadingElement = createEl("img", { id: "loading-element" });
  loadingScreen.appendChild(loadingElement);
  loadingElement.src = "/images/icons/icon.png";
}
export function isLoadingScreen() {
  if (!loadingScreen) {
    return false;
  }
  return loadingScreen.style.display === "flex";
}

let isEmailToggled = false;
export function toggleEmail() {
  const eyeIcon = getId("set-info-email-eye");
  isEmailToggled = !isEmailToggled;
  getId("set-info-email").textContent = isEmailToggled
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

export function handleToggleClick(toggleElement, toggleClickCallback) {
  toggleElement.addEventListener("click", function () {
    this.classList.toggle("active");
    this.querySelector(".toggle-switch").classList.toggle("active");
    toggleClickCallback();
  });
}

export function handleResize() {
  handleMediaPanelResize();

  if (window.innerWidth < 1200) {
    if (isOnMe) {
      disableElement(userList);
      disableElement(userLine);
    } else {
      setUserListLine();
    }
  } else {
    enableUserList();
  }

  const inputRightToSet = userList.style.display === "flex" ? "463px" : "76px";
  const addFriendInputButton = getId("addfriendinputbutton");
  if (addFriendInputButton) {
    addFriendInputButton.style.right = inputRightToSet;
  }
}

export function loadMainToolbar() {
  disableElement("tb-call");
  disableElement("tb-video-call");
  disableElement("tb-pin");
  disableElement("tb-createdm");
  disableElement("tb-showprofile");
  disableElement("tb-search");
}
export function loadGuildToolbar() {
  disableElement("tb-call");
  disableElement("tb-video-call");
  enableElement("tb-pin");
  disableElement("tb-createdm");
  enableElement("tb-showprofile");
  enableElement("tb-search");
}
export function loadDmToolbar() {
  enableElement("tb-call");
  enableElement("tb-video-call");
  enableElement("tb-pin");
  enableElement("tb-createdm");
  enableElement("tb-showprofile");
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

export function isProfilePopOpen() {
  return Boolean(getId("profilePopContainer"));
}

export function hideLoadingScreen() {
  loadingScreen.style.display = "none";
}

//Generic

let errorCount = 0;

function createPopupContent(
  includeCancel = false,
  subject,
  content,
  buttonText,
  acceptCallback?: () => void,
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
    id: null
  });

  if (includeCancel) {
    const popRefuseButton = createEl("button", {
      className: "pop-up-refuse",
      textContent: translations.getTranslation("cancel")
    });

    buttonContainer.appendChild(popRefuseButton);
    popRefuseButton.addEventListener("click", function () {
      closePopUp(outerParent, outerParent.firstChild);
    });
  }
  buttonContainer.appendChild(popAcceptButton);

  popAcceptButton.addEventListener("click", function () {
    if (acceptCallback) acceptCallback();
    closePopUp(outerParent, outerParent.firstChild);
  });

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
    content,
    translations.getTranslation("ok")
  );

  outerParent.style.zIndex = 1000 + errorCount;
  errorCount++;
}

export function askUser(
  subject,
  content,
  actionText,
  acceptCallback,
  isRed = false
) {
  createPopupContent(true, subject, content, actionText, acceptCallback, isRed);
}
let logoClicked = 0;

export function clickMainLogo(logo) {
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

export const preventDrag = (elementId) => {
  const element = getId(elementId);
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
export function beautifyJson(jsonData) {
  try {
    const beautifiedJson = JSON.stringify(jsonData, null, "\t");
    return beautifiedJson;
  } catch (error) {
    console.error("Error beautifying JSON:", error);
    return null;
  }
}
getId("image-preview-container").addEventListener(
  "click",
  hideImagePreviewRequest
);
export function displayImagePreview(sourceimage: string): void {
  enableElement("image-preview-container");
  const previewImage = getId("preview-image") as HTMLImageElement;
  previewImage.style.animation = "preview-image-animation 0.2s forwards";
  const sanitizedSourceImage = DOMPurify.sanitize(sourceimage);
  previewImage.src = sanitizedSourceImage;
  updateCurrentIndex(sanitizedSourceImage);

  let isPreviewZoomed = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const container = getId("image-preview-container") as HTMLElement;

  function toggleZoom() {
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
      previewImage.style.left = "50%";
      previewImage.style.top = "50%";
      previewImage.style.transform = "translate(-50%, -50%)";
      previewImage.style.width = "";
      previewImage.style.height = "";
    }
  }

  previewImage.addEventListener("click", () => {
    toggleZoom();
  });

  const previewOpenButton = getId("preview-image-open") as HTMLButtonElement;
  if (previewOpenButton) {
    previewOpenButton.replaceWith(previewOpenButton.cloneNode(true));
    const newPreviewOpenButton = getId(
      "preview-image-open"
    ) as HTMLButtonElement;

    newPreviewOpenButton.addEventListener("click", () => {
      if (sanitizedSourceImage) {
        window.open(sanitizedSourceImage, "_blank");
      }
    });
  }

  const previewZoomButton = getId("preview-image-zoom") as HTMLButtonElement;
  if (previewZoomButton) {
    previewZoomButton.addEventListener("click", () => {
      toggleZoom();
    });
  }

  previewImage.addEventListener("mousedown", (event) => {
    if (event.button === 1 && isPreviewZoomed) {
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

      const maxX = container.clientWidth - previewImage.width;
      const maxY = container.clientHeight - previewImage.height;

      const clampedX = Math.min(Math.max(newX, 0), maxX);
      const clampedY = Math.min(Math.max(newY, 0), maxY);

      previewImage.style.left = `${clampedX}px`;
      previewImage.style.top = `${clampedY}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function isImagePreviewOpen() {
  return getId("image-preview-container").style.display === "flex";
}
let currentPreviewIndex = 0;

function addNavigationListeners() {
  document.addEventListener("keydown", (event) => {
    if (isImagePreviewOpen()) {
      const chatImages = Array.from(
        chatContainer.querySelectorAll(".chat-image")
      ).filter(
        (img) => (img as HTMLImageElement).src !== ""
      ) as HTMLImageElement[];

      if (event.key === "ArrowRight") {
        moveToNextImage(chatImages);
      } else if (event.key === "ArrowLeft") {
        moveToPreviousImage(chatImages);
      }
    }
  });
}

function movePreviewImg(chatImages: HTMLImageElement[]) {
  if (chatImages[currentPreviewIndex]) {
    displayImagePreview(chatImages[currentPreviewIndex].src);
  }
}

function moveToNextImage(chatImages: HTMLImageElement[]) {
  currentPreviewIndex = (currentPreviewIndex + 1) % chatImages.length;
  movePreviewImg(chatImages);
}

function moveToPreviousImage(chatImages: HTMLImageElement[]) {
  currentPreviewIndex =
    (currentPreviewIndex - 1 + chatImages.length) % chatImages.length;
  movePreviewImg(chatImages);
}
function updateCurrentIndex(sourceimg: string) {
  const chatImages = Array.from(
    chatContainer.querySelectorAll(".chat-image")
  ).filter((img) => (img as HTMLImageElement).src !== "") as HTMLImageElement[];

  const newIndex = chatImages.findIndex((img) => img.src === sourceimg);
  if (newIndex !== -1) {
    currentPreviewIndex = newIndex;
  }
}

addNavigationListeners();

export function displayJsonPreview(sourceJson) {
  const jsonPreviewContainer = getId("json-preview-container");

  jsonPreviewContainer.style.display = "flex";
  const jsonPreviewElement = getId("json-preview-element");

  jsonPreviewElement.dataset.content_observe = sourceJson;
  jsonPreviewElement.style.userSelect = "text";
  jsonPreviewElement.style.whiteSpace = "pre-wrap";
  observe(jsonPreviewElement);
}

export function hideImagePreviewRequest(event) {
  if (event.target.id === "image-preview-container") {
    hideImagePreview();
  }
}
export function hideImagePreview() {
  const previewImage = getId("preview-image") as HTMLImageElement;
  previewImage.style.animation =
    "preview-image-disappear-animation 0.15s forwards";
  setTimeout(() => {
    disableElement("image-preview-container");

    previewImage.src = "";
  }, 150);
}

export function hideJsonPreview(event) {
  if (event.target.id === "json-preview-container") {
    const jsonPreviewContainer = getId("json-preview-container");
    jsonPreviewContainer.style.display = "none";
  }
}

export function openGuildSettingsDd(event) {
  const handlers = {
    "invite-dropdown-button": createInviteUsersPop,
    "settings-dropdown-button": () => {
      openSettings(SettingType.GUILD);
    },
    "channel-dropdown-button": createChannelsPop,
    "exit-dropdown-button": () => {
      askUser(
        translations.getTranslation("exit-dropdown-button"),
        translations.getTranslation("leave-guild-detail"),
        translations.getTranslation("leave-from-guild"),
        leaveCurrentGuild
      );
    }
  };

  const clicked_id = event.target.id;
  toggleDropdown();

  if (handlers[clicked_id]) {
    handlers[clicked_id]();
  }
}
function setDynamicAnimations() {
  const dynamicAnimElements =
    "#tb-inbox, #tb-pin, #tb-showprofile, #tb-help, #tb-call, #tb-video-call, #tb-createdm, #hash-sign, #gifbtn, #friend-icon-sign, #friendiconsvg, #earphone-button, #microphone-button";

  document.querySelectorAll(dynamicAnimElements).forEach(function (element) {
    element.addEventListener("mousemove", function (event: MouseEvent) {
      const rect = (element as HTMLElement).getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const distanceX = (mouseX - centerX) / centerX;
      const distanceY = (mouseY - centerY) / centerY;

      const shakeIntensity = Math.max(Math.abs(distanceX), Math.abs(distanceY));

      (element as HTMLElement).style.transform = `rotate(${
        shakeIntensity * (distanceX < 0 ? -1 : 1)
      }deg) translate(${distanceX * 3}px, ${distanceY * 3}px)`;
    });

    element.addEventListener("mouseleave", function () {
      (element as HTMLElement).style.transform = "rotate(0deg) translate(0, 0)";
    });
  });
}

setDynamicAnimations();
