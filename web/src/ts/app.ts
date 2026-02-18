import {
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
  ReadenMessagesManager,
  setChatBarState,
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

import { initializeProfile, userManager } from "./user.ts";
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
import { initializeUserStatus, userStatus } from "./status.ts";
import { initializeVideoComponent } from "./chatroom.ts";
import { Channel, ChatBarState } from "./types/interfaces.ts";
import { appState, InitialState, InitialStateData } from "./appState.ts";
import { FileHandler } from "./fileHandler.ts";
import {
  openSearchPop,
  toggleDropdown,
  closeDropdown,
  hideGuildSettingsDropdown
} from "./guildPop.ts";

const ELEMENT_IDS = {
  friendsContainer: "friends-container",
  channelInfoFriend: "channel-info-container-for-friend",
  channelInfoIndex: "channel-info-container-for-index",
  channelContainer: "channel-container",
  dmContainerParent: "dm-container-parent",
  friendContainerItem: "friend-container-item",
  friendsContainerItem: "friends-container-item",
  dmsTitle: "dms-title",
  guildContainer: "guild-container",
  guildSettingsButton: "guild-settings-button",
  channelInfo: "channel-info",
  globalSearchInput: "global-search-input",
  hashSign: "hash-sign",
  dmProfileSignBubble: "dm-profile-sign-bubble",
  dmProfileSign: "dm-profile-sign",
  messageInputContainer: "message-input-container",
  chatContainer: "chat-container",
  scrollToBottom: "scroll-to-bottom",
  searchMessagesRoot: "search-messages-root",
  userLine: "user-line",
  guildName: "guild-name",
  tbShowMembers: "tb-show-members",
  tbCall: "tb-call",
  tbVideoCall: "tb-video-call",
  tbPin: "tb-pin",
  avatarWrapper: "avatar-wrapper",
  nowOnline: "nowonline",
  loadingScreen: "loading-screen",
  mainLogo: "main-logo"
} as const;

export let isDomLoaded = false;
export let initialState: InitialState;
export let isChangingPage = false;

const channelInputStates: { [id: string]: ChatBarState } = {};
let lastDmId: string = "";

export function initializeApp(): void {
  initializeUserStatus();
  window.scrollTo(0, 0);
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

export function initialiseState(data: InitialStateData): void {
  const {
    email,
    userId,
    nickName,
    userStatus: status,
    userDiscriminator,
    profileVersion,
    guildName,
    ownerId,
    sharedGuildsMap,
    permissionsMap,
    friendsStatus,
    dmFriends = [],
    guilds,
    mediaWorkerUrl,
    maxAvatarSize,
    maxAttachmentSize,
    rtcWsUrl,
    wsUrl
  } = data;

  initialState = {
    user: {
      userId,
      nickname: nickName,
      status,
      discriminator: userDiscriminator,
      profileVersion,
      maskedEmail: getMaskedEmail(email),
      email,
      maxAvatarSize
    },
    ownerId,
    permissionsMap,
    guilds,
    sharedGuildsMap,
    mediaWorkerUrl,
    maxAvatarSize,
    maxAttachmentSize,
    wsUrl,
    rtcWsUrl
  };

  setSocketClient(wsUrl);
  guildCache.currentGuildName = guildName;
  initialiseChannelDrag();
  appState.initialiseState(initialState);
  friendsCache.initialiseFriends(friendsStatus);
  updateDmsList(dmFriends);
  setUploadSize(initialState.maxAvatarSize, initialState.maxAttachmentSize);
  updateGuilds(guilds);
  addKeybinds();
}

function initializeElements(): void {
  createChatScrollButton();
  chatContainer.addEventListener("scroll", handleScroll);
  initialiseChatInput();
  ReadenMessagesManager.initialiseReadUi();
  closeReplyMenu();
  adjustHeight();
  FileHandler.setDropHandler();
  FileHandler.resetFileInput();

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

  getId(ELEMENT_IDS.tbShowMembers)?.addEventListener(
    "click",
    handleMembersClick
  );
  getId(ELEMENT_IDS.tbCall)?.addEventListener("click", audioCall);
  getId(ELEMENT_IDS.tbVideoCall)?.addEventListener("click", videoCall);
  getId(ELEMENT_IDS.tbPin)?.addEventListener("click", togglePin);
}

function initializeSettings(): void {
  if (appState.currentUserId) {
    updateSelfProfile(appState.currentUserId, appState.currentUserId);
  }
  const isCookieUsersOpen = loadBooleanCookie("isUsersOpen");
  setTimeout(() => setUsersList(isCookieUsersOpen, true), 0);
  disableElement(ELEMENT_IDS.loadingScreen);
}

function initializeListeners(): void {
  getId(ELEMENT_IDS.globalSearchInput)?.addEventListener("click", () =>
    openSearchPop()
  );
  guildContainer.addEventListener("click", handleGuildClick);

  const avatarWrapper = getId(ELEMENT_IDS.avatarWrapper) as HTMLElement;
  avatarWrapper.addEventListener("click", () => userStatus?.showStatusPanel());

  addContextListeners();
  addChatMentionListeners();
}

function handleGuildClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.id === "guild-container" || target.id === "guild-name")
  ) {
    toggleDropdown();
  }
}

