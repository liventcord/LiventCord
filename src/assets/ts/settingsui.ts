import {
  alertUser,
  askUser,
  logOutPrompt,
  openGuildSettingsDd,
  toggleEmail
} from "./ui.ts";
import {
  toggleManager,
  setIsChangedImage,
  setIsSettingsOpen,
  applySettings,
  currentPopUp,
  isUnsaved,
  setUnsaved,
  onEditNick,
  triggerGuildImageUpdate,
  regenerateConfirmationPanel,
  triggerFileInput,
  onEditGuildName
} from "./settings.ts";
import { initialState } from "./app.ts";
import {
  updateSelfProfile,
  lastConfirmedProfileImg,
  getProfileImage,
  getGuildImage
} from "./avatar.ts";
import { apiClient, EventType } from "./api.ts";
import { translations } from "./translations.ts";
import {
  getId,
  createEl,
  getAverageRGB,
  disableElement,
  enableElement,
  blackImage
} from "./utils.ts";
import { currentUserNick, currentUserId, setSelfStatus } from "./user.ts";
import { guildCache } from "./cache.ts";
import { permissionManager } from "./guildPermissions.ts";
import { currentGuildId } from "./guild.ts";
import { currentChannelName } from "./channels.ts";

type SettingType = "GUILD" | "PROFILE" | "CHANNEL";
export const SettingType = Object.freeze({
  GUILD: "GUILD",
  PROFILE: "PROFILE",
  CHANNEL: "CHANNEL"
});

export let currentSettingsCategory;
export let currentSettingsType: SettingType = SettingType.PROFILE;
(window as any).currentSettingsType = currentSettingsType;

export function isGuildSettings() {
  return currentSettingsType === SettingType.GUILD;
}

let currentSettings;

const settingsMenu = getId("settings-menu");
let resetTimeout;

export const GuildCategoryTypes = Object.freeze({
  GuildOverview: "GuildOverview",
  Emoji: "Emoji",
  DeleteGuild: "DeleteGuild",
  Roles: "Roles",
  Invites: "Invites"
});

export const ChannelCategoryTypes = Object.freeze({
  Overview: "Overview",
  Permissions: "Permissions",
  DeleteChannel: "DeleteChannel"
});

export const ProfileCategoryTypes = Object.freeze({
  SoundAndVideo: "SoundAndVideo",
  MyAccount: "MyAccount",
  Notifications: "Notifications",
  ActivityPresence: "ActivityPresence",
  Appearance: "Appearance",
  Language: "Language"
});

const CategoryTypeMapping = Object.freeze({
  ...Object.fromEntries(
    Object.values(GuildCategoryTypes).map((category) => [
      category,
      SettingType.GUILD
    ])
  ),
  ...Object.fromEntries(
    Object.values(ChannelCategoryTypes).map((category) => [
      category,
      SettingType.CHANNEL
    ])
  ),
  ...Object.fromEntries(
    Object.values(ProfileCategoryTypes).map((category) => [
      category,
      SettingType.PROFILE
    ])
  )
});

function getSettingTypeFromCategory(category) {
  return CategoryTypeMapping[category] || null;
}

const createSettingsConfig = (categoryTypes, htmlGenerator) => {
  return Object.fromEntries(
    Object.entries(categoryTypes).map(([category, name]) => [
      name,
      {
        title: () => translations.getSettingsTranslation(name),
        html: htmlGenerator(name)
      }
    ])
  );
};

const getProfileSettingsConfig = () => {
  return createSettingsConfig(ProfileCategoryTypes, (category) => {
    switch (category) {
      case ProfileCategoryTypes.SoundAndVideo:
        return '<select class="dropdown"></select><select class="dropdown"></select><select class="dropdown"></select>';
      case ProfileCategoryTypes.MyAccount:
        return getAccountSettingsHtml();
      case ProfileCategoryTypes.Notifications:
        return getNotificationsHtml();
      case ProfileCategoryTypes.ActivityPresence:
        return getActivityPresenceHtml();
      case ProfileCategoryTypes.Appearance:
        return getAppearanceHtml();
      case ProfileCategoryTypes.Language:
        return getLanguageHtml();
      default:
        return "";
    }
  });
};

