import {
  currentSearchUiIndex,
  setCurrentSearchUiIndex,
  highlightOption,
  selectMember,
  updateUserMentionDropdown,
  userMentionDropdown
} from "./search.ts";
import { apiClient, EventType } from "./api.ts";
import { currentChannelName } from "./channels.ts";
import { friendsCache } from "./friends.ts";
import {
  scrollToBottom,
  displayChatMessage,
  CLYDE_ID,
  setIsLastMessageStart,
  updateChatWidth
} from "./chat.ts";
import { Message, sendMessage } from "./message.ts";
import { isDomLoaded, readCurrentMessages } from "./app.ts";
import { toggleManager } from "./settings.ts";
import { popKeyboardConfetti } from "./extras.ts";
import {
  getId,
  createEl,
  createRandomId,
  createNowDate,
  disableElement,
  enableElement
} from "./utils.ts";
import { alertUser, displayImagePreview } from "./ui.ts";
import { isOnDm } from "./router.ts";
import { maxAttachmentSize, setProfilePic } from "./avatar.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { translations } from "./translations.ts";
import { currentUserId, getUserNick, getUserIdFromNick } from "./user.ts";

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

const channelHTML =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="42" height="42" fill="rgb(255, 255, 255)" viewBox="0 0 24 24"><path fill="var(--white)" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>';

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
    getUserNick(replyToUserId)
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
  const MIN_CHAT_HEIGHT = 60;
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

  if (chatInputHeight === MIN_CHAT_HEIGHT) {
    chatInput.style.paddingTop = "-5px";
    chatInput.style.height = "45px";
  }
  adjustReplyPosition();
}
export function extractUserIds(message: string) {
  const userIds = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(message)) !== null) {
    const userId = getUserIdFromNick(match[1]);
    if (userId) {
      userIds.push(userId);
    }
  }
  return userIds;
}

let typingTimeout: number;
let typingStarted = false;
const TYPING_COOLDOWN = 2000;
export async function handleUserKeydown(event: KeyboardEvent) {
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

  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    const startPos = chatInput.selectionStart as number;
    const endPos = chatInput.selectionEnd as number;
    chatInput.value =
      chatInput.value.substring(0, startPos) +
      "\n" +
      chatInput.value.substring(endPos);
    chatInput.selectionStart = chatInput.selectionEnd = startPos + 1;
    const difference =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    console.log(difference);
    const SMALL_DIFF = 10;
    if (difference < SMALL_DIFF) {
      scrollToBottom();
    }
    chatInput.dispatchEvent(new Event("input"));
  } else if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const message = chatInput.value;
    const userIdsInMessage = extractUserIds(message);
    await sendMessage(message, userIdsInMessage);
    isAttachmentsAdded = false;
    adjustHeight();
  }

  if (isDomLoaded && toggleManager.states["party-toggle"]) {
    popKeyboardConfetti();
  }
}

// upload media

let isAttachmentsAdded: boolean;
const maxFiles = 8;
let fileList: File[] = [];

export function handleFileInput(
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

export function displayLocalMessage(channelId: string, content: string) {
  const failedId = createRandomId();

  const preMessage = new Message({
    messageId: failedId,
    userId: currentUserId,
    content,
    channelId,
    date: createNowDate(),
    lastEdited: null,
    attachmentUrls: [],
    replyToId: null,
    isBot: false,
    reactionEmojisIds: [],
    metadata: {},
    embeds: [],
    willDisplayProfile: false,
    replyOf: undefined,
    replies: []
  });

  displayChatMessage(preMessage);
}

export function displayCannotSendMessage(channelId: string, content: string) {
  if (!isOnDm) {
    return;
  }

  displayLocalMessage(channelId, content);
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
    attachmentUrls: "",
    replyToId: "",
    isBot: true,
    reactionEmojisIds: [],
    metadata: {},
    embeds: [],
    willDisplayProfile: true,
    replyOf: "",
    replies: []
  });

  displayChatMessage(cannotSendMsg);

  scrollToBottom();
}

export function displayStartMessage() {
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

    channelicon.innerHTML = channelHTML;
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
    scrollToBottom();
  } else {
    if (chatContent.querySelector(".startmessage")) {
      return;
    }
    const message = createEl("div", { className: "startmessage" });
    const titleToWrite = getUserNick(friendsCache.currentDmId);
    const msgtitle = createEl("h1", {
      id: "msgTitle",
      textContent: titleToWrite
    });
    const startChannelText = translations.getDmStartText(
      getUserNick(friendsCache.currentDmId)
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