function initializeGuild(): void {
  initialiseMe();

  if (userList) {
    disableElement(userList);
  }

  const { isValid, initialGuildId, initialChannelId, initialFriendId } =
    router.validateRoute() as {
      isValid: boolean;
      initialGuildId?: string;
      initialChannelId?: string;
      initialFriendId?: string;
    };

  if (initialState.guilds?.length > 0) {
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
    setTimeout(() => openDm(initialFriendId), 0);
  }

  if (currentGuildId) {
    apiClient.send(EventType.GET_GUILD_UNREAD_COUNTS, {
      guildId: currentGuildId
    });
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
  if (!channelId) return;

  const channelExists = cacheInterface.doesChannelExists(guildId, channelId);
  const isVoiceChannel = cacheInterface.isVoiceChannel(guildId, channelId);

  if (!channelExists || isVoiceChannel) {
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

export function readGuildMessages(guildId: string): void {
  if (!guildId) return;
  apiClient.send(EventType.READ_GUILD, { guildId });
}

export function readCurrentMessages(channelId: string): void {
  if (!channelId) return;
  apiClient.send(EventType.READ_CHANNEL, { channelId });
  newMessagesBar.style.display = "none";
}

function initialiseMe(): void {
  if (!isOnMePage) return;
  enableElement(ELEMENT_IDS.dmsTitle);
  updateUsersActivities();
  loadMainToolbar();
}

export function openDm(friendId: string): void {
  if (!friendId) {
    console.error("Invalid friendId provided to openDm");
    return;
  }

  const wasOnDm = isOnDm;
  setIsOnDm(true);
  friendsCache.currentDmId = friendId;

  setTimeout(() => activateDmContainer(friendId), 100);

  unselectFriendContainer();
  router.switchToDm(friendId);

  if (!friendsCache.userExistsDm(friendId)) {
    try {
      addDm(friendId);
    } catch (e) {
      if (e instanceof Error) printFriendMessage(e.message);
    }
  }

  loadApp(friendId);

  setTimeout(() => {
    if (wasOnDm) changeCurrentDm(friendId);
  }, 0);

  try {
    getHistoryFromOneChannel(friendId, true);
  } catch (e) {
    printFriendMessage(
      e instanceof Error ? e.message : "An unknown error occurred."
    );
  }
}

function applyMePageState(isChangingUrl: boolean): void {
  selectGuildList(ELEMENT_IDS.mainLogo);

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
    ELEMENT_IDS.hashSign,
    ELEMENT_IDS.dmProfileSignBubble,
    ELEMENT_IDS.dmProfileSign,
    ELEMENT_IDS.messageInputContainer,
    ELEMENT_IDS.channelContainer
  ].forEach(disableElement);

  friendContainerItem.style.color = "white";
  updateUsersActivities();
  setUsersList(false);

  if (userList) {
    disableElement(userList);
  }

  setUserListLine();

  const nowOnlineTitle = getId(ELEMENT_IDS.nowOnline);
  if (nowOnlineTitle) {
    nowOnlineTitle.style.fontWeight = "bolder";
  }

  if (isOnMePage) return;

  closeDropdown();
  setisOnMePage(true);
  setIsOnGuild(false);
  updateFriendMenu();
  disableElement(ELEMENT_IDS.scrollToBottom);
}

export function loadDmHome(isChangingUrl = true): void {
  selectGuildList(ELEMENT_IDS.mainLogo);

  if (isOnGuild && !isOnDm && lastDmId) {
    openDm(lastDmId);
    disableElement(ELEMENT_IDS.friendsContainer);
  } else {
    applyMePageState(isChangingUrl);
  }

  disableElement(ELEMENT_IDS.channelContainer);
  disableElement(chatContainer);
  setTimeout(() => disableElement(chatContainer), 0);

  enableElement(ELEMENT_IDS.friendContainerItem);
  setGuildNameText("");
  disableElement(ELEMENT_IDS.guildSettingsButton);
  disableElement(ELEMENT_IDS.channelInfo);
  enableElement(ELEMENT_IDS.globalSearchInput, false, true);
  enableElement(ELEMENT_IDS.friendsContainerItem);
  enableElement(ELEMENT_IDS.dmsTitle);
  enableElement(ELEMENT_IDS.dmContainerParent, false, true);

  if (!isMobile) {
    enableElement(ELEMENT_IDS.guildContainer, false, true);
  }

  disableElement(ELEMENT_IDS.searchMessagesRoot);
  handleResize();
}

export function changeCurrentGuild(): void {
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

function handleGuildView(isInitial?: boolean): void {
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

  disableElement(ELEMENT_IDS.dmsTitle);
  enableElement(ELEMENT_IDS.channelContainer, false, true);

  if (activityList) {
    disableElement(activityList);
  }

  handleMembersClick();
  disableElement(ELEMENT_IDS.dmContainerParent);
  disableElement(ELEMENT_IDS.friendContainerItem);
  enableElement(ELEMENT_IDS.guildSettingsButton);
  enableElement(ELEMENT_IDS.hashSign);
  enableElement(ELEMENT_IDS.channelInfo);
  setGuildNameText(guildCache.currentGuildName);
  disableElement(ELEMENT_IDS.globalSearchInput);
  disableElement(ELEMENT_IDS.dmProfileSignBubble);
  disableElement(ELEMENT_IDS.dmProfileSign);
  loadGuildToolbar();

  const oldState = getChatBarState();
  setChatBarState(oldState);
  chatInput.textContent = escapeHtml(oldState.rawContent) ?? "";
  channelInputStates[guildCache.currentChannelId] = getChatBarState();
  manuallyRenderEmojis(chatInput, oldState.rawContent);
}

function handleDmView(friendId: string): void {
  loadDmToolbar();
  setIsOnGuild(false);
  setIsOnDm(true);

  enableElement(ELEMENT_IDS.dmProfileSignBubble);
  enableElement(ELEMENT_IDS.dmProfileSign);
  enableElement(ELEMENT_IDS.guildContainer, false, true);
  disableElement(ELEMENT_IDS.guildSettingsButton);
  activateDmContainer(friendId);

  const friendNick = userManager.getUserNick(friendId);
  updatePlaceholderVisibility(translations.getDmPlaceHolder(friendNick));
  setChannelTitle(friendNick);
  disableElement(ELEMENT_IDS.hashSign);
  enableElement(ELEMENT_IDS.channelInfo);

  const dmProfSign = getId(ELEMENT_IDS.dmProfileSign) as HTMLImageElement;
  if (dmProfSign) {
    setProfilePic(dmProfSign, friendId);
    dmProfSign.dataset.cid = friendId;
  }

  const oldState = getChatBarState();
  setChatBarState(oldState);
  chatInput.textContent = oldState.rawContent ?? "";
  channelInputStates[friendId] = getChatBarState();

  updateDmFriendList(friendId, friendNick);
}

export function loadApp(friendId?: string, isInitial?: boolean): void {
  if (isChangingPage) return;

  isChangingPage = true;
  setisOnMePage(false);
  enableElement(ELEMENT_IDS.guildName);
  enableElement(ELEMENT_IDS.searchMessagesRoot);

  if (friendId) {
    handleDmView(friendId);
  } else {
    handleGuildView(isInitial);
  }

  disableElement(ELEMENT_IDS.channelInfoFriend);
  disableElement(ELEMENT_IDS.friendsContainer);
  disableElement(ELEMENT_IDS.userLine);

  enableElement(ELEMENT_IDS.channelInfoIndex);
  enableElement(ELEMENT_IDS.chatContainer, true);
  enableElement(ELEMENT_IDS.messageInputContainer, false, true);

  adjustHeight();
  handleResize();
  initializeVideoComponent();

  isChangingPage = false;
}

function changeCurrentDm(friendId: string): void {
  isChangingPage = true;
  setisOnMePage(false);
  setIsOnGuild(false);
  setIsOnDm(true);
  setReachedChannelEnd(false);

  const friendNick = userManager.getUserNick(friendId);
  if (!friendNick) {
    console.error(`User not found for friendId: ${friendId}`);
    isChangingPage = false;
    return;
  }

  setChannelTitle(friendNick);
  updatePlaceholderVisibility(translations.getDmPlaceHolder(friendNick));

  const dmProfSign = getId(ELEMENT_IDS.dmProfileSign) as HTMLImageElement;
  if (dmProfSign) {
    setProfilePic(dmProfSign, friendId);
    dmProfSign.dataset.cid = friendId;
  }

  updateDmFriendList(friendId, friendNick);
  isChangingPage = false;
}

export function initialiseApp(): void {
  setTimeout(() => apiClient.send(EventType.GET_INIT_DATA), 0);
}

window.onerror = (_message, source, lineno, colno, error) => {
  console.error(`Unhandled error at ${source}:${lineno}:${colno}`, error);
};

setTimeout(() => window.scrollTo(0, 0), 20);

initialiseApp();
