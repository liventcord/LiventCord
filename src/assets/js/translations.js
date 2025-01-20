import { truncateString } from "./utils";



class Translations {
  constructor() {
    this.currentLanguage = "en";
    this.enLocale = "en-us";
    this.trLocale = "tr-TR";
    this.errorTranslations = {};
    this.contextTranslations = {};
    this.translations = {
      en: {
        "online": "Online",
        "offline": "Offline",
        "pending": "Pending",
        "blocked": "Blocked",
        "all": "All",
        "incoming-friend-request": "Incoming Friend Request",
        "outgoing-friend-request": "Outgoing Friend Request",
        "dms-title": "Direct Messages",
        "friend-label": "Friends",
        "user-list-title": "Now Online",
        "online-button": "Online",
        "all-button": "All",
        "pending-button": "Pending",
        "blocked-button": "Blocked",
        "open-friends-button": "Add Friend",
        "channel-info-for-friend": "Friends",
        "preview-image-button": "Open in Browser",
        "sound-panel-status": "Sound connection established",
        "left-settings-title": "User Settings",
        "my-account-button": "My Account",
        "sound-and-video-button": "Sound and Video",
        "notifications-button": "Notifications",
        "activity-presence-button": "Activity Privacy",
        "log-out-button": "Log Out",
        "log-out-prompt": "Are you sure you want to log out?",
        "new-messages-span": "Mark as Read",
        "global-search-input": "Find or Start a Chat",
        "invite-dropdown-button": "Invite People",
        "settings-dropdown-button": "Guild Settings",
        "channel-dropdown-button": "Create Channel",
        "notifications-dropdown-button": "Notification Settings",
        "exit-dropdown-button": "Leave Guild",
        "leave-guild-detail": "Are you sure you want to leave guild?",
        "new-channel-placeholder": "new-channel",
        "channel-type-description": "Send messages, images, GIFs, emojis, ideas, and jokes",
        "channel-type-voice-description": "Talk or video chat together, or share your screen",
        "special-chan-text": "Private Channel",
        "tb-call": "Start Voice Call",
        "tb-video-call": "Start Video Call",
        "tb-pin": "Pinned Messages",
        "tb-createdm": "Add Friend to DM",
        "tb-showprofile": "Show User Profile",
        "today": "Today at",
        "yesterday": "Yesterday at",
        "delete_guild_text_2": "This action cannot be undone",
        "ok" : "Okay",
        "cancel" : "Cancel",
        "accept": "Accept",
        "channel-name": "Channel Name",
        "about": "About",
        "create-myself": "Create myself",
        "already-have-invite": "Already have an invite?",
        "join-a-guild": "Join a guild",
        "join-guild": "Join guild",
        "join-a-guild-detail": "Enter an invitation below to join an existing guild.",
        "customize-guild" : "Customize your guild",
        "customize-guild-detail" : "Add a name and icon to your new guild to give it personality. You can change these anytime you want.",
        "guildname": "Guild Name",
        "create": "Create",
        "guild-join-invite-title": "INVITE CODE - Please enter a valid invite link or invite code",
        "invites-look-like": "Invites look like:",
        "upload": "Upload",
        "invite-link": "Invite Link",
        "back": "Back",
        "crop-title": "Edit Image",
        "append": "Append",
        "create-your-guild": "Create Your Guild",
        "create-your-guild-detail": "Your guild is the place where you hang out with your friends. Create your own guild and start chatting.",
        "guild-born-title" : "Welcome to guild",
        "fail-message-text": "The message could not be delivered. This might be because you do not share any servers with the recipient or the recipient only accepts direct messages from friends.",
        "start-of-guild" : "This, is the start of guild.",
        "channelSearchInput": "Search",
        "friendsSearchInput": "Search",
        "addfriendtext": "Add Friend",
        "addfrienddetailtext": "You can add your friends with their LiventCord name.",
        "addfriendinputbutton": "Send Friend Request",
        "send-message": "Send Message",
        "more": "More",
        "addFriendDiscriminatorErrorText": "Invalid discriminator! (#0000)",
        "friendAddYourselfErrorText": "You cant be friends with yourself!",
        "upload-error-message": "You can only upload image files! (JPG, PNG veya GIF)!",
        "upload-size-error-message": "File size must be smaller than 8 MB!",
        "join-error-response": "INVITE LINK - Invite is invalid or expired",
        "microphone-failed" : "MICROPHONE ACCESS BLOCKED",
        "microphone-failed-2" : "Microphone permission denied.",
      },

      tr: {
        "online": "Çevrim İçi",
        "offline": "Çevrim Dışı",
        "pending": "Bekleyen",
        "blocked": "Engellenen",
        "all": "Tümü",
        "incoming-friend-request": "Gelen Arkadaş İsteği",
        "outgoing-friend-request": "Giden Arkadaş İsteği",
        "dms-title": "Direkt Mesajlar",
        "friend-label": "Arkadaşlar",
        "user-list-title": "Şimdi Aktif",
        "online-button": "Çevrim İçi",
        "all-button": "Tümü",
        "pending-button": "Bekleyen",
        "blocked-button": "Engellenen",
        "open-friends-button": "Arkadaş Ekle",
        "channel-info-for-friend": "Arkadaşlar",
        "preview-image-button": "Tarayıcıda aç",
        "sound-panel-status": "Ses bağlantısı kuruldu",
        "left-settings-title": "Kullanıcı Ayarları",
        "my-account-button": "Hesabım",
        "sound-and-video-button": "Ses Ve Görüntü",
        "notifications-button": "Bildirimler",
        "activity-presence-button": "Etkinlik Gizliliği",
        "log-out-button": "Çıkış yap",
        "log-out-prompt": "Çıkış yapmak istediğine emin misin?",
        "new-messages-span": "Okunmuş olarak işaretle",
        "global-search-input": "Sohbet bul ya da başlat",
        "invite-dropdown-button": "İnsanları Davet Et",
        "settings-dropdown-button": "Sunucu Ayarları",
        "channel-dropdown-button": "Kanal Oluştur",
        "notifications-dropdown-button": "Bildirim Ayarları",
        "exit-dropdown-button": "Sunucudan Ayrıl",
        "leave-guild-detail": "Sunucudan ayrılmak istediğine emin misin?",
        "new-channel-placeholder": "yeni-kanal",
        "channel-type-description": "Mesajlar, resimler, GIF\"ler, emojiler, fikirler ve şakalar gönder",
        "channel-type-voice-description": "Birlikte sesli veya görüntülü konuşun veya ekran paylaşın",
        "special-chan-text": "Özel Kanal",
        "tb-call": "Sesli Arama Başlat",
        "tb-video-call": "Görüntülü Arama Başlat",
        "tb-pin": "Sabitlenmiş Mesajlar",
        "tb-createdm": "DM'ye Arkadaş Ekle",
        "tb-showprofile": "Kullanıcı Profilini Göster",
        "today": "Bugün saat",
        "yesterday": "Dün saat",
        "delete_guild_text_2": "This action cannot be undone",
        "ok" : "Tamam",
        "cancel" : "İptal",
        "accept": "Kabul et",
        "channel-name": "Kanal Adı",
        "about": "Hakkında",
        "create-myself": "Kendim Oluşturayım",
        "already-have-invite": "Zaten davetin var mı?",
        "join-a-guild": "Bir Sunucuya Katıl",
        "join-guild": "Sunucuya Katıl",
        "join-a-guild-detail": "Var olan bir sunucuya katılmak için aşağıya bir davet gir.",
        "customize-guild" : "Sunucunu Özelleştir",
        "customize-guild-detail" : "Yeni sunucuna bir isim ve simge ekleyerek ona kişilik kat. Bunları istediğin zaman değiştirebilirsin.",
        "guildname": "Sunucu Adı",
        "create": "Oluştur",
        "guild-join-invite-title": "DAVET BAĞLANTISI - Lütfen geçerli bir davet bağlantısı veya davet kodu gir.",
        "invites-look-like": "Davetler şöyle görünür:",
        "upload": "Yükle",
        "invite-link": "Davet Bağlantısı",
        "back": "Geri",
        "crop-title": "Görseli Düzenle",
        "append":"Uygula",
        "create-your-guild": "Sunucunu oluştur.",
        "create-your-guild-detail": "Sunucun, arkadaşlarınla takıldığınız yerdir. Kendi sunucunu oluştur ve konuşmaya başla.",
        "invites-guild-detail": "Veya bir arkadaşına sunucu daveti bağlantısı yolla",
        "guild-born-title" : "klanına hoşgeldin!",
        "fail-message-text": "Mesajın iletilemedi. Bunun nedeni alıcıyla herhangi bir sunucu paylaşmıyor olman veya alıcının sadece arkadaşlarından direkt mesaj kabul ediyor olması olabilir.",
        "start-of-guild" : "Bu, sunucunun başlangıcıdır.",
        "channelSearchInput": "Ara",
        "friendsSearchInput": "Ara",
        "addfriendtext": "Arkadaş ekle",
        "addfrienddetailtext": "Arkadaşlarını LiventCord kullanıcı adı ile ekleyebilirsin.",
        "addfriendinputbutton": "Arkadaşlık İsteği Gönder",
        "send-message": "Mesaj Gönder",
        "more": "Daha fazla",
        "addFriendDiscriminatorErrorText": "Tanımlayıcı geçersiz! (#0000)",
        "friendAddYourselfErrorText": "Kendini arkadaş ekleyemezsin!",
        "upload-error-message": "Yalnızca resim dosyaları yükleyebilirsiniz (JPG, PNG veya GIF)!",
        "upload-error-message" : "Yalnızca resim dosyaları yükleyebilirsiniz (JPG, PNG veya GIF)!",
        "upload-size-error-message" : "Dosya boyutu 8 MB\"den küçük olmalıdır!",
        "microphone-failed" : "MİKROFON ERİŞİMİ ENGELLENDİ",
        "microphone-failed-2" : "Mikrofon izni reddedildi.",
        
      }
    };
  }

  
  settingTranslations = {
    en: {
      en: "English",
      tr: "Turkish",
      MyAccount: "My Account",
      SoundAndVideo: "Sound and Video",
      Notifications: "Notifications",
      ActivityPresence: "Activity Privacy",
      Appearance: "Appearance",
      Language: "Language",
      Overview: "Overview",
      Emoji: "Emoji",
      Invites: "Invites",
      Roles: "Roles",
      DeleteGuild: "Delete Guild",
      LogOut: "Log Out",
      WinterMode: "Winter Mode",
      EnableSnowEffect: "Enable snow effect.",
      PartyMode: "Party Mode",
      EnablePartyMode: "Enable party mode.",
      SlideMode: "Slide Mode",
      EnableSlideMode: "Enable slide mode.",
      EnableNotifications: "Enable notifications.",
      ActivityPresence: "Activity Presence",
      ActivityStatus: "Activity Status",
      ShareActivityWhenActive: "Share activity when you're active",
      AutoShareActivityParticipation: "LiventCord automatically shares your participation in activities.",
      Overview: "Overview",
      GuildName: "Guild Name",
      Remove: "Remove",
      Username: "Username",
      Email: "Email",
      GeneralOverview: "General Overview",
      Emoji: "Emoji",
      Invites: "Invites",
      Roles: "Roles",
      DeleteGuild: "Delete Guild",
      SoundAndVideoSettings: "Sound and Video Settings",
      Notifications: "Notifications",
      ActivityStatus: "Activity Status",
      Appearance: "Appearance",
      Language: "Language",
      ServerOverview: "Server Overview",
      DeleteServer: "Delete Server",
      DeleteServerButton: "Delete Server",
      unsavedChangesWarning: "Warning — you have unsaved changes!",
      resetButton: "Reset",
      saveChanges: "Save Changes",
    },
    tr: {
      en: "İngilizce",
      tr: "Türkçe",
      MyAccount: "Hesabım",
      SoundAndVideo: "Ses ve Görüntü",
      Notifications: "Bildirimler",
      ActivityPresence: "Etkinlik Gizliliği",
      Appearance: "Görünüm",
      Language: "Dil",
      Overview: "Genel Görünüm",
      Emoji: "Emoji",
      Invites: "Davetler",
      Roles: "Roller",
      DeleteGuild: "Sunucuyu Sil",
      LogOut: "Çıkış Yap",
      WinterMode: "Kış Modu",
      EnableSnowEffect: "Kar yağışını aktifleştir.",
      PartyMode: "Parti Modu",
      EnablePartyMode: "Parti modunu aktifleştir.",
      SlideMode: "Kayma Modu",
      EnableSlideMode: "Kayma modunu aktifleştir.",
      EnableNotifications: "Bildirimleri etkinleştir.",
      ActivityPresence: "Etkinlik Durumu",
      ActivityStatus: "Etkinlik Durumu",
      ShareActivityWhenActive: "Aktif olduğunuzda etkinliği paylaş",
      AutoShareActivityParticipation:
        "LiventCord, bir etkinliğe katıldığınızda bu durumu otomatik olarak paylaşır.",
      Overview: "Genel Bakış",
      GuildName: "Sunucu Adı",
      Remove: "Kaldır",
      Username: "Kullanıcı Adı",
      Email: "E-posta",
      GeneralOverview: "Genel Bakış",
      Emoji: "Emoji",
      Invites: "Davetler",
      Roles: "Roller",
      DeleteGuild: "Sunucuyu Sil",
      SoundAndVideoSettings: "Ses ve Video Ayarları",
      Notifications: "Bildirimler",
      ActivityStatus: "Etkinlik Durumu",
      Appearance: "Görünüm",
      Language: "Dil",
      ServerOverview: "Sunucu Genel Bakış",
      DeleteServer: "Sunucu Silme",
      DeleteServerButton: "Sunucuyu Sil",
      unsavedChangesWarning: "Dikkat — kaydetmediğin değişiklikler var!",
      resetButton: "Sıfırla",
      saveChanges: "Değişiklikleri Kaydet",
    },
  };

