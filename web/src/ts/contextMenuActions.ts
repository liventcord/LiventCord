import { openDm, readCurrentMessages, readGuildMessages } from "./app.ts";
import { appState } from "./appState.ts";
import {
  createChannelsPop,
  drawProfilePop,
  drawProfilePopId
} from "./popups.ts";
import { showReplyMenu, appendMemberMentionToInput } from "./chatbar.ts";
import { userManager } from "./user.ts";
import { getManageableGuilds, currentGuildId, kickMember } from "./guild.ts";
import { createEl, getId } from "./utils.ts";
import { isOnMePage, isOnDm, isOnGuild, router } from "./router.ts";
import { addFriendId, friendsCache, removeFriend } from "./friends.ts";
import { permissionManager } from "./guildPermissions.ts";
import { translations } from "./translations.ts";
import { alertUser, askUser } from "./ui.ts";
import { cacheInterface, guildCache, pinnedMessagesCache } from "./cache.ts";
import { copyText } from "./tooltip.ts";
import { convertToEditUi, deleteMessage } from "./message.ts";
import {
  openMediaPanel,
  scrollToMessage,
  closeMediaPanel,
  goToMessage
} from "./chat.ts";
import {
  selectedPanelType,
  isMediaPanelTeleported,
  hasTeleportedOnce,
  handlePanelButtonClickExternal
} from "./panelHandler.ts";

import { createDeleteChannelPrompt, openSettings } from "./settingsui.ts";
import { changeChannel } from "./channels.ts";
import { apiClient, EventType } from "./api.ts";
import { isDeveloperMode } from "./settings.ts";
import { SettingType, UserInfo } from "./types/interfaces.ts";

export const contextList: { [key: string]: any } = {};
export const messageContextList: { [key: string]: any } = {};

type ItemOption = {
  label: string;
  action: CallableFunction;
};

type ItemOptions = {
  action: CallableFunction;
  subOptions?: ItemOption[];
  [key: string]: ItemOption | CallableFunction | ItemOption[] | undefined;
};

const ActionType = {
  COPY_ID: "COPY_ID",
  COPY_USER_ID: "COPY_USER_ID",
  INVITE_TO_GUILD: "INVITE_TO_GUILD",
  ADD_FRIEND: "ADD_FRIEND",
  BLOCK_USER: "BLOCK_USER",
  REMOVE_USER: "REMOVE_USER",
  KICK_MEMBER: "KICK_MEMBER",
  EDIT_GUILD_PROFILE: "EDIT_GUILD_PROFILE",
  MENTION_USER: "MENTION_USER"
};

const ChannelsActionType = {
  MARK_AS_READ: "MARK_AS_READ",
  COPY_LINK: "COPY_LINK",
  MUTE_CHANNEL: "MUTE_CHANNEL",
  NOTIFY_SETTINGS: "NOTIFY_SETTINGS",
  EDIT_CHANNEL: "EDIT_CHANNEL",
  DELETE_CHANNEL: "DELETE_CHANNEL"
};

const GuildActionType = {
  MARK_AS_READ: "MARK_AS_READ",
  INVITE_USERS: "INVITE_USERS",
  MUTE_GUILD: "MUTE_GUILD",
  NOTIFY_SETTINGS: "NOTIFY_SETTINGS",
  CREATE_CHANNEL: "CREATE_CHANNEL",
  COPY_GUILD_ID: "COPY_GUILD_ID"
};

const VoiceActionType = {
  OPEN_PROFILE: "OPEN_PROFILE",
  MENTION_USER: "MENTION_USER",
  MUTE_USER: "MUTE_USER",
  DEAFEN_USER: "DEAFEN_USER"
};

