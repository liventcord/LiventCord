import {
  askUser,
  Overview,
  logOutPrompt,
  openGuildSettingsDd,
  toggleEmail,
} from "./ui";
import {
  setupToggle,
  settingTypes,
  toggleManager,
  setIsChangedProfile,
  setIsSettingsOpen,
  applySettings,
  currentPopUp,
  isUnsaved,
  setUnsaved,
  onEditNick,
  triggerGuildImageUpdate,
} from "./settings";
import { initialState } from "./app";
import { updateSelfProfile } from "./avatar";
import { apiClient, EventType } from "./api";
import { translations } from "./translations";
import {
  getId,
  createEl,
  getAverageRGB,
  disableElement,
  enableElement,
} from "./utils";
import { currentUserNick, currentUserId } from "./user";
import { guildCache } from "./cache";
import { permissionManager } from "./guildPermissions";
import { currentGuildId } from "./guild";
import { regenerateConfirmationPanel, triggerFileInput } from "./settings";
import { lastConfirmedProfileImg } from "./avatar";

export let currentSettingsType;
export let isGuildSettings = false;
let currentSettings;

const settingsMenu = getId("settings-menu");

let resetTimeout;

export function updateSettingsProfileColor() {
  const settingsProfileImg = getId("settings-self-profile");
  const rightBarTop = getId("settings-rightbartop");
  if (rightBarTop) {
    rightBarTop.style.backgroundColor = getAverageRGB(settingsProfileImg);
  }
}

function loadSettings() {
  const userSettings = [
    {
      category: "MyAccount",
      label: translations.getSettingsTranslation("MyAccount"),
    },
    {
      category: "SoundAndVideo",
      label: translations.getSettingsTranslation("SoundAndVideo"),
    },
    {
      category: "Notifications",
      label: translations.getSettingsTranslation("Notifications"),
    },
    {
      category: "ActivityPresence",
      label: translations.getSettingsTranslation("ActivityPresence"),
    },
    {
      category: "Appearance",
      label: translations.getSettingsTranslation("Appearance"),
    },
    {
      category: "Language",
      label: translations.getSettingsTranslation("Language"),
    },
  ];

  const guildSettings = [
    {
      category: "Overview",
      label: translations.getSettingsTranslation("GeneralOverview"),
    },
    { category: "Emoji", label: translations.getSettingsTranslation("Emoji") },
  ];

  return { userSettings, guildSettings };
}
function getGuildSettings() {
  let setToReturn = [...currentSettings.guildSettings];
  if (permissionManager.canManageGuild()) {
    setToReturn.push({
      category: "Invites",
      label: translations.getSettingsTranslation("Invites"),
    });
    setToReturn.push({
      category: "Roles",
      label: translations.getSettingsTranslation("Roles"),
    });
    setToReturn.push({
      category: "DeleteGuild",
      label: translations.getSettingsTranslation("DeleteGuild"),
    });
  }
  return setToReturn;
}

function getSettingsHtml() {
  const settings = loadSettings();
  currentSettings = settings;
  return generateSettingsHtml(settings.userSettings);
}

function getGuildSettingsHTML() {
  const settings = loadSettings();
  currentSettings = settings;
  return generateSettingsHtml(getGuildSettings(), true);
}

