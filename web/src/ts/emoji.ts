import { apiClient, EventType } from "./api";
import { getProfileUrl } from "./avatar";
import { cacheInterface } from "./cache";
import {
  adjustHeight,
  chatInput,
  getChatBarState,
  manuallyRenderEmojis,
  setChatBarState,
  setEmojiSuggestionsVisible
} from "./chatbar";
import { currentGuildId } from "./guild";
import { permissionManager } from "./guildPermissions";
import { getTextUpToCursorFromNode } from "./navigation";
import { isOnGuild, router } from "./router";
import { SVG } from "./svgIcons";
import { createTooltip } from "./tooltip";
import { translations } from "./translations";
import { Emoji } from "./types/interfaces";
import { userManager } from "./user";
import {
  createEl,
  debounce,
  disableElement,
  escapeHtml,
  getEmojiPath,
  getId,
  IMAGE_SRCS,
  sanitizeHtmlInput,
  sanitizeInput,
  underscoreToTitle
} from "./utils";

const spriteWidth = 40;
const spriteHeight = 40;
const sheetWidth = 1680;
const columns = Math.floor(sheetWidth / spriteWidth);
const emojiSuggestionDropdown = getId(
  "emojiSuggestionDropdown"
) as HTMLSelectElement;

type CustomEmoji = {
  guildId: string;
  userId: string;
  fileId: string;
  fileName: string;
};
type BuiltinEmoji = {
  id: string;
  names: string[];
  spriteIndex: number;
  surrogates: string;
};

let builtinEmojisCache: BuiltinEmoji[] = [];

interface BuiltinEmojiPayload {
  emojis: Record<
    string,
    {
      names: string[];
      surrogates: string;
      unicodeVersion: number;
      spriteIndex: number;
    }
  >;
  emojisByCategory: any;
  nameToEmoji: any;
  surrogateToEmoji: any;
  numDiversitySprites: number;
  numNonDiversitySprites: number;
}

function getCurrentEmojis(): Emoji[] | null {
  if (isOnGuild) {
    return cacheInterface.getEmojis(currentGuildId);
  } else {
    return null;
  }
}

const changeEmojiNameHandler = (
  event: Event,
  guildId: string,
  emojiId: string
) => {
  const name = (event.target as HTMLTextAreaElement).value;
  apiClient.send(EventType.CHANGE_EMOJI_NAME, { guildId, emojiId, name });
};

const changeEmojiName = debounce(changeEmojiNameHandler, 1000);

