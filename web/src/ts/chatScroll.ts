// chatScroll.ts — All scrolling, intersection observation, and related behaviors

import { getId, isMobile } from "./utils.ts";
import { chatContainer, chatContent } from "./chatbar.ts";
import { isOnMePage } from "./router.ts";
import { loadingScreen, isOnRight } from "./ui.ts";
import { cacheInterface, guildCache } from "./cache.ts";
import { currentGuildId } from "./guild.ts";
import { isMediaPanelOpen } from "./panelHandler.ts";
import { getMessageDate, getOldMessages } from "./message.ts";
import { handleLink } from "./mediaElements.ts";

export let bottomestChatDateStr: string;
export function setBottomestChatDateStr(date: string) {
  bottomestChatDateStr = date;
}

export let lastMessageDate: Date;
export let currentLastDate: Date;
export function clearLastDate() {
  currentLastDate = new Date();
}

export let isReachedChannelEnd = false;
export function setReachedChannelEnd(val: boolean) {
  isReachedChannelEnd = val;
}

const scrollButton = getId("scroll-to-bottom") as HTMLElement;

// ─── Intersection observer for lazy content ───

const contentObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!(entry.target instanceof HTMLElement)) return;
      const target = entry.target;
      if (entry.isIntersecting && target.dataset.contentLoaded !== "true") {
        loadObservedContent(target);
        contentObserver.unobserve(target);
        target.dataset.contentLoaded = "true";
      }
    });
  },
  { threshold: 0.1 }
);

export function observe(element: HTMLElement): void {
  if (element) contentObserver.observe(element);
}

function loadObservedContent(targetElement: HTMLElement): void {
  if (!targetElement.parentElement) return;
  const jsonData = targetElement.dataset.content_observe;
  if (!jsonData || targetElement.dataset.contentLoaded === "true") return;

  targetElement.dataset.contentLoaded = "true";

  const message = cacheInterface.getMessage(
    currentGuildId,
    guildCache.currentChannelId,
    targetElement.parentElement.id
  );

  handleLink(
    targetElement,
    jsonData,
    message?.isSystemMessage ?? false,
    message?.metadata,
    message?.lastEdited
  );

  if (isChatScrollNearBottom()) {
    chatContent.scrollTop = chatContent.scrollHeight;
  }
}

// ─── Scroll position helpers ───

export function isChatScrollNearBottom(offset = 100): boolean {
  return (
    chatContent.scrollHeight -
      chatContent.scrollTop -
      chatContent.clientHeight <
    offset
  );
}

export function isScrolledToBottom(): boolean {
  return (
    chatContainer.scrollHeight - chatContainer.scrollTop <=
    chatContainer.clientHeight + 1
  );
}

// ─── Scroll actions ───

