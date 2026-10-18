import assert from 'node:assert/strict';
import { createSuite } from './helpers/runner.mjs';
import { mock, createElement, runtimeErrors } from './helpers/fakedom.mjs';

mock.stored = {
  lists: [{ id: 'tasks', name: '任务', order: 0 }],
  tasks: [],
  tags: [],
  settings: { compactMode: true, theme: 'dark' },
};

const { store } = await import('../src/js/Store.js');
const { eventBus } = await import('../src/js/EventBus.js');
const U = await import('../src/js/Utils.js');
const { app } = await import('../src/js/App.js');

await new Promise(r => setTimeout(r, 10));

const { test, run } = createSuite('App 编排层回归');

const keyEvent = (key, opts = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: createElement('div'),
  preventDefault() {},
  ...opts,
});

test('BUG-10 启动时恢复紧凑模式', () => {
  const cls = document.documentElement.classList;
  assert.equal(cls.contains('compact-mode'), true);
});

test('启动时应用深色主题', () => {
  assert.equal(store.getSettings().theme, 'dark');
  assert.equal(document.documentElement.classList.contains('dark-mode'), true);
});

test('BUG-19 输入框内不触发全局快捷键', () => {
  let focused = 0;
  const original = app.taskList.focusInput;
  app.taskList.focusInput = () => { focused += 1; };

  document.dispatch('keydown', keyEvent('n', { ctrlKey: true, target: createElement('input') }));
  assert.equal(focused, 0, '输入框内 Ctrl+N 不应触发');

  document.dispatch('keydown', keyEvent('n', { ctrlKey: true }));
  assert.equal(focused, 1, '普通区域 Ctrl+N 应触发');
  app.taskList.focusInput = original;
});

test('BUG-19 Alt 组合键留给全局快捷键', () => {
  let opened = 0;
  const original = app.settings.open;
  app.settings.open = () => { opened += 1; };
  document.dispatch('keydown', keyEvent(',', { ctrlKey: true, altKey: true }));
  assert.equal(opened, 0);
  app.settings.open = original;
});

test('BUG-27 快捷键映射：Ctrl+1-9 跳清单，Shift+M 跳我的一天', () => {
  const calls = [];
  const spy = (obj, method) => {
    const original = obj[method];
    obj[method] = (...args) => { calls.push([method, ...args]); return original.apply(obj, args); };
    return () => { obj[method] = original; };
  };
  const restore = [spy(app.sidebar, 'jumpToList'), spy(app.sidebar, 'jumpToView')];

  document.dispatch('keydown', keyEvent('1', { ctrlKey: true }));
  document.dispatch('keydown', keyEvent('9', { ctrlKey: true }));
  document.dispatch('keydown', keyEvent('m', { ctrlKey: true, shiftKey: true }));
  restore.forEach(r => r());

  assert.deepEqual(calls.filter(c => c[0] === 'jumpToList'), [['jumpToList', 0], ['jumpToList', 8]]);
  assert.deepEqual(calls.filter(c => c[0] === 'jumpToView'), [['jumpToView', 'my-day']]);
});

test('BUG-41 Esc 分层关闭：设置 → 右键菜单 → 详情面板', () => {
  const task = store.createTask({ title: 'Esc 测试' });
  app.taskDetail.open(task.id);
  app.settings.open();

  const esc = () => document.dispatch('keydown', keyEvent('Escape'));

  esc();
  assert.equal(app.settings.isOpen, false);
  assert.equal(app.taskDetail.isOpen(), true, '详情面板不应被同时关闭');

  app.taskList.contextMenu = { contains: () => true, remove() { app.taskList.contextMenu = null; } };
  esc();
  assert.equal(app.taskList.contextMenu, null);
  assert.equal(app.taskDetail.isOpen(), true);

  esc();
  assert.equal(app.taskDetail.isOpen(), false);
  assert.equal(app.dismissOverlays(), false, '无可关闭层时返回 false');
});

