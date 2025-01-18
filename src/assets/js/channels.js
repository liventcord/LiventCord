import { setProfilePic } from "./avatar";


let channelList;
let channelsUl;

let channelTitle;

let currentChannels;
let currentChannelName = null;
let currentVoiceChannelId;
let currentChannelId;


function getChannels() {
    console.log("Getting channels...");
    if (currentChannelId) {
        const channels = cacheInterface.getChannels(currentGuildId);
        if (channels.length > 0) {
            updateChannels(channels);
            console.log("Using cached channels: ",channels);

        } else {
            console.warn("Channel cache is empty. fetching channels...");
            apiClient.send(EventType.GET_CHANNELS, { "guildId": currentGuildId }); 
        }
    } else {
        console.warn("Current channel id is null!");
    }
}

async function changeChannel(newChannel) {
    console.log("Changed channel: ",newChannel);
    if(isOnMe || isOnDm) { return; }
    const channelId = newChannel.channelId;
    const isTextChannel = newChannel.isTextChannel;
    const url = constructAppPage(currentGuildId,channelId);
    if(url != window.location.pathname && isTextChannel) {
        window.history.pushState(null, null, url);
    }
    const newChannelName = newChannel.channelName;
    isReachedChannelEnd = false;
    
    if(isTextChannel) {
        currentChannelId = channelId;
        currentChannelName = newChannelName;
        chatInput.placeholder = translations.getMessagePlaceholder(newChannelName);
        channelTitle.textContent = newChannelName;
        lastSenderID = "";
        chatContent.innerHTML = "";
        currentLastDate = "";
        getHistoryFromOneChannel(currentChannelId);
        closeReplyMenu();
    } else {
        joinVoiceChannel(channelId);
    }

    if(!currentChannels) { return; }

    currentChannels.forEach((channel, index) => {
        const channelButton = channelsUl.querySelector(`li[id="${channel.channelId}"]`);
        if(channelButton) {
            if(channel.channelId != channelId) {
                mouseHoverChannelButton(channelButton,channel.isTextChannel,channel.channelId);
                mouseLeaveChannelButton(channelButton,channel.isTextChannel,channel.channelId);
            } else if(!isTextChannel) {
                const usersInChannel = usersInVoice[channelId];
                if(usersInChannel) {

                    let allUsersContainer = channelButton.querySelector(".channel-users-container");
                    if(!allUsersContainer) {
                        allUsersContainer = createEl("div",{className:"channel-users-container"});
                    }
                    channelButton.style.width = "100%";
                    usersInChannel.forEach((userId,index) => {
                        drawVoiceChannelUser(index,userId,channelId,channelButton,allUsersContainer,isTextChannel);
                    });
                }
            }
        }
    });
}


//channels
function isChannelMatching(channelId, isTextChannel) {
    const currentChannel = isTextChannel ? currentChannelId : currentVoiceChannelId;
    if (channelId === currentChannel) {
        return true;
    } else {
        console.error("Match failed");
        return false;
    }
}


function mouseHoverChannelButton(channelButton,isTextChannel,channelId) {
    if(!channelButton) { return; }
    const contentWrapper = channelButton.querySelector(".content-wrapper");


    contentWrapper.style.display = "flex";
    if(isTextChannel) {
        const isMatch = isChannelMatching(channelId,isTextChannel);
        channelButton.style.backgroundColor = isMatch ? selectedChanColor : hoveredChanColor;
    } else {
        channelButton.style.backgroundColor = hoveredChanColor;
    }
    channelButton.style.color = "white";
}
function hashChildElements(channelButton) {
    return channelButton.querySelector(".channel-users-container") != null;
}
function mouseLeaveChannelButton(channelButton,isTextChannel,channelId) {
    if(!channelButton) { return; }
    const contentWrapper = channelButton.querySelector(".content-wrapper");
    const channelSpan = channelButton.querySelector(".channelSpan");



    if(channelSpan && !isTextChannel) {
        channelSpan.style.marginRight = hashChildElements(channelButton) ? "30px" : "0px";
    }
    if(contentWrapper) {
        if(!isTextChannel) {
            if(currentVoiceChannelId == channelId) {
                contentWrapper.style.display = "flex";
            } else {
                contentWrapper.style.display = "none";
            }
            
        }  else  if (currentChannelId != channelId){
            contentWrapper.style.display = "none";
            
        }
    }
    if(isTextChannel) {
        channelButton.style.backgroundColor = isChannelMatching(channelId,isTextChannel) ? selectedChanColor : "transparent";
    } else {
        channelButton.style.backgroundColor = "transparent";
        
    }
    channelButton.style.color = isChannelMatching(channelId,isTextChannel) ? "white" : "rgb(148, 155, 164)";
}
function handleKeydown(event) {
    if (isKeyDown || isOnMe) return;
    currentChannels.forEach((channel, index) => {
        let hotkey = index < 9 ? (index + 1).toString() : (index === 9 ? "0" : null);
        if (hotkey && event.key === hotkey && event.altKey) {
            changeChannel(channel);
        }
    });
    if (event.altKey) { 
        if (event.key === "ArrowUp") {
            moveChannel(-1);
        } else if (event.key === "ArrowDown") {
            moveChannel(1);
        }
    }
    isKeyDown = true;
}
function editChannelElement(channelId, new_channel_name) {
    const existingChannelButton = channelsUl.querySelector(`li[id="${channelId}"]`);
    if (!existingChannelButton) { return; }
    existingChannelButton.querySelector("channelSpan").textContent = new_channel_name;
}
function removeChannelElement(channelId) {
    const existingChannelButton = channelsUl.querySelector(`li[id="${channelId}"]`);
    if (!existingChannelButton) { return; }
    existingChannelButton.remove();
}

