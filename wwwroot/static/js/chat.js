// TODO : Fix messages date orders when rendering



let bottomestChatDateStr;
let lastMessageDate = null; 
let currentLastDate;
let lastSenderID = "";

let unknownReplies = [];

let isLastMessageStart = false;
let chatContentInitHtml;


let isReachedChannelEnd = false;
let isOldMessageCd = false;

const CLYDE_ID = "1";

function createChatScrollButton() {
    let scrollButton = getId("scroll-to-bottom");
    
    if(!chatContainer) chatContainer = getId("chat-container");
    chatContainer.addEventListener("scroll", function() {
        let threshold = window.innerHeight;
        let hiddenContent = chatContainer.scrollHeight - (chatContainer.scrollTop + chatContainer.clientHeight);
        if (hiddenContent > threshold) {
            scrollButton.style.display = "flex"; 
        } else {
            scrollButton.style.display = "none";
        }
    });
    scrollButton.addEventListener("click", function() {
        scrollButton.style.display = "none";
        scrollToBottom();
    });
}
function handleReplies() {
    Object.values(replyCache).forEach(message => {
        const replierElements = Array.from(chatContent.children).filter(element => element.dataset.replyToId == message.messageId);
        console.log(replierElements, message.replies);
        replierElements.forEach(replier => {
            message.replies.forEach(msg => {
                createReplyBar(replier, message.messageId, msg.userId, msg.content, msg.attachmentUrls);
                console.log("Creating replly bar.", replier, message.messageId, msg.userId, msg.content);
            });
        });
    });
}


function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
let hasJustFetchedMessages = false;
let isFetchingOldMessages = false;
let stopFetching = false; 

function getOldMessagesOnScroll() {
    if (isReachedChannelEnd || isOnMe || stopFetching) { return; }
    if (hasJustFetchedMessages) { return; }
    const oldestDate = getMessageDate();
    if (!oldestDate) return;
    if (oldestDate == "1970-01-01 00:00:00.000000+00:00") { return; }
    getOldMessages(oldestDate);
}

async function handleScroll() {
    if (loadingScreen && loadingScreen.style.display === "flex") { return; }

    const buffer = 10; 
    const scrollPosition = chatContainer.scrollTop;
    const isAtTop = scrollPosition <= buffer;

    if (isAtTop && !isFetchingOldMessages && chatContent.children.length > 0) {
        isFetchingOldMessages = true;
        console.log("Fetching old messages...");
        try {
            let continueLoop = true;

            // Prevent further fetching if already fetching
            if (hasJustFetchedMessages || stopFetching) {
                return;
            }

            while (continueLoop) {
                const updatedScrollPosition = chatContainer.scrollTop;

                if (updatedScrollPosition <= buffer) {
                    stopFetching = false;  // Reset stop fetching flag
                    await getOldMessagesOnScroll();
                } else {
                    continueLoop = false; 
                    console.log("Scroll position exceeded threshold.");
                }

                await new Promise(resolve => setTimeout(resolve, 500)); 
            }
        } catch (error) {
            console.error("Error fetching old messages:", error);
        } finally {
            isFetchingOldMessages = false;
            stopFetching = true; // Stop further requests if still at top
            console.log("Fetching complete. Resetting flag.");
        }
    }
}






function handleOldMessagesResponse(data) {
    const { history, oldest_message_date } = data

    if (!Array.isArray(history) || history.length === 0) {
        isReachedChannelEnd = true
        displayStartMessage()
        return
    }

    const repliesList = new Set()
    const oldestMessageDateOnChannel = new Date(oldest_message_date)

    let firstMessageDate = null

    history.forEach((msgData) => {
        const msg = new Message(msgData)
        const displayMessageData = msg.toDisplayData(data.messageId)

        const foundReply = displayChatMessage(displayMessageData)

        if (foundReply) repliesList.add(msg.messageId)

        if (!firstMessageDate || msg.date < firstMessageDate) {
            firstMessageDate = msg.date
        }
    })

    fetchReplies(history, repliesList)

    if (
        !isNaN(firstMessageDate) &&
        firstMessageDate.getTime() === oldestMessageDateOnChannel.getTime()
    ) {
        displayStartMessage()
    } else if (isNaN(oldestMessageDateOnChannel)) {
        console.error("Invalid oldest message date from data.")
    }
}

