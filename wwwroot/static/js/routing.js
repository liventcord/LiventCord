const ID_LENGTH = 18;

function changePageToMe() {
    window.location.href = "/channels/@me";
}

function changePageToGuild() {
    window.location.href = "/";
}

function isIdDefined(id) {
    return typeof id !== "undefined" && id !== null && id.length == ID_LENGTH;
}

function parsePath() {
    const pathStr = window.location.pathname;
    const parts = pathStr.split("/");
    return { pathStr, parts };
}

function validateRoute() {
    const { pathStr, parts } = parsePath();

    let guildId, channelId, friendId;

    if (pathStr.startsWith("/channels/@me/")) {
        friendId = parts[3];
    } else if (pathStr.startsWith("/channels/") && parts.length === 4) {
        guildId = parts[2];
        channelId = parts[3];
    }

    const isGuildIdDefined = isIdDefined(guildId);
    const isChannelIdDefined = isIdDefined(channelId);

    if (!isGuildIdDefined || !isChannelIdDefined) {
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

document.addEventListener("visibilitychange", function() {
    if (!document.hidden) {
        if(isUnread) setActiveIcon();
    } else {
        setInactiveIcon();
    }
});

window.addEventListener("popstate", function(event) {
    try {
        const { pathStr, parts } = parsePath();

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
        //console.error(error);
    }
});
