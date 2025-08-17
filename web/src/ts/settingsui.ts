import {
  alertUser,
  askUser,
  logOutPrompt,
  openChangePasswordPop,
  openGuildSettingsDropdown,
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
  onEditGuildName,
  onEditChannelName,
  isBlackTheme,
  saveThemeCookie,
  saveTransparencyValue,
  loadBgVideo
} from "./settings.ts";
import { initialState } from "./app.ts";
import {
  updateSelfProfile,
  lastConfirmedProfileImg,
  getProfileImage,
  onEditEmoji,
  setGuildImage
} from "./avatar.ts";
import { apiClient, EventType } from "./api.ts";
import { availableLanguages, translations } from "./translations.ts";
import {
  getId,
  createEl,
  getAverageRGB,
  disableElement,
  enableElement,
  blackImage,
  escapeHtml,
  isMobile
} from "./utils.ts";
import { currentUserNick, currentUserId } from "./user.ts";
import { guildCache } from "./cache.ts";
import { permissionManager } from "./guildPermissions.ts";
import { currentGuildId } from "./guild.ts";
import { isOnGuild } from "./router.ts";
import { getGuildEmojiHtml, populateEmojis } from "./emoji.ts";
import {
  currentBGTransparency,
  onEditVideoUrl,
  resetVideoUrl,
  setTheme,
  updateVideoTransparency
} from "./extras.ts";
import { initializeGoogleOauth } from "./loginutils.ts";
import { closePopUp } from "./popups.ts";

type SettingType = "GUILD" | "PROFILE" | "CHANNEL";
export const SettingType = Object.freeze({
  GUILD: "GUILD",
  PROFILE: "PROFILE",
  CHANNEL: "CHANNEL"
});

type SettingCategory =
  | "MyAccount"
  | "SoundAndVideo"
  | "Notifications"
  | "ActivityPresence"
  | "Appearance"
  | "Language"
  | "GuildOverview"
  | "Emoji"
  | "Overview"
  | "Permissions"
  | "DeleteChannel"
  | "Invites"
  | "Roles"
  | "DeleteGuild";

interface Setting {
  category: SettingCategory;
  label: string;
}

interface Settings {
  userSettings: Setting[];
  guildSettings: Setting[];
  channelSettings: Setting[];
}

let currentSettingsChannelName: string;
export let currentSettingsChannelId: string;

export let currentSettingsCategory: string;
let currentSettingsType: SettingType = SettingType.PROFILE;
(window as any).currentSettingsType = currentSettingsType;

export function isGuildSettings() {
  return currentSettingsType === SettingType.GUILD;
}
export function isChannelSettings() {
  return currentSettingsType === SettingType.CHANNEL;
}
export function isProfileSettings() {
  return currentSettingsType === SettingType.PROFILE;
}

let currentSettings: Settings;

const settingsMenu = getId("settings-menu") as HTMLElement;
let resetTimeout: number;

const GuildCategoryTypes = Object.freeze({
  GuildOverview: "GuildOverview",
  Emoji: "Emoji",
  DeleteGuild: "DeleteGuild",
  Roles: "Roles",
  Invites: "Invites"
});

