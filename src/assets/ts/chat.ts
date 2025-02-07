import {
  getMessageDate,
  getOldMessages,
  replaceCustomEmojis,
  Message
} from "./message.ts";
import {
  chatInput,
  displayStartMessage,
  newMessagesBar,
  replyInfo,
  showReplyMenu,
  chatContainer,
  chatContent
} from "./chatbar.ts";
import {
  messages_raw_cache,
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
import { getUserNick, currentUserId, setLastTopSenderId } from "./user.ts";
import { createMediaElement } from "./mediaElements.ts";
import { apiClient, EventType } from "./api.ts";
import { isOnGuild, isOnMe } from "./router.ts";
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

export let bottomestChatDateStr;
export function setBottomestChatDateStr(date) {
  bottomestChatDateStr = date;
}
export let lastMessageDate = null;
export let currentLastDate;
export function clearLastDate() {
  currentLastDate = "";
}
export let lastSenderID = "";
export function setLastSenderID(id) {
  lastSenderID = id;
}
export const messageDates = {};

const unknownReplies = [];

export let isLastMessageStart = false;
export function setIsLastMessageStart(val) {
  isLastMessageStart = val;
}

let isReachedChannelEnd = false;
export function setReachedChannelEnd(val) {
  isReachedChannelEnd = val;
}

export const CLYDE_ID = "1";

export function createChatScrollButton() {
  const scrollButton = getId("scroll-to-bottom");

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
interface MessageReply {
  messageId: string;
  replies: { userId: string; content: string; attachmentUrls: string[] }[];
}

export function handleReplies() {
  Object.values(replyCache).forEach((message: MessageReply) => {
    const replierElements = Array.from(chatContent.children).filter(
      (element) => {
        const htmlElement = element as HTMLElement;
        return htmlElement.dataset.replyToId === message.messageId;
      }
    );

    console.log(replierElements, message.replies);
    replierElements.forEach((replier) => {
      message.replies.forEach((msg) => {
        createReplyBar(
          replier,
          message.messageId,
          msg.userId,
          msg.content,
          msg.attachmentUrls
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

export function scrollToMessage(messageElement) {
  messageElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

export let hasJustFetchedMessages: boolean = false;
export function setHasJustFetchedMessagesFalse() {
  hasJustFetchedMessages = false;
}
let isFetchingOldMessages = false;
let stopFetching = false;

export function getOldMessagesOnScroll() {
  if (isReachedChannelEnd || isOnMe || stopFetching) {
    return;
  }
  if (hasJustFetchedMessages) {
    return;
  }
  const oldestDate = getMessageDate();
  if (!oldestDate) return;
  if (oldestDate === "1970-01-01 00:00:00.000000+00:00") {
    return;
  }
  hasJustFetchedMessages = true;
  getOldMessages(oldestDate);
}

export async function handleScroll() {
  if (loadingScreen && loadingScreen.style.display === "flex") {
    return;
  }
  const SCROLL_DELAY = 500;
  const buffer = 10;
  const scrollPosition = chatContainer.scrollTop;
  const isAtTop = scrollPosition <= buffer;

  if (isAtTop && !isFetchingOldMessages && chatContent.children.length > 0) {
    isFetchingOldMessages = true;
    console.log("Fetching old messages...");
    try {
      let continueLoop = true;

      if (hasJustFetchedMessages || stopFetching) {
        return;
      }

      while (continueLoop) {
        const updatedScrollPosition = chatContainer.scrollTop;

        if (updatedScrollPosition <= buffer) {
          await getOldMessagesOnScroll(); // This will now set `hasJustFetchedMessages` to true
        } else {
          continueLoop = false;
          console.log("Scroll position exceeded threshold.");
        }

        await new Promise((resolve) => setTimeout(resolve, SCROLL_DELAY));
      }
    } catch (error) {
      console.error("Error fetching old messages:", error);
    } finally {
      isFetchingOldMessages = false;
      stopFetching = true;
      console.log("Fetching complete. Resetting flag.");
      setHasJustFetchedMessagesFalse(); // Reset the flag when fetching is done
    }
  }
}

const observer = new IntersectionObserver(
  (entries, _observer) => {
    entries.forEach((entry) => {
      const target = entry.target as HTMLElement;
      if (entry.isIntersecting && target.dataset.contentLoaded !== "true") {
        loadObservedContent(entry.target);
        target.dataset.contentLoaded = "true";
      }
    });
  },
  { threshold: 0.1 }
);

export function observe(element) {
  if (!element) return;
  observer.observe(element);
}
function loadObservedContent(targetElement) {
  const jsonData = targetElement.dataset.content_observe;

  const sanitizedHTML = sanitizeHTML(jsonData);

  const tempDiv = createEl("div");
  tempDiv.innerHTML = sanitizedHTML;

  while (tempDiv.firstChild) {
    targetElement.appendChild(tempDiv.firstChild);
  }

  observer.unobserve(targetElement);
}

export function handleOldMessagesResponse(data) {
  const { history, oldest_message_date: oldestMessageDate } = data;

  if (!Array.isArray(history) || history.length === 0) {
    isReachedChannelEnd = true;
    displayStartMessage();
    return;
  }

  const repliesList = new Set();
  const oldestMessageDateOnChannel = new Date(oldestMessageDate);

  let firstMessageDate = new Date();

  history.forEach((msgData) => {
    const msg = new Message(msgData);
    const { date, messageId } = msgData;
    const displayMessageData = msg.toDisplayData(messageId);

    if (displayChatMessage(displayMessageData)) {
      repliesList.add(messageId);
    }

    if (!firstMessageDate || new Date(date) < firstMessageDate) {
      firstMessageDate = new Date(date);
    }
  });

  fetchReplies(history, repliesList);

  if (
    !isNaN(firstMessageDate.getTime()) &&
    firstMessageDate.getTime() === oldestMessageDateOnChannel.getTime()
  ) {
    displayStartMessage();
  } else if (isNaN(oldestMessageDateOnChannel.getTime())) {
    console.error("Invalid oldest message date received.");
  }
}

export function handleMessage(data) {
  try {
    if (data.isOldMessages) {
      handleOldMessagesResponse(data);
      return;
    }

    const { isDm, userId, channelId } = data;

    const idToCompare = isDm
      ? friendsCache.currentDmId
      : guildCache.currentChannelId;

    if (data.guildId !== currentGuildId || idToCompare !== channelId) {
      console.log(`${idToCompare} is not ${channelId} so returning`);
      if (userId !== currentUserId) {
        playNotification();
        setActiveIcon();
      }
      return;
    }

    displayChatMessage(data);

    fetchReplies(data);
  } catch (error) {
    console.error("Error processing message:", error);
  }
}
export function handleHistoryResponse(data) {
  if (isChangingPage) {
    console.log("Got history response while changing page, ignoring");
    return;
  }

  isLastMessageStart = false;
  clearMessagesCache();

  const { messages, channelId, guildId, oldestMessageDate } = data;

  if (!Array.isArray(messages) || messages.length === 0) {
    displayStartMessage();
    return;
  }

  if (guildId !== currentGuildId)
    console.warn(
      data,
      guildId,
      "History guild ID is different from current guild",
      currentGuildId
    );
  if (channelId !== guildCache.currentChannelId)
    console.warn(
      data,
      channelId,
      "History channel ID is different from current channel",
      guildCache.currentChannelId
    );

  cacheInterface.setMessages(guildId, guildId, messages);

  const firstMessageDateOnChannel = new Date(oldestMessageDate);
  const repliesList = new Set();

  const wasAtBottom =
    chatContainer.scrollHeight - chatContainer.scrollTop ===
    chatContainer.clientHeight;

  chatContainer.style.overflow = "hidden"; // Disable scrolling temporarily

  messages.forEach((msgData) => {
    const msg = new Message(msgData);
    const foundReply = displayChatMessage(msg);
    if (foundReply) {
      repliesList.add(msg.messageId);
      const index = unknownReplies.indexOf(msg.messageId);
      if (index !== -1) {
        unknownReplies.splice(index, 1);
      }
    }
  });

  let isUserInteracted = false;

  const userScrollEvents = ["mousedown", "touchstart", "wheel"];
  fetchReplies(messages, repliesList);

  if (wasAtBottom) {
    scrollToBottom();
  }

  const ensureScrollAtBottom = () => {
    if (wasAtBottom && !isUserInteracted) {
      scrollToBottom();
    }
  };

  const _observer = new MutationObserver(() => {
    ensureScrollAtBottom();
  });

  _observer.observe(chatContainer, {
    childList: true,
    subtree: true
  });

  const mediaElements = chatContainer.querySelectorAll("img, video, iframe");
  const mediaLoadedPromises: Promise<void>[] = [];

  mediaElements.forEach((media) => {
    if (media instanceof HTMLImageElement && !media.complete) {
      const mediaPromise = new Promise<void>((resolve) => {
        media.addEventListener("load", (event: Event) => {
          resolve();
        });
      });
      mediaLoadedPromises.push(mediaPromise);
    } else if (media instanceof HTMLVideoElement && media.readyState < 4) {
      const mediaPromise = new Promise<void>((resolve) => {
        media.addEventListener("loadeddata", (event: Event) => {
          resolve();
        });
      });
      mediaLoadedPromises.push(mediaPromise);
    }
  });

  const checkAllMediaLoaded = () => {
    return Array.from(mediaElements).every((media) => {
      if (media instanceof HTMLImageElement) {
        return media.complete;
      } else if (media instanceof HTMLMediaElement) {
        return media.readyState === 4;
      }
      return true;
    });
  };

  Promise.all(mediaLoadedPromises).then(() => {
    chatContainer.style.overflow = "";
    _observer.disconnect();
  });
  let lastHeight = chatContainer.scrollHeight;
  const MONITOR_CHANGES_DELAY = 50;
  const PREVENT_SCROLL_JUMP_DELAY = 20;
  const HISTORY_SCROLL_DELAY = 200;
  const monitorContentSizeChanges = () => {
    const currentHeight = chatContainer.scrollHeight;

    if (currentHeight !== lastHeight) {
      if (wasAtBottom && !isUserInteracted) {
        chatContainer.scrollTop = currentHeight;
      }
    }

    lastHeight = currentHeight;

    if (checkAllMediaLoaded()) {
      chatContainer.style.overflow = "";
      observer.disconnect();
    } else {
      setTimeout(monitorContentSizeChanges, MONITOR_CHANGES_DELAY);
    }
  };

  monitorContentSizeChanges();

  if (
    messages[0]?.Date &&
    new Date(messages[0].Date).getTime() === firstMessageDateOnChannel.getTime()
  ) {
    displayStartMessage();
  }

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
    if (
      chatContainer.scrollTop <
      chatContainer.scrollHeight - chatContainer.clientHeight
    ) {
      isUserInteracted = true;
    } else {
      isUserInteracted = false;
    }
  });

  const preventScrollJump = () => {
    if (!isUserInteracted) {
      ensureScrollAtBottom();
    }
  };

  setInterval(preventScrollJump, PREVENT_SCROLL_JUMP_DELAY);
  setTimeout(() => {
    scrollToBottom();
  }, HISTORY_SCROLL_DELAY);
}

export function createDateBar(currentDate) {
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
  const profileImg = createEl("img", { className: "profile-pic", id: userId });
  setProfilePic(profileImg, userId);

  profileImg.style.width = "40px";
  profileImg.style.height = "40px";
  profileImg.dataset.userId = userId;
  appendToProfileContextList(null, userId);

  profileImg.addEventListener("mouseover", function () {
    this.style.borderRadius = "0px";
  });
  profileImg.addEventListener("mouseout", function () {
    this.style.borderRadius = "25px";
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
export function setLastMessageDate(date) {
  lastMessageDate = date;
}
export function createOptions3Button(message, messageId, userId) {
  const button = createMsgOptionButton(message, false);
  button.dataset.m_id = messageId;
  appendToMessageContextList(messageId, userId);
}
export function displayChatMessage(data): HTMLElement {
  if (!data || !isValidData(data)) return null;

  const {
    messageId,
    userId,
    content,
    channelId,
    date,
    lastEdited,
    attachmentUrls,
    replyToId,
    reactionEmojisIds,
    addToTop,
    isBot,
    replyOf,
    metadata,
    willDisplayProfile
  } = data;

  if (currentMessagesCache[messageId]) return null;
  if (!channelId || !date) return null;
  if (!attachmentUrls && content === "") return null;

  const nick = getUserNick(userId);
  const newMessage = createMessageElement(
    messageId,
    userId,
    date,
    content,
    attachmentUrls,
    replyToId
  );
  const messageContentElement = createMessageContentElement();

  setMessagesCache(messageId, newMessage);
  messages_raw_cache[messageId] = data;

  let isCreatedProfile = false;

  if (addToTop) {
    isCreatedProfile = handleAddToTop(
      newMessage,
      messageContentElement,
      nick,
      userId,
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
      date,
      isBot,
      replyToId
    );
  }

  let formattedMessage = replaceCustomEmojis(content);
  if (isURL(content)) formattedMessage = "";

  messageContentElement.dataset.content_observe = formattedMessage;
  requestAnimationFrame(() => observe(messageContentElement));

  appendMessageContent(
    newMessage,
    messageContentElement,
    content,
    attachmentUrls,
    metadata
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
    replyOf,
    replyToId,
    messageId,
    newMessage
  );
  if (foundReply) return foundReply;

  return null;
}

function isValidData(data) {
  return data && data.messageId && data.channelId && data.date;
}

function createMessageElement(
  messageId,
  userId,
  date,
  content,
  attachmentUrls,
  replyToId
) {
  const newMessage = createEl("div", { className: "message" });
  newMessage.id = messageId;
  newMessage.dataset.userId = userId;
  newMessage.dataset.date = date;
  newMessage.dataset.content = content;
  newMessage.dataset.attachmentUrls = attachmentUrls;
  newMessage.dataset.replyToId = replyToId;
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
  newMessage,
  messageContentElement,
  nick,
  userId,
  date,
  isBot,
  willDisplayProfile
) {
  let isCreatedProfile = false;
  if (willDisplayProfile) {
    isCreatedProfile = true;
    createProfileImageChat(
      newMessage,
      messageContentElement,
      nick,
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
  newMessage,
  messageContentElement,
  nick,
  userId,
  date,
  isBot,
  replyToId
) {
  const MILLISECONDS_IN_A_SECOND = 1000;
  const MINIMUM_TIME_GAP_IN_SECONDS = 300;

  const currentDate = new Date(date).setHours(0, 0, 0, 0);
  if (lastMessageDate === null || lastMessageDate !== currentDate) {
    createDateBar(currentDate);
    lastMessageDate = currentDate;
  }

  const difference =
    Math.abs(
      new Date(bottomestChatDateStr).getTime() - new Date(date).getTime()
    ) / MILLISECONDS_IN_A_SECOND;
  const isTimeGap = difference > MINIMUM_TIME_GAP_IN_SECONDS;

  if (!lastSenderID || isTimeGap || replyToId) {
    createProfileImageChat(
      newMessage,
      messageContentElement,
      nick,
      userId,
      date,
      isBot
    );
  } else {
    if (lastSenderID !== userId || isTimeGap) {
      createProfileImageChat(
        newMessage,
        messageContentElement,
        nick,
        userId,
        date,
        isBot
      );
    } else {
      createNonProfileImage(newMessage, date);
    }
  }
  bottomestChatDateStr = date;
  return true;
}

function appendMessageContent(
  newMessage,
  messageContentElement,
  content,
  attachmentUrls,
  metadata
) {
  newMessage.appendChild(messageContentElement);
  createMediaElement(
    content,
    messageContentElement,
    newMessage,
    attachmentUrls,
    metadata
  );
}

function updateSenderAndButtons(newMessage, userId, addToTop) {
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

function appendMessageToChat(newMessage, addToTop, isCreatedProfile) {
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
        previousMsgContent.classList.contains("onsmallprofile")
      ) {
        newMessage.classList.add("profile-after-profile");
      }
    }
  }
}

function handleReplyMessage(data, replyOf, replyToId, messageId, newMessage) {
  if (replyOf === messageId) {
    setTimeout(() => {
      scrollToMessage(newMessage);
    }, 0);
  }
  if (replyToId) {
    const foundReply = getId(replyToId);
    if (foundReply) {
      createReplyBar(
        newMessage,
        foundReply.dataset.messageId,
        foundReply.dataset.userId,
        foundReply.dataset.content,
        foundReply.dataset.attachmentUrls
      );
      return foundReply;
    } else {
      unknownReplies.push(data);
    }
  }
  return null;
}

function handleClyde(newMessage, messageContentElement) {
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
export function fetchReplies(messages, repliesList = null, goToOld = false) {
  if (!repliesList) {
    repliesList = new Set();
  }
  if (goToOld) {
    const messageId = messages;
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
  if (userList.style.display === "none") {
    chatInput.classList.add("user-list-hidden");
    replyInfo.classList.add("reply-user-list-open");
    gifBtn.classList.add("gifbtn-user-list-open");
    emojiBtn.classList.add("emojibtn-user-list-open");
    newMessagesBar.classList.add("new-messages-bar-user-list-open");
  } else {
    chatInput.classList.remove("user-list-hidden");
    replyInfo.classList.remove("reply-user-list-open");
    gifBtn.classList.remove("gifbtn-user-list-open");
    emojiBtn.classList.remove("emojibtn-user-list-open");
    newMessagesBar.classList.remove("new-messages-bar-user-list-open");
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

export function getHistoryFromOneChannel(channelId, isDm = false) {
  console.log("Retrieving history...");
  const messages = cacheInterface.getMessages(currentGuildId, channelId);

  if (!isDm && messages && Array.isArray(messages)) {
    const repliesList = new Set();

    if (messages.length > 0) {
      clearMessagesCache();
      for (const msg of messages) {
        const foundReply = displayChatMessage(msg);
        if (foundReply) {
          repliesList.add(msg.messageId);
        }
      }
      fetchReplies(messages, repliesList);
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
    isDm
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

export function createMsgOptionButton(message, isReply) {
  const textc = isReply ? "↪" : "⋯";

  const newButton = createEl("button", { className: "message-button" });

  const textEl = createEl("div", {
    textContent: textc,
    className: "message-button-text"
  });
  newButton.appendChild(textEl);
  if (isReply) {
    newButton.onclick = function () {
      showReplyMenu(message.id, message.dataset.userId);
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

export function createNonProfileImage(newMessage, date) {
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
