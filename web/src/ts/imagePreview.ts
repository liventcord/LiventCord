import DOMPurify from "dompurify";
import {
  createEl,
  getId,
  formatDateGood,
  formatFileSize,
  getImageExtension,
  estimateImageSizeBytes,
  getResolution,
  getFileNameFromUrl,
  corsDomainManager,
  isURL,
  isImageLoaded,
  getAttachmentUrl,
  estimateVideoSizeBytes,
  onDoc
} from "./utils.ts";
import {
  isImageSpoilered,
  setImageUnspoilered,
  attachmentPattern
} from "./mediaElements.ts";
import { setProfilePic } from "./avatar.ts";
import { userManager } from "./user.ts";
import { createTooltip } from "./tooltip.ts";
import { showReplyMenu } from "./chatbar.ts";
import { scrollToMessage } from "./chat.ts";
import { router } from "./router.ts";
import { FileHandler } from "./fileHandler.ts";
import { Attachment } from "./types/interfaces.ts";
import { SVG } from "./svgIcons.ts";
import { initReverseImageSearch } from "./reverseImageSearch.ts";

// --- State

let currentFileName = "";
let isPreviewZoomed = false;
export let isDragging = false;
let startX = 0;
let startY = 0;
let isAddedDragListeners = false;
let isOnMediaPanel = false;
let currentChatPreviewIndex = 0;
let currentMediaPreviewIndex = 0;

const imagePreviewContainer = getId("image-preview-container") as HTMLElement;

// --- Helpers

function getSourceImage(imageElement: HTMLImageElement): string {
  if (!imageElement || typeof imageElement.getAttribute !== "function")
    return "";
  return (
    imageElement.dataset?.originalSrc ||
    imageElement.getAttribute("data-original-src") ||
    imageElement.src ||
    ""
  );
}

function compareSrcs(image1: string, image2: string): boolean {
  const match1 = image1.match(attachmentPattern);
  const match2 = image2.match(/\/attachments\/(\d+)/);
  return (match1?.[1] ?? null) === (match2?.[1] ?? null);
}

function getImages(
  chatContent: HTMLElement,
  mediaGrid: HTMLElement
): HTMLImageElement[] {
  const container = isOnMediaPanel ? mediaGrid : chatContent;
  const selector = isOnMediaPanel ? ".image-box img" : ".chat-image";

  return Array.from(
    new Set(
      Array.from(container.querySelectorAll<HTMLImageElement>(selector)).filter(
        (img) => img.src !== "" && !img.classList.contains("profile-pic")
      )
    )
  );
}

// --- Zoom

function toggleZoom(): void {
  const previewImage = getId("preview-image") as HTMLImageElement;
  if (!previewImage) return;

  isPreviewZoomed = !isPreviewZoomed;
  const zoomButton = getId("preview-image-zoom") as HTMLButtonElement;
  const divZoom = zoomButton?.querySelector("div");

  if (isPreviewZoomed) {
    previewImage.classList.add("zoomed");
    previewImage.style.cssText =
      "left:50%;top:50%;transform:translate(-50%,-50%);width:auto;height:auto;";
  } else {
    previewImage.classList.remove("zoomed");
    previewImage.style.cssText =
      "left:0%;top:0%;transform:translate(-50%,-50%);width:'';height:'';";
  }

  if (divZoom) {
    divZoom.innerHTML = isPreviewZoomed ? SVG.zoomOutSvg : SVG.zoomInSvg;
  }
}

// --- Drag

function setupImagePreviewDrag(previewImage: HTMLImageElement): void {
  previewImage.addEventListener("contextmenu", (e) => e.preventDefault());

  previewImage.addEventListener("mousedown", (e) => {
    if (e.button === 2 && isPreviewZoomed) {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX - previewImage.offsetLeft;
      startY = e.clientY - previewImage.offsetTop;
    }
  });

  previewImage.addEventListener("touchstart", (e) => {
    if (isPreviewZoomed && e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - previewImage.offsetLeft;
      startY = e.touches[0].clientY - previewImage.offsetTop;
    }
  });

  onDoc("mousemove", (e) => {
    if (isDragging) dragMove(e.clientX, e.clientY, previewImage);
  });

  onDoc(
    "touchmove",
    (e) => {
      if (isDragging && e.touches.length === 1) {
        e.preventDefault();
        dragMove(e.touches[0].clientX, e.touches[0].clientY, previewImage);
      }
    },
    { passive: false }
  );

  onDoc("mouseup", () => {
    isDragging = false;
  });
  onDoc("touchend", () => {
    isDragging = false;
  });
}

