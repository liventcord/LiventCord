import confettiImport from "canvas-confetti";

const confetti = confettiImport as unknown as (options: any) => void;

import { createEl, getId } from "./utils.ts";
import { chatContainer, chatInput } from "./chatbar.ts";
import { enableBorderMovement, stopAudioAnalysis } from "./audio.ts";
import { isUsersOpenGlobal, userList } from "./userList.ts";
import { guildContainer } from "./guild.ts";
import { friendsContainer } from "./friendui.ts";

export function setBlackTheme() {
  document.body.classList.add("black-theme");
  chatContainer.classList.add("black-theme");
  const infoContainer = getId("channel-info-container-for-index");

  infoContainer?.classList.add("black-theme");
  setTimeout(() => {
    const friendInfoContainer = getId("channel-info-container-for-friend");
    friendInfoContainer?.children[0]?.classList.add("black-theme");
    console.warn(friendInfoContainer?.classList);
  }, 100);

  const channelList = getId("channel-list");
  const activityList = getId("activity-list");
  channelList?.classList.add("black-theme-3");
  activityList?.classList.add("black-theme");

  setTimeout(() => {
    userList?.classList.add("black-theme");
  }, 0);
  const guildsList = getId("guilds-list");

  guildsList?.classList.add("black-theme-3");

  guildContainer.classList.add("black-theme-3");
  const userPanel = getId("user-info-panel");
  userPanel?.classList.add("black-theme-4");
  const avatarWrapper = getId("avatar-wrapper");
  avatarWrapper?.classList.add("black-theme-4");
  friendsContainer?.classList.add("black-theme");
  const settingsLeftbar = getId("settings-leftbar");
  settingsLeftbar?.classList.add("black-theme-3");
  const right = getId("settings-rightcontainer");
  right?.classList.add("black-theme-4");

  const lightRightbar = getId("settings-light-rightbar");
  lightRightbar?.classList.add("black-theme");
  const mediaMenu = getId("media-menu");
  mediaMenu?.classList.add("black-theme");
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
