// chatDisplay.ts — Central orchestrator: composes messageRenderer, replyManager, chatScroll

import { reactive } from "vue";
import { appState } from "./appState.ts";

import {
  chatContent,
  chatContainer,
  newMessagesBar,
  replyInfo,
  attachmentsTray,
  messageLimitText,
  chatInput
} from "./chatbar.ts";
import {
  cacheInterface,
  setMessagesCache,
  clearMessagesCache,
  currentMessagesCache,
  guildCache
} from "./cache.ts";
import {
  isURL,
  getId,
  createEl,
  createRandomId,
  createNowDate,
  enableElement,
  disableElement,
  isMobile,
  isContentValid
} from "./utils.ts";
import { setLastTopSenderId, userManager } from "./user.ts";
import { createMediaElement } from "./mediaElements.ts";
import { apiClient, EventType } from "./api.ts";
import { isOnDm, isOnGuild } from "./router.ts";
import { togglePin } from "./contextMenuActions.ts";
import { currentGuildId } from "./guild.ts";
import { isChangingPage } from "./app.ts";
import { toggleHamburger, setActiveIcon, alertUser } from "./ui.ts";
import { translations } from "./translations.ts";
import { friendsCache } from "./friends.ts";
import { AudioType, playAudioType } from "./audio.ts";
import { isUsersOpenGlobal, userList } from "./userList.ts";
import { emojiBtn, gifBtn } from "./mediaPanel.ts";
import { readStatusManager } from "./readStatus.ts";
import { handleStopTyping } from "./typing.ts";
import {
  AttachmentWithMetaData,
  Message,
  NewMessageResponse,
  EditMessageResponse,
  NewMessageResponseSelf
} from "./types/interfaces.ts";
import store from "../store.ts";
import { changeChannel, currentChannelName } from "./channels.ts";

import {
  CLYDE_ID,
  SYSTEM_ID,
  createProfileImageChat,
  createNonProfileImage,
  createMessageElement,
  createMessageContentElement,
  createOptions3Button,
  createDateBar,
  handleClydeMessage,
  editChatMessageInDOM,
  updateMessageTimestamps,
  syncContextList,
  createMsgOptionButton
} from "./messageRenderer.ts";

import {
  observe,
  scrollToBottom,
  scrollToMessage,
  isScrolledToBottom,
  setHasJustFetchedMessagesFalse,
  setupScrollHandling,
  setReachedChannelEnd
} from "./chatScroll.ts";
import { handleReplyMessage, fetchReplies } from "./chat.ts";
import {
  createMentionProfilePop,
  constructUserData,
  drawProfilePopId
} from "./profilePop.ts";
import { setProfilePic } from "./avatar.ts";
import { SVG } from "./svgIcons.ts";

export const messageDates: { [key: string]: Date } = {};
export let currentLastDate: Date;
export function clearLastDate() {
  currentLastDate = new Date();
}

export {
  CLYDE_ID,
  SYSTEM_ID,
  scrollToMessage,
  scrollToBottom,
  setReachedChannelEnd
};

// ─── Channel navigation ───

export function changeChannelWithId(channelId: string): void {
  const channelName = cacheInterface.getChannelNameWithoutGuild(channelId);
  const isTextChannel =
    cacheInterface.getChannelWithoutGuild(channelId)?.isTextChannel;
  store.dispatch("selectChannel", { channelId, isTextChannel });
  changeChannel({
    guildId: currentGuildId,
    channelId,
    channelName,
    isTextChannel
  });
}

// ─── Mention pop-ups ───

const mentionClasses = new Set([
  "mention",
  "profile-pic",
  "pinner-name-link",
  "user-img",
  "voice-user-item",
  "profile-container"
]);

let currentMentionPop: HTMLElement | null = null;

function isMentionTarget(target: HTMLElement): boolean {
  return Array.from(target.classList).some((c) => mentionClasses.has(c));
}

export async function handleMentionClick(
  event: MouseEvent,
  userId?: string,
  topOffset?: number
): Promise<void> {
  const target = event.target as HTMLElement;
  if (!isMentionTarget(target)) return;

  const channelId = target.dataset.channelId;
  if (channelId) {
    changeChannelWithId(channelId);
    return;
  }
  if (target.id === "dm-profile-sign") {
    await drawProfilePopId(friendsCache.currentDmId);
    return;
  }

  const _userId = userId || target.dataset.userId || target.id;
  if (!_userId) return;

  currentMentionPop?.remove();
  currentMentionPop = null;

  const pop = await createMentionProfilePop(target, _userId, topOffset);
  if (pop) currentMentionPop = pop;
}

