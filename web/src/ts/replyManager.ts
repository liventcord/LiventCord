import { createEl, getId } from "./utils.ts";
import { chatContent } from "./chatbar.ts";
import { replyCache, cacheInterface, guildCache } from "./cache.ts";
import { userManager } from "./user.ts";
import { setProfilePic } from "./avatar.ts";
import { translations } from "./translations.ts";
import { apiClient, EventType } from "./api.ts";
import { currentGuildId } from "./guild.ts";
import { scrollToMessage } from "./chatScroll.ts";
import { SYSTEM_ID } from "./messageRenderer.ts";
import { Message, MessageReply } from "./types/interfaces.ts";
import { messageDates, currentLastDate } from "./chatDisplay.ts";
import { getOldMessages } from "./message.ts";
import { drawProfilePopId } from "./profilePop.ts";

const unknownReplies: string[] = [];

export function handleReplyMessage(
  data: Message,
  messageId: string,
  newMessage: HTMLElement,
  replyOf?: string,
  replyToId?: string
): HTMLElement | null {
  if (replyOf === messageId) {
    setTimeout(() => scrollToMessage(newMessage), 0);
  }

  if (!replyToId) return null;

  const foundReply = getId(replyToId);
  if (foundReply) {
    const {
      id: _messageId,
      dataset: { userId, content, attachmentUrls }
    } = foundReply as HTMLElement & { dataset: DOMStringMap };
    if (_messageId && userId) {
      createReplyBar(
        newMessage,
        messageId,
        _messageId,
        userId,
        attachmentUrls,
        content
      );
    }
    return foundReply as HTMLElement;
  }

  unknownReplies.push(data.messageId);
  return null;
}

export function handleReplies(): void {
  if (!chatContent) return;

  Object.values(replyCache).forEach((message: MessageReply) => {
    const replierElements = Array.from(chatContent.children).filter(
      (el) => (el as HTMLElement).dataset.replyToId === message.messageId
    ) as HTMLElement[];

    replierElements.forEach((replier) => {
      message.replies.forEach((msg) => {
        const attachmentUrls = msg.attachments
          ? msg.attachments.toString()
          : "";
        createReplyBar(
          replier,
          message.messageId,
          msg.userId,
          msg.content,
          attachmentUrls
        );
      });
    });
  });
}

export function fetchReplies(
  messages: Message[],
  repliesList: Set<string>,
  goToOld = false
): void {
  repliesList = repliesList ?? new Set<string>();

  if (goToOld) {
    const messageId = messages[0].messageId;
    const existingDate = messageDates[messageId];
    if (existingDate) {
      if (existingDate > currentLastDate)
        getOldMessages(existingDate, messageId);
      return;
    }
    apiClient.send(EventType.GET_MESSAGE_DATE, {
      messageId,
      guildId: currentGuildId,
      channelId: guildCache.currentChannelId
    });
    return;
  }

  const messagesArray = Array.isArray(messages) ? messages : [messages];
  const replyIds = messagesArray
    .filter(
      (msg) => !repliesList.has(msg.messageId) && !replyCache[msg.messageId]
    )
    .filter((msg) => msg.replyToId)
    .map((msg) => msg.replyToId);

  if (replyIds.length > 0) {
    console.error("Unimplemented reply logic");
    // TODO: Implement reply fetch route on backend
    // apiClient.send(EventType.GET_BULK_REPLY, { ids: replyIds, guildId: currentGuildId, channelId: guildCache.currentChannelId });
  }
}

function createReplyBar(
  newMessage: HTMLElement,
  messageId: string,
  originalId: string,
  userId: string,
  attachmentUrls: string | string[] | undefined,
  content?: string
): void {
  if (newMessage.querySelector(".replyBar")) return;

  newMessage.querySelector(".small-date-element")?.remove();

  const replyBar = createEl("div", { className: "replyBar" });
  newMessage.appendChild(replyBar);
  newMessage.classList.add("replyMessage");

  replyBar.style.height = "100px";

  const replyAvatar = buildReplyAvatar(userId);
  const replyNick = createEl("span", {
    textContent: userManager.getUserNick(userId),
    className: "reply-nick"
  });

  if (userId !== SYSTEM_ID) {
    replyAvatar.addEventListener("click", () => drawProfilePopId(userId));
    replyNick.addEventListener("click", () => drawProfilePopId(userId));
  }

  const displayText =
    content ??
    (attachmentUrls
      ? String(attachmentUrls)
      : translations.getTranslation("click-to-attachment"));
  const replyContent = createEl("span", {
    className: "replyContent",
    textContent: displayText
  });

  replyContent.onclick = () => {
    const originalMsg = getId(originalId);
    if (originalMsg) {
      scrollToMessage(originalMsg as HTMLElement);
      return;
    }

    const replyToId = newMessage.dataset.replyToId;
    if (!replyToId) return;

    const cachedMessage = cacheInterface.getMessage(
      currentGuildId,
      guildCache.currentChannelId,
      replyToId
    );
    if (cachedMessage) fetchReplies([cachedMessage], new Set<string>(), true);
  };

  replyBar.appendChild(replyAvatar);
  replyBar.appendChild(replyNick);
  replyBar.appendChild(replyContent);
}

function buildReplyAvatar(userId: string): HTMLElement {
  if (userId === SYSTEM_ID) {
    const el = createEl("div", {
      className: "profile-pic reply-avatar",
      id: userId
    });
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="color:#b3b3b3;" width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path fill="currentColor" d="M19.38 11.38a3 3 0 0 0 4.24 0l.03-.03a.5.5 0 0 0 0-.7L13.35.35a.5.5 0 0 0-.7 0l-.03.03a3 3 0 0 0 0 4.24L13 5l-2.92 2.92-3.65-.34a2 2 0 0 0-1.6.58l-.62.63a1 1 0 0 0 0 1.42l9.58 9.58a1 1 0 0 0 1.42 0l.63-.63a2 2 0 0 0 .58-1.6l-.34-3.64L19 11l.38.38ZM9.07 17.07a.5.5 0 0 1-.08.77l-5.15 3.43a.5.5 0 0 1-.63-.06l-.42-.42a.5.5 0 0 1-.06-.63L6.16 15a.5.5 0 0 1 .77-.08l2.14 2.14Z"/>
    </svg>`;
    return el;
  }

  const img = createEl("img", {
    className: "profile-pic reply-avatar",
    id: userId
  });
  setProfilePic(img as HTMLImageElement, userId);
  return img;
}
