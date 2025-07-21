import DOMPurify from "dompurify";
import { fileTypeFromBuffer } from "file-type";
import { apiClient, EventType } from "./api.ts";
import { friendsCache } from "./friends.ts";
import { scrollToBottom, updateChatWidth } from "./chat.ts";
import { sendMessage } from "./message.ts";
import { isDomLoaded, readCurrentMessages } from "./app.ts";
import { toggleManager } from "./settings.ts";
import { popKeyboardConfetti } from "./extras.ts";
import {
  getId,
  createEl,
  disableElement,
  enableElement,
  findLastTextNode,
  findPreviousNode,
  findNextNode,
  formatFileSize,
  isCompressedFile,
  renderFileIcon,
  isMobile
} from "./utils.ts";
import { alertUser, displayImagePreviewBlob } from "./ui.ts";
import { isOnDm, isOnGuild } from "./router.ts";
import { maxAttachmentSize } from "./avatar.ts";
import { guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { translations } from "./translations.ts";
import { userManager } from "./user.ts";
import {
  applyActiveEmojiSuggestion,
  handleEmojiSuggestions,
  preserveEmojiContent,
  renderEmojisFromContent,
  toggleShowEmojiSuggestions
} from "./emoji.ts";
import { maxAttachmentsCount } from "./mediaElements.ts";
import { currentChannelName } from "./channels.ts";
import {
  getNextFocusableNode,
  getPreviousFocusableNode,
  moveCursorTo,
  moveCursorToEndOf
} from "./navigation.ts";
import { gifBtn } from "./mediaPanel.ts";
import { socketClient } from "./socketEvents.ts";

export let currentReplyingTo = "";

export const chatInput = getId("user-input") as HTMLInputElement;
export const chatContainer = getId("chat-container") as HTMLElement;
export const chatContent = getId("chat-content") as HTMLElement;
export const replyInfo = getId("reply-info") as HTMLElement;

export const fileInput = getId("fileInput") as HTMLInputElement;
export const attachmentsTray = getId("attachments-tray") as HTMLElement;
export const newMessagesBar = getId("newMessagesBar") as HTMLElement;

const newMessagesText = getId("newMessagesText") as HTMLSpanElement;
const replyCloseButton = getId("reply-close-button") as HTMLButtonElement;

export interface ChatBarState {
  rawContent: string;
  renderedContent: string;
  cursorPosition: number;
  isProcessing: boolean;
  emojiSuggestionsVisible: boolean;
  selectionStart: number;
  selectionEnd: number;
}
const state = {
  rawContent: "",
  renderedContent: "",
  cursorPosition: 0,
  isProcessing: false,
  emojiSuggestionsVisible: false,
  selectionStart: 0,
  selectionEnd: 0
};
export function getChatBarState() {
  return state;
}
export function setChatBarState(_state: ChatBarState) {
  const hasChanged =
    state.rawContent !== _state.rawContent ||
    state.renderedContent !== _state.renderedContent;

  if (hasChanged) {
    state.rawContent = _state.rawContent;
    state.renderedContent = _state.renderedContent;
    chatInput.innerText = state.rawContent;
    chatInput.dispatchEvent(new Event("input"));
  }
}

export function setEmojiSuggestionsVisible(value: boolean) {
  state.emojiSuggestionsVisible = value;
}

if (replyCloseButton) {
  replyCloseButton.addEventListener("click", closeReplyMenu);
}
const getImageactionsHtml = (isImage: boolean): string => {
  return `
    <div class="image-actions">
      ${
        isImage
          ? `
        <div class="action-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M15.56 11.77c.2-.1.44.02.44.23a4 4 0 1 1-4-4c.21 0 .33.25.23.44a2.5 2.5 0 0 0 3.32 3.32Z" />
            <path fill="currentColor" fill-rule="evenodd" d="M22.89 11.7c.07.2.07.4 0 .6C22.27 13.9 19.1 21 12 21c-7.11 0-10.27-7.11-10.89-8.7a.83.83 0 0 1 0-.6C1.73 10.1 4.9 3 12 3c7.11 0 10.27 7.11 10.89 8.7Zm-4.5-3.62A15.11 15.11 0 0 1 20.85 12c-.38.88-1.18 2.47-2.46 3.92C16.87 17.62 14.8 19 12 19c-2.8 0-4.87-1.38-6.39-3.08A15.11 15.11 0 0 1 3.15 12c.38-.88 1.18-2.47 2.46-3.92C7.13 6.38 9.2 5 12 5c2.8 0 4.87 1.38 6.39 3.08Z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="action-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z" />
          </svg>
        </div>
      `
          : ""
      }
      <div class="action-button remove">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path fill="currentColor" d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z" />
          <path fill="currentColor" fill-rule="evenodd" d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  `;
};

export function updatePlaceholderVisibility(newPlaceholder?: string) {
  const text = chatInput.textContent?.trim();
  text
    ? chatInput.removeAttribute("data-placeholder")
    : chatInput.setAttribute(
        "data-placeholder",
        newPlaceholder || "Type a message..."
      );
}

export class ReadenMessagesManager {
  static getReadText() {
    const currentDate = new Date();
    const lastMessagesDate = translations.formatDate(currentDate);
    const lastMessageTime = translations.formatTime(currentDate);
    const messagesCount = 5;
    return translations.getReadText(
      lastMessagesDate,
      lastMessageTime,
      messagesCount
    );
  }

  static initialiseReadUi() {
    if (newMessagesBar) {
      newMessagesBar.addEventListener("click", readCurrentMessages);
    }
    if (newMessagesText) {
      newMessagesText.textContent = this.getReadText();
    }
  }
}

const MIN_CHAT_HEIGHT = 500;

function adjustChatContainerHeight() {
  const chatInputHeight = chatInput.scrollHeight;
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - chatInputHeight;
  const newHeight = Math.max(MIN_CHAT_HEIGHT, availableHeight);
  chatContainer.style.height = `${newHeight}px`;
}

export function adjustHeight() {
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  chatInput.scrollTop = chatInput.scrollHeight - chatInput.clientHeight;

  adjustChatContainerHeight();
  window.addEventListener("resize", adjustChatContainerHeight);

  adjustReplyPosition();
}
function appendMentionToInput(
  triggerChar: string,
  mentionId: string,
  mentionWrapper: (id: string) => string,
  ignoreChecks = false
) {
  if (!chatInput) return;

  const message = state.rawContent ?? "";
  let cursorPos = state.cursorPosition;
  cursorPos = Math.max(0, Math.min(cursorPos, message.length));

  const newMention = mentionWrapper(mentionId);

  const mentionStart = message.lastIndexOf(triggerChar, cursorPos - 1);
  if (mentionStart === -1 && !ignoreChecks) return;

  let mentionEnd = cursorPos;
  while (mentionEnd < message.length && !/\s/.test(message[mentionEnd])) {
    mentionEnd++;
  }

  if (!ignoreChecks) {
    const mentionCandidate = message.slice(mentionStart, cursorPos);
    if (/\s/.test(mentionCandidate)) return;
  }

  const newMessage =
    message.slice(0, mentionStart) + newMention + message.slice(mentionEnd);
  const newCursorPos = mentionStart + newMention.length;

  state.rawContent = newMessage;
  state.cursorPosition = newCursorPos;

  const savedSelection = { start: newCursorPos, end: newCursorPos };
  requestAnimationFrame(() => {
    DomUtils.restoreSelection(chatInput, savedSelection);
  });

  setChatBarState(state);
  manuallyRenderEmojis(newMessage);
  setTimeout(() => disableElement("userMentionDropdown"), 0);
}

export function appendMemberMentionToInput(
  userId: string,
  ignoreChecks?: boolean
) {
  appendMentionToInput("@", userId, (id) => `<@${id}>`, ignoreChecks);
}

export function appendChannelMentionToInput(channelId: string) {
  appendMentionToInput("#", channelId, (id) => `<#${id}>`);
}

//#region Reply
export function showReplyMenu(replyToMsgId: string, replyToUserId: string) {
  replyCloseButton.style.display = "flex";
  replyInfo.textContent = translations.getReplyingTo(
    userManager.getUserNick(replyToUserId)
  );
  replyInfo.style.display = "flex";
  if (isAttachmentsAdded) {
    replyInfo.classList.add("reply-attachments-open");
    replyCloseButton.classList.add("reply-attachments-open");
  }
  currentReplyingTo = replyToMsgId;
  chatInput.classList.add("reply-opened");
}
function adjustReplyPosition() {
  const elementHeight = parseInt(chatInput.style.height, 10);
  const topPosition = elementHeight;
  if (replyInfo) {
    replyInfo.style.bottom = `${topPosition}px`;
  }
}
function adjustReplyPositionOnAttachments() {
  replyInfo.classList.add("reply-attachments-open");
  replyCloseButton.classList.add("reply-attachments-open");
}
export function closeReplyMenu() {
  if (replyCloseButton) {
    replyCloseButton.style.display = "none";
  }
  if (replyInfo) {
    replyInfo.style.display = "none";
  }
  currentReplyingTo = "";
  chatInput.classList.remove("reply-opened");
}
//#endregion

//#region Reply

let typingTimeout: ReturnType<typeof setTimeout>;
let typingStarted = false;
const TYPING_COOLDOWN = 2000;

function handleTypingRequest() {
  if (chatInput.value !== "") {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    const channelId = isOnDm
      ? friendsCache.currentDmId
      : guildCache.currentChannelId;
    if (!typingStarted) {
      typingStarted = true;
      socketClient.startTyping(channelId, currentGuildId);
    }

    typingTimeout = setTimeout(() => {
      typingStarted = false;
      socketClient.stopTyping(channelId, currentGuildId);
    }, TYPING_COOLDOWN);
  }
}

//#endregion
let isAttachmentsAdded: boolean;
let fileList: File[] = [];
export const fileSpoilerMap: WeakMap<File, boolean> = new WeakMap();

export class FileHandler {
  static handleFileInput(
    eventOrFiles: Event | FileList | File[] | null = null
  ): void {
    console.log("File input changed. files: ", eventOrFiles);
    const max = maxAttachmentSize * 1024 * 1024;

    const filesToProcessOriginal = FileHandler.extractFiles(eventOrFiles);
    const validFiles = FileHandler.filterValidFiles(filesToProcessOriginal);

    let remainingSize =
      max - fileList.reduce((acc, file) => acc + file.size, 0);
    const filteredFiles: File[] = [];

    for (const file of validFiles) {
      if (file.size <= remainingSize && file.size <= max) {
        filteredFiles.push(file);
        remainingSize -= file.size;
      }
    }

    if (fileList.length + filteredFiles.length > maxAttachmentsCount) {
      filteredFiles.splice(maxAttachmentsCount - fileList.length);
    }

    for (const file of filteredFiles) {
      fileList.push(file);
      FileHandler.processFile(file);
    }

    adjustHeight();

    if (fileList.length > maxAttachmentsCount) {
      fileList = fileList.slice(0, maxAttachmentsCount);
    }

    FileHandler.syncFileInputWithFileList();
  }

  static extractFiles(eventOrFiles: Event | FileList | File[] | null): File[] {
    if (eventOrFiles instanceof Event) {
      const inputElement = eventOrFiles.target as HTMLInputElement;
      return inputElement?.files ? Array.from(inputElement.files) : [];
    } else if (
      eventOrFiles instanceof FileList ||
      eventOrFiles instanceof Array
    ) {
      return Array.from(eventOrFiles);
    }
    return [];
  }

  static filterValidFiles(files: File[]): File[] {
    return files.filter(
      (file) =>
        file instanceof Blob && file.size <= maxAttachmentSize * 1024 * 1024
    );
  }

  static async processFile(file: File) {
    const isImage = await FileHandler.isImageFile(file);
    const fileURL = isImage ? URL.createObjectURL(file) : "";
    FileHandler.renderFilePreview(fileURL, isImage, file);
    isAttachmentsAdded = true;
  }

  static async isImageFile(file: File): Promise<boolean> {
    try {
      if (await isCompressedFile(file.name)) {
        return false;
      }

      const readBuffer =
        file.size < 4100
          ? new Uint8Array(await file.arrayBuffer())
          : new Uint8Array(await file.slice(0, 4100).arrayBuffer());

      const result = await fileTypeFromBuffer(readBuffer);
      return (result && result.mime.startsWith("image/")) || false;
    } catch {
      return false;
    }
  }

  static async renderFilePreview(src: string, isImage: boolean, file: File) {
    const container = createEl("div", { className: "image-container" });
    (container as any)._file = file;
    let img: HTMLImageElement;

    if (isImage) {
      img = createEl("img", { src });
    } else {
      img = createEl("i", {
        className: "fa-solid fa-file attachment-preview-file"
      }) as HTMLImageElement;
      renderFileIcon(img, file.name);
    }

    const imageText = createEl("div", {
      className: "image-text",
      textContent: file.name
    });
    const sizeText = createEl("div", {
      className: "image-text right",
      textContent: formatFileSize(file.size)
    });
    container.appendChild(img);
    const isImageFile = await FileHandler.isImageFile(file);
    const imageActions = createEl("div", {
      innerHTML: getImageactionsHtml(isImageFile)
    });
    container.appendChild(imageActions);

    container.appendChild(imageText);
    container.appendChild(sizeText);
    attachmentsTray.appendChild(container);
    enableElement(attachmentsTray);

    img.addEventListener("click", function () {
      displayImagePreviewBlob(img);
    });

    const spoilerButton = imageActions.querySelector(
      ".action-button:nth-child(1)"
    );
    const editButton = imageActions.querySelector(
      ".action-button:nth-child(2)"
    );
    const removeButton = imageActions.querySelector(".action-button.remove");

    spoilerButton?.addEventListener("click", () =>
      FileHandler.toggleSpoilerImage(img)
    );
    editButton?.addEventListener("click", () => FileHandler.editImage(img));
    removeButton?.addEventListener("click", () => {
      FileHandler.removeImage(container, file);
      if (attachmentsTray.children.length === 0) {
        disableElement(attachmentsTray);
      }
    });
    adjustReplyPositionOnAttachments();
    updateChatWidth();
  }

  static blurImage(img: HTMLImageElement) {
    const text = createEl("span", {
      textContent: "SPOILER",
      className: "spoiler-text"
    });

    const imgWrapper = createEl("div", { className: "spoiler-container" });

    const parentElement = img.parentElement;

    if (parentElement) {
      parentElement.removeChild(img);
    }

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(text);

    img.style.filter = "blur(12px)";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";

    if (parentElement) {
      parentElement.appendChild(imgWrapper);
    }
  }

  static unBlurImage(img: HTMLImageElement) {
    img.style.filter = "";
    const imgWrapper = img.parentElement;
    if (!imgWrapper) {
      return;
    }
    const parent = imgWrapper.parentElement?.parentElement;
    if (!parent) {
      return;
    }
    const spoilerText = parent.querySelector(".spoiler-text");
    if (spoilerText) {
      spoilerText.remove();
    }
  }
  static toggleSpoilerImage(img: HTMLImageElement): void {
    const imgWrapper = img.parentElement;
    const spoilerText = imgWrapper?.querySelector(".spoiler-text");
    const file = (imgWrapper as any)?._file as File;

    if (!file) {
      console.error("File is undefined or null.");
      return;
    }

    const isSpoiler = fileSpoilerMap.get(file) ?? false;

    if (isSpoiler) {
      spoilerText?.remove();
      img.style.filter = "";
      fileSpoilerMap.set(file, false);
    } else {
      FileHandler.blurImage(img);
      fileSpoilerMap.set(file, true);
    }
  }

  static editImage(img: HTMLImageElement): void {
    alertUser("Image edit is not implemented!");
  }

  static async removeImage(container: HTMLElement, file: File) {
    const index = fileList.indexOf(file);
    if (index !== -1) {
      fileList.splice(index, 1);
      FileHandler.syncFileInputWithFileList();
    }
    const isImageFile = await FileHandler.isImageFile(file);
    if (isImageFile) {
      const img = container.querySelector("img");
      if (img && img.src) {
        URL.revokeObjectURL(img.src);
      }
    }
    if (fileList.length === 0) {
      disableElement(attachmentsTray);
    }
    console.log(fileList.length);

    container.remove();
    FileHandler.syncFileInputWithFileList();
  }

  static resetFileInput(): void {
    if (fileInput) {
      fileInput.value = "";
      fileInput.files = null;
      fileList = [];
    }
  }

  static syncFileInputWithFileList(): void {
    if (fileInput) {
      if (!fileList.length) {
        fileInput.value = "";
        fileInput.files = null;
      } else {
        const dataTransfer = new DataTransfer();
        fileList.forEach((file) => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
      }
    }
  }

  static setDropHandler() {
    const dropZone = getId("drop-zone") as HTMLElement;
    const fileButton = getId("file-button") as HTMLElement;
    if (!dropZone || !fileButton) {
      return;
    }
    if (!dropZone) {
      console.log("dropZone not found");
      return;
    }

    if (!fileButton) {
      console.log("fileButton not found");
      return;
    }

    const dragEvents = ["dragenter", "dragover", "dragleave", "drop"];
    dragEvents.forEach((eventName) => {
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    document.body.addEventListener("dragenter", handleDragEnterOrOver, false);
    document.body.addEventListener("dragover", handleDragEnterOrOver, false);
    document.body.addEventListener("dragleave", handleDragLeave, false);
    document.body.addEventListener("drop", handleDrop, false);

    fileButton.addEventListener("click", () => {
      console.log("fileButton clicked");
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      console.log("fileInput change event");
      FileHandler.handleFileInput(e);
    });

    function preventDefaults(e: Event) {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleDragEnterOrOver(e: DragEvent) {
      dropZone.style.display = "flex";
      dropZone.classList.add("hover");
      const chanName = isOnGuild
        ? currentChannelName
        : isOnDm
          ? userManager.getUserNick(friendsCache.currentDmId)
          : "";
      const dropChannelName = getId("drop-zone-channel-name");
      if (dropChannelName) {
        dropChannelName.textContent = translations.getDropZoneText(chanName);
      }
    }

    function handleDragLeave(e: DragEvent) {
      if (
        e.relatedTarget === null ||
        !document.body.contains(e.relatedTarget as Node)
      ) {
        console.log("Full dragleave, hiding dropZone");
        dropZone.style.display = "none";
        dropZone.classList.remove("hover");
      }
    }

    function handleDrop(e: DragEvent) {
      console.log("Handling drop");
      dropZone.style.display = "none";
      dropZone.classList.remove("hover");

      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files?.length) {
        console.log(`${files.length} file(s) dropped`);
        FileHandler.handleFileInput(files);
      } else {
        console.log("No files dropped");
      }
    }
  }
}
//#region Input emoji handling

function updateStateCursorPos(pos: number) {
  state.cursorPosition = pos;
}
export function resetChatInputState() {
  state.rawContent = "";
  state.renderedContent = "";
  updateStateCursorPos(0);
  state.isProcessing = false;
  state.selectionStart = 0;
  state.selectionEnd = 0;
}

export class DomUtils {
  private constructor() {}

  static calculatePositionFromNode(node: Node, offset: number): number {
    let position = 0;

    const walkNodeUntil = (currentNode: Node, targetNode: Node): boolean => {
      if (currentNode === targetNode) {
        return true;
      }

      if (currentNode.nodeType === Node.TEXT_NODE) {
        position += currentNode.textContent?.length || 0;
      } else if (
        (currentNode.nodeType === Node.ELEMENT_NODE &&
          currentNode.nodeName === "IMG") ||
        currentNode.nodeName === "DIV"
      ) {
        const element = currentNode as HTMLElement;
        const emojiId =
          element.getAttribute("data-emoji-id") ||
          element.getAttribute("alt")?.match(/Emoji (\d+)/)?.[1];
        position += emojiId ? `:${emojiId}:`.length : 1;
      }

      if (currentNode.hasChildNodes()) {
        for (let i = 0; i < currentNode.childNodes.length; i++) {
          if (walkNodeUntil(currentNode.childNodes[i], targetNode)) {
            return true;
          }
        }
      }

      return false;
    };

    for (let i = 0; i < chatInput.childNodes.length; i++) {
      if (walkNodeUntil(chatInput.childNodes[i], node)) {
        break;
      }
    }

    return position + offset;
  }

  static syncCursorPosition() {
    if (state.emojiSuggestionsVisible) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    const newCursorPos = DomUtils.calculatePositionFromNode(
      range.startContainer,
      range.startOffset
    );
    updateStateCursorPos(newCursorPos);

    if (selection.rangeCount > 0) {
      const startRange = selection.getRangeAt(0).cloneRange();
      startRange.collapse(true);

      state.selectionStart = DomUtils.calculatePositionFromNode(
        startRange.startContainer,
        startRange.startOffset
      );
      state.selectionEnd = state.cursorPosition;
    }

    toggleShowEmojiSuggestions();
  }

  static restoreSelection(
    containerEl: HTMLElement,
    savedSel: { start: number; end: number }
  ) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    let charIndex = 0;
    let foundStart = false,
      foundEnd = false;
    const startRange = document.createRange();
    let endRange = document.createRange();

    function traverseNodes(node: Node) {
      if (foundStart && foundEnd) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + (node.textContent?.length || 0);

        if (
          !foundStart &&
          savedSel.start >= charIndex &&
          savedSel.start <= nextCharIndex
        ) {
          startRange.setStart(node, savedSel.start - charIndex);
          foundStart = true;
        }

        if (
          !foundEnd &&
          savedSel.end >= charIndex &&
          savedSel.end <= nextCharIndex
        ) {
          endRange.setEnd(node, savedSel.end - charIndex);
          foundEnd = true;
        }
        charIndex = nextCharIndex;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName === "IMG" || node.nodeName === "DIV") {
          if (!foundStart && charIndex === savedSel.start) {
            startRange.setStartBefore(node);
            foundStart = true;
          }
          if (!foundEnd && charIndex === savedSel.end) {
            endRange.setEndAfter(node);
            foundEnd = true;
          }

          const img = node as HTMLImageElement;
          const emojiId =
            img.getAttribute("data-emoji-id") ||
            img.getAttribute("alt")?.match(/Emoji (\d+)/)?.[1];
          charIndex += emojiId ? `:${emojiId}:`.length : 1;
        }

        if (node.hasChildNodes()) {
          Array.from(node.childNodes).forEach(traverseNodes);
        }
      }
    }

    Array.from(containerEl.childNodes).forEach(traverseNodes);

    if (foundStart) {
      if (!foundEnd) {
        endRange = startRange.cloneRange();
        endRange.collapse(false);
      }
      const newRange = document.createRange();
      newRange.setStart(startRange.startContainer, startRange.startOffset);
      newRange.setEnd(endRange.endContainer, endRange.endOffset);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      const lastNode = findLastTextNode(containerEl) || containerEl;
      const range = document.createRange();
      range.selectNodeContents(lastNode);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  static ensureTextNodeAfterImage(element: HTMLElement) {
    element.querySelectorAll("img").forEach((img) => {
      if (!img.nextSibling || img.nextSibling.nodeType !== Node.TEXT_NODE) {
        img.parentNode?.insertBefore(
          document.createTextNode("\u200B"),
          img.nextSibling
        );
      }

      if (
        !img.previousSibling ||
        img.previousSibling.nodeType !== Node.TEXT_NODE
      ) {
        img.parentNode?.insertBefore(document.createTextNode("\u200B"), img);
      }

      if (
        !img.hasAttribute("data-emoji-id") &&
        img.classList.contains("chat-emoji")
      ) {
        const emojiMatch = img.getAttribute("alt")?.match(/Emoji (\d+)/);
        if (emojiMatch) {
          img.setAttribute("data-emoji-id", emojiMatch[1]);
        }
      }
    });
  }
}

function handleKeyboardNavigation(event: KeyboardEvent) {
  const isCtrlC =
    (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";

  if (isCtrlC) {
    const isAllSelected =
      chatInput.selectionStart === 0 &&
      chatInput.selectionEnd === chatInput.value.length;
    if (isAllSelected) {
      navigator.clipboard.writeText(state.rawContent).then(() => {
        console.log("Full content copied to clipboard");
      });
    }
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    handleEmojiJump(event);
    handleEmojiSuggestions(event);
  } else if (event.key === "Backspace") {
    handleBackspace(event);
  } else if (event.key === " ") {
    handleSpace(event);
  }
}

function handleBackspace(event: KeyboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (
    !range.collapsed &&
    range.startContainer === chatInput &&
    range.endContainer === chatInput
  ) {
    if (
      range.startOffset === 0 &&
      range.endOffset === chatInput.childNodes.length
    ) {
      event.preventDefault();

      chatInput.innerHTML = "\u200B";

      requestAnimationFrame(() => {
        state.rawContent = "";
        state.renderedContent = "";
        updateStateCursorPos(0);
        state.selectionStart = 0;
        state.selectionEnd = 0;

        const newRange = document.createRange();
        newRange.setStart(chatInput.firstChild || chatInput, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        chatInput.dispatchEvent(new Event("input"));
        updatePlaceholderVisibility();
      });

      return;
    }
  }

  if (!range.collapsed) {
    return;
  }

  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;
  let shouldPreventDefault = false;
  let nodeToRemove = null;

  if (currentNode.nodeType === Node.TEXT_NODE && currentOffset === 0) {
    const prevNode = findPreviousNode(currentNode);

    if (
      prevNode &&
      prevNode.nodeName === "IMG" &&
      (prevNode as HTMLElement).classList?.contains("chat-emoji")
    ) {
      shouldPreventDefault = true;
      nodeToRemove = prevNode;
    }
  } else if (currentNode === chatInput && currentOffset > 0) {
    const nodes = Array.from(chatInput.childNodes);
    if (currentOffset > 0 && currentOffset <= nodes.length) {
      const targetNode = nodes[currentOffset - 1];
      if (
        targetNode.nodeName === "IMG" &&
        (targetNode as HTMLElement).classList?.contains("chat-emoji")
      ) {
        shouldPreventDefault = true;
        nodeToRemove = targetNode;
      }
    }
  } else if (currentNode.nodeType === Node.TEXT_NODE && currentOffset === 0) {
    const prevSibling = currentNode.previousSibling;
    if (
      prevSibling &&
      prevSibling.nodeName === "IMG" &&
      (prevSibling as HTMLElement).classList?.contains("chat-emoji")
    ) {
      shouldPreventDefault = true;
      nodeToRemove = prevSibling;
    }
  } else if (currentNode.nodeType === Node.TEXT_NODE) {
    let previousNode = null;
    const walker = document.createTreeWalker(
      chatInput,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      null
    );

    let current = walker.firstChild();
    while (current && current !== currentNode) {
      previousNode = current;
      current = walker.nextNode();
    }

    if (
      current === currentNode &&
      previousNode &&
      previousNode.nodeName === "IMG" &&
      (previousNode as HTMLElement).classList?.contains("chat-emoji")
    ) {
      shouldPreventDefault = true;
      nodeToRemove = previousNode;
    }
  }

  if (shouldPreventDefault && nodeToRemove) {
    event.preventDefault();
    const parentNode = nodeToRemove.parentNode;
    if (parentNode) {
      parentNode.removeChild(nodeToRemove);

      requestAnimationFrame(() => {
        state.rawContent = preserveEmojiContent(chatInput);
        const currentSelection = window.getSelection();
        if (currentSelection && currentSelection.rangeCount > 0) {
          const newPos = DomUtils.calculatePositionFromNode(
            currentSelection.getRangeAt(0).startContainer,
            currentSelection.getRangeAt(0).startOffset
          );
          updateStateCursorPos(newPos);
          state.selectionStart = newPos;
          state.selectionEnd = newPos;
        }

        chatInput.dispatchEvent(new Event("input"));
      });
    }
  }
}
export function onMemberSelected(_state: ChatBarState) {
  state.rawContent = preserveEmojiContent(chatInput);
}

export function handleEmojiJump(event: KeyboardEvent) {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.getRangeAt(0).collapsed
  ) {
    return;
  }

  const range = selection.getRangeAt(0);
  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;
  if (!chatInput || !chatInput.contains(currentNode)) {
    console.log("Current node is outside the input box — aborting");
    return;
  }
  if (event.key === "ArrowRight") {
    let nextNode: Node | null = null;

    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentOffset < (currentNode.textContent?.length || 0)) {
        return;
      }
      nextNode = getNextFocusableNode(currentNode);
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const children = Array.from(currentNode.childNodes);
      nextNode = children[currentOffset] || null;
    }

    if (nextNode) {
      const nodeAfterNext = getNextFocusableNode(nextNode);
      if (nodeAfterNext) {
        moveCursorTo(nodeAfterNext);
      } else {
        const fallbackTextNode = document.createTextNode(" ");
        nextNode.parentNode?.insertBefore(
          fallbackTextNode,
          nextNode.nextSibling
        );
        moveCursorTo(fallbackTextNode);
      }
      event.preventDefault();
    } else {
      const fallbackTextNode = document.createTextNode(" ");
      const referenceNode =
        currentNode.nodeType === Node.ELEMENT_NODE
          ? currentNode
          : currentNode.parentNode;
      referenceNode?.parentNode?.insertBefore(
        fallbackTextNode,
        referenceNode.nextSibling
      );
      moveCursorTo(fallbackTextNode);
      event.preventDefault();
    }
  }

  if (event.key === "ArrowLeft") {
    const atStart = currentOffset === 0;
    const parentNode = currentNode.parentNode;

    console.log("ArrowLeft pressed");
    console.log("Current node:", currentNode);
    console.log("Current offset:", currentOffset);
    console.log("At start of node:", atStart);

    if (!atStart) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        console.log("Cursor not at start, inside TEXT_NODE – do nothing");
        return;
      }

      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const children = Array.from(currentNode.childNodes);
        const previousSibling = children[currentOffset - 1];
        console.log("Previous sibling of ELEMENT_NODE:", previousSibling);

        if (previousSibling) {
          console.log("Moving cursor to end of previous sibling");
          moveCursorToEndOf(previousSibling);
          event.preventDefault();
          return;
        }
      }
    }

    if (atStart && parentNode) {
      const root = parentNode;
      const firstChild = root.firstChild;

      console.log("At start and parent exists:", root);
      console.log("First child of root:", firstChild);

      if (isEmoji(firstChild)) {
        console.log("First child is emoji – inserting text node before it");
        const newTextNode = document.createTextNode("");
        root.insertBefore(newTextNode, firstChild);
        moveCursorTo(newTextNode);
        event.preventDefault();
        return;
      }

      const prevSibling = currentNode.previousSibling;
      console.log("Previous sibling of current node:", prevSibling);

      if (isEmoji(prevSibling)) {
        console.log(
          "Previous sibling is emoji – inserting text node before it"
        );
        const newTextNode = document.createTextNode("");
        root.insertBefore(newTextNode, prevSibling);
        moveCursorTo(newTextNode);
        event.preventDefault();
        return;
      }

      const prevNode = getPreviousFocusableNode(currentNode);
      console.log("Previous focusable node found:", prevNode);

      if (prevNode) {
        console.log("Moving cursor to end of previous focusable node");
        moveCursorToEndOf(prevNode);
        event.preventDefault();
      } else {
        console.log("No previous node found – inserting fallback text node");
        const fallback = document.createTextNode("");
        root.insertBefore(fallback, currentNode);
        moveCursorTo(fallback);
        event.preventDefault();
      }
    }
  }
}

