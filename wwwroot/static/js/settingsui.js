


const settingTranslations = {
    en: {
        "en": "English",
        "tr": "Turkish",
        "MyAccount": "My Account",
        "SoundAndVideo": "Sound and Video",
        "Notifications": "Notifications",
        "ActivityPresence": "Activity Privacy",
        "Appearance": "Appearance",
        "Language": "Language",
        "Overview": "Overview",
        "Emoji": "Emoji",
        "Invites": "Invites",
        "Roles": "Roles",
        "DeleteGuild": "Delete Guild",
        "LogOut": "Log Out",
        "WinterMode": "Winter Mode",
        "EnableSnowEffect": "Enable snow effect.",
        "PartyMode": "Party Mode",
        "EnablePartyMode": "Enable party mode.",
        "SlideMode": "Slide Mode",
        "EnableSlideMode": "Enable slide mode.",
        "EnableNotifications": "Enable notifications.",
        "ActivityPresence": "Activity Presence",
        "ActivityStatus": "Activity Status",
        "ShareActivityWhenActive": "Share activity when you're active",
        "AutoShareActivityParticipation": "LiventCord automatically shares your participation in activities.",
        "Overview": "Overview",
        "GuildName": "Guild Name",
        "Remove": "Remove",
        "Username": "Username",
        "Email": "Email",
        "GeneralOverview": "General Overview",
        "Emoji": "Emoji",
        "Invites": "Invites",
        "Roles": "Roles",
        "DeleteGuild": "Delete Guild",
        "SoundAndVideoSettings": "Sound and Video Settings",
        "Notifications": "Notifications",
        "ActivityStatus": "Activity Status",
        "Appearance": "Appearance",
        "Language": "Language",
        "ServerOverview": "Server Overview",
        "DeleteServer": "Delete Server",
        "DeleteServerButton": "Delete Server",
        "unsavedChangesWarning": "Warning — you have unsaved changes!",
        "resetButton": "Reset",
        "saveChanges": "Save Changes"
        
    },
    tr: {
        "en": "İngilizce",
        "tr": "Türkçe",
        "MyAccount": "Hesabım",
        "SoundAndVideo": "Ses ve Görüntü",
        "Notifications": "Bildirimler",
        "ActivityPresence": "Etkinlik Gizliliği",
        "Appearance": "Görünüm",
        "Language": "Dil",
        "Overview": "Genel Görünüm",
        "Emoji": "Emoji",
        "Invites": "Davetler",
        "Roles": "Roller",
        "DeleteGuild": "Sunucuyu Sil",
        "LogOut": "Çıkış Yap",
        "WinterMode": "Kış Modu",
        "EnableSnowEffect": "Kar yağışını aktifleştir.",
        "PartyMode": "Parti Modu",
        "EnablePartyMode": "Parti modunu aktifleştir.",
        "SlideMode": "Kayma Modu",
        "EnableSlideMode": "Kayma modunu aktifleştir.",
        "EnableNotifications": "Bildirimleri etkinleştir.",
        "ActivityPresence": "Etkinlik Durumu",
        "ActivityStatus": "Etkinlik Durumu",
        "ShareActivityWhenActive": "Aktif olduğunuzda etkinliği paylaş",
        "AutoShareActivityParticipation": "LiventCord, bir etkinliğe katıldığınızda bu durumu otomatik olarak paylaşır.",
        "Overview": "Genel Bakış",
        "GuildName": "Sunucu Adı",
        "Remove": "Kaldır",
        "Username": "Kullanıcı Adı",
        "Email": "E-posta",
        "GeneralOverview": "Genel Bakış",
        "Emoji": "Emoji",
        "Invites": "Davetler",
        "Roles": "Roller",
        "DeleteGuild": "Sunucuyu Sil",
        "SoundAndVideoSettings": "Ses ve Video Ayarları",
        "Notifications": "Bildirimler",
        "ActivityStatus": "Etkinlik Durumu",
        "Appearance": "Görünüm",
        "Language": "Dil",
        "ServerOverview": "Sunucu Genel Bakış",
        "DeleteServer": "Sunucu Silme",
        "DeleteServerButton": "Sunucuyu Sil",
        "unsavedChangesWarning": "Dikkat — kaydetmediğin değişiklikler var!",
        "resetButton": "Sıfırla",
        "saveChanges": "Değişiklikleri Kaydet"
    }
};
const userSettings = [
    { category: "MyAccount", label: t("MyAccount") },
    { category: "SoundAndVideo", label: t("SoundAndVideo") },
    { category: "Notifications", label: t("Notifications") },
    { category: "ActivityPresence", label: t("ActivityPresence") },
    { category: "Appearance", label: t("Appearance") },
    { category: "Language", label: t("Language") }
];

