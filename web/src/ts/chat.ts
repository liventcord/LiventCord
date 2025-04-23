import { reactive } from "vue";
import {
  AttachmentWithMetaData,
  getMessageDate,
  getOldMessages,
  Message,
  MessageReply
} from "./message.ts";
import {
  chatInput,
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
  getFormattedDate,
  getFormattedDateSelfMessage,
  createRandomId,
  createNowDate
} from "./utils.ts";
import {
  currentUserId,
  setLastTopSenderId,
  UserInfo,
  userManager
} from "./user.ts";
import { createMediaElement, handleLink } from "./mediaElements.ts";
import { apiClient, EventType } from "./api.ts";
import { isOnDm, isOnGuild, isOnMePage } from "./router.ts";
import {
  appendToProfileContextList,
  appendToMessageContextList
} from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { currentGuildId } from "./guild.ts";
import { isChangingPage } from "./app.ts";
import { loadingScreen, setActiveIcon } from "./ui.ts";
import { translations } from "./translations.ts";
import { friendsCache } from "./friends.ts";
import { playNotification } from "./audio.ts";
import { userList } from "./userList.ts";
import { emojiBtn, gifBtn } from "./mediaPanel.ts";
import { constructUserData, drawProfilePopId } from "./popups.ts";
import { createTooltipAtCursor } from "./tooltip.ts";
import {
  replaceCustomEmojisForChatContainer,
  setupEmojiListeners
} from "./emoji.ts";
import { currentChannelName } from "./channels.ts";

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
      const _messageId = foundReply.id;
      const userId = foundReply.dataset.userId;
      const content = foundReply.dataset.content;
      const attachmentUrls = foundReply.dataset.attachmentUrls;
      if (_messageId && userId) {
        console.log("Creatingn reply:");
        createReplyBar(
          newMessage,
          messageId,
          _messageId,
          userId,
          attachmentUrls,
          content
        );
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

export function createReplyBar(
  newMessage: HTMLElement,
  messageId: string,
  originalId: string,
  userId: string,
  attachmentUrls: string | string[] | undefined,
  content?: string
) {
  console.log("Create reply bar: ", newMessage, messageId, userId, content);
  if (newMessage.querySelector(".replyBar")) {
    return;
  }
  const smallDate = newMessage.querySelector(".small-date-element");
  if (smallDate) {
    smallDate.remove();
  }

  const replyBar = createEl("div", { className: "replyBar" });
  newMessage.appendChild(replyBar);
  newMessage.classList.add("replyMessage");

  const nick = userManager.getUserNick(userId);
  replyBar.style.height = "100px";
  const replyAvatar = createEl("img", {
    className: "profile-pic",
    id: userId
  }) as HTMLImageElement;
  replyAvatar.classList.add("reply-avatar");
  replyAvatar.style.width = "15px";
  replyAvatar.style.height = "15px";

  setProfilePic(replyAvatar, userId);
  const replyNick = createEl("span", {
    textContent: nick,
    className: "reply-nick"
  });

  replyAvatar.addEventListener("click", () => {
    drawProfilePopId(userId);
  });
  replyNick.addEventListener("click", () => {
    drawProfilePopId(userId);
  });

  const textToWrite = content
    ? content
    : attachmentUrls
      ? attachmentUrls
      : translations.getTranslation("click-to-attachment");
  const replyContent = createEl("span", {
    className: "replyContent",
    textContent: textToWrite
  });

  replyContent.onclick = () => {
    const originalMsg = getId(originalId);
    if (originalMsg) {
      scrollToMessage(originalMsg);
    } else {
      const replyToId = newMessage.dataset.replyToId;
      if (!replyToId) return;

      const message = cacheInterface.getMessage(
        currentGuildId,
        guildCache.currentChannelId,
        replyToId
      );
      if (message) {
        fetchReplies([message], new Set<string>(), true);
      }
    }
  };
  replyBar.appendChild(replyAvatar);
  replyBar.appendChild(replyNick);
  replyBar.appendChild(replyContent);
}

export function scrollToMessage(messageElementToScroll: HTMLElement) {
  if (!messageElementToScroll) {
    return;
  }

  messageElementToScroll.style.backgroundColor = "rgba(102, 97, 97, 0.5)";

  setTimeout(() => {
    messageElementToScroll.style.backgroundColor = "";
  }, 1000);

  const messageRect = messageElementToScroll.getBoundingClientRect();
  const containerRect = chatContent.getBoundingClientRect();

  const offset =
    messageRect.top -
    containerRect.top +
    chatContent.scrollTop -
    chatContent.clientHeight / 2 +
    messageRect.height / 2;

  chatContent.scrollBy({
    top: offset,
    behavior: "smooth"
  });
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
    handleLink(targetElement, jsonData);
    targetElement.dataset.contentLoaded = "true";
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

    if (date) {
      const messageDate = new Date(date);
      if (!firstMessageDate || messageDate < firstMessageDate) {
        firstMessageDate = messageDate;
      }
    }
  });

  fetchReplies(history, repliesList);

  if (oldestMessageDateOnChannel) {
    if (
      !isNaN(firstMessageDate.getTime()) &&
      firstMessageDate.getTime() === oldestMessageDateOnChannel.getTime()
    ) {
      displayStartMessage(true);
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
  chatContent.innerHTML = "";

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
  date: Date,
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

  const authorAndDate = createEl("div", { className: "author-and-date" });
  const nickElement = createEl("span", {
    textContent: nick,
    className: "nick-element"
  });
  if (isBot) {
    const botSign = createEl("span", { className: "botSign" });
    authorAndDate.appendChild(botSign);
  }
  authorAndDate.appendChild(nickElement);

  const dateElement = createEl("span", { className: "date-element" });

  dateElement.textContent = getFormattedDate(date);
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
    const formattedDate = getFormattedDateForSmall(date);
    createTooltipAtCursor(formattedDate);
  });

  messageElement.appendChild(editedSpan);
}
function processMessageContent(content: string): string {
  const formattedMessage = replaceCustomEmojisForChatContainer(content);
  return formattedMessage;
}

