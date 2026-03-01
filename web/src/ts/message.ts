import DOMPurify from "dompurify";
import {
  scrollToBottom,
  setHasJustFetchedMessagesFalse,
  createProfileImageChat,
  getMessageFromChat,
  addEditedIndicator,
  displayCannotSendMessage,
  displayLocalMessage,
  displayStartMessage,
  editChatMessageInDOM
} from "./chat.ts";
import { cacheInterface, guildCache, pinnedMessagesCache } from "./cache.ts";
import {
  closeReplyMenu,
  chatInput,
  chatContent,
  attachmentsTray,
  fileInput,
  currentReplyingTo,
  resetChatInputState,
  manuallyRenderEmojis,
  DomUtils,
  handleKeyboardNavigationFor
} from "./chatbar.ts";
import { apiClient, EventType } from "./api.ts";
import {
  getBeforeElement,
  formatDate,
  disableElement,
  createRandomId,
  createEl,
  enableElement,
  isMobile,
  getId
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
import { preserveEmojiContent, renderEmojisFromContent } from "./emoji.ts";
import { appState } from "./appState.ts";
import { alertUser } from "./popups.ui.ts";

export let lastMessageDate: Date;

export function setLastMessageDate(date: Date) {
  lastMessageDate = date;
}

async function uploadAttachment(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name); // ← explicit filename
  const data = await apiClient.sendForm(EventType.UPLOAD_ATTACHMENT, formData);
  return data.fileId;
}
async function handleFileProcessing(file: File): Promise<File> {
  const isImage = await FileHandler.isImageFile(file);
  if (!isImage) return file;

  const animated = await isAnimated(file);
  if (animated) return file;

  const safeToCompress = ["image/jpeg", "image/png", "image/webp"].includes(
    file.type
  );
  if (!safeToCompress) return file;

  try {
    return await compressImage(file);
  } catch (error) {
    console.debug("Compression failed. Using original file.", error);
    return file;
  }
}

async function isAnimated(file: File): Promise<boolean> {
  if (!("ImageDecoder" in window)) return false;
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new (window as any).ImageDecoder({
      data: buffer,
      type: file.type
    });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    return track ? track.frameCount > 1 : false;
  } catch {
    return false;
  }
}

async function compressImage(file: File): Promise<File> {
  const { default: imageCompression } =
    await import("browser-image-compression");
  const options = { maxSizeMB: maxAttachmentSize, useWebWorker: true };
  const compressed = await imageCompression(file, options);
  return new File([compressed], file.name, { type: file.type });
}
async function processAndUploadFiles(
  files: FileList | null
): Promise<{ ids: string[]; spoilers: boolean[] }> {
  const ids: string[] = [];
  const spoilers: boolean[] = [];

  if (files && files.length > 0) {
    const fileCount = Math.min(files.length, maxAttachmentsCount);
    const processingPromises = [];

    const originalFileMap = new Map<File, File>();

    for (let i = 0; i < fileCount; i++) {
      const original = files[i];
      processingPromises.push(
        handleFileProcessing(original).then((processed) => {
          originalFileMap.set(processed, original);
          return processed;
        })
      );
    }

    const processedFiles = await Promise.all(processingPromises);

    const uploadPromises = processedFiles.map(async (file) => {
      try {
        const id = await uploadAttachment(file);
        return { file, id, success: true };
      } catch (e) {
        alertUser(
          `Failed to upload ${file.name}`,
          e instanceof Error ? e.message : String(e)
        );
        return { file, id: null, success: false };
      }
    });

    const results = await Promise.all(uploadPromises);

    for (const res of results) {
      if (res.success && res.id) {
        ids.push(res.id);
        const original = originalFileMap.get(res.file);
        const isSpoiler = original
          ? (fileSpoilerMap.get(original) ?? false)
          : false;
        spoilers.push(isSpoiler);
      }
    }
  }

  return { ids, spoilers };
}