function isChannelExist(channelId) {
    const existingChannelButton = channelsUl.querySelector(`li[id="${channelId}"]`);
    return existingChannelButton !== null;
}

function createChannelButton(channelId, channelName, isTextChannel) {
    const htmlToSet = isTextChannel ? textChanHtml : voiceChanHtml;
    const channelButton = createEl("li", { className: "channel-button", id: channelId });
    channelButton.style.marginLeft = "-80px";

    const hashtagSpan = createEl("span", { innerHTML: htmlToSet, marginLeft: "50px" });
    hashtagSpan.style.color = "rgb(128, 132, 142)";
    
    const channelSpan = createEl("span", { className: "channelSpan", textContent: channelName });
    channelSpan.style.marginRight = "30px";
    channelSpan.style.width = "100%";
    channelButton.style.width = "70%";

    channelButton.appendChild(hashtagSpan);
    channelButton.appendChild(channelSpan);

    return channelButton;
}

function createContentWrapper(channel, channelName, isTextChannel) {
    const contentWrapper = createEl("div", { className: "content-wrapper" });
    contentWrapper.style.display = "none";
    contentWrapper.style.marginRight = "100px";
    contentWrapper.style.marginTop = "4px";

    const settingsSpan = createEl("span", { innerHTML: settingsHtml });
    settingsSpan.addEventListener("click", () => {
        console.log("Click to settings on:", channelName);
    });

    if (permissionManager.canInvite()) {
        const inviteSpan = createEl("span", { innerHTML: inviteHtml });
        inviteSpan.addEventListener("click", () => {
            console.log("Click to invite on:", channelName);
        });
        contentWrapper.appendChild(inviteSpan);
    }

    contentWrapper.appendChild(settingsSpan);
    return contentWrapper;
}

function addEventListeners(channelButton, channelId, isTextChannel, channel) {
    channelButton.addEventListener("mouseover", function(event) {
        if (event.target.id == channelId) {
            mouseHoverChannelButton(channelButton, isTextChannel, channelId);
        }
    });

    channelButton.addEventListener("mouseleave", function(event) {
        if (event.target.id == channelId) {
            mouseLeaveChannelButton(channelButton, isTextChannel, channelId);
        }
    });

    mouseLeaveChannelButton(channelButton, isTextChannel, channelId);
    channelButton.addEventListener("click", function() {
        changeChannel(channel);
    });
}

function handleChannelChangeOnLoad(channel, channelId) {
    if (channelId == currentChannelId) {
        changeChannel(channel);
    }
}

function resetKeydown() {
    isKeyDown = false;
}


  
let isKeyDown = false;
let currentChannelIndex = 0;
function moveChannel(direction) {
    let newIndex = currentChannelIndex + direction;
    if (newIndex < 0) {
        newIndex = currentChannels.length - 1;
    }
    else if (newIndex >= currentChannels.length) {
        newIndex = 0;
    }
    changeChannel(currentChannels[newIndex]);
    currentChannelIndex = newIndex; 
}




function removeChannelEventListeners() {
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("keyup", resetKeydown);
}

function addChannelEventListeners() {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("keyup", resetKeydown);
}


function validateChannel(channel) {
    const channelId = channel.channelId;
    const channelName = channel.channelName;
    const isTextChannel = channel.isTextChannel;

    return channelId && channelName && typeof isTextChannel !== "undefined";
}

