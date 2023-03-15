const { randomInt } = require('crypto');
const { app, BrowserView, BrowserWindow, ipcMain } = require('electron');
const path = require('path')


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
  });
  view.webContents.on('did-fail-load', () => {
    win.webContents.send('failLoad');
  });
  win.setBrowserView(view);
  view.setBounds({ x: 0, y: 99, width: 800, height: 600 - 99});
  view.setAutoResize({width: true, height: true});
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
  ipcMain.on('changeUrl', handleChangeUrl);
  ipcMain.on('backPressed', handleBackPressed); 
  ipcMain.on('forwardPressed', handleForwardPressed); 
  ipcMain.on('refreshPressed', handleRefreshPressed); 
  ipcMain.on('openChat', handleOpenChat); 
  ipcMain.on('log', (_event, str) => {console.log(str)}); 
  ipcMain.handle('randomString', () => { return randomString(25)});
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
