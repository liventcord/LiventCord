import {
  loadMainToolbar,
  handleResize,
  loadGuildToolbar,
  loadDmToolbar,
  handleMembersClick
} from "./ui.ts";
import { getHistoryFromOneChannel, setReachedChannelEnd } from "./chat.ts";
import {
  chatInput,
  adjustHeight, chatContainer,
  updatePlaceholderVisibility,
  setChatBarState,
  getChatBarState,
  manuallyRenderEmojis
} from "./chatbar.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import {
  loadGuild,
  selectGuildList,
  fetchMembers,
  refreshInviteId,
  currentGuildId,
  setGuildNameText
} from "./guild.ts";
import {
  disableDmContainers,
  friendContainerItem,
  activateDmContainer,
  updateFriendMenu,
  unselectFriendContainer,
  updateUsersActivities
} from "./friendui.ts";
import { userManager } from "./user.ts";
import {
  getChannels,
  currentChannelName,
  changeChannel,
  setChannelTitle,
  updateChannels
} from "./channels.ts";
import {
  userList,
  activityList,
  setUserListLine,
  setUsersList,
  updateDmFriendList
} from "./userList.ts";
import {
  getId,
  enableElement,
  disableElement,
  isMobile,
  escapeHtml
} from "./utils.ts";
import { setProfilePic } from "./avatar.ts";
import { addDm, friendsCache } from "./friends.ts";
import {
  isOnMePage,
  router,
  isOnDm,
  isOnGuild,
  setisOnMePage,
  setIsOnDm,
  setIsOnGuild
} from "./router.ts";
import { translations } from "./translations.ts";
import { initializeVideoComponent } from "./chatroom.ts";
import { Channel, ChatBarState } from "./types/interfaces.ts";
import { closeDropdown, hideGuildSettingsDropdown } from "./guildPop.ts";
import { friendsContainerInstance } from "../components/FriendsContainer.vue";

export const ELEMENT_IDS = {
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


export let isChangingPage = false;
const channelInputStates: { [id: string]: ChatBarState } = {};
let lastDmId: string = "";

/**
 * Handles loading the correct channel when entering a guild.
 * Falls back to the root channel when the requested channel does not exist
 * or is a voice channel.
 */
export function handleChannelLoading(
  guildId: string,
  channelId?: string
): void {
  if (!channelId) return;

  const channelExists = cacheInterface.doesChannelExists(guildId, channelId);
  const isVoiceChannel = cacheInterface.isVoiceChannel(guildId, channelId);

  if (!channelExists || isVoiceChannel) {
    loadRootChannel(guildId);
    return;
  }

  const channel = cacheInterface.getChannel(guildId, channelId);
  if (channel) {
    changeChannel(channel);
    loadGuild(guildId, channel.channelId, "", true);
    return;
  }

  loadRootChannel(guildId);
}

function loadRootChannel(guildId: string): void {
  const rootChannel = cacheInterface.getRootChannelData(guildId);
  if (rootChannel) {
    changeChannel(rootChannel);
    loadGuild(guildId, rootChannel.channelId, "", true);
  }
}

/**
 * Populates the guild cache for each guild and triggers channel updates
 * for the currently active guild.
 */
export function processGuilds(
  initialGuildId: string | undefined,
  guilds: { guildId: string; rootChannel: string; guildChannels: Channel[] }[]
): void {
  guilds.forEach((data) => {
    data.guildChannels.forEach((channel) => {
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

/** Initialises the "Me" friends/DMs home screen on first load. */
export function initialiseMe(): void {
  if (!isOnMePage) return;
  enableElement(ELEMENT_IDS.dmsTitle);
  updateUsersActivities();
  loadMainToolbar();
}

/**
 * Navigates to the DM home page. If the user was previously on a guild and a
 * last-DM exists, reopens that DM directly instead.
 */
export function loadDmHome(isChangingUrl = true): void {
  selectGuildList(ELEMENT_IDS.mainLogo);

  if (isOnGuild && !isOnDm && lastDmId) {
    openDm(lastDmId);
    disableElement(ELEMENT_IDS.friendsContainer);
    disableElement(ELEMENT_IDS.channelContainer);
  } else {
    applyMePageState(isChangingUrl);
    disableElement(ELEMENT_IDS.channelContainer);
    disableElement(chatContainer);
    setTimeout(() => disableElement(chatContainer), 0);
  }

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
      if (e instanceof Error)
        friendsContainerInstance?.printFriendMessage(e.message);
    }
  }

  loadApp(friendId);

  setTimeout(() => {
    if (wasOnDm) changeCurrentDm(friendId);
  }, 0);

  try {
    getHistoryFromOneChannel(friendId, true);
  } catch (e) {
    friendsContainerInstance?.printFriendMessage(
      e instanceof Error ? e.message : "An unknown error occurred."
    );
  }
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