test('BUG-22 提醒只通知一次并标记', () => {
  mock.notifications.length = 0;
  const soon = store.createTask({ title: '即将提醒' });
  store.updateTask(soon.id, { reminder: U.toDateTimeLocalValue(new Date(Date.now() + 30000)) });

  app.checkReminders();
  app.checkReminders();
  app.checkReminders();

  assert.equal(mock.notifications.filter(n => n.includes('即将提醒')).length, 1);
  assert.equal(store.data.tasks.find(t => t.id === soon.id).reminderNotified, true);
});

test('BUG-22 刚错过的提醒补发一次，久远的静默标记', () => {
  mock.notifications.length = 0;
  const missed = store.createTask({ title: '错过五分钟' });
  store.updateTask(missed.id, { reminder: U.toDateTimeLocalValue(new Date(Date.now() - 5 * 60000)) });
  const old = store.createTask({ title: '错过两小时' });
  store.updateTask(old.id, { reminder: U.toDateTimeLocalValue(new Date(Date.now() - 2 * 3600000)) });

  app.checkReminders();

  assert.equal(mock.notifications.filter(n => n.includes('错过五分钟')).length, 1);
  assert.equal(mock.notifications.filter(n => n.includes('已错过')).length, 1);
  assert.equal(mock.notifications.filter(n => n.includes('错过两小时')).length, 0);
  assert.equal(store.data.tasks.find(t => t.id === old.id).reminderNotified, true);
});

test('BUG-22 已完成任务与未来提醒不通知', () => {
  mock.notifications.length = 0;
  const done = store.createTask({ title: '已完成' });
  store.updateTask(done.id, { reminder: U.toDateTimeLocalValue(new Date(Date.now() + 10000)) });
  store.toggleComplete(done.id);
  const future = store.createTask({ title: '一小时后' });
  store.updateTask(future.id, { reminder: U.toDateTimeLocalValue(new Date(Date.now() + 3600000)) });

  app.checkReminders();
  assert.equal(mock.notifications.length, 0);
});

test('菜单动作分发：紧凑模式 / 置顶 / 主题切换', () => {
  mock.appliedSettings.length = 0;
  const before = store.getSettings().compactMode;
  app.handleAction('toggle-compact');
  assert.equal(store.getSettings().compactMode, !before);
  assert.equal(mock.appliedSettings.at(-1)[0], 'compactMode');

  app.handleAction('always-on-top', true);
  assert.equal(store.getSettings().alwaysOnTop, true);

  app.handleAction('select-theme', 'light');
  assert.equal(store.getSettings().theme, 'light');
  assert.equal(document.documentElement.classList.contains('dark-mode'), false);
  app.handleAction('select-theme', 'dark');
  assert.equal(store.getSettings().theme, 'dark');
  assert.equal(document.documentElement.classList.contains('dark-mode'), true);
});

test('BUG-23 自动夜间模式不覆盖用户手选主题', async () => {
  const { theme } = await import('../src/js/Theme.js');
  const night = theme.isNightTime();
  theme.setUserTheme('dark');
  theme.setAutoNight(true);
  assert.equal(theme.userTheme, 'dark');
  assert.equal(theme.currentTheme, 'dark');
  theme.refreshAutoNight(true);
  assert.equal(theme.currentTheme, 'dark');

  theme.setUserTheme('light');
  assert.equal(theme.userTheme, 'light');
  assert.equal(theme.currentTheme, night ? 'dark' : 'light',
    '夜间开启自动夜间时手动选浅色，呈现应保持深色');
  theme.refreshAutoNight();
  assert.equal(theme.currentTheme, night ? 'dark' : 'light',
    '定时器非 force 路径不得把夜间手动选择误恢复为浅色');

  theme.setUserTheme('passion');
  assert.equal(theme.userTheme, 'passion');
  assert.equal(theme.currentTheme, night ? 'passion-dark' : 'passion',
    '自动夜间下 Passion 应切至自身深色变体而非通用深色');
  assert.equal(document.documentElement.classList.contains('dark-mode'), night);
  theme.setUserTheme('light');
  theme.refreshAutoNight();
  theme.setAutoNight(false);
  assert.equal(theme.currentTheme, 'light', '关闭自动夜间后恢复用户主题');
});

