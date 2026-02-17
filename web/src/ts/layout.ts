import {
  getId,
  isMobile,
  disableElement,
  enableElement,
  debounce,
  IMAGE_SRCS
} from "./utils.ts";
import { setWidths } from "./channels.ts";
import { handleMediaPanelResize } from "./mediaPanel.ts";
import { updateChatWidth } from "./chat.ts";
import {
  setUserListLine,
  activityList,
  userLine,
  userList
} from "./userList.ts";
import { isOnMePage } from "./router.ts";
import { permissionManager } from "./guildPermissions.ts";

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 100;
const MAX_WIDTH = 260;

export const clamp = (width: number): number =>
  Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH);

export function getCurrentWidth(): number {
  const saved = localStorage.getItem("channelListWidth");
  if (isMobile) return -510;
  return saved ? clamp(parseInt(saved, 10)) : DEFAULT_WIDTH;
}

function saveWidth(width: number): void {
  localStorage.setItem("channelListWidth", width.toString());
}

// --- Toolbar helpers

function handleMobileToolbar(): void {
  getId("toolbaroptions")
    ?.querySelectorAll(".iconWrapper")
    .forEach((el) => {
      el.classList.add("toolbarIconMobile");
    });
}

export function loadMainToolbar(): void {
  if (isMobile) handleMobileToolbar();
  [
    "tb-hamburger",
    "tb-call",
    "tb-video-call",
    "tb-pin",
    "tb-createdm",
    "tb-show-members",
    "tb-search"
  ].forEach(disableElement);
}

export function loadGuildToolbar(): void {
  if (isMobile) {
    handleMobileToolbar();
    enableElement("tb-hamburger");
  } else disableElement("tb-hamburger");

  disableElement("tb-call");
  disableElement("tb-video-call");
  enableElement("tb-pin");
  disableElement("tb-createdm");
  enableElement("tb-show-members");
  enableElement("tb-search");
}

export function loadDmToolbar(): void {
  if (isMobile) {
    handleMobileToolbar();
    enableElement("tb-hamburger");
  } else disableElement("tb-hamburger");

  enableElement("tb-call");
  enableElement("tb-video-call");
  enableElement("tb-pin");
  enableElement("tb-createdm");
  enableElement("tb-show-members");
  enableElement("tb-search");
}

// --- Guild dropdown

export function fillDropDownContent(): void {
  const canManage = permissionManager.canManageChannels();
  canManage
    ? enableElement("channel-dropdown-button")
    : disableElement("channel-dropdown-button");
  canManage
    ? enableElement("invite-dropdown-button")
    : disableElement("invite-dropdown-button");
  permissionManager.isSelfOwner()
    ? disableElement("exit-dropdown-button")
    : enableElement("exit-dropdown-button");
}

// --- UI width sync

function updateUIWidths(newWidth: number): void {
  const set = (id: string, prop: string, value: string) => {
    const el = getId(id);
    if (el) (el.style as any)[prop] = value;
  };

  set("hash-sign", "left", `${newWidth + 180}px`);
  set("channel-info", "marginLeft", `${newWidth + 200}px`);
  set("user-info-panel", "width", `${newWidth + 115}px`);
  set("global-search-input", "width", `${newWidth + 83}px`);
  set("file-button", "left", `${newWidth + 200}px`);
  set("dm-profile-sign", "left", `${newWidth + 180}px`);
  set("dm-profile-sign-bubble", "left", `${newWidth + 195}px`);

  const infoContainer = getId("channel-info-container-for-friend");
  if (infoContainer) {
    infoContainer.style.paddingLeft = isMobile ? "40px" : `${newWidth + 20}px`;
  }

  updateDmContainers(newWidth);
}

function updateDmContainers(width: number): void {
  const par = getId("dm-container-parent");
  if (!par) return;
  par.querySelectorAll<HTMLDivElement>(".dm-container").forEach((el) => {
    el.style.width = `${width + 70}px`;
  });
}

export function setAllWidths(newWidth: number): void {
  setWidths(newWidth);
  updateUIWidths(newWidth);
}

// --- Resize handler

export function handleResize(): void {
  handleMediaPanelResize();
  if (!userList) return;

  setWidths(getCurrentWidth());
  setUserListLine();

  const isSmallScreen = window.innerWidth < 600;
  if (isSmallScreen) {
    if (!isMobile) {
      disableElement(userList);
      if (userLine) disableElement(userLine);
      if (activityList) disableElement(activityList);
    }
  } else {
    if (activityList) {
      isOnMePage ? enableElement(activityList) : disableElement(activityList);
    }
  }

  updateChatWidth();

  const inputRightToSet = userList.style.display === "flex" ? "463px" : "76px";
  const addFriendInputButton = getId("addfriendinputbutton");
  if (addFriendInputButton) addFriendInputButton.style.right = inputRightToSet;
}

export function handleResizeWidth(): void {
  const channelList = getId("channel-list") as HTMLElement;
  if (!channelList) return;
  const currentWidth = clamp(
    parseInt(window.getComputedStyle(channelList).width, 10)
  );
  setAllWidths(currentWidth);
  saveWidth(currentWidth);
}

// --- Channel list drag-to-resize

export function initialiseChannelDrag(): void {
  const channelList = getId("channel-list") as HTMLElement;
  if (!channelList) return;

  setAllWidths(getCurrentWidth());
  setTimeout(handleResizeWidth, 0);
  window.addEventListener("resize", debounce(handleResize, DEFAULT_WIDTH));

  channelList.addEventListener("mousedown", (e) => {
    let isDragging = true;
    const startX = e.clientX;
    const startWidth = clamp(
      parseInt(window.getComputedStyle(channelList).width, 10)
    );

    document.body.style.userSelect = "none";

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      setAllWidths(clamp(startWidth + (event.clientX - startX)));
    };

    const onMouseUp = () => {
      isDragging = false;
      setTimeout(() => setAllWidths(getCurrentWidth()), 50);
      const finalWidth = clamp(
        parseInt(window.getComputedStyle(channelList).width, 10)
      );
      saveWidth(finalWidth);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

const favicon = getId("favicon") as HTMLAnchorElement;
const ACTIVE_ICON = IMAGE_SRCS.ICON_SRC;
const INACTIVE_ICON = IMAGE_SRCS.ICON_ACTIVE_SRC;

export function setActiveIcon(): void {
  if (favicon.href !== ACTIVE_ICON) favicon.href = ACTIVE_ICON;
}

export function setInactiveIcon(): void {
  if (favicon.href !== INACTIVE_ICON) favicon.href = INACTIVE_ICON;
}
