import { kebapToSentence, getId, truncateString } from "./utils.ts";
import { alertUser } from "./ui.ts";

import enTranslations from "./../translations/en.json";
import trTranslations from "./../translations/tr.json";

export const availableLanguages = {
  english: "en",
  turkish: "tr"
};

interface TranslationsStructure {
  textTranslations: Record<string, string>;
  friendErrorTranslations: Record<string, { [key: string]: string } | string>;
  errorTranslations: Record<string, string>;
  placeholderTranslations: Record<string, string>;
  contextTranslations: Record<string, string>;
  settingTranslations: Record<string, string>;
  tooltipTranslations: Record<string, string>;
}

const translationsMap: Record<string, TranslationsStructure> = {
  English: enTranslations,
  Turkish: trTranslations
};
type Replacements = Record<string, string>;
type Truncation = Record<string, number>;

class Translations {
  currentLanguage: string;
  languages: { [key: string]: string };
  friendErrorTranslations: Record<string, { [key: string]: string } | string>;
  contextTranslations: Record<string, string>;
  settingTranslations: Record<string, string>;
  placeholderTranslations: Record<string, string>;
  textTranslations: Record<string, string>;
  errorTranslations: Record<string, string>;
  tooltipTranslations: Record<string, string>;

  constructor() {
    this.currentLanguage = "English";
    this.languages = {
      en: "en-us",
      tr: "tr-TR"
    };
    this.friendErrorTranslations = {};
    this.contextTranslations = {};
    this.settingTranslations = {};
    this.placeholderTranslations = {};
    this.textTranslations = {};
    this.errorTranslations = {};
    this.tooltipTranslations = {};
  }

  formatTime(date: Date) {
    return date.toLocaleTimeString(this.languages[this.currentLanguage], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  formatDate(date: Date) {
    return date.toLocaleDateString(this.languages[this.currentLanguage]);
  }

  replacePlaceholder(
    templateKey: string,
    replacements: Replacements,
    truncation: Truncation = {}
  ): string {
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

  getDeleteChannelText(channelName: string): string {
    return this.replacePlaceholder("delete_channel_text", { channelName });
  }

  getDeleteGuildText(guildName: string): string {
    return this.replacePlaceholder("delete_guild_text", { guildName });
  }

  getInviteGuildText(guildName: string): string {
    return this.replacePlaceholder("invites_guild_text", { guildName });
  }

  getMessagePlaceholder(channelName: string): string {
    return this.replacePlaceholder(
      "message_placeholder",
      { channelName },
      { channelName: 30 }
    );
  }

  generateGuildName(currentUserNick: string): string {
    return this.replacePlaceholder(
      "guid_name_placeholder",
      { userNick: currentUserNick },
      { userNick: 15 }
    );
  }

  getDmPlaceHolder(friendNick: string): string {
    return this.replacePlaceholder(
      "dm_placeholder",
      { friendNick },
      { friendNick: 15 }
    );
  }

  getDmStartText(friendNick: string): string {
    return this.replacePlaceholder(
      "dm_start_text",
      { friendNick },
      { friendNick: 15 }
    );
  }

  getBirthChannel(channelName: string): string {
    return this.replacePlaceholder(
      "birth_of_channel",
      { channelName },
      { channelName: 15 }
    );
  }

  getWelcomeChannel(channelName: string): string {
    return this.replacePlaceholder(
      "welcome_channel",
      { channelName },
      { channelName: 15 }
    );
  }

  getAvatarUploadErrorMsg(maxAvatarSize: number): string {
    return this.replacePlaceholder("avatar-upload-size-error-message", {
      avatarLimit: maxAvatarSize.toString()
    });
  }

  getReplyingTo(userName: string): string {
    return this.replacePlaceholder("replying_to", { userName });
  }

  getReadText(date: string, time: string, count: number): string {
    count = Math.max(count, 50);
    return this.replacePlaceholder("readen-chat", {
      date,
      time,
      count: count.toString()
    });
  }

  getChannelManageFailText(name: string): string {
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

  getTranslation(
    key: string,
    list = this.textTranslations,
    ignoreIdFallback?: boolean
  ) {
    const result = list?.[key] ?? null;
    if (key && !result) {
      if (ignoreIdFallback) {
        return "";
      }
      console.error("Cant find translation for:", key, list);
      return kebapToSentence(key);
    }
    return result;
  }
  getSettingsTranslation(key: string) {
    return this.getTranslation(key, this.settingTranslations);
  }
  getTooltipTranslation(key: string) {
    return this.getTranslation(key, this.tooltipTranslations, true);
  }

  setLanguage(language: string) {
    if (!language) return;

    console.log(`Selected Language: ${language}`);
    this.currentLanguage = language;
    this.loadTranslations(language);
  }

  async loadTranslations(language: string) {
    language = language[0].toUpperCase() + language.slice(1).toLowerCase();

    const selectedTranslations =
      translationsMap[language as keyof typeof translationsMap];

    this.textTranslations = selectedTranslations.textTranslations;
    this.friendErrorTranslations = selectedTranslations.friendErrorTranslations;
    this.errorTranslations = selectedTranslations.errorTranslations;
    this.placeholderTranslations = selectedTranslations.placeholderTranslations;
    this.contextTranslations = selectedTranslations.contextTranslations;
    this.settingTranslations = selectedTranslations.settingTranslations;
    this.tooltipTranslations = selectedTranslations.tooltipTranslations;

    this.initializeTranslations();
  }

  getContextTranslation(key: string) {
    const translation = this.contextTranslations[key];

    if (!translation) {
      console.error("Cannot find translation for:", key);
    }

    return translation || key;
  }

  getFriendErrorMessage(key: string) {
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

translations.setLanguage("English");

setTimeout(() => {
  translations.initializeTranslations();
}, 0);