function dragMove(
  clientX: number,
  clientY: number,
  previewImage: HTMLImageElement
): void {
  const newX = clientX - startX;
  const newY = clientY - startY;
  const overflowX = previewImage.width * 0.8;
  const overflowY = previewImage.height * 0.8;
  const maxX =
    imagePreviewContainer.clientWidth - previewImage.width + overflowX;
  const maxY =
    imagePreviewContainer.clientHeight - previewImage.height + overflowY;

  previewImage.style.left = `${Math.min(Math.max(newX, -overflowX), maxX)}px`;
  previewImage.style.top = `${Math.min(Math.max(newY, -overflowY), maxY)}px`;
}

// --- Metadata

function setupPreviewMetadata(
  mediaElement: HTMLImageElement | HTMLVideoElement,
  sourceImage: string,
  senderId?: string,
  date?: Date,
  fileSize?: number
): void {
  const previewNick = getId("preview-nick");
  const descriptionName = getId("details-container-description-1");
  const descriptionSize = getId("details-container-description-2");
  const previewDate = getId("preview-date");
  const previewContent = getId("preview-content");
  const senderAvatar = getId("preview-author")?.querySelector(
    ".preview-avatar"
  ) as HTMLImageElement;

  if (senderId && senderAvatar) {
    senderAvatar.id = senderId;
    setProfilePic(senderAvatar, senderId);
  }
  if (previewNick && senderId)
    previewNick.textContent = userManager.getUserNick(senderId);

  const filename =
    mediaElement.dataset.filename ||
    getFileNameFromUrl(sourceImage) ||
    sourceImage;
  currentFileName = sourceImage;

  if (descriptionName && filename) {
    descriptionName.textContent = filename;
    descriptionName.addEventListener("mouseover", () =>
      createTooltip(descriptionName, filename)
    );
  }

  let size = Number(fileSize);
  let isEstimated = false;
  if (!size || isNaN(size)) {
    isEstimated = true;
    if (mediaElement instanceof HTMLImageElement) {
      size = estimateImageSizeBytes(
        mediaElement.naturalWidth,
        mediaElement.naturalHeight,
        getImageExtension(mediaElement)
      );
    } else if (mediaElement instanceof HTMLVideoElement) {
      size = estimateVideoSizeBytes(
        mediaElement.videoWidth,
        mediaElement.videoHeight,
        mediaElement.duration
      );
    }
  }

  if (descriptionSize) {
    setTimeout(() => {
      const res = getResolution(mediaElement);
      const sizeText = `${res} (${formatFileSize(size)}${isEstimated ? " roughly" : ""})`;
      descriptionSize.textContent = sizeText;
      descriptionSize.addEventListener("mouseover", () =>
        createTooltip(descriptionSize, sizeText)
      );
    }, 100);
  }

  const focusMessage = () => focusOnMessage(mediaElement);

  if (previewDate && date) {
    previewDate.textContent = formatDateGood(date);
    previewDate.addEventListener("click", (e) => {
      e.preventDefault();
      focusMessage();
    });
  }

  const content = isOnMediaPanel
    ? mediaElement.parentElement?.dataset.content
    : (mediaElement.parentNode?.parentNode as HTMLElement | null)?.dataset
        .content;

  if (previewContent) {
    previewContent.textContent = content || "";
    previewContent.addEventListener("click", (e) => {
      e.preventDefault();
      focusMessage();
    });
    previewContent.addEventListener("mouseover", () =>
      createTooltip(previewContent, content || "")
    );
  }
}

function focusOnMessage(
  mediaElement: HTMLElement,
  chatContent?: HTMLElement
): void {
  hideImagePreview();
  const findAndScroll = () => {
    if (isOnMediaPanel) {
      const msgId = mediaElement.parentElement?.dataset.messageid;
      if (msgId && chatContent) {
        const msg = chatContent.querySelector(
          `div[id=${CSS.escape(msgId)}]`
        ) as HTMLElement;
        if (msg) scrollToMessage(msg);
      }
    } else {
      const parent = mediaElement.parentElement?.parentElement;
      if (parent && chatContent) {
        const msg = chatContent.querySelector(
          `div[id=${CSS.escape(parent.id)}]`
        ) as HTMLElement;
        if (msg) scrollToMessage(msg);
      }
    }
  };
  setTimeout(findAndScroll, 50);
}

