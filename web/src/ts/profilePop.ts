import { cacheInterface, sharedGuildsCache } from "./cache.ts";
import { currentGuildId, createGuildListItem } from "./guild.ts";
import { createEl, getId, getAverageRGB, isMobile } from "./utils.ts";
import { friendsCache, addFriendId } from "./friends.ts";
import { loadDmHome, openDm } from "./app.ts";
import { createBubble } from "./userList.ts";
import { showContextMenu, contextList } from "./contextMenuActions.ts";
import { isImagePreviewOpen, hideImagePreview } from "./ui.ts";
import { setProfilePic } from "./avatar.ts";
import { translations } from "./translations.ts";
import { userManager } from "./user.ts";
import { SVG } from "./svgIcons.ts";
import { UserInfo } from "./types/interfaces.ts";
import { appState } from "./appState.ts";
import { createPopUp, closePopUp } from "./popups.ts";


export let currentProfileImg: HTMLElement;
let currentProfileDisplay: HTMLElement;


const SECTION = {
  ABOUT: "about",
  SHARED_GUILDS: "sharedGuilds",
  SHARED_FRIENDS: "sharedFriends"
} as const;

// --- Internal helpers

function closeCurrentProfileDisplay() {
  closePopUp(
    currentProfileDisplay,
    currentProfileDisplay.firstChild as HTMLElement
  );
}

function isMentionPopUp(parent: HTMLElement): boolean {
  return parent.dataset.isMentionPopup === "true";
}

function getSectionLabel(
  name: string,
  friendsCount?: number,
  guildsCount?: number
): string {
  switch (name) {
    case SECTION.SHARED_FRIENDS:
      return translations.getSharedFriendsPlaceholder(friendsCount ?? 0);
    case SECTION.SHARED_GUILDS:
      return translations.getSharedGuildsPlaceholder(guildsCount ?? 0);
    default:
      return translations.getTranslation(name);
  }
}

// --- Sub-builders

function buildProfileImage(userData: UserInfo): HTMLImageElement {
  const img = createEl("img", {
    className: "profile-display"
  }) as HTMLImageElement;
  img.crossOrigin = "anonymous";
  currentProfileImg = img;
  img.addEventListener("mouseover", () => {
    img.style.borderRadius = "0px";
  });
  img.addEventListener("mouseout", () => {
    img.style.borderRadius = "50%";
  });
  setProfilePic(img, userData.userId);
  return img;
}

function buildContextMenuButton(userData: UserInfo): HTMLElement {
  const btn = createEl("button", {
    id: userData.userId,
    className: "profile-dots3"
  });
  btn.appendChild(
    createEl("p", { className: "profile-dots3-text", textContent: "⋯" })
  );
  btn.addEventListener("click", (e: MouseEvent) => {
    const list = contextList[userData.userId];
    if (list) showContextMenu(e.pageX, e.pageY, list);
    else console.warn(`No context found for userId: ${userData.userId}`);
  });
  return btn;
}

function buildTopContainer(
  userData: UserInfo,
  profileImg: HTMLImageElement,
  addContextBtn: boolean
): HTMLElement {
  const container = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-top-container"
  });
  if (addContextBtn) container.appendChild(buildContextMenuButton(userData));
  profileImg.onload = () => {
    container.style.backgroundColor = getAverageRGB(profileImg);
  };
  return container;
}

function buildSendMsgButton(userData: UserInfo): HTMLElement {
  const btn = createEl("button", { className: "profile-send-msg-button" });
  btn.appendChild(createEl("div", { innerHTML: SVG.sendMessage }));
  btn.appendChild(
    createEl("span", { textContent: translations.getTranslation("message") })
  );

  btn.addEventListener("click", () => {
    loadDmHome();
    const pop = getId("profilePopContainer");
    if (pop) {
      if (pop.classList.contains("mention-profile-pop")) {
        pop.remove();
      } else {
        setTimeout(() => {
          const parent = pop.parentNode as HTMLElement;
          if (parent !== document.body) {
            isMentionPopUp(parent) ? pop.remove() : parent.remove();
          }
        }, 50);
      }
    }
    setTimeout(() => openDm(userData.userId), 0);
  });
  return btn;
}

function buildAddFriendButton(userData: UserInfo): HTMLElement {
  const isPending = friendsCache.hasRequestToFriend(userData.userId);
  const btn = createEl("button", {
    className: isPending
      ? "profile-add-friend-button profile-add-friend-button-pending"
      : "profile-add-friend-button"
  });

  // eslint-disable-next-line no-unsanitized/property
  btn.innerHTML = isPending
    ? `<div class="icon-container">${SVG.pendingFriend}</div>`
    : `<div class="icon-container">${SVG.addFriend}</div> ${translations.getTranslation("open-friends-button")}`;

  btn.addEventListener("click", () => {
    addFriendId(userData.userId);
    // Update button UI to pending state
    btn.classList.add("profile-add-friend-button-pending");
    btn.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = "";
      else if (node.nodeType === Node.ELEMENT_NODE) {
        // eslint-disable-next-line no-unsanitized/property
        (node as HTMLElement).innerHTML = SVG.pendingFriend;
      }
    });
  });
  return btn;
}

