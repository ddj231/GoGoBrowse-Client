const log = window.webView.log;
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

// Web RTC vars 
//====================================================================================
const servers = {
  iceServers:[
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    },
  ],
  iceCandidatePoolSize: 10,
};

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
        myAudio.srcObject = localStream;
        friendAudio.srcObject = remoteStream;
        doAction();
    })
    .catch(() =>{// there was an error getting user's mic
    });
}


class RoomState {
    constructor(){
        this.peerConnections = {};
        this.currentRoomId = null;
    }


    GenerateLeaderText(socketID){
        let output = "leader: ";
        if(socketID == socket.id){
            output += "me(" + socketID.substring(0, 6) + ")";
        }
        else {
            output += "(" + socketID.substring(0, 6) + ")";
        }
        return output;
    }

    GenerateJoinedText(){
        let output = "joined: ";
        for(let socketID in this.peerConnections){
            if(socketID == socket.id){
                output += "me(" + socketID.substring(0, 6) + ")";
            }
            else {
                output += "(" + socketID.substring(0, 6) + ")";
            }
        }
        return output;
    }

    // close all current peer connections and listen for offer candidates
    // and answer candidates
    NewRoom(){
        for(const socketID in this.peerConnections){
            this.RemovePeerConnection(socketID);
        }

        socket.on('offerCandidates', (offerCandidates) => {
            for(let data of offerCandidates){
                console.log("my id", socket.id);
                console.log("toSocket", data.toSocket);
                if(data.toSocket != socket.id){
                    return;
                }
                let pc = this.GetPeerConnection(data.fromSocket);
                if(!pc){
                    log("no connection to add offer candidate to");
                }
                log("adding offer candidate");
                const candidate = new RTCIceCandidate(data.cand);
                pc.addIceCandidate(candidate);
            }
        });

        socket.on('answerCandidates', (answerCandidates) => {
            for(let data of answerCandidates){
                console.log("my id", socket.id);
                console.log("toSocket", data.toSocket);
                if(data.toSocket != socket.id){
                    return;
                }
                let pc = this.GetPeerConnection(data.fromSocket);
                if(!pc){
                    log("no connection to add offer candidate to");
                }
                log("adding answer candidate");
                const candidate = new RTCIceCandidate(data.cand);
                pc.addIceCandidate(candidate);
            }
        });
    }

    AddPeerConnection(socketID){
        log("adding peer connection");
        log(socketID);
        this.peerConnections[socketID] =  new RTCPeerConnection(servers);
    }

    RemovePeerConnection(socketID){
        // close peer connection and delete
        this.peerConnections[socketID].close();
        delete this.peerConnections[socketID];
    }

    GetPeerConnection(socketID){
        return this.peerConnections[socketID];
    }

