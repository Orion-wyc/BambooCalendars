const { app, BrowserWindow, ipcMain, Notification, protocol, net, Menu, Tray, globalShortcut, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { initStorage, getDb, getReport } = require('./src/main/storage-init');
const repositories = require('./src/main/repositories');
const { exportDbToJson } = require('./src/main/export-json');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const USER_THEMES_PATH = path.join(DATA_DIR, 'user-themes.json');
const WINDOW_STATE_PATH = path.join(DATA_DIR, 'window-state.json');
const APP_STATE_PATH = path.join(DATA_DIR, 'app-state.json');
const UPDATE_API = 'https://api.github.com/repos/Orion-wyc/BambooCalendars/releases/latest';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let saveWindowStateTimer = null;

const TITLEBAR_HEIGHT = 36;
const overlayState = { color: '#ffffff', symbolColor: '#242424', height: TITLEBAR_HEIGHT };

function applyTitleBarOverlay(patch) {
  if (process.platform === 'darwin') return;
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.setTitleBarOverlay) return;
  if (patch && typeof patch === 'object') {
    if (typeof patch.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.color)) overlayState.color = patch.color;
    if (typeof patch.symbolColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.symbolColor)) overlayState.symbolColor = patch.symbolColor;
    const h = Number(patch.height);
    if (Number.isFinite(h)) overlayState.height = Math.min(80, Math.max(24, Math.round(h)));
  }
  try {
    mainWindow.setTitleBarOverlay({ ...overlayState });
  } catch {}
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}

function writeJSON(filePath, data) {
  ensureDataDir();
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function send(action, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', { action, data });
  }
}

function applyCompactMode(window, compact) {
  if (!window || window.isDestroyed()) return;
  try {
    window.webContents.send('menu-action', { action: 'compact-mode', data: compact });
  } catch {}
}

function readAppState() {
  const state = readJSON(APP_STATE_PATH, null);
  if (state) return state;
  const settings = readJSON(STORE_PATH, {}).settings || {};
  return {
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    compactMode: Boolean(settings.compactMode),
    requestExitConfirmation: settings.requestExitConfirmation !== false,
    checkUpdateOnStartup: settings.checkUpdateOnStartup !== false,
  };
}