function generateEmojiRowHTML(emoji: Emoji): string {
  const canManageEmojis = permissionManager.canManageGuild();

  const html = `
  <tr class="table-row" id="emoji-row-${emoji.fileId}">
    <td class="table-cell">
      <img src="${getEmojiPath(emoji.fileId, emoji.guildId)}" alt="${escapeHtml(emoji.fileName)}" class="emoji-image" onerror="this.src='${IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC}';">
    </td>
    <td class="table-cell emoji-name-cell">
      <div style="display: flex; align-items: center;">
        <div class="colon" style="margin-bottom: 5px">:</div>
        <textarea class="textarea" id="emoji-${emoji.fileId}" style="flex: 1; margin-left: 0; padding-top: 10px;" ${canManageEmojis ? "" : "readonly"}>${escapeHtml(emoji.fileName)}</textarea>
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
      <button class="emoji-delete-button" data-guild-id="${emoji.guildId}" data-emoji-id="${emoji.fileId}" ${canManageEmojis ? "" : "disabled style='opacity: 0.5; pointer-events: none;'"} >
        ${SVG.closeBtn}
      </button>
    </td>
  </tr>
  `;

  setTimeout(() => {
    const textarea = document.getElementById(
      `emoji-${emoji.fileId}`
    ) as HTMLTextAreaElement;
    if (textarea && canManageEmojis) {
      const span = createEl("span", {
        style: {
          visibility: "hidden",
          whiteSpace: "pre",
          position: "absolute",
          font: getComputedStyle(textarea).font
        }
      });

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
    if (deleteButton && canManageEmojis) {
      deleteButton.addEventListener("click", () => {
        deleteEmoji(emoji.guildId, emoji.fileId);
      });
    }
  }, 0);

  return html;
}

function deleteEmoji(guildId: string, emojiId: string) {
  apiClient.send(EventType.DELETE_EMOJI, { guildId, emojiId }).then(() => {
    const row = getId(`emoji-row-${emojiId}`);
    if (row) {
      row.remove();
    }
    cacheInterface.removeEmojis(guildId, emojiId);
    generateEmojiCount();
  });
}

function generateEmojiCount(): void {
  const emojiCount = getId("emoji-count");
  const maxEmojis = 100;
  const currentEmojis = getCurrentEmojis();
  const availableCount = currentEmojis
    ? maxEmojis - currentEmojis.length
    : maxEmojis;
  const countText = `Emoji — ${availableCount} ${translations.getSettingsTranslation("EmojiCount")}`;
  if (emojiCount) {
    emojiCount.textContent = countText;
  }
}

function renderEmojis(emojis: Array<Emoji>): void {
  const emojiTableBody = getId("emoji-table-body");
  const emojiTableHeader = document.querySelector("thead");

  if (emojiTableBody && emojiTableHeader) {
    const headerHTML = generateHeaderHTML();

    emojiTableHeader.innerHTML = headerHTML;

    const bodyHTML = emojis.map(generateEmojiRowHTML).join("");

    emojiTableBody.innerHTML = bodyHTML;
  }
}

export function populateEmojis(): void {
  generateEmojiCount();

  if (cacheInterface.doesEmojisForGuildExist(currentGuildId)) {
    const emojis = cacheInterface.getEmojis(currentGuildId);
    if (emojis) {
      renderEmojis(emojis);
    }
    return;
  }

  if (cacheInterface.isEmojisLoading(currentGuildId)) {
    return;
  }

  cacheInterface.setEmojisLoading(currentGuildId, true);

  apiClient
    .getEmojis()
    .then((response) => {
      if (response.status === 404) {
        return Promise.reject("Emojis not found");
      }
      return response.json();
    })
    .then((emojis: Array<Emoji>) => {
      cacheInterface.setEmojis(currentGuildId, emojis);
      cacheInterface.setEmojisLoading(currentGuildId, false);
      generateEmojiCount();
      renderEmojis(emojis);
    })
    .catch((error) => {
      console.error("Error fetching emojis:", error);

      if (error !== "Emojis not found") {
        cacheInterface.setEmojisLoading(currentGuildId, false);
      }
    });
}

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
  const canManageEmojis = permissionManager.canManageGuild();
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
      <button id="upload-emoji-button" class="settings-button" ${canManageEmojis ? "" : "disabled style='opacity: 0.5; pointer-events: none;'"}>${translations.getSettingsTranslation("UploadEmoji")}</button>
      <input type="file" name="emojiImage" id="emoijImage" accept="image/*" class="emoji-file-input" multiple ${canManageEmojis ? "" : "disabled"}>
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

let builtinEmojiPayload: BuiltinEmojiPayload | null = null;

async function loadBuiltinEmojis(): Promise<void> {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/emojis.json"
    );
    if (!response.ok) {
      builtinEmojisCache = [];
      builtinEmojiPayload = null;
      return;
    }
    const data = await response.json();
    builtinEmojiPayload = data as BuiltinEmojiPayload;

    builtinEmojisCache = Object.entries(builtinEmojiPayload.emojis).map(
      ([id, e]) => ({
        id,
        names: e.names,
        spriteIndex: e.spriteIndex,
        surrogates: e.surrogates
      })
    );
  } catch {
    builtinEmojisCache = [];
    builtinEmojiPayload = null;
  }
}

const regexIdEmojis = /:([0-9A-Fa-f]+):/g;
const regexUserMentions = /<@(\d{18})>/g;
const regexChannelMentions = /<#(\d{19})>/g;

