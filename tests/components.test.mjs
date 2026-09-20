import assert from 'node:assert/strict';
import { createSuite } from './helpers/runner.mjs';
import { mock, tree, createElement } from './helpers/fakedom.mjs';

const { store } = await import('../src/js/Store.js');
const { eventBus } = await import('../src/js/EventBus.js');
const { TaskDetail } = await import('../src/js/TaskDetail.js');
const { TaskList } = await import('../src/js/TaskList.js');
const { Settings } = await import('../src/js/Settings.js');
const { Pomodoro } = await import('../src/js/Pomodoro.js');
const { Sidebar } = await import('../src/js/Sidebar.js');

const { test, run } = createSuite('组件层回归（假 DOM）');

store.data = store.normalize(null);

const clickEvent = (target) => ({ target, stopPropagation() {}, preventDefault() {} });
const keyEvent = (target, key, opts = {}) => ({
  target, key, stopPropagation() {}, preventDefault() {}, ...opts,
});

test('BUG-02 关闭详情面板不再无限递归', () => {
  const detail = new TaskDetail();
  const task = store.createTask({ title: '递归测试' });
  let deselectCount = 0;
  eventBus.on('task:deselect', () => { deselectCount += 1; });

  detail.open(task.id);
  assert.equal(detail.isOpen(), true);
  detail.close();
  assert.equal(detail.isOpen(), false);
  assert.equal(deselectCount, 1, 'task:deselect 只应发出一次');
  detail.close();
  assert.equal(deselectCount, 1, '重复 close 不应再次发事件');
});

test('BUG-03 详情面板重复渲染不累积监听器', () => {
  const panel = document.getElementById('detail-panel');
  const base = {
    c: panel.listenerCount('click'),
    g: panel.listenerCount('change'),
    k: panel.listenerCount('keydown'),
  };
  const detail = new TaskDetail();
  const task = store.createTask({ title: '监听器测试' });
  detail.open(task.id);
  for (let i = 0; i < 6; i++) detail.render();
  assert.equal(panel.listenerCount('click') - base.c, 1);
  assert.equal(panel.listenerCount('change') - base.g, 1);
  assert.equal(panel.listenerCount('keydown') - base.k, 1);
});

test('BUG-03 设置面板重复渲染不累积监听器', () => {
  const settings = new Settings();
  settings.open();
  for (let i = 0; i < 6; i++) settings.render();
  assert.equal(settings.overlay.listenerCount('click'), 1);
  assert.equal(settings.overlay.listenerCount('change'), 1);
});

test('BUG-03 子任务点击一次只切换一次', () => {
  const detail = new TaskDetail();
  const task = store.createTask({ title: '子任务' });
  store.addSubtask(task.id, '步骤一');
  detail.open(task.id);
  detail.render();
  detail.render();

  const subId = store.data.tasks.find(t => t.id === task.id).subtasks[0].id;
  const target = createElement('div');
  target.dataset.action = 'toggle-subtask';
  target.dataset.subtaskId = subId;
  const wrapper = createElement('div');
  wrapper.appendChild(target);
  detail.panel.appendChild(wrapper);

  detail.panel.dispatch('click', clickEvent(target));
  assert.equal(store.data.tasks.find(t => t.id === task.id).subtasks[0].completed, true);
});

test('BUG-04 点击任务标题可打开详情（closest 委托）', () => {
  const list = new TaskList();
  const task = store.createTask({ title: '点击我' });
  let selected = null;
  eventBus.on('task:select', id => { selected = id; });

  const title = tree([
    { classes: ['task-item'], dataset: { taskId: task.id } },
    { classes: ['task-content'], dataset: { action: 'select', taskId: task.id } },
    { classes: ['task-title'], text: '点击我' },
  ]);
  list.handleAreaClick(clickEvent(title));
  assert.equal(selected, task.id);
  assert.equal(list.selectedTaskId, task.id);
});

test('BUG-04 复选框/星标/建议加号均可命中', () => {
  const list = new TaskList();
  const task = store.createTask({ title: '操作项' });
  const find = () => store.data.tasks.find(t => t.id === task.id);

  const checkbox = createElement('div');
  checkbox.dataset.action = 'toggle-complete';
  checkbox.dataset.taskId = task.id;
  list.handleAreaClick(clickEvent(checkbox));
  assert.equal(find().completed, true);

  const star = createElement('button');
  star.dataset.action = 'toggle-important';
  star.dataset.taskId = task.id;
  list.handleAreaClick(clickEvent(star));
  assert.equal(find().important, true);

  const plus = createElement('div');
  plus.classList.add('task-suggestion-add');
  plus.dataset.action = 'add-suggestion';
  plus.dataset.taskId = task.id;
  list.handleAreaClick(clickEvent(plus));
  assert.equal(find().inMyDay, true);
});