function getActivityPresenceHtml() {
  return `
        <h3 id="activity-title">${translations.getSettingsTranslation(
          "ActivityPresence",
        )}</h3>
        <h3 id="settings-description">${translations.getSettingsTranslation(
          "ActivityStatus",
        )}</h3>
        <div class="toggle-card">
            <label for="activity-toggle">${translations.getSettingsTranslation(
              "ShareActivityWhenActive",
            )}</label>
            <label for="activity-toggle">${translations.getSettingsTranslation(
              "AutoShareActivityParticipation",
            )}</label>
            <div id="activity-toggle" class="toggle-box">
                <div id="toggle-switch" class="toggle-switch">
                    <div class="enabled-toggle">
                        <svg viewBox="0 0 28 20" preserveAspectRatio="xMinYMid meet" aria-hidden="true" class="icon">
                            <rect fill="white" x="4" y="0" height="20" width="20" rx="10"></rect>
                            <svg viewBox="0 0 20 20" fill="none">
                                <path fill="rgba(35, 165, 90, 1)" d="M7.89561 14.8538L6.30462 13.2629L14.3099 5.25755L15.9009 6.84854L7.89561 14.8538Z"></path>
                                <path fill="rgba(35, 165, 90, 1)" d="M4.08643 11.0903L5.67742 9.49929L9.4485 13.2704L7.85751 14.8614L4.08643 11.0903Z"></path>
                            </svg>
                        </svg>
                    </div>
                    <div class="disabled-toggle">
                        <svg viewBox="0 0 28 20" preserveAspectRatio="xMinYMid meet" aria-hidden="true" class="icon">
                            <rect fill="white" x="4" y="0" height="20" width="20" rx="10"></rect>
                            <svg viewBox="0 0 20 20" fill="none">
                                <path fill="rgba(128, 132, 142, 1)" d="M5.13231 6.72963L6.7233 5.13864L14.855 13.2704L13.264 14.8614L5.13231 6.72963Z"></path>
                                <path fill="rgba(128, 132, 142, 1)" d="M13.2704 5.13864L14.8614 6.72963L6.72963 14.8614L5.13864 13.2704L13.2704 5.13864Z"></path>
                            </svg>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getOverviewHtml() {
  return `
        <div id="settings-title">${translations.getSettingsTranslation(
          "Overview",
        )}</div>
        <div id="guild-settings-rightbar">
            <div id="set-info-title-guild-name">${translations.getSettingsTranslation(
              "GuildName",
            )}</div>
            <input type="text" id="guild-overview-name-input" autocomplete="off" value="${
              guildCache.currentGuildName
            }"  maxlength="32">
            <img id="guild-image" style="user-select: none;">
            <p id="guild-image-remove" style="display:none">${translations.getSettingsTranslation(
              "Remove",
            )}</p>
            <form id="guildImageForm" enctype="multipart/form-data">
                <input type="file" name="guildImage" id="guildImage" accept="image/*" style="display: none;">
            </form>
        </div>
    `;
}

function getAccountSettingsHtml() {
  return `
        <div id="settings-rightbartop"></div>
        <div id="settings-title">${translations.getSettingsTranslation(
          "MyAccount",
        )}</div>
        <div id="settings-rightbar">
            <div id="settings-light-rightbar">
                <div id="set-info-title-nick">${translations.getSettingsTranslation(
                  "Username",
                )}</div>
                <div id="set-info-nick">${currentUserNick}</div>
                <div id="set-info-title-email">${translations.getSettingsTranslation(
                  "Email",
                )}</div>
                <i id="set-info-email-eye" style="cursor:pointer;" class="fas fa-eye toggle-password"> </i>
                <div id="set-info-email">${initialState.user.maskedEmail}</div>
            </div>
            <input type="text" id="new-nickname-input" autocomplete="off" value="${currentUserNick}" maxlength="32">
            <img id="settings-self-profile"style="user-select: none;">
            <form id="profileImageForm" enctype="multipart/form-data">
                <input type="file" name="profileImage" id="profileImage" accept="image/*" style="display: none;">
            </form>
            <span id="settings-self-name">${currentUserNick}</span>
        </div>
    `;
}

function getLanguageHtml() {
  return `
        <h3>${translations.getSettingsTranslation("Language")}</h3>
        <select class="dropdown" id="language-dropdown">
            <option value="en">${translations.getSettingsTranslation(
              "en",
            )}</option>
            <option value="tr">${translations.getSettingsTranslation(
              "tr",
            )}</option>
        </select>
    `;
}

function getAppearanceHtml() {
  const toggles = [
    {
      id: "snow-toggle",
      label: translations.getSettingsTranslation("WinterMode"),
      description: translations.getSettingsTranslation("EnableSnowEffect"),
    },
    {
      id: "party-toggle",
      label: translations.getSettingsTranslation("PartyMode"),
      description: translations.getSettingsTranslation("EnablePartyMode"),
    },
    {
      id: "slide-toggle",
      label: translations.getSettingsTranslation("SlideMode"),
      description: translations.getSettingsTranslation("EnableSlideMode"),
    },
  ];

  return `
        <h3>${translations.getSettingsTranslation("Appearance")}</h3>
        ${toggles
          .map((toggle) =>
            createToggle(toggle.id, toggle.label, toggle.description),
          )
          .join("")}
    `;
}

function getNotificationsHtml() {
  const toggles = [
    {
      id: "notify-toggle",
      label: translations.getSettingsTranslation("Notifications"),
      description: translations.getSettingsTranslation("EnableNotifications"),
    },
  ];
  return `
        <h3>${translations.getSettingsTranslation("Notifications")}</h3>
        ${toggles
          .map((toggle) =>
            createToggle(toggle.id, toggle.label, toggle.description),
          )
          .join("")}
    `;
}
function generateSettingsHtml(settings, isGuild = false) {
  const container = createEl("div");

  settings.forEach((setting) => {
    const button = createEl("button", {
      className: "settings-buttons",
      textContent: translations.getSettingsTranslation(setting.category),
    });
    button.addEventListener("click", () => {
      selectSettingCategory(setting.category);
      console.log(getSettingsHtml());
    });
    container.appendChild(button);
  });

  if (!isGuild) {
    const logOutButton = createEl("button", { className: "settings-buttons" });
    logOutButton.addEventListener("click", logOutPrompt);
    container.appendChild(logOutButton);
  }

  return container;
}

function getSettingsConfig() {
  return {
    SoundAndVideo: {
      title: translations.getSettingsTranslation("SoundAndVideoSettings"),
      html: `
                <select class="dropdown"></select>
                <select class="dropdown"></select>
                <select class="dropdown"></select>
            `,
    },
    MyAccount: {
      title: translations.getSettingsTranslation("MyAccount"),
      html: getAccountSettingsHtml(),
    },
    Notifications: {
      title: translations.getSettingsTranslation("Notifications"),
      html: getNotificationsHtml(),
    },
    ActivityPresence: {
      title: translations.getSettingsTranslation("ActivityStatus"),
      html: getActivityPresenceHtml(),
    },
    Appearance: {
      title: translations.getSettingsTranslation("Appearance"),
      html: getAppearanceHtml(),
    },
    Language: {
      title: translations.getSettingsTranslation("Language"),
      html: getLanguageHtml(),
    },
    Overview: {
      title: translations.getSettingsTranslation("ServerOverview"),
      html: getOverviewHtml(),
    },
    DeleteGuild: {
      title: translations.getSettingsTranslation("DeleteServer"),
      html: `<button id="delete-guild-button">${translations.getSettingsTranslation(
        "DeleteServerButton",
      )}</button>`,
    },
  };
}

export function selectSettingCategory(settingType) {
  const settingsContainer = getId("settings-rightcontainer");
  currentSettingsType = settingType;

  const settingConfig = getSettingsConfig()[settingType] || {
    title: "Unknown Setting",
    html: "<h3>Unknown Setting</h3>",
  };
  setTimeout(() => {
    if (settingType === "MyAccount") {
      updateSelfProfile(currentUserId, currentUserNick, true);
    }
  }, 100);
  settingsContainer.innerHTML = settingConfig.html;

  function initializeLanguageDropdown() {
    const languageDropdown = getId("language-dropdown");
    if (languageDropdown) {
      languageDropdown.value = translations.currentLanguage;
      languageDropdown.addEventListener("change", (event) => {
        translations.currentLanguage = event.target.value;
        translations.setLanguage(translations.currentLanguage);
        reconstructSettings(false);
        selectSettingCategory(currentSettingsType);
      });
    }
  }
  initializeLanguageDropdown();

  const closeButton = getCloseButtonElement();
  closeButton.addEventListener("click", closeSettings);
  settingsContainer.insertBefore(closeButton, settingsContainer.firstChild);

  const togglesToSetup = [
    "activity-toggle",
    "snow-toggle",
    "party-toggle",
    "notify-toggle",
    "slide-toggle",
  ];
  togglesToSetup.forEach(setupToggle);

  if (settingType === "DeleteGuild") {
    const deleteButton = getId("delete-guild-button");
    if (deleteButton) {
      deleteButton.addEventListener("click", () =>
        createDeleteGuildPrompt(currentGuildId, guildCache.currentGuildName),
      );
    }
  }

  const settingsSelfProfile = getId("settings-self-profile");
  if (settingsSelfProfile) {
    settingsSelfProfile.addEventListener("click", triggerFileInput);
  }

  const newNickInput = getId("new-nickname-input");
  console.log(newNickInput);
  if (newNickInput) {
    newNickInput.addEventListener("keydown", onEditNick);
  }
  const guildNameInput = getId("guild-overview-name-input");
  if (guildNameInput) {
    guildNameInput.addEventListener("keydown", onEditNick);
  }

  const emailToggler = getId("set-info-email-eye");
  if (emailToggler) {
    emailToggler.addEventListener("click", toggleEmail);
  }
  const guildImage = getId("guild-image");
  if (guildImage) {
    guildImage.addEventListener("click", triggerGuildImageUpdate);
  }
}

function createToggle(id, label, description) {
  return `
        <div class="toggle-card">
            <label for="${id}">${label}</label>
            <label for="${id}">${description}</label>
            <div id="${id}" class="toggle-box">
                <div class="toggle-switch">
                    <div class="enabled-toggle">
                        <svg viewBox="0 0 28 20" preserveAspectRatio="xMinYMid meet" aria-hidden="true" class="icon">
                            <rect fill="white" x="4" y="0" height="20" width="20" rx="10"></rect>
                            <svg viewBox="0 0 20 20" fill="none">
                                <path fill="rgba(35, 165, 90, 1)" d="M7.89561 14.8538L6.30462 13.2629L14.3099 5.25755L15.9009 6.84854L7.89561 14.8538Z"></path>
                                <path fill="rgba(35, 165, 90, 1)" d="M4.08643 11.0903L5.67742 9.49929L9.4485 13.2704L7.85751 14.8614L4.08643 11.0903Z"></path>
                            </svg>
                        </svg>
                    </div>
                    <div class="disabled-toggle">
                        <svg viewBox="0 0 28 20" preserveAspectRatio="xMinYMid meet" aria-hidden="true" class="icon">
                            <rect fill="white" x="4" y="0" height="20" width="20" rx="10"></rect>
                            <svg viewBox="0 0 20 20" fill="none">
                                <path fill="rgba(128, 132, 142, 1)" d="M5.13231 6.72963L6.7233 5.13864L14.855 13.2704L13.264 14.8614L5.13231 6.72963Z"></path>
                                <path fill="rgba(128, 132, 142, 1)" d="M13.2704 5.13864L14.8614 6.72963L6.72963 14.8614L5.13864 13.2704L13.2704 5.13864Z"></path>
                            </svg>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function openSettings() {
  reconstructSettings(isGuildSettings);
  selectSettingCategory(settingTypes.MyAccount);

  enableElement("settings-overlay");

  if (toggleManager.isSlide()) {
    settingsMenu.style.animation = "settings-menu-slide-in 0.3s forwards";
  } else {
    settingsMenu.style.animation = "settings-menu-scale-appear 0.3s forwards";
  }

  if (toggleManager.isSlide()) {
    settingsMenu.style.animation = "settings-menu-slide-in 0.3s forwards";
  } else {
    settingsMenu.style.animation = "settings-menu-scale-appear 0.3s forwards";
  }

  setIsSettingsOpen(true);
}

