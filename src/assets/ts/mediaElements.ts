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
  defaultMediaImageSrc,
  defaultProfileImageSrc
} from "./utils.ts";
import { translations } from "./translations.ts";

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
}

const maxWidth = 512;
const maxHeight = 384;

const maxTenorWidth = 768;
const maxTenorHeight = 576;

export function createTenorElement(msgContentElement, inputText, url) {
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
  });

  imgElement.setAttribute("data-src", tenorURL);

  imgElement.onload = function () {
    const actualSrc = imgElement.getAttribute("data-src");
    if (actualSrc) {
      imgElement.src = DOMPurify.sanitize(actualSrc);
    }
  };

  imgElement.onerror = function () {
    imgElement.src = defaultProfileImageSrc;
    imgElement.remove();
    msgContentElement.textContent = inputText;
  };

  imgElement.addEventListener("click", function () {
    displayImagePreview(imgElement.src);
  });

  return imgElement;
}

export function createImageElement(msgContentElement, inputText, url_src) {
  const imgElement = createEl("img", {
    className: "chat-image",
    src: defaultMediaImageSrc,
    style: {
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`
    }
  });

  imgElement.setAttribute("data-src", url_src);

  imgElement.onload = function () {
    const actualSrc = DOMPurify.sanitize(imgElement.getAttribute("data-src"));

    if (imgElement.src === defaultMediaImageSrc) {
      imgElement.src = actualSrc;
    }
  };

  imgElement.onerror = function () {
    imgElement.onerror = null;
    imgElement.src = defaultProfileImageSrc;
    msgContentElement.textContent = inputText;
  };

  imgElement.addEventListener("click", function () {
    displayImagePreview(imgElement.src);
  });

  return imgElement;
}

export function createAudioElement(audioURL) {
  const audioElement = createEl("audio", {
    src: DOMPurify.sanitize(audioURL),
    controls: true
  });
  return audioElement;
}
export async function createJsonElement(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch JSON data");
    }
    const jsonData = await response.json();
    const beautifiedData = beautifyJson(jsonData);
    const truncatedJsonLines = beautifiedData
      .split("\n")
      .slice(0, 15)
      .join("\n");
    const jsonContainer = createEl("div", { className: "json-container" });
    const jsonElement = createEl("pre", {
      className: "json-element",
      textContent: truncatedJsonLines
    });

    jsonContainer.appendChild(jsonElement);
    jsonContainer.addEventListener("click", function () {
      displayJsonPreview(beautifiedData);
    });
    return jsonContainer;
  } catch (error) {
    console.error("Error creating JSON element:", error);
    return null;
  }
}

export function createYouTubeElement(url) {
  const youtubeURL = getYouTubeEmbedURL(url);

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

export function createVideoElement(url) {
  if (!isVideoUrl(url)) {
    throw new Error("Invalid video URL");
  }
  let sanitizedUrl;
  try {
    sanitizedUrl = DOMPurify.sanitize(url);
  } catch (e) {
    console.error("Error sanitizing URL", e);
    throw new Error("Failed to sanitize URL");
  }

  const videoElement = createEl("video");
  videoElement.src = sanitizedUrl;
  videoElement.width = "560";
  videoElement.height = "315";
  videoElement.controls = true;

  return videoElement;
}
export function createRegularText(content) {
  const spanElement = createEl("p", { id: "message-content-element" });
  spanElement.textContent = content;
  spanElement.style.marginLeft = "0px";
  return spanElement;
}

export async function createMediaElement(
  content,
  messageContentElement,
  newMessage,
  attachmentUrls,
  metadata,
  embeds
) {
  const links = extractLinks(content) || [];
  let mediaCount = 0;
  let linksProcessed = 0;
  const maxLinks = 4;

  if (typeof attachmentUrls === "string" && attachmentUrls.trim() !== "") {
    try {
      attachmentUrls = JSON.parse(attachmentUrls);
    } catch (e) {
      attachmentUrls = attachmentUrls.split(",").map((url) => url.trim());
    }

    if (
      attachmentUrls.length > 0 &&
      !attachmentUrls[0].startsWith("http://") &&
      !attachmentUrls[0].startsWith("https://")
    ) {
      attachmentUrls[0] = `${location.origin}${attachmentUrls[0]}`;
    }
    links.push(...attachmentUrls);
  }

  if (embeds.length > 0) {
    try {
      displayEmbeds(messageContentElement, "", embeds, metadata);
    } catch (embedError) {
      console.error("Error displaying embeds:", embedError);
    }
  }

  if (links.length > 0) {
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

export function processMediaLink(
  link,
  newMessage,
  messageContentElement,
  content,
  metadata,
  embeds
) {
  return new Promise((resolve) => {
    let mediaElement = null;
    newMessage.setAttribute("data-attachment_url", link);

    const handleLoad = () => {
      resolve(false);
    };

    const handleError = () => {
      console.error("Error loading media element");
      const spanElement = createEl("span", {
        textContent: translations.getTranslation("failed-media"),
        style: {
          display: "inline-block",
          maxWidth: "100%",
          maxHeight: "100%",
          color: "red"
        }
      });
      if (mediaElement.parentNode) {
        mediaElement.parentNode.replaceChild(spanElement, mediaElement);
      }
      resolve(true);
    };

    if (isImageURL(link) || isAttachmentUrl(link)) {
      mediaElement = createImageElement(
        messageContentElement,
        null,
        DOMPurify.sanitize(link)
      );
      mediaElement.dataset.dummy = link;
    } else if (isTenorURL(link)) {
      mediaElement = createTenorElement(messageContentElement, content, link);
    } else if (isYouTubeURL(link)) {
      mediaElement = createYouTubeElement(link);
    } else if (isAudioURL(link)) {
      mediaElement = createAudioElement(link);
    } else if (isVideoUrl(link)) {
      mediaElement = createVideoElement(link);
    } else if (isJsonUrl(link)) {
      mediaElement = createJsonElement(link);
    } else if (isURL(link)) {
      handleLink(messageContentElement, content);
    } else {
      messageContentElement.appendChild(createRegularText(content));
      resolve(true);
      return;
    }
    try {
      displayEmbeds(messageContentElement, link, embeds, metadata);
    } catch (embedError) {
      console.error("Error displaying embeds:", embedError);
    }
    if (
      mediaElement instanceof HTMLImageElement ||
      mediaElement instanceof HTMLAudioElement ||
      mediaElement instanceof HTMLVideoElement
    ) {
      mediaElement.addEventListener("load", handleLoad, { once: true });
      mediaElement.addEventListener("error", handleError, { once: true });
    }
    if (mediaElement) {
      messageContentElement.appendChild(mediaElement);
    }
  });
}

function handleLink(messageContentElement, content) {
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

function applyBorderColor(element, decimalColor) {
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
function appendEmbedToMessage(
  messageElement: HTMLElement,
  embed: Embed,
  link: string,
  metaData: MetaData
) {
  const embedContainer = createEl("div", { className: "embed-container" });
  if (embed.color) {
    applyBorderColor(embedContainer, embed.color);
  }

  if (embed.type === embedTypes.Image) {
    if (embed.image && embed.image.url) {
      const imageContainer = createEl("div", {
        className: "embed-image-container"
      });

      const imgElement = createImageElement(
        imageContainer,
        embed.title || "",
        embed.image.url
      );
      imgElement.setAttribute("data-src", embed.image.url);
      const textElement = createRegularText(embed.title);
      textElement.style.fontSize = "1.2em";
      imageContainer.appendChild(textElement);
      imageContainer.appendChild(imgElement);
      embedContainer.appendChild(imageContainer);
    }
  } else {
    console.warn("Unsupported embed type: ", embed.type);
  }

  if (metaData) {
    const siteName = metaData.siteName;
    if (siteName) {
      const headerElement = createEl("p", { textContent: siteName });
      embedContainer.appendChild(headerElement);
    }
    if (link) {
      const titleElement = createEl("a", {
        textContent: metaData.title,
        className: "url-link",
        href: link,
        target: "_blank"
      });

      embedContainer.appendChild(titleElement);
    }
    const descriptionElement = createEl("p", {
      textContent: metaData.description || metaData.title
    });

    embedContainer.appendChild(descriptionElement);
  }

  messageElement.appendChild(embedContainer);
}

function displayEmbeds(messageElement, link, embeds, metaData) {
  try {
    embeds.forEach((embed) => {
      appendEmbedToMessage(messageElement, embed, link, metaData);
    });
  } catch (error) {
    console.error("Error displaying web preview:", error);
  }
}
