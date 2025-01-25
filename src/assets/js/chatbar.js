import {
  currentSearchUiIndex,
  setCurrentSearchUiIndex,
  highlightOption,
  selectMember,
  updateUserMentionDropdown,
} from './search';
import { apiClient, EventType } from './api';
import { currentChannelName } from './channels';
import { friendCache } from './friends';
import {
  scrollToBottom,
  displayChatMessage,
  CLYDE_ID,
  setIsLastMessageStart,
} from './chat';
import { sendMessage } from './message';
import { isDomLoaded } from './app';
import { toggleManager } from './settings';
import { popKeyboardConfetti } from './extras';
import {
  getId,
  createEl,
  enableElement,
  createRandomId,
  createNowDate
} from './utils';
import { displayImagePreview } from './ui';
import { isOnDm } from './router';
import { setProfilePic } from './avatar';
import { cacheInterface, guildCache } from './cache';
import { currentGuildId } from './guild';
import { translations } from './translations';
import { currentUserId, getUserNick ,getUserIdFromNick} from './user';



export let fileInput;
export let currentReplyingTo = '';
export let chatInput = getId('user-input');

export let fileImagePreview;
export let chatContainer = getId('chat-container');
export let chatContent = getId('chat-content');
let replyInfo;
import { userMentionDropdown } from './search';


export function initialiseChatInput() {
  chatInput.addEventListener('input', adjustHeight);
  chatInput.addEventListener('keydown', handleUserKeydown);

  chatInput.addEventListener('input', (event) => {
    updateUserMentionDropdown(event.target.value);
  });

  chatInput.addEventListener('keydown', (event) => {
    const options = userMentionDropdown.querySelectorAll('.mention-option');
    if (event.key === 'ArrowDown') {
      setCurrentSearchUiIndex((currentSearchUiIndex + 1) % options.length);
      highlightOption(currentSearchUiIndex);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      setCurrentSearchUiIndex(
        (currentSearchUiIndex - 1 + options.length) % options.length,
      );
      highlightOption(currentSearchUiIndex);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (currentSearchUiIndex >= 0 && currentSearchUiIndex < options.length) {
        const selectedUserId = options[currentSearchUiIndex].dataset.userid;
        const selectedUserNick = options[currentSearchUiIndex].textContent;
        selectMember(selectedUserId, selectedUserNick);
      }
    } else if (event.key === 'Escape') {
      userMentionDropdown.style.display = 'none';
    }
  });
}
let replyCloseButton;
export function showReplyMenu(replyToMsgId, replyToUserId) {
  replyCloseButton.style.display = 'flex';
  replyInfo.textContent = translations.getReplyingTo(
    getUserNick(replyToUserId),
  );
  replyInfo.style.display = 'flex';
  currentReplyingTo = replyToMsgId;
  chatInput.classList.add('reply-opened');
}

export function closeReplyMenu() {
  if (replyCloseButton) replyCloseButton.style.display = 'none';
  if (replyInfo) replyInfo.style.display = 'none';
  currentReplyingTo = '';
  chatInput.classList.remove('reply-opened');
}

