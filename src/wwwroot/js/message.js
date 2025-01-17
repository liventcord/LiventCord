let isUnread = false;

class Message {
    constructor({
        messageId,
        userId,
        content,
        channelId = null,
        date,
        lastEdited,
        attachmentUrls,
        replyToId,
        isBot,
        reactionEmojisIds,
        metadata
    }) {
        this.messageId = messageId
        this.userId = userId
        this.content = content
        this.channelId = channelId
        this.date = new Date(date) 
        this.lastEdited = lastEdited
        this.attachmentUrls = attachmentUrls
        this.replyToId = replyToId
        this.isBot = isBot
        this.reactionEmojisIds = reactionEmojisIds
        this.addToTop = false
        this.metadata = metadata
    }

    toDisplayData(replyOf) {
        return {
            messageId: this.messageId,
            userId: this.userId,
            content: this.content,
            channelId: this.channelId,
            date: this.date,
            lastEdited: this.lastEdited,
            attachmentUrls: this.attachmentUrls,
            addToTop: true,
            replyOf,
            willDisplayProfile: true,
            replyToId: this.replyToId,
            isBot: this.isBot,
            reactionEmojisIds: this.reactionEmojisIds,
            metadata: this.metadata
        }
    }
}


async function sendMessage(content, user_ids) {
    if (content == "") { return }
    if(isOnDm && currentDmId && !isFriend(currentDmId) && !hasSharedGuild(currentDmId)) {
        displayCannotSendMessage(content);
        return;
    }
    let channelIdToSend = isOnDm ? currentDmId : currentChannelId;

    setTimeout(() => {
        scrollToBottom();
    }, 10);

    if (fileInput.files.length < 1) {
        const message = {
            guildId: currentGuildId,
            channelId: channelIdToSend,
            content: content,
            attachmentUrls: null,
            replyToId: null,
            reactionEmojisIds: null,
            lastEdited: null
        };
        apiClient.send(EventType.SEND_MESSAGE, message);
        chatInput.value = "";
        closeReplyMenu();
        return;
    } 
    
    try {
        const file = fileInput.files[0];
        fileInput.value = "";
        const formData = new FormData();
        formData.append("file", file);
        formData.append("guildId", currentGuildId);
        formData.append("channelId",channelIdToSend)
        const uploadResponse = await fetch("/upload", {
            method: "POST",
            body: formData
        });
        if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            data.fileName = uploadData.fileName;
            data.type = uploadData.type;
            data.attachmentUrls = uploadData.attachmentUrls;
            data.attachmentId = uploadData.attachmentId;
            console.log("File uploaded successfully:", data.fileName);
            if(isOnGuild) {
                apiClient.send(EventType.SEND_MESSAGE, data);
            } else {
                alertUser("Implement Direct messages ");
            }
            
            chatInput.value = "";
            closeReplyMenu();
            fileImagePreview.innerHTML = "";
            
        } else {
            console.error("Failed to upload file:", uploadResponse.statusText);
        }
        
    } catch (error) {
        console.error("Error Sending File Message:", error);
    }

};
function replaceCustomEmojis(message) {
    let currentCustomEmojis = {};
    if(message) {
        const regex = /<:([^:>]+):(\d+)>/g;
        let message1 = message.replace(regex, (match, emojiName, emojiId) => {
            if (currentCustomEmojis.hasOwnProperty(emojiName)) {
                return `<img src="${getEmojiPath(currentCustomEmojis[emojiName])}" alt="${emojiName}" style="width: 64px; height: 38px; vertical-align: middle;" />`;
            } else {
                return match;
            }
        });
        return message1;
    }
    return message

}
function displayWelcomeMessage(userName,date) {
    const newMessage = createEl("div",{className : "message"});
    const messageContentElement = createEl("div", {id:"message-content-element"});
    const authorAndDate = createEl("div");
    authorAndDate.classList.add("author-and-date");
    const nickElement = createEl("span");
    nickElement.textContent = userName;
    nickElement.classList.add("nick-element");
    authorAndDate.appendChild(nickElement);
    const dateElement = createEl("span");
    dateElement.textContent = getFormattedDate(new Date(date));
    dateElement.classList.add("date-element");
    authorAndDate.appendChild(dateElement);
    newMessage.appendChild(authorAndDate);
    newMessage.appendChild(messageContentElement);
    chatContent.appendChild(newMessage);
    console.log(newMessage.parentNode);
}

function getOldMessages(date,messageId=null) {
    let data = {
        date: date.toString(),
        isDm : isOnDm
    }
    if(messageId) {
        data["messageId"] = messageId;
    }

    data["channelId"] = isOnDm ? currentDmId : currentChannelId;
    if(isOnGuild) {
        data["guildId"] = currentGuildId;
    }
    apiClient.send(EventType.GET_SCROLL_HISTORY,data);
    hasJustFetchedMessages = setTimeout(() => {
        hasJustFetchedMessages = null;
    }, 1000);
}

function getLastSecondMessageDate() {
    const messages = chatContent.children;
    if (messages.length < 2) return  "";

    const secondToLastMessage = messages[messages.length - 2];
    if (secondToLastMessage) {
        const dateGathered = secondToLastMessage.getAttribute("data-date");
        if(dateGathered) {
            const parsedDate = new Date(dateGathered);
            const formattedDate = formatDate(parsedDate);
            return formattedDate;
        }
    }
    return "";
}


function getMessageDate(top=true) {
    const messages = chatContent.children;
    if (messages.length === 0) return null;

    let targetElement = getMessageFromChat(top);
    if (targetElement) {
        const dateGathered = targetElement.getAttribute("data-date");
        const parsedDate = new Date(dateGathered);
        const formattedDate = formatDate(parsedDate);
        return formattedDate;
    } else {
        return null;
    }
}









function deleteLocalMessage(messageId,guildId,channelId,isDm) {
    if(isOnGuild && channelId != currentChannelId || isOnDm && isDm && channelId != currentDmId) { 
        console.error("Can not delete message: ",guildId,channelId, messageId,  currentGuildId,  currentChannelId);
        return; 
    }
    const messages = Array.from(chatContent.children); 

    for (let i = 0; i < messages.length; i++) {
        let element = messages[i];
        if (!element.classList || !element.classList.contains("message")) { continue; }
        const userId = element.dataset.userId;
    
        if (String(element.id) == String(messageId)) {
            console.log("Removing element:", messageId);
            element.remove();
            const foundMsg = getMessageFromChat(false);
            if(foundMsg) {
                lastSenderID = foundMsg.dataset.userId;
            }
        } // Check if the element matches the currentSenderOfMsg and it doesn"t have a profile picture already
        else if (!element.querySelector(".profile-pic") && getBeforeElement(element).dataset.userId != element.dataset.userId) {
            console.log("Creating profile img...");
            const messageContentElement = element.querySelector("#message-content-element");
            const date = element.dataset.date;
            const smallDate = element.querySelector(".small-date-element");
            if(smallDate)  {
                smallDate.remove();
            }
            const nick = getUserNick(userId);
            
            createProfileImageChat(element, messageContentElement, nick, userId, date, true);
            break;
        }
    }
    const dateBars = chatContent.querySelectorAll(".dateBar");

    dateBars.forEach(bar => {
        if (bar === chatContent.lastElementChild) {
            bar.remove();
        }
    });


    if(chatContent.children.length < 2) {
        displayStartMessage();
    }
    
}