const guildSettings = [
    { category: "Overview", label: t("GeneralOverview") },
    { category: "Emoji", label: t("Emoji") },
];
function t(key) {
    const translation = settingTranslations[translations.currentLanguage]?.[key] || settingTranslations["en"]?.[key];
    if (!translation) console.error(`Missing translation for key: ${key} in language: ${translations.currentLanguage}`);
    return translation || key;
}


function getGuildSettingsHTML() {
    return generateSettingsHtml(getGuildSettings(), true);
}

function getSettingsHtml() {
    return generateSettingsHtml(userSettings);
}

function getActivityPresenceHtml() {
    return `
        <h3 id="activity-title">${t("ActivityPresence")}</h3>
        <h3 id="settings-description">${t("ActivityStatus")}</h3>
        <div class="toggle-card">
            <label for="activity-toggle">${t("ShareActivityWhenActive")}</label>
            <label for="activity-toggle">${t("AutoShareActivityParticipation")}</label>
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
        <div id="settings-title">${t("Overview")}</div>
        <div id="guild-settings-rightbar">
            <div id="set-info-title-guild-name">${t("GuildName")}</div>
            <input type="text" id="guild-overview-name-input" autocomplete="off" value="${currentGuildName}" onkeydown="onEditNick()" maxlength="32">
            <img id="guild-image" onclick="triggerguildImageUpdate()" style="user-select: none;">
            <p id="guild-image-remove" style="display:none">${t("Remove")}</p>
            <form id="guildImageForm" enctype="multipart/form-data">
                <input type="file" name="guildImage" id="guildImage" accept="image/*" style="display: none;">
            </form>
        </div>
    `;
}

function getMissingHtml(title) {
    return `
        <div id="settings-title">${t("Overview")}</div>
        <div id="guild-settings-rightbar">
            <p style="font-size:20px; color:white; font-weight:bold; margin-top: -150px;">${title}</p>
            <img src="https://liventcord.github.io/LiventCordPages/static/404_files/noodle.gif">
        </div>
    `;
}

function getAccountSettingsHtml() {
    return `
        <div id="settings-rightbartop"></div>
        <div id="settings-title">${t("MyAccount")}</div>
        <div id="settings-rightbar">
            <div id="settings-light-rightbar">
                <div id="set-info-title-nick">${t("Username")}</div>
                <div id="set-info-nick">${currentUserNick}</div>
                <div id="set-info-title-email">${t("Email")}</div>
                <i id="set-info-email-eye" style="cursor:pointer;" class="fas fa-eye toggle-password" onclick="toggleEmail()"> </i>
                <div id="set-info-email">${maskedEmail}</div>
            </div>
            <input type="text" id="new-nickname-input" autocomplete="off" value="${currentUserNick}" onkeydown="onEditNick()" maxlength="32">
            <img id="settings-self-profile" onclick="triggerFileInput()" style="user-select: none;">
            <form id="profileImageForm" enctype="multipart/form-data">
                <input type="file" name="profileImage" id="profileImage" accept="image/*" style="display: none;">
            </form>
            <span id="settings-self-name">${currentUserNick}</span>
        </div>
    `;
}


function getLanguageHtml() {
    return `
        <h3>${t("Language")}</h3>
        <select class="dropdown" id="language-dropdown">
            <option value="en">${t("en")}</option>
            <option value="tr">${t("tr")}</option>
        </select>
    `;
}

