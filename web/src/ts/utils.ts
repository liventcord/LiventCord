import {
  displayWumpus,
  friendsContainer,
  getFriendsTranslation
} from "./friendui.ts";
import { translations } from "./translations.ts";
import { chatContent } from "./chatbar.ts";
import { router } from "./router.ts";
import { apiClient } from "./api.ts";
import { Attachment } from "./message.ts";

export const IMAGE_SRCS = {
  ICON_SRC:
    "https://liventcord.github.io/LiventCord/app/images/icons/icon.webp",
  WUMPUS_SRC:
    "https://liventcord.github.io/LiventCord/app/images/wumpusalone.webp",
  DEFAULT_MEDIA_IMG_SRC:
    "https://liventcord.github.io/LiventCord/app/images/defaultmediaimage.webp",
  CLYDE_SRC: "https://liventcord.github.io/LiventCord/app/images/clyde.webp",
  DEFAULT_PROFILE_IMG_SRC:
    "https://liventcord.github.io/LiventCord/app/images/guest.webp"
};

export const MINUS_INDEX = -1;
export const createEl = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    style?: Partial<CSSStyleDeclaration> | string;
    [key: string]: any;
  }
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);

  if (options) {
    const { style, ...rest } = options;

    if (typeof style === "string") {
      element.style.cssText = style;
    } else if (typeof style === "object") {
      Object.assign(element.style, style);
    }

    Object.assign(element, rest);
  }

  return element;
};

const DISCRIMINATOR_PARTS_LENGHT = 2;

export const DEFAULT_DISCRIMINATOR = "0000";
export const isMobile = getMobile();
export const STATUS_200 = 200;
export const blackImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADElEQVQImWNgIB0AAAA0AAEjQ4N1AAAAAElFTkSuQmCC";
function setDefaultMediaImageSrc(blob: Blob) {
  IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC = URL.createObjectURL(blob);
}

function setDefaultProfileImageSrc(blob: Blob) {
  IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC = URL.createObjectURL(blob);
}

async function convertAndSetImage(url: string, setter: CallableFunction) {
  const base64 = await urlToBase64(url);
  const blob = base64ToBlob(base64);
  setter(blob);
}

convertAndSetImage(
  IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC,
  setDefaultProfileImageSrc
);
convertAndSetImage(IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC, setDefaultMediaImageSrc);

function getMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getId(string: string): HTMLElement | null {
  return document.getElementById(string);
}

export function getMaskedEmail(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) {
    return email;
  }
  const nickName = parts[0];
  const domain = parts[1];
  const hiddenNickname = "*".repeat(nickName.length);
  return `${hiddenNickname}@${domain}`;
}

export function isValidFriendName(input: string) {
  const pattern = /^[^#]+#\d{4}$/;
  return pattern.test(input);
}
export function reCalculateFriTitle() {
  const friendCards = friendsContainer.querySelectorAll(".friend-card");
  const friendsCount = friendCards.length;
  const textToWrite =
    friendsCount !== 0 ? getFriendsTranslation() + " — " + friendsCount : "";
  const friendsTitleContainer = getId("friendsTitleContainer") as HTMLElement;
  if (friendsTitleContainer) {
    friendsTitleContainer.textContent = textToWrite;
  }

  if (friendsCount === 0) {
    displayWumpus();
  }
}

export function setWindowName(pendingCounter: number) {
  document.title = pendingCounter
    ? `LiventCord (${pendingCounter})`
    : "LiventCord";
}
function sendNotify(data: string) {
  const container = createEl("div", { className: "notify-info-container" });

  const childDiv = createEl("div", {
    className: "notify-info-message",
    textContent: data
  });
  container.appendChild(childDiv);

  document.body.prepend(container);

  container.addEventListener("animationend", () => {
    container.remove();
  });
}

interface ParsedUsername {
  nickName: string;
  discriminator: string;
}

export function parseUsernameDiscriminator(
  input: string
): ParsedUsername | null {
  const parts = input.split("#");
  if (parts.length !== DISCRIMINATOR_PARTS_LENGHT) {
    return null;
  }
  return {
    nickName: parts[0],
    discriminator: parts[1]
  };
}

export function extractLinks(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g;
  return content.match(urlRegex) || [];
}

export function sanitizeInput(input: string): string {
  return input.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return char;
    }
  });
}

export function getEmojiPath(emojiId: string, guildId: string): string {
  return `${apiClient.getBackendUrl()}/guilds/${sanitizeInput(guildId)}/emojis/${sanitizeInput(emojiId)}`;
}

