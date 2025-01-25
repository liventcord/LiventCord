import { openDm, readCurrentMessages } from "./app";
import { drawProfilePop } from "./popups";
import { showReplyMenu, chatInput } from "./chatbar";
import { currentUserId, getUserNick } from "./user";
import { getManageableGuilds, currentGuildId } from "./guild";
import { createEl, constructAbsoluteAppPage } from "./utils";
import { isOnMe, isOnDm, isOnGuild } from "./router";
import { friendCache } from "./friends";
import { permissionManager } from "./guildPermissions";
import { translations } from "./translations";
import { alertUser } from "./ui";
import { guildCache } from "./cache";
import { apiClient, EventType } from "./api";

let isDeveloperMode = true;
export let contextList = {};
export let messageContextList = {};
const ActionType = {
  COPY_ID: "COPY_ID",
  COPY_USER_ID: "COPY_USER_ID",
  INVITE_TO_GUILD: "INVITE_TO_GUILD",
  BLOCK_USER: "BLOCK_USER",
  REPORT_USER: "REPORT_USER",
  REMOVE_USER: "REMOVE_USER",
  EDIT_GUILD_PROFILE: "EDIT_GUILD_PROFILE",
  MENTION_USER: "MENTION_USER",
};

const ChannelsActionType = {
  MARK_AS_READ: "MARK_AS_READ",
  COPY_LINK: "COPY_LINK",
  MUTE_CHANNEL: "MUTE_CHANNEL",
  NOTIFY_SETTINGS: "NOTIFY_SETTINGS",
  EDIT_CHANNEL: "EDIT_CHANNEL",
  DELETE_CHANNEL: "DELETE_CHANNEL",
};

const VoiceActionType = {
  OPEN_PROFILE: "OPEN_PROFILE",
  MENTION_USER: "MENTION_USER",
  MUTE_USER: "MUTE_USER",
  DEAFEN_USER: "DEAFEN_USER",
};

const MessagesActionType = {
  ADD_REACTION: "ADD_REACTION",
  EDIT_MESSAGE: "EDIT_MESSAGE",
  PIN_MESSAGE: "PIN_MESSAGE",
  REPLY: "REPLY",
  MARK_AS_UNREAD: "MARK_AS_UNREAD",
  DELETE_MESSAGE: "DELETE_MESSAGE",
};

export function openReactionMenu(messageId) {
  alertUser("Not implemented: React menu for message ");
}

export function openEditMessage(messageId) {
  alertUser("Not implemented: Editing message ");
}

export function pinMessage(messageId) {
  alertUser("Not implemented: Pinning message ");
}

export function markAsUnread(messageId) {
  alertUser("Not implemented: Marking message as unread ");
}
export function editGuildProfile() {
  alertUser("Not implemented: editing guild profile ");
}

export function deleteMessage(messageId) {
  console.log("Deleting message ", messageId);
  let data = {
    isDm: isOnDm,
    messageId: messageId,
    channelId: isOnGuild
      ? guildCache.currentChannelId
      : friendCache.currentDmId,
  };
  if (isOnGuild) {
    data["guildId"] = currentGuildId;
  }
  apiClient.send(EventType.DELETE_MESSAGE, data);
}

export function inviteToGuild(userId) {
  alertUser("Not implemented: Inviting user ");
}

export function blockUser(userId) {
  alertUser("Not implemented: Blocking user ");
}

export function reportUser(userId) {
  alertUser("Not implemented: Reporting user ");
}
export function muteChannel(channelId) {
  alertUser("Mute channel is not implemented!");
}
export function showNotifyMenu(channelId) {
  alertUser("Notify menu is not implemented!");
}
export function onChangeChannel(channelId) {
  alertUser("Channel editing is not implemented!");
}
function muteUser() {}
function deafenUser() {}

export function togglePin() {
  console.log("Toggle pin!");
}
export function mentionUser(userId) {
  const userNick = getUserNick(userId);
  chatInput.value += `@${userNick}`;
}

export function inviteUser(userId, guildId) {
  if (!userId || !guildId) {
    return;
  }
  console.log("inviting user : ", userId, " to guild ", guildId);
  openDm(userId);
  //TODO: add invitation prompt to here
}

