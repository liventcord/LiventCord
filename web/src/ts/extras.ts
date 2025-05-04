import confetti from "canvas-confetti";

import { createEl } from "./utils.ts";
import { chatInput } from "./chatbar.ts";
import { enableBorderMovement, stopAudioAnalysis } from "./audio.ts";
import { isUsersOpenGlobal } from "./userList.ts";

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
