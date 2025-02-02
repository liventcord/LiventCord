import DOMPurify from "dompurify";
import { displayImagePreview, beautifyJson, displayJsonPreview } from "./ui";
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
  defaultProfileImage,
} from "./utils";
import { translations } from "./translations";

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
      maxHeight: `${maxTenorHeight}px`,
    },
    loading: "lazy",
    className: "tenor-image",
  });

  imgElement.setAttribute("data-src", tenorURL);

  imgElement.onload = function () {
    const actualSrc = imgElement.getAttribute("data-src");
    if (actualSrc) {
      imgElement.src = DOMPurify.sanitize(actualSrc);
    }
  };

  imgElement.onerror = function () {
    imgElement.src = defaultProfileImage;
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
    className: "imageElement",
    src: defaultMediaImageSrc,
    style: {
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`,
    },
  });

  imgElement.onload = function () {
    const actualSrc = DOMPurify.sanitize(imgElement.getAttribute("data-src"));
    if (actualSrc && imgElement.src === defaultMediaImageSrc) {
      imgElement.src = actualSrc;
    }
  };

  imgElement.onerror = function () {
    imgElement.src = defaultProfileImage;
    imgElement.remove();
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
    controls: true,
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
      textContent: truncatedJsonLines,
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
    className: "youtube-element",
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
export async function createMediaElement(
  content,
  messageContentElement,
  newMessage,
  attachmentUrls,
  metadata,
) {
  const links = extractLinks(content) || [];
  let mediaCount = 0;
  let linksProcessed = 0;

  if (
    attachmentUrls &&
    typeof attachmentUrls === "string" &&
    attachmentUrls.trim() !== ""
  ) {
    attachmentUrls = JSON.parse(attachmentUrls.replace(/\\/g, ""));
    if (
      attachmentUrls.length > 0 &&
      !attachmentUrls[0].startsWith(`${location.origin}`)
    ) {
      attachmentUrls[0] = `${location.origin}${attachmentUrls[0]}`;
    }
    links.push(...attachmentUrls);
  }

  const maxLinks = 4;

  const processLinks = async () => {
    while (linksProcessed < links.length && mediaCount < maxLinks) {
      try {
        const isError = await processMediaLink(
          links[linksProcessed],
          newMessage,
          messageContentElement,
          content,
          metadata,
        );
        if (!isError) {
          mediaCount++;
        }
        linksProcessed++;
      } catch (error) {
        console.error("Error processing media link:", error);
        linksProcessed++;
      }
    }
  };

  await processLinks();
}
export function createRegularText(content) {
  const spanElement = createEl("p", { id: "message-content-element" });
  spanElement.textContent = content;
  spanElement.style.marginLeft = "0px";
  return spanElement;
}
export function processMediaLink(
  link,
  newMessage,
  messageContentElement,
  content,
  metadata,
) {
  return new Promise((resolve, reject) => {
    let mediaElement = null;
    newMessage.setAttribute("data-attachment_url", link);

    const handleMediaElement = () => {
      if (mediaElement) {
        const handleLoad = () => {
          const dummyElement = messageContentElement.querySelector(
            `img[data-dummy="${link}"]`,
          );
          if (dummyElement) {
            messageContentElement.replaceChild(mediaElement, dummyElement);
          }
          resolve();
        };

        const handleError = (error) => {
          console.error("Error loading media element:", error);
          const spanElement = createEl("span", {
            textContent: translations.getTranslation("failed-media"),
            style: {
              display: "inline-block",
              maxWidth: "100%",
              maxHeight: "100%",
              color: "red",
            },
          });
          if (mediaElement.parentNode) {
            mediaElement.parentNode.replaceChild(spanElement, mediaElement);
          }
          resolve(true);
        };

        if (
          mediaElement instanceof HTMLImageElement ||
          mediaElement instanceof HTMLAudioElement ||
          mediaElement instanceof HTMLVideoElement
        ) {
          mediaElement.addEventListener("load", handleLoad);
          mediaElement.addEventListener("error", handleError);
        } else {
          messageContentElement.appendChild(mediaElement);
          resolve();
        }
      } else {
        resolve(true);
      }
    };

    //if (!isJson && !isYt) {
    //    if (String(userId) === String(lastSenderID)) {
    //        mediaElement.style.marginLeft = "55px";
    //    } else {
    //        mediaElement.style.marginLeft = "55px";
    //    }
    //    mediaElement.style.paddingTop = "50px";
    //}

    if (isImageURL(link) || isAttachmentUrl(link)) {
      mediaElement = createEl("img", {
        className: "chat-image",
        src: DOMPurify.sanitize(link),
      });
      mediaElement.dataset.dummy = link;
      mediaElement.addEventListener("click", function () {
        displayImagePreview(mediaElement.src);
      });
      messageContentElement.appendChild(mediaElement);
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
      displayWebPreview(messageContentElement, link, metadata);
    } else {
      const spanElement = createRegularText(content);
      messageContentElement.appendChild(spanElement);

      resolve(true);
    }

    handleMediaElement();
  });
}

export function appendEmbedToMessage(messageElement, url, data) {
  const embedContainer = createEl("div", { className: "embed-container" });
  const siteName = data.siteName;
  if (siteName) {
    const headerElement = createEl("p", { textContent: siteName });
    embedContainer.appendChild(headerElement);
  }
  const titleElement = createEl("a", {
    textContent: data.title,
    className: "url-link",
    href: url,
    target: "_blank",
  });
  const descriptionElement = createEl("p", { textContent: data.description });

  embedContainer.appendChild(titleElement);
  embedContainer.appendChild(descriptionElement);
  messageElement.appendChild(embedContainer);
}

export function displayWebPreview(messageElement, url, data) {
  try {
    if (data) {
      appendEmbedToMessage(messageElement, url, {
        title: data.title,
        description: data.description || data.title,
        siteName: data.siteName,
      });
    }
  } catch (error) {
    console.error("Error displaying web preview:", error);
  }
}
