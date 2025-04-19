import DOMPurify from "dompurify";
import { fileTypeFromBuffer } from "file-type";
import {
  currentSearchUiIndex,
  setCurrentSearchUiIndex,
  highlightOption,
  selectMember,
  updateUserMentionDropdown,
  userMentionDropdown
} from "./search.ts";
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
  sanitizeHtmlInput,
  findPreviousNode,
  findNextNode,
  formatFileSize
} from "./utils.ts";
import { alertUser, displayImagePreview } from "./ui.ts";
import { isOnDm, router } from "./router.ts";
import { maxAttachmentSize } from "./avatar.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { translations } from "./translations.ts";
import { userManager } from "./user.ts";
import {
  generateEmojiImageTag,
  getCurrentEmojis,
  regexIdEmojis
} from "./emoji.ts";
import { maxAttachmentsCount } from "./mediaElements.ts";

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
const emojiSuggestionDropdown = getId(
  "emojiSuggestionDropdown"
) as HTMLSelectElement;

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
  state.rawContent = _state.rawContent;
  state.renderedContent = _state.renderedContent;
  chatInput.innerText = state.rawContent;
  setTimeout(() => {
    chatInput.dispatchEvent(new Event("input"));
  }, 50);
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

export function adjustHeight() {
  const MIN_CHAT_HEIGHT = 500;
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  const chatInputHeight = chatInput.scrollHeight;
  chatInput.scrollTop = chatInput.scrollHeight - chatInput.clientHeight;

  const adjustChatContainerHeight = () => {
    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - chatInputHeight;
    const newHeight = Math.max(MIN_CHAT_HEIGHT, availableHeight);
    chatContainer.style.height = `${newHeight}px`;
  };

  adjustChatContainerHeight();
  window.addEventListener("resize", adjustChatContainerHeight);

  adjustReplyPosition();
}

function extractChannelIds(message: string): string[] {
  const channelIds: string[] = [];
  const regex = /#(\w{19})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    const channelId = cacheInterface.getChannel(
      currentGuildId,
      guildCache.currentChannelId
    )?.channelId;
    if (channelId) {
      channelIds.push(channelId);
    }
  }
  return channelIds;
}

function extractUserIds(message: string): string[] {
  const userIds: string[] = [];
  const regex = /@(\w{18})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    const userId = userManager.getUserIdFromNick(match[1]);
    if (userId) {
      userIds.push(userId);
    }
  }
  return userIds;
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
  if (replyInfo) replyInfo.style.bottom = `${topPosition}px`;
}
function adjustReplyPositionOnAttachments() {
  replyInfo.classList.add("reply-attachments-open");
  replyCloseButton.classList.add("reply-attachments-open");
}
export function closeReplyMenu() {
  if (replyCloseButton) replyCloseButton.style.display = "none";
  if (replyInfo) replyInfo.style.display = "none";
  currentReplyingTo = "";
  chatInput.classList.remove("reply-opened");
}
//#endregion

//#region Reply

let typingTimeout: ReturnType<typeof setTimeout>;
let typingStarted = false;
const TYPING_COOLDOWN = 2000;
const sendTypingData = false;

