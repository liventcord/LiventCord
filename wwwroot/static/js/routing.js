const ID_LENGTH = 18


function changePageToMe() {
    window.location.href = "/channels/@me";
}
function changePageToGuild() {
    window.location.href = "/";
}
function isIdDefined(id) {
    return typeof id !== "undefined" && id !== null && id.length == ID_LENGTH;
}
function validateRoute() {
    //console.log("Validating route...");

    const pathStr = window.location.pathname;
    //console.log("Current Path:", pathStr);

    let guildId, channelId, friendId;

    const parts = pathStr.split("/");

    if (pathStr.startsWith("/channels/@me/")) {
        friendId = parts[3];
        //console.log("Friend ID:", friendId);
    } else if (pathStr.startsWith("/channels/") && parts.length === 4) {
        guildId = parts[2];
        channelId = parts[3];
        //console.log("Guild ID:", guildId);
        //console.log("Channel ID:", channelId);
    }

    const isGuildIdDefined = isIdDefined(guildId);
    const isChannelIdDefined = isIdDefined(channelId);
    //console.log("Is Guild ID Defined:", isGuildIdDefined);
    //console.log("Is Channel ID Defined:", isChannelIdDefined);

    if (!isGuildIdDefined || !isChannelIdDefined) {
        //console.log("One or more IDs are not defined. Redirecting to /channels/@me.");
        window.history.pushState(null, null, "/channels/@me");
        return { isValid: false, initialGuildId: null, initialChannelId: null, initialFriendId: null };
    }

    const currentPathname = window.location.pathname;
    //console.log("Current Pathname:", currentPathname);
    const isPathnameCorrectValue = isPathnameCorrect(currentPathname);
    //console.log("Is Pathname Correct:", isPathnameCorrectValue);

    if (isOnMe && !isPathnameCorrectValue) {
        //console.log("User is on "/me" but pathname is incorrect. Redirecting to /channels/@me.");
        window.history.pushState(null, null, "/channels/@me");
        return { isValid: false, initialGuildId: null, initialChannelId: null, initialFriendId: null };
    }

    if (isOnGuild) {
        const doesGuildExist = cacheInterface.doesGuildExist(guildId);
        //console.log("Does Guild Exist:", doesGuildExist);

        if (doesGuildExist) {
            //console.log("Guild exists. Redirecting to /channels/@me.");
            window.history.pushState(null, null, "/channels/@me");
            return { isValid: false, initialGuildId: null, initialChannelId: null, initialFriendId: null };
        }
    }

    //console.log("Route validated successfully.");
    return { isValid: true, initialGuildId: guildId, initialChannelId: channelId, initialFriendId: friendId };
}



document.addEventListener("visibilitychange", function() {
    if (!document.hidden) {
        if(isUnread)
        setActiveIcon();
    } else {
        setInactiveIcon();
    }
});
window.addEventListener("popstate", function(event) {
    try {
        const pathStr = window.location.pathname;
        if (pathStr === "/channels/@me") {
            loadDmHome(false);
        } else if (pathStr.startsWith("/channels/@me/")) {
            const parts = pathStr.split("/");
            const friendId = parts[3];
            OpenDm(friendId);
        } else if (pathStr.startsWith("/channels/") && pathStr.split("/").length === 4) {
            
            const parts = pathStr.split("/");
            const guildID = parts[2];
            const channelId = parts[3];
            loadGuild(guildID, channelId,  null, false);
        } else {
            //console.error("Unknown URL format:", pathStr);
        }
        
    } catch (error) {
        //console.error(error);
    }
});