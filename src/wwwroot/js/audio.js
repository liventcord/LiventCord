
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
const bufferSize = 4096;

let currentAudioPlayer;
let isAudioPlaying = false; 
let analyser = null; 
let source = null; 
let isAnalyzing = false; 
let youtubeIds = ["hOYzB3Qa9DE","UgSHUZvs8jg"] 
let youtubeIndex = 0;


let isInitializedAudio;




document.addEventListener("DOMContentLoaded", function () {
    microphoneButton = getId("microphone-button");
    earphoneButton = getId("earphone-button");

    //initializeMp3Yt();

});

async function playAudio(audioUrl) {
    try {
        if (currentAudioPlayer) {
            currentAudioPlayer.pause();
            currentAudioPlayer.remove();
        }

        const audioElement = new Audio(audioUrl);
        audioElement.crossOrigin = "anonymous";
        currentAudioPlayer = audioElement;

        const playButton = document.querySelector("#player01 .play");
        playButton.addEventListener("click", () => {
            if (isAudioPlaying) {
                audioElement.pause();
                playButton.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 5v20l15-10L10 5z" fill="black"/></svg>`; // Play icon
            } else {
                audioElement.play();
                playButton.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 5h10v20H5V5zm10 0h10v20H15V5z" fill="black"/></svg>`; // Pause icon
            }
            isAudioPlaying = !isAudioPlaying;
        });

        const nextButton = document.querySelector("#player01 .next");
        nextButton.addEventListener("click", async () => {
            if (youtubeIndex < youtubeIds.length - 1) {
                youtubeIndex++;
                const nextYtId = youtubeIds[youtubeIndex];
                const audioStreamUrl = await fetchAudioStreamUrl(nextYtId);
                if (audioStreamUrl) {
                    playAudio(audioStreamUrl);
                } else {
                    console.error("Failed to retrieve audio stream URL for next track.");
                }
            }
        });

        const prevButton = document.querySelector("#player01 .prev");
        prevButton.addEventListener("click", async () => {
            if (youtubeIndex > 0) {
                youtubeIndex--;
                const prevYtId = youtubeIds[youtubeIndex];
                const audioStreamUrl = await fetchAudioStreamUrl(prevYtId);
                if (audioStreamUrl) {
                    playAudio(audioStreamUrl);
                } else {
                    console.error("Failed to retrieve audio stream URL for previous track.");
                }
            }
        });

        audioElement.addEventListener("timeupdate", () => {
            const totalTime = document.querySelector("#player01 .total-time");
            const lastTime = document.querySelector("#player01 .last-time");
            totalTime.innerText = formatTime(audioElement.duration);
            lastTime.innerText = formatTime(audioElement.currentTime);
            
            const track = document.querySelector("#player01 .track");
            track.style.width = `${(audioElement.currentTime / audioElement.duration) * 100}%`;
        });

        const track = document.querySelector("#player01 .track");
        track.addEventListener("click", (e) => {
            const rect = track.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width; 
            const clickRatio = x / width;
            audioElement.currentTime = clickRatio * audioElement.duration;
        });

        audioElement.addEventListener("ended", function () {
            isAudioPlaying = false;
            const playButton = document.querySelector("#player01 .play");
            playButton.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 5v20l15-10L10 5z" fill="black"/></svg>`; // Play icon
        });

        await audioElement.play();
    } catch (error) {
        console.error("Error playing audio:", error);
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" + secs : secs}`;
}


function initializeMp3Yt() {
    const modal = createEl("div", { className: "modal" });
    document.body.appendChild(modal);

    const handleClick = async function () {
        if (isAudioPlaying || isInitializedAudio) {
            return; 
        }

        const ytId = youtubeIds[youtubeIndex];
        document.removeEventListener("click", handleClick);
        modal.remove(); 

        isAudioPlaying = true;
        isInitializedAudio = true;

        const audioStreamUrl = await fetchAudioStreamUrl(ytId);
        if (audioStreamUrl) {
            playAudio(audioStreamUrl);
        } else {
            console.error("Failed to retrieve audio stream URL.");
        }
    };

    document.addEventListener("click", handleClick);
}
async function fetchAudioStreamUrl(videoId) {
    try {
        const response = await fetch(`https://localhost:5009/ytstream/?videoId=${encodeURIComponent(videoId)}`);
        
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        return response.url;
    } catch (error) {
        console.error("Error fetching audio stream URL:", error);
        return null;
    }
}







function enableBorderMovement() {
    if (isAudioPlaying && currentAudioPlayer) {
        if (!isAnalyzing) {
            startAudioAnalysis(); 
        }
    }
}



function stopAudioAnalysis() {
    if (!isAnalyzing) return;

    isAnalyzing = false;

    let selfProfileDisplayElementList = getSelfFromUserList();
    if(selfProfileDisplayElementList) {
        selfProfileDisplayElementList.style.borderRadius = "50%";
        
    }
    


    const profileDisplayElement = getId("profile-display");

    
    resetWiggleEffect(profileDisplayElement, selfProfileImage,selfProfileDisplayElementList);
}

function startAudioAnalysis() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    if (!(currentAudioPlayer instanceof HTMLMediaElement)) {
        console.error("currentAudioPlayer is not a valid HTMLMediaElement.");
        return;
    }

    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(currentAudioPlayer);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    isAnalyzing = true;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let recentVolumes = [];
    const bufferSize = 10;

    analyzeAudio(bufferSize, dataArray, recentVolumes); 
}
function getSelfFromUserList() {
    const userProfiles = userList.querySelectorAll(".profile-container");
    if (!userList || !userProfiles.length) return null; 
    for (const profile of userProfiles) {
        if (profile.id === currentUserId) {
            return profile.querySelector(".profile-pic");
        }
    }
    return null; // Return null if no profile found
}
function analyzeAudio(bufferSize, dataArray, recentVolumes) {
    if (!isAnalyzing || !analyser) return; 

    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }

    const averageVolume = sum / dataArray.length;

    recentVolumes.push(averageVolume);
    if (recentVolumes.length > bufferSize) {
        recentVolumes.shift();
    }

    const dynamicThreshold = recentVolumes.reduce((acc, val) => acc + val, 0) / recentVolumes.length;

    const scaleFactor = 1 + (averageVolume / 128); 
    const borderColor = `rgb(${Math.min(255, averageVolume * 2)}, 0, ${Math.max(0, 255 - averageVolume * 2)})`;

    const profileDisplayElement = getId("profile-display");


    if (averageVolume > dynamicThreshold) {
        if (profileDisplayElement) {
            profileDisplayElement.classList.add("dancing-border");
            profileDisplayElement.style.transform = `scale(${scaleFactor})`;
            profileDisplayElement.style.borderColor = borderColor;
        }
        if (selfProfileImage) {
            selfProfileImage.classList.add("dancing-border");
            selfProfileImage.style.transform = `scale(${scaleFactor})`;
            selfProfileImage.style.borderColor = borderColor;
        }

        const selfUserListProfileList = getSelfFromUserList()
        if(selfUserListProfileList) {
            selfUserListProfileList.classList.add("dancing-border");
            selfUserListProfileList.style.transform = `scale(${scaleFactor})`;
            selfUserListProfileList.style.borderColor = borderColor;
        }
    } else {
        resetStyles(profileDisplayElement, selfProfileImage);
    }

    requestAnimationFrame(() => analyzeAudio(bufferSize, dataArray, recentVolumes));
}