function updateMessageContent(element: HTMLElement, content: string): void {
  const formattedMessage = processMessageContent(content);
  element.textContent = formattedMessage;
  element.dataset.content_observe = formattedMessage;
  requestAnimationFrame(() => observe(element));
  setupEmojiListeners(element);
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
    attachments,
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
  if (!attachments && content === "" && embeds.length === 0) return null;
  const nick = userManager.getUserNick(userId);

  const newMessage = createMessageElement(
    messageId,
    userId,
    date,
    content,
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
      date,
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

  messageContentElement.dataset.content_observe = isURL(content) ? "" : content;
  requestAnimationFrame(() => observe(messageContentElement));

  newMessage.appendChild(messageContentElement);
  createMediaElement(
    content,
    messageContentElement,
    newMessage,
    metadata,
    embeds,
    userId,
    new Date(date),
    attachments
  );

  if (!currentLastDate) {
    currentLastDate = new Date(date);
  }

  const isEdited = lastEdited !== null;
  if (isEdited) {
    addEditedIndicator(messageContentElement, lastEdited);
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
      const authorAndDate = element.querySelector(".author-and-date");
      if (authorAndDate && data.date) {
        const dateElement = authorAndDate.querySelector(".date-element");
        if (dateElement) {
          dateElement.textContent = getFormattedDateSelfMessage(data.date);
        }
      }
      const smallDateElement = element.querySelector(".small-date-element");
      if (smallDateElement && data.date) {
        smallDateElement.textContent = getFormattedDateForSmall(data.date);
      }
      element.style.color = "unset";
      const messageContentElement = element.querySelector(
        "#message-content-element"
      ) as HTMLElement;
      console.log(messageContentElement);
      if (messageContentElement && data.attachments) {
        console.log(
          "Create media element: ",
          data.content,
          messageContentElement,
          element,
          data.metadata,
          data.embeds,
          data.attachments
        );
        createMediaElement(
          data.content,
          messageContentElement,
          element,
          data.metadata,
          data.embeds,
          data.userId,
          data.date ? new Date(data.date) : new Date(),
          data.attachments
        );
      }
      element.id = data.messageId;
    }
    selfSentMessages.splice(foundMessageIndex, 1);
  }
}

