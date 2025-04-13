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
import { getId, createEl, disableElement, enableElement } from "./utils.ts";
import { alertUser, displayImagePreview } from "./ui.ts";
import { isOnDm, router } from "./router.ts";
import { maxAttachmentSize } from "./avatar.ts";
import { guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { translations } from "./translations.ts";
import { userManager } from "./user.ts";
import { createEmojiImgTag, currentEmojis } from "./emoji.ts";

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

interface InputState {
  rawContent: string;
  renderedContent: string;
  cursorPosition: number;
  isProcessing: boolean;
  emojiSuggestionsVisible: boolean;
  selectionStart: number;
  selectionEnd: number;
}

const state: InputState = {
  rawContent: "",
  renderedContent: "",
  cursorPosition: 0,
  isProcessing: false,
  emojiSuggestionsVisible: false,
  selectionStart: 0,
  selectionEnd: 0
};

if (replyCloseButton) {
  replyCloseButton.addEventListener("click", closeReplyMenu);
}
function getReadText() {
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

export function initialiseReadUi() {
  if (newMessagesBar) {
    newMessagesBar.addEventListener("click", readCurrentMessages);
  }
  if (newMessagesText) {
    newMessagesText.textContent = getReadText();
  }
}

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
}
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
export function adjustHeight() {
  const MIN_CHAT_HEIGHT = 45;
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  const chatInputHeight = chatInput.scrollHeight;
  chatInput.scrollTop = chatInput.scrollHeight - chatInput.clientHeight;

  const adjustChatContainerHeight = () => {
    const viewportHeight = window.innerHeight;
    const maxAllowedHeight = viewportHeight - chatInputHeight - MIN_CHAT_HEIGHT;
    chatContainer.style.height = `${Math.max(0, maxAllowedHeight)}px`;
  };

  adjustChatContainerHeight();
  window.addEventListener("resize", adjustChatContainerHeight);

  if (
    (chatInput.textContent && chatInput.textContent.split("\n").length <= 1) ||
    chatInputHeight <= MIN_CHAT_HEIGHT
  ) {
    chatInput.style.height = `${MIN_CHAT_HEIGHT}px`;
  }

  adjustReplyPosition();
}
function extractUserIds(message: string) {
  const userIds = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(message)) !== null) {
    const userId = userManager.getUserIdFromNick(match[1]);
    if (userId) {
      userIds.push(userId);
    }
  }
  return userIds;
}

let typingTimeout: number;
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

// upload media

let isAttachmentsAdded: boolean;
const maxFiles = 8;
let fileList: File[] = [];

function handleFileInput(
  eventOrFiles: Event | FileList | File[] | null = null
): void {
  let filesToProcess = extractFiles(eventOrFiles);
  filesToProcess = filterValidFiles(filesToProcess);

  if (fileList.length + filesToProcess.length > maxFiles) {
    filesToProcess = filesToProcess.slice(0, maxFiles - fileList.length);
  }

  filesToProcess.forEach((file) => {
    fileList.push(file);
    processFile(file);
  });

  adjustHeight();

  if (fileList.length > maxFiles) {
    fileList = fileList.slice(0, maxFiles);
  }
}