test('BUG-04 折叠区头部点击仍可切换', () => {
  const list = new TaskList();
  const before = list.collapsedSections.completed;
  const title = tree([
    { classes: ['task-section-header'], dataset: { section: 'completed' } },
    { classes: ['task-section-title'], text: '已完成' },
  ]);
  list.handleAreaClick(clickEvent(title));
  assert.equal(list.collapsedSections.completed, !before);
});

test('BUG-07 右键菜单「编辑标题」保留输入框', () => {
  const list = new TaskList();
  const task = store.createTask({ title: '待重命名' });
  list.handleContextAction('rename', task.id);
  assert.equal(list.editingTaskId, task.id);
  assert.match(document.getElementById('task-list-area').innerHTML, /inline-edit-input/);
  list.cancelInlineEdit();
  assert.equal(list.editingTaskId, null);
});

test('BUG-31 内联编辑提交与空值回退', () => {
  const list = new TaskList();
  const task = store.createTask({ title: '原标题' });
  list.startInlineEdit(task.id);

  const input = createElement('input');
  input.dataset.inlineEdit = task.id;
  input.value = '  新标题  ';
  list.commitInlineEdit(input);
  assert.equal(store.data.tasks.find(t => t.id === task.id).title, '新标题');
  assert.equal(list.editingTaskId, null);

  list.startInlineEdit(task.id);
  const empty = createElement('input');
  empty.dataset.inlineEdit = task.id;
  empty.value = '   ';
  list.commitInlineEdit(empty);
  assert.equal(store.data.tasks.find(t => t.id === task.id).title, '新标题', '空标题应回退');
});

test('BUG-08 排序方式 change 事件生效', () => {
  const settings = new Settings();
  settings.open();
  const select = createElement('select');
  select.id = 'setting-sort-by';
  select.value = 'alpha';
  settings.overlay.appendChild(select);
  settings.handleChange({ target: select });
  assert.equal(store.getSettings().sortBy, 'alpha');
  store.updateSettings({ sortBy: 'created' });
});

test('BUG-13/14 侧边栏渲染与内置清单保护', () => {
  const sidebar = new Sidebar();
  const html = document.getElementById('sidebar-lists').innerHTML;
  assert.match(html, /btn-rename-list/);
  assert.doesNotMatch(html, /data-list-id="tasks"[\s\S]*?btn-delete-list/);
  sidebar.render();
  sidebar.deleteList('tasks');
  assert.ok(store.getList('tasks'), '内置清单不应被删除');
});

test('BUG-16 重渲染不清空搜索框', () => {
  const sidebar = new Sidebar();
  const input = document.getElementById('search-input');
  input.value = '关键词';
  sidebar.update();
  sidebar.update();
  assert.equal(document.getElementById('search-input').value, '关键词');
  assert.equal(document.getElementById('search-input'), input, '搜索框元素不应被重建');
});

test('BUG-39 任务输入框草稿在重渲染后保留', () => {
  const list = new TaskList();
  const input = document.getElementById('task-input');
  input.value = '写到一半';
  input.focus();
  list.render();
  assert.equal(document.getElementById('task-input').value, '写到一半');
  document.getElementById('task-input').value = '';
});

test('BUG-37 设置页签包含标签管理', () => {
  const settings = new Settings();
  settings.open();
  assert.match(settings.overlay.innerHTML, /data-tab="tags"/);
  settings.currentTab = 'tags';
  settings.render();
  assert.match(settings.overlay.innerHTML, /tag-manager/);
  assert.ok(settings.overlay.querySelector('#new-tag-name'));
});

test('BUG-28 快捷键说明与实际一致', () => {
  const settings = new Settings();
  settings.open();
  const html = settings.overlay.innerHTML;
  assert.match(html, /Ctrl\/Cmd \+ , 打开设置/);
  assert.doesNotMatch(html, /Ctrl\/Cmd \+ \. 打开设置/);
  assert.match(html, /Ctrl\/Cmd \+ Shift \+ J 紧凑模式/);
  assert.match(html, /Ctrl\/Cmd \+ Shift \+ G 正常模式/);
});

