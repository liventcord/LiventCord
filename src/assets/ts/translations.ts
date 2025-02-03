import { kebapToSentence, getId, truncateString } from "./utils.ts";
import { alertUser } from "./ui.ts";

class Translations {
  currentLanguage: string;
  languages: { [key: string]: string };
  friendErrorTranslations: Record<string, string>;
  contextTranslations: Record<string, string>;
  settingTranslations: Record<string, string>;
  placeholderTranslations: Record<string, string>;
  textTranslations: Record<string, string>;
  errorTranslations: Record<string, string>;
  translationsLoaded: Promise<void>;
  resolveTranslations?: () => void;
  rejectTranslations?: () => void;

  constructor() {
    this.currentLanguage = "en";
    this.languages = {
      en: "en-us",
      tr: "tr-TR"
    };
    this.friendErrorTranslations = {};
    this.contextTranslations = {};
    this.settingTranslations = {};
    this.textTranslations = {};
    this.translationsLoaded = new Promise((resolve, reject) => {
      this.resolveTranslations = resolve;
      this.rejectTranslations = reject;
    });
  }

  formatTime(date) {
    return date.toLocaleTimeString(this.languages[this.currentLanguage], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  formatDate(date) {
    return date.toLocaleDateString(this.languages[this.currentLanguage]);
  }

  replacePlaceholder(templateKey, replacements, truncation = {}) {
    const languageData = this.placeholderTranslations[templateKey];
    if (!languageData) {
      console.log(`No template found for key: ${templateKey}`);
      return "";
    }
    const text = languageData;
    if (!text) {
      alertUser(
        `No translation found for key: ${templateKey} in language: ${this.currentLanguage}`
      );
      return "";
    }
    return Object.keys(replacements).reduce((acc, key) => {
      const value = truncation[key]
        ? truncateString(replacements[key], truncation[key])
        : replacements[key];
      return acc.replace(`{{${key}}}`, value);
    }, text);
  }

  getDeleteChannelText(channelName) {
    return this.replacePlaceholder("delete_channel_text", { channelName });
  }
  getDeleteGuildText(guildName) {
    return this.replacePlaceholder("delete_guild_text", { guildName });
  }

  getInviteGuildText(guildName) {
    return this.replacePlaceholder("invites_guild_text", { guildName });
  }

  getMessagePlaceholder(channelName) {
    return this.replacePlaceholder(
      "message_placeholder",
      { channelName },
      { channelName: 30 }
    );
  }

  generateGuildName(currentUserNick) {
    return this.replacePlaceholder(
      "guid_name_placeholder",
      { userNick: currentUserNick },
      { userNick: 15 }
    );
  }

  getDmPlaceHolder(friendNick) {
    return this.replacePlaceholder(
      "dm_placeholder",
      { friendNick },
      { friendNick: 15 }
    );
  }

  getDmStartText(friendNick) {
    return this.replacePlaceholder(
      "dm_start_text",
      { friendNick },
      { friendNick: 15 }
    );
  }
  getBirthChannel(channelName) {
    return this.replacePlaceholder(
      "birth_of_channel",
      { channelName },
      { channelName: 15 }
    );
  }
  getWelcomeChannel(channelName) {
    return this.replacePlaceholder(
      "welcome_channel",
      { channelName },
      { channelName: 15 }
    );
  }
  getAvatarUploadErrorMsg(maxAvatarSize) {
    return this.replacePlaceholder("avatar-upload-size-error-message", {
      avatarLimit: maxAvatarSize
    });
  }
  getReplyingTo(userName) {
    return this.replacePlaceholder("replying_to", { userName });
  }
  getReadText(date, time, count) {
    count = Math.max(count, 50);
    return this.replacePlaceholder("readen-chat", { date, time, count });
  }
  getChannelManageFailText(name) {
    return this.replacePlaceholder("channel-manage-fail", { guildName: name });
  }

  initializeTranslations() {
    const currentTranslations = this.textTranslations;

    if (!currentTranslations) {
      console.error(
        `No translations found for language: ${this.currentLanguage}`
      );
      return;
    }

    Object.keys(currentTranslations).forEach((key) => {
      const element = getId(key);
      if (element) {
        const textToUse = currentTranslations[key];
        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
          (element as HTMLInputElement | HTMLTextAreaElement).placeholder =
            textToUse;
        } else {
          if (element.className === "iconWrapper") {
            element.ariaLabel = textToUse;
          } else {
            element.textContent = textToUse;
          }
        }
      }
    });
  }

  getTranslation(key, list = this.textTranslations) {
    const result = list?.[key] ?? null;
    if (key && !result) {
      console.error("Cant find translation for:", key, list);
      return kebapToSentence(key);
    }
    return result;
  }
  getSettingsTranslation(key) {
    return this.getTranslation(key, this.settingTranslations);
  }

  setLanguage(language) {
    if (!language) return;

    console.log(`Selected Language: ${language}`);
    this.currentLanguage = language;
    this.loadTranslations(language);
  }

  async loadTranslations(language) {
    language = language[0].toUpperCase() + language.slice(1).toLowerCase();

    try {
      const textTranslationsResponse = await fetch(
        `/translations/textTranslations${language}.json`
      );
      const textTranslations = await textTranslationsResponse.json();

      const friendErrorTranslationsResponse = await fetch(
        `/translations/friendErrorTranslations${language}.json`
      );
      const friendErrorTranslations =
        await friendErrorTranslationsResponse.json();
      const errorTranslationsResponse = await fetch(
        `/translations/errorTranslations${language}.json`
      );

      const errorTranslations = await errorTranslationsResponse.json();

      const placeholderTranslationsResponse = await fetch(
        `/translations/placeholderTranslations${language}.json`
      );
      const placeholderTranslations =
        await placeholderTranslationsResponse.json();

      const contextTranslationsResponse = await fetch(
        `/translations/contextTranslations${language}.json`
      );
      const contextTranslations = await contextTranslationsResponse.json();

      const settingTranslationsResponse = await fetch(
        `/translations/settingTranslations${language}.json`
      );
      const settingTranslations = await settingTranslationsResponse.json();

      this.textTranslations = textTranslations;
      this.friendErrorTranslations = friendErrorTranslations;
      this.errorTranslations = errorTranslations;
      this.placeholderTranslations = placeholderTranslations;
      this.contextTranslations = contextTranslations;
      this.settingTranslations = settingTranslations;
      this.resolveTranslations();

      this.initializeTranslations();
    } catch (error) {
      console.error("Error loading translations:", error);
      this.rejectTranslations();
    }
  }

  getContextTranslation(key) {
    const translation = this.contextTranslations[key];

    if (!translation) {
      console.error("Cannot find translation for:", key);
    }

    return translation || key;
  }

  getFriendErrorMessage(key) {
    const result = this.friendErrorTranslations[key];
    if (key && !result) {
      console.error("Cant find translation for:", key);
    }
    return result;
  }

  getLocale() {
    return this.languages[this.currentLanguage] || this.languages.en;
  }
}

export const translations = new Translations();

translations.setLanguage("en");

setTimeout(() => {
  translations.initializeTranslations();
}, 0);