function getAppearanceHtml() {
    const toggles = [
        { id: "snow-toggle", label: t("WinterMode"), description: t("EnableSnowEffect") },
        { id: "party-toggle", label: t("PartyMode"), description: t("EnablePartyMode") },
        { id: "slide-toggle", label: t("SlideMode"), description: t("EnableSlideMode") },
    ];

    return `
        <h3>${t("Appearance")}</h3>
        ${toggles.map(toggle => createToggle(toggle.id, toggle.label, toggle.description)).join("")}
    `;
}

function getNotificationsHtml() {
    const toggles = [
        { id: "notify-toggle", label: t("Notifications"), description: t("EnableNotifications") }
    ];
    return `
        <h3>${t("Notifications")}</h3>
        ${toggles.map(toggle => createToggle(toggle.id, toggle.label, toggle.description)).join("")}
    `;
}

function generateSettingsHtml(settings, isGuild = false) {
    const buttons = settings.map(setting => `
        <button class="settings-buttons" onclick="selectSettingCategory("${setting.category}")">${t(setting.category)}</button>
    `).join("\n");

    if (isGuild) {
        return buttons;
    }

    return `
        ${buttons}
        <button class="settings-buttons" onclick="logOutPrompt()">${t("LogOut")}</button>
    `;
}




function getGuildSettings() {
    let setToReturn = [...guildSettings]; 
    if (permissionManager.canManageGuild()) {
        setToReturn.push({ category: "Invites", label: t("Invites") });
        setToReturn.push({ category: "Roles", label: t("Roles") });
        setToReturn.push({ category: "DeleteGuild", label: t("DeleteGuild") });
    }
    return setToReturn; 
}

function getSettingsConfig() {
    return {
        SoundAndVideo: {
            title: t("SoundAndVideoSettings"),
            html: `
                <select class="dropdown"></select>
                <select class="dropdown"></select>
                <select class="dropdown"></select>
            `
        },
        MyAccount: {
            title: t("MyAccount"),
            html: getAccountSettingsHtml()
        },
        Notifications: {
            title: t("Notifications"),
            html: getNotificationsHtml()
        },
        ActivityPresence: {
            title: t("ActivityStatus"),
            html: getActivityPresenceHtml()
        },
        Appearance: {
            title: t("Appearance"),
            html: getAppearanceHtml()
        },
        Language: {
            title: t("Language"),
            html: getLanguageHtml()
        },
        Overview: {
            title: t("ServerOverview"),
            html: getOverviewHtml()
        },
        DeleteGuild: {
            title: t("DeleteServer"),
            html: `<button id="delete-guild-button">${t("DeleteServerButton")}</button>`
        }
    };
}