export function closeSettings() {
  if (isUnsaved) {
    shakeScreen();
    return;
  }

  if (toggleManager.isSlide()) {
    settingsMenu.style.animation = "settings-menu-slide-out 0.3s forwards";
  } else {
    settingsMenu.style.animation =
      "settings-menu-scale-disappear 0.3s forwards";
  }

  setTimeout(() => {
    disableElement("settings-overlay");
  }, 300);
  setIsSettingsOpen(false);
}

function getCloseButtonElement() {
  const button = createEl("button", {
    id: "close-settings-button",
    ariaLabel: "Close settings",
    role: "button",
    tabindex: "0",
  });

  button.innerHTML = `
        <svg aria-hidden="true" role="img" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z"></path>
        </svg>
        <span id="close-keybind">ESC</span>
    `;

  return button;
}

export function reconstructSettings(_isGuildSettings) {
  const leftBar = getId("settings-leftbar");
  leftBar.innerHTML = "";
  isGuildSettings = _isGuildSettings;
  if (_isGuildSettings) {
    leftBar.appendChild(getGuildSettingsHTML());
    selectSettingCategory(Overview);
  } else {
    leftBar.appendChild(getSettingsHtml());
  }
}

export function hideConfirmationPanel(pop) {
  pop.style.animation = "slide-down 0.15s ease-in-out forwards";
  setTimeout(() => {
    pop.style.display = "none";
  }, 1500);
}

