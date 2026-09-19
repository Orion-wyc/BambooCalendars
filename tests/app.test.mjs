import assert from 'node:assert/strict';
import { createSuite } from './helpers/runner.mjs';
import { mock, createElement } from './helpers/fakedom.mjs';

mock.stored = {
  lists: [{ id: 'tasks', name: '任务', order: 0 }],
  tasks: [],
  tags: [],
  settings: { compactMode: true, sideBarHidden: true, theme: 'ocean', mode: 'dark' },
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

test('BUG-10 启动时恢复紧凑模式与侧边栏状态', () => {
  const cls = document.documentElement.classList;
  assert.equal(cls.contains('compact-mode'), true);
  assert.equal(cls.contains('side-bar-hidden'), true);
});

test('启动时应用主题与显示模式', () => {
  assert.equal(store.getSettings().theme, 'ocean');
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

test('菜单动作分发：紧凑模式 / 置顶 / 主题模式', () => {
  mock.appliedSettings.length = 0;
  const before = store.getSettings().compactMode;
  app.handleAction('toggle-compact');
  assert.equal(store.getSettings().compactMode, !before);
  assert.equal(mock.appliedSettings.at(-1)[0], 'compactMode');

  app.handleAction('always-on-top', true);
  assert.equal(store.getSettings().alwaysOnTop, true);

  app.handleAction('toggle-mode', 'sepia');
  assert.equal(store.getSettings().mode, 'sepia');
  assert.equal(document.documentElement.classList.contains('sepia-mode'), true);
  app.handleAction('toggle-mode', 'sepia');
  assert.equal(store.getSettings().mode, 'normal', '再次切换应回到正常模式');
});

test('BUG-23 自动夜间模式不覆盖用户手选模式', async () => {
  const { theme } = await import('../src/js/Theme.js');
  theme.setUserMode('black');
  theme.setAutoNight(true);
  assert.equal(theme.userMode, 'black');
  assert.equal(theme.mode, 'black', '夜间也应保留用户选择的黑色模式');
  theme.refreshAutoNight(true);
  assert.equal(theme.mode, 'black');

  theme.setUserMode('normal');
  theme.refreshAutoNight(true);
  const expectDark = theme.isNightTime() ? 'dark' : 'normal';
  assert.equal(theme.mode, expectDark);
  theme.setAutoNight(false);
  assert.equal(theme.mode, 'normal', '关闭自动夜间后恢复用户模式');
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

process.exit(await run() ? 1 : 0);
