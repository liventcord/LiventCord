import { fileTypeFromBuffer } from "file-type";
import { friendsCache } from "./friends.ts";
import {
  getId,
  createEl,
  disableElement,
  enableElement,
  formatFileSize,
  isCompressedFile,
  renderFileIcon,
  truncateString,
  onBody
} from "./utils.ts";
import { alertUser, displayImagePreviewBlob } from "./ui.ts";
import { isOnDm, isOnGuild } from "./router.ts";
import { maxAttachmentSize } from "./avatar.ts";
import { translations } from "./translations.ts";
import { userManager } from "./user.ts";
import { updateChatWidth } from "./chat.ts";
import { maxAttachmentsCount } from "./mediaElements.ts";
import { currentChannelName } from "./channels.ts";
import { adjustHeight as adjustChatBarHeight } from "./chatbar.ts";
import { SVG } from "./svgIcons.ts";
export const chatInput = getId("user-input") as HTMLElement;
export const chatContainer = getId("chat-container") as HTMLElement;
export const chatContent = getId("chat-content") as HTMLElement;
export const replyInfo = getId("reply-info") as HTMLElement;

export const fileInput = getId("fileInput") as HTMLInputElement;
export const attachmentsTray = getId("attachments-tray") as HTMLElement;
export const newMessagesBar = getId("newMessagesBar") as HTMLElement;
export const messageLimitText = getId("message-limit") as HTMLSpanElement;
const replyCloseButton = getId("reply-close-button") as HTMLButtonElement;

const getImageactionsHtml = (isImage: boolean): string => {
  return `
    <div class="image-actions">
      ${
        isImage
          ? `
        <div class="action-button">
          ${SVG.eye}
        </div>
        <div class="action-button">
          ${SVG.pencil}
        </div>
      `
          : ""
      }
      <div class="action-button remove">
        ${SVG.trash}
      </div>
    </div>
  `;
};

export let isAttachmentsAdded: boolean;
let fileList: File[] = [];
export const fileSpoilerMap: WeakMap<File, boolean> = new WeakMap();

export class FileHandler {
  static setIsAttachmentsAddedFalse() {
    isAttachmentsAdded = false;
  }
  static handleFileInput(
    eventOrFiles: Event | FileList | File[] | null = null
  ): void {
    const max = maxAttachmentSize * 1024 * 1024;

    const filesToProcessOriginal = FileHandler.extractFiles(eventOrFiles);
    const validFiles = FileHandler.filterValidFiles(filesToProcessOriginal);

    let remainingSize =
      max - fileList.reduce((acc, file) => acc + file.size, 0);
    const filteredFiles: File[] = [];

    for (const file of validFiles) {
      const fileName = truncateString(file.name, 40);
      if (file.size > max) {
        alertUser(
          translations.getFileIsLarge(fileName),
          translations.getMaxSize(maxAttachmentSize)
        );
        continue;
      }
      if (file.size > remainingSize) {
        alertUser(
          translations.getExceedSize(fileName),
          translations.getMaxSize(maxAttachmentSize)
        );
        continue;
      }

      filteredFiles.push(file);
      remainingSize -= file.size;
    }

    if (fileList.length + filteredFiles.length > maxAttachmentsCount) {
      alertUser(
        translations.getErrorMessage("MAXIMUM_LIMIT_REACHED"),
        translations.getAllowedSizeCount(maxAttachmentsCount)
      );

      filteredFiles.splice(maxAttachmentsCount - fileList.length);
    }

    for (const file of filteredFiles) {
      fileList.push(file);
      FileHandler.processFile(file);
    }

    adjustChatBarHeight();

    if (fileList.length > maxAttachmentsCount) {
      fileList = fileList.slice(0, maxAttachmentsCount);
    }

    FileHandler.syncFileInputWithFileList();
  }

  static extractFiles(eventOrFiles: Event | FileList | File[] | null): File[] {
    if (eventOrFiles instanceof Event) {
      const inputElement = eventOrFiles.target as HTMLInputElement;
      return inputElement?.files ? Array.from(inputElement.files) : [];
    } else if (
      eventOrFiles instanceof FileList ||
      eventOrFiles instanceof Array
    ) {
      return Array.from(eventOrFiles);
    }
    return [];
  }