function handleTypingRequest() {
  if (chatInput.value !== "") {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    if (!typingStarted) {
      typingStarted = true;
      apiClient.send(EventType.START_TYPING, {
        channelId: isOnDm
          ? friendsCache.currentDmId
          : guildCache.currentChannelId,
        guildId: currentGuildId,
        isDm: isOnDm
      });
    }

    typingTimeout = setTimeout(() => {
      typingStarted = false;
      apiClient.send(EventType.STOP_TYPING, {
        channelId: isOnDm
          ? friendsCache.currentDmId
          : guildCache.currentChannelId,
        guildId: currentGuildId,
        isDm: isOnDm
      });
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
    FileHandler.renderFilePreview(fileURL, file.name, isImage, file);
    isAttachmentsAdded = true;
  }

  static async isImageFile(file: File): Promise<boolean> {
    const arrayBuffer = await file.slice(0, 4100).arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const result = await fileTypeFromBuffer(buffer);
    if (result && result.mime.startsWith("image/")) return true;
    return false;
  }

  static async renderFilePreview(
    src: string,
    fileName: string,
    isImage: boolean,
    file: File
  ) {
    const container = createEl("div", { className: "image-container" });
    (container as any)._file = file;
    let img: HTMLImageElement;

    if (isImage) {
      img = createEl("img", { src }) as HTMLImageElement;
    } else {
      img = createEl("i", {
        className: "fa-solid fa-file attachment-preview-file"
      }) as HTMLImageElement;
    }

    const imageText = createEl("div", {
      className: "image-text",
      textContent: fileName
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
      displayImagePreview(img);
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
    const imgWrapper = img.parentElement;

    imgWrapper?.appendChild(text);
    img.style.filter = "blur(10px)";
  }
  static unBlurImage(img: HTMLImageElement) {
    img.style.filter = "";
    const imgWrapper = img.parentElement;
    const spoilerText = imgWrapper?.querySelector(".spoiler-text");
    if (spoilerText) {
      spoilerText.remove();
    }
  }
  static toggleSpoilerImage(img: HTMLImageElement): void {
    const imgWrapper = img.parentElement;
    const spoilerText = imgWrapper?.querySelector(".spoiler-text");
    const file = (imgWrapper as any)?._file as File;
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
    const dropZone = getId("drop-zone");
    const fileButton = getId("file-button");
    if (!dropZone) return;

    if (!fileButton) return;

    const dragEvents = ["dragenter", "dragover", "dragleave", "drop"];
    dragEvents.forEach((eventName) => {
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    const handleDragEnterOrOver = (e: DragEvent) => {
      const dataTransfer = e.dataTransfer;
      if (dataTransfer && dataTransfer.types.includes("text/plain")) {
        dropZone.style.display = "flex";
      }
      dropZone.classList.add("hover");
    };
    dropZone.addEventListener(
      "dragenter",
      (e: Event) => handleDragEnterOrOver(e as DragEvent),
      false
    );
    dropZone.addEventListener(
      "dragover",
      (e: Event) => handleDragEnterOrOver(e as DragEvent),
      false
    );

    const handleDragLeaveOrDrop = (e: DragEvent) => {
      if (e.type === "drop") {
        handleDrop(e);
      } else if (
        e.type === "dragleave" &&
        !dropZone.contains(e.relatedTarget as Node)
      ) {
        dropZone.style.display = "none";
      }
      dropZone.classList.remove("hover");
    };
    dropZone.addEventListener(
      "dragleave",
      (e: Event) => handleDragLeaveOrDrop(e as DragEvent),
      false
    );

    dropZone.addEventListener("drop", handleDrop, false);

    fileButton.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", FileHandler.handleFileInput);

    function preventDefaults(e: Event) {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleDrop(e: DragEvent) {
      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files?.length) {
        FileHandler.handleFileInput(files);
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

class DomUtils {
  private constructor() {}

  static calculatePositionFromNode(node: Node, offset: number): number {
    let position = 0;

    const walkNodeUntil = (currentNode: Node, targetNode: Node): boolean => {
      if (currentNode === targetNode) return true;

      if (currentNode.nodeType === Node.TEXT_NODE) {
        position += currentNode.textContent?.length || 0;
      } else if (
        currentNode.nodeType === Node.ELEMENT_NODE &&
        currentNode.nodeName === "IMG"
      ) {
        const element = currentNode as HTMLElement;
        const emojiId =
          element.getAttribute("data-emoji-id") ||
          element.getAttribute("alt")?.match(/Emoji (\d+)/)?.[1];
        position += emojiId ? `:${emojiId}:`.length : 1;
      }

      if (currentNode.hasChildNodes()) {
        for (let i = 0; i < currentNode.childNodes.length; i++) {
          if (walkNodeUntil(currentNode.childNodes[i], targetNode)) return true;
        }
      }

      return false;
    };

    for (let i = 0; i < chatInput.childNodes.length; i++) {
      if (walkNodeUntil(chatInput.childNodes[i], node)) break;
    }

    return position + offset;
  }

  static syncCursorPosition() {
    if (state.emojiSuggestionsVisible) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    updateStateCursorPos(
      DomUtils.calculatePositionFromNode(
        range.startContainer,
        range.startOffset
      )
    );

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
    if (!selection) return;

    let charIndex = 0;
    let foundStart = false,
      foundEnd = false;
    const startRange = document.createRange();
    let endRange = document.createRange();

    function traverseNodes(node: Node) {
      if (foundStart && foundEnd) return;

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
        if (node.nodeName === "IMG") {
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

        if (node.hasChildNodes())
          Array.from(node.childNodes).forEach(traverseNodes);
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

  static getTextUpToCursorFromNode(node: Node, offset: number): string {
    let textContent = "";

    const walkNode = (currentNode: Node, currentOffset: number) => {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        const text = currentNode.textContent || "";
        textContent += text.slice(0, currentOffset);
      } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
        if (currentNode.nodeName === "IMG") {
          const emojiId = (currentNode as HTMLElement).getAttribute("alt");
          textContent += emojiId ? `:${emojiId}:` : "";
        }
      }

      if (currentNode.hasChildNodes()) {
        for (let i = 0; i < currentNode.childNodes.length; i++) {
          walkNode(currentNode.childNodes[i], currentOffset);
        }
      }
    };

    walkNode(node, offset);
    return textContent;
  }
}

function preserveEmojiContent(element: HTMLElement): string {
  let result = "";

  const walkNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textDecoder = document.createElement("textarea");
      textDecoder.innerHTML = node.textContent || "";
      result += textDecoder.value;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === "IMG") {
        const img = node as HTMLImageElement;
        const dataId = img.getAttribute("data-emoji-id");
        const altMatch = img.getAttribute("alt")?.match(/Emoji emoji-(\d+)/);
        const srcMatch = img.getAttribute("src")?.match(/\/emojis\/(\d+)/);

        if (dataId) {
          result += `:${dataId}:`;
        } else if (altMatch) {
          result += `:${altMatch[1]}:`;
        } else if (srcMatch) {
          result += `:${srcMatch[1]}:`;
        } else if (img.classList.contains("chat-emoji")) {
          console.warn("Failed to extract emoji ID from image", img);
        }
      } else if (node.hasChildNodes()) {
        Array.from(node.childNodes).forEach(walkNode);
      }
    }
  };

  Array.from(element.childNodes).forEach(walkNode);
  return result;
}

function processEmojisWithPositions(content: string): string {
  const positions = [];
  let lastIndex = 0,
    result = "",
    match;
  const sanitizedContent = sanitizeHtmlInput(content);

  const emojis = getCurrentEmojis();
  if (!emojis) {
    return content;
  }

  while ((match = regexIdEmojis.exec(sanitizedContent)) !== null) {
    const emojiId = match[1];
    result += sanitizedContent.slice(lastIndex, match.index);

    if (
      emojiId.length === router.ID_LENGTH &&
      emojis.find((e) => e.fileId === emojiId)
    ) {
      const start = result.length;
      const imgTag = generateEmojiImageTag(emojiId);
      result += imgTag;
      positions.push({ start, end: start + imgTag.length });
    } else {
      result += match[0];
    }
    lastIndex = match.index + match[0].length;
  }
  result += sanitizedContent.slice(lastIndex);
  return result;
}

function handleKeyboardNavigation(event: KeyboardEvent) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    handleEmojiJump(event);
  } else if (event.key === "Backspace") {
    handleBackspace(event);
  } else if (event.key === "Space") {
    handleSpace(event);
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    handleEmojiSuggestions(event);
  }
}

function handleBackspace(event: KeyboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

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

      chatInput.innerHTML = "\u2800";

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

  if (!range.collapsed) return;

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
function handleEmojiJump(event: KeyboardEvent) {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.getRangeAt(0).collapsed
  )
    return;

  const range = selection.getRangeAt(0);
  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;

  if (event.key === "ArrowRight") {
    if (
      currentNode.nodeType === Node.TEXT_NODE &&
      currentOffset === (currentNode.textContent?.length || 0)
    ) {
      const nextNode = findNextNode(currentNode) as HTMLElement;

      if (
        nextNode &&
        nextNode.nodeName === "IMG" &&
        nextNode.classList?.contains("chat-emoji")
      ) {
        const nodeAfterImg = findNextNode(nextNode);

        if (nodeAfterImg) {
          const newRange = document.createRange();
          if (nodeAfterImg.nodeType === Node.TEXT_NODE) {
            newRange.setStart(nodeAfterImg, 0);
          } else {
            newRange.setStartBefore(nodeAfterImg);
          }
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          const textNode = document.createTextNode("\u200B");
          chatInput.appendChild(textNode);
          const newRange = document.createRange();
          newRange.setStart(textNode, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }

        event.preventDefault();
        updateCursorStateAfterNavigation();
      }
    }
  } else if (event.key === "ArrowLeft") {
    if (currentNode.nodeType === Node.TEXT_NODE && currentOffset === 0) {
      const prevNode = findPreviousNode(currentNode);

      if (
        prevNode &&
        prevNode.nodeName === "IMG" &&
        (prevNode as HTMLElement).classList?.contains("chat-emoji")
      ) {
        const nodeBeforeImg = findPreviousNode(prevNode);
        const newRange = document.createRange();

        if (nodeBeforeImg && nodeBeforeImg.nodeType === Node.TEXT_NODE) {
          newRange.setStart(
            nodeBeforeImg,
            nodeBeforeImg.textContent?.length || 0
          );
        } else {
          newRange.setStartBefore(prevNode);
        }

        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        event.preventDefault();
        updateCursorStateAfterNavigation();
      }
    }
  }
}

export function manuallyRenderEmojis(rawContent: string) {
  state.isProcessing = true;

  state.rawContent = rawContent;
  const formattedContent = processEmojisWithPositions(rawContent);

  chatInput.innerHTML = DOMPurify.sanitize(
    formattedContent && formattedContent.trim() !== ""
      ? formattedContent
      : "\u2800"
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
function updateCursorStateAfterNavigation() {
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
  });
}

function handleSpace(event: KeyboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (!range.collapsed) return;

  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;

  const isEmptyTextNode =
    currentNode.nodeType === Node.TEXT_NODE &&
    (currentNode.textContent === "\u200B" || currentNode.textContent === "");

  const isAtEndOfText =
    currentNode.nodeType === Node.TEXT_NODE &&
    currentOffset === (currentNode.textContent?.length || 0);

  const isPrevNodeImg =
    currentNode.previousSibling?.nodeName === "IMG" ||
    (currentNode.parentNode &&
      currentNode.parentNode.previousSibling?.nodeName === "IMG");

  const isLastNode = !currentNode.nextSibling;

  if ((isAtEndOfText || isEmptyTextNode) && (isPrevNodeImg || isLastNode)) {
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
}
function handleUserKeydown(event: KeyboardEvent) {
  if (sendTypingData) {
    handleTypingRequest();
  }
  if (!chatContainer) return;

  if (event.key === "Enter") {
    if (state.emojiSuggestionsVisible) {
      event.preventDefault();
      applyActiveEmojiSuggestion();
      return;
    }

    if (event.shiftKey) {
      adjustHeight();

      // Check if we need to scroll
      const difference =
        chatContainer.scrollHeight -
        (chatContainer.scrollTop + chatContainer.clientHeight);
      const SMALL_DIFF = 10;
      if (difference < SMALL_DIFF) {
        scrollToBottom();
      }
    } else {
      event.preventDefault();
      sendMessage(state.rawContent).then(() => {
        chatInput.value = "";
        isAttachmentsAdded = false;
        adjustHeight();
      });
    }
  } else {
    handleKeyboardNavigation(event);
  }

  if (isDomLoaded && toggleManager.states["party-toggle"]) {
    popKeyboardConfetti();
  }
}

function handleChatInput(event: Event) {
  try {
    if (state.isProcessing) return;

    if (event instanceof InputEvent === false) return;
    state.isProcessing = true;

    const previousRawContent = state.rawContent;
    state.rawContent = preserveEmojiContent(chatInput);

    if (state.rawContent.trim() === "" && previousRawContent.match(/:\d+:/)) {
      state.rawContent = previousRawContent;
    }
    const selectionBefore = {
      start: state.selectionStart,
      end: state.selectionEnd
    };

    DomUtils.syncCursorPosition();

    if (
      event.inputType.startsWith("insert") ||
      event.inputType.startsWith("delete")
    ) {
      const formattedContent = processEmojisWithPositions(state.rawContent);

      if (formattedContent !== chatInput.innerHTML) {
        const selection = window.getSelection();
        const cursorPosition =
          selection && selection.rangeCount > 0
            ? DomUtils.calculatePositionFromNode(
                selection.getRangeAt(0).startContainer,
                selection.getRangeAt(0).startOffset
              )
            : selectionBefore.start;

        const savedSelection = {
          start: cursorPosition,
          end: cursorPosition
        };

        chatInput.innerHTML = DOMPurify.sanitize(
          formattedContent && formattedContent.trim() !== ""
            ? formattedContent
            : "\u2800"
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

//#region Emoji Suggestions
function hideEmojiSuggestions() {
  state.emojiSuggestionsVisible = false;
  disableElement("emojiSuggestionDropdown");
  const dd = getId("emojiSuggestionDropdown");
  if (dd) dd.innerHTML = "";
}

function showEmojiSuggestions() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;

  const textUpToCursor = DomUtils.getTextUpToCursorFromNode(
    currentNode,
    currentOffset
  );
  const safe = sanitizeHtmlInput(textUpToCursor);
  triggerEmojiSuggestionDisplay(safe);
}

function toggleShowEmojiSuggestions() {
  const start = Math.max(0, state.cursorPosition - 30);
  const textBeforeCursor = state.rawContent.slice(start, state.cursorPosition);
  textBeforeCursor.trimStart().startsWith(":")
    ? showEmojiSuggestions()
    : hideEmojiSuggestions();
}

function triggerEmojiSuggestionDisplay(textContext: string) {
  const currentEmojis = getCurrentEmojis();
  if (!currentEmojis) return;

  const lastColonIndex = textContext.lastIndexOf(":");
  const emojiQuery =
    lastColonIndex !== -1 ? textContext.slice(lastColonIndex + 1).trim() : "";

  if (!emojiQuery) return;

  console.log("emojiQuery:", emojiQuery);

  const matching = [];

  for (const emoji of currentEmojis) {
    const fileName = emoji.fileName.toLowerCase().trim();
    const query = emojiQuery.toLowerCase().trim();

    if (fileName.includes(query)) {
      matching.push(emoji);
    }
  }

  console.log("Matching emojis after iteration:", matching);

  if (matching.length === 0) {
    state.emojiSuggestionsVisible = false;
    emojiSuggestionDropdown.style.display = "none";
    return;
  }

  emojiSuggestionDropdown.innerHTML = "";
  state.emojiSuggestionsVisible = false;

  matching.forEach((emoji) => {
    const suggestion = createEl("div", {
      className: "mention-option",
      innerHTML: generateEmojiImageTag(emoji.fileId) + emoji.fileName
    });

    suggestion.dataset.id = emoji.fileId;

    suggestion.addEventListener("click", () => {
      emojiSuggestionDropdown
        .querySelectorAll(".mention-option")
        .forEach((el) => el.classList.remove("active"));
      suggestion.classList.add("active");
      applyActiveEmojiSuggestion();
    });

    emojiSuggestionDropdown.appendChild(suggestion);
  });

  state.emojiSuggestionsVisible = true;
  emojiSuggestionDropdown.style.display = "flex";
  highlightSuggestion(0);
}

function applyActiveEmojiSuggestion() {
  if (!emojiSuggestionDropdown) return;

  const activeItem = emojiSuggestionDropdown.querySelector(
    ".mention-option.active"
  ) as HTMLElement;
  if (!activeItem) return;

  const emojiId = activeItem.dataset.id;
  if (!emojiId) return;

  const insertedText = `:${emojiId}:`;

  const successful = document.execCommand("insertText", false, insertedText);
  if (!successful) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(insertedText));

    range.setStartAfter(range.endContainer);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  chatInput.dispatchEvent(new Event("input", { bubbles: true }));
  setTimeout(() => {
    hideEmojiSuggestions();
  }, 50);
}

function handleEmojiSuggestions(event: KeyboardEvent) {
  if (!state.emojiSuggestionsVisible || !emojiSuggestionDropdown) return;

  const items = Array.from(emojiSuggestionDropdown.children) as HTMLElement[];
  const currentIndex = items.findIndex((el) => el.classList.contains("active"));
  const direction = event.key === "ArrowDown" ? 1 : -1;
  let newIndex = currentIndex + direction;

  if (newIndex < 0) newIndex = items.length - 1;
  if (newIndex >= items.length) newIndex = 0;

  highlightSuggestion(newIndex);
}

function highlightSuggestion(index: number) {
  const items = Array.from(emojiSuggestionDropdown.children) as HTMLElement[];

  items.forEach((el, i) => {
    el.classList.toggle("active", i === index);
    if (i === index) el.scrollIntoView({ block: "nearest" });
  });
}
//#endregion

export function initialiseChatInput() {
  chatInput.addEventListener("input", adjustHeight);
  chatInput.addEventListener("keydown", handleUserKeydown);

  chatInput.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement) {
      if (event.target.value) {
        updateUserMentionDropdown(event.target.value);
      }
    }
  });

  chatInput.addEventListener("keydown", (event) => {
    const options = userMentionDropdown.querySelectorAll(".mention-option");
    if (event.key === "ArrowDown") {
      setCurrentSearchUiIndex((currentSearchUiIndex + 1) % options.length);
      highlightOption(currentSearchUiIndex);
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setCurrentSearchUiIndex(
        (currentSearchUiIndex - 1 + options.length) % options.length
      );
      highlightOption(currentSearchUiIndex);
      event.preventDefault();
    } else if (event.key === "Enter") {
      if (currentSearchUiIndex >= 0 && currentSearchUiIndex < options.length) {
        const selectedUserElement = options[
          currentSearchUiIndex
        ] as HTMLElement;
        const selectedUserId = selectedUserElement.dataset.userid as string;
        const selectedUserNick = selectedUserElement.textContent as string;
        selectMember(selectedUserId, selectedUserNick);
      }
    } else if (event.key === "Escape") {
      userMentionDropdown.style.display = "none";
    }
  });

  const updateCursorOnAction = () => {
    requestAnimationFrame(DomUtils.syncCursorPosition);
  };

  chatInput.addEventListener("input", handleChatInput);
  chatInput.addEventListener("click", updateCursorOnAction);
  chatInput.addEventListener("focus", updateCursorOnAction);
  chatInput.addEventListener("keydown", handleUserKeydown);

  updatePlaceholderVisibility();
}