test('设置开关写入 store 并同步主进程', () => {
  const settings = new Settings();
  mock.appliedSettings.length = 0;
  settings.open();
  settings.toggleSetting('compactMode');
  assert.equal(store.getSettings().compactMode, true);
  assert.deepEqual(mock.appliedSettings.at(-1), ['compactMode', true]);
  assert.equal(document.documentElement.classList.contains('compact-mode'), true);
  settings.toggleSetting('compactMode');
  assert.equal(store.getSettings().compactMode, false);
  settings.toggleSetting('requestExitConfirmation');
  assert.equal(store.getSettings().requestExitConfirmation, false);
  assert.deepEqual(mock.appliedSettings.at(-1), ['requestExitConfirmation', false]);
  settings.toggleSetting('requestExitConfirmation');
});

test('BUG-21 番茄钟启动后第一秒不跳秒', () => {
  const p = new Pomodoro();
  p.stop();
  p.start();
  const left = p.remainingSeconds();
  assert.ok(left > 25 * 60 - 2 && left <= 25 * 60, `应接近 1500 秒，实际 ${left}`);
  p.pause();
  assert.equal(p.isRunning, false);
  const paused = p.remainingSeconds();
  p.start();
  assert.ok(Math.abs(p.remainingSeconds() - paused) <= 1, '继续应从暂停处开始');
  p.stop();
});

test('BUG-40 番茄钟 endsAt 在启动时被正确赋值', () => {
  const p = new Pomodoro();
  p.stop();
  p.start();
  assert.ok(p.endsAt > Date.now(), 'endsAt 应在未来');
  assert.ok(p.endsAt - Date.now() > 24 * 60 * 1000, 'endsAt 应约等于 25 分钟后');
  p.stop();
});

test('BUG-21 番茄钟完成一段后切换并计数', () => {
  const p = new Pomodoro();
  p.stop();
  const before = store.getPomodoroSessions();
  p.start();
  p.endsAt = Date.now() - 10;
  p.tick();
  assert.equal(p.isWork, false);
  assert.equal(p.remaining, p.breakDuration);
  assert.equal(store.getPomodoroSessions(), before + 1);
  p.isRunning = true;
  p.endsAt = Date.now() - 10;
  p.tick();
  assert.equal(p.isWork, true);
  assert.equal(p.remaining, p.workDuration);
  assert.equal(store.getPomodoroSessions(), before + 1, '休息结束不计数');
  p.stop();
});

test('BUG-21 隐藏面板不中断计时', () => {
  const p = new Pomodoro();
  p.stop();
  p.start();
  p.hide();
  assert.equal(p.isRunning, true);
  assert.ok(p.remainingSeconds() > 24 * 60);
  p.show();
  assert.equal(p.visible, true);
  p.stop();
});

test('BUG-20 无选中任务时删除/完成/重要均为 no-op', () => {
  const list = new TaskList();
  list.selectedTaskId = null;
  const count = store.data.tasks.length;
  list.deleteSelectedTask();
  list.toggleCompleteSelected();
  list.toggleImportantSelected();
  list.toggleMyDaySelected();
  assert.equal(store.data.tasks.length, count);
});

test('删除任务后发出 task:deleted 并清空选中', () => {
  const list = new TaskList();
  const task = store.createTask({ title: '将被删除' });
  list.selectedTaskId = task.id;
  let deletedId = null;
  eventBus.on('task:deleted', id => { deletedId = id; });
  list.deleteSelectedTask();
  assert.equal(deletedId, task.id);
  assert.equal(list.selectedTaskId, null);
  assert.equal(store.data.tasks.some(t => t.id === task.id), false);
});

test('BUG-15 渲染输出对标题/标签/清单名转义', () => {
  const list = new TaskList();
  const evil = store.createTag('<img src=x onerror=alert(1)>', '#123456');
  const task = store.createTask({ title: '"><script>alert(1)</script>', tags: [evil.id] });
  const html = list.renderTaskItem(task);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);

  list.searchQuery = '<b>x</b>';
  list.renderHeader();
  assert.doesNotMatch(document.getElementById('list-header').innerHTML, /<b>x<\/b>/);
  list.searchQuery = '';

  const detail = new TaskDetail();
  const quoted = store.createTask({ title: '" onfocus="alert(1)" autofocus="' });
  detail.open(quoted.id);
  assert.doesNotMatch(detail.panel.innerHTML, /onfocus="alert\(1\)"/);
});