function validateChannels(channels) {
    return Array.isArray(channels) && channels.every(validateChannel);
}

function createChannelElement(channel) {
    const { channelId: channelId, channelName: channelName, isTextChannel: isTextChannel } = channel;

    if (isChannelExist(channelId)) return;

    const channelButton = createChannelButton(channelId, channelName, isTextChannel);
    const contentWrapper = createContentWrapper(channel, channelName, isTextChannel);
    
    channelButton.appendChild(contentWrapper);
    appendToChannelContextList(channelId);
    channelsUl.appendChild(channelButton);

    addEventListeners(channelButton, channelId, isTextChannel, channel);
    handleChannelChangeOnLoad(channel, channelId);
}


function addChannel(channel) {
    const channelId = channel.channelId;
    const guildId = channel.guildId;
    const channelName = channel.channelName;
    const isTextChannel = channel.isTextChannel;

    if (!validateChannel({ channelId: channelId, channelName: channelName, isTextChannel: isTextChannel })) {
        console.error("Invalid channel data:", channel);
        return;
    }

    console.log(typeof(channel), channel);
    currentChannels.push(channel);

    cacheInterface.addChannel(guildId, channel);

    removeChannelEventListeners();
    createChannelElement(channel);

    if (currentChannels.length > 1) {
        addChannelEventListeners();
    }
}

function updateChannels(channels) {
    if (!validateChannels(channels)) {
        console.error("Invalid channels format or missing channel data:", channels);
        return;
    }

    console.log("Updating channels with:", channels);

    channelsUl.innerHTML = "";
    if (!isOnMe) {
        disableElement("dm-container-parent");
    }

    removeChannelEventListeners();

    channels.forEach(createChannelElement);

    currentChannels = channels;

    if (currentChannels.length > 1) {
        addChannelEventListeners();
    }
}


function removeChannel(data) {
    const guildId = data.guildId;
    const channelId = data.channelId;
    guildCache.removeChannel(guildId, channelId);

    const channelsArray = cacheInterface.getChannels(guildId);
    currentChannels = channelsArray;
    removeChannelElement(channelId);
    if(currentChannelId == channelId) {
        const firstChannel = channelsArray[0].channelId;
        loadGuild(currentGuildId, firstChannel);
    }
}

function editChannel(data) {
    const guildId = data.guildId;
    const channelId = data.channelId;
    const channelName = data.channelName;
    guildCache.editChannel(guildId, channelId, { channelName: channelName });

    const channelsArray = cacheInterface.getChannels(guildId);
    currentChannels = channelsArray;
}


// voice

function drawVoiceChannelUser(index,userId,channelId,channelButton,allUsersContainer,isTextChannel) {
    
    const userName = getUserNick(userId);
    const userContainer = createEl("li", { className: "channel-button",id : userId });
    userContainer.addEventListener("mouseover", function(event) {
        //mouseHoverChannelButton(userContainer, isTextChannel,channelId);
    });
    userContainer.addEventListener("mouseleave", function(event) {
        //mouseLeaveChannelButton(userContainer, isTextChannel,channelId);
    });


    createUserContext(userId);
    
    userContainer.id = `user-${userId}`;
    const userElement = createEl("img", { style: "width: 25px; height: 25px; border-radius: 50px; position:fixed; margin-right: 170px;" });
    setProfilePic(userElement,userId);
    userContainer.appendChild(userElement);
    userContainer.style.marginTop = index == 0 ? "30px" : "10px";
    userContainer.style.marginLeft = "-220px"; 
    userContainer.style.width = "90%";
    userContainer.style.justifyContent = "center";
    userContainer.style.alignItems = "center";

    const contentWrapper = createEl("div", { className: "content-wrapper" });
    const userSpan = createEl("span", { className: "channelSpan", textContent: userName ,style:"position: fixed;"});
    userSpan.style.color = "rgb(128, 132, 142)";
    userSpan.style.border = "none";
    userSpan.style.width = "auto";

    const muteSpan = createEl("span", { innerHTML: muteHtml });
    const inviteVoiceSpan = createEl("span", { innerHTML: inviteVoiceHtml });
    contentWrapper.appendChild(muteSpan);
    contentWrapper.appendChild(inviteVoiceSpan);
    contentWrapper.style.marginRight = "-115px";
    userContainer.appendChild(userSpan);
    userContainer.appendChild(contentWrapper);
    allUsersContainer.appendChild(userContainer)
    channelButton.appendChild(allUsersContainer);
}