function buildOptionsContainer(userData: UserInfo): HTMLElement {
  const container = createEl("div", { className: "profile-options-container" });
  if (userData.userId === appState.currentUserId) return container;
  container.appendChild(buildSendMsgButton(userData));
  if (!friendsCache.isFriend(userData.userId)) {
    container.appendChild(buildAddFriendButton(userData));
  }
  return container;
}

function buildProfileContainer(userData: UserInfo): HTMLElement {
  const container = createEl("div", { id: "profile-container" });

  if (
    userData.userId === appState.currentUserId &&
    appState.currentDiscriminator
  ) {
    userData.discriminator = appState.currentDiscriminator;
  }

  container.appendChild(
    createEl("p", {
      id: "profile-title",
      textContent: userManager.getUserNick(userData.userId)
    })
  );
  container.appendChild(
    createEl("p", {
      id: "profile-discriminator",
      textContent: "#" + userData.discriminator
    })
  );
  container.appendChild(buildOptionsContainer(userData));
  return container;
}

function buildSharedGuildsList(sharedGuilds: string[]): HTMLElement {
  const section = createEl("div", {
    className: "shared-guilds-content",
    style: "display: none; overflow-y: auto; max-height: 200px;"
  });
  const list = createEl("ul", { className: "guilds-list shared-guilds-list" });

  sharedGuilds.forEach((guildId) => {
    const rootChannel = cacheInterface.getRootChannel(guildId);
    if (!rootChannel) return;
    const guildName = cacheInterface.getGuildName(guildId) as string;
    const isUploaded = cacheInterface.getIsUploaded(guildId) as boolean;
    const item = createGuildListItem(
      guildId,
      rootChannel.channelId,
      guildName,
      isUploaded,
      false
    );
    item.appendChild(
      createEl("p", { textContent: guildName, style: { marginLeft: "20px" } })
    );
    list.appendChild(item);
    list.addEventListener("click", closeCurrentProfileDisplay);
  });

  section.appendChild(list);
  return section;
}

function buildBottomContainer(
  description: string | undefined,
  sharedGuilds: string[],
  sharedFriends: string[] | null,
  userId: string,
  memberSince?: string
): HTMLElement {
  const container = createEl("div", {
    className: "popup-bottom-container",
    id: "profile-popup-bottom-container"
  });

  const aboutContent = createEl("div", {
    innerHTML: `
      <p id="profile-about-description">${description ?? ""}</p>
      ${
        memberSince
          ? `<p>${translations.getTranslation("member-since")}:</p>
           <p id="profile-member-since">${new Date(
             memberSince
           ).toLocaleDateString(translations.getLocale(), {
             year: "numeric",
             month: "long",
             day: "numeric"
           })}</p>`
          : ""
      }
    `
  });

  type Section = { name: string; content: HTMLElement; line?: HTMLElement };
  const sections: Section[] = [{ name: SECTION.ABOUT, content: aboutContent }];

  if (userId !== appState.currentUserId) {
    sections.push({
      name: SECTION.SHARED_GUILDS,
      content: buildSharedGuildsList(sharedGuilds)
    });

    const friendsSection = createEl("div", {
      className: "shared-friends-content",
      style: "display: none; overflow-y: auto; max-height: 200px;"
    });
    // eslint-disable-next-line no-unsanitized/property
    friendsSection.innerHTML = sharedFriends
      ? sharedFriends.map((f) => `<p>${f}</p>`).join("")
      : "";
    sections.push({ name: SECTION.SHARED_FRIENDS, content: friendsSection });
  }

  const sectionsBar = createEl("div", { className: "profile-sections-bar" });
  const contentContainer = createEl("div", { className: "profile-content" });

  function showSection(target: Section) {
    sections.forEach((s) => {
      s.content.style.display = "none";
      s.line?.classList.remove("selected");
    });
    target.content.style.display = "block";
    target.line?.classList.add("selected");
  }

  sections.forEach((section) => {
    const btn = createEl("button", {
      className: "profile-section-button",
      textContent: getSectionLabel(
        section.name,
        section.name === SECTION.SHARED_FRIENDS
          ? sharedFriends?.length
          : undefined,
        section.name === SECTION.SHARED_GUILDS
          ? sharedGuilds?.length
          : undefined
      )
    });
    const line = createEl("hr", {
      className: "profile-sections-line profile-section-line-button"
    });
    section.line = line;
    btn.appendChild(line);
    btn.addEventListener("click", () => showSection(section));
    sectionsBar.appendChild(btn);
    contentContainer.appendChild(section.content);
  });

  showSection(sections[0]);

  container.appendChild(sectionsBar);
  container.appendChild(createEl("hr", { className: "profile-sections-line" }));
  container.appendChild(contentContainer);
  return container;
}

/** Builds UserInfo from a userId string. */
export function constructUserData(userId: string): UserInfo {
  return {
    userId,
    discriminator: userManager.getUserDiscriminator(userId),
    nickName: userManager.getUserDiscriminator(userId)
  };
}