function resetStyles(profileDisplayElement, selfProfileImage) {
    if (profileDisplayElement) {
        profileDisplayElement.classList.remove("dancing-border");
        profileDisplayElement.style.transform = `scale(1)`;
        profileDisplayElement.style.borderColor = "rgb(17, 18, 20)";
    }
    if (selfProfileImage) {
        selfProfileImage.classList.remove("dancing-border");
        selfProfileImage.style.transform = `scale(1)`;
        selfProfileImage.style.borderColor = "rgb(17, 18, 20)";
    }
    const selfUserListProfileList = getSelfFromUserList();
    if(selfUserListProfileList) {
        selfUserListProfileList.classList.remove("dancing-border");
        selfUserListProfileList.style.transform = `scale(1)`;
        selfUserListProfileList.style.borderColor = "rgb(17, 18, 20)";
    }
}

function stopCurrentMusic() {
    if (currentAudioPlayer) {
        currentAudioPlayer.pause(); 
        currentAudioPlayer.currentTime = 0; 
        isAudioPlaying = false; 
        
        resetProfileBorders(); 

        if (source) {
            source.disconnect();
            source = null;
        }
        if (analyser) {
            analyser.disconnect();
            analyser = null; 
        }

        isAnalyzing = false;
    }
}

function resetProfileBorders() {
    const profileDisplayElement = getId("profile-display");


    const selfProfileDisplayElementList = getSelfFromUserList();
    if(selfProfileDisplayElementList) {
        selfProfileDisplayElementList.style.borderRadius = "50%";
        selfProfileDisplayElementList.style.borderColor = "";
        selfProfileDisplayElementList.style.transform = "";
    }

    if (profileDisplayElement) {
        profileDisplayElement.style.borderRadius = "50%";
        profileDisplayElement.style.borderColor = "";
        profileDisplayElement.style.transform = "";
    }
    if (selfProfileImage) {
        selfProfileImage.style.borderRadius = "50%";
        selfProfileImage.style.borderColor = "";
        selfProfileImage.style.transform = "";
    }
}