function extractFiles(eventOrFiles: Event | FileList | File[] | null): File[] {
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

function filterValidFiles(files: File[]): File[] {
  return files.filter(
    (file) =>
      file instanceof Blob && file.size <= maxAttachmentSize * 1024 * 1024
  );
}

function processFile(file: File): void {
  const fileURL = URL.createObjectURL(file);
  renderFilePreview(fileURL, file.name);
  isAttachmentsAdded = true;
}

function renderFilePreview(src: string, fileName: string): void {
  const container = createEl("div", { className: "image-container" });
  const img = createEl("img", { src }) as HTMLImageElement;
  const imageText = createEl("div", {
    className: "image-text",
    textContent: fileName
  });
  container.appendChild(img);

  const imageActionsHTML = `
    <div class="image-actions">
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
      <div class="action-button remove">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path fill="currentColor" d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z" />
          <path fill="currentColor" fill-rule="evenodd" d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  `;

  const imageActions = createEl("div", { innerHTML: imageActionsHTML });
  container.appendChild(imageActions);

  container.appendChild(imageText);
  attachmentsTray.appendChild(container);
  enableElement(attachmentsTray);

  img.addEventListener("click", function () {
    displayImagePreview(img);
  });

  const spoilerButton = imageActions.querySelector(
    ".action-button:nth-child(1)"
  );
  const editButton = imageActions.querySelector(".action-button:nth-child(2)");
  const removeButton = imageActions.querySelector(".action-button.remove");

  spoilerButton?.addEventListener("click", () => toggleSpoilerImage(img));
  editButton?.addEventListener("click", () => editImage(img));
  removeButton?.addEventListener("click", () => {
    removeImage(container);
    if (attachmentsTray.children.length === 0) {
      disableElement(attachmentsTray);
    }
  });
  adjustReplyPositionOnAttachments();
  updateChatWidth();
}

function toggleSpoilerImage(img: HTMLImageElement): void {
  const imgWrapper = img.parentElement;
  const spoilerText = imgWrapper?.querySelector(".spoiler-text");

  if (spoilerText) {
    spoilerText.remove();
    img.style.filter = "";
  } else {
    const text = createEl("span", {
      textContent: "SPOILER",
      className: "spoiler-text"
    });

    imgWrapper?.appendChild(text);
    img.style.filter = "blur(5px)";
  }
}
adjustHeight();
function editImage(img: HTMLImageElement): void {
  alertUser("Image edit is not implemented!");
}

function removeImage(container: HTMLElement): void {
  container.remove();
}

export function setDropHandler() {
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

  fileInput.addEventListener("change", handleFileInput);

  function preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent) {
    const dt = e.dataTransfer;
    const files = dt?.files;
    if (files?.length) {
      handleFileInput(files);
    }
  }
}

export function updatePlaceholderVisibility(newPlaceholder?: string) {
  const text = chatInput.textContent?.trim();
  text
    ? chatInput.removeAttribute("data-placeholder")
    : chatInput.setAttribute(
        "data-placeholder",
        newPlaceholder || "Type a message..."
      );
}

function handleUserKeydown(event: KeyboardEvent) {
  if (sendTypingData) {
    handleTypingRequest();
  }

  if (event.key === "Enter") {
    if (state.emojiSuggestionsVisible) {
      event.preventDefault();
      applyActiveEmojiSuggestion();
      return;
    }
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    handleEmojiSuggestions(event);
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    handleEmojiJump(event);
  }

  if (event.key === " ") {
    handleSpace(event);
  }
  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    const startPos = chatInput.selectionStart as number;
    chatInput.selectionStart = chatInput.selectionEnd = startPos + 1;
    const difference =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    const SMALL_DIFF = 10;
    if (difference < SMALL_DIFF) {
      scrollToBottom();
    }
    chatInput.dispatchEvent(new Event("input"));
  } else if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const userIdsInMessage = extractUserIds(chatInput.innerHTML);
    sendMessage(state.rawContent, userIdsInMessage).then(() => {
      chatInput.value = "";
      isAttachmentsAdded = false;
      adjustHeight();
    });
  }

  if (isDomLoaded && toggleManager.states["party-toggle"]) {
    popKeyboardConfetti();
  }
}

// Suggestions
function showEmojiSuggestions() {
  console.log("showEmojiSuggestions");

  const currentCursorPos = state.cursorPosition;
  const textUpToCursor = state.rawContent.substring(0, currentCursorPos);
  triggerEmojiSuggestionDisplay(textUpToCursor, state.cursorPosition);
}

function hideEmojiSuggestions() {
  console.log("hideEmojiSuggestions");

  state.emojiSuggestionsVisible = false;
  disableElement("emojiSuggestionDropdown");
  const dd = getId("emojiSuggestionDropdown");
  if (dd) dd.innerHTML = "";
}
const emojiSuggestionDropdown = getId(
  "emojiSuggestionDropdown"
) as HTMLSelectElement;

