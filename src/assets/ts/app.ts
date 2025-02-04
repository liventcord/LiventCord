import {
  alertUser,
  loadMainToolbar,
  handleResize,
  loadGuildToolbar,
  loadDmToolbar
} from "./ui.ts";
import {
  fetchReplies,
  getHistoryFromOneChannel,
  createChatScrollButton,
  handleScroll,
  setReachedChannelEnd,
  setLastSenderID,
  scrollToMessage
} from "./chat.ts";
import {
  chatInput,
  initialiseChatInput,
  initialiseReadUi,
  closeReplyMenu,
  adjustHeight,
  setDropHandler,
  newMessagesBar,
  chatContainer
} from "./chatbar.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import {
  updateGuilds,
  addKeybinds,
  loadGuild,
  selectGuildList,
  fetchMembers,
  refreshInviteId,
  currentGuildId,
  guildContainer,
  setGuildNameText
} from "./guild.ts";
import {
  disableDmContainers,
  friendContainerItem,
  printFriendMessage,
  updateDmsList,
  setupSampleUsers,
  activateDmContainer
} from "./friendui.ts";
import {
  closeDropdown,
  hideGuildSettingsDropdown,
  openSearchPop,
  toggleDropdown
} from "./popups.ts";
import {
  copySelfName,
  addUser,
  initializeProfile,
  getUserNick,
  currentUserId,
  currentUserNick
} from "./user.ts";
import { addContextListeners } from "./contextMenuActions.ts";
import {
  updateChannels,
  channelTitle,
  channelsUl,
  getChannels,
  currentChannelName
} from "./channels.ts";
import { apiClient, EventType } from "./api.ts";
import {
  updateUserListText,
  toggleUsersList,
  userList,
  setUserListLine,
  setUsersList,
  updateDmFriendList
} from "./userList.ts";
import {
  getId,
  getMaskedEmail,
  createEl,
  enableElement,
  disableElement,
  constructDmPage
} from "./utils.ts";
import { setProfilePic, updateSelfProfile, setUploadSize } from "./avatar.ts";

import { friendsCache } from "./friends.ts";
import { addChannelSearchListeners, userMentionDropdown } from "./search.ts";
import { loadBooleanCookie, initializeCookies } from "./settings.ts";
import {
  isOnMe,
  router,
  isOnDm,
  isOnGuild,
  setIsOnMe,
  setIsOnDm,
  setIsOnGuild
} from "./router.ts";
import { initialiseAudio } from "./audio.ts";
import { translations } from "./translations.ts";

export let isDomLoaded = false;
let cachedFriMenuContent;
let userListFriActiveHtml;

export function initializeApp() {
  window.scrollTo(0, 0);
  addChannelSearchListeners();
  initializeElements();
  initializeSettings();
  initializeListeners();
  initializeGuild();
  initializeProfile();
  initialiseAudio();
  initializeCookies();
  isDomLoaded = true;
}

interface InitialStateData {
  email: string;
  userId: string;
  nickName: string;
  userStatus: string;
  userDiscriminator: string;
  guildName: string;
  ownerId: string;
  sharedGuildsMap: Map<string, any>;
  permissionsMap: Map<string, any>;
  friendsStatus: any;
  dmFriends?: any[];
  guildsJson: any[];
  gifWorkerUrl: string;
  maxAvatarSize: number;
  maxAttachmentSize: number;
}

interface User {
  id: string;
  nickname: string;
  status: string;
  discriminator: string;
  maskedEmail: string;
  email: string;
  maxAvatarSize: number;
}

interface InitialState {
  user: User;
  ownerId: string;
  permissionsMap: Map<string, any>;
  guilds: any[];
  gifWorkerUrl: string;
  maxAvatarSize: number;
  maxAttachmentSize: number;
}

export let initialState: InitialState;

export function initialiseState(data: InitialStateData): void {
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
    maxAvatarSize,
    maxAttachmentSize
  } = data;

  console.log("Data loaded:", data);

  initialState = {
    user: {
      id: userId,
      nickname: nickName,
      status: userStatus,
      discriminator: userDiscriminator,
      maskedEmail: getMaskedEmail(email),
      email,
      maxAvatarSize
    },
    ownerId,
    permissionsMap,
    guilds: guildsJson || [],
    gifWorkerUrl,
    maxAvatarSize,
    maxAttachmentSize
  };

  guildCache.currentGuildName = guildName;
  updateDmsList(dmFriends);
  setupSampleUsers();
  friendsCache.initialiseFriends(friendsStatus);
  setUploadSize(initialState.maxAvatarSize, initialState.maxAttachmentSize);

  updateGuilds(guildsJson);
  addKeybinds();
}