// --- Button handlers

function setupDownloadButton(sanitizedSrc: string): void {
  const btn = getId("preview-image-download") as HTMLButtonElement;
  const previewImage = getId("preview-image") as HTMLImageElement;

  btn.onclick = async () => {
    if (!sanitizedSrc) return;
    try {
      if (previewImage?.complete && previewImage.naturalWidth !== 0) {
        const canvas = createEl("canvas", {
          width: previewImage.naturalWidth,
          height: previewImage.naturalHeight
        });
        canvas.getContext("2d")?.drawImage(previewImage, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = createEl("a", {
              href: url,
              download: sanitizedSrc.split("/").pop() || "image.jpg"
            });
            a.click();
            URL.revokeObjectURL(url);
          } else {
            router.downloadLink(sanitizedSrc);
          }
        }, "image/jpeg");
      } else {
        router.downloadLink(sanitizedSrc);
      }
    } catch {
      router.downloadLink(sanitizedSrc);
    }
  };
}

function setupOpenButton(sanitizedSrc: string): void {
  const btn = getId("preview-image-open") as HTMLButtonElement;
  const previewImage = getId("preview-image") as HTMLImageElement;

  btn.onclick = () => {
    if (sanitizedSrc) {
      router.openLink(
        isURL(currentFileName) ? currentFileName : sanitizedSrc,
        previewImage
      );
    }
  };
}
function setupPreviewSpin(): void {
  const spinButton = getId("preview-image-flip") as HTMLButtonElement;
  if (!spinButton) return;

  const previewImage = getId("preview-image") as HTMLImageElement;
  if (!previewImage) return;

  let rotation = 0;

  spinButton.onclick = () => {
    rotation = (rotation + 90) % 360;
    previewImage.style.setProperty("--preview-rotate", `${rotation}deg`);
    spinButton.title = `Rotate image to ${rotation}°`;
  };

  previewImage.addEventListener("load", () => {
    previewImage.style.setProperty("--preview-rotate", "0deg");
  });
}

function setupReplyButton(
  imageElement: HTMLImageElement,
  senderId?: string
): void {
  const btn = getId("preview-image-reply") as HTMLButtonElement;
  if (!btn) return;

  btn.onclick = () => {
    hideImagePreview();
    const imagesMessage = imageElement.parentNode?.parentNode as HTMLElement;
    if (imagesMessage) {
      scrollToMessage(imagesMessage);
      const messageId = (
        imageElement.parentElement?.parentElement as HTMLElement
      )?.id;
      if (senderId && messageId) showReplyMenu(messageId, senderId);
    }
  };
}

function setupZoomButton(): void {
  getId("preview-image-zoom")?.addEventListener("click", toggleZoom);
}

export function isImagePreviewOpen(): boolean {
  return imagePreviewContainer.style.display === "flex";
}

export function hideImagePreview(): void {
  const previewImage = getId("preview-image") as HTMLImageElement;
  const previewVideo = getId("preview-video") as HTMLVideoElement;

  previewImage.style.animation =
    "preview-image-disappear-animation 0.15s forwards";
  if (isPreviewZoomed) toggleZoom();

  setTimeout(() => {
    imagePreviewContainer.style.display = "none";
    previewImage.src = "";
    previewVideo.src = "";
  }, 150);
}

export async function displayImagePreviewBlob(
  imageElement: HTMLImageElement
): Promise<void> {
  const blob = await (await fetch(imageElement.src)).blob();
  const objectUrl = URL.createObjectURL(blob);
  const newImage = createEl("img", { src: objectUrl }) as HTMLImageElement;
  await displayImagePreview(newImage);
  URL.revokeObjectURL(objectUrl);
}

export async function displayVideoPreview(
  a: Attachment,
  senderId: string
): Promise<void> {
  const previewVideo = getId("preview-video") as HTMLVideoElement;
  const previewImage = getId("preview-image") as HTMLImageElement;

  imagePreviewContainer.classList.remove("image-preview-container-img");
  imagePreviewContainer.style.display = "flex";
  previewVideo.style.display = "flex";

  const sanitizedVideo = DOMPurify.sanitize(getAttachmentUrl(a, false));
  previewVideo.src = sanitizedVideo;
  previewImage.style.animation = "preview-image-animation 0.2s forwards";

  setupOpenButton(sanitizedVideo);
  setupDownloadButton(sanitizedVideo);
  setupPreviewMetadata(
    previewVideo,
    sanitizedVideo,
    senderId,
    new Date(),
    a.fileSize
  );
}