export function showConfirmationPanel(pop) {
  pop.style.display = "block";
  pop.style.animation = "slide-up 0.5s ease-in-out forwards";
}
export function generateConfirmationPanel() {
  setIsChangedProfile(true);
  const popupDiv = createEl("div", { id: "settings-unsaved-popup" });

  const textDiv = createEl("div", {
    id: "settings-unsaved-popup-text",
    textContent: translations.getSettingsTranslation("unsavedChangesWarning"),
  });
  popupDiv.appendChild(textDiv);

  const resetButton = createEl("span", {
    id: "settings-unsaved-popup-resetbutton",
    textContent: translations.getSettingsTranslation("resetButton"),
  });

  resetButton.addEventListener("click", function () {
    hideConfirmationPanel(popupDiv);
    const nickinput = getId("new-nickname-input");
    if (nickinput) {
      nickinput.value = currentUserNick;
    }
    const profileimg = getId("profileImage");
    if (profileimg) {
      profileimg.files = null;
    }
    const settingsSelfProfile = getId("settings-self-profile");

    if (lastConfirmedProfileImg) {
      settingsSelfProfile.src = lastConfirmedProfileImg;
    } else {
    }

    const guildNameInput = getId("guild-overview-name-input");
    if (guildNameInput) {
      guildNameInput.value = guildCache.currentGuildName;
    }

    setUnsaved(false);
    setIsChangedProfile(false);
  });
  popupDiv.appendChild(resetButton);

  const applyButton = createEl("button", {
    id: "settings-unsaved-popup-applybutton",
    textContent: translations.getSettingsTranslation("saveChanges"),
  });
  applyButton.addEventListener("click", applySettings);
  popupDiv.appendChild(applyButton);
  settingsMenu.appendChild(popupDiv);

  return popupDiv;
}

