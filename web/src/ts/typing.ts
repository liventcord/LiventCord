import { userStatus } from "./app";
import { guildCache } from "./cache";
import { friendsCache } from "./friends";
import { TypingData } from "./types/interfaces";
import { userManager } from "./user";
import { disableElement, enableElement, getId } from "./utils";

export const typingStatusMap = new Map<string, Set<string>>();

const typingText = getId("typing-text") as HTMLElement;
const typingBubbles = getId("typing-bubbles") as HTMLElement;

export function handleStopTyping(data: TypingData) {
  const isGuild = !!data.guildId;
  const isCurrent =
    (isGuild && data.channelId === guildCache.currentChannelId) ||
    (!isGuild && data.channelId === friendsCache.currentDmId);

  if (!isCurrent) return;

  const typingSet = typingStatusMap.get(data.channelId);
  if (typingSet) {
    typingSet.delete(data.userId);
    if (typingSet.size === 0) {
      typingStatusMap.delete(data.channelId);
    }
  }
  userStatus.updateUserOnlineStatus(data.userId, "", false);

  updateTypingText(data.channelId);
}
export function updateTypingText(channelId: string) {
  const typingUsers = typingStatusMap.get(channelId);
  if (!typingUsers || typingUsers.size === 0) {
    typingText.textContent = "";
    disableElement(typingBubbles);
    return;
  }
  enableElement(typingBubbles);

  const names = Array.from(typingUsers).map((userId) =>
    userManager.getUserNick(userId)
  );
  if (names.length > 5) {
    typingText.textContent = "Several people are typing";
  } else if (names.length === 1) {
    typingText.textContent = `${names[0]} is typing`;
  } else {
    typingText.textContent = `${names.slice(0, 2).join(", ")}${names.length > 2 ? ", and others" : ""} are typing`;
  }
}

updateTypingText("");
