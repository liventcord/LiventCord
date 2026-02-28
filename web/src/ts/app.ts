import { handleResize, initialiseMobile, initialiseChannelDrag } from "./ui.ts";
import {
  createChatScrollButton,
  handleScroll,
  addChatMentionListeners
} from "./chat.ts";
import {
  initialiseChatInput,
  closeReplyMenu,
  adjustHeight,
  ReadenMessagesManager,
  chatContainer
} from "./chatbar.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import {
  updateGuilds,
  addKeybinds,
  currentGuildId,
  guildContainer,
  createGuildContextLists,
  fetchMembers
} from "./guild.ts";
import {
  updateDmsList,
  initializeFriends,
  friendContainerItem
} from "./friendui.ts";
import { initializeProfile } from "./user.ts";
import {
  addContextListeners,
  audioCall,
  togglePin,
  videoCall
} from "./contextMenuActions.ts";
import { apiClient, EventType } from "./api.ts";
import { userList, setUsersList } from "./userList.ts";
import {
  getId,
  getMaskedEmail,
  disableElement,
  loadBooleanCookie,
  isMobile
} from "./utils.ts";
import { updateSelfProfile, setUploadSize } from "./avatar.ts";
import { friendsCache } from "./friends.ts";
import { router } from "./router.ts";
import { initialiseAudio } from "./audio.ts";
import { setSocketClient } from "./socketEvents.ts";
import { initializeUserStatus, userStatus } from "./status.ts";
import { appState, InitialState, InitialStateData } from "./appState.ts";
import { FileHandler } from "./fileHandler.ts";
import { toggleDropdown } from "./guildPop.ts";
import { initializeEmojis } from "./emoji.ts";
import { initializeCookies } from "./settings.ts";
import {
  ELEMENT_IDS,
  initialiseMe,
  loadDmHome,
  openDm,
  handleChannelLoading,
  processGuilds
} from "./appUI.ts";
import { Channel } from "./types/interfaces.ts";

export let isDomLoaded = false;
export let initialState: InitialState;

/** Initialises the DOM-dependent parts of the app. Called once the page is ready. */
export function initializeApp(): void {
  initializeUserStatus();
  window.scrollTo(0, 0);
  initializeElements();
  initializeSettings();
  initializeListeners();
  initializeGuild();
  initializeProfile();
  initialiseAudio();
  initializeCookies();
  initializeFriends();
  initializeEmojis();

  if (isMobile) {
    initialiseMobile();
  }

  handleResize();
  isDomLoaded = true;
}

/**
 * Bootstraps the application with data from the server (user info, guilds,
 * friends, etc.). Called once the initial-data WebSocket event is received.
 */
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
    mediaApiUrl,
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
    mediaApiUrl,
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

// ---------------------------------------------------------------------------
// Private initialisation helpers
// ---------------------------------------------------------------------------

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

  getId(ELEMENT_IDS.tbShowMembers)?.addEventListener("click", () => {
    import("./ui.ts").then(({ handleMembersClick }) => handleMembersClick());
  });
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
    console.log("search input clicked!")
  );

  guildContainer.addEventListener("click", handleGuildClick);

  const avatarWrapper = getId(ELEMENT_IDS.avatarWrapper) as HTMLElement;
  avatarWrapper?.addEventListener("click", () => userStatus?.showStatusPanel());

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
  createGuildContextLists();

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
    processGuilds(
      initialGuildId,
      initialState.guilds as {
        guildId: string;
        rootChannel: string;
        guildChannels: Channel[];
      }[]
    );
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

/** Sends the initial data request to the server to start the app. */
export function initialiseApp(): void {
  setTimeout(() => apiClient.send(EventType.GET_INIT_DATA), 0);
}
window.onerror = (_message, source, lineno, colno, error) => {
  console.error(`Unhandled error at ${source}:${lineno}:${colno}`, error);
};

setTimeout(() => window.scrollTo(0, 0), 20);

initialiseApp();
