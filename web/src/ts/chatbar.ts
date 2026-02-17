import DOMPurify from "dompurify";
import { friendsCache } from "./friends.ts";
import { scrollToBottom } from "./chat.ts";
import { MESSAGE_LIMIT, trySendMessage } from "./message.ts";
import { isDomLoaded, readCurrentMessages } from "./app.ts";
import { toggleManager } from "./settings.ts";
import { popKeyboardConfetti } from "./extras.ts";
import {
  getId,
  disableElement,
  enableElement,
  findLastTextNode,
  findPreviousNode,
  findNextNode,
  isMobile,
  insertHTML
} from "./utils.ts";
import { isOnDm } from "./router.ts";
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
import {
  getNextFocusableNode,
  getPreviousFocusableNode,
  moveCursorTo,
  moveCursorToEndOf
} from "./navigation.ts";
import { gifBtn } from "./mediaPanel.ts";
import { socketClient } from "./socketEvents.ts";
import { ChatBarState } from "./types/interfaces.ts";
import { FileHandler, isAttachmentsAdded } from "./fileHandler.ts";

export let currentReplyingTo = "";

export const chatInput = getId("user-input") as HTMLElement;
export const chatContainer = getId("chat-container") as HTMLElement;
export const chatContent = getId("chat-content") as HTMLElement;
export const replyInfo = getId("reply-info") as HTMLElement;

export const fileInput = getId("fileInput") as HTMLInputElement;
export const attachmentsTray = getId("attachments-tray") as HTMLElement;
export const newMessagesBar = getId("newMessagesBar") as HTMLElement;

const newMessagesText = getId("newMessagesText") as HTMLSpanElement;
const replyCloseButton = getId("reply-close-button") as HTMLButtonElement;
export const messageLimitText = getId("message-limit") as HTMLSpanElement;
function setMessageLimitText(text: string) {
  const length = text.length;
  const bigText = MESSAGE_LIMIT - length;
  const threshold = MESSAGE_LIMIT * 0.9;
  const isBiggerThanThreshold = length > threshold;
  const isBiggerThanLimit = length > MESSAGE_LIMIT;
  messageLimitText.classList.toggle("message-limit-white", !isBiggerThanLimit);
  messageLimitText.textContent = isBiggerThanThreshold
    ? bigText.toString()
    : "";
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
      newMessagesBar.addEventListener("click", () => {
        readCurrentMessages(guildCache.currentChannelId);
      });
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
  const newHeight = Math.max(MIN_CHAT_HEIGHT, availableHeight) - 20;
  chatContainer.style.height = `${newHeight}px`;
}

let resizeListenerAttached = false;

