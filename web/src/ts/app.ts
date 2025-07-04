import {
  alertUser,
  loadMainToolbar,
  handleResize,
  loadGuildToolbar,
  loadDmToolbar,
  initialiseMobile,
  handleMembersClick,
  initialiseChannelDrag
} from "./ui.ts";
import {
  getHistoryFromOneChannel,
  createChatScrollButton,
  handleScroll,
  setReachedChannelEnd,
  setLastSenderID,
  addChatMentionListeners
} from "./chat.ts";
import {
  chatInput,
  initialiseChatInput,
  closeReplyMenu,
  adjustHeight,
  newMessagesBar,
  chatContainer,
  updatePlaceholderVisibility,
  FileHandler,
  ReadenMessagesManager,
  setChatBarState,
  ChatBarState,
  getChatBarState,
  manuallyRenderEmojis
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
  activateDmContainer,
  updateFriendMenu,
  unselectFriendContainer,
  updateUsersActivities,
  clearActivityList
} from "./friendui.ts";
import {
  closeDropdown,
  hideGuildSettingsDropdown,
  openSearchPop,
  toggleDropdown
} from "./popups.ts";
import {
  initializeProfile,
  currentUserId,
  currentUserNick,
  userManager
} from "./user.ts";
import {
  addContextListeners,
  audioCall,
  togglePin,
  videoCall
} from "./contextMenuActions.ts";
import {
  updateChannels,
  getChannels,
  currentChannelName,
  Channel,
  changeChannel,
  setChannelTitle
} from "./channels.ts";
import { apiClient, EventType } from "./api.ts";
import {
  userList,
  activityList,
  setUserListLine,
  setUsersList,
  updateDmFriendList
} from "./userList.ts";
import {
  getId,
  getMaskedEmail,
  enableElement,
  disableElement,
  loadBooleanCookie,
  isMobile,
  escapeHtml
} from "./utils.ts";
import { setProfilePic, updateSelfProfile, setUploadSize } from "./avatar.ts";
import { addDm, friendsCache } from "./friends.ts";
import { addChannelSearchListeners } from "./search.ts";
import { initializeCookies } from "./settings.ts";
import {
  isOnMePage,
  router,
  isOnDm,
  isOnGuild,
  setisOnMePage,
  setIsOnDm,
  setIsOnGuild
} from "./router.ts";
import { initialiseAudio } from "./audio.ts";
import { translations } from "./translations.ts";
import { setSocketClient } from "./socketEvents.ts";
import { UserStatus } from "./status.ts";

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
  guilds: any[];
  gifWorkerUrl: string;
  proxyWorkerUrl: string;
  mediaProxyApiUrl: string;
  maxAvatarSize: number;
  maxAttachmentSize: number;
  wsUrl: string;
}

interface User {
  userId: string;
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
  proxyWorkerUrl: string;
  mediaProxyApiUrl: string;
  maxAvatarSize: number;
  maxAttachmentSize: number;
  sharedGuildsMap: Map<string, any>;
  wsUrl: string;
}

const ELEMENT_IDS = {
  friendsContainer: "friends-container",
  channelInfoFriend: "channel-info-container-for-friend"
};

export let userStatus: UserStatus;
export function initializeApp() {
  userStatus = new UserStatus();
  window.scrollTo(0, 0);
  addChannelSearchListeners();
  initializeElements();
  initializeSettings();
  initializeListeners();
  initializeGuild();
  clearActivityList();
  initializeProfile();
  initialiseAudio();
  initializeCookies();
  if (isMobile) {
    initialiseMobile();
  }
  handleResize();
  isDomLoaded = true;
}

export let isDomLoaded = false;
let cachedFriMenuContent;
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
    guilds,
    gifWorkerUrl,
    proxyWorkerUrl,
    mediaProxyApiUrl,
    maxAvatarSize,
    maxAttachmentSize,
    wsUrl
  } = data;

  console.log("Data loaded:", data);

  initialState = {
    user: {
      userId,
      nickname: nickName,
      status: userStatus,
      discriminator: userDiscriminator,
      maskedEmail: getMaskedEmail(email),
      email,
      maxAvatarSize
    },
    ownerId,
    permissionsMap,
    guilds,
    sharedGuildsMap,
    gifWorkerUrl,
    proxyWorkerUrl,
    mediaProxyApiUrl,
    maxAvatarSize,
    maxAttachmentSize,
    wsUrl
  };

  setSocketClient(wsUrl);
  guildCache.currentGuildName = guildName;
  updateDmsList(dmFriends);
  initialiseChannelDrag();

  friendsCache.initialiseFriends(friendsStatus);
  setUploadSize(initialState.maxAvatarSize, initialState.maxAttachmentSize);
  updateGuilds(guilds);
  addKeybinds();
}