export const isEmoji = (node: Node | null): node is HTMLElement =>
  node instanceof HTMLElement &&
  ((node.tagName === "IMG" && node.classList.contains("chat-emoji")) ||
    (node.tagName === "DIV" && node.classList.contains("emoji")));

export function manuallyRenderEmojis(rawContent: string): void {
  state.isProcessing = true;

  state.rawContent = rawContent;
  const formattedContent = renderEmojisFromContent(rawContent);

  chatInput.innerHTML = DOMPurify.sanitize(
    formattedContent && formattedContent.trim() !== "" ? formattedContent : " "
  );

  DomUtils.ensureTextNodeAfterImage(chatInput);

  const savedSelection = {
    start: rawContent.length,
    end: rawContent.length
  };

  DomUtils.restoreSelection(chatInput, savedSelection);
  state.renderedContent = formattedContent;
  updatePlaceholderVisibility();
  state.isProcessing = false;

  DomUtils.syncCursorPosition();
  toggleShowEmojiSuggestions();
}

function handleSpace(event: KeyboardEvent) {
  console.log(state, chatInput.innerHTML);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    return;
  }

  const currentAbsolutePosition = DomUtils.calculatePositionFromNode(
    range.startContainer,
    range.startOffset
  );

  if (currentAbsolutePosition === 0) {
    return;
  }

  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;

  const isEmptyTextNode =
    currentNode.nodeType === Node.TEXT_NODE &&
    (currentNode.textContent === "\u200B" || currentNode.textContent === "");

  const isAtEndOfText =
    currentNode.nodeType === Node.TEXT_NODE &&
    currentOffset === (currentNode.textContent?.length || 0);

  const isPrevSiblingImg = currentNode.previousSibling?.nodeName === "IMG";

  const isLastNode = !findNextNode(currentNode);

  if (
    (isAtEndOfText && (isPrevSiblingImg || isLastNode)) ||
    (isEmptyTextNode && isPrevSiblingImg)
  ) {
    event.preventDefault();
    document.execCommand("insertText", false, " ");

    requestAnimationFrame(() => {
      state.rawContent = preserveEmojiContent(chatInput);
      const currentSelection = window.getSelection();
      if (currentSelection && currentSelection.rangeCount > 0) {
        const newPos = DomUtils.calculatePositionFromNode(
          currentSelection.getRangeAt(0).startContainer,
          currentSelection.getRangeAt(0).startOffset
        );
        updateStateCursorPos(newPos);
        state.selectionStart = newPos;
        state.selectionEnd = newPos;
      }
      DomUtils.syncCursorPosition();
    });
  }
  console.log(state, chatInput.innerHTML);
}
function insertNewlineAtCaret() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const textNode = document.createTextNode("\n");
  range.insertNode(textNode);

  range.setStartAfter(textNode);
  range.collapse(true);

  selection.removeAllRanges();
  selection.addRange(range);

  scrollToBottom();
}
let suppressSend = false;
export function setSuppressSend(val: boolean) {
  suppressSend = val;
}
function handleUserKeydown(event: KeyboardEvent) {
  handleTypingRequest();
  if (suppressSend) {
    suppressSend = false;
    return;
  }
  if (!chatContainer || !chatInput) return;

  if (event.key === "Enter") {
    if (state.emojiSuggestionsVisible) {
      event.preventDefault();
      applyActiveEmojiSuggestion();
      return;
    }

    if (event.shiftKey) {
      event.preventDefault();
      insertNewlineAtCaret();
      adjustHeight();
      scrollToBottom();
      return;
    }

    if (isMobile) {
      event.preventDefault();
      insertNewlineAtCaret();
      adjustHeight();
      return;
    }

    event.preventDefault();
    sendMessage(state.rawContent).then(() => {
      chatInput.innerHTML = "";
      toggleSendButton(false);
      isAttachmentsAdded = false;
      adjustHeight();
    });

    return;
  }

  handleKeyboardNavigation(event);

  if (isDomLoaded && toggleManager.states["party-toggle"]) {
    setTimeout(() => {
      popKeyboardConfetti();
    }, 10);
  }
}