  static filterValidFiles(files: File[]): File[] {
    return files.filter((file) => file instanceof Blob);
  }

  static async processFile(file: File) {
    const isImage = await FileHandler.isImageFile(file);
    const fileURL = isImage ? URL.createObjectURL(file) : "";
    FileHandler.renderFilePreview(fileURL, isImage, file);
    isAttachmentsAdded = true;
  }

  static async isImageFile(file: File): Promise<boolean> {
    try {
      if (await isCompressedFile(file.name)) {
        return false;
      }

      const readBuffer =
        file.size < 4100
          ? new Uint8Array(await file.arrayBuffer())
          : new Uint8Array(await file.slice(0, 4100).arrayBuffer());

      const result = await fileTypeFromBuffer(readBuffer);
      return (result && result.mime.startsWith("image/")) || false;
    } catch {
      return false;
    }
  }

  static async renderFilePreview(src: string, isImage: boolean, file: File) {
    const container = createEl("div", { className: "image-container" });
    (container as any)._file = file;
    let img: HTMLImageElement;

    if (isImage) {
      img = createEl("img", { src });
    } else {
      img = createEl("i", {
        className: "fa-solid fa-file attachment-preview-file"
      }) as HTMLImageElement;
      renderFileIcon(img, file.name);
    }

    const imageText = createEl("div", {
      className: "image-text",
      textContent: file.name
    });
    const sizeText = createEl("div", {
      className: "image-text right",
      textContent: formatFileSize(file.size)
    });
    container.appendChild(img);
    const isImageFile = await FileHandler.isImageFile(file);
    const imageActions = createEl("div", {
      innerHTML: getImageactionsHtml(isImageFile)
    });
    container.appendChild(imageActions);

    container.appendChild(imageText);
    container.appendChild(sizeText);
    attachmentsTray.appendChild(container);
    enableElement(attachmentsTray);

    img.addEventListener("click", function () {
      displayImagePreviewBlob(img);
    });

    const spoilerButton = imageActions.querySelector(
      ".action-button:nth-child(1)"
    );
    const editButton = imageActions.querySelector(
      ".action-button:nth-child(2)"
    );
    const removeButton = imageActions.querySelector(".action-button.remove");

    spoilerButton?.addEventListener("click", () =>
      FileHandler.toggleSpoilerImage(img)
    );
    editButton?.addEventListener("click", () => FileHandler.editImage(img));
    removeButton?.addEventListener("click", () => {
      FileHandler.removeImage(container, file);
      if (attachmentsTray.children.length === 0) {
        disableElement(attachmentsTray);
      }
    });
    this.adjustReplyPositionOnAttachments();
    updateChatWidth();
  }
  static adjustReplyPositionOnAttachments() {
    replyInfo.classList.add("reply-attachments-open");
    replyCloseButton.classList.add("reply-attachments-open");
  }

  static blurImage(img: HTMLImageElement) {
    if (img.parentElement?.classList.contains("spoiler-container")) return;

    const text = createEl("span", {
      textContent: "SPOILER",
      className: "spoiler-text"
    });
    const wrapper = createEl("div", { className: "spoiler-container" });

    const parent = img.parentElement;
    if (parent) parent.replaceChild(wrapper, img);

    wrapper.appendChild(img);
    wrapper.appendChild(text);

    img.style.filter = "blur(0.875rem)";
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.objectFit = "contain";
  }

  static unBlurImage(img: HTMLImageElement) {
    img.style.filter = "";
    img.style.width = "";
    img.style.height = "";
    img.style.objectFit = "";

    const wrapper = img.parentElement;
    if (!wrapper?.classList.contains("spoiler-container")) return;
    const parent = wrapper.parentElement;
    if (!parent) return;

    const spoilerText = wrapper.querySelector(".spoiler-text");
    if (spoilerText) spoilerText.remove();
    parent.replaceChild(img, wrapper);
  }

