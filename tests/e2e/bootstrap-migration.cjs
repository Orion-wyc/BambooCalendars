const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
require(path.join(REPO_ROOT, 'main.js'));
const storageInit = require(path.join(REPO_ROOT, 'src', 'main', 'storage-init.js'));
const repositories = require(path.join(REPO_ROOT, 'src', 'main', 'repositories'));

const SCENARIO = process.env.MIG_SCENARIO || 'migrate';
const results = [];
const errors = [];
const ok = (name, pass, extra) => results.push({
  name, pass: Boolean(pass), extra: pass ? '' : String(extra === undefined ? '' : extra),
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

process.on('uncaughtException', (e) => errors.push(`[main] ${(e && e.stack) || e}`));

function counts(db) {
  const q = (sql) => db.prepare(sql).get().n;
  return {
    tasks: q('SELECT COUNT(*) AS n FROM tasks'),
    lists: q('SELECT COUNT(*) AS n FROM lists'),
    tags: q('SELECT COUNT(*) AS n FROM tags'),
    taskTags: q('SELECT COUNT(*) AS n FROM task_tags'),
    subtasks: q('SELECT COUNT(*) AS n FROM subtasks'),
    themes: q('SELECT COUNT(*) AS n FROM themes'),
    settings: q('SELECT COUNT(*) AS n FROM settings'),
  };
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e, level, message) => {
    if (level >= 2 && !/Electron Security Warning/.test(message)) errors.push(`[renderer] ${message}`);
  });
  await sleep(2200);

  try {
    const dataDir = path.join(app.getPath('userData'), 'data');
    const dbPath = path.join(dataDir, 'bamboo.db');
    const jsonPath = path.join(dataDir, 'store.json');
    const legacyDir = path.join(dataDir, 'legacy');
    const db = storageInit.getDb();
    const report = storageInit.getReport();
    const c = db ? counts(db) : null;

    if (SCENARIO === 'migrate') {
      ok('迁移：判定为 migrate', report.action === 'migrate', report.action);
      ok('迁移：bamboo.db 已创建', fs.existsSync(dbPath));
      ok('迁移：store.json 已归档消失', !fs.existsSync(jsonPath));
      const legacyFiles = fs.existsSync(legacyDir) ? fs.readdirSync(legacyDir) : [];
      ok('迁移：store.json 归档存在', legacyFiles.some(f => /^store\.json\..*\.bak$/.test(f)), legacyFiles.join(','));
      ok('迁移：user-themes.json 归档存在', legacyFiles.some(f => /^user-themes\.json\..*\.bak$/.test(f)), legacyFiles.join(','));
      ok('迁移：任务行数正确', c.tasks === 2, JSON.stringify(c));
      ok('迁移：清单行数正确', c.lists === 2, c.lists);
      ok('迁移：标签与关联行正确', c.tags === 1 && c.taskTags === 1, `${c.tags}/${c.taskTags}`);
      ok('迁移：子任务行正确', c.subtasks === 1, c.subtasks);
      ok('迁移：用户主题入库', c.themes === 1, c.themes);
      ok('迁移：settings 入库', c.settings >= 2, c.settings);
      ok('迁移：meta 标记写入', Boolean(storageInit.getDb().prepare("SELECT value FROM meta WHERE key='json_migrated_at'").get()));
      const rendererTasks = await win.webContents.executeJavaScript(
        "(async () => { const { store } = await import('app://./js/Store.js'); return store.data.tasks.length; })()", true);
      ok('迁移：渲染进程读到迁移后任务', rendererTasks === 2, rendererTasks);
    } else if (SCENARIO === 'conflict') {
      ok('冲突：判定为 conflict', report.action === 'conflict', report.action);
      ok('冲突：store.json 被归档', !fs.existsSync(jsonPath));
      const legacyFiles = fs.existsSync(legacyDir) ? fs.readdirSync(legacyDir) : [];
      ok('冲突：归档带 conflict 前缀', legacyFiles.some(f => f.startsWith('conflict-store.json.')), legacyFiles.join(','));
      ok('冲突：既有数据未被覆盖', c.tasks === 2, JSON.stringify(c));
    } else if (SCENARIO === 'fresh') {
      ok('全新：判定为 fresh', report.action === 'fresh', report.action);
      ok('全新：空库已创建', fs.existsSync(dbPath) && c.tasks === 0, JSON.stringify(c));
      ok('全新：无迁移标记', !db.prepare("SELECT value FROM meta WHERE key='json_migrated_at'").get());
      const rendererLists = await win.webContents.executeJavaScript(
        "(async () => { const { store } = await import('app://./js/Store.js'); return store.data.lists.length; })()", true);
      ok('全新：渲染进程回退默认清单', rendererLists === 1, rendererLists);
    }

    const readBack = repositories.readStore(db);
    ok('读回：结构与旧 JSON 一致', readBack === null || (
      Array.isArray(readBack.lists) && Array.isArray(readBack.tasks) &&
      Array.isArray(readBack.tags) && typeof readBack.settings === 'object'
    ), typeof readBack);
  } catch (e) {
    errors.push(`[migration-smoke] ${(e && e.stack) || e}`);
  }

  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass).length;
  console.log('MIGRATION_RESULT ' + JSON.stringify({ scenario: SCENARIO, results, errors, pass, fail }));
  app.quit();
  setTimeout(() => process.exit(2), 5000);
});