function handleUserBeforeInput(event: InputEvent) {
  if (event.inputType === "insertLineBreak") {
    adjustHeight();
    scrollToBottom();
  }
}

const emojiBtn = getId("emojibtn") as HTMLElement;
const sendBtn = getId("sendbtn") as HTMLElement;

function toggleSendButton(hasContent: boolean) {
  const canSend = hasContent && isMobile;

  if (canSend) {
    enableElement(sendBtn);
  } else {
    disableElement(sendBtn);
  }

  sendBtn.classList.toggle("sendbtn-active", canSend);

  emojiBtn?.classList.toggle("send-active", hasContent);
  gifBtn?.classList.toggle("send-active", hasContent);
}

let initialHeight = window.innerHeight;
let keyboardOpen = false;
function checkKeyboardOpen() {
  const visualHeight = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  const delta = initialHeight - visualHeight;

  const HEIGHT_DROP_THRESHOLD = initialHeight * 0.2;

  const isInputFocused =
    document.activeElement && document.activeElement.id === "user-input";
  const messageinputcontainer = getId("message-input-container");

  if (isInputFocused) {
    if (delta > HEIGHT_DROP_THRESHOLD && !keyboardOpen) {
      keyboardOpen = true;
      chatContainer.style.height = "20vh";
      chatContainer.style.marginTop = "-230px";
      if (messageinputcontainer) {
        messageinputcontainer.style.bottom = "280px";
      }
    }
  } else {
    if (keyboardOpen && delta < HEIGHT_DROP_THRESHOLD / 2) {
      keyboardOpen = false;
      if (messageinputcontainer) {
        messageinputcontainer.style.bottom = "20px";
        chatContainer.style.marginTop = "50px";
        adjustChatContainerHeight();
      }
    }
  }
}
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", checkKeyboardOpen);
}
window.addEventListener("load", () => {
  initialHeight = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  console.log("Initial height set:", initialHeight);
});