export function addChatMentionListeners(): void {
  document.body.addEventListener("click", (e) => handleMentionClick(e, "", 0));
  document.body.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target || (currentMentionPop && currentMentionPop.contains(target)))
      return;
    if (isMentionTarget(target)) return;
    currentMentionPop?.remove();
    currentMentionPop = null;
  });
}

// ─── Media panel ───

export function closeMediaPanel(): void {
  const media = getId("media-table-wrapper");
  if (media) media.classList.add("media-table-wrapper-on-right");
  enableElement(chatContent, false, true);
  setTimeout(scrollToBottom, 0);
  if (media) disableElement(media);
}

export function openMediaPanel(type: string): void {
  const wrapper = getId("media-table-wrapper");
  chatContainer.scrollTop = 0;
  if (!chatContainer) return;

  if (type === "media") {
    wrapper?.classList.remove("media-table-wrapper-on-right");
    disableElement(chatContent);
    if (wrapper) chatContainer.appendChild(wrapper);
  }

  if (type === "pins") {
    apiClient.send(EventType.GET_PINNED_MESSAGES, {
      guildId: currentGuildId,
      channelId: guildCache.currentChannelId
    });
    appendPanelWrapper();
  }

  if (type === "links") {
    apiClient.send(EventType.GET_GUILD_MESSAGE_LINKS, {
      guildId: currentGuildId,
      channelId: guildCache.currentChannelId
    });
    appendPanelWrapper();
  }

  if (type === "files") {
    setTimeout(() => {
      disableElement(chatContent);
    }, 0);
  }

  if (isMobile) toggleHamburger(true, false);
}

function appendPanelWrapper(): void {
  setTimeout(() => {
    disableElement(chatContent);
    const panelWrapper = document.querySelector(".panel-wrapper");
    if (panelWrapper) chatContainer.appendChild(panelWrapper);
  }, 0);
}

// ─── Core message display ───

export function displayChatMessage(
  data: Message,
  container?: HTMLElement
): HTMLElement | null {
  if (!data || !isValidMessage(data)) return null;

  container = container ?? chatContent;

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
    addToTop,
    metadata,
    metaData,
    embeds,
    willDisplayProfile,
    isNotSent,
    replyOf,
    isSystemMessage
  } = data;

  if (container === chatContent && currentMessagesCache[messageId]) return null;
  if (!channelId || !date) return null;
  if (!attachments && content === "" && (embeds?.length ?? 0) === 0)
    return null;

  const nick = userManager.getUserNick(userId);
  const newMessage = createMessageElement(
    messageId,
    userId,
    date,
    content,
    replyToId ?? undefined,
    isNotSent,
    chatContent
  );
  const messageContentElement = createMessageContentElement();

  setMessagesCache(messageId, newMessage);
  const userInfo = constructUserData(userId);

  const isCreatedProfile = addToTop
    ? handleAddToTop(
        newMessage,
        messageContentElement,
        nick,
        userId,
        userInfo,
        date,
        isBot,
        willDisplayProfile
      )
    : handleRegularMessage(
        container,
        newMessage,
        messageContentElement,
        nick,
        userId,
        userInfo,
        date,
        isBot,
        replyToId ?? undefined
      );

  if (isContentValid(content)) {
    messageContentElement.dataset.content_observe = isURL(content)
      ? ""
      : content;
  }
  messageContentElement.dataset.last_edited = lastEdited ?? "";

  requestAnimationFrame(() => observe(messageContentElement));
  newMessage.appendChild(messageContentElement);

  createMediaElement(
    content,
    messageContentElement,
    newMessage,
    metaData,
    metadata,
    embeds,
    userId,
    new Date(date),
    isSystemMessage,
    attachments,
    lastEdited
  );

  if (!currentLastDate) currentLastDate = new Date(date);

  updateSenderAndButtons(newMessage, userId, addToTop, isSystemMessage);
  appendMessageToChat(newMessage, container, addToTop, isCreatedProfile);

  if (userId === CLYDE_ID)
    handleClydeMessage(newMessage, messageContentElement);

  return handleReplyMessage(
    data,
    messageId,
    newMessage,
    replyOf,
    replyToId ?? undefined
  );
}

// ─── Incoming message handlers ───

