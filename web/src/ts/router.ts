import { setActiveIcon, setInactiveIcon } from "./ui.ts";
import { cacheInterface } from "./cache.ts";
import { handleChannelLoading, loadDmHome, openDm } from "./app.ts";
import { showGuildPop } from "./popups.ts";
import {
  createEl,
  disableElement,
  enableElement,
  openBlobUrl
} from "./utils.ts";
import { initialiseLoginPage } from "./loginutils.ts";
import { apiClient } from "./api.ts";
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

const hasNotifications = false;

class Router {
  shouldClearQuery = false;
  constructor() {
    this.init();
  }
  public ID_LENGTH = 19;

  isPathnameCorrect(url: string) {
    const regex = /\/channels\/(?:@me\/\d{18,19}|\d{18,19}\/\d{18,19})/;
    console.log(url, regex.test(url));
    return regex.test(url);
  }

  init() {
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
    window.addEventListener("popstate", this.handlePopState.bind(this));

    this.processQueryParameters();
  }

  handleVisibilityChange() {
    if (hasNotifications) {
      document.hidden ? setActiveIcon() : setInactiveIcon();
    }
  }

  handlePopState() {
    try {
      const { pathStr, parts } = this.parsePath();

      if (pathStr === "/channels/@me") {
        loadDmHome(false);
      } else if (pathStr === "/join-guild") {
        loadDmHome(false);
      } else if (pathStr.startsWith("/channels/@me/")) {
        openDm(parts[3]);
      } else if (pathStr.startsWith("/channels/") && parts.length === 3) {
        handleChannelLoading(parts[1], parts[2]);
      }
    } catch (error) {
      console.error(error);
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
  reloadLocation() {
    window.location.reload();
  }

  isIdDefined(id: string) {
    return id;
  }
  constructAppPage(guildId: string, channelId: string) {
    return `/channels/${guildId}/${channelId}`;
  }
  constructDmPage(channelId: string) {
    return `/channels/@me/${channelId}`;
  }
  constructAbsoluteAppPage(guildId: string, channelId: string) {
    const port = window.location.port ? `:${window.location.port}` : "";
    return `${window.location.protocol}//${window.location.hostname}${port}/channels/${guildId}/${channelId}`;
  }
  parsePath() {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get("page");

    if (this.shouldClearQuery) {
      this.clearQuery();
    }

    const pathStr = pageParam
      ? decodeURIComponent(pageParam)
      : window.location.pathname;

    const parts = pathStr.split("/").filter((part) => part !== "");

    console.log(window.location.href, window.location.pathname, pathStr, parts);
    return { pathStr, parts };
  }
  clearQuery() {
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  }

  processQueryParameters() {
    switch (window.location.search) {
      case "login":
        this.openLogin();
        break;
      case "register":
        this.openLogin();
        this.switchToRegister();
      default:
        this.shouldClearQuery = true;

        break;
    }
  }

  validateRoute() {
    const { pathStr, parts } = this.parsePath();
    const [guildId, channelId, friendId, inviteId] = this.getRouteIds(
      pathStr,
      parts
    )
      .concat([undefined, undefined, undefined, undefined])
      .slice(0, 4);

    if (inviteId) {
      showGuildPop(inviteId);
    }

    if (
      (guildId && !this.isIdDefined(guildId)) ||
      (channelId && !this.isIdDefined(channelId))
    ) {
      this.resetRoute();
      return { isValid: false };
    }

    const isPathnameCorrectValue = this.isPathnameCorrect(pathStr);
    console.log(isPathnameCorrectValue);
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
    if (url !== window.location.pathname) {
      window.history.pushState(null, "", url);
    }
  }
  switchToGuild(guildId: string, channelId: string) {
    const url = this.constructAppPage(guildId, channelId);
    if (url !== window.location.pathname) {
      window.history.pushState(null, "", url);
    }
  }

  resetRoute() {
    console.error("Resetting route");
    window.history.pushState(null, "", "/channels/@me");
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
        const mime = blob.type; // e.g. "image/png"
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
}

export const router = new Router();