function shakeScreen() {
  let SHAKE_FORCE = 1;

  currentSettingsType = null;
  regenerateConfirmationPanel();

  currentPopUp.style.backgroundColor = "#ff1717";

  SHAKE_FORCE += 0.5;
  if (SHAKE_FORCE > 5) {
    SHAKE_FORCE = 5;
  }

  clearTimeout(resetTimeout);

  document.body.classList.remove("shake-screen");
  document.body.classList.add("shake-screen");

  resetTimeout = setTimeout(() => {
    SHAKE_FORCE = 1;
    document.body.classList.remove("shake-screen");
    currentPopUp.style.backgroundColor = "#0f0f0f";
  }, 5000);

  return;
}

function createDeleteGuildPrompt(guildId, guildName) {
  if (!guildId) {
    return;
  }
  var onClickHandler = function () {
    apiClient.send(EventType.DELETE_GUILD, guildId);
  };
  const actionText = translations.getDeleteGuildText(guildName);

  askUser(
    translations.getDeleteGuildText(guildName),
    translations.getTranslation("delete_guild_text_2"),
    actionText,
    onClickHandler,
    null,
    true,
  );
}

function init() {
  const openSettingsButton = getId("settings-button");
  if (openSettingsButton) {
    openSettingsButton.addEventListener("click", openSettings);
  }

  const buttonIds = [
    "invite-dropdown-button",
    "settings-dropdown-button",
    "channel-dropdown-button",
    "notifications-dropdown-button",
    "exit-dropdown-button",
  ];

  buttonIds.forEach((id) => {
    const button = getId(id);
    button.addEventListener("click", openGuildSettingsDd);
  });
}
init();
