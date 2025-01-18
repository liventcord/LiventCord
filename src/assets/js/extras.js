import { createEl } from './utils';
import { loadGuild } from './guild';
import { currentUserId } from './user';
import { cacheInterface } from './cache';
let particeContainer;

export const crownEmojibase64 = `data:image/png;base64,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`;

const getCursorXY = (input, selectionPoint) => {
  const {
    offsetLeft: inputX,
    offsetTop: inputY,
    scrollLeft,
    scrollTop,
    clientWidth,
    clientHeight,
  } = input;
  const div = createEl('div');

  div.style.position = 'absolute';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.visibility = 'hidden';
  div.style.overflow = 'hidden';
  div.style.top = `${inputY}px`;
  div.style.left = `${inputX}px`;
  div.style.padding = '10px 100px 10px 55px';
  div.style.fontFamily = 'Arial, Helvetica, sans-serif';
  div.style.backgroundColor = '#36393f';
  div.style.border = 'none';
  div.style.lineHeight = '20px';
  div.style.fontSize = '17px';
  div.style.borderRadius = '7px';
  div.style.boxSizing = 'border-box';
  div.style.maxHeight = '500px';
  div.style.width = 'calc(100vw - 585px)';
  const swap = '\u00A0';
  const inputValue =
    input.tagName === 'INPUT' ? input.value.replace(/ /g, swap) : input.value;
  const textNode = document.createTextNode(
    inputValue.substring(0, selectionPoint),
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
    y: Math.min(y, clientHeight),
  };
};

export function popKeyboardConfetti() {
  const { x, y } = getCursorXY(chatInput, chatInput.selectionStart);
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
      disableForReducedMotion: true,
    });
  }, 0);
}
export function createFireWorks() {
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });
  }, 500);
  return;
}
export function changeUrlWithFireWorks(guildId, channelId, guildName) {
  loadGuild(guildId, channelId, guildName, currentUserId);
  cacheInterface.addGuild(guildId, guildName, currentUserId);

  createFireWorks();
  permissionManager.addGuildSelfCreated(guildId);
}

export function enableParty() {
  enableBorderMovement();
}

export function disableParty() {
  stopAudioAnalysis();
}

export function enableSnow() {
  let particeContainer = getId('confetti-container');
  let skew = 1;

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  (function frame() {
    if (
      !toggleManager.states['snow-toggle'] ||
      !isConfettiLoaded ||
      !isDomLoaded
    )
      return;

    skew = Math.max(0.8, skew - 0.001);

    confetti({
      particleCount: 1,
      startVelocity: 0,
      ticks: 300,
      origin: {
        x: Math.random(),
        y: Math.random() * skew - 0.2,
      },
      colors: ['#ffff'],
      shapes: ['circle'],
      gravity: randomInRange(0.4, 0.6),
      scalar: randomInRange(0.4, 1),
      drift: randomInRange(-0.4, 0.4),
      particleContainer: particeContainer,
    });

    requestAnimationFrame(frame);
  })();
}