const MessagesActionType = {
  ADD_REACTION: "ADD_REACTION",
  EDIT_MESSAGE: "EDIT_MESSAGE",
  PIN_MESSAGE: "PIN_MESSAGE",
  UNPIN_MESSAGE: "UNPIN_MESSAGE",
  GO_TO_MESSAGE: "GO_TO_MESSAGE",
  REPLY: "REPLY",
  MARK_AS_UNREAD: "MARK_AS_UNREAD",
  DELETE_MESSAGE: "DELETE_MESSAGE",
  COPY_MESSAGE: "COPY_MESSAGE"
};

let contextMenu: HTMLElement | null;

function openReactionMenu(messageId: string) {
  alertUser("Not implemented: React menu for message ");
}

function openEditMessage(messageId: string) {
  const message = getId(messageId);
  if (!message) {
    return;
  }
  convertToEditUi(message);
  const editMessageButtonContainer = message.querySelector(
    ".edit-message-button-container"
  ) as HTMLElement;
  if (editMessageButtonContainer) {
    scrollToMessage(editMessageButtonContainer);
  }
}

export async function pinMessage(messageId: string) {
  await apiClient.send(EventType.PIN_MESSAGE, {
    guildId: currentGuildId,
    channelId: guildCache.currentChannelId,
    messageId
  });
}
export async function unpinMessage(messageId: string) {
  await apiClient.send(EventType.UNPIN_MESSAGE, {
    guildId: currentGuildId,
    channelId: guildCache.currentChannelId,
    messageId
  });
}

function markAsUnread(messageId: string) {
  alertUser("Not implemented: Marking message as unread ");
}
function editGuildProfile() {
  alertUser("Not implemented: editing guild profile ");
}
export function audioCall() {
  alertUser("Not implemented: audio call ");
}
export function videoCall() {
  alertUser("Not implemented: video call ");
}

function copyMessage(event: MouseEvent, messageId: string) {
  const messageText = getId(messageId)?.getAttribute("data-content");
  if (messageText) {
    copyText(event, messageText);
  }
}
function deleteMessagePrompt(messageId: string) {
  const acceptCallback = () => {
    deleteMessage(messageId);
  };
  askUser(
    translations.getContextTranslation("DELETE_MESSAGE"),
    translations.getTranslation("delete-message-prompt"),
    translations.getTranslation("ok"),
    acceptCallback,
    true
  );
}

function blockUser(userId: string) {
  alertUser("Not implemented: Blocking user ");
}

function muteChannel(channelId: string) {
  alertUser("Mute channel is not implemented!");
}
function muteGuild(guildId: string) {
  alertUser("Mute guild is not implemented!");
}
function showNotifyMenu(channelId: string) {
  alertUser("Notify menu is not implemented!");
}
function onEditChannel(channelId: string) {
  const foundChannel = cacheInterface.getChannel(currentGuildId, channelId);
  if (!foundChannel) {
    return;
  }
  changeChannel(foundChannel);
  // Open channel settings
  openSettings(SettingType.CHANNEL);
}
function muteUser(userId: string) {}
function deafenUser(userId: string) {}

export function togglePin() {
  handlePanelButtonClickExternal(
    "pins",
    {
      selectedPanelType,
      isMediaPanelTeleported,
      hasTeleportedOnce
    },
    {
      openMediaPanel,
      closeMediaPanel
    }
  );
}
function mentionUser(userId: string) {
  appendMemberMentionToInput(userId, true);
}

function inviteUser(userId: string, guildId: string) {
  alertUser("Invite user is not implemented!");
  if (!userId || !guildId) {
    return;
  }
  console.log("inviting user : ", userId, " to guild ", guildId);
  openDm(userId);
  //TODO: add invitation prompt to here
}

function copyChannelLink(
  guildId: string,
  channelId: string,
  event: MouseEvent
) {
  const content = router.constructAbsoluteAppPage(guildId, channelId);
  copyText(event, content);
}
export function copySelfName(event: MouseEvent) {
  if (!appState.currentUserId || !appState.currentDiscriminator) {
    return;
  }
  const text = `${appState.currentUserId}#${appState.currentDiscriminator}`;
  copyText(event, text);
}
export function copyId(id: string, event: MouseEvent) {
  if (!appState.currentUserId || !appState.currentDiscriminator) {
    return;
  }

  copyText(event, id);
}

