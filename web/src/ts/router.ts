import { setActiveIcon, setInactiveIcon } from "./ui.ts";
import { cacheInterface } from "./cache.ts";
import { handleChannelLoading, loadDmHome, openDm } from "./app.ts";
import {
  createEl,
  disableElement,
  enableElement,
  openBlobUrl
} from "./utils.ts";
import { initialiseLoginPage } from "./loginutils.ts";
import { apiClient } from "./api.ts";
import { isSettingsOpen } from "./settings.ts";
import { showGuildPop } from "./guildPop.ts";

export let isOnMePage = true;
export let isOnDm = false;
export let isOnGuild = false;
export function setisOnMePage(val: boolean) {
  isOnMePage = val;
}
export function setIsOnDm(val: boolean) {
  isOnDm = val;
}
export function setIsOnGuild(val: boolean) {
  isOnGuild = val;
}

class Router {
  constructor() {
    setTimeout(() => {
      this.init();
    }, 0);
  }

  public ID_LENGTH = 19;

  private readonly ROUTES = {
    DM_HOME: "/channels/@me",
    JOIN_GUILD: "/join-guild/",
    CHANNELS: "/channels/",
    CHANNELS_ME: "/channels/@me"
  } as const;
  lastKnownUrl = window.location.hash || this.ROUTES.CHANNELS_ME;

  isPathnameCorrect(url: string) {
    const regex = /\/channels\/(?:@me\/\d{18,19}|\d{18,19}\/\d{18,19})/;
    return regex.test(url);
  }

  init() {
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
    window.addEventListener("hashchange", this.handlePopState.bind(this));
    window.addEventListener("beforeunload", (e) => {
      if (isSettingsOpen) {
        e.preventDefault();
        return "";
      }
    });

    const { pathStr, parts } = this.parsePath();

    const pathname = window.location.pathname || "/";
    if (pathname.startsWith(this.ROUTES.JOIN_GUILD)) {
      const inviteId = pathname.split("/")[2];
      if (inviteId) showGuildPop(inviteId);
      history.replaceState(null, "", `/#${this.ROUTES.DM_HOME}`);
      return;
    }

    if (pathStr.startsWith(this.ROUTES.JOIN_GUILD)) {
      this.processNavigation(pathStr, parts);
      return;
    }

    if (!window.location.hash) {
      this.updateHashRoot(this.ROUTES.DM_HOME, true);
    } else {
      this.processNavigation(pathStr, parts);
    }
  }

  handleVisibilityChange() {
    if (isSettingsOpen) {
      document.hidden ? setActiveIcon() : setInactiveIcon();
    }
  }

