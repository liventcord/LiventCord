import store from "../store.ts";
import {
  disableElement,
  getId,
  createEl,
  MINUS_INDEX,
  isMobile
} from "./utils.ts";
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
import { muteHtml, inviteVoiceHtml, selectedChanColor, clamp } from "./ui.ts";
import { createUserContext } from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { guildCache, cacheInterface, CachedChannel } from "./cache.ts";
import { isOnMePage, isOnDm, router } from "./router.ts";
import { Member, userManager } from "./user.ts";
import { closeSettings } from "./settingsui.ts";
import { loadDmHome } from "./app.ts";
import { createFireWorks } from "./extras.ts";
import { translations } from "./translations.ts";

export const currentChannels: Channel[] = [];
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
  updatePlaceholderVisibility(
    translations.getMessagePlaceholder(channelTitleText)
  );
}

let isKeyDown = false;
let currentChannelIndex = 0;
export function getChannels() {
  console.log("Getting channels...");
  if (guildCache.currentChannelId) {
    const rawChannels: CachedChannel[] =
      cacheInterface.getChannels(currentGuildId);

    if (rawChannels.length > 0) {
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
      console.log("Using cached channels: ", channels);
    } else {
      console.warn("Channel cache is empty. fetching channels...");
      apiClient.send(EventType.GET_CHANNELS, { guildId: currentGuildId });
    }
  } else {
    console.warn("Current channel id is null!");
  }
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
  console.log("Changed channel: ", newChannel);
  if (isOnMePage || isOnDm) {
    return;
  }

  store.dispatch("selectChannel", {
    channelId: newChannel.channelId,
    isTextChannel: newChannel.isTextChannel
  });

  const channelId = newChannel.channelId;
  const isTextChannel = newChannel.isTextChannel;
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
    joinVoiceChannel(channelId);
  }
  console.log(currentChannels);
  if (!currentChannels) {
    return;
  }

  setCurrentChannel(channelId);
}
export function getChannelsUl() {
  const container = getId("channel-container");

  return container?.querySelector("#channelul") as HTMLElement;
}
//channels
function setCurrentChannel(channelId: string) {
  currentChannels.forEach((channel) => {
    const channelButton = getChannelsUl().querySelector(
      `li[id="${channel.channelId}"]`
    ) as HTMLElement;

    if (!channel.isTextChannel) {
      //voice channel
      const voiceUsersInChannel =
        cacheInterface.getVoiceChannelMembers(channelId);
      if (voiceUsersInChannel) {
        let allUsersContainer = channelButton.querySelector(
          ".channel-users-container"
        ) as HTMLElement;
        if (!allUsersContainer) {
          allUsersContainer = createEl("div", {
            className: "channel-users-container"
          });
        }
        channelButton.style.width = "100%";
        voiceUsersInChannel.forEach((userId: string, index: number) => {
          drawVoiceChannelUser(
            index,
            userId,
            channelId,
            channelButton,
            allUsersContainer
          );
        });
      }
    }
  });
}

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

  console.warn(typeof channel, channel);

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

// voice
function drawVoiceChannelUser(
  index: number,
  userId: string,
  channelId: string,
  channelButton: HTMLElement,
  allUsersContainer: HTMLElement
) {
  const userName = userManager.getUserNick(userId);
  const userContainer = createEl("li", {
    className: "channel-button",
    id: userId
  });
  userContainer.addEventListener("mouseover", function (event: Event) {
    //mouseHoverChannelButton(userContainer, isTextChannel,channelId);
  });
  userContainer.addEventListener("mouseleave", function (event: Event) {
    //mouseLeaveChannelButton(userContainer, isTextChannel,channelId);
  });

  createUserContext(userId);

  userContainer.id = `user-${userId}`;
  const userElement = createEl("img", {
    style:
      "width: 25px; height: 25px; border-radius: 50px; position:fixed; margin-right: 170px;"
  });
  setProfilePic(userElement, userId);
  userContainer.appendChild(userElement);
  userContainer.style.marginTop = index === 0 ? "30px" : "10px";
  userContainer.style.marginLeft = "-220px";
  userContainer.style.width = "90%";
  userContainer.style.justifyContent = "center";
  userContainer.style.alignItems = "center";

  const contentWrapper = createEl("div", { className: "content-wrapper" });
  const userSpan = createEl("span", {
    className: "channelSpan",
    textContent: userName,
    style: "position: fixed;"
  });
  userSpan.style.color = "rgb(128, 132, 142)";
  userSpan.style.border = "none";
  userSpan.style.width = "auto";

  const muteSpan = createEl("span", { innerHTML: muteHtml });
  const inviteVoiceSpan = createEl("span", { innerHTML: inviteVoiceHtml });
  contentWrapper.appendChild(muteSpan);
  contentWrapper.appendChild(inviteVoiceSpan);
  contentWrapper.style.marginRight = "-115px";
  userContainer.appendChild(userSpan);
  userContainer.appendChild(contentWrapper);
  allUsersContainer.appendChild(userContainer);
  channelButton.appendChild(allUsersContainer);
}

export function setWidths(newWidth: number) {
  const userInput = getId("user-input");
  const guildContainer = getId("guild-container");

  if (channelList) {
    channelList.style.width = `${newWidth}px`;
  }

  if (channelList && userList && userInput) {
    const leftPadding = 10;
    const rightPadding = 20;

    const channelRect = channelList.getBoundingClientRect();
    const availableWidth = isUsersOpenGlobal
      ? userList.getBoundingClientRect().left - channelRect.right
      : window.innerWidth - channelRect.right;

    userInput.style.width = `${availableWidth - leftPadding - rightPadding}px`;
    if (!isMobile)
      userInput.style.left = `${channelRect.right + leftPadding}px`;
  }
  const infoContainer = getId("channel-info-container-for-friend");
  if (infoContainer) {
    infoContainer.style.paddingLeft = isMobile ? "40px" : `${newWidth + 15}px`;
  }
  if (guildContainer) {
    guildContainer.style.width = `${newWidth + 167}px`;
  }
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