export function appendToChannelContextList(channelId: string) {
  contextList[channelId] = createChannelsContext(channelId);
}

export function appendToMessageContextList(
  messageId: string,
  userId: string,
  isSystemMessage: boolean
) {
  messageContextList[messageId] = createMessageContext(
    messageId,
    userId,
    isSystemMessage
  );
}

export function editMessageOnContextList(
  oldId: string,
  newId: string,
  userId: string
) {
  if (messageContextList[oldId]) {
    delete messageContextList[oldId];
    messageContextList[newId] = createMessageContext(newId, userId, false);
  }
}

export function appendToProfileContextList(userData: UserInfo, userId: string) {
  if (!userData && userId) {
    userData = userManager.getUserInfo(userId);
  }

  if (userId && userData) {
    const newContext = createProfileContext(userData);

    if (!contextList[userId]) {
      contextList[userId] = newContext;
    } else {
      for (const key in newContext) {
        if (!(key in contextList[userId])) {
          contextList[userId][key] = newContext[key];
        }
      }
    }
  }
}

export function appendToGuildContextList(guildId: string) {
  contextList[guildId] = createGuildContext(guildId);
}

export function createUserContext(userId: string) {
  const context: { [key: string]: any } = {};

  context[VoiceActionType.OPEN_PROFILE] = {
    action: () => drawProfilePopId(userId)
  };

  ((context[VoiceActionType.MENTION_USER] = () => mentionUser(userId)),
    (context[VoiceActionType.MUTE_USER] = () => muteUser(userId)),
    (context[VoiceActionType.DEAFEN_USER] = () => deafenUser(userId)));

  if (userId === appState.currentUserId) {
    context[ActionType.EDIT_GUILD_PROFILE] = () => editGuildProfile();
  }

  if (isDeveloperMode()) {
    context[ActionType.COPY_ID] = (event: MouseEvent) => copyId(userId, event);
  }

  return context;
}

function createProfileContext(userData: UserInfo) {
  const userId = userData.userId;
  const context: { [key: string]: any } = {};

  context[VoiceActionType.OPEN_PROFILE] = {
    action: () => drawProfilePop(userData)
  };

  if (!isOnMePage) {
    context[ActionType.MENTION_USER] = {
      action: () => mentionUser(userId)
    };
  }

  if (userId === appState.currentUserId) {
    context[ActionType.EDIT_GUILD_PROFILE] = {
      action: () => editGuildProfile()
    };
  } else {
    context[ActionType.BLOCK_USER] = {
      action: () => blockUser(userId)
    };
    const guildSubOptions = getManageableGuilds();

    if (Array.isArray(guildSubOptions) && guildSubOptions.length > 0) {
      context[ActionType.INVITE_TO_GUILD] = {
        action: () => {},
        subOptions: guildSubOptions.map((subOption) => ({
          label: cacheInterface.getGuildName(subOption),
          action: () => inviteUser(userId, subOption)
        }))
      };
    }
    if (friendsCache.isFriend(userId)) {
      context[ActionType.REMOVE_USER] = {
        action: () => removeFriend(userId)
      };
    } else if (!friendsCache.hasRequestToFriend(userId)) {
      context[ActionType.ADD_FRIEND] = {
        action: () => addFriendId(userId)
      };
    }

    if (
      permissionManager.canKickMember() &&
      !cacheInterface.isGuildOwner(currentGuildId, userId)
    ) {
      context[ActionType.KICK_MEMBER] = {
        action: () => kickMember(userId)
      };
    }
  }

  if (isDeveloperMode()) {
    context[ActionType.COPY_USER_ID] = {
      action: (event: MouseEvent) => copyId(userId, event)
    };
  }

  return context;
}
export function triggerContextMenuById(targetElement: HTMLElement) {
  const rect = targetElement.getBoundingClientRect();
  const x = rect.left + window.scrollX;
  const y = rect.top + window.scrollY;

  const options =
    contextList[targetElement.id] || messageContextList[targetElement.id];
  if (options) {
    showContextMenu(x, y, options);
  }
}

