
const sleep = ms => new Promise(r => setTimeout(r, ms));
sleep(2000)
var myID;
var _peer_list = {};


var socket = io();
socket.on("disconnect", (reason, details) => {
    console.log('Disconnected from server.', reason);
});

document.addEventListener("DOMContentLoaded", (event)=>{
    startCamera();
});

var camera_allowed=false; 
var mediaConstraints = {
    audio: true,
    video: {
    }
};

function startCamera()
{
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then((stream)=>{
        myVideo.srcObject = stream;
        camera_allowed = true;
        setAudioMuteState(audioMuted);                
        setVideoMuteState(videoMuted);
        //start the socketio connection
        socket.connect();
    })

}

socket.on("connect", ()=>{
    console.log("socket connected....");
    socket.emit("join-room", {"room_id": myRoomID,"name":myName});
});
socket.on("user-connect", (data)=>{
    console.log("user-connect ", data);
    let peer_id = data["sid"];
    let display_name = data["name"];
    _peer_list[peer_id] = undefined; // add new user to user list
    addVideoElement(peer_id, display_name);
});
socket.on("user-disconnect", (data)=>{
    console.log("user-disconnect ", data);
    let peer_id = data["sid"];
    closeConnection(peer_id);
    removeVideoElement(peer_id);
});
socket.on("user-list", (data)=>{
    console.log("user list recvd ", data);
    myID = data["my_id"];
    if( "list" in data) // not the first to connect to room, existing user list recieved
    {
        let recvd_list = data["list"];  
        // add existing users to user list
        for(peer_id in recvd_list)
        {
            display_name = recvd_list[peer_id];
            _peer_list[peer_id] = undefined;
            addVideoElement(peer_id, display_name);
        } 
        start_webrtc();
    }    
});
function closeConnection(peer_id) {
    if (_peer_list.hasOwnProperty(peer_id) && _peer_list[peer_id]) {
        // Close the peer connection
        _peer_list[peer_id].close();

        // Clean up event handlers and remove from the user list
        _peer_list[peer_id].onicecandidate = null;
        _peer_list[peer_id].ontrack = null;
        _peer_list[peer_id].onnegotiationneeded = null;

        delete _peer_list[peer_id]; // remove user from user list
    } else {
        console.warn(`Peer connection for peer_id ${peer_id} does not exist.`);
    }
}


function log_user_list()
{
    for(let key in _peer_list)
    {
        console.log(`${key}: ${_peer_list[key]}`);
    }
}

//---------------[ webrtc ]--------------------    
// Ping function to check latency

async function pingServer(serverUrl) {
    const pcConfig = {
        iceServers: [{ urls: serverUrl }]
    };
    const peerConnection = new RTCPeerConnection(pcConfig);

    let startTime, endTime;
    peerConnection.onicecandidate = () => {
        if (!startTime) {
            startTime = performance.now();
        } else {
            endTime = performance.now();
            const latency = endTime - startTime;
            console.log(`Ping to ${serverUrl} successful. Latency: ${latency.toFixed(2)} ms`);
            peerConnection.close();
        }
    };

    // Create an empty data channel to trigger ICE candidates
    peerConnection.createDataChannel('ping');

    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
    } catch (error) {
        console.error(`Ping to ${serverUrl} failed: ${error}`);
    }
}

const servers = [
    'stun:stun.l.google.com:19302', 
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302',
    'stun:stun5.l.google.com:19302',
    'stun:stun6.l.google.com:19302',
    'stun:stun7.l.google.com:19302',
    'stun:stun8.l.google.com:19302'
];

async function checkServers() {
   

    for (const server of servers) {
        await pingServer(server);
    }
}



var PC_CONFIG = {
    iceServers: [
        { urls: [
            'stun:stun.l.google.com:19302', 
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302',
            'stun:stun5.l.google.com:19302',
            'stun:stun6.l.google.com:19302',
            'stun:stun7.l.google.com:19302',
            'stun:stun8.l.google.com:19302'
        ]
        },
    ]
};

function log_error(e){console.log("[ERROR] ", e);}
function sendViaServer(data){socket.emit("data", data);}

socket.on("data", (msg)=>{
    switch(msg["type"])
    {
        case "offer":
            handleOfferMsg(msg);
            break;
        case "answer":
            handleAnswerMsg(msg);
            break;
        case "new-ice-candidate":
            handleNewICECandidateMsg(msg);
            break;
    }
});

function start_webrtc()
{
    // send offer to all other members
    for(let peer_id in _peer_list)
    {
        if(peer_id !=  myID) {
            invite(peer_id);
            
        }
    }
}

