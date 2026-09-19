const { contextBridge, ipcRenderer, webFrame } = require('electron');

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

function setZoom(factor) {
  webFrame.setZoomFactor(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, factor)));
  return webFrame.getZoomFactor();
}

contextBridge.exposeInMainWorld('api', {
  store: {
    read: () => ipcRenderer.invoke('store:read'),
    write: (data) => ipcRenderer.invoke('store:write', data),
  },
  themes: {
    readUser: () => ipcRenderer.invoke('themes:readUser'),
  },
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  window: {
    show: () => ipcRenderer.invoke('window:show'),
    getPath: (name) => ipcRenderer.invoke('app:getPath', name),
  },
  app: {
    applySetting: (key, value) => ipcRenderer.send('menu:apply-setting', { key, value }),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  zoom: {
    get: () => webFrame.getZoomFactor(),
    set: (factor) => setZoom(factor),
    in: () => setZoom(webFrame.getZoomFactor() + 0.1),
    out: () => setZoom(webFrame.getZoomFactor() - 0.1),
    reset: () => setZoom(1.0),
  },
  onMenuAction: (callback) => {
    const listener = (_, { action, data }) => callback(action, data);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },
});
