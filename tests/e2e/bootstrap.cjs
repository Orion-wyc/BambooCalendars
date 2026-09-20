const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu } = require('electron');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
require(path.join(REPO_ROOT, 'main.js'));

const results = [];
const errors = [];
const warnings = [];
const ok = (name, pass, extra) => results.push({
  name, pass: Boolean(pass), extra: pass ? '' : String(extra === undefined ? '' : extra),
});

process.on('uncaughtException', (e) => errors.push(`[main] ${(e && e.stack) || e}`));

const readJson = (p, fb) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function rendererChecks(win) {
  const script = fs.readFileSync(path.join(__dirname, 'smoke-page.js'), 'utf8');
  const out = await win.webContents.executeJavaScript(script, true);
  (out && out.results ? out.results : []).forEach(r => results.push(r));
}

async function inputChecks(win) {
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const countTasks = () => js(
    "(async () => { const { store } = await import('app://./js/Store.js'); return store.data.tasks.length; })()");

  ok('任务输入框存在', await js(`!!document.getElementById('task-input')`));
  const before = await countTasks();
  const box = await js(`(() => {
    const r = document.getElementById('task-input').getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);

  win.webContents.focus();
  win.webContents.sendInputEvent({ type: 'mouseDown', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await sleep(250);
  ok('BUG-47 真实鼠标点击可聚焦输入框',
    (await js(`document.activeElement && document.activeElement.id`)) === 'task-input',
    await js(`document.activeElement && (document.activeElement.id || document.activeElement.tagName)`));

  for (const ch of 'abc') {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch.toUpperCase() });
    win.webContents.sendInputEvent({ type: 'char', keyCode: ch, text: ch });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch.toUpperCase() });
    await sleep(50);
  }
  const typed = await js(`document.getElementById('task-input').value`);
  ok('BUG-47 真实键盘输入落入输入框', typed === 'abc', typed);

  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
  await sleep(350);
  const after = await countTasks();
  const last = await js(`(async () => {
    const { store } = await import('app://./js/Store.js');
    return { title: store.data.tasks.at(-1).title, input: document.getElementById('task-input').value };
  })()`);
  ok('BUG-47 真实回车创建任务', after === before + 1 && last.title === 'abc', JSON.stringify({ after, before, last }));
  ok('BUG-47 创建后输入框清空可继续输入', last.input === '', JSON.stringify(last));
}

async function mainChecks(win) {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const statePath = path.join(dataDir, 'app-state.json');
  const wsPath = path.join(dataDir, 'window-state.json');
  const storePath = path.join(dataDir, 'store.json');

  ok('窗口已显示', win.isVisible());

  win.setBounds({ width: 1000, height: 700 });
  await sleep(900);
  ok('BUG-24 resize 后防抖落盘', fs.existsSync(wsPath));
  const ws = readJson(wsPath, {});
  ok('BUG-24 保存的尺寸与窗口一致', ws.width === 1000 && ws.height === 700, JSON.stringify(ws));

  win.close();
  await sleep(400);
  ok('BUG-01 点击关闭 → 隐藏到托盘而非退出', !win.isDestroyed() && !win.isVisible());
  win.show();
  await sleep(200);

  const accs = [];
  const walk = (items) => items.forEach(it => {
    if (it.accelerator) accs.push(String(it.accelerator));
    if (it.submenu) walk(it.submenu.items);
  });
  walk(Menu.getApplicationMenu().items);
  const dup = accs.filter((a, i) => accs.indexOf(a) !== i);
  ok('BUG-09 菜单快捷键无重复', dup.length === 0, dup.join(','));
  ok('BUG-09 Escape 不再是菜单快捷键', !accs.some(a => /escape/i.test(a)));

  const top = Menu.getApplicationMenu().getMenuItemById('always-on-top');
  ok('BUG-35 置顶菜单项存在', Boolean(top));
  if (top) {
    top.click({}, top, win);
    await sleep(400);
    ok('BUG-43 置顶状态写入 app-state.json', readJson(statePath, {}).alwaysOnTop === true,
      JSON.stringify(readJson(statePath, {})));
    ok('窗口已置顶', win.isAlwaysOnTop());
    const storeJson = readJson(storePath, {});
    ok('渲染进程同步了置顶设置', Boolean(storeJson.settings) && storeJson.settings.alwaysOnTop === true,
      JSON.stringify(storeJson.settings));
    ok('BUG-06 store.json 结构完整',
      Array.isArray(storeJson.tasks) && Array.isArray(storeJson.lists) && Array.isArray(storeJson.tags));
    top.click({}, top, win);
    await sleep(300);
    ok('取消置顶生效', win.isAlwaysOnTop() === false);
  }

  const status = await win.webContents.executeJavaScript(
    "fetch('app://./../../main.js').then(r => r.status).catch(() => 0)", true);
  ok('BUG-26 app:// 目录穿越被拦截', status === 403 || status === 400 || status === 0, status);

  const loaded = await win.webContents.executeJavaScript(
    "fetch('app://./js/Utils.js').then(r => r.status).catch(() => 0)", true);
  ok('app:// 正常资源可加载', loaded === 200, loaded);
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e, level, message) => {
    if (level < 2) return;
    if (/Electron Security Warning/.test(message)) {
      warnings.push(`[renderer] ${message.split('\n')[0]}`);
      return;
    }
    errors.push(`[renderer] ${message}`);
  });
  win.webContents.on('preload-error', (e, p, err) => errors.push(`[preload] ${err}`));

  await sleep(1800);
  try {
    await rendererChecks(win);
    await inputChecks(win);
    await mainChecks(win);
  } catch (e) {
    errors.push(`[smoke] ${(e && e.stack) || e}`);
  }

  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass).length;
  console.log('SMOKE_RESULT ' + JSON.stringify({ results, errors, warnings, pass, fail }));

  const t0 = Date.now();
  app.on('will-quit', () => console.log(`SMOKE_QUIT_OK ${(Date.now() - t0)}ms`));
  app.quit();
  setTimeout(() => { console.log('SMOKE_QUIT_TIMEOUT'); process.exit(2); }, 5000);
});
