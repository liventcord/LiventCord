import confettiImport from "canvas-confetti";
const confetti = confettiImport as unknown as (options: any) => void;

import { $, createEl, getId, isValidUrl, tNode } from "./utils.ts";
import { chatContainer, chatInput } from "./chatbar.ts";
import { enableBorderMovement, stopAudioAnalysis } from "./audio.ts";
import { userList } from "./userList.ts";
import { guildContainer } from "./guild.ts";
import { friendsContainer } from "./friendui.ts";
import { defaultVideoUrl, loadBgVideo, saveBgVideo } from "./settings.ts";

let bgVideoElement: HTMLVideoElement | null = null;
const defaultBGTransparency = "0.4";
export let currentBGTransparency = defaultBGTransparency;

function addErrorIcon() {
  const input = getId("video-url-input");
  if (!input) {
    return;
  }
  if (input.querySelector("div.fa-exclamation-circle")) {
    return;
  }
  const errorElement = createEl("div");
  errorElement.style.color = "red";
  errorElement.style.fontSize = "24px";
  errorElement.className = "fa fa-exclamation-circle";
  input.appendChild(errorElement);
}

export function removeVideoErrorIcon() {
  const input = getId("video-url-input");
  const errorIcon = input?.querySelector("svg.fa-circle-exclamation");
  errorIcon?.remove();
}

export function createBGVideo(transparencyValue?: string | null) {
  if ($(".background-video")) {
    return;
  }

  const video = createEl("video", {
    className: "background-video",
    autoplay: true,
    muted: true,
    loop: true,
    playsInline: true
  });
  const currentVideoUrl = loadBgVideo();
  if (currentVideoUrl) onEditVideoUrl(currentVideoUrl);

  const source = createEl("source", {
    src: currentVideoUrl,
    type: "video/webm"
  });

  video.appendChild(source);

  function handleVideoError() {
    addErrorIcon();
  }

  video.addEventListener("error", handleVideoError);
  source.addEventListener("error", handleVideoError);

  video.addEventListener("canplay", () => {
    removeVideoErrorIcon();
  });

  document.body.appendChild(video);
  bgVideoElement = video;
  updateVideoTransparency(transparencyValue || currentBGTransparency);
}

export function updateVideoTransparency(value: string) {
  console.log("Updated transparency to: ", value);
  if (!bgVideoElement) {
    return;
  }
  currentBGTransparency = value;
  bgVideoElement.style.opacity = value;
}

function updateBgVideoSource(url: string) {
  if (!bgVideoElement) return;

  if (!isValidUrl(url)) {
    console.warn("Invalid URL format:", url);
    return;
  }

  const source = bgVideoElement.querySelector("source");
  if (!source) return;
  source.src = url;
  saveBgVideo(url);
  bgVideoElement.load();
}

export function onEditVideoUrl(value: string) {
  updateBgVideoSource(value);
}

export function resetVideoUrl() {
  updateBgVideoSource(defaultVideoUrl);
  const videoUrlInput = getId("video-url-input") as HTMLInputElement;
  if (videoUrlInput) videoUrlInput.innerText = defaultVideoUrl;
}

export function disableBgVideo() {
  if (!bgVideoElement) {
    return;
  }
  bgVideoElement.pause();
  bgVideoElement.remove();
  bgVideoElement = null;
}

export function setTheme(isDark: boolean) {
  const toggleClass = (el: any, cls: string) => {
    if (!el) {
      return;
    }
    if (isDark) {
      if (!el.classList.contains(cls)) {
        el.classList.add(cls);
      }
    } else {
      if (el.classList.contains(cls)) {
        el.classList.remove(cls);
      }
    }
  };

  toggleClass(document.body, "black-theme");
  toggleClass(chatContainer, "black-theme");
  toggleClass(getId("channel-info-container-for-index"), "black-theme");

  setTimeout(() => {
    const friendInfo = getId("channel-info-container-for-friend");
    toggleClass(friendInfo?.children[0], "black-theme");
  }, 100);

  toggleClass(getId("channel-list"), "black-theme-3");
  toggleClass(getId("activity-list"), "black-theme");

  setTimeout(() => {
    toggleClass(userList, "black-theme");
  }, 0);

  toggleClass(getId("guilds-list"), "black-theme-3");
  toggleClass(guildContainer, "black-theme-3");
  toggleClass(getId("user-info-panel"), "black-theme-4");
  toggleClass(getId("avatar-wrapper"), "black-theme-4");
  toggleClass(friendsContainer, "black-theme");
  toggleClass(getId("settings-leftbar"), "black-theme-3");
  toggleClass(getId("settings-rightcontainer"), "black-theme-4");
  toggleClass(getId("settings-light-rightbar"), "black-theme");
  toggleClass(getId("media-menu"), "black-theme");
}