function selectSettingCategory(settingType) {
    const settingsContainer = getId("settings-rightcontainer");
    currentSettingsType = settingType;

    const settingConfig = getSettingsConfig()[settingType] || { title: "Unknown Setting", html: "<h3>Unknown Setting</h3>" };
    setTimeout(() => {
        if(settingType === "MyAccount") {
            updateSelfProfile(currentUserId,currentUserNick,true);
        }
    }, 100);
    settingsContainer.innerHTML = settingConfig.html;


    function initializeLanguageDropdown() {
        const languageDropdown = document.getElementById("language-dropdown");
        if (languageDropdown) {
            languageDropdown.value = translations.currentLanguage;
            languageDropdown.addEventListener("change", (event) => {
                translations.currentLanguage = event.target.value;
                translations.setLanguage(translations.currentLanguage);
                reconstructSettings(false);
                selectSettingCategory(currentSettingsType)
            });
        }
    }
    initializeLanguageDropdown();
    
    
    const closeButton = getCloseButtonElement();
    closeButton.addEventListener("click",closeSettings);
    settingsContainer.insertBefore(closeButton, settingsContainer.firstChild);

    const togglesToSetup = ["activity-toggle", "snow-toggle", "party-toggle","notify-toggle","slide-toggle"];
    togglesToSetup.forEach(setupToggle);

    if (settingType === "DeleteGuild") {
        const deleteButton = getId("delete-guild-button");
        if (deleteButton) {
            deleteButton.addEventListener("click", () => createDeleteGuildPrompt(currentGuildId, currentGuildName));
        }
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


function openSettings(isNotLoadingDefault = false) {
    if (!isNotLoadingDefault) {
        reconstructSettings(false);
    }
    selectSettingCategory(settingTypes.MyAccount);

    getId("settings-overlay").style.display = "flex";

    if (toggleManager.isSlide()) {
        getId("settings-menu").style.animation = "settings-menu-slide-in 0.3s forwards";
    } else {
        getId("settings-menu").style.animation = "settings-menu-scale-appear 0.3s forwards";
    }


    if (toggleManager.isSlide()) {
        getId("settings-menu").style.animation = "settings-menu-slide-in 0.3s forwards";
    } else {
        getId("settings-menu").style.animation = "settings-menu-scale-appear 0.3s forwards";
    }

    isSettingsOpen = true;
}

function closeSettings() {
    if (isUnsaved) {
        shakeScreen();
        return;
    }

    if (toggleManager.isSlide()) {
        getId("settings-menu").style.animation = "settings-menu-slide-out 0.3s forwards";
    } else {
        getId("settings-menu").style.animation = "settings-menu-scale-disappear 0.3s forwards";
    }

    setTimeout(() => {
        getId("settings-overlay").style.display = "none";
    }, 300);
    isSettingsOpen = false;
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



function reconstructSettings(_isGuildSettings) { //
    const leftBar = getId("settings-leftbar");
    leftBar.innerHTML = "";
    isGuildSettings = _isGuildSettings ;
    if(_isGuildSettings) {
        leftBar.innerHTML = getGuildSettingsHTML();
        selectSettingCategory( Overview );

    } else{ 
        leftBar.innerHTML = getSettingsHtml();
    }

}



function hideConfirmationPanel(pop) {
    pop.style.animation = "slide-down 0.15s ease-in-out forwards";
    setTimeout(() => {
        pop.style.display = "none";
    }, 1500); 
}

function showConfirmationPanel(pop) {
    pop.style.display = "block";
    pop.style.animation = "slide-up 0.5s ease-in-out forwards";
}


function generateConfirmationPanel() {
    const popupDiv = createEl("div",{id:"settings-unsaved-popup"});
  
    const textDiv = createEl("div", {
        id: "settings-unsaved-popup-text",
        textContent: t("unsavedChangesWarning")
    });
    popupDiv.appendChild(textDiv);
  
    const resetButton = createEl("span", {
        id: "settings-unsaved-popup-resetbutton",
        textContent: t("resetButton") 
    });

    resetButton.addEventListener("click",function() {

        hideConfirmationPanel(popupDiv);
        const nickinput = getId("new-nickname-input")
        if(nickinput) {
            nickinput.value = currentUserNick;
        }
        const profileimg = getId("profileImage");
        if(profileimg) {
            profileimg.files = null;
        }
        const settingsSelfProfile = getId("settings-self-profile");

        if(lastConfirmedProfileImg) {
            settingsSelfProfile.src = lastConfirmedProfileImg;
        } else {
            
        }

        const guildNameInput = getId("guild-overview-name-input");
        if(guildNameInput) {
            guildNameInput.value = currentGuildName;
        }

        isUnsaved = false;
        isChangedProfile = false;
        getId("");

    });
    popupDiv.appendChild(resetButton);
  
    const applyButton = createEl("button");
    applyButton.id = "settings-unsaved-popup-applybutton";
    applyButton.textContent = t("saveChanges");
    applyButton.onclick = applySettings;
    popupDiv.appendChild(applyButton);
    getId("settings-menu").appendChild(popupDiv);
  
    return popupDiv;
}
function shakeScreen() {
    const SHAKE_FORCE = 1;

    currentSettingsType = null;
    if (!currentPopUp) { currentPopUp = generateConfirmationPanel(); }
    showConfirmationPanel(currentPopUp);
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

function createDeleteGuildPrompt(guildId,guildName) {
    if(!guildId) { return }
    var onClickHandler = function() {
        apiClient.send(EventType.DELETE_GUILD, guildId);
    }
    const actionText = translations.getDeleteGuildText(guildName)  
    
    askUser(translations.getDeleteGuildText(guildName),translations.getTranslation("delete_guild_text_2"),actionText,onClickHandler,isRed=true);

} 
