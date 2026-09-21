const { contextBridge, ipcRenderer, webFrame } = require('electron');

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const TITLEBAR_HEIGHT = 36;

function syncOverlayHeight() {
  try {
    ipcRenderer.send('titlebar:set-overlay', {
      height: Math.round(TITLEBAR_HEIGHT * webFrame.getZoomFactor()),
    });
  } catch {}
}

function setZoom(factor) {
  webFrame.setZoomFactor(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, factor)));
  syncOverlayHeight();
  return webFrame.getZoomFactor();
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
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
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  },
  titlebar: {
    setOverlay: (opts) => ipcRenderer.send('titlebar:set-overlay', opts),
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
