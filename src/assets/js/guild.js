import {
  getId,
  createEl,
  blackImage,
  constructAppPage,
  getProfileUrl,
} from "./utils";
import { clickMainLogo, alertUser, preventDrag } from "./ui";
import {
  isChangingPage,
  initialState,
  loadApp,
  changecurrentGuild,
} from "./app";
import { isOnGuild, isOnMe, isOnDm } from "./router";
import { updateMemberList } from "./userList";
import { showGuildPop } from "./popups";
import { validateAvatar } from "./avatar";
import { guildCache, cacheInterface } from "./cache";
import { permissionManager } from "./guildPermissions";
import { apiClient, EventType } from "./api";
import { currentVoiceChannelId } from "./channels";
import { resetImageInput } from "./avatar";
import { createFireWorks } from "./extras";
import { currentUserId } from "./user";

export let currentGuildId;
export const guildName = getId("guild-name");
export const guildContainer = getId("guild-container");
const guildsList = getId("guilds-list");

export function getManageableGuilds() {
  try {
    const permissionsMap = permissionManager.permissionsMap;
    if (!permissionsMap) {
      return [];
    }
    const guildsWeAreAdminOn = [];
    let isFoundAny = false;
    for (const key in permissionsMap) {
      if (permissionsMap[key].isAdmin) {
        guildsWeAreAdminOn.push(key);
        isFoundAny = true;
      }
    }
    return isFoundAny ? guildsWeAreAdminOn : null;
  } catch (e) {
    console.error(e);
  }
}

