import {
  displayWumpus,
  friendsContainer,
  getFriendsTranslation
} from "./friendui.ts";
import { translations } from "./translations.ts";
import { chatContent } from "./chatbar.ts";
import { router } from "./router.ts";

export const IMAGE_SRCS = {
  ICON_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/icons/icon.webp",
  WUMPUS_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/wumpusalone.webp",
  WHITEMIC_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/icons/whitemic.webp",
  REDMIC_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/icons/redmic.webp",
  WHITEEARPHONES_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/icons/whiteearphones.webp",
  REDEARPHONES_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/icons/redearphones.webp",
  DEFAULT_MEDIA_IMG_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/defaultmediaimage.webp",
  CLYDE_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/clyde.webp",
  DEFAULT_PROFILE_IMG_SRC:
    "https://raw.githubusercontent.com/liventcord/LiventCord/refs/heads/main/web/public/images/guest.webp"
};

export const MINUS_INDEX = -1;
export const createEl = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    style?: Partial<CSSStyleDeclaration> | string;
    [key: string]: any;
  }
): HTMLElement => {
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
const STATUS_404 = 404;
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
  if (parts.length !== 2) return email;
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
  if (friendsTitleContainer) friendsTitleContainer.textContent = textToWrite;

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
  const container = createEl("div", { className: "info-container" });

  const childDiv = createEl("div", {
    className: "info-message",
    textContent: data
  });
  container.appendChild(childDiv);

  document.body.prepend(container);

  container.addEventListener("animationend", () => {
    container.remove();
  });
}

function areJsonsEqual(existingData: unknown, newData: unknown): boolean {
  if (existingData === null || newData === null) {
    return false;
  }

  if (typeof existingData !== "object" || typeof newData !== "object") {
    return false;
  }

  const existingJson = JSON.stringify(existingData);
  const newJson = JSON.stringify(newData);

  return existingJson === newJson;
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

export function constructAppPage(guildId: string, channelId: string) {
  return `/channels/${guildId}/${channelId}`;
}
export function constructDmPage(channelId: string) {
  return `/channels/@me/${channelId}`;
}
export function constructAbsoluteAppPage(guildId: string, channelId: string) {
  const port = window.location.port ? `:${window.location.port}` : "";
  return `${window.location.protocol}//${window.location.hostname}${port}/channels/${guildId}/${channelId}`;
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
  return `${import.meta.env.VITE_BACKEND_URL}/guilds/${sanitizeInput(guildId)}/emojis/${sanitizeInput(emojiId)}`;
}

export function kebapToSentence(text: string) {
  return text
    .replace(/-/g, " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

export function getFormattedDate(messageDate: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const userTimeZoneOffset = today.getTimezoneOffset() * 60000;
  const localMessageDate = new Date(messageDate.getTime() - userTimeZoneOffset);

  if (localMessageDate.toDateString() === today.toDateString()) {
    return `ㅤ${translations.getTranslation(
      "today"
    )} ${localMessageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })}`;
  } else if (localMessageDate.toDateString() === yesterday.toDateString()) {
    return `ㅤ${translations.getTranslation(
      "yesterday"
    )} ${localMessageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })}`;
  } else {
    return `ㅤ${localMessageDate.toLocaleDateString(
      translations.getLocale()
    )} ${localMessageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
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
  if (imgEl.src === IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC) {
    return "#e7e7e7";
  }

  const blockSize = 5;
  const RGBA_COMPONENTS = 4;
  const canvas = createEl("canvas") as HTMLCanvasElement;
  const context = canvas.getContext && canvas.getContext("2d");

  if (!context) {
    return "#000000";
  }

  if (rgbCache[imgEl.src]) {
    return rgbCache[imgEl.src] as string;
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

export function isURL(str: string) {
  const urlPattern =
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;
  return urlPattern.test(str);
}

export function getProfileUrl(userId: string, addTimestamp?: boolean) {
  const timestamp = `?ts=${new Date().getTime()}`;

  return addTimestamp
    ? import.meta.env.VITE_BACKEND_URL + `/profiles/${userId}` + timestamp
    : import.meta.env.VITE_BACKEND_URL + `/profiles/${userId}`;
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
  if (!str) return "";
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

export function sanitizeHTML(html: string) {
  if (typeof html !== "string") return "";
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
  if (element instanceof HTMLElement) element.style.display = "none";
}

export function disableElement(input: string | HTMLElement): void {
  const element = input instanceof HTMLElement ? input : getId(input);
  if (element) element.style.display = "none";
}

function applyStyles(
  element: HTMLElement,
  isFlex1: boolean,
  isBlock: boolean,
  isInline: boolean
): void {
  if (isFlex1) element.style.flex = "1";
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
  if (element) applyStyles(element, isFlex1, isBlock, isInline);
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
  const canvas = createEl("canvas") as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
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
  if (node.firstChild) return node.firstChild;
  if (node.nextSibling) return node.nextSibling;

  let current = node;
  while (current.parentNode && !current.nextSibling)
    current = current.parentNode;
  return current.nextSibling;
}

export function findLastTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node;

  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const lastTextNode = findLastTextNode(node.childNodes[i]);
    if (lastTextNode) return lastTextNode;
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

export function getResolution(image: HTMLImageElement): string {
  return `${image.naturalWidth}x${image.naturalHeight}`;
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
export function getImageExtension(img: HTMLImageElement): string {
  const src = img.src;

  const url = new URL(src, window.location.href);
  const pathname = url.pathname;
  const match = pathname.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
  return match ? match[1].toLowerCase() : "";
}
export function getFileNameFromUrl(url: string): string {
  const baseUrl = window.location.origin;
  const absoluteUrl = new URL(url, baseUrl);
  const path = absoluteUrl.pathname;
  const parts = path.split("/");
  const fileName = parts.pop() || "";

  if (fileName && /\.[a-zA-Z0-9]+$/.test(fileName)) {
    return fileName;
  }

  return "";
}