export function kebapToSentence(text: string) {
  return text
    .replace(/-/g, " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

export function getFormattedDate(input: string) {
  const today = new Date();
  const yesterday = new Date(today);
  const messageDate = new Date(
    /([zZ]|[+-]\d{2}:\d{2})$/.test(input) ? input : input + "Z"
  );
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return `ㅤ${translations.getTranslation(
      "today"
    )} ${messageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })}`;
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    return `ㅤ${translations.getTranslation(
      "yesterday"
    )} ${messageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })}`;
  } else {
    return `ㅤ${messageDate.toLocaleDateString(
      translations.getLocale()
    )} ${messageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })}`;
  }
}
export function getFormattedDateForSmall(messageDate: string) {
  const date = new Date(
    /([zZ]|[+-]\d{2}:\d{2})$/.test(messageDate)
      ? messageDate
      : messageDate + "Z"
  );

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}

export function getFormattedDateSelfMessage(messageDate: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDateObj = new Date(messageDate);
  const localMessageDate = new Date(
    messageDateObj.toLocaleString("en-US", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  );

  const timeString = localMessageDate.toLocaleTimeString(
    translations.getLocale(),
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }
  );

  if (localMessageDate.toDateString() === today.toDateString()) {
    return `${translations.getTranslation("today")} at ${timeString}`;
  }

  if (localMessageDate.toDateString() === yesterday.toDateString()) {
    return `${translations.getTranslation("yesterday")} at ${timeString}`;
  }

  const dateString = localMessageDate.toLocaleDateString(
    translations.getLocale()
  );
  return `${dateString} at ${timeString}`;
}

export function isImageURL(url: string) {
  const imageUrlRegex = /\.(gif|jpe?g|png|bmp|webp|tiff|svg|ico)(\?.*)?$/i;
  return imageUrlRegex.test(url);
}
export function isAttachmentUrl(url: string) {
  const pattern = /attachments\/\d+/;
  return pattern.test(url);
}

export function isYouTubeURL(url: string) {
  return /^(?:(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11}))$/i.test(
    url
  );
}

export function getYouTubeEmbedURL(url: string) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:shorts\/|(?:v|e(?:mbed)?|watch\?v=))|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);

  if (match) {
    const videoId = match[1];
    return `https://www.youtube.com/embed/${videoId}`;
  } else {
    return null;
  }
}

export function isTenorURL(url: string) {
  return /(?:tenor\.com|media\.tenor\.com)\/(?:[^\/]+\/)+[^\/]+(?:-\w+\.(?:gif|mp4)|$)/.test(
    url
  );
}

export function isAudioURL(url: string) {
  const audioExtensions = [".mp3", ".wav", ".ogg", ".aac", ".flac"];
  const urlWithoutQueryParams = url.split("?")[0];
  const fileParts = urlWithoutQueryParams.split(".");
  const fileExtension =
    fileParts.length > 1 ? fileParts.pop()?.toLowerCase() : "";

  return audioExtensions.includes(`.${fileExtension}`);
}

export function isJsonUrl(url: string) {
  return url.toLowerCase().includes(".json");
}
export function isVideoUrl(url: string) {
  const videoPatterns = [
    /\.mp4/i,
    /\.avi/i,
    /\.mov/i,
    /\.wmv/i,
    /\.mkv/i,
    /\.flv/i,
    /\.webm/i
  ];

  return videoPatterns.some((pattern) => pattern.test(url));
}
const rgbCache: Record<string, { r: string; g: string; b: string } | string> =
  {};

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()
  );
}
export function getAverageRGB(imgEl: HTMLImageElement): string {
  if (
    imgEl.src === IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC ||
    !imgEl.complete ||
    imgEl.naturalWidth === 0
  ) {
    return "#e7e7e7";
  }

  if (rgbCache[imgEl.src]) {
    return rgbCache[imgEl.src] as string;
  }

  const blockSize = 5;
  const RGBA_COMPONENTS = 4;
  const canvas = createEl("canvas");
  const context = canvas.getContext && canvas.getContext("2d");

  if (!context) {
    return "#000000";
  }

  const height = (canvas.height =
    imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height);
  const width = (canvas.width =
    imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width);
  context.drawImage(imgEl, 0, 0, width, height);

  let data;
  try {
    data = context.getImageData(0, 0, width, height);
  } catch (e) {
    console.error(e);
    return "#000000";
  }

  const length = data.data.length;
  const rgb = { r: 0, g: 0, b: 0 };
  let count = 0;

  for (let i = 0; i < length; i += blockSize * RGBA_COMPONENTS) {
    count++;
    rgb.r += data.data[i];
    rgb.g += data.data[i + 1];
    rgb.b += data.data[i + 2];
  }

  rgb.r = ~~(rgb.r / count);
  rgb.g = ~~(rgb.g / count);
  rgb.b = ~~(rgb.b / count);

  const rgbString = rgbToHex(rgb.r, rgb.g, rgb.b);

  rgbCache[imgEl.src] = rgbString;

  return rgbString;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
}

