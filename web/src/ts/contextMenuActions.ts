import { openDm, readCurrentMessages } from "./app.ts";
import { drawProfilePop, drawProfilePopId } from "./popups.ts";
import { showReplyMenu, chatInput } from "./chatbar.ts";
import {
  currentDiscriminator,
  currentUserId,
  currentUserNick,
  UserInfo,
  userManager
} from "./user.ts";
import { getManageableGuilds, currentGuildId } from "./guild.ts";
import { createEl, constructAbsoluteAppPage } from "./utils.ts";
import { isOnMe, isOnDm, isOnGuild } from "./router.ts";
import { addFriendId, friendsCache } from "./friends.ts";
import { permissionManager } from "./guildPermissions.ts";
import { translations } from "./translations.ts";
import { alertUser } from "./ui.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { apiClient, EventType } from "./api.ts";
import { copyText } from "./tooltip.ts";

const isDeveloperMode = true;
export const contextList: { [key: string]: any } = {};
export const messageContextList: { [key: string]: any } = {};

type ItemOption = {
  action: CallableFunction;
};

export type ItemOptions = {
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
  REPLY: "REPLY",
  MARK_AS_UNREAD: "MARK_AS_UNREAD",
  DELETE_MESSAGE: "DELETE_MESSAGE"
};

let contextMenu: HTMLElement | null;

export function openReactionMenu(messageId: string) {
  alertUser("Not implemented: React menu for message ");
}

export function openEditMessage(messageId: string) {
  alertUser("Not implemented: Editing message ");
}

export function pinMessage(messageId: string) {
  alertUser("Not implemented: Pinning message ");
}

export function markAsUnread(messageId: string) {
  alertUser("Not implemented: Marking message as unread ");
}
export function editGuildProfile() {
  alertUser("Not implemented: editing guild profile ");
}

export function deleteMessage(messageId: string) {
  console.log("Deleting message ", messageId);
  const data = {
    isDm: isOnDm,
    messageId,
    channelId: isOnGuild
      ? guildCache.currentChannelId
      : friendsCache.currentDmId,
    guildId: ""
  };
  if (isOnGuild) {
    data["guildId"] = currentGuildId;
  }
  const _eventType = isOnGuild
    ? EventType.DELETE_MESSAGE_GUILD
    : EventType.DELETE_MESSAGE_DM;
  apiClient.send(_eventType, data);
}

export function blockUser(userId: string) {
  alertUser("Not implemented: Blocking user ");
}

export function muteChannel(channelId: string) {
  alertUser("Mute channel is not implemented!");
}
export function showNotifyMenu(channelId: string) {
  alertUser("Notify menu is not implemented!");
}
export function onChangeChannel(channelId: string) {
  alertUser("Channel editing is not implemented!");
}
function muteUser(userId: string) {}
function deafenUser(userId: string) {}

export function togglePin() {
  console.log("Toggle pin!");
}
export function mentionUser(userId: string) {
  const userNick = userManager.getUserNick(userId);
  chatInput.value += `@${userNick}`;
}

export function inviteUser(userId: string, guildId: string) {
  if (!userId || !guildId) {
    return;
  }
  console.log("inviting user : ", userId, " to guild ", guildId);
  openDm(userId);
  //TODO: add invitation prompt to here
}

export function removeFriend(userId: string) {
  apiClient.send(EventType.REMOVE_FRIEND, { friendId: userId });
}

export function copyChannelLink(
  guildId: string,
  channelId: string,
  event: MouseEvent
) {
  const content = constructAbsoluteAppPage(guildId, channelId);
  copyText(event, content);
}
export function copySelfName(event: MouseEvent) {
  if (!currentUserNick || !currentDiscriminator) return;
  const text = `${currentUserNick}#${currentDiscriminator}`;
  copyText(event, text);
}
export function copyId(id: string, event: MouseEvent) {
  if (!currentUserNick || !currentDiscriminator) return;

  copyText(event, id);
}

export function deleteChannel(channelId: string, guildId: string) {
  const data = {
    guildId,
    channelId
  };
  apiClient.send(EventType.DELETE_CHANNEL, data);
}

export function appendToChannelContextList(channelId: string) {
  contextList[channelId] = createChannelsContext(channelId);
}

export function appendToMessageContextList(messageId: string, userId: string) {
  messageContextList[messageId] = createMessageContext(messageId, userId);
}
export function appendToProfileContextList(userData: UserInfo, userId: string) {
  if (!userData && userId) {
    userData = userManager.getUserInfo(userId);
  }
  if (userId && userData) {
    contextList[userId] = createProfileContext(userData);
  }
}