test('BUG-44 视图与筛选上下文被新建任务继承', () => {
  const list = new TaskList();
  list.setView('my-day');
  const input = document.getElementById('task-input');
  input.value = '我的一天新任务';
  list.createTaskFromInput(input);
  const created = store.data.tasks.find(t => t.title === '我的一天新任务');
  assert.equal(created.inMyDay, true);

  list.setView('tasks');
  list.filterPriority = 2;
  const input2 = document.getElementById('task-input');
  input2.value = '带优先级的任务';
  list.createTaskFromInput(input2);
  assert.equal(store.data.tasks.find(t => t.title === '带优先级的任务').priority, 2);
  list.filterPriority = null;
});

test('BUG-17 搜索无结果时展示搜索空状态', () => {
  const list = new TaskList();
  list.setView('tasks');
  list.setSearch('绝对不存在的关键词zzz');
  assert.match(document.getElementById('task-list-area').innerHTML, /未找到匹配任务/);
  list.setSearch('');
});

test('BUG-47 输入法合成态 Enter 不提交任务、不清空输入框', () => {
  const list = new TaskList();
  const area = document.getElementById('task-input-area');
  list.render();
  const input = document.getElementById('task-input');
  input.value = 'mai cai';
  const before = store.data.tasks.length;

  area.dispatch('keydown', keyEvent(input, 'Enter', { keyCode: 229, isComposing: true }));
  assert.equal(store.data.tasks.length, before, '合成态 Enter 不应创建任务');
  assert.equal(document.getElementById('task-input').value, 'mai cai', '合成态 Enter 不应清空输入框');

  input.value = '买菜';
  area.dispatch('keydown', keyEvent(input, 'Enter'));
  assert.equal(store.data.tasks.length, before + 1, '合成结束后 Enter 应正常提交');
  assert.equal(store.data.tasks.at(-1).title, '买菜');
});

test('BUG-47 子任务输入框同样忽略合成态 Enter', () => {
  const holder = createElement('div');
  holder.innerHTML = '<div id="detail-panel" class="hidden"></div>';
  const detail = new TaskDetail();
  const task = store.createTask({ title: 'IME 子任务' });
  detail.open(task.id);
  const subInput = document.getElementById('add-subtask-input');
  subInput.value = 'xi zao';
  detail.panel.appendChild(subInput);

  detail.panel.dispatch('keydown', keyEvent(subInput, 'Enter', { keyCode: 229, isComposing: true }));
  assert.equal(store.data.tasks.find(t => t.id === task.id).subtasks.length, 0);

  detail.panel.dispatch('keydown', keyEvent(subInput, 'Enter'));
  assert.deepEqual(store.data.tasks.find(t => t.id === task.id).subtasks.map(s => s.title), ['xi zao']);
});

test('BUG-47 内联编辑合成态 Enter 不提交、Esc 不取消', () => {
  const list = new TaskList();
  const task = store.createTask({ title: '内联IME' });
  list.startInlineEdit(task.id);
  const area = document.getElementById('task-list-area');
  const input = createElement('input');
  input.dataset.inlineEdit = task.id;
  input.value = 'gai ming';

  area.dispatch('keydown', keyEvent(input, 'Enter', { keyCode: 229, isComposing: true }));
  assert.equal(store.data.tasks.find(t => t.id === task.id).title, '内联IME');
  assert.equal(list.editingTaskId, task.id, '合成态 Enter 不应结束编辑');

  area.dispatch('keydown', keyEvent(input, 'Escape', { keyCode: 229, isComposing: true }));
  assert.equal(list.editingTaskId, task.id, '合成态 Esc 应交给输入法取消候选');

  input.value = '改名';
  area.dispatch('keydown', keyEvent(input, 'Enter'));
  assert.equal(store.data.tasks.find(t => t.id === task.id).title, '改名');
});

test('BUG-47 搜索框合成态 Esc 不清空关键词', () => {
  const sidebar = new Sidebar();
  const input = document.getElementById('search-input');
  input.value = 'guan jian ci';
  input.dispatch('keydown', keyEvent(input, 'Escape', { keyCode: 229, isComposing: true }));
  assert.equal(input.value, 'guan jian ci');
  input.dispatch('keydown', keyEvent(input, 'Escape'));
  assert.equal(input.value, '');
});