test('BUG-33 add-my-day 只作用于选中任务', () => {
  const a = store.createTask({ title: '任务A' });
  store.createTask({ title: '任务B' });
  app.taskList.selectedTaskId = null;
  app.handleAction('add-my-day');
  assert.equal(store.data.tasks.filter(t => t.inMyDay).length, 0, '无选中时不应误改任务');

  app.taskList.selectedTaskId = a.id;
  app.handleAction('add-my-day');
  assert.equal(store.data.tasks.find(t => t.id === a.id).inMyDay, true);
});

test('BUG-32 删除清单后详情面板自动关闭', () => {
  const list = store.createList('临时清单');
  const task = store.createTask({ title: '清单内任务', listId: list.id });
  app.taskDetail.open(task.id);
  assert.equal(app.taskDetail.isOpen(), true);
  store.deleteList(list.id);
  eventBus.emit('list:delete', list.id);
  assert.equal(app.taskDetail.isOpen(), false);
});

test('BUG-30 数据变更会落盘', async () => {
  const before = mock.writes.length;
  store.createTask({ title: '落盘测试' });
  assert.equal(store.dirty, true, '变更后应标记为脏');
  assert.equal(await store.flush(), true);
  assert.ok(mock.writes.length > before);
  assert.ok(mock.writes.at(-1).tasks.some(t => t.title === '落盘测试'));
});

test('主题 surfaces 覆盖中性面变量并回落（camelCase/kebab 均可）', async () => {
  const { theme, SURFACE_KEYS } = await import('../src/js/Theme.js');
  const recorded = {};
  const realStyle = document.documentElement.style;
  document.documentElement.style = {
    setProperty: (k, v) => { recorded[k] = String(v); },
    removeProperty: (k) => { delete recorded[k]; },
  };
  try {
    theme.userThemes = [{
      id: 'probe', name: 'Probe', darkSurfaces: true,
      colors: {
        primary: '#101010', accent: '#202020', secondary: '#303030', sidebarBg: '#000000',
        surfaces: {
          bgMain: '#123456', bgPanel: '#654321', bgHover: '#111111', bgActive: '#222222',
          border: '#333333', borderLight: '#444444', borderSoft: 'rgba(1,2,3,0.4)',
          textPrimary: '#abcabc', textSecondary: '#bcbcbc', textMuted: '#cdcdcd',
        },
      },
    }];
    theme.apply('probe');
    SURFACE_KEYS.forEach(key => {
      assert.ok(Object.prototype.hasOwnProperty.call(recorded, key), `surfaces 应设置 ${key}`);
      assert.notEqual(recorded[key], '', `surfaces ${key} 不应为空`);
    });
    assert.equal(recorded['--bg-main'], '#123456');
    assert.equal(recorded['--text-primary'], '#abcabc');
    assert.equal(recorded['--border-soft'], 'rgba(1,2,3,0.4)');

    // kebab 写法同样解析
    theme.userThemes = [{
      id: 'probe2', name: 'Probe2', colors: {
        primary: '#000000', accent: '#000000', secondary: '#000000', sidebarBg: '#000000',
        surfaces: { 'bg-main': '#abcdef' },
      },
    }];
    theme.apply('probe2');
    assert.equal(recorded['--bg-main'], '#abcdef');

    // 切换到无 surfaces 主题：中性面应被移除（回落 :root/类），不得残留
    theme.userThemes = [];
    theme.apply('light');
    SURFACE_KEYS.forEach(key => {
      assert.ok(!Object.prototype.hasOwnProperty.call(recorded, key), `切到无 surfaces 主题后 ${key} 应被清除`);
    });
  } finally {
    document.documentElement.style = realStyle;
  }
});

test('运行期间无未处理异常或被吞掉的 Promise 拒绝', async () => {
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(runtimeErrors, []);
});

process.exit(await run() ? 1 : 0);
