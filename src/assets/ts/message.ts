import {
  scrollToBottom,
  setHasJustFetchedMessagesFalse,
  setLastSenderID,
  createProfileImageChat,
  getMessageFromChat
} from "./chat.ts";
import { hasSharedGuild, guildCache } from "./cache.ts";
import {
  displayCannotSendMessage,
  closeReplyMenu,
  displayStartMessage,
  chatInput,
  chatContent,
  fileImagePreview,
  fileInput,
  currentReplyingTo,
  displayLocalMessage
} from "./chatbar.ts";
import { apiClient, EventType } from "./api.ts";
import { getEmojiPath, getBeforeElement, formatDate } from "./utils.ts";
import { getUserNick } from "./user.ts";
import { isOnDm, isOnGuild } from "./router.ts";
import { friendsCache } from "./friends.ts";
import { currentGuildId } from "./guild.ts";
import { constructUserData } from "./popups.ts";

interface MessageData {
  messageId: string;
  userId: string;
  content: string;
  channelId?: string | null;
  date: string | Date;
  lastEdited?: string | null;
  attachmentUrls?: string | string[];
  replyToId?: string | null;
  isBot: boolean;
  reactionEmojisIds?: string[];
  metadata?: any;
  embeds?: any;
  willDisplayProfile?: boolean;
  replyOf?: string | null;
  replies?: Message[];
}

export interface MessageReply {
  messageId: string;
  replies: Message[];
}
export class Message {
  messageId: string;
  userId: string;
  content: string;
  channelId: string | null;
  date: Date;
  lastEdited: string | null;
  attachmentUrls: string | string[] | undefined;
  replyToId: string | null | undefined;
  isBot: boolean;
  reactionEmojisIds: string[] | undefined;
  addToTop: boolean;
  metadata: any;
  embeds: any;
  willDisplayProfile: boolean;
  replyOf: string | undefined;
  replies: Message[];

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
    embeds,
    willDisplayProfile,
    replyOf,
    replies = []
  }: MessageData) {
    this.messageId = messageId;
    this.userId = userId;
    this.content = content;
    this.channelId = channelId;
    this.date = new Date(date);
    this.lastEdited = lastEdited || null;
    this.attachmentUrls = attachmentUrls;
    this.replyToId = replyToId;
    this.isBot = isBot;
    this.reactionEmojisIds = reactionEmojisIds;
    this.addToTop = false;
    this.metadata = metadata;
    this.embeds = embeds;
    this.willDisplayProfile = willDisplayProfile || false;
    this.replyOf = replyOf || undefined;
    this.replies = replies;
  }
}

export async function sendMessage(content: string, user_ids?: string[]) {
  if (content === "") {
    return;
  }

  if (
    isOnDm &&
    friendsCache.currentDmId &&
    !friendsCache.isFriend(friendsCache.currentDmId) &&
    !hasSharedGuild(friendsCache.currentDmId)
  ) {
    displayCannotSendMessage(friendsCache.currentDmId, content);
    return;
  }

  const channelIdToSend = isOnDm
    ? friendsCache.currentDmId
    : guildCache.currentChannelId;
  displayLocalMessage(channelIdToSend, content);

  setTimeout(scrollToBottom, 10);
  const files = fileInput.files;
  if (files && files.length < 1) {
    const message = {
      guildId: currentGuildId,
      channelId: channelIdToSend,
      content,
      attachmentUrls: null,
      replyToId: null,
      reactionEmojisIds: null
    };
    apiClient.send(EventType.SEND_MESSAGE_GUILD, message);
    chatInput.value = "";
    closeReplyMenu();
    return;
  }
  if (!files) return;

  try {
    const file = files[0];
    fileInput.value = "";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("guildId", currentGuildId);
    formData.append("channelId", channelIdToSend);

    const uploadResponse = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      const messageData = {
        guildId: currentGuildId,
        channelId: channelIdToSend,
        content,
        attachmentUrls: uploadData.attachmentUrls,
        attachmentId: uploadData.attachmentId,
        fileName: uploadData.fileName,
        type: uploadData.type,
        replyToId: currentReplyingTo,
        reactionEmojisIds: null,
        lastEdited: null
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

export function replaceCustomEmojis(content: string) {
  const currentCustomEmojis: { [emojiName: string]: string } = {};

  if (content) {
    const regex = /<:([^:>]+):(\d+)>/g;
    const message1 = content.replace(regex, (match, emojiName, emojiId) => {
      if (currentCustomEmojis.hasOwnProperty(emojiName)) {
        return `<img src="${getEmojiPath(
          currentCustomEmojis[emojiName]
        )}" alt="${emojiName}" style="width: 64px; height: 38px; vertical-align: middle;" />`;
      } else {
        return match;
      }
    });
    return message1;
  }
  return content;
}
class GetMessagesRequest {
  date: string;
  isDm: boolean;
  channelId: string;
  messageId?: string;
  isBot: boolean;
  guildId?: string;

  constructor(
    date: Date,
    isDm: boolean,
    channelId: string,
    messageId?: string,
    guildId?: string
  ) {
    this.date = date.toString();
    this.isDm = isDm;
    this.channelId = channelId;
    this.messageId = messageId;
    this.isBot = false;
    this.guildId = guildId;
  }
}

export function getOldMessages(date: Date, messageId?: string) {
  const request = new GetMessagesRequest(
    date,
    isOnDm,
    isOnDm ? friendsCache.currentDmId : guildCache.currentChannelId,
    messageId,
    isOnGuild ? currentGuildId : undefined
  );

  apiClient.send(EventType.GET_SCROLL_HISTORY, request);

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

  const targetElement = getMessageFromChat(top);
  if (targetElement) {
    const dateGathered = targetElement.getAttribute("data-date") as string;
    const parsedDate = new Date(dateGathered);
    const formattedDate = formatDate(parsedDate);
    return formattedDate;
  } else {
    return null;
  }
}

export function deleteLocalMessage(
  messageId: string,
  guildId: string,
  channelId: string,
  isDm: boolean
) {
  if (
    (isOnGuild && channelId !== guildCache.currentChannelId) ||
    (isOnDm && isDm && channelId !== friendsCache.currentDmId)
  ) {
    console.error(
      "Can not delete message: ",
      guildId,
      channelId,
      messageId,
      currentGuildId,
      guildCache.currentChannelId
    );
    return;
  }

  const messages = Array.from(chatContent.children);

  for (let i = 0; i < messages.length; i++) {
    const element = messages[i] as HTMLElement;
    if (!element.classList || !element.classList.contains("message")) {
      continue;
    }
    const userId = element.dataset.userId as string;

    if (String(element.id) === String(messageId)) {
      console.log("Removing element:", messageId);
      element.remove();
      const foundMsg = getMessageFromChat(false);
      if (foundMsg) {
        setLastSenderID(foundMsg.dataset.userId as string);
      }
    } else if (
      // Check if the element matches the currentSenderOfMsg and it doesn"t have a profile picture already
      !element.querySelector(".profile-pic") &&
      getBeforeElement(element) &&
      getBeforeElement(element)!.dataset.userId !== element.dataset.userId
    ) {
      console.log("Creating profile img...");
      const messageContentElement = element.querySelector(
        "#message-content-element"
      ) as HTMLElement;
      const date = element.dataset.date as string;
      const smallDate = element.querySelector(".small-date-element");
      if (smallDate) {
        smallDate.remove();
      }
      const nick = getUserNick(userId);
      const userInfo = constructUserData(userId);

      createProfileImageChat(
        element,
        messageContentElement,
        nick,
        userInfo,
        userId,
        date,
        true
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
