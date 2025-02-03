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
  setIsLastMessageStart
} from "./chat.ts";
import { sendMessage } from "./message.ts";
import { isDomLoaded, readCurrentMessages } from "./app.ts";
import { toggleManager } from "./settings.ts";
import { popKeyboardConfetti } from "./extras.ts";
import {
  getId,
  createEl,
  enableElement,
  createRandomId,
  createNowDate
} from "./utils.ts";
import { displayImagePreview } from "./ui.ts";
import { isOnDm } from "./router.ts";
import { maxAttachmentSize, setProfilePic } from "./avatar.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { translations } from "./translations.ts";
import { currentUserId, getUserNick, getUserIdFromNick } from "./user.ts";

export let currentReplyingTo = "";

export const chatInput = getId("user-input") as HTMLInputElement;
export const chatContainer = getId("chat-container");
export const chatContent = getId("chat-content");
export const replyInfo = getId("reply-info");

export const fileInput = getId("fileInput") as HTMLInputElement;
export const fileImagePreview = getId("image-preview");
export const newMessagesBar = getId("newMessagesBar");

const newMessagesText = getId("newMessagesText");
const replyCloseButton = getId("reply-close-button");

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
        const selectedUserId = selectedUserElement.dataset.userid;
        const selectedUserNick = selectedUserElement.textContent;
        selectMember(selectedUserId, selectedUserNick);
      }
    } else if (event.key === "Escape") {
      userMentionDropdown.style.display = "none";
    }
  });
}
export function showReplyMenu(replyToMsgId, replyToUserId) {
  replyCloseButton.style.display = "flex";
  replyInfo.textContent = translations.getReplyingTo(
    getUserNick(replyToUserId)
  );
  replyInfo.style.display = "flex";
  currentReplyingTo = replyToMsgId;
  chatInput.classList.add("reply-opened");
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

  const elementHeight = parseInt(chatInput.style.height, 10);
  const topPosition = elementHeight;
  if (replyInfo) replyInfo.style.bottom = `${topPosition}px`;
}
export function extractUserIds(message) {
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

let typingTimeout;
let typingStarted = false;
const TYPING_COOLDOWN = 2000;
export async function handleUserKeydown(event) {
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
    const startPos = chatInput.selectionStart;
    const endPos = chatInput.selectionEnd;
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
    adjustHeight();
  }

  if (isDomLoaded && toggleManager.states["party-toggle"]) {
    popKeyboardConfetti();
  }
}

// upload media

const maxFiles = 8;
let fileList = [];
export function handleFileInput(eventOrFiles = null) {
  let filesToProcess: File[];

  if (eventOrFiles instanceof Event) {
    const inputElement = eventOrFiles.target as HTMLInputElement;
    if (inputElement && inputElement.files) {
      filesToProcess = Array.from(inputElement.files);
    } else {
      filesToProcess = [];
    }
  } else if (
    eventOrFiles instanceof FileList ||
    eventOrFiles instanceof Array
  ) {
    filesToProcess = Array.from(eventOrFiles);
  } else {
    filesToProcess = [eventOrFiles];
  }

  filesToProcess = filesToProcess.filter(
    (file) =>
      file instanceof Blob && file.size <= maxAttachmentSize * 1024 * 1024
  );

  if (fileList.length + filesToProcess.length > maxFiles) {
    filesToProcess = filesToProcess.slice(0, maxFiles - fileList.length);
  }

  filesToProcess.forEach((file) => {
    fileList.push(file);
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = createEl("img", {
        style: "max-width: 256px; max-height: 256px; margin-right: 10px;",
        src: e.target.result
      });
      fileImagePreview.appendChild(img);
      enableElement("image-preview");
      img.addEventListener("click", function () {
        displayImagePreview(img.src);
      });
    };
    reader.readAsDataURL(file);
  });
  if (fileList.length > maxFiles) {
    fileList = fileList.slice(0, maxFiles);
  }
  updateFileImageBorder();
}
export function setDropHandler() {
  const dropZone = getId("drop-zone");
  const fileButton = getId("file-button");

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

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, handleDragEnterOrOver, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, handleDragLeaveOrDrop, false);
  });

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

export function updateFileImageBorder() {
  if (fileImagePreview.children.length === 0) {
    fileImagePreview.style.border = "none";
  } else {
    fileImagePreview.style.border = "20px solid #2b2d31";
  }
}
export function displayLocalMessage(channelId, content) {
  const failedId = createRandomId();

  const preMessage = {
    messageId: failedId,
    userId: currentUserId,
    content,
    channelId,
    date: createNowDate(),
    addToTop: false
  };

  displayChatMessage(preMessage);
}
export function displayCannotSendMessage(channelId, content) {
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
  const cannotSendMsg = {
    messageId: createRandomId(),
    userId: CLYDE_ID,
    content: translations.getTranslation("fail-message-text"),
    channelId,
    date: createNowDate(),
    lastEdited: "",
    attachmentUrls: "",
    addToTop: false,
    replyToId: "",
    reactionEmojisIds: "",
    replyOf: "",
    isBot: true,
    willDisplayProfile: true
  };

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
    const profileImg = createEl("img", { className: "channelIcon" });
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
