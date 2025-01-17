let lastConfirmedProfileImg;
let lastConfirmedGuildImg;

async function setPicture(imgToUpdate, srcId, isProfile, isTimestamp) {
    if (!srcId) {
        imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage;
        return;
    }
    if (!imgToUpdate) return;

    if (srcId == CLYDE_ID) {
        imgToUpdate.src = clydeSrc;
        return;
    }

    const timestamp = new Date().getTime();
    const imageUrl = !isProfile 
        ? `/guilds/${srcId}.png${isTimestamp ? `?ts=${timestamp}` : ""}` 
        : `${getProfileUrl(srcId)}${isTimestamp ? `?ts=${timestamp}` : ""}`;

    srcId = String(srcId);

    if (isProfile) {
        if (failedProfiles.has(srcId)) {
            imgToUpdate.src = defaultProfileImageUrl;
            return;
        }
    } else {
        if (failedGuilds.has(srcId)) {
            imgToUpdate.src = blackImage
            return;
        }
    }

    const cachedBase64 = isProfile ? profileCache[srcId] : guildImageCache[srcId];
    if (cachedBase64 && cachedBase64 !== base64Of404) {
        imgToUpdate.src = cachedBase64;
        return;
    }

    if (requestInProgress[srcId]) {
        try {
            const base64data = await requestInProgress[srcId];
            imgToUpdate.src = base64data || (isProfile ? defaultProfileImageUrl : blackImage);
        } catch {
            imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage
        }
        return;
    }

    requestInProgress[srcId] = (async () => {
        try {
            const response = await fetch(imageUrl);
            if (response.status === 404) {
                imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage
                isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
                return null;
            }

            const blob = await response.blob();
            const base64data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = function () {
                    const data = reader.result;
                    if (data !== base64Of404) {
                        (isProfile ? profileCache : guildImageCache)[srcId] = data;
                        resolve(data);
                    } else {
                        (isProfile ? profileCache : guildImageCache)[srcId] = base64Of404;
                        reject(new Error("Image is 404"));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            return base64data;
        } catch (error) {
            imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage
            isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
            return null;
        } finally {
            delete requestInProgress[srcId];
        }
    })();

    try {
        const base64data = await requestInProgress[srcId];
        imgToUpdate.src = base64data || (isProfile ? defaultProfileImageUrl : blackImage);
    } catch {
        imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage
    }

    imgToUpdate.addEventListener("error", function () {
        imgToUpdate.src = isProfile ? defaultProfileImageUrl : blackImage
        isProfile ? failedProfiles.add(srcId) : failedGuilds.add(srcId);
    });
}

function refreshUserProfile(userId,userNick=null) {
    if (userId == currentUserId) {
        updateSelfProfile(userId,null,true,true);
    }
    // from user list
    const profilesList = userList.querySelectorAll(".profile-pic");
    profilesList.forEach(user => {
        if(userNick) {
            if (user.id === userId) {
                user.parentNode.querySelector(".profileName").innerText = userNick;
            }
        }
        if(userId) {
            if (user.id === userId) {
                user.src = `/profiles/${userId}.png`;
            }
        }
    });

    // from chat container 
    const usersList = chatContainer.querySelectorAll(".profile-pic");
    usersList.forEach(user => {
        if(userNick) {
            if (user.dataset.userId === userId) {
                user.parentNode.querySelector(".profileName").innerText = userNick;
            }
        }
        if(userId) {
            if (user.dataset.userId === userId) {
                user.src = `/profiles/${userId}.png`;
            }
        }
    });
}


function validateImage(file) {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/gif", "image/png", "image/webp", "image/bmp", "image/tiff", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
        alertUser(translations.getTranslation("upload-error-message"));
        return false;
    }
    if (file.size > 8 * 1024 * 1024) {
        alertUser(translations.getTranslation("upload-size-error-message"));
        return false;
    }
    return true;
}

function resetImageInput(inputId, imgId) {
    getId(inputId).value = "";
    getId(imgId).style.backgroundImage = "";
}

function updateImageSource(imageElement, imagePath) {
    imageElement.onerror = () => {
        if (imageElement.src !== defaultProfileImageUrl) {
            imageElement.src = defaultProfileImageUrl;
        }
    };
    imageElement.onload = updateSettingsProfileColor;
    imageElement.src = imagePath;
}



function updateSelfProfile(userId, userName, isTimestamp = false, isAfterUploading = false) {
    if (!userId) return;
    const timestamp = isTimestamp ? `?ts=${new Date().getTime()}` : '';
    const selfimagepath = `/profiles/${userId}.png${timestamp}`;
    const selfProfileImage = getId("self-profile-image");

    updateImageSource(selfProfileImage, selfimagepath);

    if (isSettingsOpen && currentSettingsType === settingTypes.MyAccount) {
        const settingsSelfNameElement = getId("settings-self-name");
        const selfNameElement = getId("self-name");
        const settingsSelfProfile = getId("settings-self-profile");

        if (userName) {
            settingsSelfNameElement.innerText = userName;
            selfNameElement.innerText = userName;
        }

        updateImageSource(settingsSelfProfile, selfimagepath);

        if (isAfterUploading) {
            const base64output = getBase64Image(settingsSelfProfile);
            if (base64output) {
                console.log("Setting self profile as ", userId, userName);
                lastConfirmedProfileImg = base64output;
            }
        }
    }
}

function uploadImage(isGuild) {
    if (!isChangedProfile) return;
    
    let formData = new FormData();
    const uploadedGuildId = currentGuildId;
    const file = isGuild ? getId("guild-image").src : getId("settings-self-profile").src;

    if (file && file.startsWith("data:image/")) {
        const byteString = atob(file.split(",")[1]);
        const mimeString = file.split(",")[0].split(":")[1].split(";")[0];
        const ab = new Uint8Array(byteString.length);

        for (let i = 0; i < byteString.length; i++) {
            ab[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([ab], { type: mimeString });

        if (blob.size <= 8 * 1024 * 1024) {
            formData.append("photo", blob, "profile-image.png");

            if (isGuild) {
                formData.append("guildId", uploadedGuildId);
            }

            console.log("Sending req...");
            let xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/images");
            xhr.onload = function () {
                if (xhr.status === 200) {
                    if (isGuild) {
                        updateGuild(uploadedGuildId);
                        lastConfirmedGuildImg = file;
                    } else {
                        updateSelfProfile(currentUserId, null, true);
                        lastConfirmedProfileImg = file;
                    }
                } else {
                    console.error("Error uploading profile pic!");
                }
            };
            xhr.onerror = function () {
                if (isGuild) {
                    getId("guild-image").src = lastConfirmedGuildImg;
                } else {
                    getId("settings-self-profile").src = lastConfirmedProfileImg;
                }
            };
            xhr.send(formData);
        } else {
            alertUser("Dosya boyutu 8 MB\"den büyük olamaz!");
            getId("profileImage").value = "";
        }
    } else {
        console.error("Invalid file format or undefined file.");
    }
}

function onEditImage(isGuild) {
    const filedata = getId(isGuild ? "guildImage" : "profileImage").files[0];
    if (!filedata) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        function callbackAfterAccept(outputBase64) {
            if (isGuild) {
                lastConfirmedGuildImg = getBase64Image(getId("guild-image"));
            } else {
                lastConfirmedProfileImg = getBase64Image(getId("settings-self-profile"));
            }

            getId(isGuild ? "guild-image" : "settings-self-profile").src = outputBase64;
            isChangedProfile = true;

            if (!currentPopUp) {
                let _currentPopUp = generateConfirmationPanel();
                currentPopUp = _currentPopUp;
            }

            showConfirmationPanel(currentPopUp);
        }
        createCropPop(e.target.result, callbackAfterAccept);
    };
    reader.onerror = (error) => {
        console.error("Error reading file:", error);
    };
    reader.readAsDataURL(filedata);
    getId(isGuild ? "guildImage" : "profileImage").value = "";

    isUnsaved = true;
}

function onEditProfile() {
    onEditImage(false);
}

function onEditGuildProfile() {
    onEditImage(true);
}