export async function displayImagePreview(
  imageElement: HTMLImageElement,
  senderId?: string,
  date?: Date,
  isSpoiler = false,
  isFromMediaPanel = false
): Promise<void> {
  const previewImage = getId("preview-image") as HTMLImageElement;
  const previewVideo = getId("preview-video") as HTMLVideoElement;

  imagePreviewContainer.classList.add("image-preview-container-img");
  imagePreviewContainer.style.display = "flex";
  previewVideo.style.display = "none";

  const sourceImage = getSourceImage(imageElement);
  const sanitizedSrc = DOMPurify.sanitize(sourceImage);

  previewImage.style.animation = "preview-image-animation 0.2s forwards";
  previewImage.src = isImageLoaded(imageElement)
    ? imageElement.src
    : await corsDomainManager.getProxy(sanitizedSrc);

  isOnMediaPanel = isFromMediaPanel;

  previewImage.classList.toggle("spoilered", isSpoiler);

  setupPreviewMetadata(imageElement, sourceImage, senderId, date);
  setupZoomButton();
  setupOpenButton(sanitizedSrc);
  setupDownloadButton(sanitizedSrc);
  setupReplyButton(imageElement, senderId);
  setupPreviewSpin();

  previewImage.onclick = () => {
    if (isSpoiler) {
      FileHandler.unBlurImage(previewImage);
      setImageUnspoilered(imageElement.id);
      isSpoiler = false;
    } else {
      toggleZoom();
    }
  };

  if (!isAddedDragListeners) {
    isAddedDragListeners = true;
    setupImagePreviewDrag(previewImage);
  }
}

export function initImagePreviewNavigation(
  getChatContent: () => HTMLElement,
  getMediaGrid: () => HTMLElement
): void {
  getId("popup-close")?.addEventListener("click", hideImagePreview);

  imagePreviewContainer.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "image-preview-container")
      hideImagePreview();
  });

  onDoc("keydown", (e) => {
    if (e.key === "Escape") {
      hideImagePreview();
      return;
    }
    if (!isImagePreviewOpen()) return;
    if (e.key === "ArrowRight") navigate(1, getChatContent(), getMediaGrid());
    if (e.key === "ArrowLeft") navigate(-1, getChatContent(), getMediaGrid());
  });

  onDoc("dragstart", (e) => {
    if ((e.target as HTMLElement)?.tagName === "IMG") e.preventDefault();
  });
}

export function navigatePreviewBySwipe(
  direction: "next" | "prev",
  chatContent: HTMLElement,
  mediaGrid: HTMLElement
): void {
  if (isPreviewZoomed) return;
  navigate(direction === "next" ? 1 : -1, chatContent, mediaGrid);
}

function navigate(
  delta: 1 | -1,
  chatContent: HTMLElement,
  mediaGrid: HTMLElement
): void {
  const images = getImages(chatContent, mediaGrid);
  if (!images.length) return;

  if (isOnMediaPanel) {
    currentMediaPreviewIndex =
      (currentMediaPreviewIndex + delta + images.length) % images.length;
  } else {
    currentChatPreviewIndex =
      (currentChatPreviewIndex + delta + images.length) % images.length;
  }

  const idx = isOnMediaPanel
    ? currentMediaPreviewIndex
    : currentChatPreviewIndex;
  const img = images[idx];
  if (img) {
    displayImagePreview(
      img,
      img.dataset.userid ?? "",
      img.dataset.date ? new Date(img.dataset.date) : new Date(),
      isImageSpoilered(img.id)
    );
  }
}

export function syncPreviewIndex(
  sourceSrc: string,
  chatContent: HTMLElement,
  mediaGrid: HTMLElement,
  fromMediaPanel: boolean
): void {
  isOnMediaPanel = fromMediaPanel;
  const images = getImages(chatContent, mediaGrid);
  const idx = images.findIndex((img) => compareSrcs(img.src, sourceSrc));
  if (idx === -1) return;
  if (fromMediaPanel) currentMediaPreviewIndex = idx;
  else currentChatPreviewIndex = idx;
}

setTimeout(() => {
  initReverseImageSearch();
}, 0);
