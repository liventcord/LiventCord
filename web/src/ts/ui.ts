import { getId, isMobile } from "./utils.ts";
import { translations } from "./translations.ts";
import { initialState, loadDmHome } from "./app.ts";
import {
  createChannelsPop,
  toggleDropdown,
  createInviteUsersPop
} from "./popups.ts";
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

export const textChanHtml =
  '<svg class="icon_d8bfb3" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>';
export const muteHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m2.7 22.7 20-20a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4ZM10.8 17.32c-.21.21-.1.58.2.62V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 0 0-2 0c0 1.45-.52 2.79-1.38 3.83l-.02.02A5.99 5.99 0 0 1 12.32 16a.52.52 0 0 0-.34.15l-1.18 1.18ZM15.36 4.52c.15-.15.19-.38.08-.56A4 4 0 0 0 8 6v4c0 .3.03.58.1.86.07.34.49.43.74.18l6.52-6.52ZM5.06 13.98c.16.28.53.31.75.09l.75-.75c.16-.16.19-.4.08-.61A5.97 5.97 0 0 1 6 10a1 1 0 0 0-2 0c0 1.45.39 2.81 1.06 3.98Z" class=""></path></svg>';
export const inviteVoiceHtml =
  '<svg class="icon_cdc675" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a1 1 0 1 0-2 0v8H3a1 1 0 1 0 0 2h8v8a1 1 0 0 0 2 0v-8h8a1 1 0 0 0 0-2h-8V3Z" class=""></path></svg>';

export const hoveredChanColor = () => (isBlackTheme() ? "#1C1C1F" : "#34353B");
export const selectedChanColor = () => (isBlackTheme() ? "#414248" : "#404249");
export let loadingScreen: HTMLElement;

// ─── Email toggle ─────────────────────────────────────────────────────────────

import { isBlackTheme } from "./settings.ts";

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

// ─── Toggle element helper ────────────────────────────────────────────────────

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

// ─── Logo easter egg ──────────────────────────────────────────────────────────

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

// ─── JSON preview (stub — TODO: implement properly) ───────────────────────────

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

// ─── Invite popup ─────────────────────────────────────────────────────────────

export async function createInvitePop(): Promise<void> {
  await apiClient.send(EventType.GET_INVITES, {
    guildId: currentGuildId,
    channelId: guildCache.currentChannelId
  });
  createInviteUsersPop();
}

// ─── Guild settings dropdown ──────────────────────────────────────────────────

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

// ─── Initialization ───────────────────────────────────────────────────────────

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