    SendCallOfferAndCandidates(socketID, callID){
        log("socket ID: ");
        log(socketID);
        const pc = this.GetPeerConnection(socketID);
        if(!pc){
            log("no peer connection found for socketID: ");
            log(socketID);
            return;
        }
        StartStreamingData(pc, ()=> {
            pc.onicecandidate = (event)=>{
                if(event.candidate){
                    socket.emit('offerCandidates', {room: callID, 
                                                    fromSocket: socket.id,
                                                    toSocket: socketID,
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
                    socket.emit('offer', {room: callID, 
                                        fromSocket: socket.id,
                                        toSocket: socketID, offer: offer});
                    socket.on('answer', (answers) =>{
                        for(let data of answers) {
                            log(data);
                            log(socketID);
                            log(socket.id);
                            if(data.fromSocket == socketID && data.toSocket == socket.id){
                                if(!pc.currentRemoteDescription && data.answer){
                                    const answerDesc = new RTCSessionDescription(data.answer);
                                    pc.setRemoteDescription(answerDesc);
                                    log("set Remote Desc");
                                }
                            }
                        }
                    });
                })
            });
        })
    }
    HandleGettingOffer(pc, offers, socketID, callID){
        let promise;
        for(const data of offers){
            log("looking for offer");
            log("my from Socket");
            log(socketID);
            log("my to Socket");
            log(socket.id);
            if(data.fromSocket == socketID && data.toSocket == socket.id){
                const offerDescription = data.offer;
                log("setting offer description");
                promise = pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
            }
        }
        if(!promise){
            log("error setting remote description for peer");
            return;
        }
        promise.then(() => {
            pc.createAnswer().then((answerDesc) => {
                pc.setLocalDescription(answerDesc).then(()=>{
                    const answer= {
                        sdp: answerDesc.sdp,
                        type: answerDesc.type
                    }
                    socket.emit('answer', 
                                        {room: callID, 
                                        fromSocket: socket.id,
                                        toSocket: socketID, answer: answer });
                })
            });
        });

    }
    AnswerCallAndSendCandidates(socketID, callID){
        // add the user that just joined the room to the peer connections
        log("answering call and sending answer");
        log("socket id");
        log(socket.id);
        let pc = this.GetPeerConnection(socketID);
        StartStreamingData(pc, ()=>{
            pc.onicecandidate = (event)=>{
                if(event.candidate){
                    socket.emit('answerCandidates', {room: callID, 
                                                    fromSocket: socket.id,
                                                    toSocket: socketID,
                                                answerCandidate: event.candidate.toJSON()})
                }
            }
            socket.emit('getOffers');
            socket.on('getOffers', (offers) => {
                this.HandleGettingOffer(pc, offers, socketID, callID);
             });
            socket.on('offer', (offers) => {
                this.HandleGettingOffer(pc, offers, socketID, callID);
            });
        });
    }
}
// current peer connections. (global because the peers we are connected
// to are the peers we are connected to regardless of what room we are in)
let currentRoomManager = new RoomState();
// The protocol for joining a meeting is:
// 1. Get all the members of the room. An array of socket ids.
// 2. Create a map of "current peer connections". 
//      Mapped socket_id of the peer, to a new peer connection.
// 3. Create an RTC offer for each peer. and send via socket io.
// 4. Add the offer candidates behavior and send offer candidates per socket as well.
// 5. Listen for answer candidates. If we get an answer for our socket id, update the
// corresponding socket.
function JoinMeetingRTC(){
    currentRoomManager.NewRoom();
    // get call data for the room this socket is now in
    socket.emit('getCallData');
    socket.on('getCallData', (callData) => {
        const socketIDs = callData.members;
        console.log(callData);
        for(const socketID of socketIDs){
            // create a peer connection for each socket in the room
            console.log("socketID", socketID);
            console.log("socket.id", socket.id);
            if(socketID != socket.id){
                currentRoomManager.AddPeerConnection(socketID);
                currentRoomManager.SendCallOfferAndCandidates(socketID, callData.roomID);
                joinedStatus.innerText = currentRoomManager.GenerateJoinedText(); 
            }
        }
    });
}

// The protocol for creating a new rtc meeting.
// 1. Clear all existing peer connections
// 2. Listen for offer candidates and answer candidates
function NewMeetingRTC(){
    currentRoomManager.NewRoom();
}

// The protocol for connection with joiners of a meeting.
// 1. Listen with socket id for emitted offers and answers. 
//      If we get an offer from a user not in our current peer connections map,
//      create a new peer connection and add to map.
// 2. Add offer to the created peer connection. And send answer.
// 3. Add offer candidates to the created peer connections.
// 4. Otherwise listen for offer candidates. If they are for our socket update the 
//      corresponding peer connection.
// 5. Send out answer candidates for each peer.
function ConnectWithJoiner(socketID, callID){
    console.log("connecting");
    currentRoomManager.AddPeerConnection(socketID);
    currentRoomManager.AnswerCallAndSendCandidates(socketID, callID);
}

// The protocol for leaving a room is:
// 1. Close all current peer connections.
function LeaveCurrentRoom(){
    for(const socketID in currentRoomManager.peerConnections){
        currentRoomManager.RemovePeerConnection(socketID);
    }
}

// The protocol for updating a user leaving a room is:
// 1. Listen for a user did leave 
// 2. Close the peer connection of the user that left
function PeerDidLeave(socketID){
    currentRoomManager.RemovePeerConnection(socketID);
}


const micBtn = document.getElementById("micBtn");
micBtn.addEventListener('click', () =>{
    log("mic clicked");
});



newBtn.addEventListener('click', ()=>{
    log("new clicked");
    window.webView.randomString().then((str) => {
        socket.emit('new', str);
        roomInput.value = str;
    });
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
    JoinMeetingRTC();
    leadingStatus.innerText = currentRoomManager.GenerateLeaderText(data.leader);
});

socket.on('new', (data)=>{
    log("did create room:");
    log(data.didCreate);
    if(!data.didCreate){
        return;
    }
    NewMeetingRTC();
    joinedStatus.innerText = currentRoomManager.GenerateJoinedText(); 
    leadingStatus.innerText = currentRoomManager.GenerateLeaderText(socket.id);
});

socket.on('peerJoined', (data) => {  
    ConnectWithJoiner(data.peer, data.roomID);
    joinedStatus.innerText = currentRoomManager.GenerateJoinedText(); 
})


