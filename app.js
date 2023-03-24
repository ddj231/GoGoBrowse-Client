const log = window.webView.log;
let follow = false;
let isInRoom = false;

const socket = io("http://localhost:3000");

let current_url = "https://www.google.com";
window.webView
      .changeUrl('https://www.google.com');

const inputBar = document.querySelector("#urlInput");
inputBar.value =  'https://www.electronjs.org/docs/latest/tutorial/ipc'
inputBar.addEventListener('focus', () => {
    inputBar.addEventListener('mouseup', () =>{
        inputBar.setSelectionRange(0, inputBar.value.length);
    })
});

// Web RTC code
//====================================================================================
const servers = {
  iceServers:[
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc = null;

let localStream = null;
let remoteStream = null;

navigator.mediaDevices
.getUserMedia({audio: true, video: false})
.then((stream) => {
    localStream = stream; 
});


let myAudio = document.getElementById("myAudio");
let friendAudio = document.getElementById("friendAudio");
//====================================================================================

document.addEventListener('keyup', (event) => {
    if(event.code == 'Enter') {
        //enter pressed
        if(inputBar === document.activeElement){
            let value = inputBar.value;
            if(value.substr(0,8) != "https://" 
                    && value.substr(0, 7) != "http://"){
                value = "https://" + value;
            }
            window.webView.changeUrl(value);
            spinner.style.display = 'block';
            inputBar.blur();
        }
    }
});

const backBtn = document.querySelector("#backBtn");
const fwdBtn = document.querySelector("#fwdBtn");
const refreshBtn = document.querySelector("#refreshBtn");
const spinner = document.querySelector("#spinner");
spinner.style.display = 'none';
const error = document.querySelector("#error");
error.style.display = 'none';



backBtn.addEventListener('click', () =>{
    window.webView.goBack();
})

fwdBtn.addEventListener('click', () =>{
    window.webView.goForward();
})

refreshBtn.addEventListener('click', () =>{
    window.webView.refresh();
    socket.emit('url', current_url);
})

window.webView.handleURLChange((_, value) => {
    inputBar.value = value.url;
    spinner.style.display = 'none';
    inputBar.blur();
    // only send updates when url changes (helps prevent unneccessary sends
    // that can make the friend url glitchy)
    if(current_url != value.url){
      current_url = value.url;
      socket.emit('url', value.url);
    }
    if(!value.canGoBack) {
        backBtn.style.opacity = '0.5';
        backBtn.disabled = true;
    }
    else {
        backBtn.style.opacity = '1.0';
        backBtn.disabled = false;
    }

    if(!value.canGoForward) {
        fwdBtn.style.opacity = '0.5';
        fwdBtn.disabled = true;
    }
    else {
        fwdBtn.style.opacity = '1.0';
        fwdBtn.disabled = false;
    }
});

window.webView.handleDidStartLoad(() => {
    spinner.style.display = 'block';
    error.style.display = 'none';
});

window.webView.handleFailLoad(() => {
    error.style.display = 'block';
});

const newBtn = document.getElementById("newBtn");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomInput");
const leadingStatus = document.getElementById("leadingStatus");
const joinedStatus = document.getElementById("joinedStatus");
const roomSyncedStatus = document.getElementById("roomSyncedStatus");
const leaveBtn = document.querySelector("#leaveBtn");
leaveBtn.style.display = "none";

joinBtn.addEventListener('click', ()=>{
    socket.emit('join', roomInput.value);
});

function LeaveRoom(){
    if(pc){
        pc.close();
    }
    log("peer left");
    isInRoom = false;
    joinedStatus.innerText = "guest: none";
    leadingStatus.innerText = "leader: none";
    leaveBtn.style.display = "none";
    roomSyncedStatus.innerText = "";
    roomInput.value = "";
}

window.webView.handleCloseApp((_, value) => {
    socket.emit('leaveCurrentRoom');
});

function StartStreamingData(pc, doAction){
    remoteStream = new MediaStream();

    navigator.mediaDevices
    .getUserMedia({audio: true, video: false})
    .then((stream) => {
        localStream = stream; 
        // push tracks from local stream to peer connection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
        friendAudio.srcObject = remoteStream;

        pc.ontrack = (event) =>{
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        }

        if(micBtn.style.opacity == 0.5){
            localStream.getTracks()[0].enabled = false;
        }

        doAction();
    })
    .catch(() =>{// there was an error getting user's mic
    });
}


const micBtn = document.getElementById("micBtn");
micBtn.addEventListener('click', () =>{
    if(localStream){
        let enabled =localStream.getTracks()[0].enabled;
        if(enabled){
            localStream.getTracks()[0].enabled = false;
            micBtn.style.opacity = 0.5;
        }
        else {
            localStream.getTracks()[0].enabled = true;
            micBtn.style.opacity = 1.0;
        }
    }
});



newBtn.addEventListener('click', ()=>{
    log("new clicked");
    window.webView.randomString().then((str) => {
        socket.emit('new', str);
        roomInput.value = str;

    })
});

socket.on('url', (url)=>{
    window.webView.changeUrl(url);
});

socket.on('join', (data)=>{
    log("did join room:");
    log(data.didJoin);
    if(!data.didJoin){
        roomSyncedStatus.innerText = "could not join room";
        return;
    }
    leaveBtn.style.display = "block";
    isInRoom = true;
    if(pc){
        pc.close();
    }
    pc = new RTCPeerConnection(servers);
    joinedStatus.innerText = "guest: me(" + data.me.substr(0, 7) +")"; 
    leadingStatus.innerText = "leader: (" + data.leader.substr(0, 7) + ")";
    StartStreamingData(pc, ()=>{
        let callID = data.roomId;
        pc.onicecandidate = (event)=>{
            if(event.candidate){
                socket.emit('answerCandidates', {room: callID, 
                                            answerCandidate: event.candidate.toJSON()})
            }
        }
        socket.emit('getCallData');

        socket.on('getCallData', (callData) => {
            const offerDescription = callData.offers[0].offer;
            log("offer description");
            pc.setRemoteDescription(new RTCSessionDescription(offerDescription))
            .then(() => {
                pc.createAnswer().then((answerDesc) => {
                    pc.setLocalDescription(answerDesc).then(()=>{
                        const answer= {
                            sdp: answerDesc.sdp,
                            type: answerDesc.type
                        }
                        socket.emit('answer', {room: callID, answer: answer });
                    })
                    socket.on('offerCandidates', (data) => {
                        log("getting offer candidates");
                        for(let candData of data){
                            log("offer candidate");
                            const candidate = new RTCIceCandidate(candData.cand);
                            pc.addIceCandidate(candidate);
                        }
                    });
                });
            });
        });
    });
});

socket.on('new', (data)=>{
    log("did create room:");
    log(data.didCreate);
    if(!data.didCreate){
        return;
    }
    roomSyncedStatus.innerText = "room created";
    leaveBtn.style.display = "block";
    isInRoom = true;
    if(pc){
        pc.close();
    }
    pc = new RTCPeerConnection(servers);
    StartStreamingData(pc, ()=> {
        pc.onicecandidate = (event)=>{
            if(event.candidate){
                socket.emit('offerCandidates', {room: callID, 
                                            offerCandidate: event.candidate.toJSON()})
            }
        }

        var mediaConstraints = {
            'offerToReceiveAudio': true,
            'offerToReceiveVideo': false 
        };

        // create offer
        pc.createOffer(mediaConstraints).then((offerDesc) =>{
            pc.setLocalDescription(offerDesc).then(() =>{
                const offer = {
                    sdp: offerDesc.sdp,
                    type: offerDesc.type
                }
                socket.emit('offer', {room: callID, offer: offer});
                socket.on('answer', (data) =>{
                    for(const elem of data){
                        if(!pc.currentRemoteDescription && elem.answer){
                            const answerDesc = new RTCSessionDescription(elem.answer);
                            pc.setRemoteDescription(answerDesc);
                            log("set Remote Desc");
                        }
                    }
                });

                socket.on('answerCandidates', (data) => {
                    log("getting answer candidates");
                    for(let candData of data){
                        log("answer candidate");
                        const candidate = new RTCIceCandidate(candData.cand);
                        pc.addIceCandidate(candidate);
                    }
                });
            })
        });
    })
    leadingStatus.innerText = "leader: me(" + data.me.substr(0,7) +")"; 
    joinedStatus.innerText = "guest: none"; 
    let callID = data.roomId;
});


leaveBtn.addEventListener('click', () => {
    log("leaving current room");
    socket.emit('leaveCurrentRoom');
});

socket.on('leaveCurrentRoom', () => {
    LeaveRoom();
});

socket.on('peerLeft', () => {
    LeaveRoom();
});

socket.on('peerJoined', (data) => {  
    log("peer joined");
    joinedStatus.innerText = "guest: (" + data.peer.substr(0, 7) + ")"; 
    refreshBtn.click();
})


function CheckIsRoomSynced(){
    if(isInRoom){
        socket.emit('isRoomSynced', current_url);
    }
    setTimeout(CheckIsRoomSynced, 1000);
}

CheckIsRoomSynced();

socket.on('isRoomSynced', (isSynced) => {
    if(isSynced){
        roomSyncedStatus.innerText = "room is synced";
    }
    else {
        roomSyncedStatus.innerText = "room is not synced";
    }
});