function triggerEmojiSuggestionDisplay(
  textContext: string,
  cursorPosition: number
) {
  const relevantText = textContext.slice(0, cursorPosition);
  const lastColonIndex = relevantText.lastIndexOf(":");
  const emojiQuery =
    lastColonIndex !== -1 ? relevantText.slice(lastColonIndex + 1) : "";

  if (!emojiQuery || !emojiSuggestionDropdown) return;

  emojiSuggestionDropdown.innerHTML = "";
  state.emojiSuggestionsVisible = false;

  const matching = currentEmojis.filter((emoji) =>
    emoji.fileName.startsWith(emojiQuery)
  );

  if (matching.length === 0) {
    state.emojiSuggestionsVisible = false;
    emojiSuggestionDropdown.style.display = "none";
    return;
  }

  matching.forEach((emoji) => {
    const suggestion = createEl("div", {
      className: "mention-option",
      innerHTML: createEmojiImgTag(emoji.fileId) + emoji.fileName
    });
    suggestion.dataset.id = emoji.fileId;
    emojiSuggestionDropdown.appendChild(suggestion);
  });

  state.emojiSuggestionsVisible = true;
  emojiSuggestionDropdown.style.display = "flex";
  highlightSuggestion(0);
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

          event.preventDefault();

          requestAnimationFrame(() => {
            state.rawContent = preserveEmojiContent(chatInput);
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.rangeCount > 0) {
              const newPos = calculatePositionFromNode(
                currentSelection.getRangeAt(0).startContainer,
                currentSelection.getRangeAt(0).startOffset
              );
              state.cursorPosition = newPos;
              state.selectionStart = newPos;
              state.selectionEnd = newPos;
            }
          });
        } else {
          const textNode = document.createTextNode("\u200B");
          chatInput.appendChild(textNode);
          const newRange = document.createRange();
          newRange.setStart(textNode, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);

          event.preventDefault();

          requestAnimationFrame(() => {
            state.rawContent = preserveEmojiContent(chatInput);
            state.cursorPosition = state.rawContent.length;
            state.selectionStart = state.cursorPosition;
            state.selectionEnd = state.cursorPosition;
          });
        }
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
        if (nodeBeforeImg && nodeBeforeImg.nodeType === Node.TEXT_NODE) {
          const newRange = document.createRange();
          newRange.setStart(
            nodeBeforeImg,
            nodeBeforeImg.textContent?.length || 0
          );
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          const newRange = document.createRange();
          newRange.setStartBefore(prevNode);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }

        event.preventDefault();

        requestAnimationFrame(() => {
          state.rawContent = preserveEmojiContent(chatInput);
          const currentSelection = window.getSelection();
          if (currentSelection && currentSelection.rangeCount > 0) {
            const newPos = calculatePositionFromNode(
              currentSelection.getRangeAt(0).startContainer,
              currentSelection.getRangeAt(0).startOffset
            );
            state.cursorPosition = newPos;
            state.selectionStart = newPos;
            state.selectionEnd = newPos;
          }
        });
      }
    }
  }
}