export function replaceCustomEmojisForChatContainer(content: string): string {
  if (!content) return "";

  const customEmojisToUse: CustomEmoji[] = getCurrentEmojis() ?? [];

  const customUnified = customEmojisToUse.map((e) => ({
    id: e.fileId,
    emoji: e.fileName
  }));

  const builtinUnified = builtinEmojisCache.map((e) => ({
    id: e.id,
    emoji: e.names[0]
  }));

  const emojisToUse = [...customUnified, ...builtinUnified];

  if (emojisToUse.length === 0) {
    return escapeHtml(content);
  }

  const emojiMap = new Map(emojisToUse.map((e) => [e.id, e]));

  const parts: Array<{
    type: "text" | "emoji" | "user" | "channel";
    content: string;
    data?: any;
  }> = [];
  let lastIndex = 0;

  const allMatches: Array<{
    match: RegExpMatchArray;
    type: "emoji" | "user" | "channel";
  }> = [];

  let match;
  regexIdEmojis.lastIndex = 0;
  while ((match = regexIdEmojis.exec(content)) !== null) {
    allMatches.push({ match, type: "emoji" });
  }

  regexUserMentions.lastIndex = 0;
  while ((match = regexUserMentions.exec(content)) !== null) {
    allMatches.push({ match, type: "user" });
  }

  regexChannelMentions.lastIndex = 0;
  while ((match = regexChannelMentions.exec(content)) !== null) {
    allMatches.push({ match, type: "channel" });
  }

  allMatches.sort((a, b) => a.match.index! - b.match.index!);

  for (const { match: _match, type } of allMatches) {
    const start = _match.index!;
    const end = start + _match[0].length;

    if (start > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, start) });
    }

    if (type === "emoji") {
      const emojiId = _match[1];
      const emoji = emojiMap.get(emojiId);
      if (emoji) {
        parts.push({ type: "emoji", content: "", data: { id: emojiId } });
      } else {
        parts.push({ type: "text", content: _match[0] });
      }
    } else if (type === "user") {
      const userId = _match[1];
      const user = userManager.getUserInfo(userId);
      const nick = user?.nickName ?? "Unknown";
      parts.push({ type: "user", content: "", data: { userId, nick } });
    } else if (type === "channel") {
      const channelId = _match[1];
      const name = cacheInterface.getChannelNameWithoutGuild(channelId);
      if (name) {
        parts.push({ type: "channel", content: "", data: { channelId, name } });
      } else {
        parts.push({ type: "text", content: _match[0] });
      }
    }

    lastIndex = end;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return escapeHtml(part.content);
        case "emoji":
          return generateEmojiTag(part.data.id);
        case "user":
          return generateUserMention(part.data.userId, part.data.nick);
        case "channel":
          return generateChannelMention(part.data.channelId, part.data.name);
        default:
          return "";
      }
    })
    .join("");
}

function generateEmojiTag(id: string): string {
  const builtinIndex = builtinEmojisCache.findIndex((e) => e.id === id);

  if (builtinIndex !== -1) {
    const col = builtinIndex % columns;
    const row = Math.floor(builtinIndex / columns);
    const x = -(col * spriteWidth);
    const y = -(row * spriteHeight);

    return `<div data-emoji-id="${sanitizeInput(id)}" data-id="${sanitizeInput(id)}" alt="Emoji ${sanitizeInput(cacheInterface.getEmojiName(id))}" class="emoji builtin-emoji" style="width:${spriteWidth}px; height:${spriteHeight}px; background-position: ${x}px ${y}px;"></div>`;
  } else {
    return `<img data-id="${sanitizeInput(id)}" class="chat-emoji" src="${getEmojiPath(id, currentGuildId)}" alt="Emoji ${sanitizeInput(cacheInterface.getEmojiName(id))}" />`;
  }
}

function generateUserMention(userId: string, nick: string): string {
  return `<button class="mention" type="button" data-user-id="${sanitizeInput(userId)}">@${escapeHtml(nick)}</button>`;
}

function generateChannelMention(channelId: string, name: string): string {
  return `<button class="mention" type="button" data-channel-id="${sanitizeInput(channelId)}">#${escapeHtml(name)}</button>`;
}

function getEmojiCode(builtinIndex: number): string | null {
  const emoji = builtinEmojisCache[builtinIndex];
  if (!emoji) {
    return null;
  }
  return `:${emoji.id}:`;
}

export function appendBuiltinEmojiChat(builtinIndex: number) {
  const emojiCode = getEmojiCode(builtinIndex);
  if (!emojiCode) {
    return;
  }

  appendEmojiToInput(emojiCode);
}

function handleEmojiHover(element: HTMLElement, emojiName: string): void {
  createTooltip(element, emojiName);
}

function isBuiltinEmoji(emojiId: string): boolean {
  return builtinEmojisCache.findIndex((e) => e.id === emojiId) !== -1;
}
function isCustomEmoji(
  emoji: CustomEmoji | BuiltinEmoji
): emoji is CustomEmoji {
  return (emoji as CustomEmoji).fileName !== undefined;
}

function getBuiltinEmojiName(emojiId: string) {
  const emoji = builtinEmojisCache.find((e) => e.id === emojiId);
  return emoji ? underscoreToTitle(emoji.names[0]) : "Unknown";
}

let emojiListenerAdded = false;

export function setupEmojiListeners(): void {
  if (emojiListenerAdded) {
    return;
  }
  emojiListenerAdded = true;

  document.body.addEventListener("mouseover", (event) => {
    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }

    if (
      target.classList.contains("builtin-emoji") ||
      target.classList.contains("chat-emoji")
    ) {
      const dataId = target.getAttribute("data-id");
      if (!dataId) {
        return;
      }

      if (isBuiltinEmoji(dataId)) {
        handleEmojiHover(target, getBuiltinEmojiName(dataId));
      } else {
        const emojiName = cacheInterface.getEmojiName(dataId);
        handleEmojiHover(target, emojiName);
      }
    }
  });
}

