const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('webView', {
  changeUrl: (url) => ipcRenderer.send('changeUrl', url),
  goBack: () => ipcRenderer.send('backPressed'),
  goForward: () => ipcRenderer.send('forwardPressed'),
  refresh: () => ipcRenderer.send('refreshPressed'),
  openChat: () => ipcRenderer.send('openChat'),
  handleURLChange : (callback)=> ipcRenderer.on('urlChange', callback),
})