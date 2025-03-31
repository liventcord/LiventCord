import {
  getMessageDate,
  getOldMessages,
  replaceCustomEmojis,
  Message,
  MessageReply
} from "./message.ts";
import {
  chatInput,
  displayStartMessage,
  newMessagesBar,
  replyInfo,
  showReplyMenu,
  chatContainer,
  chatContent,
  attachmentsTray
} from "./chatbar.ts";
import {
  cacheInterface,
  setMessagesCache,
  clearMessagesCache,
  currentMessagesCache,
  guildCache,
  replyCache
} from "./cache.ts";
import {
  isURL,
  getId,
  createEl,
  getFormattedDateForSmall,
  sanitizeHTML,
  getFormattedDate
} from "./utils.ts";
import {
  currentUserId,
  setLastTopSenderId,
  UserInfo,
  userManager
} from "./user.ts";
import { createMediaElement } from "./mediaElements.ts";
import { apiClient, EventType } from "./api.ts";
import { isOnGuild, isOnMePage } from "./router.ts";
import {
  appendToProfileContextList,
  appendToMessageContextList
} from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { currentGuildId } from "./guild.ts";
import { isChangingPage, createReplyBar } from "./app.ts";
import { loadingScreen, setActiveIcon } from "./ui.ts";
import { translations } from "./translations.ts";
import { friendsCache } from "./friends.ts";
import { playNotification } from "./audio.ts";
import { userList } from "./userList.ts";
import { emojiBtn, gifBtn } from "./mediaPanel.ts";
import { constructUserData } from "./popups.ts";
import { createTooltipAtCursor } from "./tooltip.ts";

export let bottomestChatDateStr: string;
export function setBottomestChatDateStr(date: string) {
  bottomestChatDateStr = date;
}
export let lastMessageDate: Date;
export let currentLastDate: Date;
export function clearLastDate() {
  currentLastDate = new Date();
}
let lastSenderID = "";
export function setLastSenderID(id: string) {
  lastSenderID = id;
}
export const messageDates: { [key: string]: Date } = {};

const unknownReplies: string[] = [];

let isLastMessageStart = false;
export function setIsLastMessageStart(val: boolean) {
  isLastMessageStart = val;
}

let isReachedChannelEnd = false;
export function setReachedChannelEnd(val: boolean) {
  isReachedChannelEnd = val;
}

export const CLYDE_ID = "1";

export function createChatScrollButton() {
  const scrollButton = getId("scroll-to-bottom") as HTMLElement;
  if (!chatContainer) {
    console.error("Chat container is null");
    return;
  }

  chatContainer.addEventListener("scroll", function () {
    const threshold = window.innerHeight;
    const hiddenContent =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    if (hiddenContent > threshold) {
      scrollButton.style.display = "flex";
    } else {
      scrollButton.style.display = "none";
    }
  });
  scrollButton.addEventListener("click", function () {
    scrollButton.style.display = "none";
    scrollToBottom();
  });
}

function handleReplyMessage(
  data: Message,
  messageId: string,
  newMessage: HTMLElement,
  replyOf?: string,
  replyToId?: string
) {
  if (replyOf === messageId) {
    setTimeout(() => {
      scrollToMessage(newMessage);
    }, 0);
  }
  if (replyToId) {
    const foundReply = getId(replyToId);
    if (foundReply) {
      const _messageId = foundReply.dataset.messageId;
      const userId = foundReply.dataset.userId;
      const content = foundReply.dataset.content;
      const attachmentUrls = foundReply.dataset.attachmentUrls;
      if (_messageId && userId) {
        createReplyBar(newMessage, _messageId, userId, attachmentUrls, content);
      }
      return foundReply;
    } else {
      unknownReplies.push(data.messageId);
    }
  }
  return null;
}
export function handleReplies() {
  if (!chatContent) {
    return;
  }

  Object.values(replyCache).forEach((message: MessageReply) => {
    const replierElements = Array.from(chatContent.children).filter(
      (element) => {
        const htmlElement = element as HTMLElement;
        return htmlElement.dataset.replyToId === message.messageId;
      }
    ) as HTMLElement[];

    console.log(replierElements, message.replies);
    replierElements.forEach((replier) => {
      message.replies.forEach((msg) => {
        const attachmentUrls = msg.attachmentUrls
          ? msg.attachmentUrls.toString()
          : "";
        createReplyBar(
          replier,
          message.messageId,
          msg.userId,
          msg.content,
          attachmentUrls
        );
        console.log(
          "Creating reply bar.",
          replier,
          message.messageId,
          msg.userId,
          msg.content
        );
      });
    });
  });
}