  handlePopState() {
    try {
      const targetUrl = window.location.href;
      if (this.guardUnsavedChanges(targetUrl)) return;

      this.lastKnownUrl = window.location.hash;

      const { pathStr, parts } = this.parsePath();
      this.processNavigation(pathStr, parts);
    } catch (error) {
      console.error("Navigation error:", error);
      this.resetRoute();
    }
  }
  guardUnsavedChanges(targetUrl: string) {
    if (!isSettingsOpen) return false;

    history.pushState(null, "", this.lastKnownUrl);
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 0);
    return true;
  }

  parsePath() {
    const raw = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : this.ROUTES.DM_HOME;

    const pathStr = raw.startsWith("/") ? raw : `/${raw}`;
    const parts = pathStr.split("/").filter(Boolean);

    return { pathStr, parts };
  }

  processNavigation(pathStr: string, parts: string[]) {
    if (pathStr.startsWith(this.ROUTES.JOIN_GUILD)) {
      const inviteId = parts[1];
      if (inviteId) showGuildPop(inviteId);
      this.updateHashRoot(this.ROUTES.DM_HOME);
      return;
    }

    if (pathStr === this.ROUTES.DM_HOME) {
      loadDmHome(false);
      return;
    }

    if (pathStr.startsWith(this.ROUTES.CHANNELS_ME)) {
      openDm(parts[2]);
      return;
    }

    if (pathStr.startsWith(this.ROUTES.CHANNELS) && parts.length === 3) {
      handleChannelLoading(parts[1], parts[2]);
      return;
    }
  }

  async openLogin() {
    enableElement("login-panel");
    initialiseLoginPage();
    this.switchToLogin();
  }

  closeLogin() {
    disableElement("login-panel");
  }

  switchToRegister() {
    disableElement("login-form");
    enableElement("register-form");
  }

  switchToLogin() {
    enableElement("login-form");
    disableElement("register-form");
  }

  async logOutApp() {
    apiClient.clearToken();
    window.location.reload();
  }

  isIdDefined(id: string) {
    return id;
  }

  constructAppPage(guildId: string, channelId: string) {
    return `${this.ROUTES.CHANNELS}${guildId}/${channelId}`;
  }

  constructDmPage(friendId: string) {
    return `${this.ROUTES.CHANNELS_ME}/${friendId}`;
  }

  constructAbsoluteAppPage(guildId: string, channelId: string) {
    return `/#${this.ROUTES.CHANNELS}${guildId}/${channelId}`;
  }

  validateRoute() {
    const { pathStr, parts } = this.parsePath();
    const [guildId, channelId, friendId] = this.getRouteIds(pathStr, parts)
      .concat([undefined, undefined, undefined, undefined])
      .slice(0, 4);

    if (
      (guildId && !this.isIdDefined(guildId)) ||
      (channelId && !this.isIdDefined(channelId))
    ) {
      this.resetRoute();
      return { isValid: false };
    }

    const isPathnameCorrectValue = this.isPathnameCorrect(pathStr);
    if (!guildId && this.shouldResetRoute(isPathnameCorrectValue, guildId)) {
      this.resetRoute();
      return { isValid: false };
    }

    return {
      isValid: true,
      initialGuildId: guildId,
      initialChannelId: channelId,
      initialFriendId: friendId
    };
  }

  getRouteIds(pathStr: string, parts: string[]) {
    let guildId, channelId, friendId, inviteId;
    const channelIndex = parts.indexOf("channels");
    const joinGuildIndex = parts.indexOf("join-guild");

    if (channelIndex !== -1) {
      if (parts[channelIndex + 1] === "@me" && parts[channelIndex + 2]) {
        friendId = parts[channelIndex + 2];
      } else if (
        parts.length > channelIndex + 2 &&
        parts[channelIndex + 1] &&
        parts[channelIndex + 2]
      ) {
        guildId = parts[channelIndex + 1];
        channelId = parts[channelIndex + 2];
      }
    } else if (joinGuildIndex !== -1 && parts[joinGuildIndex + 1]) {
      inviteId = parts[joinGuildIndex + 1];
    }

    return [guildId, channelId, friendId, inviteId];
  }

  shouldResetRoute(
    isPathnameCorrectValue: boolean,
    guildId: string | undefined
  ) {
    return (
      (isOnMePage && !isPathnameCorrectValue) ||
      (isOnGuild && guildId && !cacheInterface.doesGuildExist(guildId))
    );
  }

  switchToDm(friendId: string) {
    const url = this.constructDmPage(friendId);
    if (url !== window.location.hash.slice(1)) {
      this.updateHashRoot(url);
    }
  }

  switchToGuild(guildId: string, channelId: string) {
    const url = this.constructAppPage(guildId, channelId);
    if (url !== window.location.hash.slice(1)) {
      this.updateHashRoot(url);
    }
  }

  resetRoute() {
    console.error("Resetting route");
    this.updateHashRoot(this.ROUTES.DM_HOME, true);
  }

  async openLink(link: string, imageElement?: HTMLImageElement) {
    if (link.startsWith("blob:")) {
      if (!imageElement) {
        console.warn("Cannot open blob URL without source image element");
        return;
      }
      await openBlobUrl(imageElement);
    } else {
      window.open(link, "_blank");
    }
  }

  async downloadLink(link: string) {
    try {
      const response = await fetch(link, { mode: "cors" });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      let filename = link.split("/").pop() || "";
      if (!filename || !filename.includes(".")) {
        const mime = blob.type;
        const extension = mime.split("/")[1] || "jpg";
        filename = `image.${extension}`;
      }

      const a = createEl("a", { href: url, download: filename }) as HTMLElement;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  }

  updateHashRoot(path: string, replace = false) {
    const clean = path.startsWith("/") ? path.slice(1) : path;
    const newHash = `#/${clean}`;

    if (replace) {
      window.location.replace(newHash);
    } else {
      window.location.hash = newHash;
    }
  }
}

export const router = new Router();
