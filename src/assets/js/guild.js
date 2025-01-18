let currentGuildId;



const renderGuilds = (guilds) => {
    const uniqueGuildIds = new Set();
    return guilds.map(({ guildId, rootChannel, guildName, ownerId }) => {
        if (uniqueGuildIds.has(guildId)) return "";
        uniqueGuildIds.add(guildId);
        return createGuildListItem(String(guildId), `/guilds/${guildId}`, rootChannel, guildName || "");
    }).join("");
};

const createGuildListItem = (guildIdStr, imgSrc, rootChannel, guildNameStr) => `
    <li>
        <img id="${guildIdStr}" src="${imgSrc}" style="width: 50px; height: 50px; border: none;" 
        onerror="this.onerror=null;this.src='${blackImage}';" 
        onclick="loadGuild('${encodeURIComponent(guildIdStr)}', '${encodeURIComponent(rootChannel)}', '${guildNameStr}')" />
        <div class="white-rod"></div>
    </li>
`;


export function getManageableGuilds() {
    try {
        permissionsMap = permissionManager.permissionsMap;
        if(!permissionsMap) { return [] }
        const guildsWeAreAdminOn = [];
        let isFoundAny = false;
        for (const key in permissionsMap) {
            if (permissionsMap[key].isAdmin) {
                guildsWeAreAdminOn.push(key);
                isFoundAny = true;
            }
        }
        return isFoundAny ? guildsWeAreAdminOn : null;
        
    } catch (error) {
        //console.log(error.message);   
    }
}



function createMainLogo() {
    const mainLogoImg = createEl("img", {
        id: "main-logo",
        src: "/images/icons/icon.png",
        "data-src": "/images/icons/icon.png",
        style: "width: 30px; height: 30px; border: 10px solid rgb(49, 51, 56); user-select: none;"
    });

    mainLogoImg.addEventListener("mousedown", () => {
        mainLogoImg.style.transform = "translateY(50px)";
    });

    mainLogoImg.addEventListener("mouseup", () => {
        mainLogoImg.style.transform = "translateY(0)";
    });

    mainLogoImg.addEventListener("mouseleave", () => {
        mainLogoImg.style.transform = "translateY(0)";
    });

    mainLogoImg.addEventListener("click", clickMainLogo);

    const mainLogo = createEl("li");
    mainLogo.appendChild(mainLogoImg);

    return mainLogo;
}

function setGuildImage(guildId, imageElement, isUploaded) {
    imageElement.src = isUploaded ? `/guilds/${guildId}` : blackImage
}



function doesGuildExistInBar(guildId) {
    return Boolean(guildsList.querySelector(guildId));
}

let keybindHandlers = {}; 
let isGuildKeyDown = false;


function clearKeybinds() {
    if (keybindHandlers["shift"]) {
        document.removeEventListener("keydown", keybindHandlers["shift"]);
    }
    keybindHandlers = {};
}
let currentGuildIndex = 1; 

function addKeybinds() {
    clearKeybinds();
    const guilds = Array.from(document.querySelectorAll("#guilds-list img"));
    let isGuildKeyDown = false;

    const handler = (event) => {
        if (!event.shiftKey) return;

        const key = event.key;

        if (key === "ArrowUp" || key === "ArrowDown") {
            event.preventDefault();

            if (isGuildKeyDown) return;

            if (key === "ArrowUp") {
                currentGuildIndex = (currentGuildIndex - 1 + guilds.length) % guilds.length;
            } else if (key === "ArrowDown") {
                currentGuildIndex = (currentGuildIndex + 1) % guilds.length;
            }

            guilds[currentGuildIndex].click();

            isGuildKeyDown = true;
        }
    };

    document.addEventListener("keydown", handler);

    document.addEventListener("keyup", () => {
        isGuildKeyDown = false;
    });

    keybindHandlers["shift"] = handler;
}




function appendToGuildList(guild) {
    const guildsList = getId("guilds-list");
    if (guildsList.querySelector(`#${CSS.escape(guild.guildId)}`)) return;
    const guildListItem = createGuildListItem(
        guild.guildId, 
        guild.imgSrc, 
        guild.rootChannel, 
        guild.guildName
    );
    const tempElement = createEl("div",{"innerHTML":guildListItem})
    guildsList.appendChild(tempElement.firstChild); 
    addKeybinds();
}

function removeFromGuildList(guildId) {
    const guildImg = getId(guildId);
    if (guildImg) {
        const parentLi = guildImg.closest("li");
        if (parentLi) parentLi.remove();
    }
}

