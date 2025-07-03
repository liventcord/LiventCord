import { currentChannels } from "./channels";
import { getGuildMembers } from "./guild";
import { deletedUser } from "./user";
import { getId } from "./utils";

const channelSearchInputElement = getId(
  "channelSearchInput"
) as HTMLInputElement;
export let currentSearchUiIndex = -1;
export function setCurrentSearchUiIndex(index: number) {
  currentSearchUiIndex = index;
}
export const userMentionDropdown = getId(
  "userMentionDropdown"
) as HTMLSelectElement;

function getMonthValue(query: string) {
  if (query.length === 0) {
    return ["Not Specified"];
  }

  const lowerCaseQuery = query.toLowerCase();

  const months = [
    "January", // J
    "February", // F
    "March", // M
    "April", // A
    "May", // M
    "June", // J
    "July", // J
    "August", // A
    "September", // S
    "October", // O
    "November", // N
    "December" // D
  ];

  const matchingMonths = months.filter((month) =>
    month.toLowerCase().startsWith(lowerCaseQuery)
  );

  return matchingMonths.length > 0 ? matchingMonths : ["Not Specified"];
}

function filterMembers(query: string): void {
  const userSection = getId("userSection");
  const mentioningSection = getId("mentioningSection");
  const channelSection = getId("channelSection");
  const dateSection1 = getId("dateSection1");
  const dateSection2 = getId("dateSection2");
  const dateSection3 = getId("dateSection3");

  if (
    !userSection ||
    !mentioningSection ||
    !channelSection ||
    !dateSection1 ||
    !dateSection2 ||
    !dateSection3
  ) {
    console.error("One or more sections are not found");
    return;
  }

  const userSectionContent = userSection.querySelector(
    ".search-content"
  ) as HTMLElement;
  const mentioningSectionContent = mentioningSection.querySelector(
    ".search-content"
  ) as HTMLElement;
  const channelSectionContent = channelSection.querySelector(
    ".search-content"
  ) as HTMLElement;
  const dateSection1Content = dateSection1.querySelector(
    ".search-content"
  ) as HTMLElement;
  const dateSection2Content = dateSection2.querySelector(
    ".search-content"
  ) as HTMLElement;
  const dateSection3Content = dateSection3.querySelector(
    ".search-content"
  ) as HTMLElement;

  userSectionContent.innerHTML = "";
  mentioningSectionContent.innerHTML = "";
  channelSectionContent.innerHTML = "";
  dateSection1Content.innerHTML = "";
  dateSection2Content.innerHTML = "";
  dateSection3Content.innerHTML = "";

  const users = getGuildMembers();
  if (!users) {
    return;
  }

  const filteredUsers = users
    .filter((user) => {
      const name = user.name?.toLowerCase() || deletedUser;
      return name.startsWith(query.toLowerCase());
    })
    .slice(0, 3);

  filteredUsers.forEach((user) => {
    const name = user.name || deletedUser;
    userSectionContent.innerHTML += `<div class="search-button" onclick="handleUserClick('${name}')">
            <img src="${user.image}" alt="${name}" style="width: 20px; height: 20px; border-radius: 50%;"> ${name}
        </div>`;
    mentioningSectionContent.innerHTML += `<div class="search-button" onclick="handleUserClick('${name}')">
            Mentioning: <img src="${user.image}" alt="${name}" style="width: 20px; height: 20px; border-radius: 50%;"> ${name}
        </div>`;
  });

  if (currentChannels) {
    currentChannels.forEach((channel) => {
      channelSectionContent.innerHTML += `<div class="search-button">${channel.channelName}</div>`;
    });
  }

  const monthValue = getMonthValue(query);
  dateSection1Content.innerHTML += `<div class="search-button">Before this date: ${monthValue}</div>`;
  dateSection2Content.innerHTML += `<div class="search-button">During this date: ${monthValue}</div>`;
  dateSection3Content.innerHTML += `<div class="search-button">After this date: ${monthValue}</div>`;
}

function displayDefaultContent(): void {
  const userSection = getId("userSection");
  const mentioningSection = getId("mentioningSection");
  const channelSection = getId("channelSection");
  const dateSection1 = getId("dateSection1");
  const dateSection2 = getId("dateSection2");
  const dateSection3 = getId("dateSection3");

  if (
    !userSection ||
    !mentioningSection ||
    !channelSection ||
    !dateSection1 ||
    !dateSection2 ||
    !dateSection3
  ) {
    console.error("One or more sections are not found");
    return;
  }

  const userSectionContent = userSection.querySelector(
    ".search-content"
  ) as HTMLElement;
  const mentioningSectionContent = mentioningSection.querySelector(
    ".search-content"
  ) as HTMLElement;
  const channelSectionContent = channelSection.querySelector(
    ".search-content"
  ) as HTMLElement;
  const dateSection1Content = dateSection1.querySelector(
    ".search-content"
  ) as HTMLElement;
  const dateSection2Content = dateSection2.querySelector(
    ".search-content"
  ) as HTMLElement;
  const dateSection3Content = dateSection3.querySelector(
    ".search-content"
  ) as HTMLElement;

  userSectionContent.innerHTML = '<div class="button">No users found</div>';
  mentioningSectionContent.innerHTML =
    '<div class="button">No mentions found</div>';
  channelSectionContent.innerHTML =
    '<div class="button">Channel 1</div><div class="button">Channel 2</div><div class="button">Channel 3</div>';
  dateSection1Content.innerHTML =
    '<div class="button">Before this date: Not Specified</div><div class="button">During this date: Not Specified</div><div class="button">After this date: Not Specified</div>';
  dateSection2Content.innerHTML =
    '<div class="button">Before this date: Not Specified</div><div class="button">During this date: Not Specified</div><div class="button">After this date: Not Specified</div>';
  dateSection3Content.innerHTML =
    '<div class="button">Before this date: Not Specified</div><div class="button">During this date: Not Specified</div><div class="button">After this date: Not Specified</div>';
}

function onFocusInput() {
  const dropdown = getId("search-dropdown") as HTMLElement;
  dropdown.classList.remove("hidden");
  channelSearchInputElement.style.width = "225px";
}

function onBlurInput() {
  const dropdown = getId("search-dropdown") as HTMLElement;
  document.addEventListener("click", (event) => {
    if (!(event.target as Element).closest(".search-container")) {
      dropdown.classList.add("hidden");
    }
  });
}
function onInputSearchInput() {
  const dropdown = getId("search-dropdown") as HTMLElement;
  dropdown.classList.remove("hidden");
  channelSearchInputElement.style.width = "225px";

  if (channelSearchInputElement.value.length > 0) {
    dropdown.classList.remove("hidden");
    channelSearchInputElement.style.width = "225px";
  }

  const query = channelSearchInputElement.value.toLowerCase();
  if (query) {
    filterMembers(query);
  } else {
    displayDefaultContent();
  }
}

export function addChannelSearchListeners() {
  document.addEventListener("click", (event) => {
    if (!(event.target as Element).closest("#channelSearchInput")) {
      const searchDropdown = getId("search-dropdown") as HTMLElement;
      searchDropdown.classList.add("hidden");
      if (!channelSearchInputElement.value.trim()) {
        channelSearchInputElement.style.width = "150px";
      }
    }
  });

  channelSearchInputElement.onfocus = onFocusInput;
  channelSearchInputElement.onblur = onBlurInput;
  channelSearchInputElement.oninput = onInputSearchInput;
}
