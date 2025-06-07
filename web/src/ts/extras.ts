import confettiImport from "canvas-confetti";

const confetti = confettiImport as unknown as (options: any) => void;

import { createEl, getId, isValidUrl } from "./utils.ts";
import { chatContainer, chatInput } from "./chatbar.ts";
import { enableBorderMovement, stopAudioAnalysis } from "./audio.ts";
import { isUsersOpenGlobal, userList } from "./userList.ts";
import { guildContainer } from "./guild.ts";
import { friendsContainer } from "./friendui.ts";

let bgVideoElement: HTMLVideoElement | null = null;
const defaultBGTransparency = "0.4";
export let currentBGTransparency = defaultBGTransparency;
export const currentVideoUrl =
  "https://cdn.fastly.steamstatic.com/steamcommunity/public/images/items/1406990/915b1b4a05133186525a956d7ca5c142a3c3c9f3.webm";

function addErrorIcon() {
  const input = getId("video-url-input");
  if (!input) return;
  if (input.querySelector("div.fa-exclamation-circle")) return;
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
  if (bgVideoElement) return;
  const video = createEl("video", {
    className: "background-video",
    autoplay: true,
    muted: true,
    loop: true,
    playsInline: true
  }) as HTMLVideoElement;

  const source = createEl("source", {
    src: currentVideoUrl,
    type: "video/webm"
  }) as HTMLSourceElement;

  video.appendChild(source);

  function handleVideoError() {
    addErrorIcon();
  }

  video.addEventListener("error", handleVideoError);
  source.addEventListener("error", handleVideoError);

  video.addEventListener("canplay", () => {
    console.log("Video can play now");
    removeVideoErrorIcon();
  });

  document.body.appendChild(video);
  bgVideoElement = video;
  updateVideoTransparency(transparencyValue || currentBGTransparency);
}

export function updateVideoTransparency(value: string) {
  console.log("Updated transparency to: ", value);
  if (!bgVideoElement) return;
  currentBGTransparency = value;
  bgVideoElement.style.opacity = value;
}

export function onEditVideoUrl(value: string) {
  if (!bgVideoElement) return;
  const source = bgVideoElement.querySelector("source");
  if (!source) return;
  if (!isValidUrl(value)) {
    console.warn("Invalid URL format:", value);
    return;
  }
  source.src = value;
  bgVideoElement.load();
}

export function disableBgVideo() {
  if (!bgVideoElement) return;
  bgVideoElement.pause();
  bgVideoElement.remove();
  bgVideoElement = null;
}

export function setTheme(isDark: boolean) {
  const toggleClass = (el: any, cls: string) => {
    if (!el) return;
    if (isDark) {
      if (!el.classList.contains(cls)) el.classList.add(cls);
    } else {
      if (el.classList.contains(cls)) el.classList.remove(cls);
    }
  };

  toggleClass(document.body, "black-theme");
  toggleClass(chatContainer, "black-theme");
  toggleClass(getId("channel-info-container-for-index"), "black-theme");

  setTimeout(() => {
    const friendInfo = getId("channel-info-container-for-friend");
    toggleClass(friendInfo?.children[0], "black-theme");
    if (isDark) console.warn(friendInfo?.classList);
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
  const {
    offsetLeft: inputX,
    offsetTop: inputY,
    scrollLeft,
    scrollTop,
    clientWidth,
    clientHeight
  } = input;
  const div = createEl("div");

  div.style.position = "absolute";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.visibility = "hidden";
  div.style.overflow = "hidden";
  div.style.top = `${inputY}px`;
  div.style.left = `${inputX}px`;
  div.style.padding = "10px 100px 10px 55px";
  div.style.fontFamily = "Arial, Helvetica, sans-serif";
  div.style.backgroundColor = "#36393f";
  div.style.border = "none";
  div.style.lineHeight = "20px";
  div.style.fontSize = "17px";
  div.style.borderRadius = "7px";
  div.style.boxSizing = "border-box";
  div.style.maxHeight = "500px";
  div.style.width = isUsersOpenGlobal
    ? "calc(100vw - 550px);"
    : "calc(100vw - 350px);";
  const swap = "\u00A0";
  const inputValue =
    input.tagName === "INPUT" ? input.value.replace(/ /g, swap) : input.value;
  const textNode = document.createTextNode(
    inputValue.substring(0, selectionPoint)
  );
  div.appendChild(textNode);
  document.body.appendChild(div);
  const range = document.createRange();
  range.selectNodeContents(div);
  range.setStart(textNode, selectionPoint);
  range.setEnd(textNode, selectionPoint);
  const rect = range.getBoundingClientRect();
  const x = rect.left - inputX + scrollLeft + 5;
  const y = rect.top - inputY + scrollTop;
  document.body.removeChild(div);

  return {
    x: Math.min(x, clientWidth),
    y: Math.min(y, clientHeight)
  };
};

export function popKeyboardConfetti() {
  const selectionStart = chatInput.selectionStart;
  if (!selectionStart) return;
  const { x, y } = getCursorXY(chatInput, selectionStart);
  const inputRect = chatInput.getBoundingClientRect();

  let ratioY = y / window.innerHeight + 0.95;
  let ratioX = (inputRect.left + x) / window.innerWidth;

  if (ratioY > 1) {
    ratioY = 1;
  }
  if (ratioX < 0.2) {
    ratioX = 0.2;
  }

  setTimeout(() => {
    confetti({
      particleCount: 5,
      spread: 7,
      origin: { x: ratioX, y: ratioY },
      disableForReducedMotion: true
    });
  }, 0);
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
