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

const chatBtn = document.getElementById("chatBtn");
const newBtn = document.getElementById("newBtn");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomInput");


chatBtn.addEventListener('click', ()=>{
    window.webView.openChat();
});

joinBtn.addEventListener('click', ()=>{
    socket.emit('join', roomInput.value);
});

newBtn.addEventListener('click', ()=>{
    window.webView.randomString().then((str) => {
        socket.emit('new', str);
        roomInput.value = str;
    });
});

socket.on('url', (url)=>{
    window.webView.changeUrl(url);
});

socket.on('join', (didJoin)=>{
    log("did join room:");
    log(didJoin);
});

socket.on('new', (didCreate)=>{
    log("did create room:");
    log(didCreate);
});


