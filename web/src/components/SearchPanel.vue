<template>
  <input
    id="channelSearchInput"
    type="search"
    v-model="query"
    @focus="onFocusInput"
    @input="onInputChange"
    placeholder="Search..."
    class="searchInput"
    ref="channelSearchInputElement"
    :style="{ width: inputWidth, transition: 'width 0.3s ease' }"
    aria-haspopup="listbox"
    :aria-expanded="!dropdownHidden"
    aria-controls="search-dropdown"
  />
  <div
    id="search-dropdown"
    class="search-dropdown"
    :class="{ hidden: dropdownHidden }"
    ref="dropdownElement"
    role="listbox"
  >
    <div v-if="usersSection.length" class="section">
      <div class="section-title">From User</div>
      <ul class="search-content">
        <li
          v-for="user in usersSection"
          :key="user.name + '-from'"
          class="search-button"
          @click="handleUserClick(user)"
        >
          <span class="label">from:</span>
          <img :src="user.image" :alt="user.name" class="user-img" />
          <span class="username">{{ user.name }}</span>
        </li>
      </ul>
    </div>

    <div v-if="mentioningSection.length" class="section">
      <div class="section-title">Mentions User</div>
      <ul class="search-content">
        <li
          v-for="user in mentioningSection"
          :key="user.name + '-mentioning'"
          class="search-button"
          @click="handleUserClick(user, true)"
        >
          <span class="label">Mentioning:</span>
          <img :src="user.image" :alt="user.name" class="user-img" />
          <span class="username">{{ user.name }}</span>
        </li>
      </ul>
    </div>

    <div v-if="channelSection.length" class="section">
      <div class="section-title">In Channel</div>
      <ul class="search-content">
        <li
          v-for="channel in channelSection"
          :key="channel.channelName"
          class="search-button"
          @click="handleChannelClick(channel)"
        >
          in: {{ channel.channelName }}
        </li>
      </ul>
    </div>

    <div
      v-if="
        dateSection.before.length ||
        dateSection.during.length ||
        dateSection.after.length
      "
      class="section dates-section"
    >
      <div class="section-title">Dates</div>
      <ul class="search-content dates-content">
        <li
          v-for="month in dateSection.before"
          :key="month + '-before'"
          class="search-button"
        >
          <span class="label">before:</span>
          <span class="date-value">{{ month }}</span>
        </li>
        <li
          v-for="month in dateSection.during"
          :key="month + '-during'"
          class="search-button"
        >
          <span class="label">during:</span>
          <span class="date-value">{{ month }}</span>
        </li>
        <li
          v-for="month in dateSection.after"
          :key="month + '-after'"
          class="search-button"
        >
          <span class="label">after:</span>
          <span class="date-value">{{ month }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { currentGuildId, getGuildMembers, GuildMember } from "../ts/guild";
import { deletedUser } from "../ts/user";
import { CachedChannel, cacheInterface } from "../ts/cache";

const query = ref("");
const dropdownHidden = ref(true);
const users = ref(getGuildMembers() || []);
const channels = ref(cacheInterface.getChannels(currentGuildId) || []);
const currentFilteredFromUserId = ref("");
const currentFilteredMentioningUserId = ref("");
const currentFilteredChannel = ref();
const channelSearchInputElement = ref<HTMLInputElement | null>(null);
const dropdownElement = ref<HTMLDivElement | null>(null);

users.value = getGuildMembers() || [];

const getMonthValue = (query: string) => {
  if (!query.length) return ["Not Specified"];
  const lower = query.toLowerCase();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const matches = months.filter((m) => m.toLowerCase().startsWith(lower));
  return matches.length ? matches : ["Not Specified"];
};

watch(query, () => {
  users.value = getGuildMembers() || [];
  channels.value = cacheInterface.getChannels(currentGuildId);
});

const filteredUsers = computed(() => {
  if (!query.value.trim()) return [];
  return users.value
    .filter((user) => {
      const name = user.name?.toLowerCase() || deletedUser.toLowerCase();
      return name.startsWith(query.value.toLowerCase());
    })
    .slice(0, 3)
    .map((user) => user);
});

const usersSection = computed(() => filteredUsers.value);
const mentioningSection = computed(() => filteredUsers.value);

const channelSection = computed(() => {
  if (!query.value.trim()) return [];

  return channels.value
    .filter((channel) => {
      const name = channel.channelName?.toLowerCase() || "";
      return name.startsWith(query.value.toLowerCase());
    })
    .slice(0, 3);
});

const monthValues = computed(() => {
  const values = getMonthValue(query.value);
  return values.length === 1 && values[0] === "Not Specified" ? [] : values;
});

const dateSection = computed(() => ({
  before: monthValues.value,
  during: monthValues.value,
  after: monthValues.value
}));

function handleUserClick(user: GuildMember, isMentioning?: boolean) {
  if (isMentioning) {
    currentFilteredMentioningUserId.value = user.userId;
  } else {
    currentFilteredFromUserId.value = user.userId;
  }
}

function handleChannelClick(channel: CachedChannel) {
  currentFilteredChannel.value = channel;
}

function onFocusInput() {
  dropdownHidden.value = false;
}

const inputWidth = ref("150px");

function onInputChange() {
  dropdownHidden.value = false;
  inputWidth.value = "225px";
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Element;
  if (
    !channelSearchInputElement.value?.contains(target) &&
    !dropdownElement.value?.contains(target)
  ) {
    if (!query.value.trim()) {
      inputWidth.value = "150px";
    }
    dropdownHidden.value = true;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
.user-img {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 6px;
}

.search-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 96%;
  padding: 0;
  list-style: none;
  margin: 0;
}

.search-button {
  display: flex;
  align-items: center;
  padding: 6px;
  color: white;
  cursor: pointer;
  border-radius: 3px;
  margin: 3px 0;
  width: 100%;
}

.label {
  color: gray;
  margin-right: 8px;
}

.username,
.date-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-button:hover {
  background-color: rgb(49, 49, 53);
}

.search-dropdown {
  position: fixed;
  top: 50px;
  right: 50px;
  width: 300px;
  outline: 1px solid rgba(0, 0, 0, 0.1);
  background-color: #111214;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  z-index: 10;
  pointer-events: auto;
  white-space: nowrap;
}

.section {
  background-color: #111214;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.section-title {
  color: white;
  font-weight: bold;
  margin-bottom: 6px;
  padding-left: 6px;
  font-size: 14px;
}

.dates-section .search-content {
  gap: 4px;
}
</style>
