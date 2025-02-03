import { setActiveIcon, setInactiveIcon } from "./ui.ts";
import { cacheInterface } from "./cache.ts";
import { loadDmHome, openDm } from "./app.ts";
import { isPathnameCorrect } from "./utils.ts";
import { loadGuild, selectGuildList } from "./guild.ts";
export let isOnMe = true;
export let isOnDm = false;
export let isOnGuild = false;
export function setIsOnMe(val) {
  isOnMe = val;
}
export function setIsOnDm(val) {
  isOnDm = val;
}
export function setIsOnGuild(val) {
  isOnGuild = val;
}

const hasNotifications = false;

class Router {
  ID_LENGTH: number;
  constructor() {
    this.ID_LENGTH = 18;
    this.init();
  }

  init() {
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
    window.addEventListener("popstate", this.handlePopState.bind(this));
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
      } else if (pathStr.startsWith("/channels/@me/")) {
        openDm(parts[3]);
      } else if (pathStr.startsWith("/channels/") && parts.length === 4) {
        loadGuild(parts[2], parts[3], null, false);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async changeToLogin() {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  async logOutApp() {
    fetch("/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    })
      .then((response) => {
        if (response.ok) {
          document.body.innerHTML = "";
          window.location.href = "/";
        } else {
          console.error("Logout failed:", response.statusText);
        }
      })
      .catch((error) => {
        console.error("Error during logout:", error);
      });
  }

  changePageToMe() {
    window.location.href = "/channels/@me";
  }

  changePageToGuild() {
    window.location.href = "/";
  }

  isIdDefined(id) {
    return id && id.length === this.ID_LENGTH;
  }

  parsePath() {
    const pathStr = window.location.pathname;
    const parts = pathStr.split("/");
    return { pathStr, parts };
  }

  validateRoute() {
    const { pathStr, parts } = this.parsePath();
    const [guildId, channelId, friendId] = this.getRouteIds(pathStr, parts);

    if (!this.isIdDefined(guildId) || !this.isIdDefined(channelId)) {
      this.resetRoute();
      return { isValid: false };
    }

    const isPathnameCorrectValue = isPathnameCorrect(pathStr);

    if (this.shouldResetRoute(isPathnameCorrectValue, guildId)) {
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

  getRouteIds(pathStr, parts) {
    let guildId, channelId, friendId;

    if (pathStr.startsWith("/channels/@me/")) friendId = parts[3];
    else if (pathStr.startsWith("/channels/") && parts.length === 4) {
      guildId = parts[2];
      channelId = parts[3];
    }

    return [guildId, channelId, friendId];
  }

  shouldResetRoute(isPathnameCorrectValue, guildId) {
    return (
      (isOnMe && !isPathnameCorrectValue) ||
      (isOnGuild && cacheInterface.doesGuildExist(guildId))
    );
  }

  resetRoute() {
    window.history.pushState(null, null, "/channels/@me");
    selectGuildList("a");
  }
}

export const router = new Router();