export function preserveEmojiContent(element: HTMLElement): string {
  let result = "";

  const walkNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.tagName === "IMG" && el.hasAttribute("data-emoji-id")) {
        const dataId = el.getAttribute("data-emoji-id");
        if (dataId) {
          result += `:${dataId}:`;
        } else {
          result += el.getAttribute("alt") || "";
        }
      } else if (
        el.tagName === "DIV" &&
        el.classList.contains("emoji") &&
        el.hasAttribute("data-emoji-id")
      ) {
        const emojiId = el.getAttribute("data-emoji-id");
        if (emojiId) {
          result += `:${emojiId}:`;
        } else {
          result += el.getAttribute("alt") || "";
        }
        Array.from(el.childNodes).forEach(walkNode);
      } else if (el.hasChildNodes()) {
        Array.from(el.childNodes).forEach(walkNode);
      }
    }
  };

  Array.from(element.childNodes).forEach(walkNode);
  return result;
}
export function renderEmojisFromContent(content: string): string {
  let result = "";
  let i = 0;
  const emojis = getCurrentEmojis() || [];

  while (i < content.length) {
    if (content[i] === ":") {
      if (content[i + 1] === ":") {
        result += ":";
        i += 2;
        continue;
      }

      const end = content.indexOf(":", i + 1);

      if (end !== -1) {
        const emojiId = content.slice(i + 1, end);
        const isBuiltin = isBuiltinEmoji(emojiId);
        const isCustom =
          emojiId.length === router.ID_LENGTH &&
          emojis.some((e) => e.fileId === emojiId);

        if (isBuiltin || isCustom) {
          result += generateEmojiTag(emojiId);
          i = end + 1;
          continue;
        }
      }

      result += ":";
      i++;
    } else {
      result += escapeHtml(content[i]);
      i++;
    }
  }

  return result;
}

function triggerEmojiSuggestionDisplay(textContext: string) {
  const customEmojis: CustomEmoji[] = getCurrentEmojis() ?? [];

  const lastColonIndex = textContext.lastIndexOf(":");
  const emojiQuery =
    lastColonIndex !== -1 ? textContext.slice(lastColonIndex + 1).trim() : "";

  if (!emojiQuery) {
    return;
  }

  const lowerQuery = emojiQuery.toLowerCase();

  const matching: (CustomEmoji | BuiltinEmoji)[] = [];

  const allEmojis = [...builtinEmojisCache, ...customEmojis];

  for (const emoji of allEmojis) {
    if (matching.length >= 50) {
      break;
    }

    if (isCustomEmoji(emoji)) {
      const name = emoji.fileName.toLowerCase();
      if (name.includes(lowerQuery)) {
        matching.push(emoji);
      }
    } else {
      if (emoji.names.some((n) => n.toLowerCase().includes(lowerQuery))) {
        matching.push(emoji);
      }
    }
  }

  if (matching.length === 0) {
    const state = getChatBarState();
    state.emojiSuggestionsVisible = false;
    setChatBarState(state);
    emojiSuggestionDropdown.style.display = "none";
    return;
  }

  emojiSuggestionDropdown.innerHTML = "";
  setEmojiSuggestionsVisible(false);

  for (const emoji of matching) {
    const emojiId = "fileId" in emoji ? emoji.fileId : emoji.id;
    const emojiLabel = "fileName" in emoji ? emoji.fileName : emoji.names[0];

    const suggestion = createEl("div", { className: "suggestion-option" });

    const emojiTag = generateEmojiTag(emojiId);

    suggestion.innerHTML = emojiTag;

    const labelSpan = createEl("span", {
      className: "suggestion-label",
      textContent: underscoreToTitle(emojiLabel)
    });

    suggestion.appendChild(labelSpan);

    suggestion.dataset.id = emojiId;

    suggestion.addEventListener("click", () => {
      emojiSuggestionDropdown
        .querySelectorAll(".suggestion-option")
        .forEach((el) => el.classList.remove("active"));
      suggestion.classList.add("active");
      applyActiveEmojiSuggestion();
    });

    emojiSuggestionDropdown.appendChild(suggestion);
  }

  setEmojiSuggestionsVisible(true);
  emojiSuggestionDropdown.style.display = "flex";
  highlightSuggestion(0);
}

//#region Emoji Suggestions
function hideEmojiSuggestions() {
  const state = getChatBarState();
  state.emojiSuggestionsVisible = false;
  disableElement("emojiSuggestionDropdown");
  const dd = getId("emojiSuggestionDropdown");
  if (dd) {
    dd.innerHTML = "";
  }
}