async function loadInitialData() {
  await translations.translationsLoaded;

  const initData = await apiClient.fetchData("/api/init");

  if (!initData) {
    return;
  }

  initialiseState(initData);
  initializeApp();
}


export function initializeElements() {
  createChatScrollButton();
  chatContainer.addEventListener("scroll", handleScroll);
  initialiseChatInput();
  initialiseReadUi();
  closeReplyMenu();
  adjustHeight();
  setDropHandler();

  guildContainer.addEventListener(
    "mouseover",
    () => (guildContainer.style.backgroundColor = "#333538")
  );
  guildContainer.addEventListener(
    "mouseout",
    () => (guildContainer.style.backgroundColor = "#2b2d31")
  );

  friendContainerItem.addEventListener("click", () => loadDmHome());

  getId("tb-showprofile").addEventListener("click", toggleUsersList);
}

export function initializeSettings() {
  updateSelfProfile(currentUserId, currentUserNick);
  const isCookieUsersOpen = loadBooleanCookie("isUsersOpen");
  setUsersList(isCookieUsersOpen, true);
  disableElement("loading-screen");
}

export function initializeListeners() {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    if (
      target &&
      !userMentionDropdown.contains(target) &&
      target !== chatInput
    ) {
      userMentionDropdown.style.display = "none";
    }
  });

  getId("global-search-input").addEventListener("click", function () {
    openSearchPop();
  });

  guildContainer.addEventListener("click", handleGuildClick);

  getId("avatar-wrapper").addEventListener("click", copySelfName);
  addContextListeners();
}