const urlPattern = /^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;
const controlCharPattern = /[\x00-\x1F\x7F\u2000-\u20FF]/;

export function isURL(input: string): boolean {
  return (
    typeof input === "string" &&
    input.trim() !== "" &&
    urlPattern.test(input) &&
    !controlCharPattern.test(input)
  );
}
export function containsUrl(input: string): boolean {
  return typeof input === "string" && /\bhttps?:\/\/\S+/i.test(input);
}

function pad(number: number, length: number) {
  let str = String(number);
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1, 2);
  const day = pad(date.getUTCDate(), 2);
  const hours = pad(date.getUTCHours(), 2);
  const minutes = pad(date.getUTCMinutes(), 2);
  const seconds = pad(date.getUTCSeconds(), 2);
  const microseconds = pad(date.getUTCMilliseconds() * 1000, 6);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${microseconds}+00:00`;
}
export function formatDateGood(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

export function truncateString(str: string, maxLength: number) {
  if (!str) {
    return "";
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + "...";
}

export function createNowDate(): string {
  return new Date().toUTCString();
}

export function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
export function createRandomId() {
  const digits = "0123456789";
  let result = "";
  const digitsLength = digits.length;
  for (let i = 0; i < router.ID_LENGTH; i++) {
    result += digits.charAt(Math.floor(Math.random() * digitsLength));
  }
  return result;
}

export function openExternalUrl(url: string) {
  window.open(url, "_blank");
}

function sanitizeHTML(html: string) {
  if (typeof html !== "string") {
    return "";
  }
  function isValidForColoring(content: string) {
    return /^[a-zA-Z0-9\s\-_.,!?]+$/.test(content.trim());
  }

  html = html.replace(/-red\s(.*?)\sred-/gi, (match, content: string) => {
    if (isValidForColoring(content)) {
      return `<red>${content}</red>`;
    } else {
      return `&lt;-red ${content} red-&gt;`;
    }
  });

  html = html.replace(/-blu\s(.*?)\sblu-/gi, (match, content: string) => {
    if (isValidForColoring(content)) {
      return `<blu>${content}</blu>`;
    } else {
      return `&lt;-blu ${content} blu-&gt;`;
    }
  });

  html = html.replace(/-yellow\s(.*?)\syellow-/gi, (match, content: string) => {
    if (isValidForColoring(content)) {
      return `<yellow>${content}</yellow>`;
    } else {
      return `&lt;-yellow ${content} yellow-&gt;`;
    }
  });

  html = html.replace(/<br>/gi, "&lt;br&gt;");
  html = html.replace(/\n/g, "<br>");
  const sanitizedString = html.replace(
    /<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi,
    (tag) => {
      const allowedTags = ["br", "red", "blu", "yellow"];
      const tagMatch = tag.match(/<\/?([a-z][a-z0-9]*)\b[^>]*>?/i);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : "";

      if (allowedTags.includes(tagName)) {
        return tag;
      } else {
        return tag.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
    }
  );
  const validHtml = sanitizedString.replace(/<[^>]*$/g, (match) => {
    return match.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  });

  return applyCustomStyles(validHtml);
}
export function disableElementHTML(element: HTMLElement): void {
  if (element instanceof HTMLElement) {
    element.style.display = "none";
  }
}

export function disableElement(input: string | HTMLElement): void {
  const element = input instanceof HTMLElement ? input : getId(input);
  if (element) {
    element.style.display = "none";
  }
}

function applyStyles(
  element: HTMLElement,
  isFlex1: boolean,
  isBlock: boolean,
  isInline: boolean
): void {
  if (isFlex1) {
    element.style.flex = "1";
  }
  element.style.display = isBlock
    ? "block"
    : isInline
      ? "inline-block"
      : "flex";
}

export function enableElement(
  input: string | HTMLElement,
  isFlex1: boolean = false,
  isBlock: boolean = false,
  isInline: boolean = false
): void {
  const element = input instanceof HTMLElement ? input : getId(input);
  if (element) {
    applyStyles(element, isFlex1, isBlock, isInline);
  }
}

export function removeElement(elementName: string) {
  const element = getId(elementName);
  if (element) {
    element.remove();
  }
}

export function getBeforeElement(element: HTMLElement): HTMLElement | null {
  const elements = Array.from(chatContent.children);
  const index = elements.indexOf(element);
  if (index > 0) {
    const prevElement = elements[index - 1] as HTMLElement;
    return prevElement;
  } else {
    return null;
  }
}

function applyCustomStyles(html: string): string {
  const styles: Record<string, string> = {
    red: "color: red;",
    blu: "color: blue;",
    yellow: "color: yellow;"
  };
  const styledHTML = html.replace(
    /<([a-z][a-z0-9]*)\b[^>]*>(.*?)<\/\1>/gi,
    (match: string, tag: string, content: string) => {
      if (styles[tag]) {
        return content.trim()
          ? `<span style="${styles[tag]}">${content}</span>`
          : `&lt;${tag}&gt;`;
      }
      return `&lt;${tag}&gt;`;
    }
  );

  return styledHTML.replace(/&lt;br&gt;/g, "<br>");
}
export function getBase64Image(
  imgElement: HTMLImageElement
): string | undefined {
  const canvas = createEl("canvas");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  ctx.drawImage(imgElement, 0, 0);
  return canvas.toDataURL("image/png");
}

export function base64ToBlob(base64: string, contentType = "image/png"): Blob {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const base64Data = reader.result.split(",")[1];
          const mimeType = blob.type || "image/png";
          resolve(`data:${mimeType};base64,${base64Data}`);
        } else {
          reject(new Error("Failed to read file as string"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching or converting URL to Base64:", error);
    throw error;
  }
}

export function saveCookie(
  name: string,
  value: string,
  isBoolean: boolean = false
) {
  if (isBoolean && value === "0") {
    document.cookie = `${encodeURIComponent(
      name
    )}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    return;
  }

  const expires = new Date();
  expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
  const expiresStr = `expires=${expires.toUTCString()}`;
  const cookieValue = isBoolean ? (value ? 1 : 0) : encodeURIComponent(value);
  document.cookie = `${encodeURIComponent(
    name
  )}=${cookieValue}; ${expiresStr}; path=/`;
}

