import {
  getId,
  isMobile,
  disableElement,
  enableElement,
  $,
  onDoc
} from "./utils.ts";
import { disableSelfName } from "./avatar.ts";
import { isOnGuild, isOnMePage } from "./router.ts";
import { scrollToBottom } from "./chat.ts";
import { earphoneButton, microphoneButton } from "./audio.ts";
import { chatContainer, chatInput } from "./chatbar.ts";
import { isImagePreviewOpen, navigatePreviewBySwipe } from "./imagePreview.ts";
import { toggleUsersList } from "./userList.ts";

const mobileBlackBg = getId("mobile-black-bg") as HTMLElement;
const navigationBar = getId("navigation-bar") as HTMLElement;
const channelList = getId("channel-list") as HTMLElement;
const guildContainer = getId("guild-container") as HTMLElement;
const horizontalLineGuild = getId("horizontal-line-guild") as HTMLElement;
const toolbarOptions = getId("toolbaroptions") as HTMLElement;

let _isOnLeft = false;
let _isOnRight = false;

export const isOnLeft = () => _isOnLeft;
export const isOnRight = () => _isOnRight;
export const isOnCenter = () => !_isOnLeft && !_isOnRight;

// --- Swipe detection

let previewSlideStartX = 0;
let previewSlideEndX = 0;
const SWIPE_THRESHOLD = 50;

function initSwipeListeners(
  getChatContent: () => HTMLElement,
  getMediaGrid: () => HTMLElement
): void {
  onDoc("touchstart", (e) => {
    previewSlideStartX = e.touches[0].clientX;
  });

  onDoc("touchend", (e) => {
    previewSlideEndX = e.changedTouches[0].clientX;
    const diff = previewSlideEndX - previewSlideStartX;

    if (Math.abs(diff) < SWIPE_THRESHOLD) return;

    if (isImagePreviewOpen()) {
      navigatePreviewBySwipe(
        diff > 0 ? "prev" : "next",
        getChatContent(),
        getMediaGrid()
      );
      return;
    }

    handleSwapNavigation(diff);
  });
}

function handleSwapNavigation(diff: number): void {
  if (diff > 0) {
    if (_isOnRight) {
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
    if (_isOnLeft) {
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

// --- Movement helpers

function mobileMoveToRight(): void {
  const userList = getId("user-list") as HTMLElement;
  if (!userList) return;

  _isOnLeft = false;
  _isOnRight = true;

  enableElement(userList);
  disableElement("channel-info");
  disableElement("hash-sign");
  disableElement("scroll-to-bottom");

  getId("channelSearchInput")?.classList.add("search-input-mobile");
  $(".close-button")?.classList.add("search-input-mobile");
}

export function mobileMoveToCenter(excludeChannelList = false): void {
  const userList = getId("user-list") as HTMLElement;
  if (!userList) return;

  _isOnRight = false;
  _isOnLeft = false;

  disableElement(userList);
  if (excludeChannelList) {
    setTimeout(() => disableElement(channelList), 100);
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

  if (!isOnMePage) enableElement(chatContainer);

  guildContainer.classList.remove("visible");
  disableElement(horizontalLineGuild);
  chatContainer.classList.remove("chat-container-mobile-left");

  scrollToBottom();
  setTimeout(scrollToBottom, 100);

  if (!isOnMePage) {
    enableElement("hash-sign");
    enableElement("channel-info");
  }

  disableElement(navigationBar);
  disableElement(mobileBlackBg);
}

function mobileMoveToLeft(): void {
  const userList = getId("user-list") as HTMLElement;
  if (!userList) return;

  _isOnLeft = true;
  _isOnRight = false;

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
  requestAnimationFrame(() => channelList.classList.add("visible"));

  setTimeout(() => {
    getId("guild-container")?.classList.add("guilds-list-mobile-left");
    channelList.classList.add("channel-list-mobile-left");
  }, 200);

  enableElement(navigationBar);
}

// --- Hamburger toggle

export function toggleHamburger(toLeft: boolean, toRight: boolean): void {
  const userList = getId("user-list") as HTMLElement;
  if (!userList) return;

  if (_isOnRight) {
    disableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "";
    mobileMoveToCenter();
    return;
  }

  if (_isOnLeft && toRight) {
    disableElement(mobileBlackBg);
    chatContainer.style.flexDirection = "";
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

export function handleMembersClick(): void {
  if (_isOnLeft) {
    toggleHamburger(true, false);
    return;
  }
  isMobile ? toggleHamburger(false, !_isOnLeft) : toggleUsersList();
}

// --- Navigation bar setup

export function initialiseMobile(): void {
  [earphoneButton, microphoneButton].forEach((btn) =>
    btn?.parentElement?.remove()
  );

  disableSelfName();
  disableElement("self-status");

  const moveToNav = (id: string, extraClass?: string) => {
    const el = getId(id);
    if (!el) return;
    navigationBar.appendChild(el);
    if (extraClass) el.classList.add(extraClass);
    const svg = el.querySelector("svg") as SVGElement | null;
    if (svg) {
      svg.style.width = "30px";
      svg.style.height = "30px";
    }
  };

  moveToNav("friend-icon-sign", "navigationButton");
  const friendIcon = getId("friend-icon-sign");
  if (friendIcon) {
    friendIcon.style.position = "";
  }

  moveToNav("settings-button", "navigationButton");

  const avatarWrapper = getId("avatar-wrapper");
  if (avatarWrapper) {
    navigationBar.appendChild(avatarWrapper);
    avatarWrapper.classList.add("navigationButton");
  }

  initHamburgerListeners();

  setTimeout(() => toggleHamburger(true, false), 0);
}

function initHamburgerListeners(): void {
  getId("tb-hamburger")?.addEventListener("click", () =>
    toggleHamburger(true, false)
  );
  mobileBlackBg.addEventListener("click", () =>
    toggleHamburger(!_isOnLeft, !_isOnRight)
  );
}

export function initMobileSwipe(
  getChatContent: () => HTMLElement,
  getMediaGrid: () => HTMLElement
): void {
  initSwipeListeners(getChatContent, getMediaGrid);
}