export function createUserContext(userId: string) {
  const context: { [key: string]: any } = {};

  context[VoiceActionType.OPEN_PROFILE] = {
    action: () => drawProfilePopId(userId)
  };

  (context[VoiceActionType.MENTION_USER] = () => mentionUser(userId)),
    (context[VoiceActionType.MUTE_USER] = () => muteUser(userId)),
    (context[VoiceActionType.DEAFEN_USER] = () => deafenUser(userId));

  if (userId === currentUserId) {
    context[ActionType.EDIT_GUILD_PROFILE] = () => editGuildProfile();
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_ID] = (event: MouseEvent) => copyId(userId, event);
  }

  return context;
}

export function createProfileContext(userData: UserInfo) {
  const userId = userData.userId;
  const context: { [key: string]: any } = {};

  context[VoiceActionType.OPEN_PROFILE] = {
    action: () => drawProfilePop(userData)
  };

  if (!isOnMe) {
    context[ActionType.MENTION_USER] = {
      action: () => mentionUser(userId)
    };
  }

  if (userId === currentUserId) {
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
  }

  if (isDeveloperMode) {
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
    const target = event.target as HTMLSelectElement;
    event.preventDefault();

    let options = null;

    if (target.id && contextList.hasOwnProperty(target.id)) {
      options = contextList[target.id];
    } else if (
      target.dataset.m_id &&
      messageContextList.hasOwnProperty(target.dataset.m_id)
    ) {
      options = messageContextList[target.dataset.m_id];
    } else if (
      target.dataset.cid &&
      contextList.hasOwnProperty(target.dataset.cid)
    ) {
      options = contextList[target.dataset.cid];
    }

    if (options) {
      showContextMenu(event.pageX, event.pageY, options);
    }
  });

  document.addEventListener("click", function (event) {
    const target = event.target as HTMLSelectElement;
    if (
      target.dataset.m_id &&
      messageContextList.hasOwnProperty(target.dataset.m_id)
    ) {
      const options = messageContextList[target.dataset.m_id];
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
}

export function createChannelsContext(channelId: string) {
  const context: { [key: string]: any } = {};
  context[ChannelsActionType.MARK_AS_READ] = {
    action: () => readCurrentMessages()
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
      action: () => onChangeChannel(channelId)
    };
    context[ChannelsActionType.DELETE_CHANNEL] = {
      action: () => deleteChannel(channelId, currentGuildId)
    };
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_ID] = {
      action: (event: MouseEvent) => copyId(channelId, event)
    };
  }

  return context;
}

export function createMessageContext(messageId: string, userId: string) {
  const context: { [key: string]: any } = {};

  context[MessagesActionType.ADD_REACTION] = {
    label: MessagesActionType.ADD_REACTION,
    action: () => openReactionMenu(messageId)
  };

  if (userId === currentUserId) {
    context[MessagesActionType.EDIT_MESSAGE] = {
      label: MessagesActionType.EDIT_MESSAGE,
      action: () => openEditMessage(messageId)
    };
  }

  if (
    permissionManager.canManageMessages() ||
    (isOnDm && userId === currentUserId)
  ) {
    context[MessagesActionType.PIN_MESSAGE] = {
      label: MessagesActionType.PIN_MESSAGE,
      action: () => pinMessage(messageId)
    };
  }

  context[MessagesActionType.REPLY] = {
    label: MessagesActionType.REPLY,
    action: () => showReplyMenu(messageId, userId)
  };

  context[MessagesActionType.MARK_AS_UNREAD] = {
    label: MessagesActionType.MARK_AS_UNREAD,
    action: () => markAsUnread(messageId)
  };

  if (isOnDm) {
    if (userId === currentUserId) {
      context[MessagesActionType.DELETE_MESSAGE] = {
        label: MessagesActionType.DELETE_MESSAGE,
        action: () => deleteMessage(messageId)
      };
    }
  } else {
    if (isOnGuild && permissionManager.canManageMessages())
      context[MessagesActionType.DELETE_MESSAGE] = {
        label: MessagesActionType.DELETE_MESSAGE,
        action: () => deleteMessage(messageId)
      };
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_ID] = {
      action: (event: MouseEvent) => copyId(messageId, event)
    };
  }

  return context;
}

export function createMenuItem(labelKey: string, itemOptions: ItemOptions) {
  const translatedLabel = translations.getContextTranslation(labelKey);
  const li = createEl("li", { textContent: translatedLabel });

  li.addEventListener("click", function (event) {
    event.stopPropagation();
    hideContextMenu();
    if (itemOptions.action) {
      itemOptions.action(event);
    }
  });

  if (itemOptions.subOptions) {
    const subUl = createEl("ul");
    itemOptions.subOptions.forEach((subOption) => {
      const subLi = createMenuItem(translatedLabel, subOption);
      subUl.appendChild(subLi);
    });
    li.appendChild(subUl);
  }

  li.addEventListener("mouseenter", function () {
    const subMenu = li.querySelector("ul");
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
    const subMenu = li.querySelector("ul");
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

export function clickOutsideContextMenu(event: Event) {
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

export function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
    document.removeEventListener("click", clickOutsideContextMenu);
  }
}
