import store from "../store.ts";
import { disableElement, getId, MINUS_INDEX, isMobile } from "./utils.ts";
import { apiClient, EventType } from "./api.ts";
import {
  getHistoryFromOneChannel,
  setLastSenderID,
  setReachedChannelEnd,
  clearLastDate,
  closeMediaPanel
} from "./chat.ts";
import { isUsersOpenGlobal, userList } from "./userList.ts";
import { closeReplyMenu, updatePlaceholderVisibility } from "./chatbar.ts";
import { joinVoiceChannel, currentGuildId, loadGuild } from "./guild.ts";
import { selectedChanColor, clamp } from "./ui.ts";
import { guildCache, cacheInterface, CachedChannel } from "./cache.ts";
import { isOnMePage, isOnDm, router } from "./router.ts";
import { Member } from "./user.ts";
import { closeSettings } from "./settingsui.ts";
import { loadDmHome } from "./app.ts";
import { createFireWorks } from "./extras.ts";
import { translations } from "./translations.ts";
import { hideCallContainer } from "./chatroom.ts";
import { VoiceUser } from "./socketEvents.ts";

const currentChannels: Channel[] = [];
const channelTitle = getId("channel-info") as HTMLElement;
const channelList = getId("channel-list") as HTMLElement;
export let currentChannelName: string;

export let currentVoiceChannelId: string;

export let currentVoiceChannelGuild: string;
export function setCurrentVoiceChannelId(val: string) {
  currentVoiceChannelId = val;
}
export function setCurrentVoiceChannelGuild(val: string) {
  currentVoiceChannelGuild = val;
}

export function setChannelTitle(channelTitleText: string) {
  if (!channelTitleText) {
    console.error("Channel title called with null title");
  }
  channelTitle.textContent = channelTitleText;
  currentChannelName = channelTitleText;
  updatePlaceholderVisibility(
    translations.getMessagePlaceholder(channelTitleText)
  );
}

let isKeyDown = false;
let currentChannelIndex = 0;

export function getChannels() {
  const rawChannels: CachedChannel[] =
    cacheInterface.getChannels(currentGuildId);

  if (rawChannels.length > 0) {
    useChannels(rawChannels);
  } else {
    apiClient.send(EventType.GET_CHANNELS, { guildId: currentGuildId });
  }
}

function useChannels(rawChannels: CachedChannel[]) {
  const channels: Channel[] = rawChannels
    .map((channelData) => {
      if (!channelData) {
        console.warn("Skipping undefined channelData");
        return null;
      }

      return new Channel({
        channelId: channelData.channelId,
        channelName: channelData.channelName,
        isTextChannel: channelData.isTextChannel || false,
        guildId: currentGuildId
      });
    })
    .filter((channel) => channel !== null);

  updateChannels(channels);
}

const currentSelectedChannels: { [guildId: string]: string } = {};

function selectChannel(guildId: string, channelId: string) {
  currentSelectedChannels[guildId] = channelId;
}

export function getSeletedChannel(guildId: string, rootChannel: string) {
  if (
    currentSelectedChannels[guildId] &&
    currentSelectedChannels[guildId] !== rootChannel
  ) {
    return currentSelectedChannels[guildId];
  }
  return rootChannel;
}

