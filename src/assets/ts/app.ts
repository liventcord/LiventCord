import {
  alertUser,
  loadMainToolbar,
  handleResize,
  loadGuildToolbar,
  loadDmToolbar,
} from './ui';
import {
  fetchReplies,
  getHistoryFromOneChannel,
  createChatScrollButton,
  handleScroll,
  setReachedChannelEnd,
  setLastSenderID,
} from './chat';
import {
  chatInput,
  initializeChatComponents,
  initialiseChatInput,
  closeReplyMenu,
  adjustHeight,
  setDropHandler,
} from './chatbar';
import { cacheInterface } from './cache';
import {
  updateGuilds,
  addKeybinds,
  loadGuild,
  selectGuildList,
  fetchMembers,
  refreshInviteId,
  currentGuildId
} from './guild';
import { disableDmContainers } from './friendui';
import { hideGuildSettingsDropdown, openSearchPop,toggleDropdown } from './popups';
import {
  copySelfName,
  addUser,
  getUserDiscriminator,
  initializeProfile,
  getUserNick
} from './user';
import { addContextListeners } from './contextMenuActions';
import {
  updateChannels,
  channelTitle,
  channelsUl,
  getChannels,
  currentChannelName,
} from './channels';
import { apiClient, EventType } from './api';
import { updateUserListText, toggleUsersList, userList } from './userList';
import {
  sendNotify,
  getId,
  getMaskedEmail,
  createEl,
  enableElement,
  disableElement,
  constructDmPage,
} from './utils';
import { guildCache } from './cache';
import { updateDmsList, setupSampleUsers,activateDmContainer } from './friendui';
import { setProfilePic, updateSelfProfile } from './avatar';
import { currentUserId } from './user';
import { friendCache } from './friends';
import { addChannelSearchListeners } from './search';
import { chatContainer } from './chatbar';
import { loadBooleanCookie, initializeCookies } from './settings';
import { setUsersList } from './userList';
import {
  isOnMe,
  router,
  isOnDm,
  isOnGuild,
  setIsOnMe,
  setIsOnDm,
  setIsOnGuild,
} from './router';
import { initialiseAudio } from './audio';
import { translations } from './translations';



export let isDomLoaded = false;
let cachedFriMenuContent;
let userListFriActiveHtml;


export function initializeApp() {
  window.scrollTo(0, 0);
  assignElements();
  initializeChatComponents();
  initializeElements();
  initializeSettings();
  initializeListeners();
  initializeGuild();
  initializeProfile();
  initialiseAudio();
  initializeCookies();
  isDomLoaded = true;
}



export function assignElements() {
  addChannelSearchListeners();
}

export let initialState = {
  user: {
    id: null,
    nickname: null,
    status: null,
    discriminator: null,
    maskedEmail: null,
  },
  ownerId: null,
  permissionsMap: null,
  guilds: [],
  gifWorkerUrl: null,
};

export function initialiseState(data) {
  const {
    email,
    userId,
    nickName,
    userStatus,
    userDiscriminator,
    guildName,
    ownerId,
    sharedGuildsMap,
    permissionsMap,
    friendsStatus,
    dmFriends = [],
    guildsJson,
    gifWorkerUrl,
  } = data;

  console.log('Data loaded:', data);

  initialState = {
    user: {
      id: userId,
      nickname: nickName,
      status: userStatus,
      discriminator: userDiscriminator,
      maskedEmail: getMaskedEmail(email),
      mail: email,
    },
    ownerId,
    permissionsMap,
    guilds: guildsJson || [],
    gifWorkerUrl: gifWorkerUrl,
  };
  window.initialState = initialState;

  guildCache.currentGuildName = guildName;
  updateDmsList(dmFriends);
  setupSampleUsers();
  friendCache.initialiseFriends(friendsStatus);

  updateGuilds(guildsJson);
  addKeybinds();
}
async function loadInitialData() {
  await translations.translationsLoaded;
  try {
    const response = await fetch('/api/init');
    if (!response.ok) {
      if (response.status == 401) {
        await router.changeToLogin();
        return;
      }
    }
    const rawResponse = await response.text();

    try {
      const initData = JSON.parse(rawResponse);
      initialiseState(initData);
      initializeApp();
    } catch (e) {
      console.error(e);
      alertUser(e.message);
    }
  } catch (error) {
    console.error('Error loading initial data:', error);
  }
}


export function initializeElements() {
  createChatScrollButton();
  chatContainer.addEventListener('scroll', handleScroll);
  initialiseChatInput();
  closeReplyMenu();
  adjustHeight();
  setDropHandler();

  const guildContainer = getId('guild-container');
  guildContainer.addEventListener(
    'mouseover',
    () => (guildContainer.style.backgroundColor = '#333538'),
  );
  guildContainer.addEventListener(
    'mouseout',
    () => (guildContainer.style.backgroundColor = '#2b2d31'),
  );

  const friendContainer = getId('friend-container-item');
  friendContainer.addEventListener('click', loadDmHome);


  getId('tb-showprofile').addEventListener('click', toggleUsersList);
}

