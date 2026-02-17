import {
  scrollToBottom,
  setHasJustFetchedMessagesFalse,
  createProfileImageChat,
  getMessageFromChat,
  addEditedIndicator,
  displayCannotSendMessage,
  displayLocalMessage,
  displayStartMessage
} from "./chat.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import {
  closeReplyMenu,
  chatInput,
  chatContent,
  attachmentsTray,
  fileInput,
  currentReplyingTo,
  resetChatInputState,
  manuallyRenderEmojis
} from "./chatbar.ts";
import { apiClient, EventType } from "./api.ts";
import {
  getBeforeElement,
  formatDate,
  disableElement,
  createRandomId,
  createEl,
  enableElement,
  isMobile
} from "./utils.ts";
import { isOnDm, isOnGuild } from "./router.ts";
import { friendsCache } from "./friends.ts";
import { currentGuildId } from "./guild.ts";
import { maxAttachmentSize } from "./avatar.ts";
import { userManager } from "./user.ts";
import { translations } from "./translations.ts";
import { maxAttachmentsCount } from "./mediaElements.ts";
import { shakeScreen } from "./settingsui.ts";
import { processDeleteMessage } from "./socketEvents.ts";
import { FileHandler, fileSpoilerMap } from "./fileHandler.ts";
import { constructUserData } from "./profilePop.ts";
export let lastMessageDate: Date;

let lastSenderID = "";
export function setLastSenderID(id: string) {
  lastSenderID = id;
}
export function setLastMessageDate(date: Date) {
  lastMessageDate = date;
}
const DEFAULT_IMAGE_FORMAT = "image/webp";

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

async function handleFileProcessing(
  file: File,
  formData: FormData
): Promise<void> {
  if (file.type === "image/webp") {
    formData.append("files[]", file, file.name);
    return;
  }

  const isImage = await FileHandler.isImageFile(file);

  if (isImage) {
    try {
      const convertedFile = await tryCompressAndConvert(file);
      formData.append("files[]", convertedFile, convertedFile.name);
    } catch {
      formData.append("files[]", file, file.name);
    }
  } else {
    formData.append("files[]", file, file.name);
  }
}

async function processFiles(
  files: FileList | null,
  formData: FormData
): Promise<void> {
  if (files) {
    const fileCount = Math.min(files.length, maxAttachmentsCount);
    const uploadedFiles: File[] = [];

    for (let i = 0; i < fileCount; i++) {
      const file = files[i];
      await handleFileProcessing(file, formData);
      uploadedFiles.push(file);
    }

    for (const file of uploadedFiles) {
      const isSpoiler = fileSpoilerMap.get(file) ?? false;
      formData.append("isSpoiler[]", String(isSpoiler));
    }
  }
}
let messageQueue = Promise.resolve();

export const MESSAGE_LIMIT = 2000;

export async function trySendMessage(
  content: string,
  user_ids?: string[]
): Promise<boolean> {
  const trimmedContent = content.trim();
  const hasContent = trimmedContent.length > 0;
  const hasFiles = fileInput?.files && fileInput.files.length > 0;

  if (!hasContent && !hasFiles) return false;
  if (trimmedContent.length > MESSAGE_LIMIT) {
    shakeScreen(chatInput);
    return false;
  }
  if (isOnDm && !canSendMessageToDm(friendsCache.currentDmId)) {
    displayCannotSendMessage(friendsCache.currentDmId, content);
    return false;
  }

  await sendMessage(trimmedContent, user_ids);
  return true;
}

async function sendMessage(content: string, user_ids?: string[]) {
  chatInput.textContent = "";
  resetChatInputState();

  attachmentsTray.innerHTML = "";
  disableElement(attachmentsTray);

  const temporaryId = createRandomId();
  const formData = createNewMessageFormData(temporaryId, content, user_ids);
  await processFiles(fileInput.files, formData);
  FileHandler.resetFileInput();

  const additionalData = constructMessagePayload();
  const channelId = getChannelId();
  displayLocalMessage(temporaryId, channelId, content);

  sendNewMessageRequest(formData, additionalData);
  scrollToBottom();
  setTimeout(scrollToBottom, 130);
}

function constructMessagePayload(messageId?: string) {
  const channelId = getChannelId();
  return {
    guildId: currentGuildId,
    channelId,
    friendId: friendsCache.currentDmId,
    messageId
  };
}

function sendNewMessageRequest(formData: FormData, additionalData: any) {
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
      let additionalData: any = {
        messageId,
        friendId: friendsCache.currentDmId,
        content
      };

      if (isOnGuild) {
        const channelId = getChannelId();
        additionalData = {
          ...additionalData,
          channelId,
          guildId: currentGuildId
        };
      }

      await apiClient.send(
        isOnGuild ? EventType.EDIT_MESSAGE_GUILD : EventType.EDIT_MESSAGE_DM,
        additionalData
      );
      closeReplyMenu();
    } catch (error) {
      console.error("Error Sending File Message:", error);
    }
  });
}

export function deleteMessage(messageId: string) {
  console.log("Deleting message ", messageId);

  const isDm = !isOnGuild;
  processDeleteMessage(
    new Date().toISOString(),
    guildCache.currentChannelId,
    messageId,
    isDm
  );

  const data = constructMessagePayload(messageId);
  if (isOnGuild) {
    data["guildId"] = currentGuildId;
  }

  const _eventType = isOnGuild
    ? EventType.DELETE_MESSAGE_GUILD
    : EventType.DELETE_MESSAGE_DM;

  apiClient.send(_eventType, data);
}