export function scrollToMessage(messageElement: HTMLElement) {
  messageElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

let hasJustFetchedMessages: boolean = false;
export function setHasJustFetchedMessagesFalse() {
  hasJustFetchedMessages = false;
}
let isFetchingOldMessages = false;
let stopFetching = false;

async function getOldMessagesOnScroll() {
  if (isReachedChannelEnd || isOnMePage || stopFetching) {
    return;
  }
  const oldestDate = getMessageDate();
  if (!oldestDate) return;
  if (oldestDate === "1970-01-01 00:00:00.000000+00:00") {
    return;
  }
  hasJustFetchedMessages = true;
  await getOldMessages(new Date(oldestDate));
  isFetchingOldMessages = false;
  stopFetching = true;
  console.log("Fetching complete. Resetting flag.");
  setHasJustFetchedMessagesFalse();
  setTimeout(() => {
    stopFetching = false;
  }, 1000);
}
export async function handleScroll() {
  if (loadingScreen && loadingScreen.style.display === "flex") {
    return;
  }
  const buffer = 10;
  const scrollPosition = chatContainer.scrollTop;
  const isAtTop = scrollPosition <= buffer;

  if (isAtTop && !isFetchingOldMessages && chatContent.children.length > 0) {
    isFetchingOldMessages = true;
    console.log("Fetching old messages...");

    try {
      const updatedScrollPosition = chatContainer.scrollTop;
      if (updatedScrollPosition <= buffer) {
        await getOldMessagesOnScroll();
      }
    } catch (error) {
      console.error("Error fetching old messages:", error);
    }
  }
}
const observer = new IntersectionObserver(
  (entries, _observer) => {
    entries.forEach((entry) => {
      if (entry.target instanceof HTMLElement) {
        const target = entry.target as HTMLElement;
        if (
          target &&
          entry.isIntersecting &&
          target.dataset.contentLoaded !== "true"
        ) {
          setTimeout(() => {
            loadObservedContent(target);
            observer.unobserve(target);
            target.dataset.contentLoaded = "true";
          }, 100);
        }
      }
    });
  },
  { threshold: 0.1 }
);

export function observe(element: HTMLElement) {
  if (!element) return;
  observer.observe(element);
}
function loadObservedContent(targetElement: HTMLElement) {
  const jsonData = targetElement.dataset.content_observe;
  if (jsonData && targetElement.dataset.contentLoaded !== "true") {
    const sanitizedHTML = sanitizeHTML(jsonData);
    const tempDiv = createEl("div");
    tempDiv.innerHTML = sanitizedHTML;
    const nodes = Array.from(tempDiv.childNodes);
    for (let i = nodes.length - 1; i >= 0; i--) {
      targetElement.insertBefore(nodes[i], targetElement.firstChild);
    }
  }
}

export interface NewMessageResponse {
  guildId?: string;
  isOldMessages: boolean;
  isDm: boolean;
  messages: Message[];
  channelId: string;
  oldestMessageDate?: string | null;
}
export interface EditMessageResponse {
  guildId?: string;
  isDm: boolean;
  messageId: string;
  content: string;
  channelId: string;
}

function clearDateBarAndStartMessageFromChat() {
  const messages = Array.from(chatContent.children);

  for (let i = 0; i < messages.length; i++) {
    const element = messages[i] as HTMLElement;

    if (
      element.classList &&
      (element.classList.contains("dateBar") ||
        element.classList.contains("startmessage"))
    ) {
      element.remove();
    }

    if (element.classList && element.classList.contains("message")) {
      break;
    }
  }
}

export function handleOldMessagesResponse(data: NewMessageResponse) {
  console.log("Processing old messages: ", data);

  const { messages: history, oldestMessageDate } = data;

  if (!Array.isArray(history) || history.length === 0) {
    isReachedChannelEnd = true;
    displayStartMessage();
    return;
  }

  const repliesList = new Set<string>();

  const oldestMessageDateOnChannel = oldestMessageDate
    ? new Date(oldestMessageDate)
    : null;

  let firstMessageDate = new Date();

  clearDateBarAndStartMessageFromChat();

  history.forEach((msgData) => {
    const { date, messageId } = msgData;
    msgData.addToTop = true;
    msgData.willDisplayProfile = true;

    const foundReply = displayChatMessage(msgData);
    if (foundReply) {
      repliesList.add(messageId);
    }

    if (!firstMessageDate || new Date(date) < firstMessageDate) {
      firstMessageDate = new Date(date);
    }
  });

  fetchReplies(history, repliesList);

  if (oldestMessageDateOnChannel) {
    if (
      !isNaN(firstMessageDate.getTime()) &&
      firstMessageDate.getTime() === oldestMessageDateOnChannel.getTime()
    ) {
      displayStartMessage();
    }
  } else {
    console.error("Invalid oldest message date received.");
  }
}

export function handleNewMessage(data: NewMessageResponse): void {
  try {
    console.warn("Received message data:", data);

    if (data.isOldMessages) {
      handleOldMessagesResponse(data);
      return;
    }

    const { isDm, channelId } = data;
    const userId = data.messages[0].userId;
    console.log(`isDm: ${isDm}, channelId: ${channelId}, userId: ${userId}`);

    const idToCompare = isDm
      ? friendsCache.currentDmId
      : guildCache.currentChannelId;

    if (data.guildId !== currentGuildId || idToCompare !== channelId) {
      console.log(
        `guildId ${data.guildId} does not match currentGuildId ${currentGuildId} or channelId ${channelId} does not match idToCompare ${idToCompare}. Returning.`
      );

      if (userId !== currentUserId) {
        console.log(
          "UserId does not match currentUserId, playing notification sound."
        );
        playNotification();
        setActiveIcon();
      }
      return;
    }

    const message = data.messages[0];
    if (typeof message.date === "string") {
      message.date = new Date(message.date);
      console.log("Converted date string to Date object:", message.date);
    }

    displayChatMessage(message);

    fetchReplies(data.messages, new Set<string>());
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

export function handleEditMessage(data: EditMessageResponse): void {
  try {
    console.warn("Received edit message data:", data);

    const { isDm, channelId } = data;

    const idToCompare = isDm
      ? friendsCache.currentDmId
      : guildCache.currentChannelId;

    if (data.guildId !== currentGuildId || idToCompare !== channelId) {
      console.log(
        `guildId ${data.guildId} does not match currentGuildId ${currentGuildId} or channelId ${channelId} does not match idToCompare ${idToCompare}. Returning.`
      );

      return;
    }

    editChatMessage(data);
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

function isScrolledToBottom() {
  return (
    chatContainer.scrollHeight - chatContainer.scrollTop <=
    chatContainer.clientHeight + 1
  );
}

function isAllMediaLoaded(elements: NodeListOf<Element>) {
  return Array.from(elements).every((media) => {
    if (media instanceof HTMLImageElement) {
      return media.complete;
    } else if (media instanceof HTMLMediaElement) {
      return media.readyState === 4;
    }
    return true;
  });
}

export function handleHistoryResponse(data: NewMessageResponse) {
  const { messages, channelId, guildId, oldestMessageDate } = data;

  if (isChangingPage) {
    console.log("Got history response while changing page, ignoring");
    return;
  }

  isLastMessageStart = false;
  clearMessagesCache();

  if (!Array.isArray(messages) || messages.length === 0) {
    displayStartMessage();
    return;
  }

  validateChannelAndGuild(channelId, guildId);

  if (guildId) {
    cacheInterface.setMessages(guildId, guildId, messages);
  }

  processMessages(messages, oldestMessageDate);
}

function processMessages(messages: any[], oldestMessageDate?: string | null) {
  const firstMessageDateOnChannel = oldestMessageDate
    ? new Date(oldestMessageDate)
    : null;
  const repliesList = new Set<string>();
  const wasAtBottom = isScrolledToBottom();
  chatContainer.style.overflow = "hidden";

  messages.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const msgData of messages) {
    const msg = new Message(msgData);
    const foundReply = displayChatMessage(msg);

    if (foundReply) {
      repliesList.add(msg.messageId);
      const index = unknownReplies.indexOf(msg.messageId);
      if (index !== -1) {
        unknownReplies.splice(index, 1);
      }
    }
  }

  fetchReplies(messages, new Set<string>());

  if (wasAtBottom) {
    scrollToBottom();
  }

  setupScrollHandling(wasAtBottom);

  if (
    messages[0]?.date &&
    firstMessageDateOnChannel &&
    new Date(messages[0].date).getTime() === firstMessageDateOnChannel.getTime()
  ) {
    displayStartMessage();
  }
}

function setupScrollHandling(wasAtBottom: boolean) {
  let isUserInteracted = false;
  const userScrollEvents = ["mousedown", "touchstart", "wheel"];

  const releaseScrollLock = () => {
    isUserInteracted = true;
    chatContainer.style.overflow = "";
    userScrollEvents.forEach((event) =>
      chatContainer.removeEventListener(event, releaseScrollLock)
    );
  };

  userScrollEvents.forEach((event) =>
    chatContainer.addEventListener(event, releaseScrollLock)
  );

  chatContainer.addEventListener("scroll", () => {
    isUserInteracted = !isScrolledToBottom();
  });

  const mediaElements = chatContainer.querySelectorAll("img, video, iframe");
  const mediaLoadedPromises = createMediaLoadPromises(mediaElements);

  const _observer = new MutationObserver(() => {
    if (wasAtBottom && !isUserInteracted) {
      scrollToBottom();
    }
  });

  _observer.observe(chatContainer, {
    childList: true,
    subtree: true
  });

  let lastHeight = chatContainer.scrollHeight;
  const monitorContentSizeChanges = () => {
    const currentHeight = chatContainer.scrollHeight;

    if (currentHeight !== lastHeight && wasAtBottom && !isUserInteracted) {
      chatContainer.scrollTop = currentHeight;
    }

    lastHeight = currentHeight;

    if (isAllMediaLoaded(mediaElements)) {
      chatContainer.style.overflow = "";
      _observer.disconnect();
    } else {
      setTimeout(monitorContentSizeChanges, 50);
    }
  };

  Promise.all(mediaLoadedPromises).then(() => {
    chatContainer.style.overflow = "";
    _observer.disconnect();
  });

  monitorContentSizeChanges();

  const preventScrollJump = () => {
    if (!isUserInteracted) {
      if (wasAtBottom) scrollToBottom();
    }
  };

  const preventScrollInterval = setInterval(preventScrollJump, 20);

  setTimeout(() => {
    scrollToBottom();
    clearInterval(preventScrollInterval);
  }, 200);
}

function validateChannelAndGuild(channelId: string, guildId?: string) {
  if (guildId && guildId !== currentGuildId) {
    console.warn(
      "History guild ID is different from current guild",
      guildId,
      currentGuildId
    );
  }
  if (channelId !== guildCache.currentChannelId) {
    console.warn(
      "History channel ID is different from current channel",
      channelId,
      guildCache.currentChannelId
    );
  }
}

function createMediaLoadPromises(mediaElements: NodeListOf<Element>) {
  return Array.from(mediaElements).map((media) => {
    if (media instanceof HTMLImageElement && !media.complete) {
      return new Promise<void>((resolve) => {
        media.addEventListener("load", () => resolve());
        media.addEventListener("error", () => resolve());
      });
    } else if (media instanceof HTMLVideoElement && media.readyState < 4) {
      return new Promise<void>((resolve) => {
        media.addEventListener("loadeddata", () => resolve());
        media.addEventListener("error", () => resolve());
      });
    }
    return Promise.resolve();
  });
}
function createDateBar(currentDate: string) {
  const formattedDate = new Date(currentDate).toLocaleDateString(
    translations.getLocale(),
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
  const datebar = createEl("span", {
    className: "dateBar",
    textContent: formattedDate
  });
  chatContent.appendChild(datebar);
}
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
) {
  if (!messageContentElement) {
    console.error("No msg content element. ", replyBar);
    return;
  }
  const profileImg = createEl("img", {
    className: "profile-pic",
    id: userId
  }) as HTMLImageElement;
  setProfilePic(profileImg, userId);

  profileImg.style.width = "40px";
  profileImg.style.height = "40px";
  profileImg.dataset.userId = userId;
  appendToProfileContextList(userInfo, userId);

  profileImg.addEventListener("mouseover", () => {
    profileImg.style.borderRadius = "0px";
  });
  profileImg.addEventListener("mouseout", () => {
    profileImg.style.borderRadius = "25px";
  });

  const authorAndDate = createEl("div");
  authorAndDate.classList.add("author-and-date");
  const nickElement = createEl("span");
  nickElement.textContent = nick;
  nickElement.classList.add("nick-element");
  if (isBot) {
    const botSign = createEl("span", { className: "botSign" });
    authorAndDate.appendChild(botSign);
  }
  authorAndDate.appendChild(nickElement);
  const messageDate = new Date(date);
  const dateElement = createEl("span");
  dateElement.textContent = getFormattedDate(messageDate);
  dateElement.classList.add("date-element");
  authorAndDate.appendChild(dateElement);

  if (replyBar) {
    newMessage.appendChild(profileImg);
    newMessage.appendChild(authorAndDate);

    newMessage.appendChild(messageContentElement);

    const mediaElement = newMessage.querySelector(".imageElement");
    if (mediaElement) {
      messageContentElement.appendChild(mediaElement);
    }
    if (replyBar) {
      newMessage.insertBefore(replyBar, newMessage.firstChild);
    }
    newMessage.classList.add("replier");
  } else {
    if (isAfterDeleting) {
      newMessage.appendChild(profileImg);
      newMessage.appendChild(authorAndDate);
      newMessage.appendChild(messageContentElement);
      const mediaElement = newMessage.querySelector(".imageElement");
      if (mediaElement && messageContentElement) {
        messageContentElement.appendChild(mediaElement);
      }
    } else {
      newMessage.appendChild(profileImg);
      newMessage.appendChild(authorAndDate);

      newMessage.appendChild(messageContentElement);
    }
  }
  setProfilePic(profileImg, userId);

  messageContentElement.classList.add("onsmallprofile");
}
export function setLastMessageDate(date: Date) {
  lastMessageDate = date;
}
function createOptions3Button(
  message: HTMLElement,
  messageId: string,
  userId: string
) {
  const button = createMsgOptionButton(message, false);
  button.dataset.m_id = messageId;
  appendToMessageContextList(messageId, userId);
}
export function addEditedIndicator(
  messageElement: HTMLElement,
  dateString?: string
): void {
  const date = dateString || new Date().toISOString();
  const existingEditedSpan = messageElement.querySelector(
    ".edited-message-indicator"
  );
  if (existingEditedSpan) {
    existingEditedSpan.remove();
  }

  const editedSpan = createEl("span", {
    className: "edited-message-indicator"
  });
  editedSpan.textContent = `(${translations.getTranslation("message-edited")})`;

  editedSpan.addEventListener("mouseover", () => {
    const formattedDate = getFormattedDateForSmall(new Date(date));
    createTooltipAtCursor(formattedDate);
  });

  messageElement.appendChild(editedSpan);
}
function processMessageContent(content: string): string {
  let formattedMessage = replaceCustomEmojis(content);
  if (isURL(content)) formattedMessage = "";
  return formattedMessage;
}

function updateMessageContent(element: HTMLElement, content: string): void {
  const formattedMessage = processMessageContent(content);
  element.textContent = formattedMessage;
  element.dataset.content_observe = formattedMessage;
  requestAnimationFrame(() => observe(element));
}
export function editChatMessage(data: EditMessageResponse): void {
  const { messageId, content } = data;
  const messageElement = getId(messageId);

  if (!messageElement) {
    console.error("Message element not found for edit:", messageId);
    return;
  }

  const messageContentElement = messageElement.querySelector(
    "#message-content-element"
  ) as HTMLElement;

  if (!messageContentElement) {
    console.error("Message content element not found for edit:", messageId);
    return;
  }

  updateMessageContent(messageContentElement, content);
  addEditedIndicator(messageContentElement);
}

export function displayChatMessage(data: Message): HTMLElement | null {
  if (!data || !isValidMessage(data)) return null;

  const {
    messageId,
    userId,
    content,
    channelId,
    date,
    lastEdited,
    attachmentUrls,
    replyToId,
    isBot,
    reactionEmojisIds,
    addToTop,
    metadata,
    embeds,
    willDisplayProfile,
    isNotSent,
    replyOf
  } = data;

  if (currentMessagesCache[messageId]) return null;
  if (!channelId || !date) return null;
  if (!attachmentUrls && content === "" && embeds.length === 0) return null;
  const nick = userManager.getUserNick(userId);
  const newMessage = createMessageElement(
    messageId,
    userId,
    (typeof date === "string" ? new Date(date) : date).toISOString(),
    content,
    attachmentUrls,
    replyToId || undefined,
    isNotSent
  );
  const messageContentElement = createMessageContentElement();

  setMessagesCache(messageId, newMessage);

  const userInfo = constructUserData(userId);
  let isCreatedProfile = false;

  if (addToTop) {
    isCreatedProfile = handleAddToTop(
      newMessage,
      messageContentElement,
      nick,
      userId,
      userInfo,
      (typeof date === "string" ? new Date(date) : date).toISOString(),
      isBot,
      willDisplayProfile
    );
  } else {
    isCreatedProfile = handleRegularMessage(
      newMessage,
      messageContentElement,
      nick,
      userId,
      userInfo,
      date,
      isBot,
      replyToId ?? undefined
    );
  }
  const isEdited = lastEdited !== null;
  if (isEdited) {
    addEditedIndicator(messageContentElement, lastEdited);
  }
  let formattedMessage = replaceCustomEmojis(content);
  if (isURL(content)) formattedMessage = "";

  messageContentElement.dataset.content_observe = formattedMessage;
  requestAnimationFrame(() => observe(messageContentElement));

  newMessage.appendChild(messageContentElement);
  createMediaElement(
    content,
    messageContentElement,
    newMessage,
    metadata,
    embeds,
    attachmentUrls
  );

  if (!currentLastDate) {
    currentLastDate = date;
  }

  updateSenderAndButtons(newMessage, userId, addToTop);
  appendMessageToChat(newMessage, addToTop, isCreatedProfile);

  if (userId === CLYDE_ID) {
    handleClyde(newMessage, messageContentElement);
  }

  const foundReply = handleReplyMessage(
    data,
    messageId,
    newMessage,
    replyOf,
    replyToId ?? undefined
  );
  if (foundReply) return foundReply;

  return null;
}

function isValidMessage(data: Message) {
  return data && data.messageId && data.channelId && data.date;
}
type SentMessage = {
  id: string;
};

const selfSentMessages: SentMessage[] = [];

export function appendtoSelfSentMessages(temporaryId: string) {
  selfSentMessages.push({ id: temporaryId });
}

export function handleSelfSentMessage(data: Message) {
  console.log("Handle self-sent message: ", data);

  const foundMessageIndex = selfSentMessages.findIndex(
    (message) => message.id === data.temporaryId
  );
  console.log(
    selfSentMessages,
    "Found message: ",
    selfSentMessages[foundMessageIndex]
  );

  if (foundMessageIndex !== -1) {
    const element = chatContainer.querySelector(
      `#${CSS.escape(selfSentMessages[foundMessageIndex].id)}`
    ) as HTMLElement;
    if (element) {
      element.style.color = "white";
      const messageContentElement = element.querySelector(
        "#message-content-element"
      ) as HTMLElement;
      console.log(messageContentElement);
      if (messageContentElement && data.attachmentUrls) {
        console.log(
          "Create media element: ",
          data.content,
          messageContentElement,
          element,
          data.metadata,
          data.embeds,
          data.attachmentUrls
        );
        createMediaElement(
          data.content,
          messageContentElement,
          element,
          data.metadata,
          data.embeds,
          data.attachmentUrls
        );
      }
    }
    selfSentMessages.splice(foundMessageIndex, 1);
  }
}

function createMessageElement(
  messageId: string,
  userId: string,
  date: string,
  content: string,
  attachmentUrls: string | string[] | undefined,
  replyToId?: string,
  isNotSent?: boolean
) {
  const newMessage = createEl("div", { className: "message" });
  newMessage.id = messageId;
  newMessage.dataset.userId = userId;
  newMessage.dataset.date = date;
  newMessage.dataset.content = content;

  if (attachmentUrls) {
    newMessage.dataset.attachmentUrls = Array.isArray(attachmentUrls)
      ? attachmentUrls.join(",")
      : attachmentUrls;
  }
  if (replyToId) {
    newMessage.dataset.replyToId = replyToId;
  }
  if (isNotSent) {
    newMessage.style.color = "gray";
  }
  return newMessage;
}

function createMessageContentElement() {
  const messageContentElement = createEl("p", {
    id: "message-content-element"
  });
  messageContentElement.style.position = "relative";
  messageContentElement.style.wordBreak = "break-all";
  return messageContentElement;
}

function handleAddToTop(
  newMessage: HTMLElement,
  messageContentElement: HTMLElement,
  nick: string,
  userId: string,
  userInfo: UserInfo,
  date: string,
  isBot: boolean,
  willDisplayProfile: boolean
) {
  let isCreatedProfile = false;
  if (willDisplayProfile) {
    isCreatedProfile = true;
    createProfileImageChat(
      newMessage,
      messageContentElement,
      nick,
      userInfo,
      userId,
      date,
      isBot
    );
  } else {
    createNonProfileImage(newMessage, date);
  }
  return isCreatedProfile;
}

function handleRegularMessage(
  newMessage: HTMLElement,
  messageContentElement: HTMLElement,
  nick: string,
  userId: string,
  userInfo: UserInfo,
  date: Date,
  isBot: boolean,
  replyToId?: string
) {
  const MILLISECONDS_IN_A_SECOND = 1000;
  const MINIMUM_TIME_GAP_IN_SECONDS = 300;

  const currentDateNumber = new Date(date).setHours(0, 0, 0, 0);
  if (!lastMessageDate || lastMessageDate.getTime() !== currentDateNumber) {
    createDateBar(new Date(currentDateNumber).toISOString());
    lastMessageDate = new Date(currentDateNumber);
  }

  const difference =
    Math.abs(
      new Date(bottomestChatDateStr).getTime() - new Date(date).getTime()
    ) / MILLISECONDS_IN_A_SECOND;
  const isTimeGap = difference > MINIMUM_TIME_GAP_IN_SECONDS;
  const dateString = new Date(date).toISOString();

  if (!lastSenderID || isTimeGap || replyToId) {
    createProfileImageChat(
      newMessage,
      messageContentElement,
      nick,
      userInfo,
      userId,
      dateString,
      isBot
    );
  } else {
    if (lastSenderID !== userId || isTimeGap) {
      createProfileImageChat(
        newMessage,
        messageContentElement,
        nick,
        userInfo,
        userId,
        dateString,
        isBot
      );
    } else {
      createNonProfileImage(newMessage, dateString);
    }
  }
  bottomestChatDateStr = date.toString();
  return true;
}

function updateSenderAndButtons(
  newMessage: HTMLElement,
  userId: string,
  addToTop: boolean
) {
  if (!addToTop) {
    lastSenderID = userId;
  } else {
    setLastTopSenderId(userId);
  }
  if (userId !== currentUserId) {
    createMsgOptionButton(newMessage, true);
  }
  createOptions3Button(newMessage, newMessage.id, userId);
}

function appendMessageToChat(
  newMessage: HTMLElement,
  addToTop: boolean,
  isCreatedProfile: boolean
) {
  if (addToTop) {
    chatContent.insertBefore(newMessage, chatContent.firstChild);
    chatContainer.scrollTop = chatContainer.scrollTop + newMessage.clientHeight;
  } else {
    chatContent.appendChild(newMessage);
    const previousSibling = newMessage.previousElementSibling;
    if (previousSibling) {
      const previousMsgContent = previousSibling.querySelector(
        "#message-content-element"
      );
      if (
        isCreatedProfile &&
        previousMsgContent &&
        previousMsgContent.classList.contains("onsmallprofile") &&
        newMessage.classList.contains("onsmallprofile")
      ) {
        newMessage.classList.add("profile-after-profile");
      }
    }
  }
}

function handleClyde(
  newMessage: HTMLElement,
  messageContentElement: HTMLElement
) {
  const youCanSeeText = createEl("p", {
    textContent: translations.getTranslation("you-can-see-text")
  });
  youCanSeeText.style.fontSize = "12px";
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
function fetchReplies(
  messages: Message[],
  repliesList: Set<string>,
  goToOld = false
): void {
  if (!repliesList) {
    repliesList = new Set<string>();
  }
  if (goToOld) {
    const messageId = messages[0].messageId;
    const existingDate = messageDates[messageId];
    if (existingDate) {
      if (existingDate > currentLastDate) {
        getOldMessages(existingDate, messageId);
      }

      return;
    }
    const data = {
      messageId,
      guildId: currentGuildId,
      channelId: guildCache.currentChannelId
    };
    apiClient.send(EventType.GET_MESSAGE_DATE, data);
    return;
  }
  const messagesArray = Array.isArray(messages) ? messages : [messages];

  const replyIds = messagesArray
    .filter(
      (msg) => !repliesList.has(msg.messageId) && !replyCache[msg.messageId]
    )
    .filter(
      (msg) =>
        msg.replyToId !== undefined &&
        msg.replyToId !== null &&
        msg.replyToId !== ""
    )
    .map((msg) => msg.replyToId);

  if (replyIds.length > 0) {
    const data = {
      ids: replyIds,
      guildId: currentGuildId,
      channelId: guildCache.currentChannelId
    };
    apiClient.send(EventType.GET_BULK_REPLY, data);
  }
}

export function updateChatWidth() {
  if (!userList) return;
  if (userList.style.display === "none") {
    chatInput.classList.add("user-list-hidden");
    replyInfo.classList.add("reply-user-list-open");
    gifBtn.classList.add("gifbtn-user-list-open");
    emojiBtn.classList.add("emojibtn-user-list-open");
    newMessagesBar.classList.add("new-messages-bar-user-list-open");
    attachmentsTray.classList.add("attachments-tray-user-list-open");
  } else {
    chatInput.classList.remove("user-list-hidden");
    replyInfo.classList.remove("reply-user-list-open");
    gifBtn.classList.remove("gifbtn-user-list-open");
    emojiBtn.classList.remove("emojibtn-user-list-open");
    newMessagesBar.classList.remove("new-messages-bar-user-list-open");
    attachmentsTray.classList.remove("attachments-tray-user-list-open");
  }
}

export function getMessageFromChat(top = true): HTMLElement | null {
  const messages = Array.from(chatContent.children);
  const filteredMessages = messages.filter((message) =>
    message.classList.contains("message")
  );

  if (filteredMessages.length === 0) return null;

  if (top) {
    return filteredMessages.reduce<HTMLElement>((topmost, current) => {
      const topmostElement = topmost as HTMLElement;
      const currentElement = current as HTMLElement;
      return currentElement.offsetTop < topmostElement.offsetTop
        ? currentElement
        : topmostElement;
    }, filteredMessages[0] as HTMLElement);
  } else {
    return filteredMessages[filteredMessages.length - 1] as HTMLElement;
  }
}

export function getHistoryFromOneChannel(
  channelId: string,
  isDm = false
): void {
  console.log("Retrieving history...");
  const messages = cacheInterface.getMessages(currentGuildId, channelId);
  console.log(messages);

  if (!isDm && messages && Array.isArray(messages)) {
    const repliesList = new Set<string>();

    if (messages.length > 0) {
      clearMessagesCache();

      for (const msg of messages as Message[]) {
        const foundReply = displayChatMessage(msg);
        if (foundReply) {
          repliesList.add(msg.messageId);
        }
      }
      fetchReplies(messages as Message[], repliesList);

      return;
    } else {
      console.warn("No messages found in cache for this channel.");
    }
  }
  fetchMessagesFromServer(channelId, isDm);
}

let timeoutId: number | null = null;

export function fetchMessagesFromServer(channelId: string, isDm = false) {
  const FETCH_MESSAGES_COOLDOWN = 5000;

  const requestData = {
    channelId,
    isDm,
    guildId: ""
  };
  if (isOnGuild) {
    requestData["guildId"] = currentGuildId;
  }

  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    hasJustFetchedMessages = false;
    timeoutId = null;
  }, FETCH_MESSAGES_COOLDOWN);

  hasJustFetchedMessages = true;

  const typeToUse = isOnGuild
    ? EventType.GET_HISTORY_GUILD
    : EventType.GET_HISTORY_DM;
  apiClient.send(typeToUse, requestData);
}

function createMsgOptionButton(message: HTMLElement, isReply: boolean) {
  const textc = isReply ? "↪" : "⋯";

  const newButton = createEl("button", { className: "message-button" });

  const textEl = createEl("div", {
    textContent: textc,
    className: "message-button-text"
  });
  newButton.appendChild(textEl);
  if (isReply) {
    newButton.onclick = function () {
      if (message.dataset && message.dataset.userId) {
        showReplyMenu(message.id, message.dataset.userId);
      }
    };
  }

  newButton.addEventListener("mousedown", function () {
    newButton.style.border = "2px solid #000000";
  });
  newButton.addEventListener("mouseup", function () {
    newButton.style.border = "none";
  });
  newButton.addEventListener("mouseover", function () {
    newButton.style.backgroundColor = "#393a3b";
  });
  newButton.addEventListener("mouseout", function () {
    newButton.style.backgroundColor = "#313338";
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

function createNonProfileImage(newMessage: HTMLElement, date: string) {
  const messageDate = new Date(date);
  const smallDateElement = createEl("p", {
    className: "small-date-element",
    textContent: getFormattedDateForSmall(messageDate)
  });
  newMessage.appendChild(smallDateElement);
  smallDateElement.style.position = "absolute";
  smallDateElement.style.marginLeft = "5px";

  return smallDateElement;
}