export function handleGuildClick(event) {
  if (
    event.target.id === "guild-container" ||
    event.target.id === "guild-name"
  ) {
    toggleDropdown();
  }
}
export function isDefined(variable) {
  return typeof variable !== "undefined" && variable !== null;
}
export function initializeGuild() {
  initialiseMe();
  const { isValid, initialGuildId, initialChannelId, initialFriendId } =
    router.validateRoute();

  if (isValid) {
    loadGuild(initialGuildId, initialChannelId, null, false, true);
  } else {
    console.log("Route is not a guild");
    return;
  }
  if (isDefined(initialFriendId)) {
    addUser(initialFriendId);
  }

  fetchMembers();
  console.log(initialState.guilds);
  if (isOnGuild && initialState.guilds && initialState.guilds.length > 0) {
    initialState.guilds.forEach((data) => {
      console.log(data);
      cacheInterface.addChannel(data.guildId, data.guildChannels);
      cacheInterface.setRootChannel(initialGuildId, data.rootChannel);
      if (data.guildId === currentGuildId) {
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
    guildId: currentGuildId
  });
  newMessagesBar.style.display = "none";
}

export function createReplyBar(
  newMessage,
  messageId,
  userId,
  content,
  attachmentUrls
) {
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

  const nick = getUserNick(userId);
  replyBar.style.height = "100px";
  const replyAvatar = createEl("img", { className: "profile-pic", id: userId });
  replyAvatar.classList.add("reply-avatar");
  replyAvatar.style.width = "15px";
  replyAvatar.style.height = "15px";

  setProfilePic(replyAvatar, userId);
  const replyNick = createEl("span", {
    textContent: nick,
    className: "reply-nick"
  });
  const textToWrite = content
    ? content
    : attachmentUrls
    ? attachmentUrls
    : "Eki görüntülemek için tıkla";
  const replyContent = createEl("span", {
    className: "replyContent",
    textContent: textToWrite
  });

  replyContent.onclick = () => {
    const originalMsg = getId(messageId);
    if (originalMsg) {
      scrollToMessage(originalMsg);
    } else {
      fetchReplies(newMessage.dataset.replyToId, null, true);
    }
  };
  replyBar.appendChild(replyAvatar);
  replyBar.appendChild(replyNick);
  replyBar.appendChild(replyContent);
}

export function removeDm(userId) {}

export function initialiseMe() {
  if (!isOnMe) {
    console.log("Cant initialise me while isOnMe is false");
    return;
  }
  enableElement("dms-title");
  console.warn(translations.textTranslations);
  updateUserListText();
  loadMainToolbar();
}

export let isChangingPage = false;

export function openDm(friendId) {
  const wasOnDm = isOnDm;
  setIsOnDm(true);
  friendsCache.currentDmId = friendId;
  setLastSenderID("");
  activateDmContainer(friendId);
  const url = constructDmPage(friendId);
  if (url !== window.location.pathname) {
    window.history.pushState(null, null, url);
  }
  if (!friendsCache.userExistsDm(friendId)) {
    try {
      apiClient.send(EventType.ADD_DM, { friendId });
    } catch (e) {
      printFriendMessage(e);
    }
  }
  loadApp(friendId);
  if (wasOnDm) {
    changeCurrentDm(friendId);
  }
  try {
    getHistoryFromOneChannel(friendId, true);
  } catch (e) {
    printFriendMessage(e);
  }
}

let lastDmId;
export function loadDmHome(isChangingUrl?: boolean): void {
  if (isChangingUrl === undefined) {
    isChangingUrl = true;
  }

  console.log("Loading main menu...");

  function handleMenu() {
    selectGuildList("main-logo");
    if (isChangingUrl) {
      window.history.pushState(null, null, "/channels/@me");
    }
    enableElement("friends-container", false, true);
    friendContainerItem.classList.add("dm-selected");
    disableDmContainers();
    lastDmId = "";
    friendsCache.currentDmId = "";
    enableElement("channel-info-container-for-friend");
    disableElement("channel-info-container-for-index");
    loadMainToolbar();
    disableElement("chat-container");
    disableElement("message-input-container");
    friendContainerItem.style.color = "white";

    updateUserListText();
    userList.classList.add("friendactive");
    handleResize();
    setUserListLine();
    if (userListFriActiveHtml) {
      userList.innerHTML = userListFriActiveHtml;
    }
    const nowOnlineTitle = getId("nowonline");
    if (nowOnlineTitle) nowOnlineTitle.style.fontWeight = "bolder";
    if (isOnMe) {
      return;
    }
    setIsOnMe(true);
    setIsOnGuild(false);
    selectGuildList("main-logo");
  }

  function handleDm() {
    openDm(lastDmId);
    disableElement("friends-container");
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

  enableElement("friend-container-item");
  setGuildNameText("");
  disableElement("guild-settings-button");
  enableElement("global-search-input", false, true);
  enableElement("friends-container-item");

  enableElement("dms-title");
  enableElement("dm-container-parent", false, true);
  channelsUl.innerHTML = "";

  enableElement("guild-container", false, true);

  const chanList = getId("channel-list");
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
  closeDropdown();
  channelTitle.textContent = currentChannelName;
  setGuildNameText(guildCache.currentGuildName);
  hideGuildSettingsDropdown();

  isChangingPage = false;
}

export function loadApp(friendId = null, isInitial = false) {
  if (isChangingPage) {
    return;
  }
  isChangingPage = true;

  if (isOnMe) {
    userListFriActiveHtml = userList.innerHTML;
  }

  setIsOnMe(false);

  userList.innerHTML = "";
  userList.classList.remove("friendactive");
  enableElement("guild-name");
  console.log("Loading app with friend id:", friendId);

  if (!friendId) {
    setIsOnGuild(true);
    setIsOnDm(false);
    if (friendsCache.currentDmId) {
      lastDmId = friendsCache.currentDmId;
    }
    if (!isInitial) {
      fetchMembers();
      getChannels();
    }
    disableElement("dms-title");
    disableElement("dm-container-parent");
    disableElement("friend-container-item");
    enableElement("guild-settings-button");
    enableElement("hash-sign");
    setGuildNameText(guildCache.currentGuildName);
    disableElement("global-search-input");
    disableElement("dm-profile-sign-bubble");
    disableElement("dm-profile-sign");
    loadGuildToolbar();
  } else {
    loadDmToolbar();
    setIsOnGuild(false);
    setIsOnDm(true);
    enableElement("dm-profile-sign-bubble");
    enableElement("dm-profile-sign");
    enableElement("guild-container", false, true);
    disableElement("guild-settings-button");
    activateDmContainer(friendId);
    const friendNick = getUserNick(friendId);
    chatInput.placeholder = translations.getDmPlaceHolder(friendNick);

    channelTitle.textContent = friendNick;
    disableElement("hash-sign");
    enableElement("dm-profile-sign");
    const dmProfSign = getId("dm-profile-sign");
    setProfilePic(dmProfSign, friendId);
    dmProfSign.dataset.cid = friendId;

    updateDmFriendList(friendId, friendNick);
  }

  disableElement("channel-info-container-for-friend");
  disableElement("friends-container");
  disableElement("user-line");

  enableElement("channel-info-container-for-index");
  enableElement("chat-container", true);
  enableElement("message-input-container", false, true);
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
  const dmProfSign = getId("dm-profile-sign");
  setProfilePic(dmProfSign, friendId);
  dmProfSign.dataset.cid = friendId;
  updateDmFriendList(friendId, friendNick);

  isChangingPage = false;
}

loadInitialData();
window.onerror = (message, source, lineno, colno, error) => {
  const msg = `Error: ${message} at ${source}:${lineno}:${colno}`;
  console.error(msg);
  alertUser("Error", msg);
};

const SCROLL_DELAY = 20;
setTimeout(() => window.scrollTo(0, 0), SCROLL_DELAY);