  static toggleSpoilerImage(img: HTMLImageElement): void {
    const imgWrapper = img.parentElement;
    if (!imgWrapper) return;

    const file = (imgWrapper as any)?._file as File | undefined;
    const spoilerText = imgWrapper.querySelector(".spoiler-text");
    const isCurrentlySpoilered =
      !!spoilerText && img.style.filter.includes("blur");

    if (isCurrentlySpoilered) {
      spoilerText?.remove();
      img.style.filter = "";
      if (file) fileSpoilerMap.set(file, false);
    } else {
      img.style.filter = "blur(0.875rem)";
      if (!spoilerText) {
        const span = createEl("span");
        span.className = "spoiler-text";
        span.textContent = "SPOILER";
        imgWrapper.appendChild(span);
      }
      if (file) fileSpoilerMap.set(file, true);
    }
  }

  static editImage(img: HTMLImageElement): void {
    alertUser("Image edit is not implemented!");
  }

  static async removeImage(container: HTMLElement, file: File) {
    const index = fileList.indexOf(file);
    if (index !== -1) {
      fileList.splice(index, 1);
      FileHandler.syncFileInputWithFileList();
    }
    const isImageFile = await FileHandler.isImageFile(file);
    if (isImageFile) {
      const img = container.querySelector("img");
      if (img && img.src) {
        URL.revokeObjectURL(img.src);
      }
    }
    if (fileList.length === 0) {
      disableElement(attachmentsTray);
    }
    console.log(fileList.length);

    container.remove();
    FileHandler.syncFileInputWithFileList();
  }

  static resetFileInput(): void {
    if (fileInput) {
      fileInput.value = "";
      fileInput.files = null;
      fileList = [];
    }
  }

  static syncFileInputWithFileList(): void {
    if (fileInput) {
      if (!fileList.length) {
        fileInput.value = "";
        fileInput.files = null;
      } else {
        const dataTransfer = new DataTransfer();
        fileList.forEach((file) => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
      }
    }
  }

  static setDropHandler() {
    const dropZone = getId("drop-zone") as HTMLElement;
    const fileButton = getId("file-button") as HTMLElement;
    if (!dropZone || !fileButton) {
      return;
    }
    if (!dropZone) {
      console.log("dropZone not found");
      return;
    }

    if (!fileButton) {
      console.log("fileButton not found");
      return;
    }

    const dragEvents = ["dragenter", "dragover", "dragleave", "drop"];
    dragEvents.forEach((eventName) => {
      onBody(eventName, preventDefaults, false);
    });

    onBody("dragenter", handleDragEnterOrOver, false);
    onBody("dragover", handleDragEnterOrOver, false);
    onBody("dragleave", handleDragLeave, false);
    onBody("drop", handleDrop, false);

    fileButton.addEventListener("click", () => {
      console.log("fileButton clicked");
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      console.log("fileInput change event");
      FileHandler.handleFileInput(e);
    });

    function preventDefaults(e: Event) {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleDragEnterOrOver(e: DragEvent) {
      dropZone.style.display = "flex";
      dropZone.classList.add("hover");
      const chanName = isOnGuild
        ? currentChannelName
        : isOnDm
          ? userManager.getUserNick(friendsCache.currentDmId)
          : "";
      const dropChannelName = getId("drop-zone-channel-name");
      if (dropChannelName) {
        dropChannelName.textContent = translations.getDropZoneText(chanName);
      }
    }

    function handleDragLeave(e: DragEvent) {
      if (
        e.relatedTarget === null ||
        !document.body.contains(e.relatedTarget as Node)
      ) {
        console.log("Full dragleave, hiding dropZone");
        dropZone.style.display = "none";
        dropZone.classList.remove("hover");
      }
    }

    function handleDrop(e: DragEvent) {
      console.log("Handling drop");
      dropZone.style.display = "none";
      dropZone.classList.remove("hover");

      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files?.length) {
        console.log(`${files.length} file(s) dropped`);
        FileHandler.handleFileInput(files);
      } else {
        console.log("No files dropped");
      }
    }
  }
}
