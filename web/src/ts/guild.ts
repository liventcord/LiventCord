import {
  getId,
  createEl,
  blackImage,
  constructAppPage,
  getProfileUrl
} from "./utils.ts";
import { clickMainLogo, alertUser, preventDrag } from "./ui.ts";
import {
  isChangingPage,
  initialState,
  loadApp,
  changecurrentGuild
} from "./app.ts";
import { isOnGuild, isOnMe, isOnDm } from "./router.ts";
import { updateMemberList } from "./userList.ts";
import { showGuildPop } from "./popups.ts";
import { validateAvatar, resetImageInput } from "./avatar.ts";
import { guildCache, cacheInterface } from "./cache.ts";
import {
  Permission,
  permissionManager,
  PermissionsRecord
} from "./guildPermissions.ts";
import { apiClient, EventType } from "./api.ts";
import { currentVoiceChannelId, getRootChannel } from "./channels.ts";
import { createFireWorks } from "./extras.ts";
import { UserInfo } from "./user.ts";

export let currentGuildId: string;
export const guildNameText = getId("guild-name") as HTMLElement;
export const guildContainer = getId("guild-container") as HTMLElement;
const guildsList = getId("guilds-list") as HTMLElement;

const createGuildCross =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z"></path></svg>';

export function setGuildNameText(guildName: string) {
  guildNameText.innerText = guildName;
}

export function getManageableGuilds() {
  try {
    const permissionsMap = permissionManager.permissionsMap;
    if (!permissionsMap) {
      return [];
    }

    const guildsWeAreAdminOn: string[] = []; // Explicitly type as string[]
    let isFoundAny = false;

    permissionsMap.forEach((permissionsSet, guildId) => {
      if (permissionsSet.has(Permission.IS_ADMIN)) {
        guildsWeAreAdminOn.push(guildId);
        isFoundAny = true;
      }
    });

    return isFoundAny ? guildsWeAreAdminOn : null;
  } catch (e) {
    console.error(e);
  }
}

export function createGuild() {
  const guildNameInput = getId("guild-name-input") as HTMLInputElement;
  const guildPhotoInput = getId("guildImageInput") as HTMLInputElement;

  const guildPhotoFile = guildPhotoInput.files
    ? guildPhotoInput.files[0]
    : null;
  const guildName = guildNameInput.value;

  if (guildPhotoFile && !validateAvatar(guildPhotoFile)) {
    resetImageInput("guildImageInput", "guildImg");
    return;
  }

  const formData = new FormData();
  if (guildPhotoFile) {
    formData.append("Photo", guildPhotoFile);
  }
  formData.append("GuildName", guildName);

  fetch("/api/guilds", {
    method: "POST",
    body: formData
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
          const parentNode = popup.parentNode as HTMLElement;
          if (parentNode) {
            parentNode.remove();
          }
        }

        cacheInterface.addGuild(data);

        createFireWorks();
        appendToGuildList(data);
        loadGuild(data.guildId, data.rootChannel, guildName, true);
      } else {
        alertUser(data);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

export function loadGuild(
  guildId: string,
  channelId: string,
  guildName?: string,
  isChangingUrl: boolean = true,
  isInitial: boolean = false
) {
  if (!guildId || !channelId) {
    console.error("Load guild called with null values: ", guildId, channelId);
    return;
  }
  console.log("Loading guild: ", guildId, channelId, guildName);

  if (isChangingUrl) {
    const state = constructAppPage(guildId, channelId);
    if (window.location.pathname !== state) {
      window.history.pushState(null, "", state);
    }
  }
  if (isChangingPage) {
    console.warn(" Already changing guild! can not change guild");
    return;
  }
  addKeybinds();

  currentGuildId = guildId;
  console.log(initialState.permissionsMap);
  const permissionsObject: PermissionsRecord = Object.fromEntries(
    Object.entries(initialState.permissionsMap).map(
      ([_guildId, permissions]) => [_guildId, permissions]
    )
  );

  permissionManager.updatePermissions(guildId, permissionsObject);

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
    loadApp("", isInitial);
  } else if (isOnDm) {
    loadApp("", isInitial);
  } else if (isOnGuild) {
    changecurrentGuild();
  }
}

export function joinVoiceChannel(channelId: string) {
  if (currentVoiceChannelId === channelId) {
    return;
  }
  const data = { guildId: currentGuildId, channelId };
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
    console.warn("Current guild id is null! can't fetch members");
    return;
  }

  const members = cacheInterface.getMembers(currentGuildId);

  if (members.length > 0) {
    console.log("Using cached members...");

    const userInfoList: UserInfo[] = members.map((member) => ({
      userId: member.userId,
      nickName: member.nickName,
      discriminator: "0000"
    }));

    updateMemberList(userInfoList);
  } else {
    console.log("Fetching members...");
    apiClient.send(EventType.GET_MEMBERS, { guildId: currentGuildId });
  }
}

