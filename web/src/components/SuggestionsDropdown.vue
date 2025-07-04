<template>
  <Teleport to="#userMentionDropdown">
    <template v-if="filteredUsers.length > 0 && showDropdown">
      <div
        v-for="(user, index) in filteredUsers"
        :key="user.userId"
        class="suggestion-option"
        :class="{ 'mention-highlight': index === currentSearchUiIndex }"
        @click="selectMember(user.userId, user.nickName)"
        :data-userid="user.userId"
      >
        <img
          v-if="user.userId !== 'everyone'"
          class="profile-image"
          loading="lazy"
          style="width: 24px; height: 24px"
          width="24"
          height="24"
          alt="profile image"
          :ref="
            (el) =>
              el && setProfilePic(el as HTMLImageElement, user.userId, true)
          "
        />
        <span :class="{ 'user-nickname': user.userId !== 'everyone' }">
          {{ user.userId === "everyone" ? "@everyone" : user.nickName }}
        </span>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";

import { disableElement, getId } from "../ts/utils.ts";
import { Member, UserInfo } from "../ts/user.ts";
import { isOnGuild } from "../ts/router.ts";
import { cacheInterface } from "../ts/cache.ts";
import { currentGuildId } from "../ts/guild.ts";
import { getCurrentDmFriends } from "../ts/friendui.ts";
import { setProfilePic } from "../ts/avatar.ts";
import {
  DomUtils,
  getChatBarState,
  manuallyRenderEmojis,
  onMemberSelected,
  setChatBarState,
  setSuppressSend
} from "../ts/chatbar.ts";

const chatInput = getId("user-input") as HTMLDivElement;

const currentSearchUiIndex = ref(-1);
const showDropdown = ref(false);
const filteredUsers = ref<UserInfo[]>([]);

function setDropdownDisplay() {
  const dropdown = getId("userMentionDropdown");
  if (!dropdown) return;
  dropdown.style.display =
    showDropdown.value && filteredUsers.value.length > 0 ? "flex" : "none";
}

watch([showDropdown, filteredUsers], () => {
  nextTick(() => {
    setDropdownDisplay();
  });
});

function extractUsers(): UserInfo[] {
  const seen = new Set<string>();

  const results: UserInfo[] = [
    ...(isOnGuild
      ? [
          {
            userId: "everyone",
            nickName: "everyone",
            discriminator: ""
          }
        ]
      : [])
  ];

  if (isOnGuild) {
    const guildMembers = cacheInterface.getMembers(currentGuildId) as
      | Member[]
      | undefined;
    if (!guildMembers) return results;

    for (const member of guildMembers) {
      if (seen.has(member.userId)) continue;
      seen.add(member.userId);
      results.push({
        userId: member.userId,
        nickName: member.nickName,
        discriminator: "",
        status: member.status
      });
    }

    return results;
  }

  const dmUsers = Object.values(getCurrentDmFriends());
  for (const user of dmUsers) {
    if (seen.has(user.userId)) continue;
    seen.add(user.userId);
    results.push(user);
  }

  return results;
}
function updateFilteredUsers() {
  const state = getChatBarState();
  const textContent = state.rawContent;
  const cursorPos = state.cursorPosition;

  if (!textContent || cursorPos == null) {
    filteredUsers.value = [];
    showDropdown.value = false;
    return;
  }

  const beforeCursor = textContent.slice(0, cursorPos);
  const afterCursor = textContent.slice(cursorPos);

  const lastAt = beforeCursor.lastIndexOf("@");
  if (lastAt === -1) {
    filteredUsers.value = [];
    showDropdown.value = false;
    return;
  }

  // New: Ensure the last "@" is not part of an existing complete mention like <@123456>
  const mentionLike = textContent.slice(lastAt - 2, cursorPos + 1); // capture <@123...>
  const completedMentionPattern = /^<@\d+>$/;
  if (completedMentionPattern.test(mentionLike)) {
    filteredUsers.value = [];
    showDropdown.value = false;
    return;
  }

  const possibleMention = beforeCursor.slice(lastAt, cursorPos);
  if (!/^@\w*$/.test(possibleMention)) {
    filteredUsers.value = [];
    showDropdown.value = false;
    return;
  }

  const users = extractUsers();
  const everyone = users.find((user) => user.userId === "everyone");
  const normalUsers = users.filter((user) => user.userId !== "everyone");

  const query = possibleMention.slice(1).trim().toLowerCase();

  const matchedUsers =
    query === ""
      ? normalUsers.slice(0, 50)
      : normalUsers
          .filter((user) => {
            if (typeof user.nickName !== "string") return false;
            return user.nickName
              .toLowerCase()
              .split(/\s+/)
              .some((word) => word.startsWith(query));
          })
          .slice(0, 50);

  if (everyone && "everyone".startsWith(query)) {
    matchedUsers.unshift(everyone);
  }

  filteredUsers.value = matchedUsers;
  showDropdown.value = filteredUsers.value.length > 0;

  if (showDropdown.value) {
    currentSearchUiIndex.value = 0;
  }
}

