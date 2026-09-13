const { app, BrowserWindow, ipcMain, Notification, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const USER_THEMES_PATH = path.join(DATA_DIR, 'user-themes.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Bamboo Todo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadURL('app://./index.html');
  win.setMenu(null);
}

function setupIPC() {
  ipcMain.handle('store:read', () => {
    return readJSON(STORE_PATH, null);
  });

  ipcMain.handle('store:write', (_, data) => {
    writeJSON(STORE_PATH, data);
    return true;
  });

  ipcMain.handle('themes:readPresets', () => {
    const presetsPath = path.join(__dirname, 'src', 'themes', 'presets.js');
    try {
      const content = fs.readFileSync(presetsPath, 'utf8');
      const match = content.match(/export\s+const\s+THEME_PRESETS\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        return JSON.parse(match[1].replace(/'/g, '"').replace(/,\s*]/g, ']').replace(/(\w+):/g, '"$1":'));
      }
    } catch {}
    return [];
  });

  ipcMain.handle('themes:readUser', () => {
    return readJSON(USER_THEMES_PATH, []);
  });

  ipcMain.handle('themes:writeUser', (_, data) => {
    writeJSON(USER_THEMES_PATH, data);
    return true;
  });

  ipcMain.handle('notify', (_, { title, body }) => {
    new Notification({ title, body, silent: false }).show();
    return true;
  });
}

app.whenReady().then(() => {
  ensureDataDir();
  setupIPC();

  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.join(__dirname, 'src', pathname.replace(/^\//, ''));
    return net.fetch('file://' + filePath);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