export function adjustHeight() {
  chatInput.style.height = 'auto';
  chatInput.style.height = chatInput.scrollHeight + 'px';

  let chatInputHeight = chatInput.scrollHeight;
  chatInput.scrollTop = chatInput.scrollHeight - chatInput.clientHeight;
  if (chatInputHeight > 500) {
    return;
  }
  chatContainer.style.height = `calc(87vh - ${chatInputHeight - 60}px)`;

  if (chatInputHeight === 60) {
    chatInput.style.paddingTop = '-5px';
    chatInput.style.height = '45px';
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

export async function handleUserKeydown(event) {
  if (chatInput.value !== '') {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    if (!typingStarted) {
      typingStarted = true;
      apiClient.send(EventType.START_TYPING, {
        channelId: isOnDm
          ? friendCache.currentDmId
          : guildCache.currentChannelId,
        guildId: currentGuildId,
        isDm: isOnDm,
      });
    }

    typingTimeout = setTimeout(() => {
      typingStarted = false;
      apiClient.send(EventType.STOP_TYPING, {
        channelId: isOnDm
          ? friendCache.currentDmId
          : guildCache.currentChannelId,
        guildId: currentGuildId,
        isDm: isOnDm,
      });
    }, 2000);
  }

  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    let startPos = chatInput.selectionStart;
    let endPos = chatInput.selectionEnd;
    chatInput.value =
      chatInput.value.substring(0, startPos) +
      '\n' +
      chatInput.value.substring(endPos);
    chatInput.selectionStart = chatInput.selectionEnd = startPos + 1;
    const difference =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    console.log(difference);
    if (difference < 10) {
      scrollToBottom();
    }
    chatInput.dispatchEvent(new Event('input'));
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const message = chatInput.value;
    const userIdsInMessage = extractUserIds(message);
    await sendMessage(message, userIdsInMessage);
    adjustHeight();
  }

  if (isDomLoaded && toggleManager.states['party-toggle']) {
    popKeyboardConfetti();
  }
}

// upload media

const maxFiles = 8;
let fileList = [];
export function handleFileInput(eventOrFiles = null) {
  let filesToProcess;
  if (eventOrFiles instanceof Event) {
    filesToProcess = Array.from(eventOrFiles.target.files);
  } else if (
    eventOrFiles instanceof FileList ||
    eventOrFiles instanceof Array
  ) {
    filesToProcess = Array.from(eventOrFiles);
  } else {
    filesToProcess = [eventOrFiles];
  }
  filesToProcess = filesToProcess.filter(
    (file) => file instanceof Blob && file.size <= 50 * 1024 * 1024,
  );
  if (fileList.length + filesToProcess.length > maxFiles) {
    filesToProcess = filesToProcess.slice(0, maxFiles - fileList.length);
  }

  filesToProcess.forEach((file) => {
    fileList.push(file);
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = createEl('img', {
        style: 'max-width: 256px; max-height: 256px; margin-right: 10px;',
        src: e.target.result,
      });
      fileImagePreview.appendChild(img);
      enableElement('image-preview');
      img.addEventListener('click', function () {
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
  const dropZone = getId('drop-zone');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        const dataTransfer = e.dataTransfer;
        if (dataTransfer && dataTransfer.types.includes('text/plain')) {
          dropZone.style.display = 'flex';
        }
        dropZone.classList.add('hover');
      },
      false,
    );
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        if (e.type === 'drop') {
          const dataTransfer = e.dataTransfer;
          if (dataTransfer && dataTransfer.types.includes('text/plain')) {
            const droppedText = dataTransfer.getData('text/plain');
            if (droppedText.length < 2000) {
              dropZone.style.display = 'none';
            }
          }
        } else if (e.type === 'dragleave') {
          if (!dropZone.contains(e.relatedTarget)) {
            dropZone.style.display = 'none';
          }
        }
        dropZone.classList.remove('hover');
      },
      false,
    );
  });
  dropZone.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    if (files.length) {
      handleFileInput(files);
    }
  }
  let fileButton = getId('file-button');

  fileButton.addEventListener('click', function () {
    fileInput.click();
  });
  fileInput.addEventListener('change', handleFileInput);
}

export function updateFileImageBorder() {
  if (fileImagePreview.children.length === 0) {
    fileImagePreview.style.border = 'none';
  } else {
    fileImagePreview.style.border = '20px solid #2b2d31';
  }
}

export function initializeChatComponents() {
  replyInfo = getId('reply-info');
  replyCloseButton = getId('reply-close-button');
  fileImagePreview = getId('image-preview');

  fileInput = getId('fileInput');
}

