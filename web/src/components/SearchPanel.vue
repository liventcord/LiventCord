<template>
  <div class="search-container">
    <div class="input-wrapper">
      <input
        id="channelSearchInput"
        type="search"
        v-model="query"
        @focus="onFocusInput"
        @input="onInputChange"
        @keydown.enter="onEnterKey"
        placeholder="Search..."
        class="searchInput"
        autocomplete="off"
        ref="channelSearchInputElement"
        :style="{ width: inputWidth, transition: 'width 0.3s ease' }"
        aria-haspopup="listbox"
        :aria-expanded="!dropdownHidden"
        aria-controls="search-dropdown"
      />
      <button
        type="button"
        class="close-button"
        @click="clearSearch"
        aria-label="Clear search"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div
      id="search-dropdown"
      class="search-dropdown"
      @click="handleMentionClick"
      :class="{ hidden: dropdownHidden }"
      ref="dropdownElement"
      role="listbox"
    >
      <div v-if="showDefaultOptions" class="section default-options">
        <div class="section-title">
          {{ translations.getTranslation("search-options") }}:
        </div>
        <ul class="search-content">
          <li class="search-button" @click.stop="selectUsersList(false)">
            <span class="label gray">{{
              translations.getTranslation("from-user")
            }}</span>
            <span class="placeholder">{{
              translations.getTranslation("user")
            }}</span>
          </li>
          <li class="search-button" @click.stop="selectUsersList(true)">
            <span class="label gray"
              >{{ translations.getTranslation("mentions") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("user")
            }}</span>
          </li>
          <li class="search-button">
            <span class="label gray"
              >{{ translations.getTranslation("has") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("link-embed-file")
            }}</span>
          </li>
          <li class="search-button" @click="openDatePicker('before')">
            <span class="label gray"
              >{{ translations.getTranslation("before") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("spesific-date")
            }}</span>
          </li>
          <li class="search-button" @click="openDatePicker('during')">
            <span class="label gray"
              >{{ translations.getTranslation("during") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("spesific-date")
            }}</span>
          </li>
          <li class="search-button" @click="openDatePicker('after')">
            <span class="label gray"
              >{{ translations.getTranslation("after") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("spesific-date")
            }}</span>
          </li>
          <li class="search-button" @click.stop="selectChannelsList()">
            <span class="label gray"
              >{{ translations.getTranslation("in-channel") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("channel")
            }}</span>
          </li>
          <li class="search-button" @click.stop="selectPinList()">
            <span class="label gray"
              >{{ translations.getTranslation("pinned") }}:</span
            >
            <span class="placeholder">{{
              translations.getTranslation("true-or-false")
            }}</span>
          </li>
        </ul>
      </div>

      <div v-if="showDatePicker" class="section">
        <div class="section-title">
          {{ translations.getTranslation("select-date-for") }}
          {{ currentDateType }}
        </div>
        <div class="date-picker-content">
          <input
            type="date"
            v-model="selectedDate"
            class="date-input"
            ref="dateInput"
            @change="onDateSelected"
          />
          <div class="date-picker-buttons">
            <button @click="cancelDateSelection" class="btn-cancel">
              {{ translations.getTranslation("cancel") }}
            </button>
            <button @click="confirmDateSelection" class="btn-confirm">
              {{ translations.getTranslation("confirm") }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showAllChannelsList && allChannelsList.length" class="section">
        <div class="section-title">
          {{ translations.getTranslation("select-channel") }}
        </div>
        <ul class="search-content">
          <li
            v-for="channel in allChannelsList"
            :key="channel.channelName + '-all-channels'"
            class="search-button"
            @click="handleChannelClick(channel)"
          >
            <span class="label gray"
              >{{ translations.getTranslation("in-channel") }}:</span
            >
            <span class="channel-name">{{ channel.channelName }}</span>
          </li>
        </ul>
      </div>

      <div v-if="isPinSelected" class="section">
        <ul class="search-content">
          <li @click="TogglePinState(true)" class="search-button">True</li>
          <li @click="TogglePinState(false)" class="search-button">False</li>
        </ul>
      </div>

      <div v-if="showAllUsersList && allUsersList.length" class="section">
        <div class="section-title">
          {{ translations.getTranslation("select-user") }}
        </div>
        <ul class="search-content">
          <li
            v-for="user in allUsersList"
            :key="user.name + '-all-users'"
            class="search-button"
            @click="handleUserClick(user, isSelectingMentions)"
          >
            <span class="label gray" v-if="isSelectingMentions"
              >{{ translations.getTranslation("mentions") }}:</span
            >
            <span class="label gray" v-else>{{
              translations.getTranslation("from-user")
            }}</span>
            <img
              :src="user.image"
              :alt="user.name"
              class="user-img"
              @click="clickOnFilteredUser($event, user.userId)"
            />
            <span class="username">{{ user.name }}</span>
          </li>
        </ul>
      </div>

      <div v-if="usersSection.length" class="section">
        <div class="section-title">
          {{ translations.getTranslation("from-user") }}
        </div>
        <ul class="search-content">
          <li
            v-for="user in usersSection"
            :key="user.name + '-from'"
            class="search-button"
            @click="handleUserClick(user)"
          >
            <span class="label gray">{{
              translations.getTranslation("from-user")
            }}</span>
            <img
              :src="user.image"
              :alt="user.name"
              class="user-img"
              @click="clickOnFilteredUser($event, user.userId)"
            />
            <span class="username">{{ user.name }}</span>
          </li>
        </ul>
      </div>

      <div v-if="mentioningSection.length" class="section">
        <div class="section-title">
          {{ translations.getTranslation("mentions-user") }}
        </div>
        <ul class="search-content">
          <li
            v-for="user in mentioningSection"
            :key="user.name + '-mentioning'"
            class="search-button"
            @click="handleUserClick(user)"
          >
            <span class="label gray"
              >{{ translations.getTranslation("mentioning") }}:</span
            >
            <img
              :src="user.image"
              :alt="user.name"
              class="user-img"
              @click="clickOnFilteredUser($event, user.userId)"
            />
            <span class="username">{{ user.name }}</span>
          </li>
        </ul>
      </div>

      <div v-if="channelSection.length" class="section">
        <div class="section-title">
          {{ translations.getTranslation("in-channel") }}
        </div>
        <ul class="search-content">
          <li
            v-for="channel in channelSection"
            :key="channel.channelName"
            class="search-button"
            @click="handleChannelClick(channel)"
          >
            <span class="label gray">in:</span> {{ channel.channelName }}
          </li>
        </ul>
      </div>

      <div
        v-if="hasActiveFilters && !dropdownHidden"
        class="section active-filters-section"
      >
        <div class="section-title">
          {{ translations.getTranslation("active-filters") }}
        </div>
        <ul class="search-content active-filters-content">
          <li
            v-if="currentFilteredFromUserName"
            class="search-button filter-item"
          >
            <span class="label gray"
              >{{ translations.getTranslation("from-user") }}:</span
            >
            <span
              class="filter-value"
              @click="clickOnFilteredUser($event, currentFilteredFromUserId)"
            >
              <img
                :src="getProfileUrl(currentFilteredFromUserId)"
                :alt="userManager.getUserNick(currentFilteredFromUserId)"
                class="user-img"
              />
              <span class="username">{{
                userManager.getUserNick(currentFilteredFromUserId)
              }}</span>
            </span>
            <button @click="removeUserFilter('from')" class="remove-filter-btn">
              ×
            </button>
          </li>
          <li
            v-if="currentFilteredMentioningUserName"
            class="search-button filter-item"
          >
            <span class="label gray"
              >{{ translations.getTranslation("mentions") }}:</span
            >
            <span class="filter-value">{{
              currentFilteredMentioningUserName
            }}</span>
            <button
              @click="removeUserFilter('mentions')"
              class="remove-filter-btn"
            >
              ×
            </button>
          </li>
          <li v-if="currentFilteredChannel" class="search-button filter-item">
            <span class="label gray"
              >{{ translations.getTranslation("in-channel") }}:</span
            >

            <span class="filter-value"
              >#{{ currentFilteredChannel.channelName }}</span
            >

            <button @click="removeChannelFilter()" class="remove-filter-btn">
              ×
            </button>
          </li>

          <li v-if="currentFilteredPinState" class="search-button filter-item">
            <span class="label gray"
              >{{ translations.getTranslation("pinned") }}:</span
            >

            <span class="filter-value">{{ currentFilteredPinState }}</span>

            <button @click="removePinFilter()" class="remove-filter-btn">
              ×
            </button>
          </li>
        </ul>
      </div>

      <div v-if="hasActiveDateFilters" class="section dates-section">
        <div class="section-title">
          {{ translations.getTranslation("active-date-filters") }}
        </div>
        <ul class="search-content dates-content">
          <li v-if="dateFilters.before" class="search-button filter-item">
            <span class="label gray"
              >{{ translations.getTranslation("before") }}:</span
            >
            <span class="date-value">{{
              formatDateForDisplay(dateFilters.before)
            }}</span>
            <button
              @click="removeDateFilter('before')"
              class="remove-filter-btn"
            >
              ×
            </button>
          </li>
          <li v-if="dateFilters.during" class="search-button filter-item">
            <span class="label gray"
              >{{ translations.getTranslation("during") }}:</span
            >
            <span class="date-value">{{
              formatDateForDisplay(dateFilters.during)
            }}</span>
            <button
              @click="removeDateFilter('during')"
              class="remove-filter-btn"
            >
              ×
            </button>
          </li>
          <li v-if="dateFilters.after" class="search-button filter-item">
            <span class="label gray"
              >{{ translations.getTranslation("after") }}:</span
            >
            <span class="date-value">{{
              formatDateForDisplay(dateFilters.after)
            }}</span>
            <button
              @click="removeDateFilter('after')"
              class="remove-filter-btn"
            >
              ×
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <teleport to="#search-messages-root">
    <div
      v-if="(messages.length > 0 && showMessages) || showError"
      class="search-messages-container"
    >
      <div v-if="showError" class="search-error-container">
        <img
          :src="IMAGE_SRCS.ICON_SRC"
          class="error-image"
          style="max-width: 200px; margin: 20px auto; display: block"
        />

        <p style="text-align: center; color: white">
          {{ translations.getTranslation("search-error") }}
        </p>
      </div>

      <div v-else>
        <div class="results-and-buttons">
          <span id="search-messages-count">
            {{ totalCount + " " + translations.getTranslation("results") }}
          </span>
          <div class="buttons-container">
            <button
              id="search-messages-new-button"
              :class="{ 'selected-button': isNewSelected }"
              @click="selectNewDates()"
            >
              {{ translations.getTranslation("new") }}
            </button>
            <button
              id="search-messages-old-button"
              :class="{ 'selected-button': !isNewSelected }"
              @click="selectOldDates()"
            >
              {{ translations.getTranslation("old") }}
            </button>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.messageId"
          class="message"
          @click="jumpToMessage(msg.messageId)"
          :id="msg.messageId"
          :data-user-id="msg.userId"
          :data-date="msg.date"
          :data-content="msg.content"
        >
          <img
            class="profile-pic"
            :id="msg.userId"
            :data-user-id="msg.userId"
            crossorigin="anonymous"
            style="width: 40px; height: 40px"
            :src="`${getProfileUrl(msg.userId)}`"
            alt="profile pic"
          />
          <div class="author-and-date">
            <span class="nick-element">{{
              userManager.getUserNick(msg.userId)
            }}</span>
            <span class="date-element">{{
              getFormattedDate(msg.date?.toString() ?? new Date().toString())
            }}</span>
          </div>
          <p
            id="message-content-element"
            class="onsmallprofile"
            :data-content_observe="msg.content"
            style="position: relative; word-break: break-all"
            data-content-loaded="true"
          >
            <span>{{ msg.content }}</span>
          </p>
          <div class="message-button-container">
            <button
              class="message-button"
              :data-m_id="msg.messageId"
              style="background-color: rgb(49, 51, 56)"
            >
              <div class="message-button-text">⋯</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { currentGuildId, getGuildMembers } from "../ts/guild";
import { deletedUser, userManager } from "../ts/user";
import { cacheInterface } from "../ts/cache";
import { apiClient, EventType } from "../ts/api";
import { getFormattedDate, IMAGE_SRCS } from "../ts/utils";
import { getProfileUrl } from "../ts/avatar";
import { goToMessage, handleMentionClick } from "../ts/chat";
import { translations } from "../ts/translations";
import {
  Message,
  GuildMember,
  SearchMessagesResponse,
  CachedChannel
} from "../ts/types/interfaces";

const query = ref("");
const dropdownHidden = ref(true);
const users = ref(getGuildMembers() || []);
const channels = ref(cacheInterface.getChannels(currentGuildId) || []);
const currentFilteredFromUserId = ref("");
const currentFilteredFromUserName = ref("");
const currentFilteredMentioningUserId = ref("");
const currentFilteredMentioningUserName = ref("");
const currentFilteredChannel = ref<CachedChannel | null>(null);
const currentFilteredPinState = ref<boolean>(false);
const channelSearchInputElement = ref<HTMLInputElement | null>(null);
const dropdownElement = ref<HTMLDivElement | null>(null);
const dateInput = ref<HTMLInputElement | null>(null);
const messages = ref<Message[]>([]);
const totalCount = ref("");
const inputWidth = ref("150px");
const showAllUsersList = ref(false);
const isNewSelected = ref(true);
const showMessages = ref(true);
const showError = ref(false);
const isMentionOpen = ref(false);
const showAllChannelsList = ref(false);
const isPinSelected = ref(false);
const isSelectingMentions = ref(false);
const showDatePicker = ref(false);
const currentDateType = ref<"before" | "during" | "after">("before");
const selectedDate = ref("");
const dateFilters = ref({
  before: "",
  during: "",
  after: ""
});

const hasActiveFilters = computed(() => {
  return (
    currentFilteredFromUserId.value ||
    currentFilteredMentioningUserId.value ||
    currentFilteredChannel.value ||
    currentFilteredPinState.value
  );
});

const hasActiveDateFilters = computed(() => {
  return (
    dateFilters.value.before ||
    dateFilters.value.during ||
    dateFilters.value.after
  );
});

const showDefaultOptions = computed(() => {
  const cond1 = !dropdownHidden.value;
  const cond2 = !query.value.trim();
  const cond6 = !showAllUsersList.value;
  const cond7 = !showDatePicker.value;
  const cond8 = !showAllChannelsList.value;

  const result = cond1 && cond2 && cond6 && cond7 && cond8;

  return result;
});

const allChannelsList = computed(() => {
  if (!showAllChannelsList.value) return [];
  channels.value = cacheInterface.getChannels(currentGuildId) || [];
  return channels.value.slice(0, 50);
});

const allUsersList = computed(() => {
  if (!showAllUsersList.value) return [];
  users.value = getGuildMembers() || [];
  return users.value.slice(0, 50);
});

users.value = getGuildMembers() || [];

watch(query, () => {
  users.value = getGuildMembers() || [];
  channels.value = cacheInterface.getChannels(currentGuildId) || [];
  if (dropdownElement.value) dropdownElement.value.style.display = "block";

  if (query.value.trim()) {
    showAllUsersList.value = false;
    showDatePicker.value = false;
    showAllChannelsList.value = false;
  }
});

const filteredUsers = computed(() => {
  if (!query.value.trim()) return [];
  return users.value
    .filter((user) => {
      const name = user.name?.toLowerCase() || deletedUser.toLowerCase();
      return name.startsWith(query.value.toLowerCase());
    })
    .slice(0, 3);
});

const usersSection = computed(() => {
  if (
    showAllUsersList.value ||
    showDatePicker.value ||
    showAllChannelsList.value
  )
    return [];
  return filteredUsers.value;
});

const mentioningSection = computed(() => {
  if (
    showAllUsersList.value ||
    showDatePicker.value ||
    showAllChannelsList.value
  )
    return [];
  return filteredUsers.value;
});

const channelSection = computed(() => {
  if (
    showAllUsersList.value ||
    showDatePicker.value ||
    showAllChannelsList.value
  )
    return [];
  if (!query.value.trim()) return [];

  return channels.value
    .filter((channel) => {
      const name = channel.channelName?.toLowerCase() || "";
      return name.includes(query.value.toLowerCase());
    })
    .slice(0, 3);
});

function formatDateForDisplay(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function openDatePicker(dateType: "before" | "during" | "after") {
  setTimeout(() => {
    showDatePicker.value = true;
  }, 0);
  dropdownHidden.value = false;
  currentDateType.value = dateType;
  selectedDate.value = dateFilters.value[dateType] || "";
  showAllUsersList.value = false;
  showAllChannelsList.value = false;
}

function onDateSelected() {}

function confirmDateSelection() {
  if (selectedDate.value) {
    dateFilters.value[currentDateType.value] = selectedDate.value;
  }
  showDatePicker.value = false;
  dropdownHidden.value = true;

  if (selectedDate.value) {
    performSearch();
  }
  setTimeout(() => {
    dropdownHidden.value = false;
  }, 0);
}

function cancelDateSelection() {
  selectedDate.value = "";
  showDatePicker.value = false;
  setTimeout(() => {
    dropdownHidden.value = false;
  }, 0);
}

function removeDateFilter(dateType: "before" | "during" | "after") {
  dateFilters.value[dateType] = "";
  performSearch();
}

function removeUserFilter(filterType: "from" | "mentions") {
  if (filterType === "from") {
    currentFilteredFromUserId.value = "";
    currentFilteredFromUserName.value = "";
  } else {
    currentFilteredMentioningUserId.value = "";
    currentFilteredMentioningUserName.value = "";
  }
  performSearch();
}
function removeChannelFilter() {
  currentFilteredChannel.value = null;
  performSearch();
}
function removePinFilter() {
  currentFilteredPinState.value = false;
  performSearch();
}

function clickOnFilteredUser(e: MouseEvent, userId: string) {
  handleMentionClick(e, currentFilteredFromUserId.value);
}

function validateSearchBody(body: any): boolean {
  const hasQuery = body.query && body.query.trim().length > 0;
  const hasFromUser = !!body.fromUserId;
  const hasDateFilters =
    !!body.beforeDate || !!body.duringDate || !!body.afterDate;

  return hasQuery || hasFromUser || hasDateFilters || body.channelId != null;
}

function buildSearchBody() {
  const body: any = {
    query: query.value.trim(),
    isOldMessages: isNewSelected.value
  };

  if (currentFilteredFromUserId.value) {
    body.fromUserId = currentFilteredFromUserId.value;
  }
  if (currentFilteredMentioningUserId.value) {
    body.mentioningUserId = currentFilteredMentioningUserId.value;
  }
  if (currentFilteredChannel.value) {
    body.channelId = currentFilteredChannel.value.channelId;
  }

  if (dateFilters.value.before) {
    body.beforeDate = dateFilters.value.before;
  }
  if (dateFilters.value.during) {
    body.duringDate = dateFilters.value.during;
  }
  if (dateFilters.value.after) {
    body.afterDate = dateFilters.value.after;
  }

  return body;
}

async function runSearch() {
  const body = buildSearchBody();

  if (!validateSearchBody(body)) {
    return;
  }

  await apiClient.send(EventType.SEARCH_MESSAGE_GUILD, {
    guildId: currentGuildId,
    ...body
  });
}

async function performSearch() {
  const body = buildSearchBody();

  if (!validateSearchBody(body)) {
    console.log("Search body rejected: ", body);
    return;
  }

  await apiClient.send(EventType.SEARCH_MESSAGE_GUILD, {
    guildId: currentGuildId,
    ...body
  });
}

function selectUsersList(isMentioning: any) {
  resetDropdownStates();
  showAllUsersList.value = true;
  isSelectingMentions.value = Boolean(isMentioning);
  query.value = "";
  inputWidth.value = "225px";
}

function selectChannelsList() {
  resetDropdownStates();
  showAllChannelsList.value = true;
  query.value = "";
  inputWidth.value = "225px";
}

function selectPinList() {
  dropdownHidden.value = true;
  resetDropdownStates();
  isPinSelected.value = true;
  query.value = "";
  inputWidth.value = "225px";
}
async function handleUserClick(user: GuildMember, isMentioning = false) {
  showAllUsersList.value = false;
  showAllChannelsList.value = false;

  const shouldSetMentioning =
    isMentioning !== null ? isMentioning : isSelectingMentions.value;
  isMentionOpen.value = shouldSetMentioning;

  if (shouldSetMentioning) {
    currentFilteredMentioningUserId.value = user.userId;
    currentFilteredMentioningUserName.value = user.name || deletedUser;
  } else {
    currentFilteredFromUserId.value = user.userId;
    currentFilteredFromUserName.value = user.name || deletedUser;
  }

  query.value = "";
  dropdownHidden.value = true;
  inputWidth.value = "150px";
  await performSearch();
}

async function handleChannelClick(channel: CachedChannel) {
  showAllUsersList.value = false;
  showDatePicker.value = false;
  showAllChannelsList.value = false;
  currentFilteredChannel.value = channel;
  query.value = "";
  dropdownHidden.value = true;
  inputWidth.value = "150px";
  setTimeout(async () => {
    await performSearch();
  }, 0);
}
function TogglePinState(bool: boolean) {
  showAllUsersList.value = false;
  showDatePicker.value = false;
  showAllChannelsList.value = false;
  currentFilteredPinState.value = bool;
  query.value = "";
  setTimeout(() => {
    dropdownHidden.value = false;
  }, 0);
  isPinSelected.value = false;
  inputWidth.value = "150px";
}

function jumpToMessage(messageId: string) {
  goToMessage(messageId, true);
  if (dropdownElement.value) dropdownElement.value.style.display = "none";
}

function selectNewDates() {
  isNewSelected.value = true;
  runSearch();
}

function selectOldDates() {
  isNewSelected.value = false;
  runSearch();
}

async function onEnterKey() {
  if (query.value.trim()) {
    await runSearch();
  }
  dropdownHidden.value = true;
}

function clearSearch() {
  query.value = "";
  showMessages.value = false;
  showError.value = false;
  currentFilteredFromUserId.value = "";
  currentFilteredMentioningUserId.value = "";
  currentFilteredFromUserName.value = "";
  currentFilteredMentioningUserName.value = "";
  currentFilteredChannel.value = null;
  currentFilteredPinState.value = false;

  dropdownHidden.value = true;
  dateFilters.value = {
    before: "",
    during: "",
    after: ""
  };

  resetDropdownStates();
}

apiClient.on(
  EventType.SEARCH_MESSAGE_GUILD,
  async (data: SearchMessagesResponse) => {
    if (data.messages && data.messages.length > 0) {
      showMessages.value = true;
      messages.value = data.messages;
      console.log(messages.value);
    } else {
      showError.value = true;
    }

    if (data.totalCount) totalCount.value = data.totalCount;
  }
);

function resetDropdownStates() {
  showAllUsersList.value = false;
  showAllChannelsList.value = false;
  showDatePicker.value = false;
  isPinSelected.value = false;
}

function showDropdown() {
  dropdownHidden.value = false;
  if (dropdownElement.value) {
    dropdownElement.value.style.display = "block";
  }
}

function onFocusInput() {
  resetDropdownStates();
  showDropdown();
}

function onInputChange() {
  resetDropdownStates();
  inputWidth.value = "225px";
  showDropdown();
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Element;
  const searchContainer =
    channelSearchInputElement.value?.closest(".search-container");

  if (
    !searchContainer?.contains(target) &&
    !dropdownElement.value?.contains(target)
  ) {
    dropdownHidden.value = true;
    resetDropdownStates();

    if (
      !query.value.trim() &&
      !hasActiveFilters.value &&
      !hasActiveDateFilters.value
    ) {
      inputWidth.value = "150px";
    }
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
.date-picker-content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.date-input {
  padding: 8px 0.875rem;
  background-color: #393a41;
  color: white;
  outline: none;
  border-radius: 4px;
  font-size: 14px;
  border: none;
  width: 185%;
}

.date-picker-buttons {
  display: flex;
  gap: 8px;
}

.btn-confirm,
.btn-cancel {
  padding: 6px 0.875rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-confirm {
  background-color: #007bff;
  color: white;
}

.btn-confirm:hover {
  background-color: #0056b3;
}

.btn-cancel {
  background-color: #6c757d;
  color: white;
}

.btn-cancel:hover {
  background-color: #545b62;
}

.filter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.remove-filter-btn {
  margin-left: 8px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.remove-filter-btn:hover {
  color: #ff4444;
}
</style>

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
.search-messages-container {
  background: #1e1f22;
  border-radius: 5px;
  width: 26.4vw;
  height: 93vh;
  margin-top: 7vh;
  right: 0px;
  z-index: 1;
  position: fixed;
  overflow-y: auto;
  overflow-x: hidden;
}

@media (max-width: 600px) {
  .search-messages-container {
    width: 100vw;
    height: 100vh;
  }
}

.message {
  transform: translateY(70px);
  padding-right: 17px;
}

.current-search-display {
  padding-top: 10px;
  padding-left: 10px;
  color: white;
}

.results-and-buttons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  margin-right: 10px;
}

.buttons-container {
  display: flex;
  gap: 8px;
}

#search-messages-count {
  color: white;
  position: static;
  margin-left: 5px;
  top: auto;
}

#search-messages-new-button {
  border: none;
  color: white;
  cursor: pointer;
  background-color: transparent;
  width: 60px;
  height: 30px;
  font-size: 16px;
}

#search-messages-old-button {
  border: none;
  color: white;
  cursor: pointer;
  background-color: transparent;
  width: 60px;
  height: 30px;
  font-size: 16px;
}
#search-messages-old-button:focus {
  outline: none;
}
.selected-button {
  background-color: #2c2c30 !important;
}
.input-wrapper {
  position: relative;
  display: inline-block;
}

.searchInput {
  padding-right: 30px;
}
.close-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: #888;
  font-size: 16px;
  user-select: none;
  border: none;
  background: transparent;
  padding: 0;
  align-items: center;
  justify-content: center;
}

.close-button i {
  pointer-events: none;
  font-size: inherit;
  color: inherit;
}
.label.gray,
.placeholder {
  text-transform: lowercase;
}
.filter-value {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
