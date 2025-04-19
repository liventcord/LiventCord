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
  IMAGE_SRCS,
  formatFileSize
} from "./utils.ts";
import { initialState } from "./app.ts";
import {
  replaceCustomEmojisForChatContainer,
  setupEmojiListeners
} from "./emoji.ts";
import { Attachment } from "./message.ts";
import { FileHandler } from "./chatbar.ts";

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
export const maxAttachmentsCount = 10;
const maxTenorWidth = 768;
const maxTenorHeight = 576;
const tenorHosts = ["media1.tenor.com", "c.tenor.com", "tenor.com"];
const IgnoreProxies = ["i.redd.it", ...tenorHosts];

const getAttachmentUrl = (attachmentId: string) =>
  `${location.origin}/attachments/${attachmentId}`;

function createTenorElement(
  msgContentElement: HTMLElement,
  inputText: string,
  url: string,
  senderId: string,
  date: Date
) {
  let tenorURL = "";
  try {
    const parsedUrl = new URL(url);
    if (tenorHosts.includes(parsedUrl.host)) {
      tenorURL =
        parsedUrl.host === "tenor.com" && !url.endsWith(".gif")
          ? `${url}.gif`
          : url;
    }
  } catch (error) {
    console.error("Invalid URL:", url, error);
  }

  const imgElement = createEl("img", {
    src: IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC,
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
    imgElement.src = IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC;
    imgElement.remove();
    msgContentElement.textContent = inputText;
  };
  imgElement.setAttribute("data-userId", senderId);
  imgElement.setAttribute("data-date", date.toString());

  imgElement.addEventListener("click", function () {
    displayImagePreview(imgElement, senderId, date);
  });

  return imgElement;
}

function getProxy(url: string): string {
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

    return (
      initialState.mediaProxyApiUrl +
      `/api/proxy/media?url=${encodeURIComponent(url)}`
    );

    //return `${initialState.proxyWorkerUrl}?url=${encodeURIComponent(url)}`;
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

const spoileredImages: Record<string, boolean> = {};
export function isImageSpoilered(id: string) {
  return Boolean(spoileredImages[id]);
}
export function setImageUnspoilered(id: string) {
  delete spoileredImages[id];
}
function createImageElement(
  inputText: string,
  urlSrc: string,
  senderId: string,
  date: Date,
  attachmentId = "",
  isSpoiler = false,
  fileSize = 0,
  fileName = ""
): HTMLImageElement {
  const imgElement = createEl("img", {
    className: "chat-image",
    id: attachmentId,
    src: IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC,
    style: {
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`
    }
  }) as HTMLImageElement;
  imgElement.setAttribute("data-userid", senderId);
  imgElement.setAttribute("data-date", date.toString());
  imgElement.setAttribute("data-filesize", fileSize.toString());
  imgElement.setAttribute("data-filename", fileName);
  requestAnimationFrame(() => {
    if (isSpoiler) {
      FileHandler.blurImage(imgElement);
      spoileredImages[attachmentId] = true;
    }
  });
  imgElement.crossOrigin = "anonymous";
  imgElement.alt = inputText ?? "Image";

  imgElement.setAttribute("data-original-src", urlSrc);
  let isClicked: boolean;
  imgElement.addEventListener("click", () => {
    if (isSpoiler) {
      if (isClicked) {
        displayImagePreview(imgElement, senderId, date);
      } else {
        FileHandler.unBlurImage(imgElement);
        spoileredImages[attachmentId] = false;
      }
      isClicked = true;
    } else {
      displayImagePreview(imgElement, senderId, date, isSpoiler);
    }
  });

  preloadImage(getProxy(urlSrc))
    .catch(() => preloadImage(getProxy(urlSrc)))
    .then((loadedSrc) => {
      imgElement.src = loadedSrc;
    })
    .catch(() => {});

  return imgElement;
}

function createAudioElement(audioURL: string) {
  const audioElement = createEl("audio", {
    src: DOMPurify.sanitize(audioURL),
    controls: true
  });
  return audioElement;
}
async function createJsonElement(url: string) {
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

function createYouTubeElement(url: string): HTMLElement | undefined {
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

function createVideoElement(url: string) {
  if (!isVideoUrl(url)) {
    throw new Error("Invalid video URL");
  }
  const videoElement = createEl("video") as HTMLVideoElement;
  videoElement.src = getProxy(url);
  videoElement.width = 560;
  videoElement.height = 315;
  videoElement.controls = true;

  return videoElement;
}
function createRegularText(content: string) {
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
  senderId: string,
  date: Date,
  attachments?: Attachment[]
) {
  const attachmentsToUse = processAttachments(attachments);

  if (attachmentsToUse.length) {
    newMessage.dataset.attachmentUrls = attachmentsToUse
      .map((a) => getAttachmentUrl(a.fileId))
      .join(",");
  }

  const links: string[] = [...extractLinks(content)];
  let mediaCount = 0;
  let linksProcessed = 0;

  if (embeds.length) {
    try {
      embeds.forEach((embed) => {
        appendEmbedToMessage(
          messageContentElement,
          embed,
          "",
          metadata,
          senderId,
          date
        );
      });
    } catch (embedError) {
      console.error("Error displaying embeds:", embedError);
    }
  }

  await processLinks();
  async function processLinks() {
    while (linksProcessed < links.length && mediaCount < maxAttachmentsCount) {
      try {
        const isError = await processMediaLink(
          links[linksProcessed],
          null,
          messageContentElement,
          content,
          metadata,
          embeds,
          senderId,
          date
        );
        if (!isError) mediaCount++;
      } catch (error) {
        console.error("Error processing media link:", error);
      }
      linksProcessed++;
    }

    for (const attachment of attachmentsToUse) {
      try {
        if (attachment.isImageFile) {
          await processMediaLink(
            getAttachmentUrl(attachment.fileId),
            attachment,
            messageContentElement,
            content,
            metadata,
            embeds,
            senderId,
            date
          );
        } else {
          const previewElement = createFileAttachmentPreview(attachment);
          messageContentElement.appendChild(previewElement);
        }
        mediaCount++;
      } catch (error) {
        console.error("Error processing attachment:", error);
      }
    }
  }
}

function processAttachments(attachments?: Attachment[]): Attachment[] {
  if (!attachments || !Array.isArray(attachments)) return [];
  return attachments.map((attachment) => ({
    ...attachment,
    url: getAttachmentUrl(attachment.fileId)
  }));
}

function createFileAttachmentPreview(
  attachment: Attachment | null
): HTMLElement {
  const container = createEl("div", { className: "attachment-file-container" });
  const file = createEl("i", {
    className: "fa-solid fa-file attachment-file"
  }) as HTMLImageElement;

  if (attachment) {
    const attachmentUrl = getAttachmentUrl(attachment.fileId);

    const textWrapper = createEl("div", { className: "attachment-text" });

    const title = createEl("a", {
      className: "attachment-title",
      textContent: attachment.fileName,
      href: attachmentUrl,
      download: ""
    }) as HTMLAnchorElement;

    const readableSize = formatFileSize(attachment.fileSize);

    const size = createEl("span", {
      className: "attachment-size",
      textContent: readableSize
    });

    textWrapper.appendChild(title);
    textWrapper.appendChild(size);

    container.appendChild(file);
    container.appendChild(textWrapper);
  }

  return container;
}

function processMediaLink(
  link: string,
  attachment: Attachment | null,
  messageContentElement: HTMLElement,
  content: string,
  metadata: MetaData,
  embeds: Embed[],
  senderId: string,
  date: Date
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let mediaElement: HTMLElement | Promise<HTMLElement | null> | null = null;
    const handleLoad = () => {
      resolve(false);
    };

    const handleError = () => {
      console.error("Error loading media element");
      resolve(true);
    };
    if (isImageURL(link) || isAttachmentUrl(link)) {
      if (!embeds || embeds.length <= 0) {
        console.log(attachment);
        mediaElement = createImageElement(
          "",
          link,
          senderId,
          date,
          attachment?.fileId,
          attachment?.isSpoiler,
          attachment?.fileSize,
          attachment?.fileName
        );
      }
    } else if (isTenorURL(link)) {
      mediaElement = createTenorElement(
        messageContentElement,
        content,
        link,
        senderId,
        date
      );
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
      messageContentElement.textContent = content;
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

export function handleLink(
  messageContentElement: HTMLElement,
  content: string
) {
  const urlPattern = /https?:\/\/[^\s]+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const appendToMessage = (el: HTMLElement) => {
    messageContentElement.insertBefore(el, messageContentElement.firstChild);
  };

  const insertTextOrHTML = (text: string) => {
    const replaced = replaceCustomEmojisForChatContainer(text);
    const span = createEl("span");
    span.innerHTML = replaced;
    appendToMessage(span);
  };

  while ((match = urlPattern.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      const text = content.slice(lastIndex, start);
      insertTextOrHTML(text);
    }

    const url = match[0];
    const urlSpan = createEl("a", { textContent: url });
    urlSpan.classList.add("url-link");
    urlSpan.addEventListener("click", () => openExternalUrl(url));
    appendToMessage(urlSpan);

    lastIndex = end;
  }

  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    insertTextOrHTML(remainingText);
  }

  setupEmojiListeners(messageContentElement);
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
  metaData: MetaData,
  senderId: string,
  date: Date
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
    const imgElement = createImageElement(
      embed.title || "",
      imgUrl,
      senderId,
      date,
      embed.id
    );
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
