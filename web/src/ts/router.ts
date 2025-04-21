import { setActiveIcon, setInactiveIcon } from "./ui.ts";
import { cacheInterface } from "./cache.ts";
import { handleChannelLoading, loadDmHome, openDm } from "./app.ts";
import { selectGuildList } from "./guild.ts";
import { showGuildPop } from "./popups.ts";
import { disableElement, enableElement } from "./utils.ts";
import { initialiseLoginPage } from "./loginutils.ts";
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
  constructor() {
    this.init();
  }
  public ID_LENGTH = 19;

  isPathnameCorrect(url: string) {
    const regex = new RegExp(`^/channels/\\d+/\\d+$`);
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
      } else if (pathStr.startsWith("/channels/") && parts.length === 4) {
        handleChannelLoading(parts[2], parts[3]);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async openLogin() {
    enableElement("login-panel");
    initialiseLoginPage(false);
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
    fetch(import.meta.env.VITE_BACKEND_URL + "/auth/logout", {
      method: "POST",
      credentials: "include"
    })
      .then(() => {
        window.location.reload();
      })
      .catch((error) => {
        window.location.reload();
        console.error("Error during logout:", error);
      });
  }

  isIdDefined(id: string) {
    return id;
  }

  parsePath() {
    const pathStr =
      window.location.pathname !== "/channels/@me"
        ? window.location.pathname
        : window.location.search;
    const parts = pathStr.split("/");
    return { pathStr, parts };
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
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());

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

    //apiClient.send(EventType.JOIN_GUILD,{ inviteId });

    if (
      (guildId && !this.isIdDefined(guildId)) ||
      (channelId && !this.isIdDefined(channelId))
    ) {
      this.resetRoute();
      return { isValid: false };
    }

    const isPathnameCorrectValue = this.isPathnameCorrect(pathStr);

    if (guildId && this.shouldResetRoute(isPathnameCorrectValue, guildId)) {
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

    if (pathStr.startsWith("/channels/@me/")) friendId = parts[3];
    else if (pathStr.startsWith("/channels/") && parts.length === 4) {
      guildId = parts[2];
      channelId = parts[3];
    } else if (pathStr.startsWith("/join-guild")) {
      inviteId = parts[2];
    }

    return [guildId, channelId, friendId, inviteId];
  }

  shouldResetRoute(isPathnameCorrectValue: boolean, guildId: string) {
    return (
      (isOnMePage && !isPathnameCorrectValue) ||
      (isOnGuild && cacheInterface.doesGuildExist(guildId))
    );
  }

  resetRoute() {
    window.history.pushState(null, "", "/channels/@me");
    selectGuildList("a");
  }
}

export const router = new Router();