export function scrollToBottom(): void {
  scrollButton.style.display = "none";
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function scrollToMessage(messageElement: HTMLElement): void {
  if (!messageElement) return;

  messageElement.style.backgroundColor = "rgba(102, 97, 97, 0.5)";
  setTimeout(() => {
    messageElement.style.backgroundColor = "";
  }, 1000);

  const messageRect = messageElement.getBoundingClientRect();
  const containerRect = chatContent.getBoundingClientRect();
  const offset =
    messageRect.top -
    containerRect.top +
    chatContent.scrollTop -
    chatContent.clientHeight / 2 +
    messageRect.height / 2;

  chatContent.scrollBy({ top: offset, behavior: "smooth" });
}

// ─── Scroll button setup ───

export function createChatScrollButton(): void {
  if (!chatContainer) {
    console.error("Chat container is null");
    return;
  }

  chatContainer.addEventListener("scroll", () => {
    const hiddenContent =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    const threshold = window.innerHeight;

    if (hiddenContent > threshold && !isOnRight) {
      scrollButton.style.display = "flex";
    }
    if (hiddenContent < threshold && isMobile) {
      scrollButton.style.display = "none";
    }
  });

  scrollButton.addEventListener("click", scrollToBottom);
}

// ─── Fetching old messages on scroll ───

let hasJustFetchedMessages = false;
export function setHasJustFetchedMessagesFalse() {
  hasJustFetchedMessages = false;
}

let isFetchingOldMessages = false;
let stopFetching = false;

async function getOldMessagesOnScroll(): Promise<void> {
  if (isReachedChannelEnd || isOnMePage || stopFetching || isMediaPanelOpen())
    return;

  const oldestDate = getMessageDate();
  if (!oldestDate || oldestDate === "1970-01-01 00:00:00.000000+00:00") return;

  hasJustFetchedMessages = true;
  await getOldMessages(new Date(oldestDate));
  isFetchingOldMessages = false;
  stopFetching = true;
  setHasJustFetchedMessagesFalse();
  setTimeout(() => {
    stopFetching = false;
  }, 1000);
}

export async function handleScroll(): Promise<void> {
  if (loadingScreen?.style.display === "flex") return;

  const buffer = 10;
  const isAtTop = chatContainer.scrollTop <= buffer;
  const hasMessages = chatContent.children.length > 0;

  if (!(isAtTop && !isFetchingOldMessages && hasMessages)) return;

  isFetchingOldMessages = true;

  try {
    if (chatContainer.scrollTop <= buffer) {
      await getOldMessagesOnScroll();
    }
  } catch (error) {
    console.error("Error fetching old messages:", error);
  }
}

// ─── Post-load scroll stabilization ───

export function setupScrollHandling(wasAtBottom: boolean): void {
  let isUserInteracted = false;
  const userScrollEvents = ["mousedown", "touchstart", "wheel"];

  const releaseScrollLock = () => {
    isUserInteracted = true;
    chatContainer.style.overflow = "";
    userScrollEvents.forEach((e) =>
      chatContainer.removeEventListener(e, releaseScrollLock)
    );
  };
  userScrollEvents.forEach((e) =>
    chatContainer.addEventListener(e, releaseScrollLock)
  );
  chatContainer.addEventListener("scroll", () => {
    isUserInteracted = !isScrolledToBottom();
  });

  const mediaElements = chatContainer.querySelectorAll("img, video, iframe");
  const mediaLoadedPromises = createMediaLoadPromises(mediaElements);

  const mutationObserver = new MutationObserver(() => {
    if (wasAtBottom && !isUserInteracted) scrollToBottom();
  });
  mutationObserver.observe(chatContainer, { childList: true, subtree: true });

  let lastHeight = chatContainer.scrollHeight;
  const monitorContentSize = () => {
    const currentHeight = chatContainer.scrollHeight;
    if (currentHeight !== lastHeight && wasAtBottom && !isUserInteracted) {
      chatContainer.scrollTop = currentHeight;
    }
    lastHeight = currentHeight;

    if (isAllMediaLoaded(mediaElements)) {
      chatContainer.style.overflow = "";
      mutationObserver.disconnect();
    } else {
      setTimeout(monitorContentSize, 50);
    }
  };

  Promise.all(mediaLoadedPromises).then(() => {
    chatContainer.style.overflow = "";
    mutationObserver.disconnect();
  });

  monitorContentSize();

  const preventScrollInterval = setInterval(() => {
    if (!isUserInteracted && wasAtBottom) scrollToBottom();
  }, 20);

  setTimeout(() => {
    scrollToBottom();
    clearInterval(preventScrollInterval);
  }, 200);
}

// ─── Helpers ───

function createMediaLoadPromises(
  mediaElements: NodeListOf<Element>
): Promise<void>[] {
  return Array.from(mediaElements).map((media) => {
    if (media instanceof HTMLImageElement && !media.complete) {
      return new Promise<void>((resolve) => {
        media.addEventListener("load", () => resolve());
        media.addEventListener("error", () => resolve());
      });
    }
    if (media instanceof HTMLVideoElement && media.readyState < 4) {
      return new Promise<void>((resolve) => {
        media.addEventListener("loadeddata", () => resolve());
        media.addEventListener("error", () => resolve());
      });
    }
    return Promise.resolve();
  });
}

function isAllMediaLoaded(elements: NodeListOf<Element>): boolean {
  return Array.from(elements).every((media) => {
    if (media instanceof HTMLImageElement) return media.complete;
    if (media instanceof HTMLMediaElement) return media.readyState === 4;
    return true;
  });
}
