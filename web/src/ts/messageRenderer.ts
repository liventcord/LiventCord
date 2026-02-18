// messageRenderer.ts — Responsible for creating and updating DOM message elements

import {
  createEl,
  getFormattedDate,
  getFormattedDateForSmall,
  getFormattedDateSelfMessage,
  isContentValid
} from "./utils.ts";
import { setProfilePic } from "./avatar.ts";
import {
  appendToProfileContextList,
  appendToMessageContextList,
  editMessageOnContextList
} from "./contextMenuActions.ts";
import { createTooltipAtCursor } from "./tooltip.ts";
import {
  replaceCustomEmojisForChatContainer,
  setupEmojiListeners
} from "./emoji.ts";
import { translations } from "./translations.ts";
import { observe } from "./chatScroll.ts";
import { UserInfo, Message } from "./types/interfaces.ts";
import { showReplyMenu } from "./chatbar.ts";
import { SVG } from "./svgIcons.ts";

export const CLYDE_ID = "2";
export const SYSTEM_ID = "1";

// ─── Profile image ───
export function createProfileImageChat(
  newMessage: HTMLElement,
  messageContentElement: HTMLElement,
  nick: string,
  userInfo: UserInfo,
  userId: string,
  date: string,
  isBot: boolean = false,
  isAfterDeleting: boolean = false,
  replyBar: HTMLElement | null = null
): void {
  if (!messageContentElement) {
    console.error("No msg content element.", replyBar);
    return;
  }

  const profileElement = buildProfileElement(userId);
  appendToProfileContextList(userInfo, userId);

  const authorAndDate = createEl("div", { className: "author-and-date" });
  const nickElement = createEl("span", {
    textContent: nick,
    className: "nick-element"
  });

  if (isBot) {
    authorAndDate.appendChild(createEl("span", { className: "botSign" }));
  }
  authorAndDate.appendChild(nickElement);

  const dateElement = createEl("span", { className: "date-element" });
  dateElement.textContent = getFormattedDate(date);
  authorAndDate.appendChild(dateElement);

  if (replyBar) {
    newMessage.appendChild(profileElement);
    newMessage.appendChild(authorAndDate);
    newMessage.appendChild(messageContentElement);
    const mediaElement = newMessage.querySelector(".imageElement");
    if (mediaElement) messageContentElement.appendChild(mediaElement);
    newMessage.insertBefore(replyBar, newMessage.firstChild);
    newMessage.classList.add("replier");
  } else {
    newMessage.appendChild(profileElement);
    newMessage.appendChild(authorAndDate);
    newMessage.appendChild(messageContentElement);
    if (isAfterDeleting) {
      const mediaElement = newMessage.querySelector(".imageElement");
      if (mediaElement) messageContentElement.appendChild(mediaElement);
    }
  }

  messageContentElement.classList.add("onsmallprofile");
}