function activateSoundOutput() {
    async function requestSoundOutputPermissions() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
            return true; 
        } catch (error) {
            return false;
        }
    }

    function getSoundOutputList() {
        return navigator.mediaDevices.enumerateDevices()
            .then(devices => devices.filter(device => device.kind === "audiooutput"));
    }

    async function updateSoundOutputOptions() {
        const dropdown = getId("sound-output-dropdown");
        dropdown.innerHTML = ""; 

        try {
            const hasPermission = await requestSoundOutputPermissions();

            if (hasPermission) {
                const soundOutputs = await getSoundOutputList();
                soundOutputs.forEach((output, index) => {
                    const option = createEl("option");
                    option.style.fontSize = "12px";
                    option.style.border = "none";
                    option.value = output.deviceId;
                    option.textContent = output.label || `Sound Output ${index + 1}`;
                    dropdown.appendChild(option);
                });
            }

            const defaultOption = createEl("option");
            defaultOption.style.fontSize = "12px";
            defaultOption.value = "default";
            defaultOption.textContent = "Default Sound Output";
            dropdown.appendChild(defaultOption);

        } catch (error) {
            console.error("Error updating sound output options:", error);

            const defaultOption = createEl("option");
            defaultOption.style.fontSize = "12px";
            defaultOption.value = "default";
            defaultOption.textContent = "Default Sound Output";
            dropdown.appendChild(defaultOption);
        }
    }

    updateSoundOutputOptions();
    navigator.mediaDevices.addEventListener("devicechange", updateSoundOutputOptions);
}



  

let isMicrophoneOpen = true;
function setMicrophone() {
    let imagePath = isMicrophoneOpen ? `/images/icons/whitemic.png` : `/images/icons/redmic.png`;
    microphoneButton.src = imagePath;
    isMicrophoneOpen = !isMicrophoneOpen;
    console.log("Set microphone! to " , isMicrophoneOpen);
}

let isEarphonesOpen = true;
function setEarphones() {
    let imagePath = isEarphonesOpen ? `/images/icons/whiteearphones.png` : `/images/icons/redearphones.png`;
    earphoneButton.src = imagePath;
    isEarphonesOpen = !isEarphonesOpen;
    console.log("Set earphones! to " , isEarphonesOpen);
}



async function activateMicAndSoundOutput() {
    activateMicAndCamera();
    activateSoundOutput();
}
async function sendAudioData() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = async (e) => {

        };
        mediaRecorder.start();

    } catch (err) {
        console.error("Error accessing microphone:", err);
    }
}

function activateMicAndCamera() {
    async function requestMediaPermissions() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            return true; 
        } catch (error) {
            return false;
        }
    }

    function getMediaDevicesList() {
        return navigator.mediaDevices.enumerateDevices()
            .then(devices => devices.filter(device => device.kind === "audioinput" || device.kind === "videoinput"));
    }
    async function updateMediaOptions() {
        const micDropdown = getId("sound-mic-dropdown");
        micDropdown.innerHTML = "";
        const cameraDropdown = getId("camera-dropdown");
        cameraDropdown.innerHTML = ""; 
        try {
            const hasPermission = await requestMediaPermissions();

            if (hasPermission) {
                const mediaDevices = await getMediaDevicesList();
                mediaDevices.forEach((device, index) => {
                    const option = createEl("option",{fontSize:"12px",border:"none"});

                    option.value = device.deviceId;
                    if (device.kind === "audioinput") {
                        option.textContent = device.label || `Microphone ${index + 1}`;
                        micDropdown.appendChild(option);
                    } else if (device.kind === "videoinput") {
                        option.textContent = device.label || `Camera ${index + 1}`;
                        cameraDropdown.appendChild(option);
                    }
                });
            }

            const defaultMicOption = createEl("option",{fontSize:"12px",value:"default"});
            defaultMicOption.textContent = "Default Microphone";
            micDropdown.appendChild(defaultMicOption);

            const defaultCameraOption = createEl("option",{fontSize:"12px",value:"default"});
            defaultCameraOption.textContent = "Default Camera";
            cameraDropdown.appendChild(defaultCameraOption);

        } catch (error) {
            console.error("Error updating media options:", error);

            const defaultMicOption = createEl("option",{fontSize:"12px",value:"default"});
            defaultMicOption.textContent = "Default Microphone";
            micDropdown.appendChild(defaultMicOption);

            const defaultCameraOption = createEl("option",{fontSize:"12px",value:"default"});
            defaultCameraOption.textContent = "Default Camera";
            cameraDropdown.appendChild(defaultCameraOption);
        }
    }

    updateMediaOptions();
    if(navigator && navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener("devicechange", updateMediaOptions);
    }
}



