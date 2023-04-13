const log = window.webView.log;
let follow = false;

//const socket = io("https://gogobrowse-server.onrender.com", {secure: true});
const socket = io("http://localhost:3000");

let peerUrl = "";
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

const servers = {
  iceServers:[
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc = null;
let dataChannel = null;
let timestampChannel  = null;

let localStreams = [];
let remoteStream = null;

navigator.mediaDevices
.getUserMedia({audio: true, video: false})
.then((stream) => {
    localStreams.push(stream); 
});


let myAudio = document.getElementById("myAudio");
let friendAudio = document.getElementById("friendAudio");

class RoomState {
    constructor(){
        this.peerConnections = {};
        this.dataChannels = {};
        this.timestampChannels = {};
        this.currentRoomId = null;
        this.leader = "";
        this.guests = [];
    }

    RemoveSocketListeners(){
        socket.off('offer');
        //socket.off('offerCandidates');
        socket.off('answer');
        //socket.off('answerCandidates');
    }

    CloseAll(refreshMeta){
        for(let key in this.peerConnections){
            this.peerConnections[key].close();
            delete this.peerConnections[key];
        }
        for(let key in this.dataChannels){
            this.dataChannels[key].close();
            delete this.dataChannels[key];
        }
        for(let key in this.timestampChannels){
            this.timestampChannels[key].close();
            delete this.timestampChannels[key];
        }
        for(let elem of document.querySelectorAll("audio")) {
            if(elem.classList.contains("PeerAudio")){
                log("removing element");
                elem.remove();
            }
        }
        log("calling close all")
        if(refreshMeta){
            this.leader = "";
            this.guests = [];
        }
    }

    SetLeader(leader){
        this.leader = leader;
    }

    AddGuest(guest){
        this.guests.push(guest);
    }
    DataChannelSendAll(url){
        for(const key in currentRoomManager.dataChannels){
            let dataChannel = currentRoomManager.dataChannels[key];
            if(dataChannel && dataChannel.readyState == "open") {
                dataChannel.send(url);
            }
        }
    }
    TimestampChannelSendAll(jsonData){
        for(const key in currentRoomManager.timestampChannels){
            let timestampChannel = currentRoomManager.timestampChannels[key];
            if(timestampChannel) {
                log("refresh clicked");
                timestampChannel.send(jsonData);
            }
        }
    }
    GenerateLeaderText(){
        let output = "Leader: ";
        if(this.leader == socket.id){
            output += "Me(" + this.leader.substring(0, 7) + ")";
        }
        else {
            output += "(" + this.leader.substring(0, 7) + ")";
        }
        return output;
    }

    GenerateGuestText(){
        let output = "Joined: ";
        for(let socketID of this.guests){
            if(socketID == socket.id){
                output += "Me(" + socketID.substring(0, 7) + ")";
            }
            else {
                output += "(" + socketID.substring(0, 7) + ")";
            }
        }
        return output;
    }

    // close all current peer connections and listen for offer candidates
    // and answer candidates
    NewRoom(){
        this.CloseAll();

        socket.on('offerCandidates', (offerCandidates) => {
            for(let data of offerCandidates){
                if(data.toSocket != socket.id){
                    continue;
                }
                let pc = this.GetPeerConnection(data.fromSocket);
                if(!pc){
                    log("no connection to add offer candidate to");
                    continue;
                }
                log("adding offer candidate");
                const candidate = new RTCIceCandidate(data.cand);
                pc.addIceCandidate(candidate);
            }
        });

        socket.on('answerCandidates', (answerCandidates) => {
            for(let data of answerCandidates){
                if(data.toSocket != socket.id){
                    continue;
                }
                let pc = this.GetPeerConnection(data.fromSocket);
                if(!pc){
                    log("no connection to add offer candidate to");
                    continue;
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
        this.dataChannels[socketID] = pc.createDataChannel("urlChannel");
        this.timestampChannels[socketID] = pc.createDataChannel("timestampChannel");
        this.dataChannels[socketID].onopen = ()=>{
        }
        this.dataChannels[socketID].onmessage = (event)=>{
            if(socketID == this.leader){
                const msg = event.data;
                log("the leader url message is: ", msg);
                window.webView.changeUrl(msg);
            }
        }
        this.timestampChannels[socketID].onmessage = (event)=>{
            if(socketID == this.leader){
                const msg = event.data;
                window.webView.setVideoTime(JSON.parse(msg));
            }
        }

        StartStreamingData(pc, socketID, ()=> {
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
        StartStreamingData(pc, socketID, ()=>{
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
function JoinMeetingRTC(leader){
    currentRoomManager.NewRoom();
    currentRoomManager.SetLeader(leader);
    // get call data for the room this socket is now in
    socket.emit('getCallData');
    socket.on('getCallData', (callData) => {
        const socketIDs = callData.members;
        for(const socketID of socketIDs){
            // create a peer connection for each socket in the room
            if(socketID != socket.id){
                currentRoomManager.AddPeerConnection(socketID);
                currentRoomManager.SendCallOfferAndCandidates(socketID, callData.roomID);
                joinedStatus.innerText = currentRoomManager.GenerateGuestText(); 
            }
        }
        leadingStatus.innerText = currentRoomManager.GenerateLeaderText();
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
    currentRoomManager.AddGuest(socketID);
    currentRoomManager.AddPeerConnection(socketID);
    currentRoomManager.AnswerCallAndSendCandidates(socketID, callID);
    let dataChannel = currentRoomManager.dataChannels[socketID];
    let timestampChannel = currentRoomManager.timestampChannels[socketID];
    if(dataChannel) {
        dataChannel.onmessage = (event)=>{
        }
    }
    if(timestampChannel){
        timestampChannel.onopen = ()=>{
            log("timestamp channel open");
        }
    }
    currentRoomManager.GetPeerConnection(socketID)
    .ondatachannel = (event) => {
        log("data channel open");
        if(event.channel.label == "urlChannel"){
            let dataChannel = event.channel;
            dataChannel.onopen = () => {
                currentRoomManager.dataChannels[socketID]  = event.channel;
                refreshBtn.click();
            };
            dataChannel.onmessage = (incoming) =>{
                log("got follower url", incoming.url);
            };
        }
        else {
            let timestampChannel = event.channel;
            timestampChannel.onopen = () => {
                currentRoomManager.timestampChannels[socketID]  = event.channel;
            }
        }
    };
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

function CheckLoad(){
    if(peerUrl == current_url){
        roomSyncedStatus.innerText = "Room is synced";
    }
    else {
        roomSyncedStatus.innerText = "Room is not synced";
    }
}

backBtn.addEventListener('click', () =>{
    window.webView.goBack();
})

fwdBtn.addEventListener('click', () =>{
    window.webView.goForward();
})

refreshBtn.addEventListener('click', () =>{
    window.webView.refresh();
    inputBar.value = current_url;
    //socket.emit('url', current_url);
    currentRoomManager.DataChannelSendAll(current_url);
})

window.webView.handleURLChange((_, value) => {
    spinner.style.display = 'none';
    inputBar.blur();
    // only send updates when url changes (helps prevent unneccessary sends
    // that can make the friend url glitchy)
    if(current_url != value.url){
      currentRoomManager.DataChannelSendAll(value.url);
      inputBar.value = value.url;
      current_url = value.url;
    }
    /*
    if(pc && peerUrl == current_url){
        roomSyncedStatus.innerText = "Room is synced";
    }
    else if(pc){
        roomSyncedStatus.innerText = "Room is not synced";
    }
    */

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
    // if in a connection check load
    if(pc){
        CheckLoad();
    }
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
const syncBtn = document.querySelector("#syncBtn");

joinBtn.addEventListener('click', ()=>{
    socket.emit('join', roomInput.value);
});

function LeaveRoom(){
    currentRoomManager.CloseAll(true /*refresh metadata*/);
    currentRoomManager.RemoveSocketListeners();
    currentRoomManager = new RoomState();
    joinedStatus.innerText = "Guest: none";
    leadingStatus.innerText = "Leader: none";
    leaveBtn.style.display = "none";
    syncBtn.style.display = "none";
    roomSyncedStatus.innerText = "";
    roomInput.value = "";
}

window.webView.handleCloseApp((_, value) => {
    socket.emit('leaveCurrentRoom');
});

window.webView.handleGetVideoTime((_, currentTime) => {
    log("current video time is: ", currentTime);
    currentRoomManager.TimestampChannelSendAll(JSON.stringify(currentTime));
});

function StartStreamingData(pc, socketID, doAction){
    remoteStream = new MediaStream();

    navigator.mediaDevices
    .getUserMedia({audio: true, video: false})
    .then((stream) => {
        localStreams.push(stream); 
        let localStream = stream;
        // push tracks from local stream to peer connection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

        let audio = document.createElement("audio");
        audio.srcObject = remoteStream;
        audio.classList.add("PeerAudio");
        audio.classList.add(socketID);
        document.body.appendChild(audio);

        pc.ontrack = (event) =>{
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        }

        if(micBtn.style.opacity == 0.5){
            for(const track of localStream.getTracks()){
                track.enabled = false;
            }
        }

        doAction();
    })
    .catch(() =>{// there was an error getting user's mic
    });
}


const micBtn = document.getElementById("micBtn");
micBtn.addEventListener('click', () =>{
    if(localStreams.length > 0){
        let enabled =localStreams[0].getTracks()[0].enabled;
        if(enabled){
            for(let localStream of localStreams){
                localStream.getAudioTracks()[0].enabled = false;
            }
            micBtn.style.opacity = 0.5;
        }
        else {
            for(let localStream of localStreams){
                localStream.getAudioTracks()[0].enabled = true;
            }
            micBtn.style.opacity = 1.0;
        }
    }
});

syncBtn.addEventListener('click', ()=>{
    log("sync clicked");
    window.webView.getVideoTime();
})

newBtn.addEventListener('click', ()=>{
    log("new clicked");
    window.webView.randomString().then((str) => {
        socket.emit('new', str);
        roomInput.value = str;
    })
});

socket.on('join', (data)=>{
    log("did join room:");
    log(data.didJoin);
    if(!data.didJoin){
        roomSyncedStatus.innerText = "Could not join";
        return;
    }
    leaveBtn.style.display = "block";
    for(const member of data.data.members){
        if(member != data.leader){
            currentRoomManager.AddGuest(member);
        }
    }
    JoinMeetingRTC(data.leader);
});


socket.on('new', (data)=>{
    log("did create room:");
    log(data.didCreate);
    if(!data.didCreate){
        roomSyncedStatus.innerText = "Failed Create"
        return;
    }
    roomSyncedStatus.innerText = "Room created";
    leaveBtn.style.display = "block";
    syncBtn.style.display = "block";

    currentRoomManager.SetLeader(socket.id);
    NewMeetingRTC();
    joinedStatus.innerText = "Guest: none"; 
    leadingStatus.innerText = currentRoomManager.GenerateLeaderText();
});


leaveBtn.addEventListener('click', () => {
    log("leaving current room");
    socket.emit('leaveCurrentRoom');
});

socket.on('leaveCurrentRoom', () => {
    LeaveRoom();
});

socket.on('peerLeft', (socketID) => {
    LeaveRoom();
});

socket.on('peerJoined', (data) => {  
    log("peer joined");
    /*
    if(dataChannel) {
        dataChannel.onopen = ()=>{
            refreshBtn.click();
        }
        dataChannel.onmessage = (event)=>{
            log("follower sent url", event.url);
            peerUrl = event.data;
            if(peerUrl == current_url){
                roomSyncedStatus.innerText = "Room is synced";
            }
            else {
                roomSyncedStatus.innerText = "Room is not synced";
            }
        }
    }
    if(timestampChannel){
        timestampChannel.onopen = ()=>{
            log("timestamp channel open");
        }
    }
    */
    log("joiner id is: ", data.peer);
    ConnectWithJoiner(data.peer, data.roomID);
    joinedStatus.innerText = currentRoomManager.GenerateGuestText();
})
