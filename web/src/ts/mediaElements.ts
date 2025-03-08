import DOMPurify from "dompurify";
import { displayImagePreview, beautifyJson, displayJsonPreview } from "./ui.ts";
import {
  isImageURL,
  isAttachmentUrl,
  isTenorURL,
  isYouTubeURL,
  isAudioURL,
  isVideoUrl,
  isJsonUrl,
  isURL,
  openExternalUrl,
  extractLinks,
  createEl,
  getYouTubeEmbedURL,
  defaultMediaImageSrc
} from "./utils.ts";
import { initialState } from "./app.ts";
import { router } from "./router.ts";

interface Embed {
  id: string;
  title: string;
  type: number;
  description: string | null;
  url: string | null;
  color: number;
  fields: any[];
  thumbnail: { url?: string } | null;
  video: { url?: string } | null;
  author: { name?: string } | null;
  image: {
    url: string;
    proxyUrl?: string;
    width?: number;
    height?: number;
  } | null;
  footer: { text?: string } | null;
}

interface EmbedType {
  Article: number;
  GIFV: number;
  Image: number;
  Link: number;
  PollResult: number;
  Rich: number;
  Video: number;
}

const embedTypes: EmbedType = {
  Article: 0,
  GIFV: 1,
  Image: 5,
  Link: 3,
  PollResult: 4,
  Rich: 2,
  Video: 6
};

class MetaData {
  siteName: string;
  title: string;
  description: string;

  constructor(siteName: string, title: string, description: string) {
    this.siteName = siteName;
    this.title = title;
    this.description = description;
  }
}

const maxWidth = 512;
const maxHeight = 384;

const maxTenorWidth = 768;
const maxTenorHeight = 576;

const IgnoreProxies = ["i.redd.it"];

export function createTenorElement(
  msgContentElement: HTMLElement,
  inputText: string,
  url: string
) {
  let tenorURL = "";
  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ["media1.tenor.com", "c.tenor.com", "tenor.com"];
    if (allowedHosts.includes(parsedUrl.host)) {
      tenorURL =
        parsedUrl.host === "tenor.com" && !url.endsWith(".gif")
          ? `${url}.gif`
          : url;
    }
  } catch (error) {
    console.error("Invalid URL:", url, error);
  }

  const imgElement = createEl("img", {
    src: defaultMediaImageSrc,
    style: {
      cursor: "pointer",
      maxWidth: `${maxTenorWidth}px`,
      maxHeight: `${maxTenorHeight}px`
    },
    loading: "lazy",
    className: "tenor-image"
  }) as HTMLImageElement;

  imgElement.onload = function () {
    const actualSrc = tenorURL;
    if (actualSrc) {
      imgElement.src = DOMPurify.sanitize(actualSrc);
    }
  };

  imgElement.onerror = function () {
    imgElement.src = defaultMediaImageSrc;
    imgElement.remove();
    msgContentElement.textContent = inputText;
  };

  imgElement.addEventListener("click", function () {
    displayImagePreview(imgElement);
  });

  return imgElement;
}

function getProxy(url: string, useBackendProxy = false): string {
  if (url.startsWith("/")) {
    return `${location.origin}${url}`;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === location.hostname) {
      return url;
    }

    if (IgnoreProxies.includes(parsedUrl.hostname)) {
      return url;
    }

    if (useBackendProxy) {
      return `/api/proxy/media?url=${encodeURIComponent(url)}`;
    }

    return `${initialState.proxyWorkerUrl}?url=${encodeURIComponent(url)}`;
  } catch (e) {
    console.error("Invalid URL:", url, e);
    return url;
  }
}

function preloadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => resolve(img.src);
    img.onerror = () => reject();
  });
}