export function displayCannotSendMessage(failedMessageContent) {
  if (!isOnDm) {
    return;
  }
  const failedId = createRandomId();
  const failedMessage = {
    messageId: failedId,
    userId: currentUserId,
    content: failedMessageContent,
    channelId: friendCache.currentDmId,
    date: createNowDate(),
    addToTop: false,
  };
  chatInput.value = '';
  displayChatMessage(failedMessage);
  const failedMsg = getId(failedId);
  if (failedMsg) {
    const foundMsgContent = failedMsg.querySelector('#message-content-element');
    if (foundMsgContent) {
      foundMsgContent.classList.add('failed');
    }
  }

  const cannotSendMsg = {
    messageId: createRandomId(),
    userId: CLYDE_ID,
    content: translations.getTranslation('fail-message-text'),
    channelId: friendCache.currentDmId,
    date: createNowDate(),
    lastEdited: '',
    attachmentUrls: '',
    addToTop: false,
    replyToId: '',
    reactionEmojisIds: '',
    replyOf: '',
    isBot: true,
    willDisplayProfile: true,
  };

  displayChatMessage(cannotSendMsg);
  scrollToBottom();
}

export function displayStartMessage() {
  if (!isOnDm) {
    let isGuildBorn = cacheInterface.isRootChannel(
      currentGuildId,
      guildCache.currentChannelId,
    );
    if (
      chatContent.querySelector('.startmessage') ||
      chatContent.querySelector('#guildBornTitle')
    ) {
      return;
    }
    const message = createEl('div', { className: 'startmessage' });
    const titleToWrite = isGuildBorn
      ? guildCache.currentGuildName
      : translations.getWelcomeChannel(currentChannelName);
    const msgtitle = createEl('h1', {
      id: isGuildBorn ? 'guildBornTitle' : 'msgTitle',
      textContent: titleToWrite,
    });
    const startChannelText = translations.getBirthChannel(currentChannelName);
    const startGuildText = translations.getTranslation('start-of-guild');
    const textToWrite = isGuildBorn ? startGuildText : startChannelText;
    const channelicon = createEl('div', { className: 'channelIcon' });
    const channelHTML = `<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="42" height="42" fill="rgb(255, 255, 255)" viewBox="0 0 24 24"><path fill="var(--white)" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>`;
    channelicon.innerHTML = channelHTML;
    const msgdescription = createEl('div', {
      id: isGuildBorn ? 'guildBornDescription' : 'msgDescription',
      textContent: textToWrite,
    });

    if (!isGuildBorn) {
      message.appendChild(channelicon);
      message.appendChild(msgtitle);
      msgtitle.appendChild(msgdescription);
    } else {
      const guildBornParent = createEl('div', { id: 'guildBornTitle-wrapper' });
      guildBornParent.appendChild(msgtitle);
      const guildBornFinishText = createEl('p', {
        id: 'guildBornTitle',
        textContent: translations.getTranslation('guild-born-title'),
      });
      guildBornParent.appendChild(guildBornFinishText);
      guildBornParent.appendChild(msgdescription);
      message.appendChild(guildBornParent);
    }
    chatContent.insertBefore(message, chatContent.firstChild);
    setIsLastMessageStart(true);
    scrollToBottom();
  } else {
    if (chatContent.querySelector('.startmessage')) {
      return;
    }
    const message = createEl('div', { className: 'startmessage' });
    const titleToWrite = getUserNick(friendCache.currentDmId);
    const msgtitle = createEl('h1', {
      id: 'msgTitle',
      textContent: titleToWrite,
    });
    const startChannelText = translations.getDmStartText(
      getUserNick(friendCache.currentDmId),
    );
    const profileImg = createEl('img', { className: 'channelIcon' });
    setProfilePic(profileImg, friendCache.currentDmId);
    const msgdescription = createEl('div', {
      id: 'msgDescription',
      textContent: startChannelText,
    });

    message.appendChild(profileImg);
    message.appendChild(msgtitle);
    msgtitle.appendChild(msgdescription);

    chatContent.insertBefore(message, chatContent.firstChild);
    setIsLastMessageStart(true);
  }
}