function initializeElements() {
  createChatScrollButton();
  chatContainer.addEventListener("scroll", handleScroll);
  initialiseChatInput();
  ReadenMessagesManager.initialiseReadUi();
  closeReplyMenu();
  adjustHeight();
  FileHandler.setDropHandler();
  guildContainer.addEventListener(
    "mouseover",
    () => (guildContainer.style.backgroundColor = "#333538")
  );
  guildContainer.addEventListener(
    "mouseout",
    () => (guildContainer.style.backgroundColor = "#2b2d31")
  );
  guildContainer.style.backgroundColor = "#2b2d31";

  friendContainerItem.addEventListener("click", () => loadDmHome());

  const tbShowProfile = getId("tb-show-members");
  tbShowProfile?.addEventListener("click", handleMembersClick);
  getId("tb-call")?.addEventListener("click", audioCall);
  getId("tb-video-call")?.addEventListener("click", videoCall);
  getId("tb-pin")?.addEventListener("click", togglePin);
}

function initializeSettings() {
  updateSelfProfile(currentUserId, currentUserNick);
  const isCookieUsersOpen = loadBooleanCookie("isUsersOpen");
  setTimeout(() => {
    setUsersList(isCookieUsersOpen, true);
  }, 0);

  disableElement("loading-screen");
}

function initializeListeners() {
  getId("global-search-input")?.addEventListener("click", () =>
    openSearchPop()
  );

  guildContainer.addEventListener("click", handleGuildClick);

  const avatarWrapper = getId("avatar-wrapper") as HTMLElement;
  avatarWrapper.addEventListener("click", () => {
    if (userStatus) {
      userStatus.showStatusPanel();
    }
  });

  addContextListeners();

  addChatMentionListeners();
}

function handleGuildClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.id === "guild-container" || target.id === "guild-name")
  ) {
    toggleDropdown();
  }
}

function initializeGuild() {
  initialiseMe();
  if (userList) {
    disableElement(userList);
  }
  const {
    isValid,
    initialGuildId,
    initialChannelId,
    initialFriendId
  }: {
    isValid: boolean;
    initialGuildId?: string;
    initialChannelId?: string;
    initialFriendId?: string;
  } = router.validateRoute();

  if (initialState.guilds && initialState.guilds.length > 0) {
    processGuilds(initialGuildId, initialState.guilds);
  }

  if (isValid && initialGuildId) {
    if (!cacheInterface.doesGuildExist(initialGuildId)) {
      loadDmHome();
      return;
    }
    handleChannelLoading(initialGuildId, initialChannelId);
    fetchMembers();
  }
  if (isValid && initialFriendId) {
    setTimeout(() => {
      openDm(initialFriendId);
    }, 0);
  }
}

function processGuilds(
  initialGuildId: string | undefined,
  guilds: { guildId: string; rootChannel: string; guildChannels: Channel[] }[]
): void {
  guilds.forEach((data) => {
    data.guildChannels.forEach((channel: any) => {
      cacheInterface.addChannel(data.guildId, channel);
    });

    if (initialGuildId && initialGuildId === data.guildId) {
      cacheInterface.setRootChannel(initialGuildId, data.rootChannel);
    }

    if (data.guildId === currentGuildId) {
      updateChannels(data.guildChannels);
    }
  });
}