  templateTranslations = {
    message_placeholder: {
      en: "Send a message to channel #{{channelName}}",
      tr: "#{{channelName}} kanalına mesaj gönder",
    },
    dm_placeholder: {
      en: "Send message to user @{{friendNick}}",
      tr: "@{{friendNick}} kullanıcısına mesaj gönder",
    },
    guid_name_placeholder: {
      en: "Guild of {{userNick}}",
      tr: "{{userNick}} kullanıcısının sunucusu",
    },
    delete_guild_text: {
      en: "Delete guild {{guildName}}",
      tr: "{{guildName}} sunucusunu sil",
    },
    invites_guild_text: {
      en: "Invite your friends to guild {{guildName}}",
      tr: "Arkadaşlarını {{guildName}} sunucusuna davet et",
    },
    dm_start_text: {
      en: "This is the beginning of the direct message history with {{friendNick}}.",
      tr: "Bu {{friendNick}} kullanıcısıyla olan direkt mesaj geçmişinin başlangıcıdır.",
    },
    birth_of_channel: {
      en: "Birth of channel {{channelName}}!",
      tr: "{{channelName}} kanalının doğuşu!",
    },
    welcome_channel: {
      en: "Welcome to channel {{channelName}}!",
      tr: "{{channelName}} kanalına hoşgeldin!",
    },
    replying_to: {
      en: "Replying to {{userName}}",
      tr: "{{replyId}} kişisine yanıt veriliyor",
    },
  };

