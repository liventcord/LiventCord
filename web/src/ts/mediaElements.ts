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
  formatFileSize,
  renderFileIcon,
  loadImageWithRetry,
  corsDomainManager,
  tenorHosts,
  getMediaBaseURL
} from "./utils.ts";
import {
  replaceCustomEmojisForChatContainer,
  setupEmojiListeners
} from "./emoji.ts";
import {
  addEditedIndicator,
  changeChannelWithId,
  currentAttachments
} from "./chat.ts";
import { deletedUser, userManager } from "./user.ts";
import { translations } from "./translations.ts";
import { togglePin } from "./contextMenuActions.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import {
  Attachment,
  AttachmentWithMetaData,
  Embed,
  MetaData,
  Metadata
} from "./types/interfaces.ts";
import { FileHandler } from "./fileHandler.ts";
import { createMentionProfilePop } from "./profilePop.ts";

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

export const maxAttachmentsCount = 10;
const maxTenorWidth = "85vw";
const maxTenorHeight = "85vh";

export const attachmentPattern = /https?:\/\/[^\/]+\/attachments\/(\d+)/;

function getAttachmentUrl(attachmentId: string, fileName?: string) {
  const extension = fileName ? `.${fileName.split(".").pop()}` : "";
  return `${getMediaBaseURL()}/attachments/${attachmentId}${extension}`;
}

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
    src: tenorURL
      ? DOMPurify.sanitize(tenorURL)
      : IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC,
    style: {
      cursor: "pointer",
      maxWidth: maxTenorWidth,
      maxHeight: maxTenorHeight
    },
    loading: "lazy",
    className: "tenor-image"
  });

  imgElement.setAttribute("data-userId", senderId);
  imgElement.setAttribute("data-date", date.toString());

  imgElement.addEventListener("click", function () {
    displayImagePreview(imgElement, senderId, date);
  });

  imgElement.onerror = function () {
    imgElement.src = IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC;
    imgElement.remove();
    msgContentElement.textContent = inputText;
  };

  if (!tenorURL) {
    msgContentElement.textContent = inputText;
  }

  return imgElement;
}

const spoileredImages: Record<string, boolean> = {};
export function isImageSpoilered(id: string) {
  return Boolean(spoileredImages[id]);
}
export function setImageUnspoilered(id: string) {
  delete spoileredImages[id];
}
async function createImageElement(
  inputText: string,
  urlSrc: string,
  senderId: string,
  date: Date,
  attachmentId = "",
  isSpoiler = false,
  fileSize = 0,
  fileName = ""
): Promise<HTMLImageElement> {
  const imgElement = createEl("img", {
    className: "chat-image",
    id: attachmentId,
    src: IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC,
    loading: "lazy"
  });

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

  const match = urlSrc.match(attachmentPattern);
  urlSrc = match ? urlSrc : urlSrc;

  const regex = /\/attachments\/(\d+)/;
  const matchPure = urlSrc.match(regex);

  if (matchPure && matchPure[1]) {
    const id = matchPure[1];
    urlSrc = getAttachmentUrl(id, fileName);
  }

  if (
    urlSrc === IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC ||
    urlSrc === IMAGE_SRCS.DEFAULT_PROFILE_IMG_SRC
  ) {
    imgElement.src = IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC;
  } else {
    await tryLoadImageWithFallback(urlSrc, imgElement);
  }

  return imgElement;
}

