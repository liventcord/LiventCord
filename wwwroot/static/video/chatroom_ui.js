var myVideo;

document.addEventListener("DOMContentLoaded", (event) => {
    myVideo = document.getElementById("local_vid");
    myVideo.onloadeddata = () => { 
        console.log("W,H: ", myVideo.videoWidth, ", ", myVideo.videoHeight); 
    };
    var muteBttn = document.getElementById("btton_mute");
    var muteVidBttn = document.getElementById("btton_vid_mute");
    var callEndBttn = document.getElementById("call_end");

    let audioMuted = false;
    let videoMuted = false;
    setAudioMuteState(audioMuted);
    toggleIconClass(muteBttn, audioMuted);

    muteBttn.addEventListener("click", (event)=>{
        audioMuted = !audioMuted;
        setAudioMuteState(audioMuted);
        toggleIconClass(muteBttn, audioMuted);
    });    
    muteVidBttn.addEventListener("click", (event)=>{
        videoMuted = !videoMuted;
        setVideoMuteState(videoMuted);
        toggleIconClass(muteVidBttn, videoMuted);
    });    
    callEndBttn.addEventListener("click", (event)=>{
        document.href = '/';
    });

    function toggleIconClass(button, isMuted) {
        const icon = button.querySelector('.icon');
        if (isMuted) {
            icon.classList.remove('fa-microphone');
            icon.classList.add('fa-microphone-slash');
            icon.classList.add('icon-off'); // Add off state class
        } else {
            icon.classList.remove('fa-microphone-slash');
            icon.classList.add('fa-microphone');
            icon.classList.remove('icon-off'); // Remove off state class
        }
    }

    // Obtain and set local video stream
    startLocalVideoStream();
});

function startLocalVideoStream() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((stream) => {
        console.log("Stream obtained");
        if (myVideo) {
            // Only set srcObject if it's different from the current stream
            if (myVideo.srcObject !== stream) {
                myVideo.srcObject = stream;
            }

            // Add an event listener for the loadedmetadata event to ensure the video is ready to play
            myVideo.onloadedmetadata = () => {
                myVideo.play().catch((error) => {
                    console.error("Error playing video:", error);
                });
            };
        } else {
            console.error("myVideo element not found");
        }
    })
    .catch((error) => {
        console.error("Error obtaining media stream:", error);
    });
}


function makeVideoElementCustom(element_id, display_name) {
    let vid = document.createElement("video");
    vid.id = "vid_" + element_id;
    vid.style.zIndex = 10;
    vid.autoplay = true;
    return vid;
}

function addVideoElement(element_id, display_name) {
    if(element_id == myID) {
        console.warn(element_id,myID);
        return
    };
    document.getElementById("video_grid").appendChild(makeVideoElementCustom(element_id, display_name));
    checkVideoLayout();
}

function removeVideoElement(element_id) {
    let v = getVideoObj(element_id);
    if(!v) {return;}
    if (v.srcObject) {
        v.srcObject.getTracks().forEach(track => track.stop());
    }
    v.removeAttribute("srcObject");
    v.removeAttribute("src");

    document.getElementById("vid_" + element_id).remove();
}

function getVideoObj(element_id) {
    return document.getElementById("vid_" + element_id);
}

function setAudioMuteState(flag) {
    let local_stream = myVideo.srcObject;
    if(local_stream) {
        local_stream.getAudioTracks().forEach((track) => { track.enabled = !flag; });
    }
}

function setVideoMuteState(flag) {
    let local_stream = myVideo.srcObject;
    if(local_stream) {
        local_stream.getVideoTracks().forEach((track) => { track.enabled = !flag; });
    }
}
