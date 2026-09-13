const { contextBridge, ipcRenderer } = require('electron');

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
});