export function createGuild() {
  const guildName = getId("guild-name-input").value;
  const guildPhotoFile = getId("guildImageInput").files[0];

  if (guildPhotoFile && !validateAvatar(guildPhotoFile)) {
    resetImageInput("guildImageInput", "guildImg");
    return;
  }

  let formData = new FormData();
  if (guildPhotoFile) {
    formData.append("Photo", guildPhotoFile);
  }
  formData.append("GuildName", guildName);

  fetch("/api/guilds", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.ok) return response.json();
      return response.text();
    })
    .then((data) => {
      console.log("Guild creation response:", data);
      if (typeof data === "object") {
        const popup = getId("guild-pop-up");
        if (popup) {
          popup.parentNode.remove();
        }
        loadGuild(data.guildId, data.channelId, guildName, currentUserId);
        cacheInterface.addGuild(data.guildId, guildName, currentUserId);

        createFireWorks();
        appendToGuildList(data);
      } else {
        alertUser(data);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

export function loadGuild(
  guildId,
  channelId,
  guildName,
  isChangingUrl = true,
  isInitial = false,
) {
  if (!guildId || !channelId) {
    console.error("Load guild called with null values: ", guildId, channelId);
    return;
  }
  console.log("Loading guild: ", guildId, channelId, guildName);

  if (isChangingUrl) {
    const state = constructAppPage(guildId, channelId);
    if (window.location.pathname !== state) {
      window.history.pushState(null, null, state);
    }
  }
  if (isChangingPage) {
    console.warn(" Already changing guild! can not change guild");
    return;
  }
  addKeybinds();

  currentGuildId = guildId;
  permissionManager.updatePermissions(guildId, initialState.permissionsMap);
  selectGuildList(guildId);
  if (guildName) {
    guildCache.currentGuildName = guildName;
  } else {
    const cachedGuildName = cacheInterface.getGuildName(guildId);
    if (cachedGuildName) {
      guildCache.currentGuildName = cachedGuildName;
    } else {
      console.warn("Name does not exist for guild: ", guildId);
    }
  }

  guildCache.currentChannelId = channelId;

  if (isOnMe) {
    loadApp(null, isInitial);
  } else if (isOnDm) {
    loadApp(null, isInitial);
  } else if (isOnGuild) {
    changecurrentGuild();
  }
}

export function joinVoiceChannel(channelId) {
  if (currentVoiceChannelId === channelId) {
    return;
  }
  const data = { guildId: currentGuildId, channelId: channelId };
  apiClient.send(EventType.JOIN_VOICE_CHANNEL, data);
  return;
}

export function refreshInviteId() {
  if (!cacheInterface.isInvitesEmpty(currentGuildId)) {
    return;
  }
  console.log("Implement invites");
}

export function fetchMembers() {
  if (!currentGuildId) {
    console.warn("Current guild id is null! cant fetch members");
    return;
  }
  const members = cacheInterface.getMembers(currentGuildId);

  if (members.length > 0) {
    console.log("Using cached members...");
    updateMemberList(members);
  } else {
    console.log("Fetching members...");
    apiClient.send(EventType.GET_MEMBERS, { guildId: currentGuildId });
  }
}

export function getGuildMembers() {
  if (!cacheInterface.isMembersEmpty(currentGuildId) || !currentGuildId) {
    return;
  }

  const guildMembers = cacheInterface.getMembers(currentGuildId);
  if (!guildMembers) {
    return;
  }

  let usersToReturn = [];

  for (const userId in guildMembers) {
    const user = guildMembers[userId];
    usersToReturn.push({
      name: user.Nickname,
      image: getProfileUrl(user.userId),
    });
  }
  console.log(usersToReturn);
  console.log(guildMembers);

  return usersToReturn;
}

export function joinToGuild(inviteId) {
  apiClient.send(EventType.JOIN_GUILD, { invite_id: inviteId });
}

export function leaveCurrentGuild() {
  apiClient.send(EventType.LEAVE_GUILD, currentGuildId);
}

//ui

let keybindHandlers = {};
let isGuildKeyDown = false;
let currentGuildIndex = 1;

export function clearKeybinds() {
  if (keybindHandlers["shift"]) {
    document.removeEventListener("keydown", keybindHandlers["shift"]);
  }
  keybindHandlers = {};
}

export function addKeybinds() {
  clearKeybinds();
  const guilds = Array.from(document.querySelectorAll("#guilds-list img"));

  const handler = (event) => {
    if (!event.shiftKey) return;

    const key = event.key;

    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();

      if (isGuildKeyDown) return;

      if (key === "ArrowUp") {
        currentGuildIndex =
          (currentGuildIndex - 1 + guilds.length) % guilds.length;
      } else if (key === "ArrowDown") {
        currentGuildIndex = (currentGuildIndex + 1) % guilds.length;
      }

      guilds[currentGuildIndex].click();

      isGuildKeyDown = true;
    }
  };

  document.addEventListener("keydown", handler);

  document.addEventListener("keyup", () => {
    isGuildKeyDown = false;
  });

  keybindHandlers["shift"] = handler;
}

export function removeFromGuildList(guildId) {
  const guildImg = getId(guildId);
  if (guildImg) {
    const parentLi = guildImg.closest("li");
    if (parentLi) parentLi.remove();
  }
}

export function updateGuild(uploadedGuildId) {
  const guildList = guildsList.querySelectorAll("img");
  guildList.forEach((img) => {
    if (img.id === uploadedGuildId) {
      setGuildImage(uploadedGuildId, img, true);
    }
  });
}

export function selectGuildList(guildId) {
  if (!guildsList) return;

  const foundGuilds = guildsList.querySelectorAll("img");

  foundGuilds.forEach((guild) => {
    if (guild.id === guildId) {
      wrapWhiteRod(guild.parentNode);
      guild.parentNode.classList.add("selected-guild");
    } else {
      guild.parentNode.classList.remove("selected-guild");
    }
  });
}

export function updateGuilds(guildsJson) {
  if (Array.isArray(guildsJson)) {
    guildsList.innerHTML = "";

    const mainLogoItem = createMainLogo();
    guildsList.appendChild(mainLogoItem);

    wrapWhiteRod(mainLogoItem);

    guildsJson.forEach(({ guildId, guildName, rootChannel, guildMembers }) => {
      const listItem = createGuildListItem(
        guildId,
        rootChannel,
        guildName,
      );
      guildsList.appendChild(listItem);

      guildCache.getGuild(guildId).setName(guildName);
      cacheInterface.setMemberIds(guildId, guildMembers);
    });

    const selectedGuild = guildsList.querySelector(
      `img[id="${currentGuildId}"]`,
    );
    if (selectedGuild) {
      selectedGuild.parentNode.classList.add("selected-guild");
    }
  } else {
    console.error("Non-array guild data");
  }
}

export function wrapWhiteRod(element) {
  if (!element) return;
  if (!element.querySelector(".white-rod")) {
    const whiteRod = createEl("div", { className: "white-rod" });
    element.appendChild(whiteRod);
  }
}
const createGuildListItem = (guildIdStr, rootChannel, guildNameStr) => {
  const listItem = createEl("li");
  const imgElement = createEl("img", { id: guildIdStr, className : "guild-image"});

  setGuildImage(guildIdStr, imgElement);

  imgElement.onerror = () => {
    imgElement.src = blackImage;
  };

  imgElement.addEventListener("click", () => {
    try {
      loadGuild(guildIdStr, rootChannel, guildNameStr);
    } catch (error) {
      console.error("Error while loading guild:", error);
    }

    guildsList
      .querySelectorAll(".guild")
      .forEach((item) => item.classList.remove("selected-guild"));
    listItem.classList.add("selected-guild");
    wrapWhiteRod(listItem);
  });

  wrapWhiteRod(listItem);
  listItem.appendChild(imgElement);
  return listItem;
};

export function appendToGuildList(guild) {
  if (guildsList.querySelector(`#${CSS.escape(guild.guildId)}`)) return;

  const listItem = createGuildListItem(
    guild.guildId,
    guild.rootChannel,
    guild.guildName,
  );
  guildsList.appendChild(listItem);

  guildCache.getGuild(guild.guildId).setName(guild.guildName);
  cacheInterface.setMemberIds(guild.guildId, guild.guildMembers);
}

export function createMainLogo() {
  const mainLogoImg = createEl("img", {
    id: "main-logo",
    src: "/images/icons/icon.png",
    "data-src": "/images/icons/icon.png",
  });

  const mainLogo = createEl("li");

  mainLogo.addEventListener("mouseover", () => {
    mainLogoImg.classList.add("rotate-element");
  });

  mainLogo.addEventListener("mouseleave", () => {
    mainLogoImg.classList.remove("rotate-element");
  });

  preventDrag(mainLogoImg);

  mainLogoImg.addEventListener("click", () => {
    document
      .querySelectorAll(".guild")
      .forEach((item) => item.classList.remove("selected-guild"));
    mainLogoImg.parentElement.classList.add("selected-guild");
    clickMainLogo(mainLogoImg.parentElement);
  });

  mainLogo.appendChild(mainLogoImg);

  return mainLogo;
}

export function setGuildImage(guildId, imageElement, isUploaded) {
  imageElement.src = isUploaded ? `/guilds/${guildId}` : blackImage;
}

export function doesGuildExistInBar(guildId) {
  return Boolean(guildsList.querySelector(`#${CSS.escape(guildId)}`));
}

function init() {
  const guildCreatorBtn = getId("create-guild-button");
  if (guildCreatorBtn) {
    guildCreatorBtn.addEventListener("click", showGuildPop);
  }
}

init();