function writeAppState(patch) {
  writeJSON(APP_STATE_PATH, { ...readAppState(), ...patch });
}

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function checkUpdate(silent) {
  const request = net.request(UPDATE_API);
  request.setHeader('User-Agent', 'Bamboo Todo');
  request.on('response', (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const release = JSON.parse(body);
        if (!release.tag_name) return;
        if (compareVersions(release.tag_name, app.getVersion()) > 0) {
          new Notification({
            title: '发现新版本',
            body: `Bamboo Todo ${release.tag_name} 已发布，请前往 GitHub 查看更新`
          }).show();
        } else if (!silent) {
          new Notification({ title: '检查更新', body: `当前 ${app.getVersion()} 已是最新版本` }).show();
        }
      } catch {
        if (!silent) new Notification({ title: '检查更新', body: '无法解析版本信息' }).show();
      }
    });
  });
  request.on('error', () => {
    if (!silent) new Notification({ title: '检查更新', body: '网络请求失败' }).show();
  });
  request.end();
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '搜索任务', accelerator: 'CmdOrCtrl+F', click: () => send('search') },
        { type: 'separator' },
        {
          label: '清单', submenu: [
            { label: '新建清单', accelerator: 'CmdOrCtrl+L', click: () => send('new-list') },
            { label: '重命名清单', accelerator: 'CmdOrCtrl+Shift+Y', click: () => send('rename-list') },
            { label: '删除清单', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('delete-list') },
            { type: 'separator' },
            { label: '折叠/展开已完成任务', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('hide-completed') },
          ]
        },
        {
          label: '任务', submenu: [
            { label: '新建任务', accelerator: 'CmdOrCtrl+N', click: () => send('new-todo') },
            { label: '删除任务', accelerator: 'CmdOrCtrl+D', click: () => send('delete-todo') },
            { label: '重命名任务', accelerator: 'CmdOrCtrl+T', click: () => send('rename-todo') },
            { type: 'separator' },
            { label: '完成任务', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('complete-todo') },
            { label: '添加到我的日', accelerator: 'CmdOrCtrl+K', click: () => send('add-my-day') },
            { label: '标记重要', accelerator: 'CmdOrCtrl+I', click: () => send('toggle-important') },
            { type: 'separator' },
            { label: '设置提醒', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('set-reminder') },
            { label: '设置截止日期', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('add-due-date') },
          ]
        },
        { type: 'separator' },
        {
          label: '跳转到', submenu: [
            { label: '我的一天', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('my-day') },
            { label: '重要', accelerator: 'CmdOrCtrl+Shift+I', click: () => send('important') },
            { label: '所有任务', accelerator: 'CmdOrCtrl+Shift+A', click: () => send('tasks') },
            { type: 'separator' },
            ...Array.from({ length: 9 }, (_, i) => ({
              label: `清单 ${i + 1}`, accelerator: `CmdOrCtrl+${i + 1}`,
              click: () => send('jump-list', i),
            })),
          ]
        },
        { label: '返回待办', click: () => send('return') },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { label: '退出', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => quitApp() },
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '主题模式', submenu: [
            { label: '深色主题', accelerator: 'CmdOrCtrl+H', click: () => send('toggle-mode', 'dark') },
            { label: '黑色主题', accelerator: 'CmdOrCtrl+B', click: () => send('toggle-mode', 'black') },
            { label: '棕褐色主题', accelerator: 'CmdOrCtrl+G', click: () => send('toggle-mode', 'sepia') },
            { label: '正常模式', accelerator: 'CmdOrCtrl+Shift+G', click: () => send('toggle-mode', 'normal') },
          ]
        },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: () => send('zoom-in') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => send('zoom-out') },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => send('zoom-reset') },
        { type: 'separator' },
        { label: '下一个清单', accelerator: 'CmdOrCtrl+Tab', click: () => send('next-list') },
        { label: '上一个清单', accelerator: 'CmdOrCtrl+Shift+Tab', click: () => send('prev-list') },
        { type: 'separator' },
        { label: '切换侧边栏', accelerator: 'CmdOrCtrl+O', click: () => send('toggle-sidebar') },
        { label: '紧凑模式', accelerator: 'CmdOrCtrl+Shift+J', click: () => send('toggle-compact') },
        {
          label: '始终置顶', id: 'always-on-top', type: 'checkbox', accelerator: 'CmdOrCtrl+Shift+O',
          checked: Boolean(readAppState().alwaysOnTop),
          click: (item) => {
            writeAppState({ alwaysOnTop: item.checked });
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setAlwaysOnTop(item.checked);
            }
            send('always-on-top', item.checked);
          }
        },
        { label: '全屏', accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          } },
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' },
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '检查更新', click: () => checkUpdate(false) },
        { label: '关于 Bamboo Todo', click: () => send('about') },
        { type: 'separator' },
        { label: '导出数据库为 JSON（降级旧版用）', click: () => exportJsonDialog() },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ]
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: '关于 Bamboo Todo' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

async function exportJsonDialog() {
  const db = getDb();
  if (!db) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择导出目录',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return;
  try {
    const files = exportDbToJson(db, result.filePaths[0]);
    new Notification({ title: '导出完成', body: `已导出到 ${files[0]}` }).show();
  } catch (e) {
    new Notification({ title: '导出失败', body: e.message }).show();
  }
}

function toggleWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon@32.png');
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('Bamboo Todo');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示窗口', click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.show();
        mainWindow.focus();
      } },
      { label: '退出', click: () => quitApp() },
    ]));
    tray.on('click', () => toggleWindowVisibility());
  } catch (e) {
    console.warn('无法创建托盘:', e.message);
  }
}

function setupGlobalShortcuts() {
  try {
    globalShortcut.register('CmdOrCtrl+Alt+C', () => send('popup-new-todo'));
    globalShortcut.register('CmdOrCtrl+Alt+F', () => send('popup-search'));
    globalShortcut.register('CmdOrCtrl+Alt+A', () => toggleWindowVisibility());
  } catch (e) {
    console.warn('全局快捷键注册失败:', e.message);
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    writeJSON(WINDOW_STATE_PATH, {
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    });
  } catch {}
}

function saveWindowStateDebounced() {
  if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
  saveWindowStateTimer = setTimeout(() => {
    saveWindowStateTimer = null;
    saveWindowState();
  }, 500);
}

function isInsideSomeDisplay(bounds) {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return false;
  return screen.getAllDisplays().some(d => {
    const { x, y, width, height } = d.workArea;
    return bounds.x >= x - 100 && bounds.y >= y - 50 &&
      bounds.x + 100 < x + width && bounds.y + 50 < y + height;
  });
}

