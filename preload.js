const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('webView', {
  changeUrl: (url) => ipcRenderer.send('changeUrl', url),
  goBack: () => ipcRenderer.send('backPressed'),
  goForward: () => ipcRenderer.send('forwardPressed'),
  refresh: () => ipcRenderer.send('refreshPressed'),
  openChat: () => ipcRenderer.send('openChat'),
  log: (str)=>{ ipcRenderer.send('log', str)},
  handleURLChange : (callback)=> ipcRenderer.on('urlChange', callback),
  handleDidStartLoad: (callback)=> ipcRenderer.on('startLoading', callback),
  handleFailLoad: (callback)=> ipcRenderer.on('failLoad', callback),
})