function canSendMessageToDm(dmId: string): boolean {
  return friendsCache.isFriend(dmId) || cacheInterface.hasSharedGuild(dmId);
}

function getChannelId(): string {
  return isOnDm ? friendsCache.currentDmId : guildCache.currentChannelId;
}

async function tryCompressAndConvert(
  file: File,
  targetFormat: string = DEFAULT_IMAGE_FORMAT,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const { default: imageCompression } =
        await import("browser-image-compression");

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
    if (messageId) {
      this.messageId = messageId;
    }
    if (guildId) {
      this.guildId = guildId;
    }
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

  const event = isOnDm
    ? EventType.GET_SCROLL_HISTORY_DM
    : EventType.GET_SCROLL_HISTORY_GUILD;

  apiClient.send(event, request, {
    date: date.toISOString(),
    ...(messageId && { messageId })
  });

  setTimeout(() => {
    setHasJustFetchedMessagesFalse();
  }, 1000);
}

export function getLastSecondMessageDate() {
  const messages = chatContent.children;
  if (messages.length < 2) {
    return "";
  }

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
  if (messages.length === 0) {
    return null;
  }

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
let currentEditUiMessageId = "";
export function convertToEditUi(message: HTMLElement) {
  if (currentEditUiMessageId === message.id) return;

  editMessageCurrentContent = message.outerHTML;
  currentEditUiMessageId = message.id;

  const messageContentElement = message.querySelector(
    "#message-content-element"
  ) as HTMLElement;

  if (!messageContentElement) {
    currentEditUiMessageId = "";
    return;
  }

  const hasMultiple = isThereMultipleMessageContentElements(message);
  const editMessageDiv = createEditDiv(messageContentElement);

  let container: HTMLElement;

  if (isMobile) {
    container = createMobileWrapper(editMessageDiv);
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target && target.className === "outer-parent") {
        currentEditUiMessageId = "";
        target.remove();
      }
    });

    if (hasMultiple) {
      container.style.marginLeft = "50px";
    }

    document.body.appendChild(container);
  } else {
    container = editMessageDiv;

    if (hasMultiple) {
      container.style.marginLeft = "50px";
    }

    messageContentElement.appendChild(editMessageDiv);
  }

  const buttonContainer = createButtonContainer(
    () => saveEdit(message, messageContentElement, container, buttonContainer),
    () => cancelEdit(message)
  );

  if (buttonContainer) {
    message.appendChild(buttonContainer);
  }

  container.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      cancelEdit(message);
      event.preventDefault();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      saveEdit(message, messageContentElement, container, buttonContainer);
    }
  });
}

function createEditDiv(contentElement: HTMLElement) {
  const div = createEl("div", {
    className: "edit-message-div base-user-input",
    contentEditable: "true"
  });
  div.innerText =
    contentElement.parentElement?.dataset.content?.replace(
      /\s*\([^)]*\)\s*$/,
      ""
    ) || "";
  return div;
}

function createMobileWrapper(child: HTMLElement) {
  const wrapper = createEl("div", { className: "outer-parent" });
  enableElement(wrapper);
  wrapper.appendChild(child);
  return wrapper;
}

function createButtonContainer(onSave: () => void, onCancel: () => void) {
  if (isMobile) {
    return null;
  }

  const container = createEl("div", {
    className: "edit-message-button-container"
  });

  const saveButton = createEl("a", {
    className: "edit-message-button",
    innerHTML: `<span class="blue-text">Enter</span> <span class="white-text">${translations.getTranslation("save-button-text")}</span>`
  });

  const cancelButton = createEl("a", {
    className: "edit-message-button",
    innerHTML: `<span class="blue-text">Esc</span> <span class="white-text">${translations.getTranslation("exit-button-text")}</span>`
  });

  saveButton.onclick = onSave;
  cancelButton.onclick = onCancel;

  container.appendChild(saveButton);
  container.appendChild(cancelButton);
  return container;
}
function saveEdit(
  message: HTMLElement,
  originalContentElement: HTMLElement,
  container: HTMLElement,
  buttonContainer: HTMLElement | null
) {
  const newText = container.innerText;
  const currentText = originalContentElement.textContent ?? "";

  if (newText === currentText) {
    container.remove();
    if (buttonContainer) {
      buttonContainer.remove();
    }
    currentEditUiMessageId = "";
    return;
  }

  container.remove();
  if (buttonContainer) {
    buttonContainer.remove();
  }

  originalContentElement.textContent = "";
  manuallyRenderEmojis(originalContentElement, newText);
  addEditedIndicator(originalContentElement);

  sendEditMessageRequest(message.id, newText);

  currentEditUiMessageId = "";
}

function cancelEdit(message: HTMLElement) {
  message.outerHTML = editMessageCurrentContent;
  currentEditUiMessageId = "";
}

export function fetchMoreAttachments(page: number, pageSize: number) {
  const attachmentType = isOnGuild
    ? EventType.GET_ATTACHMENTS_GUILD
    : EventType.GET_ATTACHMENTS_DM;

  apiClient.send(
    attachmentType,
    { guildId: currentGuildId, channelId: guildCache.currentChannelId },
    { page, pageSize }
  );
}