function handleHistoryResponse(data) {
    if (isChangingPage) {
        console.log("Changing page. Ignoring history response.");
        return;
    }

    isLastMessageStart = false;
    currentMessagesCache = {};

    const { messages, channelId, guildId, oldestMessageDate } = data;

    if (!Array.isArray(messages) || messages.length === 0) {
        displayStartMessage();
        return;
    }

    if (guildId !== currentGuildId) console.warn("History guild ID is different from current guild");
    if (channelId !== currentChannelId)
        console.warn("History channel ID is different from current channel");

    cacheInterface.setMessages(guildId, guildId, messages);

    const firstMessageDateOnChannel = new Date(oldestMessageDate);
    const repliesList = new Set();

    chatContainer.style.overflow = 'hidden';

    messages.forEach((msgData) => {
        const msg = new Message(msgData);
        const foundReply = displayChatMessage(msg);

        if (foundReply) {
            repliesList.add(msg.messageId);
            unknownReplies.pop(msg.messageId);
        }
    });

    fetchReplies(messages, repliesList);

    const checkRenderCompletion = setInterval(() => {
        if (chatContainer.scrollHeight > 0) {
            chatContainer.scrollTop = chatContainer.scrollHeight;

            chatContainer.style.overflow = '';

            clearInterval(checkRenderCompletion);
        }
    }, 50); 

    if (
        messages[0]?.Date &&
        new Date(messages[0].Date).getTime() === firstMessageDateOnChannel.getTime()
    ) {
        displayStartMessage();
    }
}







