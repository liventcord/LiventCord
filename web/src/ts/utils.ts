import { friendsContainer, getFriendsTranslation } from "./friendui.ts";
import { translations } from "./translations.ts";
import { chatContent } from "./chatbar.ts";

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
    if (typeof options.style === "string") {
      element.style.cssText = options.style;
    } else if (typeof options.style === "object") {
      Object.assign(element.style, options.style);
    }
    Object.assign(element, options);
  }
  return element;
};

export const clydeSrc = "/images/clyde.png";

const defaultProfileImageUrl = "/images/guest.png";

export let defaultProfileImageSrc = defaultProfileImageUrl;
const defaultMediaImageUrl = "/images/defaultmediaimage.png";
export let defaultMediaImageSrc = defaultMediaImageUrl;
const DISCRIMINATOR_PARTS_LENGHT = 2;

export const DEFAULT_DISCRIMINATOR = "0000";
export const isMobile = getMobile();
export const STATUS_404 = 404;
export const STATUS_200 = 200;
export const blackImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAk0lEQVRoQ+2S0QkAIBCFrv2HrmYQhAKDPp+QtmZm3/v9WT3ksYYVeSzIVKQikoG+liQWYyuC1UnDikhiMbYiWJ00rIgkFmMrgtVJw4pIYjG2IlidNKyIJBZjK4LVScOKSGIxtiJYnTSsiCQWYyuC1UnDikhiMbYiWJ00rIgkFmMrgtVJw4pIYjG2IlidNKyIJBZjD62iMgGPECk2AAAAAElFTkSuQmCC";
export function setDefaultMediaImageSrc(blob: Blob) {
  defaultMediaImageSrc = URL.createObjectURL(blob);
}

export function setDefaultProfileImageSrc(blob: Blob) {
  defaultProfileImageSrc = URL.createObjectURL(blob);
}

export function getMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getId(string: string): HTMLElement | null {
  return document.getElementById(string);
}

export function capitalizeFirstCharacter(str: string) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
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
const friendsTitleContainer = getId("friendsTitleContainer") as HTMLElement;
export function reCalculateFriTitle() {
  const friendsCount = friendsContainer.children.length;
  const textToWrite =
    friendsCount !== 0 ? getFriendsTranslation() + " — " + friendsCount : "";
  friendsTitleContainer.textContent = textToWrite;
}

export function setWindowName(pendingCounter: number) {
  if (pendingCounter) {
    document.title = `LiventCord (${pendingCounter})`;
  }
}

export function sendNotify(data: string) {
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

export function areJsonsEqual(
  existingData: unknown,
  newData: unknown
): boolean {
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

export function extractLinks(content: string) {
  if (content) {
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g;
    return content.match(urlRegex) || [];
  }
  return null;
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

export function getEmojiPath(emojiId: string) {
  return `/emojis/${emojiId}.png`;
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

  if (messageDate.toDateString() === today.toDateString()) {
    return `ㅤ${translations.getTranslation(
      "today"
    )} ${messageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    return `ㅤ${translations.getTranslation(
      "yesterday"
    )} ${messageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } else {
    return `ㅤ${messageDate.toLocaleDateString(
      translations.getLocale()
    )} ${messageDate.toLocaleTimeString(translations.getLocale(), {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }
}

export function getFormattedDateForSmall(messageDate: Date) {
  return messageDate.toLocaleTimeString(translations.getLocale(), {
    hour: "2-digit",
    minute: "2-digit"
  });
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

export function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()
  );
}
export function getAverageRGB(imgEl: HTMLImageElement): string {
  if (imgEl.src === defaultProfileImageSrc) {
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

export function getProfileUrl(userId: string) {
  return `/profiles/${userId}.png`;
}

export function pad(number: number, length: number) {
  let str = String(number);
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

export function formatDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1, 2);
  const day = pad(date.getUTCDate(), 2);
  const hours = pad(date.getUTCHours(), 2);
  const minutes = pad(date.getUTCMinutes(), 2);
  const seconds = pad(date.getUTCSeconds(), 2);
  const microseconds = pad(date.getUTCMilliseconds() * 1000, 6);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${microseconds}+00:00`;
}

export function truncateString(str: string, maxLength: number) {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + "...";
}

export function createNowDate() {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, "0");
  const microseconds = "534260";
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}+00:00`;
}

export function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
export function createRandomId() {
  const length = 18;
  const digits = "0123456789";
  let result = "";
  const digitsLength = digits.length;
  for (let i = 0; i < length; i++) {
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

export function enableElementHTML(
  element: HTMLElement,
  isFlex1: boolean = false,
  isBlock: boolean = false,
  isInline: boolean = false
): void {
  if (element instanceof HTMLElement)
    applyStyles(element, isFlex1, isBlock, isInline);
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

export function applyCustomStyles(html: string): string {
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
  console.log(imgElement);
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
export async function urlToBase64(url: string): Promise<string> {
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

function getDomain(url: string) {
  const link = createEl("a", { href: url }) as HTMLAnchorElement;
  return link.hostname;
}
export function reloadCSS() {
  const approvedDomains = ["localhost"];
  const links = document.getElementsByTagName("link");
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.rel === "stylesheet") {
      const href = link.href;
      const domain = getDomain(href);
      if (approvedDomains.includes(domain)) {
        const newHref =
          href.indexOf("?") !== MINUS_INDEX
            ? `${href}&_=${new Date().getTime()}`
            : `${href}?_=${new Date().getTime()}`;
        link.href = newHref;
      }
    }
  }
}
//window.addEventListener("focus", reloadCSS);