/** Draws a profile popup by userId. */
export async function drawProfilePopId(
  id: string,
  shouldDrawPanel = false
): Promise<HTMLElement | null> {
  return drawProfilePop(constructUserData(id), shouldDrawPanel);
}

/** Core profile popup renderer. Returns the popup container or null if already open. */
export async function drawProfilePop(
  userData: UserInfo,
  shouldDrawPanel = false
): Promise<HTMLElement | null> {
  if (!userData) {
    console.error("Null user data requested profile draw", userData);
    return null;
  }

  const existing = getId("profilePopContainer");
  const isMention = existing ? isMentionPopUp(existing) : false;

  if (existing && !isMention) return null;
  if (isMention) existing?.remove();
  if (isImagePreviewOpen()) hideImagePreview();

  const profileImg = buildProfileImage(userData);
  const topContainer = buildTopContainer(
    userData,
    profileImg,
    !shouldDrawPanel
  );
  const profileContainer = buildProfileContainer(userData);

  profileContainer.prepend(profileImg);
  profileContainer.insertBefore(topContainer, profileContainer.firstChild);

  const sharedGuilds = sharedGuildsCache.getFriendGuilds(
    userData.userId,
    currentGuildId
  );
  const bottomContainer = shouldDrawPanel
    ? null
    : buildBottomContainer(
        userData.description,
        sharedGuilds,
        null,
        userData.userId,
        userData.createdAt
      );

  const status = await userManager.getStatusString(userData.userId);
  const bubble = createBubble(status);

  const contentElements: HTMLElement[] = [
    topContainer,
    profileImg,
    bubble,
    profileContainer,
    ...(bottomContainer ? [bottomContainer] : [])
  ];

  const pop = createPopUp({
    contentElements,
    id: "profilePopContainer",
    shouldDrawPanel
  });
  if (!shouldDrawPanel) currentProfileDisplay = pop;
  return pop;
}

/**
 * Draws a compact profile popup anchored near a message element (for @mentions).
 */
export async function createMentionProfilePop(
  baseMessage: HTMLElement,
  userId: string,
  topOffset = 0
): Promise<HTMLElement | null> {
  const container = await drawProfilePopId(userId);
  if (!container) return null;

  const pop = container.querySelector(".pop-up") as HTMLElement;
  if (!pop) return null;

  document.body.appendChild(pop);
  container.remove();

  pop.querySelector("#profile-popup-bottom-container")?.remove();

  const topContainer = pop.querySelector(
    "#profile-popup-top-container"
  ) as HTMLElement;
  if (topContainer)
    Object.assign(topContainer.style, { height: "30%", top: "15.4%" });

  Object.assign(pop.style, {
    animation: "unset",
    backgroundColor: "rgb(36,36,41)",
    position: "absolute",
    zIndex: "10"
  });
  pop.style.width = isMobile ? "62vw" : "17vw";

  // Positioning logic
  const rect = baseMessage.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const { innerHeight: vh, innerWidth: vw } = window;
  const popH = pop.offsetHeight || vh * 0.45;
  const popW = pop.offsetWidth || vw * 0.25;
  const THRESHOLD = 150;

  let top: number;
  if (vh - rect.bottom < THRESHOLD) top = scrollTop + vh - popH + 100;
  else if (rect.top < THRESHOLD) top = scrollTop + 320;
  else top = scrollTop + rect.bottom - 50;

  top += topOffset;
  const left = Math.min(
    Math.max(scrollLeft + rect.left + 50, scrollLeft + 20),
    scrollLeft + vw - popW - 20
  );

  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
  pop.style.height = "";
  pop.dataset.isMentionPopup = "true";

  // Style tweaks for compact mention variant
  const profileDisplay = pop.querySelector(".profile-display") as HTMLElement;
  if (profileDisplay)
    Object.assign(profileDisplay.style, { width: "80px", top: "7vh" });

  const statusBubble = pop.querySelector(".status-bubble") as HTMLElement;
  if (statusBubble)
    Object.assign(statusBubble.style, { top: "5em", left: "3.5em" });

  const profContainer = pop.querySelector("#profile-container") as HTMLElement;
  if (profContainer) {
    profContainer.style.marginTop = "18vh";

    const title = profContainer.querySelector("#profile-title") as HTMLElement;
    if (title) title.style.marginTop = "30px";

    const disc = profContainer.querySelector(
      "#profile-discriminator"
    ) as HTMLElement;
    if (disc) Object.assign(disc.style, { fontSize: "1em", marginTop: "4em" });

    const opts = profContainer.querySelector(
      ".profile-options-container"
    ) as HTMLElement;
    if (opts) {
      Object.assign(opts.style, {
        bottom: "10px",
        justifyContent: "center",
        right: "50%",
        transform: "translateX(50%)"
      });
      [".profile-send-msg-button", ".profile-add-friend-button"].forEach(
        (sel) => {
          const btn = opts.querySelector(sel) as HTMLElement;
          if (btn)
            Object.assign(btn.style, {
              width: "15vw",
              height: "40px",
              marginRight: "0px"
            });
        }
      );
    }
  }

  return pop;
}