export function getGuildMembers() {
  if (!cacheInterface.isMembersEmpty(currentGuildId) || !currentGuildId) {
    return [];
  }

  const guildMembers = cacheInterface.getMembers(currentGuildId);
  if (!guildMembers) {
    return [];
  }

  const usersToReturn = [];

  for (const userId in guildMembers) {
    const user = guildMembers[userId];
    usersToReturn.push({
      name: user.nickName,
      image: getProfileUrl(user.userId)
    });
  }
  console.log(usersToReturn);
  console.log(guildMembers);

  return usersToReturn;
}

export function joinToGuild(inviteId: string) {
  apiClient.send(EventType.JOIN_GUILD, { invite_id: inviteId });
}

export function leaveCurrentGuild() {
  apiClient.send(EventType.LEAVE_GUILD, currentGuildId);
}

//ui

let keybindHandlers: { [key: string]: (event: KeyboardEvent) => void } = {};
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

  const handler = (event: KeyboardEvent) => {
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

      (guilds[currentGuildIndex] as HTMLElement).click();

      isGuildKeyDown = true;
    }
  };

  document.addEventListener("keydown", handler);

  document.addEventListener("keyup", () => {
    isGuildKeyDown = false;
  });

  keybindHandlers["shift"] = handler;
}

export function removeFromGuildList(guildId: string) {
  const guildImg = getId(guildId);
  if (guildImg) {
    const parentLi = guildImg.closest("li");
    if (parentLi) parentLi.remove();
  }
}

export function updateGuildImage(uploadedGuildId: string) {
  const guildList = guildsList.querySelectorAll("img");
  guildList.forEach((img) => {
    if (img.id === uploadedGuildId) {
      setGuildImage(uploadedGuildId, img, true);
    }
  });
}

export function selectGuildList(guildId: string): void {
  if (!guildsList) return;

  const foundGuilds = Array.from(
    guildsList.querySelectorAll("img")
  ) as HTMLImageElement[];

  for (const guild of foundGuilds) {
    const guildParent = guild.parentElement;
    if (!guildParent) continue;

    if (guild.id === guildId) {
      wrapWhiteRod(guildParent);
      guildParent.classList.add("selected-guild");
    } else {
      guildParent.classList.remove("selected-guild");
      removeWhiteRod(guildParent);
    }
  }
}