export function handleChannelLoading(
  guildId: string,
  channelId?: string
): void {
  if (!channelId) {
    return;
  }

  console.log("Channel check");

  const channelExists = cacheInterface.doesChannelExists(guildId, channelId);
  const isVoiceChannel = cacheInterface.isVoiceChannel(guildId, channelId);

  if (!channelExists || isVoiceChannel) {
    console.warn("Voice channel", isVoiceChannel, channelExists);
    const rootChannel = cacheInterface.getRootChannelData(guildId);
    if (rootChannel) {
      changeChannel(rootChannel);
      loadGuild(guildId, rootChannel.channelId, "", true);
    }
    return;
  }

  const channel = cacheInterface.getChannel(guildId, channelId);
  if (channel) {
    changeChannel(channel);
    loadGuild(guildId, channel.channelId, "", true);
    return;
  }

  const rootChannel = cacheInterface.getRootChannelData(guildId);
  if (rootChannel) {
    changeChannel(rootChannel);
    loadGuild(guildId, rootChannel.channelId, "", true);
  }
}
export function readGuildMessages(guildId: string) {
  alertUser("Reading messages is not implemented!");
}
export function readCurrentMessages() {
  alertUser("Reading messages is not implemented!");
  return;
  if (!guildCache.currentChannelId) {
    return;
  }
  apiClient.send(EventType.READ_MESSAGE, {
    channelId: guildCache.currentChannelId,
    guildId: currentGuildId
  });
  newMessagesBar.style.display = "none";
}

function initialiseMe() {
  if (!isOnMePage) {
    console.log("Cant initialise me while isOnMePage is false");
    return;
  }
  enableElement("dms-title");
  updateUsersActivities();
  loadMainToolbar();
}

export let isChangingPage = false;

export function openDm(friendId: string) {
  const wasOnDm = isOnDm;
  setIsOnDm(true);
  friendsCache.currentDmId = friendId;
  setLastSenderID("");
  setTimeout(() => {
    activateDmContainer(friendId);
  }, 100);
  unselectFriendContainer();
  router.switchToDm(friendId);
  if (!friendsCache.userExistsDm(friendId)) {
    try {
      addDm(friendId);
    } catch (e) {
      if (e instanceof Error) {
        printFriendMessage(e.message);
      }
    }
  }
  loadApp(friendId);
  setTimeout(() => {
    if (wasOnDm) {
      changeCurrentDm(friendId);
    }
  }, 0);
  try {
    getHistoryFromOneChannel(friendId, true);
  } catch (e) {
    if (e instanceof Error) {
      printFriendMessage(e.message);
    } else {
      printFriendMessage("An unknown error occurred.");
    }
  }
}

let lastDmId: string;

function handleMenu(isChangingUrl: boolean) {
  selectGuildList("main-logo");
  if (isChangingUrl) {
    router.resetRoute();
  }

  enableElement(ELEMENT_IDS.friendsContainer, false, true);
  friendContainerItem.classList.add("dm-selected");

  disableDmContainers();
  lastDmId = "";
  friendsCache.currentDmId = "";

  enableElement(ELEMENT_IDS.channelInfoFriend);
  if (!isMobile) {
    disableElement("channel-info-container-for-index");
  }

  loadMainToolbar();

  [
    "hash-sign",
    "dm-profile-sign-bubble",
    "dm-profile-sign",
    "message-input-container",
    "channel-container"
  ].forEach(disableElement);

  friendContainerItem.style.color = "white";

  updateUsersActivities();

  setUsersList(false);
  if (userList) {
    disableElement(userList);
  }
  setUserListLine();

  const nowOnlineTitle = getId("nowonline");
  if (nowOnlineTitle) {
    nowOnlineTitle.style.fontWeight = "bolder";
  }

  if (isOnMePage) {
    return;
  }

  closeDropdown();
  setisOnMePage(true);
  setIsOnGuild(false);
  updateFriendMenu();
  disableElement("scroll-to-bottom");
}

export function loadDmHome(isChangingUrl = true): void {
  console.log("Loading main menu...");

  selectGuildList("main-logo");

  if (isOnGuild) {
    if (isOnDm) {
      handleMenu(isChangingUrl);
    } else if (lastDmId) {
      openDm(lastDmId);
      disableElement(ELEMENT_IDS.friendsContainer);
    } else {
      handleMenu(isChangingUrl);
    }
  } else {
    handleMenu(isChangingUrl);
  }

  disableElement("channel-container");
  disableElement(chatContainer);

  setTimeout(() => {
    disableElement(chatContainer);
  }, 0);
  enableElement("friend-container-item");
  setGuildNameText("");
  disableElement("guild-settings-button");
  enableElement("global-search-input", false, true);
  enableElement("friends-container-item");
  enableElement("dms-title");
  enableElement("dm-container-parent", false, true);

  if (!isMobile) {
    enableElement("guild-container", false, true);
  }

  const chanList = getId("channel-list") as HTMLElement;
  if (cachedFriMenuContent && chanList) {
    chanList.innerHTML = cachedFriMenuContent;
  }

  handleResize();
}