export function removeFriend(userId) {
  apiClient.send(EventType.REMOVE_FRIEND, { friend_id: userId });
}

export function copyChannelLink(guildId, channelId) {
  const content = constructAbsoluteAppPage(guildId, channelId);
  navigator.clipboard.writeText(content);
}
export function copyId(channelId) {
  navigator.clipboard.writeText(channelId);
}

export function deleteChannel(channelId, guildId) {
  const data = {
    guildId: guildId,
    channelId: channelId,
  };
  apiClient.send(EventType.DELETE_CHANNEL, data);
}

export function appendToChannelContextList(channelId) {
  contextList[channelId] = createChannelsContext(channelId);
}

export function appendToMessageContextList(messageId, userId) {
  messageContextList[messageId] = createMessageContext(messageId, userId);
}
export function appendToProfileContextList(userData, userId) {
  if (userId && userData) {
    contextList[userId] = createProfileContext(userData, userId);
  }
}

export function createUserContext(userId) {
  let context = {};

  context[VoiceActionType.OPEN_PROFILE] = {
    action: () => drawProfilePop(userId),
  };

  (context[VoiceActionType.MENTION_USER] = () => mentionUser(userId)),
    (context[VoiceActionType.MUTE_USER] = () => muteUser(userId)),
    (context[VoiceActionType.DEAFEN_USER] = () => deafenUser(userId));

  if (userId === currentUserId) {
    context[ActionType.EDIT_GUILD_PROFILE] = () => editGuildProfile();
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_ID] = () => copyId(userId);
  }

  return context;
}

export function createProfileContext(userData) {
  const userId = userData.userId;
  let context = {};

  context[VoiceActionType.OPEN_PROFILE] = {
    action: () => drawProfilePop(userData),
  };

  if (userId !== currentUserId) {
    const guildSubOptions = getManageableGuilds();
    if (Array.isArray(guildSubOptions) && guildSubOptions.length > 0) {
      context[ActionType.INVITE_TO_GUILD] = {
        action: () => {},
        subOptions: guildSubOptions.map((subOption) => ({
          label: guildCache.getGuildName(subOption),
          action: () => inviteUser(userId, subOption),
        })),
      };
    }
  }

  if (!isOnMe) {
    context[ActionType.MENTION_USER] = {
      action: () => mentionUser(userId),
    };
  }

  if (userId === currentUserId) {
    context[ActionType.EDIT_GUILD_PROFILE] = {
      action: () => editGuildProfile(),
    };
  } else {
    context[ActionType.BLOCK_USER] = {
      action: () => blockUser(userId),
    };
    context[ActionType.REPORT_USER] = {
      action: () => reportUser(userId),
    };
  }

  if (friendCache.isFriend(userId)) {
    context[ActionType.REMOVE_USER] = {
      action: () => removeFriend(userId),
    };
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_USER_ID] = {
      action: () => copyId(userId),
    };
  }

  return context;
}

export function addContextListeners() {
  document.addEventListener("contextmenu", function (event) {
    event.preventDefault();

    let options = null;

    if (event.target.id && contextList.hasOwnProperty(event.target.id)) {
      options = contextList[event.target.id];
    } else if (
      event.target.dataset.m_id &&
      messageContextList.hasOwnProperty(event.target.dataset.m_id)
    ) {
      options = messageContextList[event.target.dataset.m_id];
    } else if (
      event.target.dataset.cid &&
      contextList.hasOwnProperty(event.target.dataset.cid)
    ) {
      options = contextList[event.target.dataset.cid];
    }

    if (options) {
      showContextMenu(event.pageX, event.pageY, options);
    }
  });

  document.addEventListener("click", function (event) {
    if (
      event.target.dataset.m_id &&
      messageContextList.hasOwnProperty(event.target.dataset.m_id)
    ) {
      const options = messageContextList[event.target.dataset.m_id];
      if (options) {
        hideContextMenu();
        showContextMenu(event.pageX, event.pageY, options);
      }
    }

    if (
      event.target.classList &&
      !event.target.classList.contains("message") &&
      event.target.id &&
      messageContextList.hasOwnProperty(event.target.id)
    ) {
      const options = messageContextList[event.target.id];
      if (options) {
        hideContextMenu();
        showContextMenu(event.pageX, event.pageY, options);
      }
    }
  });
}