export function loadCookie(name: string): string | null {
  const cookieName = encodeURIComponent(name) + "=";
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith(cookieName)) {
      return decodeURIComponent(cookie.substring(cookieName.length));
    }
  }
  return null;
}

export function saveBooleanCookie(name: string, value: number) {
  saveCookie(name, value ? "1" : "0", true);
}

export function loadBooleanCookie(name: string): boolean {
  const result = loadCookie(name);
  return result === "1";
}

export const convertKeysToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  } else if (obj !== null && obj !== undefined && typeof obj === "object") {
    return Object.keys(obj).reduce(
      (acc, key) => {
        const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        acc[camelKey] = convertKeysToCamelCase(obj[key]);
        return acc;
      },
      {} as Record<string, any>
    );
  }
  return obj;
};

export function underscoreToTitle(str: string) {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function escapeHtml(str: string) {
  return str
    .replace(/&(?![a-zA-Z]+;|#\d+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function findPreviousNode(node: Node): Node | null {
  if (node.previousSibling) {
    let current = node.previousSibling;
    while (current.lastChild) {
      current = current.lastChild;
    }
    return current;
  }
  return node.parentNode;
}

export function findNextNode(node: Node): Node | null {
  if (node.firstChild) {
    return node.firstChild;
  }
  if (node.nextSibling) {
    return node.nextSibling;
  }

  let current = node;
  while (current.parentNode && !current.nextSibling) {
    current = current.parentNode;
  }
  return current.nextSibling;
}

export function findLastTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node;
  }

  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const lastTextNode = findLastTextNode(node.childNodes[i]);
    if (lastTextNode) {
      return lastTextNode;
    }
  }
  return null;
}