export function handleNewChannel(data: Channel) {
  const guildId = data.guildId;
  const isTextChannel = data.isTextChannel;

  if (guildId === currentGuildId) {
    addChannel(data);
  }
  if (isTextChannel) {
    changeChannel(data);
    router.switchToGuild(data.guildId, data.channelId);
  }
  cacheInterface.addChannel(guildId, data);
  createFireWorks();
}
function selectChannelElement(channelId: string) {
  const channelsUl = getChannelsUl();
  if (!channelsUl) {
    return;
  }
  const channel = channelsUl.querySelector(
    `#${CSS.escape(channelId)}`
  ) as HTMLElement;
  console.log(channel);
  if (!channel) {
    return;
  }
  channel.style.backgroundColor = selectedChanColor();
}
let hasChannelChangedOnce = false;
export async function changeChannel(newChannel?: ChannelData) {
  if (!newChannel) {
    return;
  }
  if (!newChannel.isTextChannel) {
    return;
  }
  hideCallContainer();
  console.log("Changed channel: ", newChannel);
  if (isOnMePage || isOnDm) {
    return;
  }
  const channelId = newChannel.channelId;
  const isTextChannel = newChannel.isTextChannel;

  if (
    channelId === guildCache.currentChannelId &&
    newChannel.guildId !== currentGuildId
  ) {
    return;
  }

  store.dispatch("selectChannel", {
    channelId: newChannel.channelId,
    isTextChannel: newChannel.isTextChannel
  });

  if (isTextChannel) {
    router.switchToGuild(currentGuildId, channelId);
  }
  const newChannelName = newChannel.channelName;
  setReachedChannelEnd(false);

  if (hasChannelChangedOnce) {
    closeMediaPanel();
  }
  hasChannelChangedOnce = true;

  if (isTextChannel) {
    guildCache.currentChannelId = channelId;

    selectChannel(currentGuildId, channelId);

    if (newChannelName) {
      currentChannelName = newChannelName;

      setChannelTitle(newChannelName);
    }

    setLastSenderID("");

    clearLastDate();
    selectChannelElement(channelId);
    getHistoryFromOneChannel(guildCache.currentChannelId);
    closeReplyMenu();
  } else {
    joinVoiceChannel(channelId, guildCache.currentGuildId);
  }
}
export function getChannelsUl() {
  const container = getId("channel-container");

  return container?.querySelector("#channelul") as HTMLElement;
}
//channels

function handleKeydown(event: KeyboardEvent) {
  const ALPHA_KEYS_MAX = 9;
  if (isKeyDown || isOnMePage) {
    return;
  }
  currentChannels.forEach((channel, index) => {
    const hotkey =
      index < ALPHA_KEYS_MAX
        ? (index + 1).toString()
        : index === ALPHA_KEYS_MAX
          ? "0"
          : null;
    if (hotkey && event.key === hotkey && event.altKey) {
      changeChannel(channel);
    }
  });
  if (event.altKey) {
    if (event.key === "ArrowUp") {
      moveChannel(MINUS_INDEX);
    } else if (event.key === "ArrowDown") {
      moveChannel(1);
    }
  }
  isKeyDown = true;
}

function removeChannelElement(channelId: string) {
  const existingChannelButton = getChannelsUl().querySelector(
    `li[id="${channelId}"]`
  );
  if (!existingChannelButton) {
    return;
  }
  existingChannelButton.remove();
}

export function createChannel(
  guildId: string,
  channelName: string,
  isTextChannel: boolean,
  isPrivate: boolean
) {
  if (typeof isPrivate !== "boolean") {
    isPrivate = false;
  }
  console.log("Sending request with guildId:", guildId);
  apiClient.send(EventType.CREATE_CHANNEL, {
    guildId,
    channelName,
    isTextChannel,
    isPrivate
  });
}

function resetKeydown() {
  isKeyDown = false;
}

function moveChannel(direction: number) {
  let newIndex = currentChannelIndex + direction;
  if (newIndex < 0) {
    newIndex = currentChannels.length - 1;
  } else if (newIndex >= currentChannels.length) {
    newIndex = 0;
  }
  changeChannel(currentChannels[newIndex]);
  currentChannelIndex = newIndex;
}

function removeChannelEventListeners() {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keyup", resetKeydown);
}

function addChannelEventListeners() {
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", resetKeydown);
}

export interface ChannelData {
  guildId: string;
  channelId: string;
  channelName?: string;
  isTextChannel?: boolean;
  lastReadDateTime?: Date | null;
  voiceMembers?: Member[];
}

export class Channel implements ChannelData {
  channelId!: string;
  channelName!: string;
  isTextChannel!: boolean;
  voiceUsers?: VoiceUser[];
  guildId!: string;
  lastReadDateTime!: Date | null;
  voiceMembers!: Member[];

  constructor({
    channelId,
    channelName = "",
    isTextChannel = false,
    lastReadDateTime = null,
    voiceMembers = []
  }: ChannelData) {
    if (!channelId) {
      console.error("Invalid channel data in constructor:", {
        channelId,
        channelName,
        isTextChannel
      });
      return;
    }
    this.channelId = channelId;
    this.channelName = channelName;
    this.isTextChannel = isTextChannel;
    this.lastReadDateTime = lastReadDateTime;
    this.voiceMembers = voiceMembers;
  }
}

