import { currentGuildId } from "./guild";
import { createTooltip } from "./tooltip";
import { translations } from "./translations";
import { userManager } from "./user";
import {
  escapeHtml,
  getEmojiPath,
  getId,
  getProfileUrl,
  IMAGE_SRCS
} from "./utils";

export let currentEmojis: Emoji[];

function generateEmojiRowHTML(emoji: Emoji): string {
  const debounceTimeout: number = 1000;
  let debounceTimer: number;

  const changeEmojiName = (event: Event, guildId: string, emojiId: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const name = (event.target as HTMLTextAreaElement).value;
      fetch(`/api/guilds/${guildId}/emojis/${emojiId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(name)
      });
    }, debounceTimeout);
  };

  const html = `
  <tr class="table-row" id="emoji-row-${emoji.fileId}">
    <td class="table-cell">
      <img src="/guilds/${emoji.guildId}/emojis/${emoji.fileId}" alt="${escapeHtml(emoji.fileName)}" class="emoji-image" onerror="this.src='${IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC}';">
    </td>
    <td class="table-cell emoji-name-cell">
      <div style="display: flex; align-items: center;">
        <div class="colon" style="margin-bottom: 5px">:</div>
        <textarea class="textarea" id="emoji-${emoji.fileId}" style="flex: 1; margin-left: 0; padding-top: 10px;">${escapeHtml(emoji.fileName)}</textarea>
        <div class="colon" style=" margin-bottom: 5px">:</div>
      </div>
    </td>
    <td class="table-cell">
      <div style="display: flex; align-items: center; justify-content: center;">
        <img src=${getProfileUrl(emoji.userId)} alt="${escapeHtml(userManager.getUserNick(emoji.userId))}" class="profile-image" onerror="this.src='${IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC}';">
        <span style="margin-left: 8px;">${escapeHtml(userManager.getUserNick(emoji.userId))}</span>
      </div>
    </td>
    <td class="table-cell">
      <button class="emoji-delete-button" data-guild-id="${emoji.guildId}" data-emoji-id="${emoji.fileId}">
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
          <path fill="currentColor" d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z"></path>
        </svg>
      </button>
    </td>
  </tr>
  `;

  setTimeout(() => {
    const textarea = document.getElementById(
      `emoji-${emoji.fileId}`
    ) as HTMLTextAreaElement;
    if (textarea) {
      const span = document.createElement("span");
      span.style.visibility = "hidden";
      span.style.whiteSpace = "pre";
      span.style.position = "absolute";
      span.style.font = getComputedStyle(textarea).font;
      document.body.appendChild(span);

      const adjustWidth = () => {
        span.textContent = textarea.value || " ";
        textarea.style.width = `${span.offsetWidth + 5}px`;
      };

      textarea.addEventListener("input", (event) => {
        adjustWidth();
        changeEmojiName(event, emoji.guildId, emoji.fileId);
      });

      adjustWidth();
    }

    const deleteButton = document.querySelector(
      `button[data-emoji-id="${emoji.fileId}"]`
    );
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        deleteEmoji(emoji.guildId, emoji.fileId);
      });
    }
  }, 0);

  return html;
}

function deleteEmoji(guildId: string, emojiId: string) {
  fetch(`/api/guilds/${guildId}/emojis/${emojiId}`, {
    method: "DELETE"
  }).then(() => {
    const row = getId(`emoji-row-${emojiId}`);
    if (row) row.remove();
    currentEmojis = currentEmojis.filter((e) => e.fileId !== emojiId);
    generateEmojiCount();
  });
}

function generateEmojiCount(): void {
  const emojiCount = getId("emoji-count");
  const maxEmojis = 100;
  const availableCount = currentEmojis
    ? maxEmojis - currentEmojis.length
    : maxEmojis;
  const countText = `Emoji — ${availableCount} ${translations.getSettingsTranslation("EmojiCount")}`;
  if (emojiCount) {
    emojiCount.textContent = countText;
  }
}

export function populateEmojis(): void {
  fetch(`/api/guilds/${currentGuildId}/emojis`)
    .then((response) => {
      if (response.status === 404) {
        generateEmojiCount();
        return Promise.reject("Emojis not found");
      }
      return response.json();
    })
    .then((emojis: Array<Emoji>) => {
      currentEmojis = emojis;
      generateEmojiCount();

      const emojiTableBody = getId("emoji-table-body");
      const emojiTableHeader = document.querySelector("thead");

      if (emojiTableBody && emojiTableHeader) {
        const headerHTML = generateHeaderHTML();
        emojiTableHeader.innerHTML = headerHTML;

        const bodyHTML = emojis.map(generateEmojiRowHTML).join("");
        emojiTableBody.innerHTML = bodyHTML;
      }
    })
    .catch((error) => {
      console.error("Error fetching emojis:", error);
    });
}

type Emoji = {
  guildId: string;
  userId: string;
  fileId: string;
  fileName: string;
};

function generateHeaderHTML(): string {
  return `
    <tr>
      <th class="table-header">${translations.getSettingsTranslation("Image")}</th>
      <th class="table-header table-header-name">${translations.getSettingsTranslation("Name")}</th>
      <th class="table-header table-header-uploader">${translations.getSettingsTranslation("Uploader")}</th>
    </tr>
  `;
}

export function getGuildEmojiHtml(): string {
  const initialHtml = `
    <h2>Emoji</h2>
    <div class="emoji-container">
      <p class="emoji-description">${translations.getSettingsTranslation("EmojiDescription")}</p>
      <p class="emoji-requirements">${translations.getSettingsTranslation("EmojiRequirements")}</p>
      <ul class="emoji-requirement-list">
        <li class="emoji-requirement">${translations.getSettingsTranslation("EmojiRequirementDetails1")}</li>
        <li class="emoji-requirement">${translations.getSettingsTranslation("EmojiRequirementDetails2")}</li>
        <li class="emoji-requirement">${translations.getSettingsTranslation("EmojiRequirementDetails3")}</li>
        <li class="emoji-requirement">${translations.getSettingsTranslation("EmojiRequirementDetails4")}</li>
      </ul>
      <button id="upload-emoji-button" class="settings-button">${translations.getSettingsTranslation("UploadEmoji")}</button>
      <input type="file" name="emojiImage" id="emoijImage" accept="image/*" class="emoji-file-input" multiple>
      <hr class="emoji-divider">
      <h4 id="emoji-count"></h4>
      <div class="emoji-table-container">
        <table class="emoji-table">
          <thead>
            <tr>
              <th class="emoji-table-header">${translations.getSettingsTranslation("Image")}</th>
              <th class="emoji-table-header">${translations.getSettingsTranslation("Name")}</th>
              <th class="emoji-table-header">${translations.getSettingsTranslation("Uploader")}</th>
            </tr>
          </thead>
          <tbody id="emoji-table-body"></tbody>
        </table>
      </div>
    </div>
  `;
  return initialHtml;
}

const regexIdEmojis = /:(\d+):/g;

export function createEmojiImgTag(fileId: string): string {
  return `<img data-id="${fileId}" class="chat-emoji" src="${getEmojiPath(fileId, currentGuildId)}" alt="Emoji ${getEmojiName(fileId)}" />`;
}

export function replaceCustomEmojisForChatContainer(content: string): string {
  if (!content || !currentEmojis) return content;

  return content.replace(regexIdEmojis, (match, emojiId) => {
    const emoji = currentEmojis.find((e) => e.fileId === emojiId);
    if (emoji) return createEmojiImgTag(emoji.fileId);
    return match;
  });
}

function getEmojiName(emojiId: string): string {
  return (
    currentEmojis.find((emoji) => emoji.fileId === emojiId)?.fileName || ""
  );
}

function handleEmojiHover(element: HTMLElement, emojiName: string): void {
  console.log("Clicked emoji:", element, emojiName);
  createTooltip(element, emojiName);
}

function handleEmojiListener(element: HTMLElement, emojiId: string): void {
  const emojiName = getEmojiName(emojiId);
  element.addEventListener("mouseover", () =>
    handleEmojiHover(element, emojiName)
  );
}

export function setupEmojiListeners(container: HTMLElement): void {
  const emojiElements = container.querySelectorAll(
    ".chat-emoji"
  ) as NodeListOf<HTMLElement>;

  emojiElements.forEach((el) => {
    const dataId = el.getAttribute("data-id");
    if (dataId) {
      handleEmojiListener(el, dataId);
    }
  });
}

export function getIdFromEmojiName(name: string): string {
  return currentEmojis.find((emoji) => emoji.fileName === name)?.fileId || "";
}
