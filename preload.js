const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('webView', {
  changeUrl: (url) => ipcRenderer.send('changeUrl', url),
  goBack: () => ipcRenderer.send('backPressed'),
  goForward: () => ipcRenderer.send('forwardPressed'),
  refresh: () => ipcRenderer.send('refreshPressed'),
  openChat: () => ipcRenderer.send('openChat'),
  log: (...args)=>{ ipcRenderer.send('log', ...args)},
  randomString: () => ipcRenderer.invoke('randomString'),
  getVideoTime: () => ipcRenderer.send('getVideoTime'),
  setVideoTime: (time) => ipcRenderer.send('setVideoTime', time),
  handleURLChange : (callback)=> ipcRenderer.on('urlChange', callback),
  handleRTCURLChange : (callback)=> ipcRenderer.on('urlRTCChange', callback),
  handleDidStartLoad: (callback)=> ipcRenderer.on('startLoading', callback),
  handleFailLoad: (callback)=> ipcRenderer.on('failLoad', callback),
  handleCloseApp: (callback)=> ipcRenderer.on('close', callback),
  handleGetVideoTime: (callback) =>ipcRenderer.on('sendGetVideoTime', callback),
})