export function handleNewMessage(data: NewMessageResponse): void {
  try {
    if (data.isOldMessages) {
      handleOldMessagesResponse(data);
      return;
    }

    const message = data.messages[0];
    if (data.guildId)
      cacheInterface.addMessage(data.guildId, data.channelId, message);

    const { isDm, channelId, guildId } = data;
    const userId = message.userId;
    const idToCompare = isDm
      ? friendsCache.currentDmId
      : guildCache.currentChannelId;
    const isCurrentGuild = guildId === currentGuildId;
    const isCurrentChannel = idToCompare === channelId;
    const isActivelyViewing =
      isCurrentGuild &&
      isCurrentChannel &&
      document.visibilityState === "visible" &&
      document.hasFocus();

    if (isCurrentGuild && isCurrentChannel) {
      displayChatMessage(message);
      fetchReplies(data.messages, new Set<string>());
    }

    if (userId !== appState.currentUserId && !isActivelyViewing) {
      playAudioType(AudioType.notify);
      setActiveIcon();
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

export function handleEditMessage(data: EditMessageResponse): void {
  try {
    const { isDm, channelId } = data;
    const idToCompare = isDm
      ? friendsCache.currentDmId
      : guildCache.currentChannelId;

    if (data.guildId !== currentGuildId || idToCompare !== channelId) return;

    editChatMessageInDOM(data.messageId, data.content, data.lastEdited);
  } catch (error) {
    console.error("Error processing edit:", error);
  }
}

// ─── Self-sent message finalisation ───

type SentMessage = { id: string };
const selfSentMessages: SentMessage[] = [];
export function handleSelfSentMessage(data: NewMessageResponseSelf): void {
  const { message } = data;
  const foundIndex = selfSentMessages.findIndex(
    (m) => m.id === message.temporaryId
  );

  if (message.channelId)
    cacheInterface.addMessage(data.guildId, message.channelId, message);

  if (
    message.channelId === guildCache.currentChannelId &&
    appState.currentUserId
  ) {
    handleStopTyping({
      userId: appState.currentUserId,
      guildId: currentGuildId,
      channelId: message.channelId
    });
  }

  if (foundIndex === -1) return;

  const element = chatContainer.querySelector(
    `#${CSS.escape(selfSentMessages[foundIndex].id)}`
  ) as HTMLElement;
  if (!element) {
    selfSentMessages.splice(foundIndex, 1);
    return;
  }

  updateMessageTimestamps(element, message);
  element.style.color = "unset";

  handleAttachmentsForSelf(element, message);

  element.id = message.messageId;
  element.dataset.m_id = message.messageId;
  const btn = element.querySelector(
    ".message-button-container .message-button"
  ) as HTMLElement;
  if (btn) btn.dataset.m_id = message.messageId;

  syncContextList(message);
  selfSentMessages.splice(foundIndex, 1);

  if (message.channelId && message.date) {
    readStatusManager.onNewMessage(
      data.guildId,
      message.channelId,
      true,
      message.date
    );
  }
}

function handleAttachmentsForSelf(
  element: HTMLElement,
  message: Message
): void {
  const contentEl = element.querySelector(
    "#message-content-element"
  ) as HTMLElement;
  if (!contentEl || !message.attachments?.length) return;

  if (message.attachments.every((a) => !a.isProxyFile)) {
    createMediaElement(
      message.content,
      contentEl,
      element,
      message.metaData,
      message.metadata,
      message.embeds,
      message.userId,
      message.date ? new Date(message.date) : new Date(),
      message.isSystemMessage,
      message.attachments,
      message.lastEdited
    );
  }
}

// ─── History / old messages ───

export function handleHistoryResponse(
  data: NewMessageResponse,
  _container?: HTMLElement
): void {
  if (isChangingPage) return;

  const { messages, guildId, channelId, oldestMessageDate } = data;
  _container = _container ?? chatContent;
  const isChatContainer = _container === chatContent;

  if (isChatContainer) {
    clearMessagesCache();
    chatContent.innerHTML = "";
    if (!Array.isArray(messages) || messages.length === 0) {
      displayStartMessage();
      return;
    }
    if (guildId) cacheInterface.setMessages(guildId, channelId, messages);
  }

  processMessages(_container, messages, oldestMessageDate);
}

export function handleOldMessagesResponse(data: NewMessageResponse): void {
  const { messages: history, oldestMessageDate } = data;
  if (!Array.isArray(history) || history.length === 0) return;

  const repliesList = new Set<string>();
  const oldestOnChannel = oldestMessageDate
    ? new Date(oldestMessageDate)
    : null;
  let firstMessageDate = new Date();

  clearDateBarAndStartMessageFromChat();

  history.forEach((msgData) => {
    msgData.addToTop = true;
    msgData.willDisplayProfile = true;
    const foundReply = displayChatMessage(msgData);
    if (foundReply) repliesList.add(msgData.messageId);

    if (msgData.date) {
      const d = new Date(msgData.date);
      if (d < firstMessageDate) firstMessageDate = d;
    }
  });

  fetchReplies(history, repliesList);

  if (
    oldestOnChannel &&
    !isNaN(firstMessageDate.getTime()) &&
    firstMessageDate.getTime() === oldestOnChannel.getTime()
  ) {
    displayStartMessage(true);
  }
}

function processMessages(
  container: HTMLElement,
  messages: any[],
  oldestMessageDate?: string | null
): void {
  const firstMessageDateOnChannel = oldestMessageDate
    ? new Date(oldestMessageDate)
    : null;
  const repliesList = new Set<string>();
  const wasAtBottom = isScrolledToBottom();

  messages
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((msgData) => {
      const msg = new Message(msgData);
      const foundReply = displayChatMessage(msg, container);
      if (foundReply) repliesList.add(msg.messageId);
    });

  fetchReplies(messages, new Set<string>());
  if (wasAtBottom) scrollToBottom();
  setupScrollHandling(wasAtBottom);

  if (
    messages[0]?.date &&
    firstMessageDateOnChannel &&
    new Date(messages[0].date).getTime() === firstMessageDateOnChannel.getTime()
  ) {
    displayStartMessage();
  }
}

// ─── Local / UI-only message display ───

export function displayLocalMessage(
  messageId: string,
  channelId: string,
  content: string
): void {
  selfSentMessages.push({ id: messageId });
  if (!appState.currentUserId) return;

  const preMessage = new Message({
    messageId,
    userId: appState.currentUserId,
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
    isPinned: false,
    willDisplayProfile: false,
    isNotSent: true,
    replyOf: undefined,
    isSystemMessage: false,
    replies: []
  });

  displayChatMessage(preMessage);
}

export function displayCannotSendMessage(
  channelId: string,
  content: string
): void {
  if (!isOnDm) return;

  displayLocalMessage(createRandomId(), channelId, content);

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
    isPinned: false,
    willDisplayProfile: true,
    isNotSent: true,
    replyOf: "",
    isSystemMessage: false,
    replies: []
  });

  displayChatMessage(cannotSendMsg);
  scrollToBottom();
}

// ─── Start/welcome message ───

export function displayStartMessage(isOldestMessageDate = false): void {
  if (!isOnDm) {
    if (
      chatContent.querySelector(".startmessage") ||
      chatContent.querySelector("#guildBornTitle")
    )
      return;

    const isGuildBorn = cacheInterface.isRootChannel(
      currentGuildId,
      guildCache.currentChannelId
    );
    const message = createEl("div", { className: "startmessage" });

    if (isGuildBorn) {
      const wrapper = createEl("div", { id: "guildBornTitle-wrapper" });
      const title = createEl("h1", {
        id: "guildBornTitle",
        textContent: guildCache.currentGuildName
      });
      const subtitle = createEl("p", {
        id: "guildBornTitle",
        textContent: translations.getTranslation("guild-born-title")
      });
      const desc = createEl("div", {
        id: "guildBornDescription",
        textContent: translations.getTranslation("start-of-guild")
      });
      wrapper.append(title, subtitle, desc);
      message.appendChild(wrapper);
    } else {
      const channelIcon = createEl("div", { className: "channelIcon" });
      channelIcon.innerHTML = SVG.channelHash;
      const title = createEl("h1", {
        id: "msgTitle",
        textContent: translations.getWelcomeChannel(currentChannelName)
      });
      const desc = createEl("div", {
        id: "msgDescription",
        textContent: translations.getBirthChannel(currentChannelName)
      });
      title.appendChild(desc);
      message.append(channelIcon, title);
    }

    chatContent.insertBefore(message, chatContent.firstChild);
    if (!isOldestMessageDate) scrollToBottom();
  } else {
    if (chatContent.querySelector(".startmessage")) return;

    const dmNick = userManager.getUserNick(friendsCache.currentDmId);
    const message = createEl("div", { className: "startmessage" });
    const profileImg = createEl("img", { className: "channelIcon" });
    setProfilePic(profileImg, friendsCache.currentDmId);
    const title = createEl("h1", { id: "msgTitle", textContent: dmNick });
    const desc = createEl("div", {
      id: "msgDescription",
      textContent: translations.getDmStartText(dmNick)
    });
    title.appendChild(desc);
    message.append(profileImg, title);
    chatContent.insertBefore(message, chatContent.firstChild);
  }
}

// ─── Jump to message ───

export function goToMessage(messageId: string, ignorePinToggle = false): void {
  if (!ignorePinToggle) togglePin();

  const msg = getId(messageId) as HTMLElement;
  if (msg) {
    scrollToMessage(msg);
    return;
  }

  const message = cacheInterface.getMessage(
    currentGuildId,
    guildCache.currentChannelId,
    messageId
  );
  if (message) fetchReplies([message], new Set<string>(), true);
}

// ─── Chat history ───

export function getHistoryFromOneChannel(
  channelId: string,
  isDm = false
): void {
  chatContent.innerHTML = "";

  if (!isDm) {
    const messages = cacheInterface.getMessages(currentGuildId, channelId);
    if (messages?.length) {
      clearMessagesCache();
      const existingIds = new Set(
        Array.from(chatContent.querySelectorAll(".message")).map((el) => el.id)
      );
      const repliesList = new Set<string>();

      messages.forEach((msg) => {
        if (!existingIds.has(msg.messageId)) {
          const foundReply = displayChatMessage(msg);
          if (foundReply) repliesList.add(msg.messageId);
        }
      });

      fetchReplies(messages, repliesList);
      if (isUsersOpenGlobal) fetchAttachments(channelId, isDm);

      return;
    }
  }

  fetchMessages(channelId, isDm);
}

let fetchTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function fetchMessages(channelId: string, isDm = false): void {
  const COOLDOWN = 5000;
  const requestData: any = { channelId, isDm, guildId: "", friendId: "" };

  if (isOnGuild) requestData.guildId = currentGuildId;
  else if (isOnDm) requestData.friendId = friendsCache.currentDmId;

  if (fetchTimeoutId !== null) clearTimeout(fetchTimeoutId);
  fetchTimeoutId = setTimeout(() => {
    setHasJustFetchedMessagesFalse();
    fetchTimeoutId = null;
  }, COOLDOWN);

  apiClient.send(
    isOnGuild ? EventType.GET_HISTORY_GUILD : EventType.GET_HISTORY_DM,
    requestData
  );
  if (isUsersOpenGlobal) fetchAttachments(channelId, isDm);
}

export function fetchCurrentAttachments(): void {
  fetchAttachments(guildCache.currentChannelId);
}

// ─── Attachments ───

export const currentAttachments = reactive<AttachmentWithMetaData[]>([]);

export function appendCurrentAttachments(
  attachments: AttachmentWithMetaData[]
): void {
  if (attachments.length === 0) {
    clearCurrentAttachmentsFromList();
    return;
  }
  store.commit("setAttachments", attachments);
  updateAttachmentsCount(attachments.length);
}

export function updateAttachmentsCount(count: number): void {
  const mediaTitle = getId("media-title");
  if (!mediaTitle) return;
  const svg = mediaTitle.querySelector("svg");
  if (!svg) return;

  while (svg.nextSibling) svg.parentNode?.removeChild(svg.nextSibling);
  mediaTitle.appendChild(createEl("span", { textContent: `(${count})` }));
}

export function clearCurrentAttachments(): void {
  store.commit("setAttachments", []);
}

export function clearCurrentAttachmentsFromList(): void {
  store.commit("setAttachments", []);
  updateAttachmentsCount(0);
}

// ─── Chat width sync ───

export function updateChatWidth(): void {
  if (!userList) return;
  const isHidden = userList.style.display === "none";
  chatInput.classList.toggle("user-list-hidden", isHidden);
  replyInfo.classList.toggle("reply-user-list-open", isHidden);
  gifBtn.classList.toggle("gifbtn-user-list-open", isHidden);
  emojiBtn.classList.toggle("emojibtn-user-list-open", isHidden);
  newMessagesBar.classList.toggle("new-messages-bar-user-list-open", isHidden);
  attachmentsTray.classList.toggle("attachments-tray-user-list-open", isHidden);
  messageLimitText.classList.toggle("user-list-hidden", isHidden);
}

// ─── Utility: get topmost/bottommost message element ───

export function getMessageFromChat(top = true): HTMLElement | null {
  const messages = Array.from(chatContent.children).filter((el) =>
    el.classList.contains("message")
  ) as HTMLElement[];
  if (!messages.length) return null;

  return top
    ? messages.reduce<HTMLElement>(
        (a, b) => (b.offsetTop < a.offsetTop ? b : a),
        messages[0]
      )
    : messages[messages.length - 1];
}

// ─── Private helpers ───

function isValidMessage(data: Message): boolean {
  return !!(data?.messageId && data.channelId && data.date);
}

function handleAddToTop(
  newMessage: HTMLElement,
  messageContentElement: HTMLElement,
  nick: string,
  userId: string,
  userInfo: any,
  date: string,
  isBot: boolean,
  willDisplayProfile: boolean
): boolean {
  if (willDisplayProfile) {
    createProfileImageChat(
      newMessage,
      messageContentElement,
      nick,
      userInfo,
      userId,
      date,
      isBot
    );
    return true;
  }
  createNonProfileImage(newMessage, date);
  return false;
}

function handleRegularMessage(
  container: HTMLElement,
  newMessage: HTMLElement,
  messageContentElement: HTMLElement,
  nick: string,
  userId: string,
  userInfo: any,
  date: string,
  isBot: boolean,
  replyToId?: string
): boolean {
  const MINIMUM_TIME_GAP_SECONDS = 300;

  if (!container.dataset.lastSenderID) container.dataset.lastSenderID = "";
  if (!container.dataset.lastMessageDate)
    container.dataset.lastMessageDate = "";

  const currentDateNumber = new Date(date).setHours(0, 0, 0, 0);
  if (Number(container.dataset.lastMessageDate) !== currentDateNumber) {
    createDateBar(container, new Date(currentDateNumber).toISOString());
    container.dataset.lastMessageDate = currentDateNumber.toString();
  }

  const previousDateStr = container.dataset.bottomestChatDateStr || date;
  const diffSeconds =
    Math.abs(new Date(previousDateStr).getTime() - new Date(date).getTime()) /
    1000;
  const isTimeGap = diffSeconds > MINIMUM_TIME_GAP_SECONDS;

  const lastSenderId = container.dataset.lastSenderID;
  const isNewProfileNeeded =
    !lastSenderId || isTimeGap || !!replyToId || lastSenderId !== userId;
  const shouldRenderProfile = userId === SYSTEM_ID || isNewProfileNeeded;

  if (shouldRenderProfile) {
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

  container.dataset.bottomestChatDateStr = date;
  container.dataset.lastSenderID = userId;

  return shouldRenderProfile;
}

function updateSenderAndButtons(
  newMessage: HTMLElement,
  userId: string,
  addToTop: boolean,
  isSystemMessage: boolean
) {
  if (!addToTop) {
  } else {
    setLastTopSenderId(userId);
  }
  if (userId !== appState.currentUserId) {
    createMsgOptionButton(newMessage, true);
  }
  createOptions3Button(newMessage, newMessage.id, userId, isSystemMessage);
}
function appendMessageToChat(
  newMessage: HTMLElement,
  container: HTMLElement,
  addToTop: boolean,
  isCreatedProfile: boolean
): void {
  if (addToTop) {
    container.insertBefore(newMessage, container.firstChild);
    container.scrollTop += newMessage.clientHeight;
    return;
  }

  container.appendChild(newMessage);

  const prevSibling = newMessage.previousElementSibling;
  if (prevSibling) {
    const prevContent = prevSibling.querySelector("#message-content-element");
    if (
      isCreatedProfile &&
      prevContent?.classList.contains("onsmallprofile") &&
      newMessage.classList.contains("onsmallprofile")
    ) {
      newMessage.classList.add("profile-after-profile");
    }
  }
}

function clearDateBarAndStartMessageFromChat(): void {
  Array.from(chatContent.children).some((el) => {
    const element = el as HTMLElement;
    if (
      element.classList.contains("dateBar") ||
      element.classList.contains("startmessage")
    ) {
      element.remove();
      return false;
    }
    return element.classList.contains("message");
  });
}

function fetchAttachments(channelId: string, isDm = false): void {
  if (!channelId) return;
  store.commit("setCurrentPage", 1);

  const requestData: any = { channelId, isDm, guildId: "", friendId: "" };
  if (isOnGuild) requestData.guildId = currentGuildId;
  else if (isOnDm) requestData.friendId = friendsCache.currentDmId;

  apiClient.send(
    isOnGuild ? EventType.GET_ATTACHMENTS_GUILD : EventType.GET_ATTACHMENTS_DM,
    requestData
  );
  clearCurrentAttachments();
  store.commit("setHasMoreAttachments", true);
}
