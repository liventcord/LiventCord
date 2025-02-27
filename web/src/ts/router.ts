import { setActiveIcon, setInactiveIcon } from "./ui.ts";
import { cacheInterface } from "./cache.ts";
import { handleChannelLoading, loadDmHome, openDm } from "./app.ts";
import { selectGuildList } from "./guild.ts";
import { showGuildPop } from "./popups.ts";
export let isOnMe = true;
export let isOnDm = false;
export let isOnGuild = false;
export function setIsOnMe(val: boolean) {
  isOnMe = val;
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

  changePageToGuild() {
    window.location.href = "/";
  }

  isIdDefined(id: string) {
    return id;
  }

  parsePath() {
    const pathStr = window.location.pathname;
    const parts = pathStr.split("/");
    return { pathStr, parts };
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
      (isOnMe && !isPathnameCorrectValue) ||
      (isOnGuild && cacheInterface.doesGuildExist(guildId))
    );
  }

  resetRoute() {
    window.history.pushState(null, "", "/channels/@me");
    selectGuildList("a");
  }
}

export const router = new Router();
