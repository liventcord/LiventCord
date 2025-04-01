import imageCompression from "browser-image-compression";

import {
  scrollToBottom,
  setHasJustFetchedMessagesFalse,
  setLastSenderID,
  createProfileImageChat,
  getMessageFromChat,
  addEditedIndicator
} from "./chat.ts";
import { hasSharedGuild, guildCache } from "./cache.ts";
import {
  displayCannotSendMessage,
  closeReplyMenu,
  displayStartMessage,
  chatInput,
  chatContent,
  attachmentsTray,
  fileInput,
  currentReplyingTo,
  displayLocalMessage
} from "./chatbar.ts";
import { apiClient, EventType } from "./api.ts";
import {
  getEmojiPath,
  getBeforeElement,
  formatDate,
  disableElement,
  createRandomId,
  createEl
} from "./utils.ts";
import { isOnDm, isOnGuild } from "./router.ts";
import { friendsCache } from "./friends.ts";
import { currentGuildId } from "./guild.ts";
import { constructUserData } from "./popups.ts";
import { maxAttachmentSize } from "./avatar.ts";
import { userManager } from "./user.ts";
import { translations } from "./translations.ts";

const DEFAULT_IMAGE_FORMAT = "image/webp";

interface MessageData {
  messageId: string;
  userId: string;
  content: string;
  channelId?: string | null;
  date: string | null;
  lastEdited?: string | null;
  attachmentUrls?: string | string[];
  replyToId?: string | null;
  isBot: boolean;
  addToTop?: boolean;
  reactionEmojisIds?: string[];
  metadata?: any;
  embeds?: any;
  willDisplayProfile?: boolean;
  isNotSent: boolean;
  replyOf?: string | null;
  replies?: Message[];
  temporaryId?: string;
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
  date: string | null;
  lastEdited: string | null;
  attachmentUrls: string | string[] | undefined;
  replyToId: string | null | undefined;
  isBot: boolean;
  reactionEmojisIds: string[] | undefined;
  addToTop: boolean;
  metadata: any;
  embeds: any;
  willDisplayProfile: boolean;
  isNotSent: boolean;
  replyOf: string | undefined;
  replies: Message[];
  temporaryId: string | undefined;

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
    isNotSent: isSent,
    replyOf,
    replies = [],
    addToTop = false
  }: MessageData) {
    this.messageId = messageId;
    this.userId = userId;
    this.content = content;
    this.channelId = channelId;
    this.date = date;
    this.lastEdited = lastEdited || null;
    this.attachmentUrls = attachmentUrls;
    this.replyToId = replyToId;
    this.isBot = isBot;
    this.reactionEmojisIds = reactionEmojisIds;
    this.addToTop = addToTop;
    this.metadata = metadata;
    this.embeds = embeds;
    this.willDisplayProfile = willDisplayProfile || false;
    this.isNotSent = isSent || false;
    this.replyOf = replyOf || undefined;
    this.replies = replies;
  }
}

function createNewMessageFormData(
  temporaryId: string,
  content: string,
  user_ids?: string[]
): FormData {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("temporaryId", temporaryId);

  if (currentReplyingTo) {
    formData.append("replyToId", currentReplyingTo);
  }

  return formData;
}
function createEditMessageformData(messageId: string, content: string) {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("messageId", messageId);
  return formData;
}

function handleFileProcessing(file: File, formData: FormData): Promise<void> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/webp") {
      formData.append("files[]", file, file.name);
      resolve();
    } else {
      tryCompressAndConvert(file)
        .then((convertedFile: File) => {
          formData.append("files[]", convertedFile, convertedFile.name);
          resolve();
        })
        .catch((error) => {
          console.error(`Failed to process file: ${file.name}`, error);
          formData.append("files[]", file, file.name);
          resolve();
        });
    }
  });
}

async function processFiles(
  files: FileList | null,
  formData: FormData
): Promise<void> {
  if (files) {
    for (let i = 0; i < files.length; i++) {
      await handleFileProcessing(files[i], formData);
    }
  }
}

let messageQueue = Promise.resolve();

export async function sendMessage(content: string, user_ids?: string[]) {
  if (content === "") return;

  if (isOnDm && !canSendMessageToDm(friendsCache.currentDmId)) {
    displayCannotSendMessage(friendsCache.currentDmId, content);
    return;
  }

  const channelId = getChannelId();
  setTimeout(scrollToBottom, 10);

  chatInput.value = "";
  attachmentsTray.innerHTML = "";
  disableElement(attachmentsTray);

  const temporaryId = createRandomId();
  const formData = createNewMessageFormData(temporaryId, content, user_ids);
  await processFiles(fileInput.files, formData);

  fileInput.value = "";

  const additionalData = { guildId: currentGuildId, channelId };

  displayLocalMessage(temporaryId, channelId, content);

  messageQueue = messageQueue.then(async () => {
    try {
      await apiClient.sendForm(
        isOnGuild ? EventType.SEND_MESSAGE_GUILD : EventType.SEND_MESSAGE_DM,
        formData,
        additionalData
      );
      closeReplyMenu();
    } catch (error) {
      console.error("Error Sending File Message:", error);
    }
  });
}
function sendEditMessageRequest(messageId: string, content: string) {
  messageQueue = messageQueue.then(async () => {
    try {
      const formData = createEditMessageformData(messageId, content);
      const channelId = getChannelId();

      const additionalData = { guildId: currentGuildId, channelId, messageId };
      await apiClient.sendForm(
        isOnGuild ? EventType.EDIT_MESSAGE_GUILD : EventType.EDIT_MESSAGE_DM,
        formData,
        additionalData
      );
      closeReplyMenu();
    } catch (error) {
      console.error("Error Sending File Message:", error);
    }
  });
}

