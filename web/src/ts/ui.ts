import { getId, isMobile } from "./utils.ts";
import { translations } from "./translations.ts";
import { initialState } from "./app.ts";
import { openSettings } from "./settingsui.ts";
import { currentGuildId, wrapWhiteRod, leaveCurrentGuild } from "./guild.ts";
import { observe } from "./chat.ts";
import { apiClient, EventType } from "./api.ts";
import { guildCache } from "./cache.ts";
import { chatContent } from "./chatbar.ts";
import { SettingType } from "./types/interfaces.ts";

import {
  alertUser,
  dismissCurrentPopupIf,
  askUser,
  logOutPrompt,
  openChangePasswordPop
} from "./popups.ui.ts";
import {
  displayImagePreview,
  displayImagePreviewBlob,
  displayVideoPreview,
  hideImagePreview,
  isImagePreviewOpen,
  initImagePreviewNavigation,
  syncPreviewIndex
} from "./imagePreview.ts";
import {
  toggleHamburger,
  handleMembersClick,
  initialiseMobile,
  initMobileSwipe,
  isOnCenter,
  isOnLeft,
  isOnRight,
  mobileMoveToCenter
} from "./mobileNav.ts";
import {
  loadMainToolbar,
  loadGuildToolbar,
  loadDmToolbar,
  fillDropDownContent,
  initialiseChannelDrag,
  setAllWidths,
  getCurrentWidth,
  setActiveIcon,
  setInactiveIcon,
  handleResize,
  clamp,
  handleResizeWidth
} from "./layout.ts";

export const hoveredChanColor = () => (isBlackTheme() ? "#1C1C1F" : "#34353B");
export const selectedChanColor = () => (isBlackTheme() ? "#414248" : "#404249");
export let loadingScreen: HTMLElement;

// --- Email toggle

import { isBlackTheme } from "./settings.ts";
import { createChannelsPop, createInviteUsersPop } from "./channelPop.ts";
import { toggleDropdown } from "./guildPop.ts";
import { loadDmHome } from "./appUI.ts";

let isEmailToggled = false;
export function toggleEmail(): void {
  const eyeIcon = getId("set-info-email-eye");
  const emailIcon = getId("set-info-email");
  if (!eyeIcon || !emailIcon) return;

  isEmailToggled = !isEmailToggled;
  emailIcon.textContent = isEmailToggled
    ? initialState.user.email
    : initialState.user.maskedEmail;

  eyeIcon.classList.toggle("fa-eye", !isEmailToggled);
  eyeIcon.classList.toggle("fa-eye-slash", isEmailToggled);
}

// --- Toggle element helper

export function handleToggleClick(
  toggleElement: HTMLElement,
  toggleClickCallback: CallableFunction
): void {
  toggleElement.addEventListener("click", function () {
    this.classList.toggle("active");
    (this.querySelector(".toggle-switch") as HTMLElement)?.classList.toggle(
      "active"
    );
    toggleClickCallback();
  });
}

// --- Logo easter egg

let logoClicked = 0;
export function clickMainLogo(logo: HTMLElement): void {
  logoClicked++;
  if (logoClicked >= 14) {
    logoClicked = 0;
    try {
      new Audio("/liventocordolowpitch.mp3").play();
    } catch (e) {
      console.log(e);
    }
  }
  wrapWhiteRod(logo);
  loadDmHome();
}

// --- JSON preview ( TODO: implement properly) ---

const jsonPreviewContainer = getId("json-preview-container") as HTMLElement;
const jsonPreviewElement = getId("json-preview-element") as HTMLElement;

export function displayJsonPreview(sourceJson: string): void {
  jsonPreviewContainer.style.display = "flex";
  jsonPreviewElement.dataset.content_observe = sourceJson;
  jsonPreviewElement.style.userSelect = "text";
  jsonPreviewElement.style.whiteSpace = "pre-wrap";
  observe(jsonPreviewElement);
}

jsonPreviewContainer?.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).id === "json-preview-container") {
    jsonPreviewContainer.style.display = "none";
  }
});

// --- Invite popup

export async function createInvitePop(): Promise<void> {
  await apiClient.send(EventType.GET_INVITES, {
    guildId: currentGuildId,
    channelId: guildCache.currentChannelId
  });
  createInviteUsersPop();
}

// --- Guild settings dropdown

export function openGuildSettingsDropdown(event: MouseEvent): void {
  toggleDropdown();

  const clickedId = (event.target as HTMLElement).closest("button[id]")?.id;
  if (!clickedId) return;

  const actions: Record<string, () => void> = {
    "invite-dropdown-button": () => createInvitePop(),
    "settings-dropdown-button": () => openSettings(SettingType.GUILD),
    "channel-dropdown-button": () => createChannelsPop(currentGuildId),
    "exit-dropdown-button": () =>
      askUser(
        translations.getTranslation("exit-dropdown-button"),
        translations.getTranslation("leave-guild-detail"),
        translations.getTranslation("exit-dropdown-button"),
        leaveCurrentGuild
      )
  };

  actions[clickedId]?.();
}

// --- Initialization

const getMediaGrid = () => getId("media-grid") as HTMLElement;

initImagePreviewNavigation(() => chatContent, getMediaGrid);

if (isMobile) {
  initMobileSwipe(() => chatContent, getMediaGrid);
}
export function hideImagePreviewRequest(event: Event) {
  const target = event.target as HTMLElement;

  if (target.id === "image-preview-container") {
    hideImagePreview();
  }
}
export function beautifyJson(jsonData: string) {
  try {
    const beautifiedJson = JSON.stringify(jsonData, null, "\t");
    return beautifiedJson;
  } catch (error) {
    console.error("Error beautifying JSON:", error);
    return null;
  }
}

export {
  alertUser,
  dismissCurrentPopupIf,
  askUser,
  logOutPrompt,
  openChangePasswordPop,
  displayImagePreview,
  displayImagePreviewBlob,
  displayVideoPreview,
  hideImagePreview,
  isImagePreviewOpen,
  syncPreviewIndex,
  toggleHamburger,
  handleMembersClick,
  initialiseMobile,
  isOnCenter,
  isOnLeft,
  isOnRight,
  mobileMoveToCenter,
  loadMainToolbar,
  loadGuildToolbar,
  loadDmToolbar,
  fillDropDownContent,
  initialiseChannelDrag,
  setAllWidths,
  getCurrentWidth,
  setActiveIcon,
  setInactiveIcon,
  handleResize,
  clamp,
  handleResizeWidth
};
