const { app, BrowserWindow, ipcMain, Notification, protocol, net, Menu, Tray, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const USER_THEMES_PATH = path.join(DATA_DIR, 'user-themes.json');

let mainWindow = null;
let tray = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return fallback; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function send(action, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', { action, data });
  }
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
            { label: '重命名清单', accelerator: 'CmdOrCtrl+Y', click: () => send('rename-list') },
            { label: '删除清单', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('delete-list') },
            { type: 'separator' },
            { label: '隐藏已完成任务', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('hide-completed') },
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
            { label: '已计划', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('planned') },
            { label: '所有任务', accelerator: 'CmdOrCtrl+Shift+A', click: () => send('tasks') },
            { type: 'separator' },
            ...Array.from({ length: 9 }, (_, i) => ({
              label: `清单 ${i + 1}`, accelerator: `CmdOrCtrl+${i + 1}`,
              click: () => send('jump-list', i),
            })),
          ]
        },
        { label: '返回待办', accelerator: 'Escape', click: () => send('return') },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { label: '退出', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() },
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
            { label: '正常模式', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('toggle-mode', 'normal') },
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
        {
          label: '始终置顶', type: 'checkbox', accelerator: 'CmdOrCtrl+Shift+P',
          click: (item) => {
            mainWindow.setAlwaysOnTop(item.checked);
            mainWindow.webContents.send('menu-action', { action: 'always-on-top', data: item.checked });
          }
        },
        { label: '全屏', accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
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
        { label: '关于 Bamboo Todo', click: () => send('about') },
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

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icons', 'icon.png');
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('Bamboo Todo');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示窗口', click: () => { mainWindow.show(); mainWindow.focus(); } },
      { label: '退出', click: () => app.quit() },
    ]));
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    console.warn('无法创建托盘:', e.message);
  }
}

function setupGlobalShortcuts() {
  try {
    globalShortcut.register('CmdOrCtrl+Alt+C', () => send('popup-new-todo'));
    globalShortcut.register('CmdOrCtrl+Alt+F', () => send('popup-search'));
    globalShortcut.register('CmdOrCtrl+Alt+A', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {}
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    writeJSON(path.join(DATA_DIR, 'window-state.json'), {
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    });
  } catch {}
}

function restoreWindowState() {
  const state = readJSON(path.join(DATA_DIR, 'window-state.json'), {});
  return {
    width: state.width || 1200,
    height: state.height || 800,
    x: state.x,
    y: state.y,
    isMaximized: state.isMaximized || false,
  };
}

function createWindow() {
  const state = restoreWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Bamboo Todo',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadURL('app://./index.html');
  createMenu();

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  if (process.platform !== 'darwin') {
    createTray();
    setupGlobalShortcuts();
  }

  mainWindow.on('close', (e) => {
    saveWindowState();
    const data = readJSON(STORE_PATH, { settings: {} });
    if (data.settings && data.settings.requestExitConfirmation !== false) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());

  mainWindow.on('closed', () => { mainWindow = null; });
}

function setupIPC() {
  ipcMain.handle('store:read', () => readJSON(STORE_PATH, null));
  ipcMain.handle('store:write', (_, data) => { writeJSON(STORE_PATH, data); return true; });
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
  ipcMain.handle('themes:readUser', () => readJSON(USER_THEMES_PATH, []));
  ipcMain.handle('themes:writeUser', (_, data) => { writeJSON(USER_THEMES_PATH, data); return true; });
  ipcMain.handle('notify', (_, { title, body }) => { new Notification({ title, body }).show(); return true; });
  ipcMain.handle('window:isMaximized', () => mainWindow && mainWindow.isMaximized());
  ipcMain.handle('window:show', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  ipcMain.handle('app:getPath', (_, name) => app.getPath(name));
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
    else if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  saveWindowState();
});