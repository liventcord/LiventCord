<template>
  <Teleport to="#userMentionDropdown">
    <template
      v-if="
        (filteredUsers.length > 0 || filteredChannels.length > 0) &&
        showDropdown
      "
    >
      <!-- Members header -->
      <div v-if="filteredUsers.length > 0" class="suggestion-header">
        Members
      </div>

      <div
        v-for="(user, index) in filteredUsers"
        :key="'user-' + user.userId"
        class="suggestion-option"
        :class="{ 'mention-highlight': currentSearchUiIndex === index }"
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
            (el) => el && setProfilePic(el as HTMLImageElement, user.userId)
          "
        />
        <span :class="{ 'user-nickname': user.userId !== 'everyone' }">
          {{ user.userId === "everyone" ? "@everyone" : user.nickName }}
        </span>
      </div>

      <!-- Text Channels header -->
      <div v-if="filteredChannels.length > 0" class="suggestion-header">
        Text Channels
      </div>

      <div
        v-for="(channel, idx) in filteredChannels"
        :key="'channel-' + channel.channelId"
        class="suggestion-option channel-suggestion"
        :class="{
          'mention-highlight':
            currentSearchUiIndex === filteredUsers.length + idx
        }"
        @click="selectChannel(channel.channelId, channel.channelName)"
        :data-channelid="channel.channelId"
      >
        <span class="channel-hash">#</span>
        <span class="channel-name">{{ channel.channelName }}</span>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { getId } from "../ts/utils.ts";
import { isOnGuild } from "../ts/router.ts";
import { cacheInterface } from "../ts/cache.ts";
import { currentGuildId } from "../ts/guild.ts";
import { getCurrentDmFriends } from "../ts/friendui.ts";
import {
  appendChannelMentionToInput,
  appendMemberMentionToInput,
  getChatBarState,
  setSuppressSend
} from "../ts/chatbar.ts";
import { setProfilePic } from "../ts/avatar.ts";
interface Member {
  userId: string;
  nickName: string;
  status: string;
}
interface UserInfo {
  userId: string;
  nickName: string;
  discriminator: string;
  status?: string;
  activity?: string;
  description?: string;
  profileVersion?: string;
  isFriendsRequestToUser?: boolean;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isPending?: boolean;
  isBlocked?: boolean;
}

const chatInput = getId("user-input") as HTMLDivElement;

const currentSearchUiIndex = ref(-1);
const showDropdown = ref(false);
const filteredUsers = ref<UserInfo[]>([]);
const filteredChannels = ref<{ channelId: string; channelName: string }[]>([]);

function setDropdownDisplay() {
  const dropdown = getId("userMentionDropdown");
  if (!dropdown) return;
  dropdown.style.display =
    showDropdown.value &&
    (filteredUsers.value.length > 0 || filteredChannels.value.length > 0)
      ? "flex"
      : "none";
}

watch([showDropdown, filteredUsers, filteredChannels], () => {
  nextTick(() => {
    setDropdownDisplay();
  });
});

function extractUsers(): UserInfo[] {
  const seen = new Set<string>();
  const results: UserInfo[] = isOnGuild
    ? [
        {
          userId: "everyone",
          nickName: "everyone",
          discriminator: ""
        }
      ]
    : [];

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

function extractChannels(): { channelId: string; channelName: string }[] {
  if (!isOnGuild) return [];

  const channels = cacheInterface.getChannels(currentGuildId);
  return channels.map((channel) => ({
    channelId: channel.channelId,
    channelName: channel.channelName
  }));
}

function updateFilteredUsers() {
  const state = getChatBarState();
  const textContent = state.rawContent;
  const cursorPos = state.cursorPosition;

  if (!textContent || cursorPos == null) {
    filteredUsers.value = [];
    filteredChannels.value = [];
    showDropdown.value = false;
    return;
  }

  const beforeCursor = textContent.slice(0, cursorPos);

  const lastHash = beforeCursor.lastIndexOf("#");
  if (lastHash !== -1 && lastHash > beforeCursor.lastIndexOf("@")) {
    const possibleChannelMention = beforeCursor.slice(lastHash);
    if (/^#\w*$/.test(possibleChannelMention)) {
      const query = possibleChannelMention.slice(1).toLowerCase();
      const channels = extractChannels() || [];

      filteredChannels.value = channels
        .filter((channel) =>
          channel.channelName.toLowerCase().startsWith(query)
        )
        .slice(0, 50);

      filteredUsers.value = [];
      showDropdown.value = filteredChannels.value.length > 0;
      currentSearchUiIndex.value = 0;
      return;
    }
  }

  const lastAt = beforeCursor.lastIndexOf("@");
  if (lastAt === -1) {
    filteredUsers.value = [];
    filteredChannels.value = [];
    showDropdown.value = false;
    return;
  }

  const mentionLike = textContent.slice(lastAt - 2, cursorPos + 1);
  const completedMentionPattern = /^<@\d+>$/;
  if (completedMentionPattern.test(mentionLike)) {
    filteredUsers.value = [];
    filteredChannels.value = [];
    showDropdown.value = false;
    return;
  }

  const possibleMention = beforeCursor.slice(lastAt, cursorPos);
  if (!/^@\w*$/.test(possibleMention)) {
    filteredUsers.value = [];
    filteredChannels.value = [];
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
  filteredChannels.value = [];
  showDropdown.value = filteredUsers.value.length > 0;
  if (showDropdown.value) {
    currentSearchUiIndex.value = 0;
  }
}

function selectMember(userId: string, userNick: string) {
  appendMemberMentionToInput(userId);
  showDropdown.value = false;
  currentSearchUiIndex.value = -1;
}

function selectChannel(channelId: string, channelName: string) {
  appendChannelMentionToInput(channelId);
  showDropdown.value = false;
  currentSearchUiIndex.value = -1;
}

function onInput(event: Event) {
  updateFilteredUsers();
}

function handleKeydown(event: KeyboardEvent) {
  const totalOptions =
    filteredUsers.value.length + filteredChannels.value.length;
  setDropdownDisplay();
  if (totalOptions === 0) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    currentSearchUiIndex.value =
      (currentSearchUiIndex.value + 1) % totalOptions;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    currentSearchUiIndex.value =
      (currentSearchUiIndex.value - 1 + totalOptions) % totalOptions;
  } else if (event.key === "Enter") {
    event.preventDefault();

    if (currentSearchUiIndex.value < filteredUsers.value.length) {
      const user = filteredUsers.value[currentSearchUiIndex.value];
      setSuppressSend(true);
      if (user) selectMember(user.userId, user.nickName);
    } else {
      const index = currentSearchUiIndex.value - filteredUsers.value.length;
      const channel = filteredChannels.value[index];
      setSuppressSend(true);
      selectChannel(channel.channelId, channel.channelName);
    }
  } else if (event.key === "Escape") {
    event.preventDefault();
    filteredUsers.value = [];
    filteredChannels.value = [];
    showDropdown.value = false;
    currentSearchUiIndex.value = -1;
  } else if (event.key === "Backspace" || event.key === "Space") {
    setTimeout(() => {
      updateFilteredUsers();
    }, 0);
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

.channel-suggestion {
  font-weight: 600;
  color: #eeeeee;
  cursor: pointer;
  padding-left: 20px;
}
.channel-hash {
  font-weight: bold;
  color: #7b7b81;
  margin-right: 8px;
  font-size: 20px;
}

.suggestion-header {
  font-weight: bold;
  text-transform: uppercase;
  padding: 8px 10px 8px;
  font-size: 0.85rem;
  color: #cccccc;

  user-select: none;
}
</style>