const getGuildSettingsConfig = () => {
  return createSettingsConfig(GuildCategoryTypes, (category) => {
    switch (category) {
      case GuildCategoryTypes.GuildOverview:
        return getGuildOverviewHtml();
      default:
        return "";
    }
  });
};

const getChannelSettingsConfig = () => {
  return createSettingsConfig(ChannelCategoryTypes, (category) => {
    switch (category) {
      case ChannelCategoryTypes.Overview:
        return getOverviewHtml();
      case ChannelCategoryTypes.Permissions:
        return getPermissionsHtml();
      default:
        return "";
    }
  });
};

const getSettingsConfigByType = (settingType) => {
  const configMap = {
    [SettingType.GUILD]: getGuildSettingsConfig(),
    [SettingType.PROFILE]: getProfileSettingsConfig(),
    [SettingType.CHANNEL]: getChannelSettingsConfig()
  };

  return configMap[settingType] || {};
};

export function updateSettingsProfileColor() {
  const settingsProfileImg = getProfileImage();
  const rightBarTop = getId("settings-rightbartop");
  if (rightBarTop) {
    rightBarTop.style.backgroundColor = getAverageRGB(settingsProfileImg);
  }
}

function loadSettings() {
  const userSettings = [
    {
      category: "MyAccount",
      label: translations.getSettingsTranslation("MyAccount")
    },
    {
      category: "SoundAndVideo",
      label: translations.getSettingsTranslation("SoundAndVideo")
    },
    {
      category: "Notifications",
      label: translations.getSettingsTranslation("Notifications")
    },
    {
      category: "ActivityPresence",
      label: translations.getSettingsTranslation("ActivityPresence")
    },
    {
      category: "Appearance",
      label: translations.getSettingsTranslation("Appearance")
    },
    {
      category: "Language",
      label: translations.getSettingsTranslation("Language")
    }
  ];

  const guildSettings = [
    {
      category: "GuildOverview",
      label: translations.getSettingsTranslation("GeneralOverview")
    },
    {
      category: "Emoji",
      label: translations.getSettingsTranslation("Emoji")
    }
  ];
  const channelSettings = [
    {
      category: "Overview",
      label: translations.getSettingsTranslation("ChannelSettings")
    },
    {
      category: "Permissions",
      label: translations.getSettingsTranslation("Permissions")
    },
    {
      category: "DeleteChannel",
      label: translations.getSettingsTranslation("DeleteChannel")
    }
  ];

  return { userSettings, guildSettings, channelSettings };
}
function getGuildSettings() {
  const setToReturn = [...currentSettings.guildSettings];
  if (permissionManager.canManageGuild()) {
    setToReturn.push({
      category: "Invites",
      label: translations.getSettingsTranslation("Invites")
    });
    setToReturn.push({
      category: "Roles",
      label: translations.getSettingsTranslation("Roles")
    });
    setToReturn.push({
      category: "DeleteGuild",
      label: translations.getSettingsTranslation("DeleteGuild")
    });
  }
  return setToReturn;
}
function getChannelSettingHTML() {
  const settings = loadSettings();
  currentSettings = settings;
  return generateSettingsHtml(settings.channelSettings);
}
function getProfileSettingsHTML() {
  const settings = loadSettings();
  currentSettings = settings;
  return generateSettingsHtml(settings.userSettings, true);
}

function getGuildSettingsHTML() {
  const settings = loadSettings();
  currentSettings = settings;
  return generateSettingsHtml(getGuildSettings());
}

function generateSettingsHtml(settings, isProfile = false) {
  const container = createEl("div");

  settings.forEach((setting) => {
    const button = createEl("button", {
      className: "settings-buttons",
      textContent: translations.getSettingsTranslation(setting.category)
    });
    button.addEventListener("click", () => {
      selectSettingCategory(setting.category);
    });
    container.appendChild(button);
  });

  if (isProfile) {
    const logOutButton = createEl("button", {
      className: "settings-buttons",
      textContent: translations.getTranslation("log-out-button")
    });
    logOutButton.addEventListener("click", logOutPrompt);
    container.appendChild(logOutButton);
  }

  return container;
}