test('BUG-47 重渲染不重建输入框，合成状态不被打断', () => {
  const list = new TaskList();
  list.render();
  const input = document.getElementById('task-input');
  input.value = '正在输入';
  input.focus();
  list.render();
  list.render();
  assert.equal(document.getElementById('task-input'), input, '输入框元素应保持不变');
  assert.equal(document.getElementById('task-input').value, '正在输入');
  assert.equal(document.activeElement, input, '焦点应保持在输入框');
  document.getElementById('task-input').value = '';
});

test('BUG-48 设置面板重渲染保持滚动位置', () => {
  const settings = new Settings();
  settings.open();
  settings.overlay.querySelector('.settings-content').scrollTop = 300;
  settings.render();
  assert.equal(settings.overlay.querySelector('.settings-content').scrollTop, 300, '同页签重渲染应保持滚动位置');
  settings.render();
  assert.equal(settings.overlay.querySelector('.settings-content').scrollTop, 300);

  settings.currentTab = 'tags';
  settings.render();
  assert.equal(settings.overlay.querySelector('.settings-content').scrollTop, 0, '切换页签应回到顶部');
  settings.close();
});

test('BUG-48 设置面板重新打开回到顶部', () => {
  const settings = new Settings();
  settings.open();
  settings.overlay.querySelector('.settings-content').scrollTop = 200;
  settings.close();
  settings.open();
  assert.equal(settings.overlay.querySelector('.settings-content').scrollTop, 0);
  settings.close();
});

test('BUG-48 详情面板同任务重渲染保持滚动位置，换任务回到顶部', () => {
  const holder = createElement('div');
  holder.innerHTML = '<div id="detail-panel" class="hidden"></div>';
  const detail = new TaskDetail();
  const a = store.createTask({ title: '滚动A' });
  const b = store.createTask({ title: '滚动B' });

  detail.open(a.id);
  detail.panel.querySelector('.detail-content').scrollTop = 180;
  detail.render();
  assert.equal(detail.panel.querySelector('.detail-content').scrollTop, 180, '同任务重渲染应保持滚动位置');

  detail.open(b.id);
  assert.equal(detail.panel.querySelector('.detail-content').scrollTop, 0, '切换到其他任务应回到顶部');
});

test('BUG-50 番茄钟时长按设置生效并可调整', () => {
  store.updateSettings({ pomodoroWorkMinutes: 50, pomodoroBreakMinutes: 10 });
  const p = new Pomodoro();
  assert.equal(p.workDuration, 50 * 60);
  assert.equal(p.breakDuration, 10 * 60);
  assert.equal(p.remaining, 50 * 60);
  assert.equal(p.formatTime(p.remainingSeconds()), '50:00');

  store.updateSettings({ pomodoroWorkMinutes: 30 });
  assert.equal(p.applySettings(), true);
  assert.equal(p.workDuration, 30 * 60);
  assert.equal(p.remaining, 30 * 60, '空闲时调整应立即生效');
  assert.equal(p.applySettings(), false, '无变化时不重复渲染');

  p.start();
  store.updateSettings({ pomodoroWorkMinutes: 45 });
  p.applySettings();
  assert.equal(p.workDuration, 45 * 60);
  assert.ok(p.remainingSeconds() > 29 * 60, '进行中的番茄不应被打断');
  p.stop();
  assert.equal(p.remaining, 45 * 60, '重置后使用新时长');

  store.updateSettings({ pomodoroWorkMinutes: 25, pomodoroBreakMinutes: 5 });
  p.applySettings();
});

test('BUG-50 休息阶段使用休息时长', () => {
  store.updateSettings({ pomodoroWorkMinutes: 1, pomodoroBreakMinutes: 7 });
  const p = new Pomodoro();
  p.start();
  p.endsAt = Date.now() - 10;
  p.tick();
  assert.equal(p.isWork, false);
  assert.equal(p.remaining, 7 * 60);
  assert.equal(p.formatTime(p.remainingSeconds()), '07:00');
  p.stop();
  store.updateSettings({ pomodoroWorkMinutes: 25, pomodoroBreakMinutes: 5 });
});

process.exit(await run() ? 1 : 0);