export function sanitizeHtmlInput(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

export function getResolution(
  media: HTMLImageElement | HTMLVideoElement
): string {
  if (media instanceof HTMLImageElement) {
    return `${media.naturalWidth}x${media.naturalHeight}`;
  }
  if (media instanceof HTMLVideoElement) {
    return `${media.videoWidth}x${media.videoHeight}`;
  }
  throw new Error("Unsupported media type");
}
export function estimateVideoSizeBytes(
  width: number,
  height: number,
  durationSeconds: number,
  format: string = "mp4"
): number {
  const totalPixels = width * height;
  let bpp = 0.1;

  switch (format.toLowerCase()) {
    case "mp4":
    case "mov":
      bpp = 0.07;
      break;
    case "webm":
      bpp = 0.06;
      break;
    case "avi":
      bpp = 0.15;
      break;
    default:
      bpp = 0.1;
  }

  return Math.round(totalPixels * durationSeconds * bpp);
}

export function estimateImageSizeBytes(
  width: number,
  height: number,
  format: string
): number {
  const totalPixels = width * height;
  switch (format.toLowerCase()) {
    case "jpeg":
    case "jpg":
      return totalPixels * 0.1;
    case "png":
      return totalPixels * 0.5;
    case "webp":
      return totalPixels * 0.15;
    case "bmp":
      return totalPixels * 3;
    default:
      return totalPixels * 0.25;
  }
}
export function getImageExtension(
  img: HTMLImageElement | HTMLVideoElement
): string {
  const src = img.src;

  const url = new URL(src, window.location.href);
  const pathname = url.pathname;
  const match = pathname.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
  return match ? match[1].toLowerCase() : "";
}
export function getFileNameFromUrl(url: string): string {
  const path = url.split("?")[0].split("#")[0];
  const parts = path.split("/");
  const fileName = parts.pop() || "";

  if (/\.[a-zA-Z0-9]+$/.test(fileName)) {
    return fileName;
  }

  return "";
}

const extensionToIcon: Record<string, string> = {
  // Documents
  pdf: "fa-file-pdf",
  doc: "fa-file-word",
  docx: "fa-file-word",
  xls: "fa-file-excel",
  xlsx: "fa-file-excel",
  ppt: "fa-file-powerpoint",
  pptx: "fa-file-powerpoint",
  txt: "fa-file-lines",
  rtf: "fa-file-lines",
  md: "fa-pencil-alt",

  // Spreadsheets / Data
  csv: "fa-file-csv",
  ods: "fa-file-excel",

  // Audio
  mp3: "fa-file-audio",
  wav: "fa-file-audio",
  ogg: "fa-file-audio",
  flac: "fa-file-audio",
  aac: "fa-file-audio",
  m4a: "fa-file-audio",

  // Video
  mp4: "fa-file-video",
  mov: "fa-file-video",
  avi: "fa-file-video",
  mkv: "fa-file-video",
  webm: "fa-file-video",
  flv: "fa-file-video",

  // Archives
  zip: "fa-file-zipper",
  rar: "fa-file-zipper",
  "7z": "fa-file-zipper",
  tar: "fa-file-zipper",
  gz: "fa-file-zipper",
  bz2: "fa-file-zipper",
  xz: "fa-file-zipper",

  // Code / Dev
  js: "fa-file-code",
  ts: "fa-file-code",
  jsx: "fa-file-code",
  tsx: "fa-file-code",
  py: "fa-file-code",
  java: "fa-file-code",
  cpp: "fa-file-code",
  c: "fa-file-code",
  h: "fa-file-code",
  cs: "fa-file-code",
  php: "fa-file-code",
  rb: "fa-file-code",
  go: "fa-file-code",
  sh: "fa-file-code",
  ps1: "fa-file-code",
  html: "fa-file-code",
  css: "fa-file-code",
  scss: "fa-file-code",
  json: "fa-file-code",
  xml: "fa-file-code",
  yml: "fa-file-code",
  yaml: "fa-file-code",

  // Configs & Meta
  env: "fa-file-code",
  gitignore: "fa-file-code",
  dockerfile: "fa-file-code",

  // eBooks
  epub: "fa-file-lines",
  mobi: "fa-file-lines",
  azw: "fa-file-lines",
  azw3: "fa-file-lines",

  // Certificates & Keys
  pem: "fa-file-lines",
  crt: "fa-file-lines",
  cer: "fa-file-lines",
  key: "fa-file-lines",
  pfx: "fa-file-lines",
  p12: "fa-file-lines",

  // Disk Images
  iso: "fa-compact-disc",
  img: "fa-compact-disc",

  // Logs & Misc
  log: "fa-file-lines",
  bak: "fa-file-lines",
  sql: "fa-database",

  // Fonts
  otf: "fa-font",
  ttf: "fa-font",
  woff: "fa-font",
  eot: "fa-font"
};

export function renderFileIcon(img: HTMLImageElement, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext) {
    const iconClass = extensionToIcon[ext];
    if (iconClass) {
      img.classList.remove("fa-file");
      img.classList.add(iconClass);
    }
  }
}
export function isCompressedFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();

  const compressedExtensions = Object.keys(extensionToIcon).filter((ext) =>
    extensionToIcon[ext].includes("fa-file-zipper")
  );

  return extension ? compressedExtensions.includes(extension) : false;
}
export const tenorHosts = [
  "media1.tenor.com",
  "c.tenor.com",
  "tenor.com",
  "media.tenor.com"
];