export function changeCurrentGuild() {
  isChangingPage = true;
  setisOnMePage(false);
  setIsOnGuild(true);
  getChannels();
  fetchMembers();
  refreshInviteId();
  closeDropdown();
  setChannelTitle(currentChannelName);
  setGuildNameText(guildCache.currentGuildName);
  hideGuildSettingsDropdown();

  isChangingPage = false;
}
const channelInputStates: { [guildId: string]: ChatBarState } = {};
export function loadApp(friendId?: string, isInitial?: boolean) {
  if (isChangingPage) {
    return;
  }
  isChangingPage = true;

  setisOnMePage(false);
  enableElement("guild-name");
  console.log("Loading app with friend id:", friendId);

  function handleGuild() {
    setIsOnGuild(true);
    setIsOnDm(false);
    if (friendsCache.currentDmId) {
      lastDmId = friendsCache.currentDmId;
      getHistoryFromOneChannel(guildCache.currentChannelId);
    }
    if (!isInitial) {
      fetchMembers();
      getChannels();
    }
    disableElement("dms-title");
    enableElement("channel-container", false, true);
    if (activityList) {
      disableElement(activityList);
    }
    handleMembersClick();

    disableElement("dm-container-parent");
    disableElement("friend-container-item");
    enableElement("guild-settings-button");
    enableElement("hash-sign");
    enableElement("channel-info");
    setGuildNameText(guildCache.currentGuildName);
    disableElement("global-search-input");
    disableElement("dm-profile-sign-bubble");
    disableElement("dm-profile-sign");
    loadGuildToolbar();

    const oldState = getChatBarState();
    setChatBarState(oldState);
    chatInput.innerHTML = escapeHtml(oldState.rawContent) ?? "";
    channelInputStates[guildCache.currentChannelId] = getChatBarState();
    manuallyRenderEmojis(oldState.rawContent);
  }

  function handleDm(id: string) {
    loadDmToolbar();
    setIsOnGuild(false);
    setIsOnDm(true);
    enableElement("dm-profile-sign-bubble");
    enableElement("dm-profile-sign");
    enableElement("guild-container", false, true);
    disableElement("guild-settings-button");
    activateDmContainer(id);
    const friendNick = userManager.getUserNick(id);

    updatePlaceholderVisibility(translations.getDmPlaceHolder(friendNick));
    setChannelTitle(friendNick);
    disableElement("hash-sign");
    enableElement("channel-info");

    const dmProfSign = getId("dm-profile-sign") as HTMLImageElement;
    if (dmProfSign) {
      setProfilePic(dmProfSign, id);
      dmProfSign.dataset.cid = id;
    }
    const oldState = getChatBarState();
    setChatBarState(oldState);
    chatInput.innerText = oldState.rawContent ?? "";
    channelInputStates[id] = getChatBarState();

    updateDmFriendList(id, friendNick);
  }

  if (friendId) {
    handleDm(friendId);
  } else {
    handleGuild();
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

function changeCurrentDm(friendId: string) {
  isChangingPage = true;
  setisOnMePage(false);
  setIsOnGuild(false);
  setIsOnDm(true);
  setReachedChannelEnd(false);

  const friendNick = userManager.getUserNick(friendId);
  setChannelTitle(friendNick);
  updatePlaceholderVisibility(translations.getDmPlaceHolder(friendNick));
  const dmProfSign = getId("dm-profile-sign") as HTMLImageElement;
  if (dmProfSign) {
    setProfilePic(dmProfSign, friendId);
    dmProfSign.dataset.cid = friendId;
  }
  updateDmFriendList(friendId, friendNick);

  isChangingPage = false;
}

export function initialiseApp() {
  setTimeout(() => {
    apiClient.send(EventType.GET_INIT_DATA);
  }, 0);
}

window.onerror = (message, source, lineno, colno, error) => {
  const msg = `Error: ${message} at ${source}:${lineno}:${colno}`;
  console.error(msg);
  alertUser("Error", msg);
};

setTimeout(() => window.scrollTo(0, 0), 20);

initialiseApp();