function createDateBar(currentDate) {
    const formattedDate = new Date(currentDate).toLocaleDateString(translations.getLocale(), {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    const datebar = createEl("span",{className:"dateBar", textContent:formattedDate});
    chatContent.appendChild(datebar);
}
function createProfileImageChat(newMessage, messageContentElement, nick, userId, date, isBot, isAfterDeleting=false,replyBar) {
    if(!messageContentElement) {
        console.error("No msg content element. ", replyBar); return;
    }
    const profileImg = createEl("img", { className: "profile-pic", id: userId });
    setProfilePic(profileImg,userId);
    
    profileImg.style.width = "40px";
    profileImg.style.height = "40px";
    profileImg.dataset.userId = userId;
    appendToProfileContextList(userId);

    profileImg.addEventListener("mouseover", function() { this.style.borderRadius = "0px"; });
    profileImg.addEventListener("mouseout", function() { this.style.borderRadius = "25px"; });

    const authorAndDate = createEl("div");
    authorAndDate.classList.add("author-and-date");
    const nickElement = createEl("span");
    nickElement.textContent = nick;
    nickElement.classList.add("nick-element");
    if(isBot) {
        const botSign = createEl("span",{className: "botSign"});
        authorAndDate.appendChild(botSign);
    }
    authorAndDate.appendChild(nickElement);
    const messageDate = new Date(date);
    const dateElement = createEl("span");
    dateElement.textContent = getFormattedDate(messageDate);
    dateElement.classList.add("date-element");
    authorAndDate.appendChild(dateElement);
    if(replyBar) {
        newMessage.appendChild(profileImg);
        newMessage.appendChild(authorAndDate);

        newMessage.appendChild(messageContentElement);
        
        const mediaElement = newMessage.querySelector(".imageElement");
        if(mediaElement) {
            messageContentElement.appendChild(mediaElement);
        }
        if(replyBar ) {
            newMessage.insertBefore(replyBar, newMessage.firstChild);
        }
        newMessage.classList.add("replier");
    } else {
        
        if (isAfterDeleting) {
            newMessage.appendChild(profileImg);
            newMessage.appendChild(authorAndDate);
            newMessage.appendChild(messageContentElement);
            const mediaElement = newMessage.querySelector(".imageElement");
            if(mediaElement && messageContentElement) {
                messageContentElement.appendChild(mediaElement);
            }
    
        } else {
            newMessage.appendChild(profileImg);
            newMessage.appendChild(authorAndDate);

            newMessage.appendChild(messageContentElement);

            
        }
    }
    setProfilePic(profileImg,userId);

    
    messageContentElement.classList.add("onsmallprofile");

    
}
function createOptions3Button(message,messageId,userId) {
    const button = createMsgOptionButton(message,false);
    button.dataset.m_id = messageId;
    appendToMessageContextList(messageId,userId);
}
function displayChatMessage(data) {
    if (!data) return;

    const messageId = data.messageId;
    const userId = data.userId;
    const content = data.content;
    const channelId = data.channelId;
    let date = data.date;
    const lastEdited = data.lastEdited;
    const attachmentUrls = data.attachmentUrls;
    const replyToId = data.replyToId;
    const reactionEmojisIds = data.reactionEmojisIds;
    const addToTop = data.addToTop;
    const isBot = data.isBot;
    const replyOf = data.replyOf;

    if(currentMessagesCache[messageId])  {
        //console.log("Skipping adding message:", content);
        return;
    }
    if (!channelId || !date ) {return; }
    if (!attachmentUrls && content == ""){ return; }



    const nick = getUserNick(userId);
    const newMessage = createEl("div",{className : "message"});
    const messageContentElement = createEl("p", {id:"message-content-element"});

    currentMessagesCache[messageId] = newMessage;
    messages_raw_cache[messageId] = data;
    
    let isCreatedProfile = false;
    if (addToTop) {
        if(willDisplayProfile) {
            isCreatedProfile = true;
            createProfileImageChat(newMessage, messageContentElement, nick, userId, date, isBot);
        } else {
            createNonProfileImage(newMessage, date);
        }
    } else {
        const currentDate = new Date(date).setHours(0, 0, 0, 0); 
        if (lastMessageDate === null || lastMessageDate !== currentDate) {
            createDateBar(currentDate);
            lastMessageDate = currentDate;
        }
        let difference = new Date(bottomestChatDateStr).getTime() - new Date(date).getTime();
        difference = Math.abs(difference) / 1000;
        let isTimeGap = false;
        if (bottomestChatDateStr && difference > 300) {
            isTimeGap = true;
        }
        
        if(!lastSenderID || isTimeGap || replyToId) {
            isCreatedProfile = true;
            createProfileImageChat(newMessage, messageContentElement, nick, userId, date, isBot);
        }
        else {
            if (lastSenderID != userId || isTimeGap) {
                isCreatedProfile = true;
                createProfileImageChat(newMessage, messageContentElement, nick, userId, date, isBot);
            } else {
                createNonProfileImage(newMessage, date);
            }
        }
        bottomestChatDateStr = date;
    }
    let formattedMessage = replaceCustomEmojis(content);
    if (isURL(content)) {formattedMessage = "";  }
    messageContentElement.style.position = "relative";
    messageContentElement.style.wordBreak = "break-all";
    newMessage.id = messageId;
    newMessage.dataset.userId =  userId;
    newMessage.dataset.date =  date;
    newMessage.dataset.content =  content;
    newMessage.dataset.attachmentUrls = attachmentUrls;
    newMessage.dataset.replyToId = replyToId;
    newMessage.dataset.messageId = messageId;
    messageContentElement.dataset.content_observe = formattedMessage;
    observer.observe(messageContentElement);
    newMessage.appendChild(messageContentElement);
    createMediaElement(content, messageContentElement,newMessage, attachmentUrls);
    if(currentLastDate) {
        if(date < currentLastDate) {
            date = currentLastDate;
        }
    } else {
        currentLastDate = date;
    }

    if (!addToTop) { 
        lastSenderID = userId;
    } else {
        lastTopSenderId = userId;
    }
    if(userId != currentUserId) {
        createMsgOptionButton(newMessage,true);
    }
    createOptions3Button(newMessage,messageId,userId);
    if(isLastMessageStart) {isLastMessageStart = false; }
    if (addToTop) {
        chatContent.insertBefore(newMessage, chatContent.firstChild);
        chatContainer.scrollTop = chatContainer.scrollTop + newMessage.clientHeight;
    } else {
        chatContent.appendChild(newMessage);
        const previousSibling = newMessage.previousElementSibling
        if(previousSibling) {
            const previousMsgContent = previousSibling.querySelector("#message-content-element");
            if (isCreatedProfile && previousMsgContent && previousMsgContent.classList.contains("onsmallprofile")) {
                newMessage.classList.add("profile-after-profile");
            }

        }
    }

    if(userId == CLYDE_ID) {
        const youCanSeeText = createEl("p",{textContent : "Bunu sadece sen görebilirsin."});
        youCanSeeText.style.fontSize = "12px";
        youCanSeeText.style.color = "rgb(148, 155, 164)";

        const parentElement = createEl("div",{display:"flex", flexDirection: "column",zIndex: 1});
        parentElement.style.height = "100%";

        parentElement.appendChild(messageContentElement);

        parentElement.appendChild(youCanSeeText)
        newMessage.appendChild(parentElement);
    }




    if(replyOf == messageId) {
        setTimeout(() => {
            scrollToMessage(newMessage);
        }, 0);
    }
    if(replyToId) {
        const foundReply = getId(replyToId);
        if(foundReply) {
            createReplyBar(newMessage, foundReply.dataset.messageId,foundReply.dataset.userId,foundReply.dataset.content,foundReply.dataset.attachmentUrls);
        } 
        else {
            unknownReplies.push(data);    
        }
        return foundReply;
    }
    
}
let messageDates = {};

let replyIdToGo = "";
function fetchReplies(messages, repliesList=null,goToOld=false) {
    if(!repliesList) { repliesList = new Set()}
    if(goToOld) {
        const messageId = messages;
        const existingDate = messageDates[messageId];
        if(existingDate) { 
            if(existingDate > currentLastDate) {
                replyIdToGo = messageId;
                getOldMessages(existingDate,messageId);
            }

            return 
        }
        const data = {
            "messageId" : messageId,
            "guildId" : currentGuildId, 
            "channelId" : currentChannelId
        }
        apiClient.send("get_message_date",data);
        return;
    }
    const messagesArray = Array.isArray(messages) ? messages : [messages];

    const replyIds = messagesArray
        .filter(msg => !repliesList.has(msg.messageId) && !replyCache[msg.messageId])
        .filter(msg => msg.replyToId !== undefined && msg.replyToId !== null && msg.replyToId !== "")
        .map(msg => msg.replyToId);

    if (replyIds.length > 0) {
        const data = {
            ids: replyIds,
            guildId: currentGuildId,
            channelId: currentChannelId
        };
        apiClient.send("get_bulk_reply", data);
    }
}

function updateChatWidth() {
    if (getId("user-list").style.display == "none") {
        getId("user-input").classList.add("user-list-hidden");
        getId("gifbtn").classList.add("gifbtn-user-list-hidden");
        getId("emojibtn").classList.add("emojibtn-user-list-hidden");
    } else {
        getId("user-input").classList.remove("user-list-hidden");
        getId("gifbtn").classList.remove("gifbtn-user-list-hidden");
        getId("emojibtn").classList.remove("emojibtn-user-list-hidden");
    }
}

function getMessageFromChat(top = true) {
    const messages = Array.from(chatContent.children);
    const filteredMessages = messages.filter(message => message.classList.contains("message"));


    if (filteredMessages.length === 0) return null;

    if (top) {
        return filteredMessages.reduce((topmost, current) => 
            current.offsetTop < topmost.offsetTop ? current : topmost, 
            filteredMessages[0]
        );
    } else {
        return filteredMessages[filteredMessages.length - 1];
    }
}




function getHistoryFromOneChannel(channelId, isDm = false) {
    console.log("Retrieving history...");
    const messages = cacheInterface.getMessages(currentGuildId,channelId);

    if (!isDm && messages && Array.isArray(messages)) {
        let repliesList = new Set();

        if (messages.length > 0) {
            currentMessagesCache = {};
            for (const msg of messages) {
                const foundReply = displayChatMessage(msg);
                if (foundReply) {
                    repliesList.add(msg.messageId);
                }
            }
            fetchReplies(messages, repliesList);
            return; 

        } else {
            console.warn("No messages found in cache for this channel.");
        }
    }

    fetchMessagesFromServer(channelId, isDm);
}
function fetchMessagesFromServer(channelId, isDm = false) {
    let requestData = {
        channelId: channelId,
        isDm: isDm,
    };
    if (isOnGuild) {
        requestData["guildId"] = currentGuildId;
    }

    hasJustFetchedMessages = setTimeout(() => {
        hasJustFetchedMessages = null;
    }, 1000);

    apiClient.send("get_history", requestData);
}


function createMsgOptionButton(message,isReply) {
    const textc = isReply ? "↪" : "⋯"; 
    
    const newButton = createEl("button",{className:"message-button"});

        const textEl = createEl("div", { textContent: textc, className: "message-button-text" });
        newButton.appendChild(textEl);
    if(isReply) {
        newButton.onclick = function() {
            showReplyMenu(message.id,message.dataset.userId);
        }

    }

    newButton.addEventListener("mousedown", function() {
        newButton.style.border = "2px solid #000000";
    });    
    newButton.addEventListener("mouseup", function() {
        newButton.style.border = "none";
    });
    newButton.addEventListener("mouseover", function() {
        newButton.style.backgroundColor = "#393a3b";
    });    
    newButton.addEventListener("mouseout", function() {
        newButton.style.backgroundColor = "#313338";
    });
    newButton.addEventListener("focus", () => {
        newButton.classList.add("is-focused");
    });
    newButton.addEventListener("blur", () => {
        newButton.classList.remove("is-focused");
    });
    let buttonContainer = message.querySelector(".message-button-container");
    if (!buttonContainer) {
        buttonContainer = createEl("div");
        buttonContainer.classList.add("message-button-container");
        message.appendChild(buttonContainer);
    }

    buttonContainer.appendChild(newButton);
    return newButton;
}

function createNonProfileImage(newMessage,  date) {
    const messageDate = new Date(date);
    const smallDateElement = createEl("p");
    smallDateElement.className = "small-date-element";
    smallDateElement.textContent = getFormattedDateForSmall(messageDate);
    newMessage.appendChild(smallDateElement);
    smallDateElement.style.position = "absolute"; 
    smallDateElement.style.marginLeft = "5px"; 

    return smallDateElement;
}