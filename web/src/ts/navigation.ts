import { isEmoji } from "./chatbar";

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
};

export function getTextUpToCursorFromNode(node: Node, offset: number): string {
  let textContent = "";

  const walkNode = (currentNode: Node, currentOffset: number) => {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent || "";
      textContent += text.slice(0, currentOffset);
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      if (currentNode.nodeName === "IMG") {
        const emojiId = (currentNode as HTMLElement).getAttribute("alt");
        textContent += emojiId ? `:${emojiId}:` : "";
      }
    }

    if (currentNode.hasChildNodes()) {
      for (let i = 0; i < currentNode.childNodes.length; i++) {
        walkNode(currentNode.childNodes[i], currentOffset);
      }
    }
  };

  walkNode(node, offset);
  return textContent;
}