function updateGuild(uploadedGuildId) {
    const guildList = getId("guilds-list").querySelectorAll("img");
    guildList.forEach((img) => {
        if (img.id === uploadedGuildId) {
            setGuildImage(uploadedGuildId, img, !!uploadedGuildId);
        }
    });
}


function createGuild() {
    const guildName = getId("guild-name-input").value;
    const guildPhotoFile = getId("guildImageInput").files[0];

    if (guildPhotoFile && !validateImage(guildPhotoFile)) {
        resetImageInput("guildImageInput", "guildImg");
        return; 
    }

    let formData = new FormData();
    if (guildPhotoFile) {
        formData.append("Photo", guildPhotoFile);
    }
    formData.append("GuildName", guildName);

    fetch("/api/guilds", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
    }).then(response => {
        if (response.ok) return response.json();
        return response.text();
    }).then(data => {
        console.log("Guild creation response:", data);
        if (typeof(data) === "object") {
            const popup = getId("guild-pop-up");
            if (popup) {
                popup.parentNode.remove();
            }

            changeUrlWithFireWorks(data.guildId, data.rootChannel, data.guildName);
            appendToGuildList(data);
        } else {
            alertUser(data);
        }
    }).catch(error => {
        console.error("Error:", error);
    });
}
function selectGuildList(guildId) {
    const guildList = getId("guilds-list"); 
    if (!guildList) return; 
    
    const foundGuilds = guildList.querySelectorAll("img");
    
    foundGuilds.forEach(guild => {
        if (guild.id === guildId) {
            guild.parentNode.classList.add("selected-guild");
        } else {
            guild.parentNode.classList.remove("selected-guild");
        }
    });
}

function loadGuild(guildId,channelId,guildName,isChangingUrl=true,isInitial=false) {
    if(!guildId || !channelId ) {
        console.error("Load guild called with null values: ", guildId,channelId)
        return; 
    }
    console.log("Loading guild: ",guildId,channelId,guildName);
    
    if (isChangingUrl) {
        const state = constructAppPage(guildId,channelId);
        if(window.location.pathname != state) {
            window.history.pushState(null, null, state);
        }
    } 
    if(isChangingPage) {
        console.warn(" Already changing guild! can not change guild");
        return;
    }
    addKeybinds();

    currentGuildId = guildId;
    permissionManager = new PermissionManager(initialState.permissionsMap, currentGuildId);
    selectGuildList(guildId);
    if(guildName) {
        currentGuildName = guildName;
    } else {
        const cachedGuildName = cacheInterface.getGuildName(guildId);
        if(cachedGuildName) {
            currentGuildName = cachedGuildName
        } else { console.warn("Name does not exist for guild: ",guildId)}
    }

    currentChannelId = channelId;
    if(!isChangingUrl) {
        wasNotChangingUrl = true;
    }
    
    if(isOnMe) {
        loadApp(null,isInitial);
    } else if (isOnDm) {
        loadApp(null,isInitial);
    } else if (isOnGuild){
        changecurrentGuild();
    } 
    
}


function joinVoiceChannel(channelId) {
    if(currentVoiceChannelId == channelId) { return; }
    const data = { "guildId" : currentGuildId, "channelId" : channelId }
    apiClient.send(EventType.JOIN_VOICE_CHANNEL,data);
    return;
}


function refreshInviteId() {
    if(!cacheInterface.isInvitesEmpty(currentGuildId)) { return; }
    console.log("Implement invites")
    //apiClient.send(EventType.GET_INVITES,{"guildId" : currentGuildId});
}

function fetchMembers() {
    if(!currentGuildId) {
        console.warn("Current guild id is null! cant fetch members");
        return
    }
    const members = cacheInterface.getMembers(currentGuildId);

    if(members.length > 0) {
        console.log("Using cached members...");
        updateMemberList(members);

    } else {
        console.log("Fetching members...");
        apiClient.send(EventType.GET_MEMBERS,{"guildId" : currentGuildId});

    }

}


function getGuildMembers() {
    if (!cacheInterface.isMembersEmpty(currentGuildId) || !currentGuildId) { return; }
    
    const guildMembers = cacheInterface.getMembers(currentGuildId);
    if (!guildMembers) { return; }

    let usersToReturn = [];

    for (const userId in guildMembers) {
        const user = guildMembers[userId];
        usersToReturn.push({
            name: user.Nickname,
            image: getProfileUrl(user.userId) 
        });
    }
    console.log(usersToReturn)
    console.log(guildMembers);

    return usersToReturn; 
}


function joinToGuild(inviteId) {
    apiClient.send(EventType.JOIN_GUILD,{"invite_id":inviteId});
}

function leaveCurrentGuild() {
    apiClient.send(EventType.LEAVE_GUILD,currentGuildId);
}