export function initializeSettings() {
  updateSelfProfile(currentUserId);
  const isCookieUsersOpen = loadBooleanCookie('isUsersOpen');
  setUsersList(isCookieUsersOpen, true);
  disableElement('loading-screen');
}

export function initializeListeners() {
  document.addEventListener('click', (event) => {
    if (
      !userMentionDropdown.contains(event.target) &&
      event.target !== chatInput
    ) {
      userMentionDropdown.style.display = 'none';
    }
  });
  getId('global-search-input').addEventListener('click', function () {
    openSearchPop();
  });

  const guildContainer = getId('guild-container');
  guildContainer.addEventListener('click', handleGuildClick);

  getId('avatar-wrapper').addEventListener('click', copySelfName);
  addContextListeners();
}

export function handleGuildClick(event) {
  if (
    event.target.id === 'guild-container' ||
    event.target.id === 'guild-name'
  ) {
    toggleDropdown();
  }
}
export function isDefined(variable) {
  return typeof variable !== 'undefined' && variable !== null;
}
export function initializeGuild() {
  initialiseMe();
  let { isValid, initialGuildId, initialChannelId, initialFriendId } =
    router.validateRoute();

  if (isValid) {
    loadGuild(initialGuildId, initialChannelId, null, false, true);
  } else {
    console.warn('Route cannot be validated!!');
    return;
  }
  if (isDefined(initialFriendId)) {
    addUser(
      initialFriendId,
      passed_friend_name,
      passed_friend_discriminator,
      passed_friend_blocked,
    );
  }

  fetchMembers();
  console.log(initialState.guilds);
  if (
    isOnGuild &&
    initialState.guilds &&
    initialState.guilds.length > 0
  ) {
    initialState.guilds.forEach((data) => {
      if (data.guildId == currentGuildId) {
        cacheInterface.addChannel(data.guildId, data.guildChannels);
        updateChannels(data.guildChannels);
      }
    });
  }
}

export function readCurrentMessages() {
  if (!guildCache.currentChannelId) {
    return;
  }
  apiClient.send(EventType.READ_MESSAGE, {
    channelId: guildCache.currentChannelId,
    guildId: currentGuildId,
  });
  getId('newMessagesBar').style.display = 'none';
}

export function createReplyBar(
  newMessage,
  messageId,
  userId,
  content,
  attachmentUrls,
) {
  if (newMessage.querySelector('.replyBar')) {
    return;
  }
  const smallDate = newMessage.querySelector('.small-date-element');
  if (smallDate) {
    smallDate.remove();
  }

  const replyBar = createEl('div', { className: 'replyBar' });
  newMessage.appendChild(replyBar);
  newMessage.classList.add('replyMessage');
  const messageContentElement = newMessage.querySelector(
    '#message-content-element',
  );

  const nick = getUserNick(userId);
  replyBar.style.height = '100px';
  const replyAvatar = createEl('img', { className: 'profile-pic', id: userId });
  replyAvatar.classList.add('reply-avatar');
  replyAvatar.style.width = '15px';
  replyAvatar.style.height = '15px';

  setProfilePic(replyAvatar, userId);
  const replyNick = createEl('span', {
    textContent: nick,
    className: 'reply-nick',
  });
  const textToWrite = content
    ? content
    : attachmentUrls
    ? attachmentUrls
    : 'Eki görüntülemek için tıkla';
  const replyContent = createEl('span', {
    className: 'replyContent',
    textContent: textToWrite,
  });

  replyContent.onclick = () => {
    const originalMsg = getId(messageId);
    if (originalMsg) {
      scrollToMessage(originalMsg);
    } else {
      fetchReplies(newMessage.dataset.replyToId, null, (goToOld = true));
    }
  };
  replyBar.appendChild(replyAvatar);
  replyBar.appendChild(replyNick);
  replyBar.appendChild(replyContent);
}

export function removeDm(userId) {}

export function initialiseMe() {
  if (!isOnMe) {
    console.log('Cant initialise me while isOnMe is false');
    return;
  }
  enableElement('dms-title');
  updateUserListText();
  loadMainToolbar();
}

export let isChangingPage = false;

export function openDm(friendId) {
  const wasOnDm = isOnDm;
  setIsOnDm(true);
  friendCache.currentDmId = friendId;
  setLastSenderID();
  activateDmContainer(friendId);
  const url = constructDmPage(friendId);
  if (url != window.location.pathname) {
    window.history.pushState(null, null, url);
  }
  if (!friendCache.userExistsDm(friendId)) {
    apiClient.send(EventType.ADD_DM, { friendId: friendId });
  }
  loadApp(friendId);
  if (wasOnDm) {
    changeCurrentDm(friendId);
  }
  getHistoryFromOneChannel(friendId, true);
}

let lastDmId;