function addChannel(channelData: Channel) {
  const channel = new Channel(channelData);
  store.dispatch("setChannel", channel);
  cacheInterface.addChannel(channel.guildId, channel);

  refreshChannelList([channel]);
}

function removeChannel(data: ChannelData) {
  const { guildId, channelId } = data;
  cacheInterface.removeChannel(guildId, channelId);

  const channelsArray = cacheInterface.getChannels(guildId);
  addChannelsOnState(channelsArray);
  removeChannelElement(channelId);

  if (guildCache.currentChannelId === channelId) {
    const firstChannel = channelsArray[0]?.channelId;
    if (firstChannel) {
      loadGuild(currentGuildId, firstChannel);
    }
  }
}

export function editChannelName(channelId: string, channelName: string) {
  store.dispatch("editChannel", {
    channelId,
    channelName
  });
  if (guildCache.currentChannelId === channelId) {
    setChannelTitle(channelName);
  }
}

function addChannelsOnState(channels: Channel[]) {
  store.dispatch("setChannels", channels);
}

export function updateChannels(channels: Channel[]) {
  console.log("Updating channels with:", channels);
  if (!isOnMePage) {
    disableElement("dm-container-parent");
  }

  if (Array.isArray(channels) && channels.every(isValidChannelData)) {
    addChannelsOnState(channels);
  } else {
    console.error("Invalid or malformed channels data:", channels);
  }
}
export function handleChannelDelete(data: ChannelData) {
  const guildId = data.guildId;
  const channelId = data.channelId;
  if (!guildId || !channelId) {
    return;
  }
  closeSettings();
  if (guildCache.currentChannelId === channelId) {
    const rootChannel = cacheInterface.getRootChannel(guildId);
    if (rootChannel) {
      changeChannel(rootChannel);
    } else {
      loadDmHome();
    }
  }
  removeChannel(data);
}

function refreshChannelList(channels: Channel[]) {
  removeChannelEventListeners();

  if (channels && channels.length > 1) {
    addChannelEventListeners();
  }
}

function isValidChannelData(channel: ChannelData) {
  return (
    channel &&
    channel.channelId &&
    channel.channelName &&
    channel.isTextChannel !== undefined
  );
}

let lastChannelRight = 0;
let lastUserListLeft = 0;

export function setWidths(newWidth: number) {
  if (document.hidden) return;
  const userInput = getId("user-input");
  const guildContainer = getId("guild-container");

  if (channelList) channelList.style.width = `${newWidth}px`;

  const callContainer = getId("call-container");

  if (channelList && userList && userInput) {
    const leftPadding = 10;
    const rightPadding = 20;

    const channelRect = channelList.getBoundingClientRect();
    const userListRect = userList.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    let channelRight = channelRect.right;
    let userListLeft = userListRect.left;

    if (channelRect.width === 0 || userListRect.width === 0) {
      channelRight = lastChannelRight;
      userListLeft = lastUserListLeft;
    } else {
      lastChannelRight = channelRight;
      lastUserListLeft = userListLeft;
    }

    const availableWidth = isUsersOpenGlobal
      ? userListLeft - channelRight
      : windowWidth - channelRight;

    userInput.style.width = `${availableWidth - leftPadding - rightPadding}px`;
    if (!isMobile) userInput.style.left = `${channelRight + leftPadding}px`;

    if (callContainer) {
      callContainer.style.right = "0px";
      callContainer.style.width = `${availableWidth + 240}px`;
    }
  }

  const infoContainer = getId("channel-info-container-for-friend");
  if (infoContainer)
    infoContainer.style.paddingLeft = isMobile ? "40px" : `${newWidth + 15}px`;

  if (guildContainer) guildContainer.style.width = `${newWidth + 167}px`;

  const soundPanel = getId("sound-panel");
  if (soundPanel) soundPanel.style.width = `${newWidth + 165}px`;
}

export function updateChannelsWidth(e: MouseEvent) {
  let isDragging = true;
  const startX = e.clientX;
  const computedStyle = channelList
    ? window.getComputedStyle(channelList)
    : null;
  const startWidth = computedStyle ? parseInt(computedStyle.width, 10) : 150;

  document.body.style.userSelect = "none";

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) {
      return;
    }

    let newWidth = startWidth + (e.clientX - startX);
    newWidth = clamp(newWidth);
    setWidths(newWidth);
  };

  const onMouseUp = () => {
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}