checkKeyboardOpen();

function handleChatInput(event: Event) {
  try {
    if (state.isProcessing) {
      return;
    }
    checkKeyboardOpen();

    if (event instanceof InputEvent === false) {
      return;
    }
    state.isProcessing = true;
    state.rawContent = preserveEmojiContent(chatInput);

    const selectionBefore = {
      start: state.selectionStart,
      end: state.selectionEnd
    };
    const hasContent = state.rawContent.trim().length > 0;
    toggleSendButton(hasContent);

    const selection = window.getSelection();

    state.cursorPosition =
      selection && selection.rangeCount > 0
        ? DomUtils.calculatePositionFromNode(
            selection.getRangeAt(0).startContainer,
            selection.getRangeAt(0).startOffset
          )
        : selectionBefore.start;

    if (
      event.inputType.startsWith("insert") ||
      event.inputType.startsWith("delete")
    ) {
      const formattedContent = renderEmojisFromContent(state.rawContent);

      if (formattedContent !== chatInput.innerHTML) {
        const savedSelection = {
          start: state.cursorPosition,
          end: state.cursorPosition
        };

        chatInput.innerHTML = DOMPurify.sanitize(
          formattedContent && formattedContent.trim() !== ""
            ? formattedContent
            : " "
        );

        DomUtils.ensureTextNodeAfterImage(chatInput);
        DomUtils.restoreSelection(chatInput, savedSelection);

        requestAnimationFrame(() => {
          DomUtils.syncCursorPosition();
        });
      }

      updatePlaceholderVisibility();
      state.renderedContent = formattedContent;
    }
    state.isProcessing = false;
  } catch (error) {
    console.error("Error in input handling:", error);
    state.isProcessing = false;
  }
  toggleShowEmojiSuggestions();
}
//#endregion