function selectMember(userId: string, userNick: string) {
  if (!chatInput) return;
  const state = getChatBarState();
  if (!state) return;

  const message = state.rawContent ?? "";
  console.log(
    "state:",
    state,
    "Message found: ",
    message,
    "Chat text: ",
    chatInput.textContent
  );
  let cursorPos = state.cursorPosition;
  cursorPos = Math.max(0, Math.min(cursorPos, message.length));

  const mentionStart = message.lastIndexOf("@", cursorPos - 1);
  if (mentionStart === -1) return;

  const mentionCandidate = message.slice(mentionStart, cursorPos);
  if (/\s/.test(mentionCandidate)) return;

  let mentionEnd = cursorPos;
  while (mentionEnd < message.length && !/\s/.test(message[mentionEnd])) {
    mentionEnd++;
  }

  const newMention = `<@${userId}>`;
  const newMessage =
    message.slice(0, mentionStart) + newMention + message.slice(mentionEnd);

  const newCursorPos = mentionStart + newMention.length;

  state.rawContent = newMessage;
  state.cursorPosition = newCursorPos;

  const savedSelection = { start: newCursorPos, end: newCursorPos };
  requestAnimationFrame(() => {
    DomUtils.restoreSelection(chatInput, savedSelection);
  });

  setChatBarState(state);

  manuallyRenderEmojis(newMessage);

  setTimeout(() => disableElement("userMentionDropdown"), 0);
  showDropdown.value = false;
  currentSearchUiIndex.value = -1;
}

function onInput(event: Event) {
  console.log(getChatBarState());
  updateFilteredUsers();
}

function handleKeydown(event: KeyboardEvent) {
  const optionsLength = filteredUsers.value.length;
  setDropdownDisplay();
  if (optionsLength === 0) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    currentSearchUiIndex.value =
      (currentSearchUiIndex.value + 1) % optionsLength;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    currentSearchUiIndex.value =
      (currentSearchUiIndex.value - 1 + optionsLength) % optionsLength;
  } else if (event.key === "Enter") {
    event.preventDefault();

    if (filteredUsers.value.length === 0) {
      setSuppressSend(false);
      showDropdown.value = false;
      currentSearchUiIndex.value = -1;
      return;
    }

    if (
      currentSearchUiIndex.value < 0 ||
      currentSearchUiIndex.value >= optionsLength
    ) {
      currentSearchUiIndex.value = 0;
    }

    const user = filteredUsers.value[currentSearchUiIndex.value];

    setSuppressSend(true);
    selectMember(user.userId, user.nickName);
  } else if (event.key === "Escape") {
    event.preventDefault();
    filteredUsers.value = [];

    showDropdown.value = false;
    currentSearchUiIndex.value = -1;
  } else if (event.key === "Space") {
    filteredUsers.value = [];
    showDropdown.value = false;
    currentSearchUiIndex.value = -1;
  }
}

chatInput.addEventListener("input", onInput);
chatInput.addEventListener("keydown", handleKeydown);

document.addEventListener("click", (event) => {
  const dropdown = getId("userMentionDropdown");
  const target = event.target as HTMLElement;

  if (dropdown && !dropdown.contains(target) && target !== chatInput) {
    showDropdown.value = false;
    currentSearchUiIndex.value = -1;
  }
});

let usersRefreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  setTimeout(() => {
    updateFilteredUsers();
  }, 1000);

  nextTick(() => {
    setDropdownDisplay();
  });
});

onBeforeUnmount(() => {
  if (usersRefreshInterval) clearInterval(usersRefreshInterval);
});
</script>

<style scoped>
.user-nickname {
  margin-left: 10px;
}
</style>
