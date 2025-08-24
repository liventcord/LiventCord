import { getId, createEl, blackImage, IMAGE_SRCS } from "./utils.ts";
import { clickMainLogo } from "./ui.ts";
import {
  isChangingPage,
  initialState,
  loadApp,
  changeCurrentGuild,
  loadDmHome
} from "./app.ts";
import { isOnGuild, isOnMePage, isOnDm, router } from "./router.ts";
import {
  addUserToMemberList,
  removeUserFromMemberList,
  updateMemberList
} from "./userList.ts";
import { showGuildPop } from "./popups.ts";
import {
  validateAvatar,
  resetImageInput,
  getProfileUrl,
  setGuildPic
} from "./avatar.ts";
import { guildCache, cacheInterface } from "./cache.ts";
import {
  Permission,
  permissionManager,
  PermissionsRecord
} from "./guildPermissions.ts";
import { apiClient, EventType } from "./api.ts";
import { currentVoiceChannelId, getSeletedChannel } from "./channels.ts";
import { currentUserId, UserInfo, userManager } from "./user.ts";
import { appendToGuildContextList } from "./contextMenuActions.ts";
import { populateEmojis } from "./emoji.ts";
import { GuildMemberAddedMessage } from "./socketEvents.ts";

export let currentGuildId: string;
const guildNameText = getId("guild-name") as HTMLElement;
export const guildContainer = getId("guild-container") as HTMLElement;
const guildsList = getId("guilds-list") as HTMLElement;

const createGuildCross =
  '<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z"></path></svg>';

