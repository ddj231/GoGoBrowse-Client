const { randomInt } = require('crypto');
const { app, BrowserView, BrowserWindow, ipcMain, components } = require('electron');
const path = require('path')

let current_url = "";


class AppState {
    constructor(){
        this.chatWindowOpen = false;
        this.chatWindow = {};
    }
}

let appState = new AppState();


const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 650,
    webPreferences: {webviewTag: true, 
      preload: path.join(__dirname, 'preload.js'),
    }, 
  });

  const view = new BrowserView()
  view.webContents.on('did-start-loading', () => {
    win.webContents.send('startLoading');
  });
  view.webContents.on('did-stop-loading', () => {
    const value = {url: view.webContents.getURL(), 
                  canGoBack: view.webContents.canGoBack(), 
                  canGoForward: view.webContents.canGoForward()};
    win.webContents.send('urlChange', value);
    win.webContents.send('urlRTCChange', value);
  });
  view.webContents.on('did-fail-load', () => {
    win.webContents.send('failLoad');
  });
  view.webContents.on('enter-html-full-screen', () => {
    view.setBounds({ x: 0, y: 25, width: win.getSize()[0], height: win.getSize()[1] - 23});
  });
  view.webContents.on('leave-html-full-screen', () => {
    view.setBounds({ x: 0, y: 94, width: win.getSize()[0], height: win.getSize()[1]- 70});
  });
  win.setBrowserView(view);
  view.setBounds({ x: 0, y: 98, width: win.getSize()[0], height: 502 /*600 - 99*/});
  view.setAutoResize({width: true, height: true});
  view.webContents.setWindowOpenHandler(({url}) => {
    console.log("stopping window open");
    view.webContents.loadURL(url);
    return {action: 'deny'};
  });
  win.on('session-end', () => {
   win.webContents.send('close');
  })
  win.on('close', () => {
   win.webContents.send('close');
  });
  win.loadFile('index.html');
};

const createChatWindow = () => {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 400,
    webPreferences: {webviewTag: true, 
      preload: path.join(__dirname, 'preload.js'),
    }, 
  });
  win.loadFile('chatBox.html');
  return win;
}

function handleChangeUrl(event, url) {
  const webContents = event.sender;
  BrowserWindow
  .fromWebContents(webContents)
  .getBrowserView()
  .webContents.loadURL(url);
}

function getBrowserViewContents(event){
  const webContents = event.sender;
  return BrowserWindow
          .fromWebContents(webContents)
          .getBrowserView().webContents;
}

function handleBackPressed(event) {
  getBrowserViewContents(event).goBack();
}

function handleForwardPressed(event) {
  getBrowserViewContents(event).goForward();
}

function handleRefreshPressed(event) {
  getBrowserViewContents(event).reload();
}

function handleOpenChat(){
  if(!appState.chatWindowOpen){
    appState.chatWindow =  createChatWindow();
    appState.chatWindowOpen = true;
    appState.chatWindow.on('closed', () => {
      appState.chatWindowOpen = false;
      appState.chatWindow = {};
    });
  }
}

function randomString(len){
  const letters = "abcdefghijklmnopqrstuvwxyz1234567890"
  let output = "";
  for(let i =0; i < len; i++){
    output += letters[randomInt(letters.length)];
  }
  return output;
}

app.whenReady().then(() => {
  components.whenReady().then(() => {
    ipcMain.on('changeUrl', handleChangeUrl);
    ipcMain.on('backPressed', handleBackPressed); 
    ipcMain.on('forwardPressed', handleForwardPressed); 
    ipcMain.on('refreshPressed', handleRefreshPressed); 
    ipcMain.on('openChat', handleOpenChat); 
    ipcMain.on('log', (_event, ...str) => {console.log(...str)}); 
    ipcMain.on('getVideoTime', (event)=>{
      getBrowserViewContents(event).executeJavaScript(`
        document.getElementById('movie_player') ? 
        document.getElementById('movie_player').getCurrentTime() : 0;
      `, false).then((currentTime)=>{
        // send ipc back
        if(currentTime){
          const webContents = event.sender;
          webContents.send('sendGetVideoTime', currentTime);
          getBrowserViewContents(event).executeJavaScript(`
            document.getElementById('movie_player') ? 
            document.getElementById('movie_player').playVideo() : 0;
          `);
        }
      }).catch((err)=> console.log(err));
    });
    ipcMain.on('getVideoTime', (event)=>{
      getBrowserViewContents(event).executeJavaScript(`
        window.netflix ? window.netflix.appContext.state.playerApp.getAPI().videoPlayer : 0;
      `, false).then((player)=>{
        // send ipc back
        if(player){
          const webContents = event.sender;
          webContents.send('sendGetVideoTime', player.getCurrentTime());
        }
      }).catch((err)=> console.log(err));
    });
    ipcMain.on('setVideoTime', (event, time)=>{
      getBrowserViewContents(event).executeJavaScript(`
        document.getElementById('movie_player') ?
          document.getElementById('movie_player').seekTo(${time}, true) : false;
      `, false).then(()=>{
        console.log("set video time");  
        getBrowserViewContents(event).executeJavaScript(`
          document.getElementById('movie_player') ? 
          document.getElementById('movie_player').playVideo() : 0;
        `);
      }).catch((err)=> console.log(err));
    });
    ipcMain.on('setVideoTime', (event, time)=>{
      getBrowserViewContents(event).executeJavaScript(`
        window.netflix ? window.netflix.appContext.state.playerApp.getAPI().videoPlayer : 0;
      `, false).then((player)=>{
        if(player){
          player.seek(time);
        }
      }).catch((err)=> console.log(err));
    });
    ipcMain.handle('randomString', () => { return randomString(25)});
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