function restoreWindowState() {
  const state = readJSON(WINDOW_STATE_PATH, {});
  const width = Math.max(900, Number(state.width) || 1200);
  const height = Math.max(600, Number(state.height) || 800);
  const visible = isInsideSomeDisplay({ x: state.x, y: state.y, width, height });
  return {
    width,
    height,
    x: visible ? state.x : undefined,
    y: visible ? state.y : undefined,
    isMaximized: Boolean(state.isMaximized),
  };
}

function createWindow() {
  const state = restoreWindowState();
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Bamboo Todo',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? {} : {
      titleBarOverlay: { ...overlayState },
      autoHideMenuBar: true,
    }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const appState = readAppState();

  mainWindow.webContents.once('dom-ready', () => {
    if (appState.compactMode) applyCompactMode(mainWindow, true);
    if (appState.checkUpdateOnStartup) checkUpdate(true);
  });

  mainWindow.loadURL('app://./index.html');
  createMenu();

  if (appState.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true);
  }

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  if (process.platform !== 'darwin') {
    createTray();
    setupGlobalShortcuts();
  }

  mainWindow.on('close', (e) => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }
    saveWindowState();
    if (isQuitting) return;
    const canMinimize = process.platform === 'darwin' ? Boolean(tray) : true;
    if (readAppState().requestExitConfirmation && canMinimize) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      isQuitting = true;
    }
  });

  mainWindow.on('resize', saveWindowStateDebounced);
  mainWindow.on('move', saveWindowStateDebounced);
  mainWindow.on('enter-full-screen', () => send('fullscreen-changed', true));
  mainWindow.on('leave-full-screen', () => send('fullscreen-changed', false));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });
}

function setupIPC() {
  ipcMain.handle('store:read', () => {
    const db = getDb();
    if (!db) return null;
    return repositories.readStore(db);
  });
  ipcMain.handle('store:write', (_, data) => {
    const db = getDb();
    if (!db) return { ok: false, error: '数据库未初始化' };
    try {
      return repositories.writeStore(db, data);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('themes:readUser', () => {
    const db = getDb();
    if (!db) return [];
    const mapper = require('./src/main/mapper');
    return mapper.assembleThemes(repositories.themes.selectAll(db));
  });
  ipcMain.handle('notify', (_, { title, body }) => {
    if (Notification.isSupported()) new Notification({ title, body }).show();
    return true;
  });
  ipcMain.handle('window:show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  ipcMain.handle('window:toggleFullscreen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
    return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen());
  });
  ipcMain.on('titlebar:set-overlay', (_, patch) => applyTitleBarOverlay(patch));
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPath', (_, name) => {
    const allowed = ['userData', 'temp', 'desktop', 'documents', 'downloads'];
    return allowed.includes(name) ? app.getPath(name) : null;
  });
  ipcMain.handle('app:checkUpdate', () => { checkUpdate(false); return true; });
  ipcMain.handle('app:quit', () => { quitApp(); return true; });

  ipcMain.on('menu:apply-setting', (_, { key, value }) => {
    const allowed = ['alwaysOnTop', 'compactMode', 'requestExitConfirmation', 'checkUpdateOnStartup'];
    if (!allowed.includes(key)) return;
    writeAppState({ [key]: Boolean(value) });
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (key === 'alwaysOnTop') mainWindow.setAlwaysOnTop(Boolean(value));
      if (key === 'compactMode') applyCompactMode(mainWindow, Boolean(value));
    }
  });
}

app.whenReady().then(() => {
  ensureDataDir();
  const { report } = initStorage(DATA_DIR, { appVersion: app.getVersion() });
  if (report.action === 'migrate' && !report.error) {
    const c = report.counts || {};
    queueMicrotask(() => {
      if (Notification.isSupported()) {
        new Notification({
          title: '数据迁移完成',
          body: `已将旧版 JSON 数据迁移到 SQLite（任务 ${c.tasks || 0} 条 / 清单 ${c.lists || 0} 个），原文件已归档`
        }).show();
      }
    });
  }
  setupIPC();
  const srcDir = path.join(__dirname, 'src');
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    const filePath = path.join(srcDir, decoded.replace(/^\//, ''));
    const relative = path.relative(srcDir, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') quitApp();
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (saveWindowStateTimer) {
    clearTimeout(saveWindowStateTimer);
    saveWindowStateTimer = null;
  }
  saveWindowState();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  const db = getDb();
  if (db) {
    try { db.close(); } catch {}
  }
});