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
  win.setBrowserView(view);
  view.setBounds({ x: 0, y: 100, width: 800, height: 500});
  view.setAutoResize({width: true, height: true});
  // view.webContents.loadURL('https://google.com');
  win.loadFile('index.html');
};

function handleChangeUrl(event, url) {
  const webContents = event.sender;
  BrowserWindow
  .fromWebContents(webContents)
  .getBrowserView()
  .webContents.loadURL(url);
}

function handleBackPressed(event) {
  const webContents = event.sender;
  BrowserWindow
  .fromWebContents(webContents)
  .getBrowserView()
  .webContents.goBack();
}

function handleForwardPressed(event) {
  const webContents = event.sender;
  BrowserWindow
  .fromWebContents(webContents)
  .getBrowserView()
  .webContents.goForward();
}


app.whenReady().then(() => {
  ipcMain.on('changeUrl', handleChangeUrl);
  ipcMain.on('backPressed', handleBackPressed); 
  ipcMain.on('forwardPressed', handleForwardPressed); 
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