const IgnoreProxies = ["i.redd.it", ...tenorHosts];

class CorsDomainManager {
  private static readonly LOCALSTORAGE_KEY = "corsAllowedDomainsCache";
  private cache: Record<string, boolean> = {};

  constructor() {
    this.cache = this.loadCache();
  }

  private loadCache(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem(CorsDomainManager.LOCALSTORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveCache() {
    try {
      localStorage.setItem(
        CorsDomainManager.LOCALSTORAGE_KEY,
        JSON.stringify(this.cache)
      );
    } catch {}
  }

  private testCorsForDomain(domain: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `https://${domain}/favicon.ico`;

      let resolved = false;

      function done(result: boolean) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      }

      img.onload = () => done(true);
      img.onerror = () => done(false);

      const timeoutId = setTimeout(() => done(false), 5000);
    });
  }

  async getProxy(url: string): Promise<string> {
    if (url.startsWith("/")) {
      return `${location.origin}${url}`;
    }
    if (!navigator.onLine) {
      return url;
    }

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;

      if (
        hostname === apiClient.getProxyHostname() ||
        hostname === apiClient.getBackendHostname() ||
        IgnoreProxies.includes(hostname)
      ) {
        return url;
      }

      if (this.cache[hostname] === true) {
        return url;
      }

      if (this.cache[hostname] === false) {
        return apiClient.getProxyUrl(url);
      }

      const allowsCors = await this.testCorsForDomain(hostname);

      this.cache[hostname] = allowsCors;
      this.saveCache();

      return allowsCors ? url : apiClient.getProxyUrl(url);
    } catch (e) {
      console.error("Invalid URL:", url, e);
      return url;
    }
  }
}

export const corsDomainManager = new CorsDomainManager();

export function loadImageWithRetry(
  url: string,
  maxRetries = 3
): Promise<HTMLImageElement> {
  return retry(
    () =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image failed to load"));
      }),
    maxRetries
  );
}
export function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500,
  backoffFactor = 2
): Promise<T> {
  return new Promise((resolve, reject) => {
    function attempt(n: number, currentDelay: number) {
      fn()
        .then(resolve)
        .catch((err) => {
          if (n === 0) {
            reject(err);
          } else {
            setTimeout(
              () => attempt(n - 1, currentDelay * backoffFactor),
              currentDelay
            );
          }
        });
    }
    attempt(retries, delayMs);
  });
}

export function isValidUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function openBlobUrl(imageElement: HTMLImageElement) {
  const canvas = createEl("canvas");
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get canvas context");
  }

  ctx.drawImage(imageElement, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((_blob) => {
      if (_blob) {
        resolve(_blob);
      } else {
        reject(new Error("Failed to create blob from canvas"));
      }
    }, "image/png");
  });

  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}
export const isImageLoaded = (img: HTMLImageElement) =>
  img.complete && img.naturalHeight !== 0;

export function isContentValid(content: string) {
  return typeof content === "string" && content.trim() !== "";
}

export const getMonthValue = (query: string) => {
  if (!query.length) return ["Not Specified"];
  const lower = query.toLowerCase();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const matches = months.filter((m) => m.toLowerCase().startsWith(lower));
  return matches.length ? matches : ["Not Specified"];
};

export function insertHTML(html: string) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  range.insertNode(fragment);
  range.collapse(false);
}

export function getAttachmentUrl(file: Attachment) {
  const isTenor = isTenorURL(file.proxyUrl);

  if (isTenor) {
    return file.proxyUrl;
  } else if (file.isProxyFile) {
    return apiClient.getProxyUrl(file.proxyUrl);
  } else if (file.isImageFile) {
    return `${apiClient.getBackendUrl()}/attachments/${file.fileId}`;
  } else if (file.isVideoFile) {
    return `${apiClient.getBackendUrl()}/attachments/${file.fileId}`;
  } else {
    return "https://liventcord.github.io/LiventCord/app/images/defaultmediaimage.webp";
  }
}
