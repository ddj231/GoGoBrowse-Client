const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('webView', {
  changeUrl: (url) => ipcRenderer.send('changeUrl', url),
  goBack: () => ipcRenderer.send('backPressed'),
  goForward: () => ipcRenderer.send('forwardPressed'),
})