export function addContextListeners() {
  document.addEventListener("contextmenu", function (event) {
    event.preventDefault();

    const target = event.target as HTMLElement;
    let options = null;

    const idEl = target.closest("[id]") as HTMLElement;
    if (idEl && contextList.hasOwnProperty(idEl.id)) {
      options = contextList[idEl.id];
    }

    if (!options) {
      const mEl = target.closest("[data-m_id]") as HTMLElement;
      if (mEl && messageContextList.hasOwnProperty(mEl.dataset.m_id!)) {
        options = messageContextList[mEl.dataset.m_id!];
      }
    }

    if (!options) {
      const cEl = target.closest("[data-cid]") as HTMLElement;
      if (cEl && contextList.hasOwnProperty(cEl.dataset.cid!)) {
        options = contextList[cEl.dataset.cid!];
      }
    }

    if (options) {
      showContextMenu(event.pageX, event.pageY, options);
    }
  });
}

document.addEventListener("click", function (event) {
  const target = event.target as HTMLElement;

  if (
    target.dataset.m_id &&
    messageContextList.hasOwnProperty(target.dataset.m_id)
  ) {
    const isMessageElement = target.classList.contains("message");
    if (isMessageElement) return;
    const messageId = target.dataset.m_id;
    const message = cacheInterface.getMessage(
      currentGuildId,
      guildCache.currentChannelId,
      messageId
    );
    const doesExist = pinnedMessagesCache.doesMessageExist(
      currentGuildId,
      guildCache.currentChannelId,
      messageId
    );

    const isPinned = message?.isPinned || doesExist;
    const oldContext = { ...messageContextList[messageId] };

    delete oldContext[MessagesActionType.PIN_MESSAGE];
    delete oldContext[MessagesActionType.UNPIN_MESSAGE];

    let goToMessageEntry = {};
    const pinContainer = getId("pin-container");

    if (pinContainer) {
      goToMessageEntry = {
        [MessagesActionType.GO_TO_MESSAGE]: {
          label: "Go to Message",
          action: () => goToMessage(messageId)
        }
      };
    }

    let pinOrUnpinEntry = {};
    if (!message?.isSystemMessage) {
      pinOrUnpinEntry = isPinned
        ? {
            [MessagesActionType.UNPIN_MESSAGE]: {
              label: "Unpin Message",
              action: () => unpinMessage(messageId)
            }
          }
        : {
            [MessagesActionType.PIN_MESSAGE]: {
              label: "Pin Message",
              action: () => pinMessage(messageId)
            }
          };
    }

    messageContextList[messageId] = {
      ...pinOrUnpinEntry,
      ...goToMessageEntry,
      ...oldContext
    };

    const options = messageContextList[messageId];
    if (options) {
      hideContextMenu();
      showContextMenu(event.pageX, event.pageY, options);
    }
  }

  if (
    target.classList &&
    !target.classList.contains("message") &&
    target.id &&
    messageContextList.hasOwnProperty(target.id)
  ) {
    const options = messageContextList[target.id];
    if (options) {
      hideContextMenu();
      showContextMenu(event.pageX, event.pageY, options);
    }
  }
});