const ChannelCategoryTypes = Object.freeze({
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

function getSettingTypeFromCategory(category: string) {
  return CategoryTypeMapping[category] || null;
}

const createSettingsConfig = (
  categoryTypes: { [key: string]: string },
  htmlGenerator: (name: string) => string
) => {
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
  return createSettingsConfig(ProfileCategoryTypes, (category: string) => {
    switch (category) {
      case ProfileCategoryTypes.SoundAndVideo:
        return getSoundAndVideoHtml();
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
  const noodle = `
  <img
    style="width: 100%; max-width: 500px;"
    src="https://raw.githubusercontent.com/liventcord/LiventCordOld/refs/heads/main/static/404_files/noodle.gif"
  />
`;

  return createSettingsConfig(GuildCategoryTypes, (category: string) => {
    switch (category) {
      case GuildCategoryTypes.GuildOverview:
        return getGuildOverviewHtml();
      case GuildCategoryTypes.Emoji:
        if (currentGuildId) {
          return getGuildEmojiHtml();
        } else {
          return `<h2>${translations.getSettingsTranslation(category)}</h2>${noodle}`;
        }
      default:
        return `<h2>${translations.getSettingsTranslation(category)}</h2>${noodle}`;
    }
  });
};

const getChannelSettingsConfig = () => {
  return createSettingsConfig(ChannelCategoryTypes, (category: string) => {
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
const getSettingsConfigByType = (settingType: keyof typeof SettingType) => {
  const configMap = {
    [SettingType.GUILD]: getGuildSettingsConfig(),
    [SettingType.PROFILE]: getProfileSettingsConfig(),
    [SettingType.CHANNEL]: getChannelSettingsConfig()
  };

  return configMap[settingType] || {};
};

function getGuildSettings(): Setting[] {
  const setToReturn: Setting[] = [...currentSettings.guildSettings];
  if (permissionManager.canManageGuild()) {
    setToReturn.push({
      category: "Invites" as SettingCategory,
      label: translations.getSettingsTranslation("Invites")
    });
    setToReturn.push({
      category: "Roles" as SettingCategory,
      label: translations.getSettingsTranslation("Roles")
    });
    setToReturn.push({
      category: "DeleteGuild" as SettingCategory,
      label: translations.getSettingsTranslation("DeleteGuild")
    });
  }
  return setToReturn;
}
function getChannelSettings(): Setting[] {
  const setToReturn: Setting[] = [...currentSettings.channelSettings];

  if (permissionManager.canManageChannels()) {
    setToReturn.push({
      category: "DeleteChannel" as SettingCategory,
      label: translations.getSettingsTranslation("DeleteChannel")
    });
  }
  return setToReturn;
}
function getChannelSettingHTML() {
  const settings = loadSettings();
  currentSettings = settings;
  return generateSettingsHtml(getChannelSettings());
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

function generateSettingsHtml(settings: Setting[], isProfile = false) {
  const container = createEl("div");

  settings.forEach((setting) => {
    const button = createEl("button", {
      className: "settings-buttons",
      textContent: translations.getSettingsTranslation(setting.category),
      id: setting.category
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

export function updateSettingsProfileColor() {
  const settingsProfileImg = getProfileImage();
  const rightBarTop = getId("settings-rightbartop");
  if (settingsProfileImg && rightBarTop) {
    console.log("Average: ", getAverageRGB(settingsProfileImg));
    rightBarTop.style.backgroundColor = getAverageRGB(settingsProfileImg);
  }
}
function loadSettings(): Settings {
  const userSettings: Setting[] = [
    {
      category: "MyAccount" as SettingCategory,
      label: translations.getSettingsTranslation("MyAccount")
    },
    {
      category: "SoundAndVideo" as SettingCategory,
      label: translations.getSettingsTranslation("SoundAndVideo")
    },
    {
      category: "Notifications" as SettingCategory,
      label: translations.getSettingsTranslation("Notifications")
    },
    {
      category: "ActivityPresence" as SettingCategory,
      label: translations.getSettingsTranslation("ActivityPresence")
    },
    {
      category: "Appearance" as SettingCategory,
      label: translations.getSettingsTranslation("Appearance")
    },
    {
      category: "Language" as SettingCategory,
      label: translations.getSettingsTranslation("Language")
    }
  ];

  const guildSettings: Setting[] = [
    {
      category: "GuildOverview" as SettingCategory,
      label: translations.getSettingsTranslation("GeneralOverview")
    },
    {
      category: "Emoji" as SettingCategory,
      label: translations.getSettingsTranslation("Emoji")
    }
  ];

  const channelSettings: Setting[] = [
    {
      category: "Overview" as SettingCategory,
      label: translations.getSettingsTranslation("ChannelSettings")
    },
    {
      category: "Permissions" as SettingCategory,
      label: translations.getSettingsTranslation("Permissions")
    }
  ];

  return { userSettings, guildSettings, channelSettings };
}
function getUnknownSettings(
  settingType: string,
  settingCategory:
    | keyof typeof ProfileCategoryTypes
    | keyof typeof GuildCategoryTypes
    | keyof typeof ChannelCategoryTypes
) {
  return {
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
}

function selectSettingCategory(
  settingCategory:
    | keyof typeof ProfileCategoryTypes
    | keyof typeof GuildCategoryTypes
    | keyof typeof ChannelCategoryTypes
) {
  console.log("Selecting settings category: ", settingCategory);

  if (settingCategory === GuildCategoryTypes.DeleteGuild) {
    createDeleteGuildPrompt(currentGuildId, guildCache.currentGuildName);
    return;
  }

  if (settingCategory === ChannelCategoryTypes.DeleteChannel) {
    createDeleteChannelPrompt(
      currentGuildId,
      currentSettingsChannelId,
      currentSettingsChannelName
    );
    return;
  }

  if (settingCategory === ProfileCategoryTypes.MyAccount) {
    updateSelfProfile(currentUserId, currentUserNick, true);
  }

  const settingsContainer = getId("settings-rightcontainer");
  if (!settingsContainer) {
    return;
  }

  currentSettingsCategory = settingCategory;

  const settingType = getSettingTypeFromCategory(settingCategory);
  console.log("Setting Type for category: ", settingCategory, settingType);

  if (!settingType) {
    console.error(
      `Unable to find setting type for category: ${settingCategory}`
    );
    alertUser(
      "Error",
      `Unknown Setting: ${settingCategory} could not be found.`
    );
    return;
  }

  const settingsConfig = getSettingsConfigByType(settingType);
  console.log("Settings Config for setting type:", settingType, settingsConfig);

  const settingConfig =
    settingsConfig[settingCategory] ||
    getUnknownSettings(settingType, settingCategory);

  settingsContainer.innerHTML = settingConfig.html;

  initialiseSettingComponents(
    settingsContainer,
    settingCategory as keyof typeof ProfileCategoryTypes
  );

  if (settingCategory === GuildCategoryTypes.Emoji) {
    populateEmojis();
  }
  if (isMobile) {
    enableElement(settingsContainer);
    disableElement("settings-leftbar");
  }
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
  <h2 >${translations.getSettingsTranslation("GuildOverview")}</h2>
  <div id="guild-settings-rightbar">
    <div id="set-info-title-guild-name">${translations.getSettingsTranslation(
      "GuildName"
    )}</div>
    <input type="text" id="guild-overview-name-input" class="base-overview-name-input" autocomplete="off" 
           value="${escapeHtml(
             guildCache.currentGuildName || ""
           )}" maxlength="32">
    <div id="guild-image-container">
      <img id="guild-image" style="user-select: none;">

    </div>
    <form id="guildImageForm" enctype="multipart/form-data">
      <input type="file" name="guildImage" id="guildImage" accept="image/*" style="display: none;">
    </form>
  </div>
`;
}
function getSoundAndVideoHtml() {
  return `
  <h3>${translations.getSettingsTranslation("SoundAndVideo")}</h3>
  <select id="microphone-dropdown" class="dropdown"></select>
  <select id="earphones-dropdown" class="dropdown"></select>
  <select id="speakers-dropdown" class="dropdown"></select>`;
}
function getAccountSettingsHtml() {
  const _isBlackTheme = isBlackTheme();
  return `
        <div id="settings-rightbartop"></div>
        <div id="settings-title">${translations.getSettingsTranslation(
          "MyAccount"
        )}</div>
        <div id="settings-rightbar" class="${_isBlackTheme ? "black-theme-3" : ""}">
            <div id="settings-light-rightbar" class="${_isBlackTheme ? "black-theme" : ""}">
                <div id="set-info-title-nick">${translations.getSettingsTranslation(
                  "Username"
                )}</div>
                <div id="set-info-nick"></div>
                <div id="set-info-title-email">${translations.getSettingsTranslation(
                  "Email"
                )}</div>
                <i id="set-info-email-eye" style="cursor:pointer;" class="fas fa-eye toggle-password"> </i>
                <div id="set-info-email">${initialState.user.maskedEmail}</div>
                </div>
                <input type="text" id="new-nickname-input" autocomplete="off" value="${currentUserNick}" maxlength="32">
                <img id="settings-self-profile" crossorigin="anonymous" style="user-select: none;">
                <form id="profileImageForm" enctype="multipart/form-data">
                <input type="file" name="profileImage" id="profileImage" accept="image/*" style="display: none;">
                </form>
                <span id="settings-self-name"></span>
                <button id="change-password-button" class="settings-buttons settings-button">${translations.getSettingsTranslation("ChangePassword")}</button>
                <button id="link-google-btn" class="settings-buttons settings-button" >Link Google Account</button>
                <div id="google-link-wrapper" >
                </div>
    `;
}

function getLanguageHtml() {
  const currentLanguage = translations.currentLanguage.toLowerCase();

  const optionsHtml = Object.entries(availableLanguages)
    .map(
      ([key, value]) => `
        <option value="${key}">
            ${translations.getSettingsTranslation(value)}
        </option>`
    )
    .join("");

  setTimeout(() => {
    const dropdown = document.getElementById(
      "language-dropdown"
    ) as HTMLSelectElement;
    if (dropdown) {
      dropdown.value = currentLanguage;
    }
  }, 0);

  return `
        <h3>${translations.getSettingsTranslation("Language")}</h3>
        <select class="dropdown" id="language-dropdown">
            ${optionsHtml}
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
    },
    {
      id: "video-toggle",
      label: translations.getSettingsTranslation("VideoMode"),
      description: translations.getSettingsTranslation("EnableVideoMode")
    },
    {
      id: "developer-toggle",
      label: translations.getSettingsTranslation("DeveloperTitle"),
      description: translations.getSettingsTranslation("DeveloperDescription")
    }
  ];

  return `
        <h3>${translations.getSettingsTranslation("Appearance")}</h3>
        ${toggles
          .map((toggle) =>
            createToggle(toggle.id, toggle.label, toggle.description)
          )
          .join("")}
          </div>

        <h3 style="margin: 0px;" >${translations.getSettingsTranslation("Theme")}</h3>  
        <p style="color: #C4C5C9; margin: 0px;" >${translations.getSettingsTranslation("ThemeDescription")}</p>

        <div class="theme-selector-container">
          <span id="ash-theme-selector" class="theme-circle ash-theme"></span>
          <span id="dark-theme-selector" class="theme-circle dark-theme"></span>
        </div>  

        <h3>${translations.getSettingsTranslation("VideoUrlTitle")}</h3>
        <div
          id="video-url-input"
          contenteditable="true"
          role="textbox"
          aria-multiline="false"
          spellcheck="false"
          class="base-user-input">
          ${loadBgVideo()}
        </div>

        <button id="video-url-reset-btn" class="settings-button">
          ${translations.getSettingsTranslation("ResetVideoUrlButton")}
        </button>

        ${translations.getSettingsTranslation("VideoTransparency")}
        <input
        id="video-transparency-input"
        type="range"
        min="0.01"
        max="0.35"
        step="0.01"
        value="0.25"
        style=" bottom: 20px; left: 20px; z-index: 1000;">

        

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
  return `
  <div id="guild-settings-rightbar">
    <div id="set-info-title-channel-name">${translations.getTranslation(
      "channel-name"
    )}</div>
    <input type="text" id="channel-overview-name-input" class="base-overview-name-input" autocomplete="off" maxlength="100">
  </div>
`;
}
function getPermissionsHtml() {
  return "channel permissions";
}

function initializeLanguageDropdown() {
  const languageDropdown = getId("language-dropdown") as HTMLSelectElement;
  if (!languageDropdown) {
    return;
  }
  languageDropdown.value = translations.currentLanguage;

  languageDropdown.addEventListener("change", (event: Event) => {
    const target = event.target as HTMLSelectElement;

    if (target.value) {
      console.log("Selected language: ", target.value);
      translations.currentLanguage = target.value;
      translations.setLanguage(translations.currentLanguage);

      setTimeout(() => {
        reconstructSettings(currentSettingsType);
      }, 200);
    }
  });
}
export enum Themes {
  Ash,
  Dark
}
const selectedThemeBorderColor = "#5865F2";
const unThemeBorderColor = "#A5A5AC";

function selectThemeButton(isDark: boolean) {
  const ash = getId("ash-theme-selector");
  const dark = getId("dark-theme-selector");
  if (!ash || !dark) {
    return;
  }

  ash.style.borderColor = isDark
    ? unThemeBorderColor
    : selectedThemeBorderColor;
  dark.style.borderColor = isDark
    ? selectedThemeBorderColor
    : unThemeBorderColor;
}
export function selectTheme(selected: Themes) {
  console.log("Set theme: " + selected);
  const isDark = selected === Themes.Dark;

  setTheme(isDark);
  saveThemeCookie(isDark);

  selectThemeButton(isDark);
}
function createPopupWrapper(wrapperElement: HTMLElement) {
  const popOuterParent = createEl("div", {
    className: "outer-parent",
    style: { display: "flex" }
  });
  const parentContainer = createEl("div", {
    className: "pop-up",
    style: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      height: "100%"
    }
  });
  popOuterParent.addEventListener("click", () => {
    const rightbar = getId("settings-rightbar");
    if (rightbar) {
      const newWrapper = createEl("div", { id: "google-link-wrapper" });
      rightbar.appendChild(newWrapper);
    }

    closePopUp(popOuterParent, parentContainer);
  });
  popOuterParent.appendChild(parentContainer);
  parentContainer.appendChild(wrapperElement);
  return popOuterParent;
}

function linkGoogleAccount() {
  console.log("Link Google account");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const wrapper = getId("google-link-wrapper");
  console.log(wrapper, clientId);
  if (!clientId || !wrapper) {
    return;
  }
  initializeGoogleOauth(true);

  const popOuterParent = createPopupWrapper(wrapper);
  document.body.appendChild(popOuterParent);

  wrapper.innerHTML = `
    <div id="g_id_onload"
         data-client_id="${clientId}"
         data-context="use"
         data-ux_mode="popup"
         data-callback="handleGoogleLinkResponse">
    </div>
    <div class="g_id_signin"
         data-type="standard"
         data-shape="rectangular"
         data-theme="outline"
         data-text="continue_with"
         data-size="large"
         data-logo_alignment="left">
    </div>
  `;
}

function initialiseSettingComponents(
  settingsContainer: HTMLElement,
  settingCategory: keyof typeof ProfileCategoryTypes
) {
  setTimeout(() => {
    if (settingCategory === ProfileCategoryTypes.MyAccount) {
      updateSelfProfile(currentUserId, currentUserNick, true);
    }
  }, 100);

  initializeLanguageDropdown();

  const closeButton = getId("close-settings-button");
  if (closeButton) {
    closeButton.addEventListener("click", closeSettings);
  }

  toggleManager.setupToggles();

  getProfileImage()?.addEventListener("click", triggerFileInput);

  const ash = getId("ash-theme-selector");
  const dark = getId("dark-theme-selector");
  ash?.addEventListener("click", () => selectTheme(Themes.Ash));
  dark?.addEventListener("click", () => selectTheme(Themes.Dark));
  selectThemeButton(isBlackTheme());

  const transparencyInput = getId(
    "video-transparency-input"
  ) as HTMLInputElement;

  transparencyInput?.addEventListener("input", function (event: Event) {
    if (!event.target) {
      return;
    }
    const target = event.target as HTMLInputElement;
    const value = target.value;
    saveTransparencyValue(value);
    updateVideoTransparency(value);
  });
  if (transparencyInput) {
    transparencyInput.value = currentBGTransparency;
  }

  const videoUrlInput = getId("video-url-input");

  videoUrlInput?.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target.textContent) {
      onEditVideoUrl(target.textContent);
    }
  });
  const resetBtn = getId("video-url-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetVideoUrl();
    });
  }
  getId("new-nickname-input")?.addEventListener("input", onEditNick);
  const selfName = getId("settings-self-name");
  if (selfName) selfName.textContent = currentUserNick;
  const setInfoNick = getId("set-info-nick");
  if (setInfoNick) setInfoNick.textContent = currentUserNick;

  const guildNameInput = getId("guild-overview-name-input") as HTMLInputElement;
  const guildImage = getId("guild-image") as HTMLImageElement;
  if (guildImage) {
    guildImage.onerror = () => {
      guildImage.src = blackImage;
    };
    setGuildImage(currentGuildId, guildImage, true);
  }
  const channelNameInput = getId(
    "channel-overview-name-input"
  ) as HTMLInputElement;

  const canManageGuild = permissionManager.canManageGuild();
  if (channelNameInput) {
    channelNameInput.value = currentSettingsChannelName;
    channelNameInput.disabled = !permissionManager.canManageChannels();
    if (!channelNameInput.disabled) {
      channelNameInput.addEventListener("input", onEditChannelName);
    }
  }
  if (canManageGuild) {
    enableElement("guild-image-remove");
  }

  if (isOnGuild && guildNameInput) {
    if (permissionManager.canManageGuild()) {
      guildNameInput.addEventListener("input", onEditGuildName);
      guildImage?.addEventListener("click", triggerGuildImageUpdate);
      if (guildImage) {
        setGuildImage(currentGuildId, guildImage, true);
      }
    } else {
      guildNameInput.disabled = true;
    }
  }

  document.body.addEventListener("click", function (event) {
    const target = event.target as HTMLElement;
    if (target && target.id === "set-info-email-eye") {
      toggleEmail();
    }
  });

  getId("change-password-button")?.addEventListener(
    "click",
    openChangePasswordPop
  );
  getId("link-google-btn")?.addEventListener("click", linkGoogleAccount);

  const uploadEmojiButton = getId(
    "upload-emoji-button"
  ) as HTMLButtonElement | null;
  const emojiImageInput = getId("emoijImage") as HTMLInputElement | null;

  function triggerUploadEmoji(): void {
    if (!emojiImageInput) {
      return;
    }
    emojiImageInput.click();
    emojiImageInput.addEventListener("change", onEditEmoji);
  }

  if (permissionManager.canManageGuild() && uploadEmojiButton) {
    uploadEmojiButton.addEventListener("click", triggerUploadEmoji);
  }
}

export function createToggle(id: string, label: string, description: string) {
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

export function openChannelSettings(channelId: string, channelName: string) {
  currentSettingsChannelName = channelName;
  currentSettingsChannelId = channelId;
  openSettings(SettingType.CHANNEL);
}
export function openSettings(
  settingType: SettingType,
  focusToCategory: boolean = false
) {
  if (!settingsMenu) {
    return;
  }
  currentSettingsType = settingType;
  reconstructSettings(settingType, focusToCategory);

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
  if (!settingsMenu) {
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

function reconstructSettings(
  settingType: SettingType,
  focusToCategory: boolean = false
) {
  const leftBar = getId("settings-leftbar");
  if (!leftBar) {
    return;
  }
  leftBar.innerHTML = "";
  switch (settingType) {
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
      console.error("Unknown settings setting type: ", settingType);
      break;
  }
  const settingsContainer = getId("settings-rightcontainer");
  if (!settingsContainer) {
    return;
  }

  if (isMobile && focusToCategory) {
    enableElement("settings-rightcontainer");
    disableElement("settings-leftbar");
  } else if (isMobile && !focusToCategory) {
    disableElement("settings-rightcontainer");
    enableElement("settings-leftbar");
  }
}

export function hideConfirmationPanel(pop: HTMLElement) {
  pop.style.animation = "slide-down 0.15s ease-in-out forwards";
  setTimeout(() => {
    pop.style.display = "none";
  }, 1500);
}

export function showConfirmationPanel(pop: HTMLElement) {
  pop.style.display = "block";
  pop.style.animation = "slide-up 0.5s ease-in-out forwards";
}
export function generateConfirmationPanel() {
  if (!settingsMenu) {
    return;
  }
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
      profileimg.value = "";
    }
    const settingsSelfProfile = getProfileImage();

    if (settingsSelfProfile && lastConfirmedProfileImg) {
      settingsSelfProfile.src = URL.createObjectURL(lastConfirmedProfileImg);
    } else {
    }

    const guildNameInput = getId(
      "guild-overview-name-input"
    ) as HTMLInputElement;
    if (guildNameInput) {
      guildNameInput.value = guildCache.currentGuildName;
    }

    const channelNameInput = getId(
      "channel-overview-name-input"
    ) as HTMLInputElement;
    if (channelNameInput) {
      channelNameInput.value = currentSettingsChannelName;
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

export function shakeScreen() {
  let SHAKE_FORCE = 1;
  const RESET_TIMEOUT_DURATION = 800;

  regenerateConfirmationPanel();
  if (currentPopUp) {
    currentPopUp.style.backgroundColor = "#ff1717";
  }

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
    if (currentPopUp) {
      currentPopUp.style.backgroundColor = "#0f0f0f";
    }
  }, RESET_TIMEOUT_DURATION);

  return;
}
export function createDeleteChannelPrompt(
  guildId: string,
  channelId: string,
  channelName: string
) {
  if (!guildId || !channelId) {
    return;
  }
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

function createDeleteGuildPrompt(guildId: string, guildName: string) {
  if (!guildId) {
    return;
  }
  var onClickHandler = function () {
    apiClient.send(EventType.DELETE_GUILD, { guildId });
  };
  const actionText = translations.getDeleteGuildText(guildName);

  askUser(
    translations.getSettingsTranslation("DeleteGuild"),
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
    if (button) {
      button.addEventListener("click", openGuildSettingsDropdown);
    }
  });
}
init();