export function createImageElement(
  inputText: string,
  urlSrc: string
): HTMLImageElement {
  const imgElement = createEl("img", {
    className: "chat-image",
    src: defaultMediaImageSrc,
    style: {
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`
    }
  }) as HTMLImageElement;

  imgElement.crossOrigin = "anonymous";
  imgElement.alt = inputText ?? "Image";
  imgElement.setAttribute("data-original-src", urlSrc);
  imgElement.addEventListener("click", () => displayImagePreview(imgElement));

  preloadImage(getProxy(urlSrc))
    .catch(() => preloadImage(getProxy(urlSrc, true)))
    .then((loadedSrc) => (imgElement.src = loadedSrc))
    .catch(() => {});

  return imgElement;
}

export function createAudioElement(audioURL: string) {
  const audioElement = createEl("audio", {
    src: DOMPurify.sanitize(audioURL),
    controls: true
  });
  return audioElement;
}
export async function createJsonElement(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch JSON data");
    }
    const jsonData = await response.json();
    const beautifiedData = beautifyJson(jsonData);
    const truncatedJsonLines =
      beautifiedData ?? "".split("\n").slice(0, 15).join("\n");
    const jsonContainer = createEl("div", { className: "json-container" });
    const jsonElement = createEl("pre", {
      className: "json-element",
      textContent: truncatedJsonLines ?? jsonData
    });

    jsonContainer.appendChild(jsonElement);
    jsonContainer.addEventListener("click", function () {
      displayJsonPreview(beautifiedData ?? jsonData);
    });
    return jsonContainer;
  } catch (error) {
    console.error("Error creating JSON element:", error);
    return null;
  }
}

export function createYouTubeElement(url: string): HTMLElement | undefined {
  const youtubeURL = getYouTubeEmbedURL(url);
  if (!youtubeURL) return undefined;

  const iframeElement = createEl("iframe", {
    src: DOMPurify.sanitize(youtubeURL),
    frameborder: "0",
    allow:
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    allowFullscreen: true,
    className: "youtube-element"
  });

  iframeElement.setAttribute("allowfullscreen", "true");
  iframeElement.setAttribute("mozallowfullscreen", "true");
  iframeElement.setAttribute("msallowfullscreen", "true");
  iframeElement.setAttribute("oallowfullscreen", "true");
  iframeElement.setAttribute("webkitallowfullscreen", "true");

  return iframeElement;
}

export function createVideoElement(url: string) {
  if (!isVideoUrl(url)) {
    throw new Error("Invalid video URL");
  }
  const videoElement = createEl("video") as HTMLVideoElement;
  videoElement.src = getProxy(url,true);
  videoElement.width = 560;
  videoElement.height = 315;
  videoElement.controls = true;

  return videoElement;
}
export function createRegularText(content: string) {
  const spanElement = createEl("p", { id: "message-content-element" });
  spanElement.textContent = content;
  spanElement.style.marginLeft = "0px";
  return spanElement;
}

export async function createMediaElement(
  content: string,
  messageContentElement: HTMLElement,
  newMessage: HTMLElement,
  metadata: MetaData,
  embeds: Embed[],
  attachmentUrls?: string | string[]
) {
  const links: string[] = [
    ...extractLinks(content),
    ...processAttachments(attachmentUrls)
  ];
  let mediaCount = 0;
  let linksProcessed = 0;
  const maxLinks = 4;

  if (embeds.length) {
    try {
      displayEmbeds(messageContentElement, "", embeds, metadata);
    } catch (embedError) {
      console.error("Error displaying embeds:", embedError);
    }
  }

  if (links.length) {
    await processLinks();
  }

  async function processLinks() {
    while (linksProcessed < links.length && mediaCount < maxLinks) {
      try {
        const isError = await processMediaLink(
          links[linksProcessed],
          newMessage,
          messageContentElement,
          content,
          metadata,
          embeds
        );

        if (!isError) {
          mediaCount++;
        }
      } catch (error) {
        console.error("Error processing media link:", error);
      }
      linksProcessed++;
    }
  }
}

function processAttachments(attachmentUrls?: string | string[]): string[] {
  if (!attachmentUrls) return [];

  const toUrl = (url: string) =>
    url.startsWith("http") ? url : `${location.origin}/attachments/${url}`;

  if (typeof attachmentUrls === "string") {
    if (
      attachmentUrls.length === router.ID_LENGTH &&
      !isNaN(Number(attachmentUrls))
    ) {
      return [`/attachments/${attachmentUrls}`];
    }
    try {
      return JSON.parse(attachmentUrls) as string[];
    } catch {
      return attachmentUrls
        .split(",")
        .map((url) => url.trim())
        .map(toUrl);
    }
  }

  if (Array.isArray(attachmentUrls)) {
    return attachmentUrls.map(toUrl);
  }

  return [];
}

export function processMediaLink(
  link: string,
  newMessage: HTMLElement,
  messageContentElement: HTMLElement,
  content: string,
  metadata: MetaData,
  embeds: Embed[]
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let mediaElement: HTMLElement | Promise<HTMLElement | null> | null = null;
    newMessage.setAttribute("data-attachment_url", link);

    const handleLoad = () => {
      resolve(false);
    };

    const handleError = () => {
      console.error("Error loading media element");
      resolve(true);
    };

    if (isImageURL(link) || isAttachmentUrl(link)) {
      if (!embeds || embeds.length <= 0) {
        mediaElement = createImageElement("", link);
      }
    } else if (isTenorURL(link)) {
      mediaElement = createTenorElement(messageContentElement, content, link);
    } else if (isYouTubeURL(link)) {
      const ytElement = createYouTubeElement(link);
      if (ytElement) {
        mediaElement = ytElement;
      }
    } else if (isAudioURL(link)) {
      mediaElement = createAudioElement(link);
    } else if (isVideoUrl(link)) {
      if (!embeds || embeds.length <= 0) {
        mediaElement = createVideoElement(link);
      }
    } else if (isJsonUrl(link)) {
      mediaElement = createJsonElement(link);
    } else if (isURL(link)) {
      handleLink(messageContentElement, content);
    } else {
      messageContentElement.innerHTML = content;
      resolve(false);
      return;
    }

    if (mediaElement instanceof Promise) {
      mediaElement
        .then((resolvedElement) => {
          if (resolvedElement) {
            messageContentElement.appendChild(resolvedElement);
            attachMediaElement(
              resolvedElement,
              messageContentElement,
              handleLoad,
              handleError
            );
          } else {
            resolve(true);
          }
        })
        .catch((error) => {
          console.error("Error resolving media element:", error);
          resolve(true);
        });
    } else if (mediaElement) {
      messageContentElement.appendChild(mediaElement);
      attachMediaElement(
        mediaElement,
        messageContentElement,
        handleLoad,
        handleError
      );
    }
  });
}

function attachMediaElement(
  mediaElement: HTMLElement,
  messageContentElement: HTMLElement,
  handleLoad: () => void,
  handleError: () => void
) {
  if (
    mediaElement instanceof HTMLImageElement ||
    mediaElement instanceof HTMLAudioElement ||
    mediaElement instanceof HTMLVideoElement
  ) {
    mediaElement.addEventListener("load", handleLoad, { once: true });
    mediaElement.addEventListener("error", handleError, { once: true });
  }
  messageContentElement.appendChild(mediaElement);
}

function handleLink(messageContentElement: HTMLElement, content: string) {
  const urlPattern = /https?:\/\/[^\s]+/g;
  const parts = content.split(urlPattern);
  const urls = content.match(urlPattern) || [];

  parts.forEach((part, index) => {
    if (part) {
      const normalSpan = createEl("span", { textContent: part });
      messageContentElement.appendChild(normalSpan);
    }

    if (index < urls.length) {
      const urlSpan = createEl("a", { textContent: urls[index] });
      urlSpan.classList.add("url-link");
      urlSpan.addEventListener("click", () => {
        openExternalUrl(urls[index]);
      });
      messageContentElement.appendChild(urlSpan);
    }
  });
}

function applyBorderColor(element: HTMLElement, decimalColor: number) {
  if (
    !Number.isInteger(decimalColor) ||
    decimalColor < 0 ||
    decimalColor > 0xffffff
  ) {
    console.error("Invalid color value");
    return;
  }

  const hexColor = `#${decimalColor.toString(16).padStart(6, "0")}`;
  element.style.borderLeft = `4px solid ${hexColor}`;
}
async function appendEmbedToMessage(
  messageElement: HTMLElement,
  embed: Embed,
  link: string,
  metaData: MetaData
) {
  const embedContainer = createEl("div", { className: "embed-container" });

  if (embed.color) {
    applyBorderColor(embedContainer, embed.color);
  }

  if (embed.type === embedTypes.Image && embed.image && embed.image.url) {
    const imgUrl = embed.image.url.split("?")[0];
    const imageContainer = createEl("div", {
      className: "embed-image-container"
    });
    const imgElement = createImageElement(embed.title || "", imgUrl);
    const textElement = createRegularText(embed.title);
    textElement.style.fontSize = "1.2em";

    imageContainer.appendChild(textElement);
    imageContainer.appendChild(imgElement);
    embedContainer.appendChild(imageContainer);
  } else if (
    embed.type === embedTypes.Video &&
    embed.video &&
    embed.video.url
  ) {
    const videoContainer = createEl("div", {
      className: "embed-video-container"
    });
    const videoElement = createVideoElement(embed.video.url);
    videoElement.className = "embed-video";

    videoContainer.appendChild(videoElement);
    embedContainer.appendChild(videoContainer);
  } else {
    console.warn("Unsupported embed type: ", embed.type);
  }

  if (metaData) {
    if (metaData.siteName) {
      embedContainer.appendChild(
        createEl("p", { textContent: metaData.siteName })
      );
    }

    if (link) {
      embedContainer.appendChild(
        createEl("a", {
          textContent: metaData.title,
          className: "url-link",
          href: link,
          target: "_blank"
        })
      );
    }

    embedContainer.appendChild(
      createEl("p", { textContent: metaData.description || metaData.title })
    );
  }

  messageElement.appendChild(embedContainer);
}

function displayEmbeds(
  messageElement: HTMLElement,
  link: string,
  embeds: Embed[],
  metaData: MetaData
) {
  try {
    embeds.forEach((embed) => {
      appendEmbedToMessage(messageElement, embed, link, metaData);
    });
  } catch (error) {
    console.error("Error displaying web preview:", error);
  }
}
