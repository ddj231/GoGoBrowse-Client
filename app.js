const log = window.webView.log;
log('hello world');
let follow = false;

const socket = io("http://localhost:3000");
window.webView
      .changeUrl('https://www.electronjs.org/docs/latest/tutorial/ipc');

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
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

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
})


window.webView.handleURLChange((_, value) => {
    inputBar.value = value.url;
    spinner.style.display = 'none';
    inputBar.blur();
    socket.emit('url', value.url);
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

joinBtn.addEventListener('click', ()=>{
    socket.emit('join', roomInput.value);
});

function StartStreamingData(){
    navigator.mediaDevices
    .getUserMedia({audio: true, video: false})
    .then((stream) => {
        localStream = stream; 
        // push tracks from local stream to peer connection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
        // myAudio.srcObject = localStream;
        friendAudio.srcObject = remoteStream;
        //myAudio.play();
        friendAudio.play();
    })
    .catch(() =>{// there was an error getting user's mic
    });
}

StartStreamingData();

const micBtn = document.getElementById("micBtn");
micBtn.addEventListener('click', () =>{
    log("mic clicked");
    StartStreamingData();
});

remoteStream = new MediaStream();
pc.ontrack = (event) =>{
    event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
    });
}
friendAudio.play();


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
        return;
    }
    joinedStatus.innerText = "guest: me(" + data.me.substr(0, 5) +")"; 
    leadingStatus.innerText = "leader: (" + data.leader.substr(0, 5) + ")";
    let callID = data.roomId;
    pc.onicecandidate = (event)=>{
        if(event.candidate){
            socket.emit('answerCandidates', {room: callID, 
                                        answerCandidate: event.candidate.toJSON()})
        }
    }
    socket.emit('getCallData');

    socket.on('getCallData', (callData) => {
        log(callData);
        const offerDescription = callData.offer;
        log("offer description");
        log(offerDescription);
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
                    for(let cand of data){
                        log("offer candidate");
                        log(cand);
                        const candidate = new RTCIceCandidate(cand);
                        pc.addIceCandidate(candidate);
                    }
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
    log(data);
    leadingStatus.innerText = "leader: me(" + data.me.substr(0,5) +")"; 
    joinedStatus.innerText = "guest: none"; 
    let callID = data.roomId;
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
                log("answer");
                if(!pc.currentRemoteDescription && data.answer){
                    const answerDesc = new RTCSessionDescription(data.answer);
                    pc.setRemoteDescription(answerDesc);
                    log("set Remote Desc");
                    log(data.answer);
                }
            });

            socket.on('answerCandidates', (data) => {
                log("getting answer candidates");
                for(let cand of data){
                    log("answer candidate");
                    log(cand);
                    const candidate = new RTCIceCandidate(cand);
                    pc.addIceCandidate(candidate);
                }
            });
        })
    });

});

socket.on('friendJoined', (data) => {  
    joinedStatus.innerText = "guest: (" + data.friend.substr(0, 5) + ")"; 
})


