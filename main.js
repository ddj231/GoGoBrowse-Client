const { app, BrowserView, BrowserWindow, ipcMain } = require('electron');
const path = require('path')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {webviewTag: true, 
      preload: path.join(__dirname, 'preload.js'),
    }, 
  });

  const view = new BrowserView()
  view.webContents.on('did-finish-load', (ret) => {
    win.webContents.send('urlChange', view.webContents.getURL());
  });
  win.setBrowserView(view);
  view.setBounds({ x: 0, y: 79, width: 800, height: 500});
  view.setAutoResize({width: true, height: true});
  win.loadFile('index.html');
};

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

app.whenReady().then(() => {
  ipcMain.on('changeUrl', handleChangeUrl);
  ipcMain.on('backPressed', handleBackPressed); 
  ipcMain.on('forwardPressed', handleForwardPressed); 
  ipcMain.on('refreshPressed', handleRefreshPressed); 
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