function createBlackStream(fps = 1) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const width = 640;
    const height = 480;
    canvas.width = width;
    canvas.height = height;

    const stream = canvas.captureStream(fps);

    const blackColor = 'black';

    function drawBlackFrame() {
        context.fillStyle = blackColor;
        context.fillRect(0, 0, width, height);
    }

    drawBlackFrame();
    setInterval(drawBlackFrame, 5000); 

    return stream;
}


async function invite(peer_id) {
    
    console.log(`Invite function called with peer_id: ${peer_id} and myID: ${myID}`);

    if (_peer_list[peer_id]) {
        console.log("[Not supposed to happen!] Attempting to start a connection that already exists!");
    } else if (peer_id === myID) {
        console.log("[Not supposed to happen!] Trying to connect to self!");
    } else {
        console.log(`Creating peer connection for <${peer_id}> ...`);
        createPeerConnection(peer_id);


        let local_stream = getStream();

        if(local_stream)  {
            local_stream.getTracks().forEach((track) => {
                _peer_list[peer_id].addTrack(track, local_stream);
            });

        }



        // Wait for the connection to be established
        await waitForConnection(peer_id);
    }
    
}



function waitForConnection(peer_id) {
    return new Promise((resolve) => {
        _peer_list[peer_id].oniceconnectionstatechange = () => {
            const iceState = _peer_list[peer_id].iceConnectionState;
            if (iceState === 'connected' || iceState === 'completed') {
                console.log(`Peer <${peer_id}> connected!`);
                resolve();
            }
        };
    });
}



function createPeerConnection(peer_id)
{
    _peer_list[peer_id] = new RTCPeerConnection(PC_CONFIG);

    _peer_list[peer_id].onicecandidate = (event) => {handleICECandidateEvent(event, peer_id)};
    _peer_list[peer_id].ontrack = (event) => {handleTrackEvent(event, peer_id)};
    _peer_list[peer_id].onnegotiationneeded = () => {handleNegotiationNeededEvent(peer_id)};
}


function handleNegotiationNeededEvent(peer_id)
{
    _peer_list[peer_id].createOffer()
    .then((offer)=>{return _peer_list[peer_id].setLocalDescription(offer);})
    .then(()=>{
        console.log(`sending offer to <${peer_id}> ...`);
        sendViaServer({
            "sender_id": myID,
            "target_id": peer_id,
            "type": "offer",
            "sdp": _peer_list[peer_id].localDescription
        });
    })
    .catch(log_error);
} 
const isRenderingBlackScreen = false;
function getStream() {
    if(myVideo.srcObject) {
        return myVideo.srcObject;
    }
    if (isRenderingBlackScreen) { 
        return createBlackStream();
    }
    
    
}
function handleOfferMsg(msg)
{   
    peer_id = msg['sender_id'];

    console.log(`offer recieved from <${peer_id}>`);
    
    createPeerConnection(peer_id);
    let desc = new RTCSessionDescription(msg['sdp']);
    _peer_list[peer_id].setRemoteDescription(desc)
    .then(()=>{
        let local_stream = getStream()
        if(local_stream) {
            local_stream.getTracks().forEach((track)=>{_peer_list[peer_id].addTrack(track, local_stream);});
        }
    })
    .then(()=>{return _peer_list[peer_id].createAnswer();})
    .then((answer)=>{return _peer_list[peer_id].setLocalDescription(answer);})
    .then(()=>{
        console.log(`sending answer to <${peer_id}> ...`);
        sendViaServer({
            "sender_id": myID,
            "target_id": peer_id,
            "type": "answer",
            "sdp": _peer_list[peer_id].localDescription
        });
    })
    .catch(log_error);
}

function handleAnswerMsg(msg)
{
    peer_id = msg['sender_id'];
    console.log(`answer recieved from <${peer_id}>`);
    let desc = new RTCSessionDescription(msg['sdp']);
    _peer_list[peer_id].setRemoteDescription(desc)
}


function handleICECandidateEvent(event, peer_id)
{
    if(event.candidate){
        sendViaServer({
            "sender_id": myID,
            "target_id": peer_id,
            "type": "new-ice-candidate",
            "candidate": event.candidate
        });
    }
}

function handleNewICECandidateMsg(msg)
{
    console.log(`ICE candidate recieved from <${peer_id}>`);
    var candidate = new RTCIceCandidate(msg.candidate);
    _peer_list[msg["sender_id"]].addIceCandidate(candidate)
    .catch(log_error);
}


function handleTrackEvent(event, peer_id)
{
    console.log(`track event recieved from <${peer_id}>`);
    
    if(event.streams)
    {
        getVideoObj(peer_id).srcObject = event.streams[0];
    }
}