const createGuildListItem = (
  guildId: string,
  rootChannel: string,
  guildName: string,
  isUploaded: boolean
) => {
  const listItem = createEl("li");
  const imgElement = createEl("img", {
    id: guildId,
    className: "guild-image"
  }) as HTMLImageElement;

  setGuildImage(guildId, imgElement, isUploaded);

  imgElement.onerror = () => {
    imgElement.src = blackImage;
  };

  imgElement.addEventListener("click", () => {
    try {
      loadGuild(guildId, getRootChannel(guildId, rootChannel), guildName);
    } catch (error) {
      console.error("Error while loading guild:", error);
    }
  });

  listItem.appendChild(imgElement);
  return listItem;
};
export function updateGuilds(guildsJson: Array<any>) {
  if (!guildsJson) return;
  if (Array.isArray(guildsJson)) {
    guildsList.innerHTML = "";

    const mainLogoItem = createMainLogo();
    guildsList.appendChild(mainLogoItem);

    wrapWhiteRod(mainLogoItem);

    guildsJson.forEach(
      ({
        guildId,
        guildName,
        isGuildUploadedImg,
        rootChannel,
        guildMembers
      }) => {
        const listItem = createGuildListItem(
          guildId,
          rootChannel,
          guildName,
          isGuildUploadedImg
        );
        guildsList.appendChild(listItem);

        cacheInterface.setName(guildId, guildName);
        cacheInterface.setMemberIds(guildId, guildMembers);
      }
    );
    const createGuildButton = createNewGuildButton();
    guildsList.appendChild(createGuildButton);

    const selectedGuild = guildsList.querySelector(
      `img[id="${currentGuildId}"]`
    );
    if (selectedGuild) {
      (selectedGuild.parentNode as HTMLElement).classList.add("selected-guild");
    }
  } else {
    console.error("Non-array guild data");
  }
}

export function wrapWhiteRod(element: HTMLElement) {
  if (!element) return;
  if (!element.querySelector(".white-rod")) {
    const whiteRod = createEl("div", { className: "white-rod" });
    element.appendChild(whiteRod);
  }
}
function removeWhiteRod(element: HTMLElement) {
  if (!element) return;
  const whiteRod = element.querySelector(".white-rod");
  if (!whiteRod) return;
  whiteRod.remove();
}
interface Guild {
  guildId: string;
  rootChannel: string;
  guildName: string;
  isGuildUploadedImg: boolean;
  guildMembers: string[];
}
export function appendToGuildList(guild: Guild) {
  if (guildsList.querySelector(`#${CSS.escape(guild.guildId)}`)) return;

  const listItem = createGuildListItem(
    guild.guildId,
    guild.rootChannel,
    guild.guildName,
    guild.isGuildUploadedImg
  );

  guildsList.appendChild(listItem);

  const createGuildButton = guildsList.querySelector("#create-guild-button");
  if (createGuildButton) {
    guildsList.appendChild(createGuildButton);
  }

  cacheInterface.setName(guild.guildId, guild.guildName);
  cacheInterface.setMemberIds(guild.guildId, guild.guildMembers);
}

function createNewGuildButton() {
  const createGuildImage = createEl("div", {
    id: "create-guild-button",
    className: "guild-image"
  });

  const createGuildButton = createEl("li");

  createGuildButton.addEventListener("mouseover", () => {
    createGuildImage.classList.add("rotate-element");
    createGuildImage.classList.add("create-guild-hover");
  });

  createGuildButton.addEventListener("mouseleave", () => {
    createGuildImage.classList.remove("rotate-element");
    createGuildImage.classList.remove("create-guild-hover");
  });
  const newElement = createEl("div", {
    innerHTML: createGuildCross
  });
  newElement.style.pointerEvents = "none";
  newElement.style.marginTop = "5px";
  newElement.style.marginLeft = "13px";

  preventDrag(createGuildImage);

  createGuildImage.addEventListener("click", showGuildPop);

  createGuildButton.appendChild(createGuildImage);
  createGuildImage.appendChild(newElement);

  return createGuildButton;
}
function createMainLogo() {
  const mainLogoImg = createEl("img", {
    id: "main-logo",
    src: "/images/icons/icon.png"
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
    if (mainLogoImg.parentElement) {
      mainLogoImg.parentElement.classList.add("selected-guild");
      clickMainLogo(mainLogoImg.parentElement);
    }
  });

  mainLogo.appendChild(mainLogoImg);

  return mainLogo;
}

export function setGuildImage(
  guildId: string,
  imageElement: HTMLImageElement,
  isUploaded: boolean
) {
  imageElement.src = isUploaded ? `/guilds/${guildId}` : blackImage;
}

export function doesGuildExistInBar(guildId: string) {
  return Boolean(guildsList.querySelector(`#${CSS.escape(guildId)}`));
}