function canSendMessageToDm(dmId: string): boolean {
  return friendsCache.isFriend(dmId) || hasSharedGuild(dmId);
}

function getChannelId(): string {
  return isOnDm ? friendsCache.currentDmId : guildCache.currentChannelId;
}

function tryCompressAndConvert(
  file: File,
  targetFormat: string = DEFAULT_IMAGE_FORMAT,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDimension = Math.max(img.width, img.height);
      const options = {
        maxSizeMB: maxAttachmentSize,
        maxWidthOrHeight: maxDimension,
        useWebWorker: true
      };
      imageCompression(file, options)
        .then((compressedFile) =>
          tryConvertToFormat(compressedFile, targetFormat, quality)
        )
        .then(resolve)
        .catch(() => resolve(file));
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

function tryConvertToFormat(
  file: File,
  targetFormat: string,
  quality: number = 1
): Promise<File> {
  return new Promise((resolve) => {
    if (file.type === targetFormat) {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName = file.name.replace(/\.[^/.]+$/, "");
            resolve(
              new File([blob], `${fileName}.${targetFormat.split("/")[1]}`, {
                type: targetFormat,
                lastModified: Date.now()
              })
            );
          } else {
            resolve(file);
          }
        },
        targetFormat,
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
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
  friendId?: string;
  channelId?: string;
  messageId?: string;
  guildId?: string;

  constructor(
    date: Date,
    id: string,
    messageId?: string,
    guildId?: string,
    isDm: boolean = false
  ) {
    this.date = date.toISOString();
    if (isDm) {
      this.friendId = id;
    } else {
      this.channelId = id;
    }
    if (messageId) this.messageId = messageId;
    if (guildId) this.guildId = guildId;
  }
}

export function getOldMessages(date: Date, messageId?: string) {
  const request = new GetMessagesRequest(
    date,
    isOnDm ? friendsCache.currentDmId : guildCache.currentChannelId,
    messageId,
    isOnGuild ? currentGuildId : undefined,
    isOnDm
  );

  apiClient.send(
    isOnDm
      ? EventType.GET_SCROLL_HISTORY_DM
      : EventType.GET_SCROLL_HISTORY_GUILD,
    request
  );

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
    if (isOnGuild && channelId !== guildCache.currentChannelId) {
      console.log(
        "Condition: isOnGuild and channelId !== guildCache.currentChannelId"
      );
    }
    if (isOnDm && isDm && channelId !== friendsCache.currentDmId) {
      console.log(
        channelId,
        "Condition: isOnDm and isDm and channelId !== friendsCache.currentDmId",
        friendsCache.currentDmId
      );
    }
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
      const nick = userManager.getUserNick(userId);
      const userInfo = constructUserData(userId);

      createProfileImageChat(
        element,
        messageContentElement,
        nick,
        userInfo,
        userId,
        new Date(date),
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
let editMessageCurrentContent: string;

function isThereMultipleMessageContentElements(
  baseMessage: HTMLElement
): boolean {
  // extra condition : if message itself is a profile, return false
  if (baseMessage.querySelector(".profile-pic")) {
    return false;
  }
  const messages = chatContent.querySelectorAll(".message");
  const baseMessageIndex = Array.from(messages).indexOf(baseMessage);

  let profilelessBefore = false;
  let profilelessAfter = false;

  for (let i = 0; i < baseMessageIndex; i++) {
    if (!messages[i].querySelector(".profile-pic")) {
      profilelessBefore = true;
      break;
    }
  }

  for (let i = baseMessageIndex + 1; i < messages.length; i++) {
    if (!messages[i].querySelector(".profile-pic")) {
      profilelessAfter = true;
      break;
    }
  }

  return profilelessBefore || profilelessAfter;
}
export function convertToEditUi(message: HTMLElement) {
  editMessageCurrentContent = message.outerHTML;
  const messageContentElement = message.querySelector(
    "#message-content-element"
  ) as HTMLElement;
  if (!messageContentElement) return;
  const _isThereMultipleMessageContentElements =
    isThereMultipleMessageContentElements(message);

  const editableDiv = createEl("div", {
    className: "edit-message-div base-user-input",
    contentEditable: "true"
  });
  editableDiv.innerText =
    messageContentElement.textContent?.replace(/\s*\([^)]*\)\s*$/, "") || "";

  if (_isThereMultipleMessageContentElements) {
    editableDiv.style.marginLeft = "50px";
  }
  messageContentElement.replaceWith(editableDiv);

  const buttonContainer = createEl("div", {
    className: "edit-message-button-container"
  });

  const saveButton = createEl("a", {
    className: "edit-message-button",
    innerHTML: `<span class="blue-text">Enter</span> <span class="white-text">${translations.getTranslation("save-button-text")}</span>`
  });
  saveButton.onclick = function () {
    messageContentElement.textContent = editableDiv.innerText;
    editableDiv.replaceWith(messageContentElement);
    buttonContainer.remove();
  };

  const cancelButton = createEl("a", {
    className: "edit-message-button",
    innerHTML: `<span class="blue-text">Esc</span> <span class="white-text">${translations.getTranslation("exit-button-text")}</span>`
  });
  cancelButton.onclick = function () {
    message.outerHTML = editMessageCurrentContent;
  };

  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(cancelButton);
  message.appendChild(buttonContainer);

  editableDiv.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      message.outerHTML = editMessageCurrentContent;
      event.preventDefault();
    } else if (event.key === "Enter" && !event.shiftKey) {
      messageContentElement.textContent = editableDiv.innerText;
      sendEditMessageRequest(message.id, editableDiv.innerText);
      editableDiv.replaceWith(messageContentElement);
      buttonContainer.remove();
      addEditedIndicator(messageContentElement);
      event.preventDefault();
    }
  });
}