function buildProfileElement(userId: string): HTMLElement {
  if (userId === SYSTEM_ID) {
    const el = createEl("div", {
      className: "profile-pic",
      style: {
        width: "40px",
        height: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    });
    el.innerHTML = SVG.profileElement;
    return el;
  }

  const img = createEl("img", {
    className: "profile-pic",
    id: userId,
    style: { width: "40px", height: "40px" }
  });
  img.dataset.userId = userId;
  setProfilePic(img as HTMLImageElement, userId);
  img.addEventListener("mouseover", () => {
    (img as HTMLElement).style.borderRadius = "0px";
  });
  img.addEventListener("mouseout", () => {
    (img as HTMLElement).style.borderRadius = "25px";
  });
  return img;
}

// ─── Non-profile date stamp ───

export function createNonProfileImage(
  newMessage: HTMLElement,
  date: string
): HTMLElement {
  const smallDateElement = createEl("p", {
    className: "small-date-element",
    textContent: getFormattedDateForSmall(date)
  });
  newMessage.appendChild(smallDateElement);
  smallDateElement.style.position = "absolute";
  smallDateElement.style.marginLeft = "5px";
  return smallDateElement;
}

// ─── Message element factories ───

export function createMessageElement(
  messageId: string,
  userId: string,
  date: string,
  content: string,
  replyToId?: string,
  isNotSent?: boolean,
  chatContent?: HTMLElement
): HTMLElement {
  const newMessage = createEl("div", { className: "message" });
  newMessage.id = messageId;
  newMessage.dataset.m_id = messageId;
  newMessage.dataset.userId = userId;
  newMessage.dataset.date = date;
  newMessage.dataset.content = isContentValid(content) ? content : "";

  if (replyToId) newMessage.dataset.replyToId = replyToId;
  if (isNotSent) newMessage.style.color = "gray";

  if (chatContent) {
    const messages = chatContent.querySelectorAll(".message");
    if (messages.length === 0) newMessage.classList.add("start-chat-message");
  }

  return newMessage;
}

export function createMessageContentElement(): HTMLElement {
  const el = createEl("p", { id: "message-content-element" });
  el.style.position = "relative";
  el.style.wordBreak = "break-all";
  return el;
}

// ─── Edit indicator ───

export function addEditedIndicator(
  messageElement: HTMLElement,
  dateString?: string
): void {
  const date = dateString || new Date().toISOString();
  messageElement.querySelector(".edited-message-indicator")?.remove();

  const editedSpan = createEl("span", {
    className: "edited-message-indicator"
  });
  editedSpan.textContent = `(${translations.getTranslation("message-edited")})`;
  editedSpan.addEventListener("mouseover", () => {
    createTooltipAtCursor(getFormattedDateForSmall(date));
  });
  messageElement.appendChild(editedSpan);
}

// ─── Content processing ───

export function processMessageContent(content: string): string {
  return replaceCustomEmojisForChatContainer(content);
}

export function updateMessageContent(
  element: HTMLElement,
  content: string
): void {
  const formatted = processMessageContent(content);
  element.textContent = formatted;
  element.dataset.content_observe = formatted;
  element.dataset.content = content;
  requestAnimationFrame(() => observe(element));
  setupEmojiListeners();
}

// ─── Edit existing message ───

export function editChatMessageInDOM(
  messageId: string,
  content: string,
  lastEdited?: string
): void {
  const messageElement = document.getElementById(messageId);
  if (!messageElement) {
    console.warn(`Message ${messageId} not found, skipping edit.`);
    return;
  }

  const contentElement = messageElement.querySelector(
    "#message-content-element"
  ) as HTMLElement | null;
  if (!contentElement) {
    console.warn(`Message content element for ${messageId} not found.`);
    return;
  }
  contentElement.dataset.content = content;
  messageElement.dataset.content = content;

  const existingObserved =
    contentElement.dataset.content_observe ?? contentElement.textContent ?? "";
  const newFormatted = processMessageContent(content);

  if (
    existingObserved === newFormatted ||
    contentElement.textContent === newFormatted
  ) {
    if (lastEdited) addEditedIndicator(contentElement, lastEdited);
    return;
  }

  updateMessageContent(contentElement, content);
  if (lastEdited) addEditedIndicator(contentElement, lastEdited);
}

// ─── Option buttons ───

export function createMsgOptionButton(
  message: HTMLElement,
  isReply: boolean
): HTMLElement {
  const textc = isReply ? "↪" : "⋯";
  const newButton = createEl("button", { className: "message-button" });
  const textEl = createEl("div", {
    textContent: textc,
    className: "message-button-text"
  });
  newButton.appendChild(textEl);

  if (isReply) {
    newButton.onclick = () => {
      if (message.dataset?.userId)
        showReplyMenu(message.id, message.dataset.userId);
    };
  }

  newButton.addEventListener("mousedown", () => {
    newButton.style.border = "2px solid #000000";
  });
  newButton.addEventListener("mouseup", () => {
    newButton.style.border = "none";
  });
  newButton.addEventListener("focus", () => {
    newButton.classList.add("is-focused");
  });
  newButton.addEventListener("blur", () => {
    newButton.classList.remove("is-focused");
  });

  let buttonContainer = message.querySelector(".message-button-container");
  if (!buttonContainer) {
    buttonContainer = createEl("div");
    buttonContainer.classList.add("message-button-container");
    message.appendChild(buttonContainer);
  }
  buttonContainer.appendChild(newButton);
  return newButton;
}

export function createOptions3Button(
  message: HTMLElement,
  messageId: string,
  userId: string,
  isSystemMessage: boolean
): void {
  const button = createMsgOptionButton(message, false);
  button.dataset.m_id = messageId;
  appendToMessageContextList(messageId, userId, isSystemMessage);
}

// ─── Date bar ───

export function createDateBar(container: HTMLElement, isoDate: string): void {
  const formattedDate = new Date(isoDate).toLocaleDateString(
    translations.getLocale(),
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
  container.appendChild(
    createEl("span", { className: "dateBar", textContent: formattedDate })
  );
}

// ─── Clyde message extras ───

export function handleClydeMessage(
  newMessage: HTMLElement,
  messageContentElement: HTMLElement
): void {
  const youCanSeeText = createEl("p", {
    textContent: translations.getTranslation("you-can-see-text")
  });
  youCanSeeText.style.fontSize = "0.875rem";
  youCanSeeText.style.color = "rgb(148, 155, 164)";

  const parentElement = createEl("div", {
    display: "flex",
    flexDirection: "column",
    zIndex: 1
  });
  parentElement.style.height = "100%";
  parentElement.appendChild(messageContentElement);
  parentElement.appendChild(youCanSeeText);
  newMessage.appendChild(parentElement);
}

// ─── Timestamp update for self-sent messages ───

export function updateMessageTimestamps(
  element: HTMLElement,
  message: Message
): void {
  if (!message.date) return;

  const dateElement = element.querySelector(".author-and-date .date-element");
  if (dateElement)
    dateElement.textContent = getFormattedDateSelfMessage(message.date);

  const smallDate = element.querySelector(".small-date-element");
  if (smallDate) smallDate.textContent = getFormattedDateForSmall(message.date);
}

// ─── Sync context list for self-sent messages ───

export function syncContextList(message: Message): void {
  if (message.temporaryId) {
    editMessageOnContextList(
      message.temporaryId,
      message.messageId,
      message.userId
    );
  }
}