function closeCurrentCall() {
    currentAudioPlayer = getId("audio-player");
    playAudio("/sounds/leavevoice.mp3");

    const sp = getId("sound-panel");
    const oldVoiceId = currentVoiceChannelId;
    sp.style.display = "none";
    clearVoiceChannel(oldVoiceId);
    currentVoiceChannelId = "";
    currentVoiceChannelGuild = "";
    const buttonContainer = channelsUl.querySelector(`li[id="${oldVoiceId}"]`);

    mouseLeaveChannelButton(buttonContainer, false,oldVoiceId);
    usersInVoice[oldVoiceId] = [];

    const data = {
        "guildId" : currentVoiceChannelGuild,
        "channelId" : currentVoiceChannelId
    }
    apiClient.send(EventType.LEAVE_VOICE_CHANNEL,data)
}
function clearVoiceChannel(channelId) {
    const channelButton = channelsUl.querySelector(`li[id="${channelId}"]`);
    if(!channelButton) {return; }
    const buttons = channelButton.querySelectorAll(".channel-button");
    buttons.forEach((btn,index) => {
        btn.remove();
    });
    let channelUsersContainer = channelButton.querySelector(".channel-users-container");
    if(channelUsersContainer) {
        channelUsersContainer.remove();
    }
    let existingContentWrapper = channelButton.querySelector(".content-wrapper");
    console.log(existingContentWrapper.style.marginRight);
    existingContentWrapper.style.marginRight = "100px";
}


let cachedAudioNotify = null;

function playNotification() {
    try {
        if (!cachedAudioNotify) {
            cachedAudioNotify = new Audio("https://raw.githubusercontent.com/liventcord/LiventCord/main/notification.mp3");
        }
        cachedAudioNotify.play();
    } catch (error) {
        console.log(error);
    }
}


function initializeMusic() {
    const modal = createEl("div", { className: "modal"});
    document.body.appendChild(modal);

    const songs = [
        "/sounds/musics/2.mp3",
        "/sounds/musics/1.mp3",
        "/sounds/musics/3.mp3",
        "/sounds/musics/4.mp3"
    ];

    let currentSongIndex = 0;

    function playCurrentSong() {
        const currentSong = songs[currentSongIndex];
        
        playAudio(currentSong); 
        
        const audio = new Audio(currentSong);
        audio.onended = function () {
            currentSongIndex++;
            if (currentSongIndex >= songs.length) {
                currentSongIndex = 0;
            }

            playCurrentSong(); 
        };
    }

    modal.addEventListener("click", function () {
        playCurrentSong();
        modal.style.display = "none"; 
    });
}



function convertToArrayBuffer(data) {
    if (data instanceof ArrayBuffer) {
        return data;
    } else if (data.buffer instanceof ArrayBuffer) {
        return data.buffer;
    } else {
        throw new Error("Unsupported data format");
    }
}

function decodeAudioDataAsync(arrayBuffer) {
    try {

    }
    catch(error) {
        return new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, resolve, reject);
        });

    }
}

function playAudioBuffer(audioBuffer) {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
}




function applyWiggleEffect(profileElement, selfProfileElement) {
    if(profileElement) {
        profileElement.classList.add("dancing-border");
    }
    if(selfProfileElement) {
        selfProfileElement.classList.add("dancing-border");
    }
    setTimeout(() => {
        if(profileElement) {
            profileElement.classList.remove("dancing-border");
        }
        if(selfProfileElement) {
            selfProfileElement.classList.remove("dancing-border");
        }
    }, 500); 
}

function resetWiggleEffect(...elements) {
    elements.forEach(element => {
        if (element) {
            element.style.transition = "none";
            element.style.borderRadius = "0%"; 
            setTimeout(() => {
                element.style.transition = "border-radius 0.1s"; 
            }, 0);
        }
    });
}