export function loadDmHome(isChangingUrl = true) {
  console.log('Loading main menu...');
  function handleMenu() {
    selectGuildList('main-logo');
    if (isChangingUrl) {
      window.history.pushState(null, null, '/channels/@me');
    }
    enableElement('friends-container', false, true);
    getId('friend-container-item').classList.add('dm-selected');
    disableDmContainers();
    lastDmId = '';
    friendCache.currentDmId = '';
    enableElement('channel-info-container-for-friend');
    disableElement('channel-info-container-for-index');
    loadMainToolbar();
    disableElement('chat-container');
    disableElement('message-input-container');
    getId('friend-container-item').style.color = 'white';

    updateUserListText();
    userList.classList.add('friendactive');
    if (userListFriActiveHtml) {
      userList.innerHTML = userListFriActiveHtml;
    }
    const nowOnlineTitle = getId('nowonline');
    if (nowOnlineTitle) nowOnlineTitle.style.fontWeight = 'bolder';
    if (isOnMe) {
      return;
    }
    setIsOnMe(true);
    setIsOnGuild(false);
  }

  function handleDm() {
    openDm(lastDmId);
    disableElement('friends-container');
  }
  if (isOnGuild) {
    if (isOnDm) {
      handleMenu();
    } else {
      if (lastDmId) {
        handleDm();
      } else {
        handleMenu();
      }
    }
  } else {
    handleMenu();
  }

  enableElement('friend-container-item');
  getId('guild-name').innerText = '';
  disableElement('guild-settings-button');
  enableElement('global-search-input', false, true);
  enableElement('friends-container-item');

  enableElement('dms-title');
  enableElement('dm-container-parent', false, true);
  channelsUl.innerHTML = '';

  enableElement('guild-container', false, true);

  const chanList = getId('channel-list');
  if (cachedFriMenuContent) {
    chanList.innerHTML = cachedFriMenuContent;
  }

  handleResize();
}

export function changecurrentGuild() {
  isChangingPage = true;
  setIsOnMe(false);
  setIsOnGuild(true);
  getChannels();
  fetchMembers();
  refreshInviteId();
  getId('channel-info').textContent = currentChannelName;
  getId('guild-name').innerText = guildCache.currentGuildName;
  hideGuildSettingsDropdown();
  disableElement('settings-dropdown-button');

  isChangingPage = false;
}

export function loadApp(friendId = null, isInitial = false) {
  if (isChangingPage) {
    return;
  }
  isChangingPage = true;
  const userList = getId('user-list');

  if (isOnMe) {
    userListFriActiveHtml = userList.innerHTML;
  }

  setIsOnMe(false);

  userList.innerHTML = '';
  userList.classList.remove('friendactive');
  enableElement('guild-name');
  console.log('Loading app with friend id:', friendId);

  if (!friendId) {
    setIsOnGuild(true);
    setIsOnDm(false);
    if (friendCache.currentDmId) {
      lastDmId = friendCache.currentDmId;
    }
    if (!isInitial) {
      fetchMembers();
      getChannels();
    }
    disableElement('dms-title');
    disableElement('dm-container-parent');
    disableElement('friend-container-item');
    enableElement('guild-settings-button');
    enableElement('hash-sign');
    getId('guild-name').innerText = guildCache.currentGuildName;
    disableElement('global-search-input');
    disableElement('dm-profile-sign-bubble');
    disableElement('dm-profile-sign');
    loadGuildToolbar();
  } else {
    loadDmToolbar();
    setIsOnGuild(false);
    setIsOnDm(true);
    enableElement('dm-profile-sign-bubble');
    enableElement('dm-profile-sign');
    enableElement('guild-container', false, true);
    disableElement('guild-settings-button');
    activateDmContainer(friendId);
    const friendNick = getUserNick(friendId);
    chatInput.placeholder = translations.getDmPlaceHolder(friendNick);

    channelTitle.textContent = friendNick;
    disableElement('hash-sign');
    enableElement('dm-profile-sign');
    const dmProfSign = getId('dm-profile-sign');
    setProfilePic(dmProfSign, friendId);
    dmProfSign.dataset.cid = friendId;

    updateDmFriendList(friendId, friendNick, getUserDiscriminator(friendId));
  }

  disableElement('channel-info-container-for-friend');
  disableElement('friends-container');
  document.querySelector('.horizontal-line').style.display = 'none';

  enableElement('channel-info-container-for-index');
  enableElement('chat-container', true);
  enableElement('message-input-container', false, true);
  adjustHeight();

  handleResize();
  isChangingPage = false;
}

export function changeCurrentDm(friendId) {
  isChangingPage = true;
  setIsOnMe(false);
  setIsOnGuild(false);
  setIsOnDm(true);
  setReachedChannelEnd(false);

  const friendNick = getUserNick(friendId);
  channelTitle.textContent = friendNick;
  chatInput.placeholder = translations.getDmPlaceHolder(friendNick);
  const dmProfSign = getId('dm-profile-sign');
  setProfilePic(dmProfSign, friendId);
  dmProfSign.dataset.cid = friendId;
  updateDmFriendList(friendId, friendNick);

  isChangingPage = false;
}

loadInitialData();
window.onerror = (event, url, line, column, error) => {
  let msg = '';
  msg += 'Error: ' + error;
  sendNotify(msg);
};
setTimeout(() => window.scrollTo(0, 0), 20);