export interface Guild {
  guildId: string;
  rootChannel: string;
  guildName: string;
  isGuildUploadedImg: boolean;
  guildMembers: string[];
}
export interface GuildMember {
  name: string;
  image: string;
  userId: string;
  discriminator: string;
}
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

  apiClient.sendForm(EventType.CREATE_GUILD, formData, {
    GuildName: guildName
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
    router.switchToGuild(guildId, channelId);
  }
  if (isChangingPage) {
    console.warn(" Already changing guild! can not change guild");
    return;
  }
  addKeybinds();

  currentGuildId = guildId;
  populateEmojis();

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

  if (isOnMePage) {
    loadApp("", isInitial);
  } else if (isOnDm) {
    loadApp("", isInitial);
  } else if (isOnGuild) {
    changeCurrentGuild();
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
}

export function kickMember(memberId: string) {
  apiClient.send(EventType.KICK_MEMBER, { guildId: currentGuildId, memberId });
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

export function getGuildMembers(): GuildMember[] {
  if (cacheInterface.isMembersEmpty(currentGuildId) || !currentGuildId) {
    return [];
  }

  const guildMembers = cacheInterface.getMembers(currentGuildId);
  if (!guildMembers) {
    return [];
  }

  const usersToReturn: GuildMember[] = [];

  for (const userId in guildMembers) {
    const user = guildMembers[userId];
    usersToReturn.push({
      name: user.nickName,
      userId: user.userId,
      image: getProfileUrl(user.userId),
      discriminator: userManager.getUserDiscriminator(user.userId)
    });
  }

  return usersToReturn;
}

export function joinToGuild(inviteId: string) {
  const invitePattern = /\/join-guild\/(.+)$/;
  const match = inviteId.match(invitePattern);
  const id = match ? match[1] : inviteId;

  apiClient.send(EventType.JOIN_GUILD, { inviteId: id });
}

const leftGuilds = new Set<string>();

export function leaveCurrentGuild() {
  if (leftGuilds.has(currentGuildId)) {
    return;
  }

  leftGuilds.add(currentGuildId);
  apiClient.send(EventType.LEAVE_GUILD, { guildId: currentGuildId });
}
export function onLeaveGuild(guildId: string) {
  cacheInterface.removeGuild(guildId);
  if (guildId === currentGuildId) {
    loadDmHome();
  }
  removeFromGuildList(guildId);
}
export function handleKickMemberResponse(data: any) {
  const userId = data.userId;
  if (userId === currentUserId) {
    onLeaveGuild(data.guildId);
  } else {
    removeUserFromMemberList(userId);
  }
}
export function handleGuildMemberAdded(data: GuildMemberAddedMessage) {
  addUserToMemberList(data.userData);
}
//ui

let keybindHandlers: { [key: string]: (event: KeyboardEvent) => void } = {};
let isGuildKeyDown = false;
let currentGuildIndex = 1;

function clearKeybinds() {
  if (keybindHandlers["shift"]) {
    document.removeEventListener("keydown", keybindHandlers["shift"]);
  }
  keybindHandlers = {};
}

export function addKeybinds() {
  clearKeybinds();
  const guilds = Array.from(document.querySelectorAll("#guilds-list img"));

  const handler = (event: KeyboardEvent) => {
    if (!event.shiftKey) {
      return;
    }

    const key = event.key;

    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();

      if (isGuildKeyDown) {
        return;
      }

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
  const guildImg = getGuildFromBar(guildId);
  console.log(guildsList, guildImg);
  if (guildImg) {
    const parentLi = guildImg.closest("li");
    if (parentLi) {
      parentLi.remove();
    }
  }
}

export function updateGuildImage(uploadedGuildId: string) {
  const guildImages = guildsList.querySelectorAll("img");
  guildImages.forEach((img) => {
    if (img.id === uploadedGuildId) {
      setGuildPic(img, uploadedGuildId);
    }
  });
}

export function selectGuildList(guildId: string): void {
  if (!guildsList) {
    return;
  }

  const foundGuilds = Array.from(guildsList.querySelectorAll("img"));

  for (const guild of foundGuilds) {
    const guildParent = guild.parentElement;
    if (!guildParent) {
      continue;
    }
    if (guild.id === guildId) {
      wrapWhiteRod(guildParent);
      guildParent.classList.add("selected-guild");
    } else {
      guildParent.classList.remove("selected-guild");
      removeWhiteRod(guildParent);
    }
  }
}
export function createGuildContextLists() {
  const foundGuilds = Array.from(guildsList.querySelectorAll("img"));
  for (const guild of foundGuilds) {
    appendToGuildContextList(guild.id);
  }
}
export const createGuildListItem = (
  guildId: string,
  rootChannel: string,
  guildName: string,
  isUploaded: boolean,
  isOnLeftGuildList: boolean
) => {
  const listItem = createEl("li");
  const imgElement = createEl("img", {
    id: guildId,
    className: "guild-image"
  });

  setGuildPic(imgElement, guildId);

  imgElement.onerror = () => {
    imgElement.src = blackImage;
  };
  const elementToAddListener = isOnLeftGuildList ? imgElement : listItem;
  elementToAddListener.addEventListener("click", () => {
    try {
      loadGuild(guildId, getSeletedChannel(guildId, rootChannel), guildName);
    } catch (error) {
      console.error("Error while loading guild:", error);
    }
  });

  listItem.appendChild(imgElement);
  return listItem;
};

function createAndCacheGuildItem(guild: {
  guildId: string;
  guildName: string;
  isGuildUploadedImg: boolean;
  rootChannel: string;
  guildMembers: string[];
  ownerId: string;
  guildVersion: string;
}): HTMLElement {
  cacheInterface.setName(guild.guildId, guild.guildName);
  cacheInterface.setRootChannel(guild.guildId, guild.rootChannel);
  cacheInterface.setGuildOwner(guild.guildId, guild.ownerId);
  cacheInterface.setGuildVersion(guild.guildId, guild.guildVersion);
  cacheInterface.setMemberIds(guild.guildId, guild.guildMembers);

  return createGuildListItem(
    guild.guildId,
    guild.rootChannel,
    guild.guildName,
    guild.isGuildUploadedImg,
    true
  );
}

export function updateGuilds(guildsJson: Array<any>) {
  if (!guildsJson || !Array.isArray(guildsJson)) {
    console.error("Invalid guild data");
    return;
  }

  const fragment = document.createDocumentFragment();
  guildsList.innerHTML = "";

  const mainLogoItem = createMainLogo();
  fragment.appendChild(mainLogoItem);
  const pendingAlertMain = createEl("button", {
    className: "pendingAlert",
    id: "pendingAlertMain"
  });
  mainLogoItem.appendChild(pendingAlertMain);

  wrapWhiteRod(mainLogoItem);

  guildsJson.forEach((guild) => {
    const listItem = createAndCacheGuildItem(guild);
    fragment.appendChild(listItem);
  });

  const createGuildButton = createNewGuildButton();
  fragment.appendChild(createGuildButton);

  guildsList.appendChild(fragment);

  const selectedGuild = getGuildFromBar(currentGuildId);
  if (selectedGuild) {
    (selectedGuild.parentNode as HTMLElement).classList.add("selected-guild");
  }
}

export function addToGuildsList(guild: {
  guildId: string;
  guildName: string;
  isGuildUploadedImg: boolean;
  rootChannel: string;
  guildMembers: string[];
  ownerId: string;
  guildVersion: string;
}) {
  if (!guild || typeof guild !== "object") {
    console.error("Invalid guild data");
    return;
  }

  const listItem = createAndCacheGuildItem(guild);

  guildsList.appendChild(listItem);

  const createGuildButton = guildsList.querySelector("#create-guild-button");
  if (createGuildButton) {
    guildsList.appendChild(createGuildButton);
  }
}

export function wrapWhiteRod(element: HTMLElement) {
  if (!element) {
    return;
  }
  if (!element.querySelector(".white-rod")) {
    const whiteRod = createEl("div", { className: "white-rod" });
    element.appendChild(whiteRod);
  }
}
function removeWhiteRod(element: HTMLElement) {
  if (!element) {
    return;
  }
  const whiteRod = element.querySelector(".white-rod");
  if (!whiteRod) {
    return;
  }
  whiteRod.remove();
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

  createGuildImage.addEventListener("click", () => {
    showGuildPop();
  });

  createGuildButton.appendChild(createGuildImage);
  createGuildImage.appendChild(newElement);

  return createGuildButton;
}
function createMainLogo() {
  const mainLogoImg = createEl("img", {
    id: "main-logo",
    src: IMAGE_SRCS.ICON_SRC
  });

  const mainLogo = createEl("li");

  mainLogo.addEventListener("mouseover", () => {
    mainLogoImg.classList.add("rotate-element");
  });

  mainLogo.addEventListener("mouseleave", () => {
    mainLogoImg.classList.remove("rotate-element");
  });

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

function getGuildFromBar(guildId: string): HTMLElement | null {
  return (
    document.querySelector(`#guilds-list li img[id='${guildId}']`)
      ?.parentElement ?? null
  );
}