function calculatePositionFromNode(node: Node, offset: number): number {
  let position = 0;

  const walkNodeUntil = (currentNode: Node, targetNode: Node): boolean => {
    if (currentNode === targetNode) {
      return true;
    }

    if (currentNode.nodeType === Node.TEXT_NODE) {
      position += currentNode.textContent?.length || 0;
    } else if (
      currentNode.nodeType === Node.ELEMENT_NODE &&
      currentNode.nodeName === "IMG"
    ) {
      const element = currentNode as HTMLElement;
      const emojiMatch = element.getAttribute("alt")?.match(/Emoji (\d+)/);
      const emojiId = element.getAttribute("data-emoji-id");

      if (emojiId) {
        position += `:${emojiId}:`.length;
      } else if (emojiMatch) {
        position += `:${emojiMatch[1]}:`.length;
      } else {
        position += 1;
      }
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

function findPreviousNode(node: Node): Node | null {
  if (node.previousSibling) {
    let current = node.previousSibling;
    while (current.lastChild) {
      current = current.lastChild;
    }
    return current;
  }
  return node.parentNode;
}

function findNextNode(node: Node): Node | null {
  if (node.firstChild) return node.firstChild;
  if (node.nextSibling) return node.nextSibling;

  let current = node;
  while (current.parentNode && !current.nextSibling)
    current = current.parentNode;
  return current.nextSibling;
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
    document.execCommand("insertText", false, "   ");

    requestAnimationFrame(() => {
      state.rawContent = preserveEmojiContent(chatInput);
      const currentSelection = window.getSelection();
      if (currentSelection && currentSelection.rangeCount > 0) {
        const newPos = calculatePositionFromNode(
          currentSelection.getRangeAt(0).startContainer,
          currentSelection.getRangeAt(0).startOffset
        );
        state.cursorPosition = newPos;
        state.selectionStart = newPos;
        state.selectionEnd = newPos;
      }
      syncCursorPosition();
    });
  }
}

function processEmojisWithPositions(content: string): string {
  const emojiRegex = /:(\d+):/g;
  const positions = [];
  let lastIndex = 0,
    result = "",
    match;

  while ((match = emojiRegex.exec(content)) !== null) {
    const emojiId = match[1];
    result += content.slice(lastIndex, match.index);

    if (emojiId.length === router.ID_LENGTH) {
      const start = result.length;
      const imgTag = createEmojiImgTag(emojiId);
      result += imgTag;
      positions.push({ start, end: start + imgTag.length });
    } else {
      result += match[0];
    }
    lastIndex = match.index + match[0].length;
  }
  result += content.slice(lastIndex);
  return result;
}

export function resetChatInputState() {
  state.rawContent = "";
  state.renderedContent = "";
  state.cursorPosition = 0;
  state.isProcessing = false;
  state.selectionStart = 0;
  state.selectionEnd = 0;
}
function preserveEmojiContent(element: HTMLElement): string {
  let result = "";
  const walkNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === "IMG") {
        const img = node as HTMLImageElement;
        const dataId = img.getAttribute("data-id");

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

function syncCursorPosition() {
  if (state.emojiSuggestionsVisible) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const cursorNode = range.startContainer;
  const cursorOffset = range.startOffset;
  state.cursorPosition = calculatePositionFromNode(cursorNode, cursorOffset);

  if (selection.rangeCount > 0) {
    const startRange = selection.getRangeAt(0).cloneRange();
    startRange.collapse(true);
    state.selectionStart = calculatePositionFromNode(
      startRange.startContainer,
      startRange.startOffset
    );
    state.selectionEnd = state.cursorPosition;
  }

  toggleShowEmojiSuggestions();
}

function toggleShowEmojiSuggestions() {
  const start = Math.max(0, state.cursorPosition - 30);
  const textBeforeCursor = state.rawContent.slice(start, state.cursorPosition);
  textBeforeCursor.trimStart().startsWith(":")
    ? showEmojiSuggestions()
    : hideEmojiSuggestions();
}

function restoreSelection(
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
        const emojiId = img.getAttribute("data-emoji-id");
        if (emojiId) {
          charIndex += `:${emojiId}:`.length;
        } else {
          const emojiMatch = img.getAttribute("alt")?.match(/Emoji (\d+)/);
          if (emojiMatch) {
            charIndex += `:${emojiMatch[1]}:`.length;
          } else {
            charIndex += 1;
          }
        }
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

export function monitorInputForEmojis() {
  updatePlaceholderVisibility();

  function handleChatInput(event: Event) {
    try {
      if (state.isProcessing) return;

      if (event instanceof InputEvent) {
        state.isProcessing = true;

        const previousRawContent = state.rawContent;
        state.rawContent = preserveEmojiContent(chatInput);

        if (
          state.rawContent.trim() === "" &&
          previousRawContent.match(/:\d+:/)
        ) {
          state.rawContent = previousRawContent;
        }

        syncCursorPosition();

        if (
          event.inputType.startsWith("insert") ||
          event.inputType.startsWith("delete")
        ) {
          const formattedContent = processEmojisWithPositions(state.rawContent);

          if (formattedContent !== chatInput.innerHTML) {
            const savedSelection = {
              start: state.selectionStart,
              end: state.selectionEnd
            };

            chatInput.innerHTML =
              formattedContent && formattedContent.trim() !== ""
                ? formattedContent
                : "\u2800";

            ensureTextNodeAfterImage(chatInput);
            restoreSelection(chatInput, savedSelection);

            requestAnimationFrame(() => {
              syncCursorPosition();
            });
          }

          updatePlaceholderVisibility();
          state.renderedContent = formattedContent;
        }
        state.isProcessing = false;
      }
    } catch (error) {
      console.error("Error in input handling:", error);
      state.isProcessing = false;
    }
    toggleShowEmojiSuggestions();
  }

  chatInput.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      handleEmojiJump(event);
    } else if (event.key === " ") {
      handleSpace(event);
    }
    requestAnimationFrame(syncCursorPosition);
  });

  chatInput.addEventListener("input", handleChatInput);
  chatInput.addEventListener("click", () => {
    requestAnimationFrame(syncCursorPosition);
  });

  chatInput.addEventListener("focus", () => {
    requestAnimationFrame(syncCursorPosition);
  });

  updatePlaceholderVisibility();
}

function ensureTextNodeAfterImage(element: HTMLElement) {
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

function findLastTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node;

  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const lastTextNode = findLastTextNode(node.childNodes[i]);
    if (lastTextNode) return lastTextNode;
  }
  return null;
}