export function adjustHeight() {
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  chatInput.scrollTop = chatInput.scrollHeight - chatInput.clientHeight;

  adjustChatContainerHeight();

  if (!resizeListenerAttached) {
    window.addEventListener("resize", adjustChatContainerHeight);
    resizeListenerAttached = true;
  }

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
  manuallyRenderEmojis(chatInput, newMessage);
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

function shouldTriggerTyping(e: KeyboardEvent): boolean {
  if (
    e.key.length !== 1 ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.key === " " ||
    e.key === "Enter"
  )
    return false;
  return true;
}

function handleTypingRequest(e: KeyboardEvent) {
  if (!shouldTriggerTyping(e)) return;
  const c = preserveEmojiContent(chatInput);
  if (c !== "") {
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

  function moveCursorToEndOfChatInput() {
    chatInput.focus();
    const lastChild = chatInput.lastChild;
    const newRange = document.createRange();
    if (lastChild) {
      if (lastChild.nodeType === Node.TEXT_NODE) {
        newRange.setStart(lastChild, lastChild.textContent?.length || 0);
      } else {
        newRange.setStartAfter(lastChild);
      }
    } else {
      newRange.setStart(chatInput, 0);
    }
    newRange.collapse(true);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  if (!chatInput.contains(currentNode)) {
    moveCursorToEndOfChatInput();
    return;
  }

  if (event.key === "ArrowRight") {
    let nextNode: Node | null = null;

    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentOffset < (currentNode.textContent?.length || 0)) return;
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

    if (!atStart) {
      if (currentNode.nodeType === Node.TEXT_NODE) return;

      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const children = Array.from(currentNode.childNodes);
        const previousSibling = children[currentOffset - 1];
        if (previousSibling) {
          moveCursorToEndOf(previousSibling);
          event.preventDefault();
          return;
        }
      }
    }

    if (atStart && parentNode) {
      const root = parentNode;
      const firstChild = root.firstChild;

      if (isEmoji(firstChild)) {
        const newTextNode = document.createTextNode("");
        root.insertBefore(newTextNode, firstChild);
        moveCursorTo(newTextNode);
        event.preventDefault();
        return;
      }

      const prevSibling = currentNode.previousSibling;
      if (isEmoji(prevSibling)) {
        const newTextNode = document.createTextNode("");
        root.insertBefore(newTextNode, prevSibling);
        moveCursorTo(newTextNode);
        event.preventDefault();
        return;
      }

      const prevNode = getPreviousFocusableNode(currentNode);
      if (prevNode) {
        moveCursorToEndOf(prevNode);
        event.preventDefault();
      } else {
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

export function manuallyRenderEmojis(
  _chatInput: HTMLElement,
  rawContent: string
): void {
  console.error(_chatInput, "Rendered emoji init: ", _chatInput.innerHTML);
  state.isProcessing = true;

  state.rawContent = rawContent;
  const formattedContent = renderEmojisFromContent(rawContent);

  _chatInput.innerHTML = DOMPurify.sanitize(
    formattedContent && formattedContent.trim() !== "" ? formattedContent : " "
  );
  console.error("Rendered emoji first: ", _chatInput.innerHTML);

  DomUtils.ensureTextNodeAfterImage(_chatInput);

  const savedSelection = {
    start: rawContent.length,
    end: rawContent.length
  };

  DomUtils.restoreSelection(_chatInput, savedSelection);
  state.renderedContent = formattedContent;
  updatePlaceholderVisibility();
  state.isProcessing = false;

  DomUtils.syncCursorPosition();
  toggleShowEmojiSuggestions();
  console.error("Rendered emoji second: ", _chatInput.innerHTML);
}

function handleSpace(event: KeyboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!range.collapsed) return;

  const currentNode = range.startContainer;

  function moveCursorToEnd() {
    chatInput.focus();
    const lastChild = chatInput.lastChild;
    const newRange = document.createRange();
    if (lastChild) {
      if (lastChild.nodeType === Node.TEXT_NODE) {
        newRange.setStart(lastChild, lastChild.textContent?.length || 0);
      } else {
        newRange.setStartAfter(lastChild);
      }
    } else {
      newRange.setStart(chatInput, 0);
    }
    newRange.collapse(true);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  if (!chatInput.contains(currentNode)) {
    moveCursorToEnd();
    return;
  }

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
  handleTypingRequest(event);
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
    state.rawContent = preserveEmojiContent(chatInput);

    setTimeout(() => {
      trySendMessage(state.rawContent).then((sent) => {
        if (!sent) return;
        chatInput.innerHTML = "";
        setMessageLimitText("");
        toggleSendButton(false);
        FileHandler.setIsAttachmentsAddedFalse();
        adjustHeight();
      });
    }, 0);

    return;
  }

  handleKeyboardNavigation(event);

  setTimeout(() => {
    setMessageLimitText(state.rawContent);
    adjustHeight();
  }, 0);

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

function toggleSendButton(canSubmitMessage?: boolean) {
  const hasContent =
    state.rawContent.trim().length > 0 || (fileInput.files?.length ?? 0) > 0;
  const canSend = canSubmitMessage && hasContent && isMobile;

  if (canSend) {
    enableElement(sendBtn);
  } else {
    disableElement(sendBtn);
  }

  sendBtn.classList.toggle("sendbtn-active", canSend);
  emojiBtn?.classList.toggle("send-active", canSend);
  gifBtn?.classList.toggle("send-active", canSend);
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
    toggleSendButton(true);

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
          adjustHeight();
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
    if (!items) return;

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
      insertHTML(html);

      state.rawContent = preserveEmojiContent(chatInput);

      setMessageLimitText(state.rawContent);
    }
  });

  const updateCursorOnClick = () => {
    toggleShowEmojiSuggestions();
  };

  chatInput.addEventListener("input", handleChatInput);
  chatInput.addEventListener("click", updateCursorOnClick);

  chatInput.addEventListener("beforeinput", handleUserBeforeInput);
  updatePlaceholderVisibility();

  getId("sendbtn")?.addEventListener("click", () => {
    FileHandler.setIsAttachmentsAddedFalse();
    adjustHeight();
    const message = state.rawContent;
    chatInput.innerHTML = "";
    disableElement("userMentionDropdown");
    toggleSendButton(false);
    trySendMessage(message);
  });
  toggleSendButton(true);
}