export function selectSettingCategory(settingCategory) {
  console.log("Called category: ", settingCategory);
  if (settingCategory === GuildCategoryTypes.DeleteGuild) {
    createDeleteGuildPrompt(currentGuildId, guildCache.currentGuildName);
    return;
  }

  if (settingCategory === ChannelCategoryTypes.DeleteChannel) {
    createDeleteChannelPrompt(
      currentGuildId,
      guildCache.currentChannelId,
      currentChannelName
    );
    return;
  }

  const settingsContainer = getId("settings-rightcontainer");
  currentSettingsCategory = settingCategory;

  const settingType = getSettingTypeFromCategory(settingCategory);
  console.log("Setting Type for category: ", settingCategory, settingType);

  if (!settingType) {
    console.error(
      `ERROR: Unable to find setting type for category: ${settingCategory}`
    );
    alertUser(
      "Error",
      `Unknown Setting: ${settingCategory} could not be found.`
    );
    return;
  }

  const settingsConfig = getSettingsConfigByType(settingType);
  console.log("Settings Config for setting type:", settingType, settingsConfig);

  const settingConfig = settingsConfig[settingCategory] || {
    title: () => "Unknown Setting",
    html: `
      <h3>Unknown Setting: ${settingCategory} could not be found.</h3>
      <pre>
        <strong>Debug Information:</strong>
        <ul>
          <li><strong>Setting Category:</strong> ${settingCategory}</li>
          <li><strong>Setting Type:</strong> ${settingType || "N/A"}</li>
          <li><strong>Available Categories:</strong></li>
          <ul>
            <li><strong>Guild Categories:</strong> ${JSON.stringify(
              Object.values(GuildCategoryTypes),
              null,
              2
            )}</li>
            <li><strong>Channel Categories:</strong> ${JSON.stringify(
              Object.values(ChannelCategoryTypes),
              null,
              2
            )}</li>
            <li><strong>Profile Categories:</strong> ${JSON.stringify(
              Object.values(ProfileCategoryTypes),
              null,
              2
            )}</li>
          </ul>
        </ul>
      </pre>
    `
  };

  settingsContainer.innerHTML =
    settingConfig.html ||
    `Unknown Setting: ${settingCategory} could not be found.`;
  initialiseSettingComponents(settingsContainer, settingCategory);
}

