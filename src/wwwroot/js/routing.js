class Router {
    constructor() {
        this.ID_LENGTH = 18;
        this.init();
    }

    init() {
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        window.addEventListener("popstate", this.handlePopState);
    }

    handleVisibilityChange = () => {
        if (!document.hidden) {
            if (isUnread) setActiveIcon();
        } else {
            setInactiveIcon();
        }
    }

    handlePopState = (event) => {
        try {
            const { pathStr, parts } = this.parsePath();

            if (pathStr === "/channels/@me") {
                loadDmHome(false);
            } else if (pathStr.startsWith("/channels/@me/")) {
                const friendId = parts[3];
                OpenDm(friendId);
            } else if (pathStr.startsWith("/channels/") && parts.length === 4) {
                const guildID = parts[2];
                const channelId = parts[3];
                loadGuild(guildID, channelId, null, false);
            }
        } catch (error) {
            console.error(error);
        }
    }

    async changeToLogin() {
        await fetch("http://localhost:5005/auth/logout", {
            "method": "POST",
        });
        window.location.href = "/login";
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

        let guildId, channelId, friendId;

        if (pathStr.startsWith("/channels/@me/")) {
            friendId = parts[3];
        } else if (pathStr.startsWith("/channels/") && parts.length === 4) {
            guildId = parts[2];
            channelId = parts[3];
        }

        if (!this.isIdDefined(guildId) || !this.isIdDefined(channelId)) {
            window.history.pushState(null, null, "/channels/@me");
            return { isValid: false, initialGuildId: null, initialChannelId: null, initialFriendId: null };
        }

        const isPathnameCorrectValue = isPathnameCorrect(pathStr);

        if (isOnMe && !isPathnameCorrectValue) {
            window.history.pushState(null, null, "/channels/@me");
            return { isValid: false, initialGuildId: null, initialChannelId: null, initialFriendId: null };
        }

        if (isOnGuild && cacheInterface.doesGuildExist(guildId)) {
            window.history.pushState(null, null, "/channels/@me");
            return { isValid: false, initialGuildId: null, initialChannelId: null, initialFriendId: null };
        }

        return { isValid: true, initialGuildId: guildId, initialChannelId: channelId, initialFriendId: friendId };
    }
}

const router = new Router();
