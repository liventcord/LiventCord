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
import { closeReplyMenu, chatInput, chatContent } from "./chatbar.ts";
import { joinVoiceChannel, currentGuildId, loadGuild } from "./guild.ts";
import {
  selectedChanColor,
  hoveredChanColor,
  settingsHtml,
  inviteHtml,
  muteHtml,
  inviteVoiceHtml,
  voiceChanHtml,
  textChanHtml
} from "./ui.ts";
import {
  appendToChannelContextList,
  createUserContext
} from "./contextMenuActions.ts";
import { setProfilePic } from "./avatar.ts";
import { guildCache, cacheInterface, CachedChannel } from "./cache.ts";
import { isOnMe, isOnDm } from "./router.ts";
import { permissionManager } from "./guildPermissions.ts";
import { getUserNick, Member } from "./user.ts";
import { closeSettings, openChannelSettings } from "./settingsui.ts";
import { CreateChannelData } from "./socketEvents.ts";
import { loadDmHome } from "./app.ts";

export const channelTitle = getId("channel-info") as HTMLElement;
export const channelList = getId("channel-list") as HTMLElement;
export const channelsUl = channelList.querySelector("ul") as HTMLElement;
export let currentChannelName: string;
const CHANNEL_HOVER_DELAY = 50;

export let currentVoiceChannelId: string;
export let currentChannels: Channel[];