function showEmojiSuggestions() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const currentNode = range.startContainer;
  const currentOffset = range.startOffset;

  const textUpToCursor = getTextUpToCursorFromNode(currentNode, currentOffset);
  const safe = sanitizeHtmlInput(textUpToCursor);
  triggerEmojiSuggestionDisplay(safe);
}

export function toggleShowEmojiSuggestions() {
  const state = getChatBarState();
  const textBeforeCursor = state.rawContent.slice(0, state.cursorPosition);

  const emojiTriggerMatch = textBeforeCursor.match(/:([\w-]*)$/);

  if (emojiTriggerMatch) {
    showEmojiSuggestions();
  } else {
    hideEmojiSuggestions();
  }
}

function appendEmojiToInput(text: string) {
  if (!chatInput) return;
  const state = getChatBarState();

  const raw = state.rawContent;
  const cursorPos = state.cursorPosition;

  let startIndex = cursorPos - 1;
  while (startIndex >= 0 && raw[startIndex] !== ":") {
    if (raw[startIndex] === " " || raw[startIndex] === "\n") {
      startIndex = -1;
      break;
    }
    startIndex--;
  }

  if (startIndex < 0) {
    startIndex = cursorPos;
  }

  let endIndex = cursorPos;
  while (endIndex < raw.length) {
    const c = raw[endIndex];
    if (c === " " || c === "\n") break;
    if (c === ":") {
      endIndex++;
      break;
    }
    endIndex++;
  }
  const textToInsert = " " + text + " ";

  state.rawContent =
    raw.slice(0, startIndex) + textToInsert + raw.slice(endIndex);

  state.cursorPosition = startIndex + textToInsert.length;
  state.selectionStart = state.cursorPosition;
  state.selectionEnd = state.cursorPosition;

  let charCount = 0;
  let targetNode: Node | null = null;
  let targetOffset = 0;

  function findPosition(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (charCount + len >= state.cursorPosition) {
        targetNode = node;
        targetOffset = state.cursorPosition - charCount;
        return true;
      }
      charCount += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (
        (node as HTMLElement).tagName === "IMG" ||
        (node as HTMLElement).tagName === "DIV"
      ) {
        const emojiId = (node as HTMLElement).getAttribute("data-emoji-id");
        charCount += emojiId ? `:${emojiId}:`.length : 1;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (findPosition(node.childNodes[i])) return true;
        }
      }
    }
    return false;
  }

  findPosition(chatInput);

  if (!targetNode) {
    targetNode = chatInput;
    targetOffset = chatInput.childNodes.length;
  }

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();

  if (targetNode.nodeType === Node.TEXT_NODE) {
    range.setStart(targetNode, targetOffset);
  } else {
    const el = targetNode as HTMLElement;
    range.setStart(targetNode, Math.min(targetOffset, el.childNodes.length));
  }
  range.collapse(true);

  selection.removeAllRanges();
  selection.addRange(range);

  manuallyRenderEmojis(chatInput, state.rawContent);

  chatInput.focus();
  adjustHeight();
}

export function applyActiveEmojiSuggestion() {
  if (!emojiSuggestionDropdown) {
    return;
  }

  const activeItem = emojiSuggestionDropdown.querySelector<HTMLElement>(
    ".suggestion-option.active"
  );
  if (!activeItem) {
    return;
  }

  const emojiId = activeItem.dataset.id;
  if (!emojiId) {
    return;
  }

  const insertedText = `:${emojiId}:`;

  appendEmojiToInput(insertedText);

  setTimeout(hideEmojiSuggestions, 50);
}

export function handleEmojiSuggestions(event: KeyboardEvent) {
  const state = getChatBarState();
  if (!state.emojiSuggestionsVisible || !emojiSuggestionDropdown) return;

  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

  const items = Array.from(emojiSuggestionDropdown.children) as HTMLElement[];
  const currentIndex = items.findIndex((el) => el.classList.contains("active"));

  const direction = event.key === "ArrowRight" ? 1 : -1;
  let newIndex = currentIndex + direction;

  if (newIndex < 0) newIndex = items.length - 1;
  if (newIndex >= items.length) newIndex = 0;

  highlightSuggestion(newIndex);
  event.preventDefault();
}

function highlightSuggestion(index: number) {
  const items = Array.from(emojiSuggestionDropdown.children) as HTMLElement[];

  items.forEach((el, i) => {
    el.classList.toggle("active", i === index);
    if (i === index) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}
//#endregion
async function main() {
  await loadBuiltinEmojis();
}

main();
