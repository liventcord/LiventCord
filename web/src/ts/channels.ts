import store from "../store.ts";
import { apiClient, EventType } from "./api.ts";
import {
  constructAppPage,
  disableElement,
  getId,
  createEl,
  MINUS_INDEX
} from "./utils.ts";
import {
  getHistoryFromOneChannel,
  setLastSenderID,
  setReachedChannelEnd,
  clearLastDate
} from "./chat.ts";
import { translations } from "./translations.ts";
import { closeReplyMenu, chatInput } from "./chatbar.ts";
import { joinVoiceChannel, currentGuildId, loadGuild } from "./guild.ts";
import { muteHtml, inviteVoiceHtml } from "./ui.ts";
import { createUserContext } from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { guildCache, cacheInterface, CachedChannel } from "./cache.ts";
import { isOnMe, isOnDm } from "./router.ts";
import { Member, userManager } from "./user.ts";
import { closeSettings } from "./settingsui.ts";
import { CreateChannelData } from "./socketEvents.ts";
import { loadDmHome } from "./app.ts";
import { createFireWorks } from "./extras.ts";

export const currentChannels: Channel[] = [];
const channelTitle = getId("channel-info") as HTMLElement;
const channelList = getId("channel-list") as HTMLElement;
export const channelsUl = channelList.querySelector("ul") as HTMLElement;
export let currentChannelName: string;
const CHANNEL_HOVER_DELAY = 50;

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

      setTimeout(() => {
        console.log("Cached channels: ", guildCache.guilds.channels);
      }, 800);
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

export function getRootChannel(guildId: string, rootChannel: string) {
  if (
    currentSelectedChannels[guildId] &&
    currentSelectedChannels[guildId] !== rootChannel
  ) {
    return currentSelectedChannels[guildId];
  }
  return rootChannel;
}

export function handleNewChannel(data: any) {
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

export async function changeChannel(newChannel?: ChannelData) {
  if (!newChannel) return;
  if (!newChannel.isTextChannel) return;
  console.log("Changed channel: ", newChannel);
  if (isOnMe || isOnDm) {
    return;
  }
  const channelId = newChannel.channelId;
  const isTextChannel = newChannel.isTextChannel;
  const url = constructAppPage(currentGuildId, channelId);
  if (url !== window.location.pathname && isTextChannel) {
    window.history.pushState(null, "", url);
  }
  const newChannelName = newChannel.channelName;
  setReachedChannelEnd(false);

  if (isTextChannel) {
    guildCache.currentChannelId = channelId;

    selectChannel(currentGuildId, channelId);

    if (newChannelName) {
      currentChannelName = newChannelName;
      chatInput.placeholder =
        translations.getMessagePlaceholder(newChannelName);
      setChannelTitle(newChannelName);
    }

    setLastSenderID("");

    clearLastDate();
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
//channels
function setCurrentChannel(channelId: string) {
  currentChannels.forEach((channel) => {
    const channelButton = channelsUl.querySelector(
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
  if (isKeyDown || isOnMe) return;
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

export function editChannelElement(channelId: string, newChannelName: string) {
  const existingChannelButton = channelsUl.querySelector(
    `li[id="${channelId}"]`
  ) as HTMLElement;
  console.log(existingChannelButton);
  if (!existingChannelButton) {
    return;
  }
  const channelSpan = existingChannelButton.querySelector(".channelSpan");
  if (channelSpan) channelSpan.textContent = newChannelName;
}
function removeChannelElement(channelId: string) {
  const existingChannelButton = channelsUl.querySelector(
    `li[id="${channelId}"]`
  );
  if (!existingChannelButton) {
    return;
  }
  existingChannelButton.remove();
}

function isChannelExist(channelId: string) {
  const existingChannelButton = channelsUl.querySelector(
    `li[id="${channelId}"]`
  );
  return existingChannelButton !== null;
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

function createChannelElement(channel: Channel) {
  if (isValidChannelData(channel)) {
    new Channel(channel);
  } else {
    console.error("Invalid channel data:", channel);
  }
}

function addChannel(channelData: ChannelData) {
  const channel = new Channel(channelData);

  console.warn(typeof channel, channel);

  store.dispatch("setChannel", {
    channel
  });
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
    if (firstChannel) loadGuild(currentGuildId, firstChannel);
  }
}

function editChannel(data: CreateChannelData) {
  const { guildId } = data;
  cacheInterface.editChannel(guildId, data);
  addChannelsOnState(cacheInterface.getChannels(guildId));
}

function addChannelsOnState(channels: Channel[]) {
  store.dispatch("setChannels", {
    channels
  });
}

export function updateChannels(channels: Channel[]) {
  console.log("Updating channels with:", channels);
  channelsUl.innerHTML = "";
  if (!isOnMe) disableElement("dm-container-parent");

  if (Array.isArray(channels) && channels.every(isValidChannelData)) {
    addChannelsOnState(channels);
  } else {
    console.error("Invalid or malformed channels data:", channels);
  }
}
export function handleChannelDelete(data: ChannelData) {
  const guildId = data.guildId;
  const channelId = data.channelId;
  if (!guildId || !channelId) return;
  if (guildCache.currentChannelId === channelId) {
    const rootChannel = cacheInterface.getRootChannel(guildId);
    closeSettings();
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
  (Array.isArray(channels) ? channels : [channels]).forEach((channel) => {
    if (isValidChannelData(channel)) {
      createChannelElement(channel);
    } else {
      console.error("Invalid channel data in list:", channel);
    }
  });
  if (currentChannels && currentChannels.length > 1) {
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
  }) as HTMLImageElement;
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