const getCursorXY = (input: HTMLInputElement, selectionPoint: number) => {
  const inputRect = input.getBoundingClientRect();
  const cs = window.getComputedStyle(input);
  const div = createEl("div");

  div.style.position = "absolute";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.visibility = "hidden";
  div.style.overflow = "hidden";
  div.style.top = `${inputRect.top + window.scrollY}px`;
  div.style.left = `${inputRect.left + window.scrollX}px`;
  div.style.paddingTop = cs.paddingTop;
  div.style.paddingRight = cs.paddingRight;
  div.style.paddingBottom = cs.paddingBottom;
  div.style.paddingLeft = cs.paddingLeft;
  div.style.fontFamily = cs.fontFamily;
  div.style.fontSize = cs.fontSize;
  div.style.lineHeight = cs.lineHeight;
  div.style.letterSpacing = cs.letterSpacing;
  div.style.boxSizing = cs.boxSizing;
  div.style.width = `${inputRect.width}px`;
  div.style.maxHeight = `${inputRect.height}px`;

  const swap = "\u00A0";
  const rawValue = (input as HTMLInputElement).value ?? "";
  const inputValue =
    input.tagName === "INPUT" ? rawValue.replace(/ /g, swap) : rawValue;
  const safeIndex = Math.max(0, Math.min(selectionPoint, inputValue.length));
  const textNode = tNode(inputValue.substring(0, safeIndex));
  div.appendChild(textNode);
  document.body.appendChild(div);

  const range = document.createRange();
  range.selectNodeContents(div);
  range.setStart(textNode, textNode.nodeValue ? textNode.nodeValue.length : 0);
  range.setEnd(textNode, textNode.nodeValue ? textNode.nodeValue.length : 0);
  const rect = range.getBoundingClientRect();
  const x = rect.left + window.scrollX;
  const y = rect.top + window.scrollY;
  document.body.removeChild(div);

  return {
    x: Math.min(Math.max(0, x - inputRect.left), inputRect.width),
    y: Math.min(Math.max(0, y - inputRect.top), inputRect.height)
  };
};

export function popKeyboardConfetti() {
  const inputEl = chatInput as HTMLElement;
  let x: number;
  let y: number;

  if (
    inputEl instanceof HTMLInputElement ||
    inputEl instanceof HTMLTextAreaElement
  ) {
    const el = inputEl as HTMLInputElement | HTMLTextAreaElement;
    const selStart =
      (el as HTMLInputElement).selectionStart ??
      (el as HTMLTextAreaElement).selectionStart ??
      el.value.length ??
      0;
    const pos = getCursorXY(el as HTMLInputElement, selStart);
    const rect = el.getBoundingClientRect();
    x = rect.left + pos.x;
    y = rect.top + pos.y;
  } else {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const r = rects[0];
        x = r.left;
        y = r.top;
      } else {
        const rect = inputEl.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    } else {
      const rect = inputEl.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  const ratioX = Math.max(0.02, Math.min(1, x / window.innerWidth));
  const ratioY = Math.max(0, Math.min(1, y / window.innerHeight));

  confetti({
    particleCount: 5,
    spread: 7,
    origin: { x: ratioX, y: ratioY },
    disableForReducedMotion: true
  });
}

export function createFireWorks() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    disableForReducedMotion: true
  });
  return;
}

function enableParty() {
  enableBorderMovement();
}

function disableParty() {
  stopAudioAnalysis();
}
