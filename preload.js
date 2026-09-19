const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
  store: {
    read: () => ipcRenderer.invoke('store:read'),
    write: (data) => ipcRenderer.invoke('store:write', data),
  },
  themes: {
    readPresets: () => ipcRenderer.invoke('themes:readPresets'),
    readUser: () => ipcRenderer.invoke('themes:readUser'),
    writeUser: (data) => ipcRenderer.invoke('themes:writeUser', data),
  },
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  window: {
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    show: () => ipcRenderer.invoke('window:show'),
    getPath: (name) => ipcRenderer.invoke('app:getPath', name),
  },
  zoom: {
    get: () => webFrame.getZoomFactor(),
    set: (factor) => { webFrame.setZoomFactor(Math.max(0.3, Math.min(3, factor))); },
    in: () => { const z = webFrame.getZoomFactor(); webFrame.setZoomFactor(Math.min(3, z + 0.1)); },
    out: () => { const z = webFrame.getZoomFactor(); webFrame.setZoomFactor(Math.max(0.3, z - 0.1)); },
    reset: () => webFrame.setZoomFactor(1.0),
  },
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_, { action, data }) => callback(action, data));
  },
});