export function initialiseChatInput() {
  chatInput.addEventListener("input", adjustHeight);
  chatInput.addEventListener("keydown", handleUserKeydown);

  chatInput.addEventListener("paste", (e: ClipboardEvent) => {
    e.preventDefault();
    const items = e.clipboardData?.items;
    if (items) {
      let foundMedia = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          foundMedia = true;
          const file = item.getAsFile();
          if (file) {
            FileHandler.handleFileInput([file]);
          }
        }
      }
      if (!foundMedia) {
        const text = e.clipboardData?.getData("text/plain") || "";
        const html = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/ {2}/g, " &nbsp;")
          .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
          .replace(/\n/g, "<br>");
        document.execCommand("insertHTML", false, html);
      }
    }
  });

  const updateCursorOnClick = () => {
    toggleShowEmojiSuggestions();
  };

  chatInput.addEventListener("input", handleChatInput);
  chatInput.addEventListener("click", updateCursorOnClick);
  chatInput.addEventListener("keydown", handleUserKeydown);

  chatInput.addEventListener("beforeinput", handleUserBeforeInput);
  updatePlaceholderVisibility();

  getId("sendbtn")?.addEventListener("click", () => {
    isAttachmentsAdded = false;
    adjustHeight();
    const message = state.rawContent;
    chatInput.innerHTML = "";
    disableElement("userMentionDropdown");
    sendMessage(message);
  });
  toggleSendButton(false);
}