function createNewMessagePayload(
  temporaryId: string,
  content: string,
  user_ids?: string[],
  attachmentIds: string[] = [],
  spoilers: boolean[] = []
) {
  return {
    content,
    temporaryId,
    replyToId: currentReplyingTo || null,
    attachments: attachmentIds.map((fileId, i) => ({
      fileId,
      isSpoiler: spoilers[i] ?? false
    })),
    userIds: user_ids
  };
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

  const filesToUpload = fileInput.files;

  attachmentsTray.innerHTML = "";
  disableElement(attachmentsTray);

  const temporaryId = createRandomId();
  const channelId = getChannelId();

  displayLocalMessage(temporaryId, channelId, content);

  let attachmentData = { ids: [] as string[], spoilers: [] as boolean[] };
  try {
    attachmentData = await processAndUploadFiles(filesToUpload);
  } catch (e) {
    alertUser(
      "Upload failed, aborting message send",
      e instanceof Error ? e.message : String(e)
    );
    return;
  }

  FileHandler.resetFileInput();

  const messageData = createNewMessagePayload(
    temporaryId,
    content,
    user_ids,
    attachmentData.ids,
    attachmentData.spoilers
  );

  const additionalData = constructMessagePayload();

  sendNewMessageRequest(messageData, additionalData);

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

function sendNewMessageRequest(messageData: any, additionalData: any) {
  messageQueue = messageQueue.then(async () => {
    try {
      const combinedPayload = {
        ...messageData,
        ...additionalData
      };

      await apiClient.send(
        isOnGuild ? EventType.SEND_MESSAGE_GUILD : EventType.SEND_MESSAGE_DM,
        combinedPayload
      );

      closeReplyMenu();
    } catch (error) {
      alertUser(
        "Error Sending Message:",
        error instanceof Error ? error.message : String(error)
      );
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
      alertUser(
        "Error Editing Message:",
        error instanceof Error ? error.message : String(error)
      );
    }
  });
}

export function deleteMessage(messageId: string) {
  console.log("Deleting message ", messageId);

  const isDm = !isOnGuild;
  setTimeout(() => {
    processDeleteMessage(
      new Date().toISOString(),
      guildCache.currentChannelId,
      messageId,
      isDm
    );
  }, 100);

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
  channelId: string
) {
  if (channelId !== appState.currentUserId && channelId !== getChannelId()) {
    console.error("Can not delete message:", guildId, channelId, messageId);
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
  enableCopyFor(editMessageDiv);

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
      container.style.marginLeft = "0px";
    }

    document.body.appendChild(container);
  } else {
    container = editMessageDiv;

    if (hasMultiple) {
      container.style.marginLeft = "0px";
    }

    messageContentElement.appendChild(editMessageDiv);
  }

  const buttonContainer = createButtonContainer(
    () => saveEdit(message, messageContentElement, container, buttonContainer),
    () => {
      cancelEdit(message);
    }
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

function enableCopyFor(container: HTMLElement) {
  container.addEventListener("keydown", (event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

    if (ctrlKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      range.selectNodeContents(container);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection) return;

      let selectedContent = "";
      if (!selection.isCollapsed) {
        const fragment = selection.getRangeAt(0).cloneContents();
        fragment.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            selectedContent += node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLImageElement;
            if (el.tagName === "IMG" && el.classList.contains("chat-emoji")) {
              const emojiId = el.getAttribute("data-emoji-id");
              selectedContent += emojiId ? `:${emojiId}:` : el.alt || "";
            } else if (el.tagName === "DIV" && el.classList.contains("emoji")) {
              selectedContent += el.getAttribute("data-emoji-id")
                ? `:${el.getAttribute("data-emoji-id")}:`
                : el.textContent || "";
            } else {
              selectedContent += el.textContent || "";
            }
          }
        });
      }

      if (!selectedContent) {
        selectedContent = preserveEmojiContent(container);
      }

      navigator.clipboard.writeText(selectedContent).catch((err) => {
        console.error("Copy failed:", err);
      });
    }
  });
}

function createEditDiv(contentElement: HTMLElement) {
  const div = createEl("div", {
    className: "edit-message-div base-user-input",
    contentEditable: "true"
  });

  const raw =
    contentElement.parentElement?.dataset.content?.replace(
      /\s*\([^)]*\)\s*$/,
      ""
    ) || "";

  div.innerText = raw;

  manuallyRenderEmojis(div, raw);

  div.addEventListener("input", (event: Event) => {
    const inputEvent = event as InputEvent;

    const rawContent = preserveEmojiContent(div);
    const selection = window.getSelection();

    const cursorPosition =
      selection && selection.rangeCount > 0
        ? DomUtils.calculatePositionFromNode(
            div,
            selection.getRangeAt(0).startContainer,
            selection.getRangeAt(0).startOffset
          )
        : rawContent.length;

    if (
      inputEvent.inputType.startsWith("insert") ||
      inputEvent.inputType.startsWith("delete")
    ) {
      const formatted = renderEmojisFromContent(rawContent);

      const savedSelection = {
        start: cursorPosition,
        end: cursorPosition
      };

      div.innerHTML = DOMPurify.sanitize(
        formatted && formatted.trim() !== "" ? formatted : " "
      );

      DomUtils.ensureTextNodeAfterImage(div);
      DomUtils.restoreSelection(div, savedSelection);
    }
  });

  div.addEventListener("keydown", (e) => {
    handleKeyboardNavigationFor(div, e);
  });

  div.addEventListener("keydown", (event) => {
    const active = document.activeElement as HTMLElement;
    if (active !== div) return;
    event.stopPropagation();
  });

  return div;
}

function saveEdit(
  message: HTMLElement,
  originalContentElement: HTMLElement,
  container: HTMLElement,
  buttonContainer: HTMLElement | null
) {
  const editDiv =
    container.classList && container.classList.contains("edit-message-div")
      ? container
      : (container.querySelector(".edit-message-div") as HTMLElement) ||
        container;

  const newRaw = preserveEmojiContent(editDiv).trim();
  const existingRaw =
    originalContentElement.dataset.content ??
    (originalContentElement.textContent ?? "").trim();

  if (newRaw === existingRaw) {
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

  originalContentElement.dataset.content = newRaw;
  originalContentElement.setAttribute("data-content-loaded", "true");
  editChatMessageInDOM(message.id, newRaw);

  const formatted = renderEmojisFromContent(newRaw);

  originalContentElement.innerHTML = DOMPurify.sanitize(
    formatted && formatted.trim() !== "" ? formatted : " "
  );

  addEditedIndicator(originalContentElement, new Date().toString());

  sendEditMessageRequest(message.id, newRaw);

  currentEditUiMessageId = "";
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
export function showNoMessages(container: HTMLElement) {
  const msg = translations.getTranslation("no-messages-found");
  const h3 = createEl("h3");
  h3.textContent = msg;
  container.appendChild(h3);
}
export function unpinEventHandler(messageId: string) {
  const pinContainer = getId("pin-container");
  if (!pinContainer) return;

  const message = pinContainer.querySelector(`.message[id="${messageId}"]`);
  if (message) message.remove();
  pinnedMessagesCache.removeCachedPinnedMessage(messageId);

  if (pinContainer.querySelectorAll(".message").length === 0) {
    pinContainer.innerHTML = `<h3 style="flex-direction:column; align-items: center; display:flex;">Pinned Messages</h3>`;
    showNoMessages(pinContainer);
  }
}