function createGuildContext(guildId: string) {
  const context: { [key: string]: any } = {};
  context[GuildActionType.MARK_AS_READ] = {
    action: () => readGuildMessages(guildId)
  };

  //context[GuildActionType.INVITE_USERS] = {
  //  action: () => muteChannel(channelId)
  //};
  context[GuildActionType.MUTE_GUILD] = {
    action: () => muteGuild(guildId)
  };
  context[GuildActionType.NOTIFY_SETTINGS] = {
    action: () => showNotifyMenu(guildId)
  };
  if (permissionManager.canManageChannels()) {
    context[GuildActionType.CREATE_CHANNEL] = {
      action: () => createChannelsPop(guildId)
    };
  }

  if (isDeveloperMode()) {
    context[GuildActionType.COPY_GUILD_ID] = {
      action: (event: MouseEvent) => copyId(guildId, event)
    };
  }

  return context;
}

function createChannelsContext(channelId: string) {
  const context: { [key: string]: any } = {};
  context[ChannelsActionType.MARK_AS_READ] = {
    action: () => readCurrentMessages(channelId)
  };
  context[ChannelsActionType.COPY_LINK] = {
    action: (event: MouseEvent) =>
      copyChannelLink(currentGuildId, channelId, event)
  };
  context[ChannelsActionType.MUTE_CHANNEL] = {
    action: () => muteChannel(channelId)
  };
  context[ChannelsActionType.NOTIFY_SETTINGS] = {
    action: () => showNotifyMenu(channelId)
  };

  if (permissionManager.canManageChannels()) {
    context[ChannelsActionType.EDIT_CHANNEL] = {
      action: () => onEditChannel(channelId)
    };
    context[ChannelsActionType.DELETE_CHANNEL] = {
      action: () =>
        createDeleteChannelPrompt(
          currentGuildId,
          channelId,
          cacheInterface.getChannelName(currentGuildId, channelId)
        )
    };
  }

  if (isDeveloperMode()) {
    context[ActionType.COPY_ID] = {
      action: (event: MouseEvent) => copyId(channelId, event)
    };
  }

  return context;
}

function createMessageContext(
  messageId: string,
  userId: string,
  isSystemMessage: boolean
) {
  const context: { [key: string]: any } = {};

  context[MessagesActionType.ADD_REACTION] = {
    label: MessagesActionType.ADD_REACTION,
    action: () => openReactionMenu(messageId)
  };
  if (!isSystemMessage) {
    if (userId === appState.currentUserId) {
      context[MessagesActionType.EDIT_MESSAGE] = {
        label: MessagesActionType.EDIT_MESSAGE,
        action: () => openEditMessage(messageId)
      };
    }
    if (
      permissionManager.canManageMessages() ||
      (isOnDm && userId === appState.currentUserId)
    ) {
      const exist = pinnedMessagesCache.doesMessageExist(
        currentGuildId,
        guildCache.currentChannelId,
        messageId
      );

      if (exist) {
        context[MessagesActionType.UNPIN_MESSAGE] = {
          label: MessagesActionType.UNPIN_MESSAGE,
          action: () => unpinMessage(messageId)
        };
      } else {
        context[MessagesActionType.PIN_MESSAGE] = {
          label: MessagesActionType.PIN_MESSAGE,
          action: () => pinMessage(messageId)
        };
      }
    }
  }
  context[MessagesActionType.REPLY] = {
    label: MessagesActionType.REPLY,
    action: () => showReplyMenu(messageId, userId)
  };
  context[MessagesActionType.COPY_MESSAGE] = {
    label: MessagesActionType.COPY_MESSAGE,
    action: (event: MouseEvent) => copyMessage(event, messageId)
  };

  context[MessagesActionType.MARK_AS_UNREAD] = {
    label: MessagesActionType.MARK_AS_UNREAD,
    action: () => markAsUnread(messageId)
  };

  if (isOnDm) {
    context[MessagesActionType.DELETE_MESSAGE] = {
      label: MessagesActionType.DELETE_MESSAGE,
      action: () => deleteMessagePrompt(messageId)
    };
  } else if (isOnGuild && permissionManager.canManageMessages()) {
    context[MessagesActionType.DELETE_MESSAGE] = {
      label: MessagesActionType.DELETE_MESSAGE,
      action: () => deleteMessagePrompt(messageId)
    };
  }

  if (isDeveloperMode()) {
    context[ActionType.COPY_ID] = {
      action: (event: MouseEvent) => copyId(messageId, event)
    };
  }

  return context;
}