  replacePlaceholder(templateKey, replacements, truncation = {}) {
    const languageData = this.templateTranslations[templateKey];
    if (!languageData) {
      console.log(`No template found for key: ${templateKey}`);
      return "";
    }
    const text = languageData[this.currentLanguage];
    if (!text) {
      console.log(
        `No translation found for key: ${templateKey} in language: ${this.currentLanguage}`,
      );
      return "";
    }
    const result = Object.keys(replacements).reduce((result, key) => {
      //console.log(`Processing placeholder: {{${key}}}, Replacement Value:`, replacements[key]);
      const value = truncation[key]
        ? truncateString(replacements[key], truncation[key])
        : replacements[key];
      if (truncation[key]) {
        //console.log(`Truncated Value for {{${key}}}:`, value);
      }
      return result.replace(`{{${key}}}`, value);
    }, text);

    return result;
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
      { channelName: 30 },
    );
  }

  generateGuildName(currentUserNick) {
    return this.replacePlaceholder(
      "guid_name_placeholder",
      { userNick: currentUserNick },
      { userNick: 15 },
    );
  }

  getDmPlaceHolder(friendNick) {
    return this.replacePlaceholder(
      "dm_placeholder",
      { friendNick },
      { friendNick: 15 },
    );
  }

  getDmStartText(friendNick) {
    return this.replacePlaceholder(
      "dm_start_text",
      { friendNick },
      { friendNick: 15 },
    );
  }
  getBirthChannel(channelName) {
    return this.replacePlaceholder(
      "birth_of_channel",
      { channelName },
      { channelName: 15 },
    );
  }
  getWelcomeChannel(channelName) {
    return this.replacePlaceholder(
      "welcome_channel",
      { channelName },
      { channelName: 15 },
    );
  }
  getReplyingTo(userName) {
    return this.replacePlaceholder("replying_to", { userName });
  }

  initializeTranslations() {
    const currentTranslations = this.translations[this.currentLanguage];

    if (!currentTranslations) {
      console.error(
        `No translations found for language: ${this.currentLanguage}`,
      );
      return;
    }

    Object.keys(currentTranslations).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        const textToUse = currentTranslations[key];
        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
          element.placeholder = textToUse;
        } else {
          if (element.className == "iconWrapper") {
            element.ariaLabel = textToUse;
          } else {
            //console.log("Set text for: ",key, " as: ",textToUse)
            element.textContent = textToUse;
          }
        }
      }
    });
  }

  getTranslation(key,list=this.translations) {
    const result = list[this.currentLanguage]?.[key] ?? null;
    if (key && !result) {
      console.error("Cant find translation for:", key);
    }
    return result;
  }
  getSettingsTranslation(key) {
    return this.getTranslation(key,this.settingTranslations);
  }

  

  async loadTranslations(language) {
    try {
      const errorTranslationsResponse = await fetch(`/translations/errorTranslations_${language}.json`);
      const errorTranslations = await errorTranslationsResponse.json();
  
      const placeholderTranslationsResponse = await fetch(`/translations/placeholderTranslations_${language}.json`);
      const placeholderTranslations = await placeholderTranslationsResponse.json();
  
      const contextTranslationsResponse = await fetch(`/translations/contextTranslations_${language}.json`);
      const contextTranslations = await contextTranslationsResponse.json();
  
      this.errorTranslations = errorTranslations;
      this.placeholderFriendTranslations = placeholderTranslations;
      this.contextTranslations = contextTranslations;
    } catch (error) {
      console.error("Error loading translations:", error);
      this.errorTranslations = {};
      this.placeholderFriendTranslations = {};
      this.contextTranslations = {};
    }
  }

  getContextTranslation(key) {
    const translation = this.contextTranslations[key];
  
    if (!translation) {
      console.error("Cannot find translation for:", key);
    }
  
    return translation || key;
  }
  


  getErrorMessage(key) {
    const result = this.errorTranslations[this.currentLanguage][key];
    if (key && !result) {
      console.error("Cant find translation for:", key);
    }
    return result;
  }

  getLocale() {
    return this.currentLanguage === "en" ? this.enLocale : this.trLocale;
  }

  setLanguage(language) {
    console.log(`Selected Language: ${language}`);
    this.currentLanguage = language;
    this.loadTranslations(language);
    this.initializeTranslations();
  }
}

export const translations = new Translations();

translations.setLanguage("en");

setTimeout(() => {
  translations.initializeTranslations();
});