export function createChannelsContext(channelId) {
  let context = {};
  context[ChannelsActionType.MARK_AS_READ] = {
    action: () => readCurrentMessages(),
  };
  context[ChannelsActionType.COPY_LINK] = {
    action: () => copyChannelLink(currentGuildId, channelId),
  };
  context[ChannelsActionType.MUTE_CHANNEL] = {
    action: () => muteChannel(channelId),
  };
  context[ChannelsActionType.NOTIFY_SETTINGS] = {
    action: () => showNotifyMenu(channelId),
  };

  if (permissionManager.canManageChannels()) {
    context[ChannelsActionType.EDIT_CHANNEL] = {
      action: () => onChangeChannel(channelId),
    };
    context[ChannelsActionType.DELETE_CHANNEL] = {
      action: () => deleteChannel(channelId, currentGuildId),
    };
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_ID] = { action: () => copyId(channelId) };
  }

  return context;
}

export function createMessageContext(messageId, userId) {
  let context = {};

  context[MessagesActionType.ADD_REACTION] = {
    label: MessagesActionType.ADD_REACTION,
    action: () => openReactionMenu(messageId),
  };

  if (userId === currentUserId) {
    context[MessagesActionType.EDIT_MESSAGE] = {
      label: MessagesActionType.EDIT_MESSAGE,
      action: () => openEditMessage(messageId),
    };
  }

  if (
    permissionManager.canManageMessages() ||
    (isOnDm && userId === currentUserId)
  ) {
    context[MessagesActionType.PIN_MESSAGE] = {
      label: MessagesActionType.PIN_MESSAGE,
      action: () => pinMessage(messageId),
    };
  }

  context[MessagesActionType.REPLY] = {
    label: MessagesActionType.REPLY,
    action: () => showReplyMenu(messageId, userId),
  };

  context[MessagesActionType.MARK_AS_UNREAD] = {
    label: MessagesActionType.MARK_AS_UNREAD,
    action: () => markAsUnread(messageId),
  };

  if (isOnDm) {
    if (userId === currentUserId) {
      context[MessagesActionType.DELETE_MESSAGE] = {
        label: MessagesActionType.DELETE_MESSAGE,
        action: () => deleteMessage(messageId),
      };
    }
  } else {
    if (permissionManager.canManageMessages())
      context[MessagesActionType.DELETE_MESSAGE] = {
        label: MessagesActionType.DELETE_MESSAGE,
        action: () => deleteMessage(messageId),
      };
  }

  if (isDeveloperMode) {
    context[ActionType.COPY_ID] = { action: () => copyId(messageId) };
  }

  return context;
}

export function createMenuItem(labelKey, itemOptions) {
  const translatedLabel = translations.getContextTranslation(labelKey);
  const li = createEl("li", { textContent: translatedLabel });

  li.addEventListener("click", function (event) {
    event.stopPropagation();
    hideContextMenu();
    if (itemOptions.action) {
      itemOptions.action();
    }
  });

  if (itemOptions.subOptions) {
    const subUl = createEl("ul");
    itemOptions.subOptions.forEach((subOption) => {
      const subLi = createMenuItem(subOption.label, subOption);
      subUl.appendChild(subLi);
    });
    li.appendChild(subUl);

    li.addEventListener("mouseenter", function () {
      const subMenu = li.querySelector("ul");
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
    });

    li.addEventListener("mouseleave", function () {
      const subMenu = li.querySelector("ul");
      subMenu.style.display = "none";
    });
  }

  return li;
}

let contextMenu = null;

export function showContextMenu(x, y, options) {
  hideContextMenu();
  const tempContextMenu = createEl("div", {
    id: "contextMenu",
    className: "context-menu",
  });
  const ul = createEl("ul");

  for (const key in options) {
    if (options.hasOwnProperty(key)) {
      const itemOptions = options[key];
      const li = createMenuItem(key, itemOptions);
      ul.appendChild(li);
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

export function clickOutsideContextMenu(event) {
  if (
    contextMenu &&
    !contextMenu.contains(event.target) &&
    !contextList[event.target.id]
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