const dangerActions = new Set([
  MessagesActionType.DELETE_MESSAGE,
  ActionType.REMOVE_USER,
  ActionType.KICK_MEMBER,
  ChannelsActionType.DELETE_CHANNEL,
  VoiceActionType.DEAFEN_USER,
  VoiceActionType.MUTE_USER
]);

function createMenuItem(
  labelKey: string,
  itemOptions: ItemOptions
): HTMLElement {
  const shouldTranslate = labelKey in translations.contextTranslations;
  const translatedLabel = shouldTranslate
    ? translations.getContextTranslation(
        labelKey.toUpperCase().replace(/ /g, "_")
      )
    : labelKey;

  const li = createEl("li", { textContent: translatedLabel });

  if (dangerActions.has(labelKey)) {
    li.classList.add("context-item-danger");
  }

  li.addEventListener("click", function (event: Event) {
    event.stopPropagation();
    hideContextMenu();
    if (itemOptions.action) {
      itemOptions.action(event);
    }
  });

  if (itemOptions.subOptions) {
    const subUl = createEl("ul");
    itemOptions.subOptions.forEach((subOption: any) => {
      const subLi = createMenuItem(subOption.label, subOption);
      subUl.appendChild(subLi);
    });
    li.appendChild(subUl);
  }

  li.addEventListener("mouseenter", function () {
    const subMenu = li.querySelector("ul") as HTMLElement;
    if (subMenu) {
      subMenu.style.display = "block";
      subMenu.style.left = "100%";
      subMenu.style.right = "auto";
      const subRect = subMenu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      if (subRect.right > viewportWidth) {
        subMenu.style.left = "auto";
        subMenu.style.right = "100%";
      } else if (subRect.left < 0) {
        subMenu.style.left = "0";
        subMenu.style.right = "auto";
      }
    }
  });

  li.addEventListener("mouseleave", function () {
    const subMenu = li.querySelector("ul") as HTMLElement;
    if (subMenu) {
      subMenu.style.display = "none";
    }
  });

  return li;
}

function isItemOptions(item: any): item is ItemOptions {
  return item && typeof item.action === "function";
}

export function showContextMenu(x: number, y: number, options: ItemOptions) {
  hideContextMenu();
  const tempContextMenu = createEl("div", {
    id: "contextMenu",
    className: "context-menu"
  });
  const ul = createEl("ul");

  for (const key in options) {
    if (options.hasOwnProperty(key)) {
      const itemOptions = options[key];
      if (isItemOptions(itemOptions)) {
        const li = createMenuItem(key, itemOptions);
        ul.appendChild(li);
      }
    }
  }

  tempContextMenu.appendChild(ul);
  document.body.appendChild(tempContextMenu);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const menuWidth = tempContextMenu.offsetWidth;
  const menuHeight = tempContextMenu.offsetHeight;

  const left = Math.min(x, viewportWidth - menuWidth);
  const top = Math.min(y, viewportHeight - menuHeight);

  tempContextMenu.style.setProperty("--menu-left", `${left}px`);
  tempContextMenu.style.setProperty("--menu-top", `${top}px`);

  contextMenu = tempContextMenu;

  document.addEventListener("click", clickOutsideContextMenu);
}

function clickOutsideContextMenu(event: Event) {
  const target = event.target as HTMLElement | null;

  if (
    contextMenu &&
    target &&
    !contextMenu.contains(target) &&
    !contextList[target.id]
  ) {
    hideContextMenu();
  }
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
    document.removeEventListener("click", clickOutsideContextMenu);
  }
}