function createMessageElement(
  messageId: string,
  userId: string,
  date: string,
  content: string,
  replyToId?: string,
  isNotSent?: boolean
) {
  const newMessage = createEl("div", { className: "message" });
  newMessage.id = messageId;
  newMessage.dataset.userId = userId;
  newMessage.dataset.date = date;
  newMessage.dataset.content = content;

  if (replyToId) {
    newMessage.dataset.replyToId = replyToId;
  }
  if (isNotSent) {
    newMessage.style.color = "gray";
  }

  const messages = chatContent.querySelectorAll(".message");
  if (messages && messages.length === 0) {
    // Start of chat
    newMessage.classList.add("start-chat-message");
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
      new Date(date),
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
  date: string,
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
  const dateObject = new Date(date);

  if (!lastSenderID || isTimeGap || replyToId) {
    createProfileImageChat(
      newMessage,
      messageContentElement,
      nick,
      userInfo,
      userId,
      dateObject,
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
        dateObject,
        isBot
      );
    } else {
      createNonProfileImage(newMessage, date);
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
  fetchMessages(channelId, isDm);
}

let timeoutId: number | null = null;

export function fetchMessages(channelId: string, isDm = false) {
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

  const attachmentType = isOnGuild
    ? EventType.GET_ATTACHMENTS_GUILD
    : EventType.GET_ATTACHMENTS_DM;

  apiClient.send(attachmentType, requestData);
}
export const currentAttachments = reactive<AttachmentWithMetaData[]>([]);

export function setCurrentAttachments(attachments: AttachmentWithMetaData[]) {
  currentAttachments.splice(0, currentAttachments.length, ...attachments);
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
  const smallDateElement = createEl("p", {
    className: "small-date-element",
    textContent: getFormattedDateForSmall(date)
  });
  newMessage.appendChild(smallDateElement);
  smallDateElement.style.position = "absolute";
  smallDateElement.style.marginLeft = "5px";

  return smallDateElement;
}

export function displayLocalMessage(
  messageId: string,
  channelId: string,
  content: string
) {
  appendtoSelfSentMessages(messageId);

  const preMessage = new Message({
    messageId,
    userId: currentUserId,
    content,
    channelId,
    date: createNowDate(),
    lastEdited: null,
    attachments: [],
    replyToId: null,
    isBot: false,
    reactionEmojisIds: [],
    metadata: {},
    embeds: [],
    willDisplayProfile: false,
    isNotSent: true,
    replyOf: undefined,
    replies: []
  });

  displayChatMessage(preMessage);
}

export function displayCannotSendMessage(channelId: string, content: string) {
  if (!isOnDm) {
    return;
  }
  const randomId = createRandomId();

  displayLocalMessage(randomId, channelId, content);
  const failedId = createRandomId();

  const failedMsg = getId(failedId);
  if (failedMsg) {
    const foundMsgContent = failedMsg.querySelector("#message-content-element");
    if (foundMsgContent) {
      foundMsgContent.classList.add("failed");
    }
  }
  const cannotSendMsg = new Message({
    messageId: createRandomId(),
    userId: CLYDE_ID,
    content: translations.getTranslation("fail-message-text"),
    channelId,
    date: createNowDate(),
    lastEdited: "",
    attachments: [],
    replyToId: "",
    isBot: true,
    reactionEmojisIds: [],
    metadata: {},
    embeds: [],
    willDisplayProfile: true,
    isNotSent: true,
    replyOf: "",
    replies: []
  });

  displayChatMessage(cannotSendMsg);

  scrollToBottom();
}

export function displayStartMessage(
  isOldestMessageDateOnChannel: boolean = false
) {
  const channelHashSvg =
    '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="42" height="42" fill="rgb(255, 255, 255)" viewBox="0 0 24 24"><path fill="var(--white)" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>';

  if (!isOnDm) {
    const isGuildBorn = cacheInterface.isRootChannel(
      currentGuildId,
      guildCache.currentChannelId
    );
    if (
      chatContent.querySelector(".startmessage") ||
      chatContent.querySelector("#guildBornTitle")
    ) {
      return;
    }
    const message = createEl("div", { className: "startmessage" });
    const titleToWrite = isGuildBorn
      ? guildCache.currentGuildName
      : translations.getWelcomeChannel(currentChannelName);
    const msgtitle = createEl("h1", {
      id: isGuildBorn ? "guildBornTitle" : "msgTitle",
      textContent: titleToWrite
    });
    const startChannelText = translations.getBirthChannel(currentChannelName);
    const startGuildText = translations.getTranslation("start-of-guild");
    const textToWrite = isGuildBorn ? startGuildText : startChannelText;
    const channelicon = createEl("div", { className: "channelIcon" });

    channelicon.innerHTML = channelHashSvg;
    const msgdescription = createEl("div", {
      id: isGuildBorn ? "guildBornDescription" : "msgDescription",
      textContent: textToWrite
    });

    if (!isGuildBorn) {
      message.appendChild(channelicon);
      message.appendChild(msgtitle);
      msgtitle.appendChild(msgdescription);
    } else {
      const guildBornParent = createEl("div", { id: "guildBornTitle-wrapper" });
      guildBornParent.appendChild(msgtitle);
      const guildBornFinishText = createEl("p", {
        id: "guildBornTitle",
        textContent: translations.getTranslation("guild-born-title")
      });
      guildBornParent.appendChild(guildBornFinishText);
      guildBornParent.appendChild(msgdescription);
      message.appendChild(guildBornParent);
    }
    chatContent.insertBefore(message, chatContent.firstChild);
    setIsLastMessageStart(true);
    if (!isOldestMessageDateOnChannel) scrollToBottom();
  } else {
    if (chatContent.querySelector(".startmessage")) {
      return;
    }
    const message = createEl("div", { className: "startmessage" });
    const titleToWrite = userManager.getUserNick(friendsCache.currentDmId);
    const msgtitle = createEl("h1", {
      id: "msgTitle",
      textContent: titleToWrite
    });
    const startChannelText = translations.getDmStartText(
      userManager.getUserNick(friendsCache.currentDmId)
    );
    const profileImg = createEl("img", {
      className: "channelIcon"
    }) as HTMLImageElement;
    setProfilePic(profileImg, friendsCache.currentDmId);
    const msgdescription = createEl("div", {
      id: "msgDescription",
      textContent: startChannelText
    });

    message.appendChild(profileImg);
    message.appendChild(msgtitle);
    msgtitle.appendChild(msgdescription);

    chatContent.insertBefore(message, chatContent.firstChild);
    setIsLastMessageStart(true);
  }
}