function getActivityPresenceHtml() {
  return `
        <h3 id="activity-title">${translations.getSettingsTranslation(
          "ActivityPresence"
        )}</h3>
        <h3 id="settings-description">${translations.getSettingsTranslation(
          "ActivityStatus"
        )}</h3>
        <div class="toggle-card">
            <label for="activity-toggle">${translations.getSettingsTranslation(
              "ShareActivityWhenActive"
            )}</label>
            <label for="activity-toggle">${translations.getSettingsTranslation(
              "AutoShareActivityParticipation"
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

function getGuildOverviewHtml() {
  return `
        <div id="settings-title">${translations.getSettingsTranslation(
          "Overview"
        )}</div>
        <div id="guild-settings-rightbar">
            <div id="set-info-title-guild-name">${translations.getSettingsTranslation(
              "GuildName"
            )}</div>
            <input type="text" id="guild-overview-name-input" autocomplete="off" value="${
              guildCache.currentGuildName
            }"  maxlength="32">
            <img id="guild-image" style="user-select: none;">
            <p id="guild-image-remove" style="display:none">${translations.getSettingsTranslation(
              "Remove"
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
          "MyAccount"
        )}</div>
        <div id="settings-rightbar">
            <div id="settings-light-rightbar">
                <div id="set-info-title-nick">${translations.getSettingsTranslation(
                  "Username"
                )}</div>
                <div id="set-info-nick">${currentUserNick}</div>
                <div id="set-info-title-email">${translations.getSettingsTranslation(
                  "Email"
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
              "en"
            )}</option>
            <option value="tr">${translations.getSettingsTranslation(
              "tr"
            )}</option>
        </select>
    `;
}

function getAppearanceHtml() {
  const toggles = [
    {
      id: "snow-toggle",
      label: translations.getSettingsTranslation("WinterMode"),
      description: translations.getSettingsTranslation("EnableSnowEffect")
    },
    {
      id: "party-toggle",
      label: translations.getSettingsTranslation("PartyMode"),
      description: translations.getSettingsTranslation("EnablePartyMode")
    },
    {
      id: "slide-toggle",
      label: translations.getSettingsTranslation("SlideMode"),
      description: translations.getSettingsTranslation("EnableSlideMode")
    }
  ];

  return `
        <h3>${translations.getSettingsTranslation("Appearance")}</h3>
        ${toggles
          .map((toggle) =>
            createToggle(toggle.id, toggle.label, toggle.description)
          )
          .join("")}
    `;
}

function getNotificationsHtml() {
  const toggles = [
    {
      id: "notify-toggle",
      label: translations.getSettingsTranslation("Notifications"),
      description: translations.getSettingsTranslation("EnableNotifications")
    }
  ];
  return `
        <h3>${translations.getSettingsTranslation("Notifications")}</h3>
        ${toggles
          .map((toggle) =>
            createToggle(toggle.id, toggle.label, toggle.description)
          )
          .join("")}
    `;
}

function getOverviewHtml() {
  return "channel overview";
}
function getPermissionsHtml() {
  return "channel permissions";
}

function initializeLanguageDropdown() {
  const languageDropdown = getId("language-dropdown") as HTMLSelectElement;
  if (!languageDropdown) return;
  languageDropdown.value = translations.currentLanguage;

  languageDropdown.addEventListener("change", (event: Event) => {
    const target = event.target as HTMLSelectElement;

    if (target.value) {
      translations.currentLanguage = target.value;
      translations.setLanguage(translations.currentLanguage);

      setTimeout(() => {
        reconstructSettings(currentSettingsType);
        setSelfStatus();
      }, 200);
    }
  });
}

function initialiseSettingComponents(
  settingsContainer: HTMLElement,
  settingCategory
) {
  setTimeout(() => {
    if (settingCategory === ProfileCategoryTypes.MyAccount) {
      updateSelfProfile(currentUserId, currentUserNick, true);
    }
  }, 100);

  initializeLanguageDropdown();

  const closeButton = getCloseButtonElement();
  closeButton.addEventListener("click", closeSettings);
  settingsContainer.insertBefore(closeButton, settingsContainer.firstChild);

  toggleManager.setupToggles();

  const settingsSelfProfile = getProfileImage();
  if (settingsSelfProfile) {
    settingsSelfProfile.addEventListener("click", triggerFileInput);
  }

  const newNickInput = getId("new-nickname-input");
  if (newNickInput) {
    newNickInput.addEventListener("keydown", onEditNick);
  }
  const guildNameInput = getId("guild-overview-name-input") as HTMLInputElement;
  const guildImage = getGuildImage();

  if (permissionManager.canManageGuild()) {
    if (guildNameInput) {
      guildNameInput.addEventListener("keydown", onEditGuildName);
    }
    if (guildImage) {
      guildImage.addEventListener("click", triggerGuildImageUpdate);
      if (!guildImage.src) {
        guildImage.src = blackImage;
      }
    }
  } else {
    if (guildNameInput) {
      guildNameInput.disabled = true;
    }
  }

  const emailToggler = getId("set-info-email-eye");
  if (emailToggler) {
    emailToggler.addEventListener("click", toggleEmail);
  }
}

export function createToggle(id, label, description) {
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
export function openChannelSettings() {
  openSettings(SettingType.CHANNEL);
}
export function openSettings(settingType) {
  currentSettingsType = settingType;
  reconstructSettings(settingType);

  enableElement("settings-overlay");

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
    tabindex: "0"
  });

  button.innerHTML = `
        <svg aria-hidden="true" role="img" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z"></path>
        </svg>
        <span id="close-keybind">ESC</span>
    `;

  return button;
}

export function reconstructSettings(categoryType) {
  const leftBar = getId("settings-leftbar");
  leftBar.innerHTML = "";
  switch (categoryType) {
    case SettingType.GUILD:
      leftBar.appendChild(getGuildSettingsHTML());
      selectSettingCategory(GuildCategoryTypes.GuildOverview);
      break;
    case SettingType.PROFILE:
      leftBar.appendChild(getProfileSettingsHTML());
      selectSettingCategory(ProfileCategoryTypes.MyAccount);
      break;
    case SettingType.CHANNEL:
      leftBar.appendChild(getChannelSettingHTML());
      selectSettingCategory(ChannelCategoryTypes.Overview);
      break;

    default:
      console.error("Unknown settings category type: ", categoryType);
      break;
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
  setIsChangedImage(true);
  const popupDiv = createEl("div", { id: "settings-unsaved-popup" });

  const textDiv = createEl("div", {
    id: "settings-unsaved-popup-text",
    textContent: translations.getSettingsTranslation("unsavedChangesWarning")
  });
  popupDiv.appendChild(textDiv);

  const resetButton = createEl("span", {
    id: "settings-unsaved-popup-resetbutton",
    textContent: translations.getSettingsTranslation("resetButton")
  });

  resetButton.addEventListener("click", function () {
    hideConfirmationPanel(popupDiv);
    const nickinput = getId("new-nickname-input") as HTMLInputElement;
    if (nickinput) {
      nickinput.value = currentUserNick;
    }
    const profileimg = getId("profileImage") as HTMLInputElement;
    if (profileimg) {
      profileimg.files = null;
    }
    const settingsSelfProfile = getProfileImage();

    if (lastConfirmedProfileImg) {
      settingsSelfProfile.src = lastConfirmedProfileImg;
    } else {
    }

    const guildNameInput = getId(
      "guild-overview-name-input"
    ) as HTMLInputElement;
    if (guildNameInput) {
      guildNameInput.value = guildCache.currentGuildName;
    }

    setUnsaved(false);
    setIsChangedImage(false);
  });
  popupDiv.appendChild(resetButton);

  const applyButton = createEl("button", {
    id: "settings-unsaved-popup-applybutton",
    textContent: translations.getSettingsTranslation("saveChanges")
  });
  applyButton.addEventListener("click", applySettings);
  popupDiv.appendChild(applyButton);
  settingsMenu.appendChild(popupDiv);

  return popupDiv;
}

function shakeScreen() {
  let SHAKE_FORCE = 1;
  const RESET_TIMEOUT_DURATION = 5000;

  currentSettingsCategory = null;
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
  }, RESET_TIMEOUT_DURATION);

  return;
}
function createDeleteChannelPrompt(
  guildId: string,
  channelId: string,
  channelName: string
) {
  if (!guildId || !channelId) return;
  var onClickHandler = function () {
    apiClient.send(EventType.DELETE_CHANNEL, {
      guildId,
      channelId
    });
  };
  const actionText = translations.getDeleteChannelText(channelName);

  askUser(
    translations.getDeleteChannelText(channelName),
    translations.getTranslation("cannot-be-undone"),
    actionText,
    onClickHandler,
    true
  );
}

function createDeleteGuildPrompt(guildId, guildName) {
  if (!guildId) {
    return;
  }
  var onClickHandler = function () {
    apiClient.send(EventType.DELETE_GUILD, { guildId });
  };
  const actionText = translations.getDeleteGuildText(guildName);

  askUser(
    translations.getDeleteGuildText(guildName),
    translations.getTranslation("cannot-be-undone"),
    actionText,
    onClickHandler,
    true
  );
}

function init() {
  const openSettingsButton = getId("settings-button");
  if (openSettingsButton) {
    openSettingsButton.addEventListener("click", () => {
      openSettings(SettingType.PROFILE);
    });
  }

  const buttonIds = [
    "invite-dropdown-button",
    "settings-dropdown-button",
    "channel-dropdown-button",
    "notifications-dropdown-button",
    "exit-dropdown-button"
  ];

  buttonIds.forEach((id) => {
    const button = getId(id);
    button.addEventListener("click", openGuildSettingsDd);
  });
}
init();