export let currentVoiceChannelGuild: string;
export function setCurrentVoiceChannelId(val: string) {
  currentVoiceChannelId = val;
}
export function setCurrentVoiceChannelGuild(val: string) {
  currentVoiceChannelGuild = val;
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

export async function changeChannel(newChannel?: ChannelData) {
  if (!newChannel) return;
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
      channelTitle.textContent = newChannelName;
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
    if (channelButton) {
      const isSelected = channel.channelId === channelId;
      if (isSelected) {
        mouseLeaveChannelButton(
          channelButton,
          channel.isTextChannel,
          channel.channelId
        );

        setTimeout(() => {
          mouseLeaveChannelButton(
            channelButton,
            channel.isTextChannel,
            channel.channelId
          );
        }, CHANNEL_HOVER_DELAY);
      } else {
        //unselected channels

        setTimeout(() => {
          mouseLeaveChannelButton(
            channelButton,
            channel.isTextChannel,
            channel.channelId
          );
        }, CHANNEL_HOVER_DELAY);
      }
    }
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
export function isChannelMatching(channelId: string, isTextChannel: boolean) {
  const currentChannel = isTextChannel
    ? guildCache.currentChannelId
    : currentVoiceChannelId;
  if (channelId === currentChannel) {
    return true;
  } else {
    //console.error("Match failed");
    return false;
  }
}

export function mouseHoverChannelButton(
  channelButton: HTMLElement,
  isTextChannel: boolean,
  channelId: string
) {
  if (!channelButton) {
    return;
  }
  const contentWrapper = channelButton.querySelector(
    ".content-wrapper"
  ) as HTMLElement;

  contentWrapper.style.display = "flex";
  if (isTextChannel) {
    const isMatch = isChannelMatching(channelId, isTextChannel);
    channelButton.style.backgroundColor = isMatch
      ? selectedChanColor
      : hoveredChanColor;
  } else {
    channelButton.style.backgroundColor = hoveredChanColor;
  }
  channelButton.style.color = "white";
}
export function hashChildElements(channelButton: HTMLElement) {
  return channelButton.querySelector(".channel-users-container") !== null;
}
export function mouseLeaveChannelButton(
  channelButton: HTMLElement,
  isTextChannel: boolean,
  channelId: string
) {
  if (!channelButton) {
    return;
  }
  const contentWrapper = channelButton.querySelector(
    ".content-wrapper"
  ) as HTMLElement;
  const channelSpan = channelButton.querySelector(
    ".channelSpan"
  ) as HTMLElement;

  if (channelSpan && !isTextChannel) {
    channelSpan.style.marginRight = hashChildElements(channelButton)
      ? "30px"
      : "0px";
  }
  if (contentWrapper) {
    if (!isTextChannel) {
      if (currentVoiceChannelId === channelId) {
        contentWrapper.style.display = "flex";
      } else {
        contentWrapper.style.display = "none";
      }
    } else if (guildCache.currentChannelId !== channelId) {
      contentWrapper.style.display = "none";
    }
  }
  if (isTextChannel) {
    channelButton.style.backgroundColor = isChannelMatching(
      channelId,
      isTextChannel
    )
      ? selectedChanColor
      : "transparent";
  } else {
    channelButton.style.backgroundColor = "transparent";
  }
  channelButton.style.color = isChannelMatching(channelId, isTextChannel)
    ? "white"
    : "rgb(148, 155, 164)";
}
export function handleKeydown(event: KeyboardEvent) {
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

export function editChannelElement(
  channelId: string,
  new_channel_name: string
) {
  const existingChannelButton = channelsUl.querySelector(
    `li[id="${channelId}"]`
  ) as HTMLElement;
  if (!existingChannelButton) {
    return;
  }
  const channelSpan = existingChannelButton.querySelector("channelSpan");
  if (channelSpan) channelSpan.textContent = new_channel_name;
}
export function removeChannelElement(channelId: string) {
  const existingChannelButton = channelsUl.querySelector(
    `li[id="${channelId}"]`
  );
  if (!existingChannelButton) {
    return;
  }
  existingChannelButton.remove();
}

export function isChannelExist(channelId: string) {
  const existingChannelButton = channelsUl.querySelector(
    `li[id="${channelId}"]`
  );
  return existingChannelButton !== null;
}
export function createChannel(
  channelName: string,
  isTextChannel: boolean,
  isPrivate: boolean
) {
  if (typeof isPrivate !== "boolean") {
    isPrivate = false;
  }
  console.log(channelName, isTextChannel, isPrivate);
  apiClient.send(EventType.CREATE_CHANNEL, {
    channelName,
    guildId: currentGuildId,
    isTextChannel,
    isPrivate
  });
}

export function createChannelButton(
  channelId: string,
  channelName: string,
  isTextChannel: boolean
) {
  const htmlToSet = isTextChannel ? textChanHtml : voiceChanHtml;
  const channelButton = createEl("li", {
    className: "channel-button",
    id: channelId
  });
  channelButton.style.marginLeft = "-80px";

  const hashtagSpan = createEl("span", {
    innerHTML: htmlToSet,
    marginLeft: "50px"
  });
  hashtagSpan.style.color = "rgb(128, 132, 142)";

  const channelSpan = createEl("span", {
    className: "channelSpan",
    textContent: channelName
  });
  channelSpan.style.marginRight = "30px";
  channelSpan.style.width = "100%";
  channelButton.style.width = "70%";

  channelButton.appendChild(hashtagSpan);
  channelButton.appendChild(channelSpan);

  return channelButton;
}
function onChannelSettings(event: Event, channel: Channel) {
  event.stopPropagation();
  console.log("Click to settings on:", channel);
  openChannelSettings();
}
function createContentWrapper(
  channel: Channel,
  channelName: string,
  isTextChannel: boolean
) {
  const contentWrapper = createEl("div", { className: "content-wrapper" });
  contentWrapper.style.display = "none";
  contentWrapper.style.marginRight = "100px";
  contentWrapper.style.marginTop = "4px";

  const settingsSpan = createEl("span", { innerHTML: settingsHtml });
  settingsSpan.addEventListener("click", (event: Event) =>
    onChannelSettings(event, channel)
  );

  if (permissionManager.canInvite()) {
    const inviteSpan = createEl("span", { innerHTML: inviteHtml });
    inviteSpan.addEventListener("click", () => {
      console.log("Click to invite on:", channelName);
    });
    contentWrapper.appendChild(inviteSpan);
  }

  contentWrapper.appendChild(settingsSpan);
  return contentWrapper;
}

export function addEventListeners(
  channelButton: HTMLElement,
  channelId: string,
  isTextChannel: boolean,
  channel: ChannelData
) {
  channelButton.addEventListener("mouseover", function (event: Event) {
    const target = event.target as HTMLElement;
    if (target && target.id === channelId) {
      mouseHoverChannelButton(channelButton, isTextChannel, channelId);
    }
  });

  channelButton.addEventListener("mouseleave", function (event: Event) {
    const target = event.target as HTMLElement;
    if (target && target.id === channelId) {
      mouseLeaveChannelButton(channelButton, isTextChannel, channelId);
    }
  });

  mouseLeaveChannelButton(channelButton, isTextChannel, channelId);

  setTimeout(() => {
    mouseLeaveChannelButton(channelButton, isTextChannel, channelId);
  }, CHANNEL_HOVER_DELAY);

  channelButton.addEventListener("click", function () {
    changeChannel(channel);
  });
}

export function handleChannelChangeOnLoad(
  channel: ChannelData,
  channelId: string
) {
  if (channelId === guildCache.currentChannelId) {
    changeChannel(channel);
  }
}

export function resetKeydown() {
  isKeyDown = false;
}

export function moveChannel(direction: number) {
  let newIndex = currentChannelIndex + direction;
  if (newIndex < 0) {
    newIndex = currentChannels.length - 1;
  } else if (newIndex >= currentChannels.length) {
    newIndex = 0;
  }
  changeChannel(currentChannels[newIndex]);
  currentChannelIndex = newIndex;
}

export function removeChannelEventListeners() {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keyup", resetKeydown);
}

export function addChannelEventListeners() {
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

  createElement() {
    if (isChannelExist(this.channelId)) return;

    const channelButton = createChannelButton(
      this.channelId,
      this.channelName,
      this.isTextChannel
    );
    const contentWrapper = createContentWrapper(
      this,
      this.channelName,
      this.isTextChannel
    );

    channelButton.appendChild(contentWrapper);
    appendToChannelContextList(this.channelId);
    channelsUl.appendChild(channelButton);

    addEventListeners(channelButton, this.channelId, this.isTextChannel, this);
    handleChannelChangeOnLoad(this, this.channelId);

    if (isChannelMatching(this.channelId, this.isTextChannel)) {
      mouseHoverChannelButton(
        channelButton,
        this.isTextChannel,
        this.channelId
      );
    }

    setTimeout(() => {
      mouseLeaveChannelButton(
        channelButton,
        this.isTextChannel,
        this.channelId
      );
    }, CHANNEL_HOVER_DELAY);
  }
}

export function createChannelElement(channel: Channel) {
  if (isValidChannelData(channel)) {
    new Channel(channel).createElement();
  } else {
    console.error("Invalid channel data:", channel);
  }
}

export function addChannel(channelData: ChannelData) {
  const channel = new Channel(channelData);

  console.warn(typeof channel, channel);

  if (Array.isArray(currentChannels)) {
    currentChannels.push(channel);
  } else {
    console.error("currentChannels is not an array.");
  }
  cacheInterface.addChannel(channel.guildId, channel);

  refreshChannelList([channel]);
}

export function removeChannel(data: ChannelData) {
  const { guildId, channelId } = data;
  cacheInterface.removeChannel(guildId, channelId);

  const channelsArray = cacheInterface.getChannels(guildId);
  currentChannels = channelsArray;
  removeChannelElement(channelId);

  if (guildCache.currentChannelId === channelId) {
    const firstChannel = channelsArray[0]?.channelId;
    if (firstChannel) loadGuild(currentGuildId, firstChannel);
  }
}

export function editChannel(data: CreateChannelData) {
  const { guildId } = data;
  cacheInterface.editChannel(guildId, data);

  currentChannels = cacheInterface.getChannels(guildId);
}
export function updateChannels(channels: Channel[]) {
  console.log("Updating channels with:", channels);
  channelsUl.innerHTML = "";
  if (!isOnMe) disableElement("dm-container-parent");

  if (Array.isArray(channels) && channels.every(isValidChannelData)) {
    refreshChannelList(channels);
    currentChannels = channels;
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

export function drawVoiceChannelUser(
  index: number,
  userId: string,
  channelId: string,
  channelButton: HTMLElement,
  allUsersContainer: HTMLElement
) {
  const userName = getUserNick(userId);
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
