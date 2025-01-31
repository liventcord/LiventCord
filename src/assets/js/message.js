import {
  scrollToBottom,
  setHasJustFetchedMessagesFalse,
  setLastSenderID,
  createProfileImageChat,
} from "./chat";
import { hasSharedGuild } from "./cache";
import {
  displayCannotSendMessage,
  closeReplyMenu,
  displayStartMessage,
  chatInput,
  chatContent,
  fileImagePreview,
  fileInput,
  currentReplyingTo,
  displayLocalMessage,
} from "./chatbar";
import { apiClient, EventType } from "./api";
import {
  createEl,
  getEmojiPath,
  getFormattedDate,
  getBeforeElement,
} from "./utils";
import { getUserNick } from "./user";
import { isOnDm } from "./router";
import { friendCache } from "./friends";
import { guildCache } from "./cache";
import { currentGuildId } from "./guild";
import { isOnGuild } from "./router";
import { formatDate } from "./utils";
import { getMessageFromChat } from "./chat";

export class Message {
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
    metadata,
  }) {
    this.messageId = messageId;
    this.userId = userId;
    this.content = content;
    this.channelId = channelId;
    this.date = new Date(date);
    this.lastEdited = lastEdited;
    this.attachmentUrls = attachmentUrls;
    this.replyToId = replyToId;
    this.isBot = isBot;
    this.reactionEmojisIds = reactionEmojisIds;
    this.addToTop = false;
    this.metadata = metadata;
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
      metadata: this.metadata,
    };
  }
}

export async function sendMessage(content, user_ids) {
  if (content === "") {
    return;
  }

  if (
    isOnDm &&
    friendCache.currentDmId &&
    !friendCache.isFriend(friendCache.currentDmId) &&
    !hasSharedGuild(friendCache.currentDmId)
  ) {
    displayCannotSendMessage(friendCache.currentDmId, content);
    return;
  }

  let channelIdToSend = isOnDm
    ? friendCache.currentDmId
    : guildCache.currentChannelId;
  displayLocalMessage(channelIdToSend, content);

  setTimeout(scrollToBottom, 10);

  if (fileInput.files.length < 1) {
    const message = {
      guildId: currentGuildId,
      channelId: channelIdToSend,
      content: content,
      attachmentUrls: null,
      replyToId: null,
      reactionEmojisIds: null,
      lastEdited: null,
    };
    apiClient.send(EventType.SEND_MESSAGE_GUILD, message);
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
    formData.append("channelId", channelIdToSend);

    const uploadResponse = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      const messageData = {
        guildId: currentGuildId,
        channelId: channelIdToSend,
        content: content,
        attachmentUrls: uploadData.attachmentUrls,
        attachmentId: uploadData.attachmentId,
        fileName: uploadData.fileName,
        type: uploadData.type,
        replyToId: currentReplyingTo,
        reactionEmojisIds: null,
        lastEdited: null,
      };

      console.log("File uploaded successfully:", uploadData.fileName);

      if (isOnGuild) {
        apiClient.send(EventType.SEND_MESSAGE_GUILD, messageData);
      } else {
        apiClient.send(EventType.SEND_MESSAGE_DM, messageData);
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
}

export function replaceCustomEmojis(message) {
  let currentCustomEmojis = {};
  if (message) {
    const regex = /<:([^:>]+):(\d+)>/g;
    let message1 = message.replace(regex, (match, emojiName, emojiId) => {
      if (currentCustomEmojis.hasOwnProperty(emojiName)) {
        return `<img src="${getEmojiPath(
          currentCustomEmojis[emojiName],
        )}" alt="${emojiName}" style="width: 64px; height: 38px; vertical-align: middle;" />`;
      } else {
        return match;
      }
    });
    return message1;
  }
  return message;
}
export function displayWelcomeMessage(userName, date) {
  const newMessage = createEl("div", { className: "message" });
  const messageContentElement = createEl("div", {
    id: "message-content-element",
  });
  const authorAndDate = createEl("div", { className: "author-and-date" });
  const nickElement = createEl("span", { textContent: userName });
  nickElement.classList.add("nick-element");
  authorAndDate.appendChild(nickElement);
  const dateElement = createEl("span", {
    className: "date-element",
    textContent: getFormattedDate(new Date(date)),
  });
  authorAndDate.appendChild(dateElement);
  newMessage.appendChild(authorAndDate);
  newMessage.appendChild(messageContentElement);
  chatContent.appendChild(newMessage);
}

export function getOldMessages(date, messageId = null) {
  let data = {
    date: date.toString(),
    isDm: isOnDm,
  };
  if (messageId) {
    data["messageId"] = messageId;
  }

  data["channelId"] = isOnDm
    ? friendCache.currentDmId
    : guildCache.currentChannelId;
  if (isOnGuild) {
    data["guildId"] = currentGuildId;
  }
  apiClient.send(EventType.GET_SCROLL_HISTORY, data);
  setTimeout(() => {
    setHasJustFetchedMessagesFalse();
  }, 1000);
}

export function getLastSecondMessageDate() {
  const messages = chatContent.children;
  if (messages.length < 2) return "";

  const secondToLastMessage = messages[messages.length - 2];
  if (secondToLastMessage) {
    const dateGathered = secondToLastMessage.getAttribute("data-date");
    if (dateGathered) {
      const parsedDate = new Date(dateGathered);
      const formattedDate = formatDate(parsedDate);
      return formattedDate;
    }
  }
  return "";
}

export function getMessageDate(top = true) {
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

export function deleteLocalMessage(messageId, guildId, channelId, isDm) {
  if (
    (isOnGuild && channelId !== guildCache.currentChannelId) ||
    (isOnDm && isDm && channelId !== friendCache.currentDmId)
  ) {
    console.error(
      "Can not delete message: ",
      guildId,
      channelId,
      messageId,
      currentGuildId,
      guildCache.currentChannelId,
    );
    return;
  }
  const messages = Array.from(chatContent.children);

  for (let i = 0; i < messages.length; i++) {
    let element = messages[i];
    if (!element.classList || !element.classList.contains("message")) {
      continue;
    }
    const userId = element.dataset.userId;

    if (String(element.id) === String(messageId)) {
      console.log("Removing element:", messageId);
      element.remove();
      const foundMsg = getMessageFromChat(false);
      if (foundMsg) {
        setLastSenderID(foundMsg.dataset.userId);
      }
    } // Check if the element matches the currentSenderOfMsg and it doesn"t have a profile picture already
    else if (
      !element.querySelector(".profile-pic") &&
      getBeforeElement(element).dataset.userId !== element.dataset.userId
    ) {
      console.log("Creating profile img...");
      const messageContentElement = element.querySelector(
        "#message-content-element",
      );
      const date = element.dataset.date;
      const smallDate = element.querySelector(".small-date-element");
      if (smallDate) {
        smallDate.remove();
      }
      const nick = getUserNick(userId);

      createProfileImageChat(
        element,
        messageContentElement,
        nick,
        userId,
        date,
        true,
      );
      break;
    }
  }
  const dateBars = chatContent.querySelectorAll(".dateBar");

  dateBars.forEach((bar) => {
    if (bar === chatContent.lastElementChild) {
      bar.remove();
    }
  });

  if (chatContent.children.length < 2) {
    displayStartMessage();
  }
}