async function tryLoadImageWithFallback(
  urlSrc: string,
  imgElement: HTMLImageElement
) {
  try {
    const loadedImg = await loadImageWithRetry(urlSrc, 1);
    imgElement.src = loadedImg.src;
  } catch {
    try {
      const proxyUrl = await corsDomainManager.getProxy(urlSrc);
      const proxiedImg = await loadImageWithRetry(proxyUrl, 1);
      imgElement.src = proxiedImg.src;
    } catch {
      imgElement.src = IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC;
    }
  }
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
  if (!youtubeURL) {
    return undefined;
  }

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
async function createVideoElement(url: string, isVideoAttachment = false) {
  if (!isVideoAttachment && !isVideoUrl(url)) {
    throw new Error("Invalid video URL");
  }

  const videoElement = createEl("video");

  let proxiedUrl = url;

  const isAttachmentRoute = /^https?:\/\/[^/]+\/attachments\/[0-9]+/.test(url);

  if (!isAttachmentRoute) {
    proxiedUrl = await corsDomainManager.getProxy(url);
  }

  videoElement.src = proxiedUrl;

  videoElement.controls = true;
  videoElement.loop = true;

  const downloadButton = createEl("a", {
    href: url,
    target: "_blank",
    className: "download-button"
  });

  const icon = createEl("i", {
    className: "fas fa-external-link-alt icon"
  });
  downloadButton.appendChild(icon);

  const container = createEl("div", { className: "video-container" });
  container.appendChild(videoElement);
  container.appendChild(downloadButton);
  container.setAttribute("allowfullscreen", "");

  let controlsVisible = false;

  videoElement.addEventListener("mousemove", () => {
    if (!controlsVisible) {
      controlsVisible = true;
      downloadButton.classList.add("visible");
    }
  });

  container.addEventListener("mouseleave", () => {
    if (controlsVisible) {
      controlsVisible = false;
      downloadButton.classList.remove("visible");
    }
  });

  return container;
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
  metaData: MetaData | undefined,
  metadata: Metadata | undefined,
  embeds: Embed[] | undefined,
  senderId: string,
  date: Date,
  isSystemMessage: boolean,
  attachments?: Attachment[],
  lastEdited?: string | null
) {
  const attachmentsToUse = processAttachments(attachments);
  if (attachmentsToUse.length) {
    newMessage.dataset.attachmentUrls = attachmentsToUse
      .map((a) => getAttachmentUrl(a.fileId))
      .join(",");
  }

  let mediaCount = 0;
  let linksProcessed = 0;

  if (embeds && metaData && embeds.length) {
    try {
      embeds.forEach((embed) => {
        appendEmbedToMessage(
          messageContentElement,
          embed,
          "",
          metaData,
          senderId,
          date
        );
      });
    } catch (embedError) {
      console.error("Error displaying embeds:", embedError);
    }
  }

  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      try {
        if (attachment.isImageFile || attachment.isVideoFile) {
          await processMediaLink(
            getAttachmentUrl(attachment.fileId, attachment.fileName),
            attachment,
            messageContentElement,
            content,
            metadata,
            embeds,
            senderId,
            date,
            isSystemMessage,
            lastEdited
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
  } else {
    await processLinks();
  }
  async function processLinks() {
    const attachmentUrl = attachments?.[0]?.proxyUrl || "";
    if (!content && !attachmentUrl) {
      return;
    }
    const links: string[] = attachmentUrl
      ? [attachmentUrl]
      : extractLinks(content).filter((link) => link !== attachmentUrl);

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
          date,
          isSystemMessage,
          lastEdited
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

function processAttachments(attachments?: Attachment[]): Attachment[] {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }
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
    renderFileIcon(file, attachment.fileName);
    const attachmentUrl = getAttachmentUrl(attachment.fileId);

    const textWrapper = createEl("div", { className: "attachment-text" });

    const title = createEl("a", {
      className: "attachment-title",
      textContent: attachment.fileName,
      href: attachmentUrl,
      download: attachment.fileName,
      alt: attachment.fileName
    });
    title.addEventListener("click", (e) => {
      e.preventDefault();
      const link = e.currentTarget as HTMLAnchorElement;
      const a = document.createElement("a");
      a.href = link.href;
      a.download = link.download || "";
      a.click();
    });

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

function doesMessageHasProxyiedLink(link: string) {
  const result = currentAttachments.some((a) => a.attachment.proxyUrl === link);
  return result;
}

function processMediaLink(
  link: string,
  attachment: Attachment | null,
  messageContentElement: HTMLElement,
  content: string,
  metadata: Metadata | undefined,
  embeds: Embed[] | undefined,
  senderId: string,
  date: Date,
  isSystemMessage: boolean,
  lastEdited?: string | null
): Promise<boolean> {
  return new Promise<boolean>(async (resolve) => {
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
        if (!attachment) {
          if (isTenorURL(link)) {
            mediaElement = createTenorElement(
              messageContentElement,
              content,
              link,
              senderId,
              date
            );
          } else {
            mediaElement = createImageElement("", link, senderId, date);
          }
        }
        if (attachment?.isImageFile) {
          mediaElement = createImageElement(
            "",
            attachment.proxyUrl ?? getAttachmentUrl(attachment.fileId),
            senderId,
            date,
            attachment?.fileId,
            attachment?.isSpoiler,
            attachment?.fileSize,
            attachment?.fileName
          );
        } else if (attachment?.isVideoFile) {
          mediaElement = await createVideoElement(
            attachment.proxyUrl ?? link,
            true
          );
        }
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
      handleLink(
        messageContentElement,
        content,
        isSystemMessage,
        metadata,
        lastEdited
      );
      if (doesMessageHasProxyiedLink(link)) {
        mediaElement = createImageElement(
          attachment?.fileName ?? "",
          link,
          senderId,
          date,
          attachment?.fileId,
          attachment?.isSpoiler,
          attachment?.fileSize,
          attachment?.fileName
        );
      }
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

export async function handleLink(
  messageContentElement: HTMLElement,
  content: string,
  isSystemMessage: boolean = false,
  metadata?: Metadata,
  lastEdited?: string | null
) {
  if (!content) return;
  if (isSystemMessage && metadata?.type === "pin_notification") {
    content = await buildPinSystemMessage(metadata);
  }

  renderContent(messageContentElement, content, isSystemMessage);

  if (isSystemMessage) {
    bindSystemMessageLinks(messageContentElement, metadata);
    messageContentElement.classList.add("system-message-container");
  }

  messageContentElement.dataset.contentLoaded = "true";
  setupEmojiListeners();

  if (lastEdited) {
    addEditedIndicator(messageContentElement, lastEdited);
  }
}

async function buildPinSystemMessage(metadata: Metadata): Promise<string> {
  const nickname = !metadata.pinnerUserId
    ? deletedUser
    : await userManager.getUserNick(metadata.pinnerUserId);

  const pinnedAtDate = new Date(metadata.pinnedAt || "");
  const locale = translations.getLocale();
  const formattedDate = pinnedAtDate.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  return `<a href="#" class="pinner-name-link">${nickname}</a> pinned a message to <a href="#" class="channel-link">this channel</a>. <a href="#" class="see-all-pinned-link">See all pinned messages</a> — ${formattedDate}`;
}

function renderContent(
  container: HTMLElement,
  content: string,
  isSystemMessage: boolean
) {
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const seenUrls = new Set<string>();

  const insertTextOrHTML = (text: string) => {
    if (!text.trim()) return;
    const replaced = replaceCustomEmojisForChatContainer(text);
    const span = createEl("span", { innerHTML: replaced });
    if (isSystemMessage) span.classList.add("system-message");
    container.appendChild(span);
  };

  while ((match = urlPattern.exec(content)) !== null) {
    const url = match[0];
    if (seenUrls.has(url)) {
      lastIndex = match.index + url.length;
      continue;
    }
    seenUrls.add(url);

    const start = match.index;
    const end = start + url.length;

    if (start > lastIndex) insertTextOrHTML(content.slice(lastIndex, start));

    const urlLink = createEl("a", {
      textContent: url,
      href: url,
      className: "url-link"
    });

    urlLink.addEventListener("click", (e) => {
      e.preventDefault();
      openExternalUrl(url);
    });

    container.appendChild(urlLink);
    lastIndex = end;
  }

  if (lastIndex < content.length) {
    insertTextOrHTML(content.slice(lastIndex));
  }
}

function bindSystemMessageLinks(container: HTMLElement, metadata?: Metadata) {
  if (!container.parentElement) return;

  const m = cacheInterface.getMessage(
    currentGuildId,
    guildCache.currentChannelId,
    container.parentElement.id
  );

  const events: [string, () => void][] = [
    [".see-all-pinned-link", togglePin],
    [
      ".pinner-name-link",
      () => {
        if (metadata?.pinnerUserId)
          createMentionProfilePop(container, metadata.pinnerUserId);
      }
    ],
    [
      ".channel-link",
      () => {
        if (m?.channelId) changeChannelWithId(m.channelId);
      }
    ]
  ];

  console.log(m);
  for (const [selector, handler] of events) {
    const el = container.querySelector(selector) as HTMLElement;
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        if (metadata?.pinnerUserId)
          el.setAttribute("data-user-id", metadata?.pinnerUserId);
        handler();
      });
    }
  }
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
    const imgElement = await createImageElement(
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
      className: "embed-video-container video-container"
    });
    const videoElement = await createVideoElement(embed.video.url);
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

export function shouldRenderMedia(
  attachment: AttachmentWithMetaData,
  isFilesList: boolean
) {
  const { isImageFile, isVideoFile, proxyUrl } = attachment.attachment;

  if (isFilesList) {
    if (!isImageFile && !isVideoFile) {
      return false;
    }
    if (!proxyUrl) {
      return false;
    }

    return true;
  }

  return true;
}
