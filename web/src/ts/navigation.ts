import { isEmoji, updateCursorStateAfterNavigation } from "./chatbar";

export const getNextFocusableNode = (start: Node): Node | null => {
  let node = start;
  while (node && node.nextSibling) {
    node = node.nextSibling;
    if (isEmoji(node) || node.nodeType === Node.TEXT_NODE) {
      return node;
    }
  }
  return null;
};

export const getPreviousFocusableNode = (start: Node): Node | null => {
  let node = start;
  while (node && node.previousSibling) {
    node = node.previousSibling;
    if (isEmoji(node) || node.nodeType === Node.TEXT_NODE) {
      return node;
    }
  }
  return null;
};

export const moveCursorTo = (target: Node) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const newRange = document.createRange();
  if (target.nodeType === Node.TEXT_NODE) {
    newRange.setStart(target, 0);
  } else {
    newRange.setStartBefore(target);
  }
  newRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(newRange);
  updateCursorStateAfterNavigation();
};

export const moveCursorToEndOf = (target: Node) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const newRange = document.createRange();
  if (target.nodeType === Node.TEXT_NODE) {
    newRange.setStart(target, target.textContent?.length || 0);
  } else {
    newRange.setStartBefore(target);
  }
  newRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(newRange);
  updateCursorStateAfterNavigation();
};
