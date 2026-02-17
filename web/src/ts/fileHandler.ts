import { fileTypeFromBuffer } from "file-type";
import { friendsCache } from "./friends.ts";
import {
    getId,
    createEl,
    disableElement,
    enableElement, formatFileSize,
    isCompressedFile,
    renderFileIcon, truncateString
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M15.56 11.77c.2-.1.44.02.44.23a4 4 0 1 1-4-4c.21 0 .33.25.23.44a2.5 2.5 0 0 0 3.32 3.32Z" />
            <path fill="currentColor" fill-rule="evenodd" d="M22.89 11.7c.07.2.07.4 0 .6C22.27 13.9 19.1 21 12 21c-7.11 0-10.27-7.11-10.89-8.7a.83.83 0 0 1 0-.6C1.73 10.1 4.9 3 12 3c7.11 0 10.27 7.11 10.89 8.7Zm-4.5-3.62A15.11 15.11 0 0 1 20.85 12c-.38.88-1.18 2.47-2.46 3.92C16.87 17.62 14.8 19 12 19c-2.8 0-4.87-1.38-6.39-3.08A15.11 15.11 0 0 1 3.15 12c.38-.88 1.18-2.47 2.46-3.92C7.13 6.38 9.2 5 12 5c2.8 0 4.87 1.38 6.39 3.08Z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="action-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z" />
          </svg>
        </div>
      `
          : ""
      }
      <div class="action-button remove">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path fill="currentColor" d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z" />
          <path fill="currentColor" fill-rule="evenodd" d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" clip-rule="evenodd" />
        </svg>
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

    img.style.filter = "blur(12px)";
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
    const spoilerText = imgWrapper?.querySelector(".spoiler-text");
    const file = (imgWrapper as any)?._file as File;

    if (!file) {
      console.error("File is undefined or null.");
      return;
    }

    const isSpoiler = fileSpoilerMap.get(file) ?? false;

    if (isSpoiler) {
      spoilerText?.remove();
      img.style.filter = "";
      fileSpoilerMap.set(file, false);
    } else {
      FileHandler.blurImage(img);
      fileSpoilerMap.set(file, true);
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
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    document.body.addEventListener("dragenter", handleDragEnterOrOver, false);
    document.body.addEventListener("dragover", handleDragEnterOrOver, false);
    document.body.addEventListener("dragleave", handleDragLeave, false);
    document.body.addEventListener("drop", handleDrop, false);

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