import assert from 'node:assert/strict';
import { createSuite } from './helpers/runner.mjs';
import { mock, runtimeErrors } from './helpers/fakedom.mjs';

const { Store } = await import('../src/js/Store.js');
const U = await import('../src/js/Utils.js');

const { test, run } = createSuite('Store / Utils 逻辑回归');

function freshStore(data) {
  const s = new Store();
  s.data = s.normalize(data);
  return s;
}

test('BUG-06 部分结构的 store.json 可被归一化', () => {
  const s = freshStore({ settings: { alwaysOnTop: true } });
  assert.equal(Array.isArray(s.data.lists), true);
  assert.equal(s.data.lists[0].id, 'tasks');
  assert.equal(Array.isArray(s.data.tasks), true);
  assert.equal(s.data.settings.alwaysOnTop, true);
  assert.equal(s.data.settings.sortBy, 'created');
  assert.equal(s.getLists().length, 1);
});

test('BUG-06 非法/损坏数据回退到默认结构', () => {
  [null, undefined, 'x', 42, { tasks: 'nope', lists: null }].forEach(bad => {
    const s = freshStore(bad);
    assert.equal(s.data.lists.length, 1);
    assert.equal(s.data.tasks.length, 0);
  });
});

test('BUG-06 旧版任务字段自动补齐', () => {
  const s = freshStore({ tasks: [{ id: 'a1', title: '老任务' }] });
  const t = s.data.tasks[0];
  assert.deepEqual(t.tags, []);
  assert.deepEqual(t.subtasks, []);
  assert.equal(t.priority, 4);
  assert.equal(t.repeat, 'none');
  assert.equal(t.listId, 'tasks');
  assert.equal(t.reminderNotified, false);
  assert.equal(typeof t.order, 'number');
});

test('BUG-06 未知清单/标签引用被纠正，重复 id 被去重', () => {
  const s = freshStore({
    lists: [{ id: 'tasks', name: '任务' }],
    tags: [{ id: 't1', name: 'A', color: '#123456' }],
    tasks: [
      { id: 'x1', title: 'A', listId: 'ghost', tags: ['ghost', 't1'] },
      { id: 'x1', title: '重复', listId: 'tasks' },
    ],
  });
  assert.equal(s.data.tasks.length, 1);
  assert.equal(s.data.tasks[0].listId, 'tasks');
  assert.deepEqual(s.data.tasks[0].tags, ['t1']);
});

test('BUG-05 最近 7 天的日期 key 使用本地时区', () => {
  const s = freshStore(null);
  const groups = s.getNext7Days();
  assert.equal(groups[0].date, U.toDateKey(new Date()));
  assert.equal(groups[0].label, '今天');
  assert.equal(groups[1].date, U.toDateKey(U.addDays(new Date(), 1)));
  for (let i = 1; i < 7; i++) {
    assert.equal(U.diffDays(U.parseDateKey(groups[i].date), U.parseDateKey(groups[i - 1].date)), 1);
  }
});

test('BUG-05 日历按月取任务不再漏掉 1 号', () => {
  const s = freshStore({
    tasks: [
      { id: 'a', title: '月初', dueDate: '2026-09-01' },
      { id: 'b', title: '月末', dueDate: '2026-09-30' },
      { id: 'c', title: '下月', dueDate: '2026-10-01' },
    ],
  });
  assert.deepEqual(s.getCalendarTasks(2026, 8).map(t => t.id).sort(), ['a', 'b']);
});

test('BUG-05 最近 7 天分组边界正确', () => {
  const day = n => U.toDateKey(U.addDays(new Date(), n));
  const s = freshStore({
    tasks: [
      { id: 'y', title: 'y', dueDate: day(-1) },
      { id: 't', title: 't', dueDate: day(0) },
      { id: 'm', title: 'm', dueDate: day(1) },
      { id: 'w', title: 'w', dueDate: day(3) },
      { id: 'l', title: 'l', dueDate: day(6) },
      { id: 'o', title: 'o', dueDate: day(7) },
      { id: 'd', title: 'd', dueDate: day(2), completed: true },
    ],
  });
  const groups = s.getNext7Days();
  assert.equal(groups.length, 7);
  assert.deepEqual(groups[0].tasks.map(t => t.id), ['t']);
  assert.deepEqual(groups[1].tasks.map(t => t.id), ['m']);
  assert.deepEqual(groups[3].tasks.map(t => t.id), ['w']);
  assert.deepEqual(groups[6].tasks.map(t => t.id), ['l']);
  assert.equal(groups.reduce((n, g) => n + g.tasks.length, 0), 4, '昨天、第 8 天与已完成任务都不应计入');
});

test('BUG-05 截止日期标签：今天/明天/昨天/已过期/N 天后', () => {
  const day = n => U.toDateKey(U.addDays(new Date(), n));
  assert.equal(U.formatDueDateLabel(day(0)), '今天');
  assert.equal(U.formatDueDateLabel(day(1)), '明天');
  assert.equal(U.formatDueDateLabel(day(-1)), '昨天');
  assert.equal(U.formatDueDateLabel(day(-5)), '已过期');
  assert.equal(U.formatDueDateLabel(day(3)), '3 天后');
  assert.equal(U.formatDueDateLabel(null), '');
  assert.equal(U.formatDueDateLabel('garbage'), '');
});

test('已计划视图已移除', () => {
  const s = freshStore(null);
  s.createTask({ title: 'x', dueDate: U.toDateKey(new Date()) });
  assert.equal('planned' in s.getCounts().views, false);
  assert.equal(typeof s.getPlannedGroups, 'undefined');
  assert.equal(s._matchesView({ dueDate: '2026-01-01' }, 'planned'), true, '未知视图不再做过滤');
});

test('BUG-13 视图计数不再被内置清单覆盖', () => {
  const s = freshStore(null);
  s.createList('工作');
  const workId = s.data.lists[1].id;
  s.createTask({ title: 'a', listId: 'tasks' });
  s.createTask({ title: 'b', listId: workId });
  s.createTask({ title: 'c', listId: workId, important: true });
  const c = s.getCounts();
  assert.equal(c.views.tasks, 3);
  assert.equal(c.lists.tasks, 1);
  assert.equal(c.lists[workId], 2);
  assert.equal(c.views.important, 1);
});

test('BUG-14 内置清单不可删除，自定义清单可删除', () => {
  const s = freshStore(null);
  const list = s.createList('临时');
  s.createTask({ title: 'x', listId: list.id });
  assert.equal(s.deleteList('tasks'), false);
  assert.ok(s.getList('tasks'), '内置清单应保留');
  assert.equal(s.deleteList(list.id), true);
  assert.equal(s.data.tasks.length, 0);
});

test('BUG-11 复制任务的 tags/subtasks 数组相互独立', () => {
  const s = freshStore({ tags: [{ id: 't1', name: 'A', color: '#123456' }] });
  const t = s.createTask({ title: 'x', tags: ['t1'] });
  const dup = s.duplicateTask(t.id);
  assert.notEqual(dup.tags, t.tags);
  assert.notEqual(dup.subtasks, t.subtasks);
  s.addTagToTask(dup.id, 't2');
  assert.deepEqual(t.tags, ['t1']);
});

test('BUG-12 重复任务只在完成边沿生成一次', () => {
  const s = freshStore(null);
  const t = s.createTask({ title: '每日', dueDate: U.toDateKey(new Date()), repeat: 'daily' });
  s.toggleComplete(t.id);
  assert.equal(s.data.tasks.length, 2);
  s.toggleComplete(t.id);
  assert.equal(s.data.tasks.length, 2, '取消完成不应再生成');
  s.toggleComplete(t.id);
  assert.equal(s.data.tasks.length, 3);
});

test('BUG-12 逾期重复任务的下次日期推进到今天之后', () => {
  const s = freshStore(null);
  const t = s.createTask({ title: '逾期', dueDate: '2020-01-01', repeat: 'daily' });
  s.toggleComplete(t.id);
  const next = s.data.tasks.find(x => x.id !== t.id);
  assert.ok(next, '应生成下一次实例');
  assert.ok(U.parseDateKey(next.dueDate) > U.startOfToday(), `下次日期应在今天之后，实际 ${next.dueDate}`);
  assert.equal(next.completed, false);
  assert.equal(next.reminderNotified, false);
});

test('BUG-12 工作日重复跳过周末', () => {
  const s = freshStore(null);
  const friday = new Date(2026, 8, 18);
  assert.equal(friday.getDay(), 5);
  const t = s.createTask({ title: '周报', dueDate: U.toDateKey(friday), repeat: 'weekdays' });
  s.toggleComplete(t.id);
  const next = s.data.tasks.find(x => x.id !== t.id);
  assert.equal(U.parseDateKey(next.dueDate).getDay(), 1);
});

test('BUG-12 每月重复按同一天推进', () => {
  const s = freshStore(null);
  const base = U.addDays(new Date(), 1);
  const t = s.createTask({ title: '每月', dueDate: U.toDateKey(base), repeat: 'monthly' });
  s.toggleComplete(t.id);
  const next = s.data.tasks.find(x => x.id !== t.id);
  assert.equal(next.dueDate, U.toDateKey(U.addMonths(base, 1)));
});

test('BUG-18 拖拽重排后 order 唯一且切换为手动排序', () => {
  const s = freshStore(null);
  const a = s.createTask({ title: 'a' });
  const b = s.createTask({ title: 'b' });
  const c = s.createTask({ title: 'c' });
  assert.notEqual(s.data.settings.sortBy, 'manual');
  assert.equal(s.reorderTask(c.id, a.id), true);
  assert.equal(s.data.settings.sortBy, 'manual');
  assert.deepEqual(s.data.tasks.map(t => t.order).sort((x, y) => x - y), [0, 1, 2]);
  assert.deepEqual(s.getTasks({ sortBy: 'manual' }).map(t => t.id), [c.id, a.id, b.id]);
  assert.equal(s.reorderTask(a.id, a.id), false);
  assert.equal(s.reorderTask('ghost', a.id), false);
  assert.equal(s.reorderTask(b.id, a.id), false, '已是 manual 时不再报告切换');
});

test('BUG-18 新建任务 order 递增', () => {
  const s = freshStore(null);
  const orders = [s.createTask({ title: '1' }), s.createTask({ title: '2' })].map(t => t.order);
  assert.equal(new Set(orders).size, 2);
});

test('BUG-44 createTask 校验入参并继承视图属性', () => {
  const s = freshStore(null);
  const t = s.createTask({
    title: 'x', listId: 'ghost', priority: 99, dueDate: 'not-a-date',
    repeat: 'bogus', tags: 'nope', inMyDay: true, important: true,
  });
  assert.equal(t.listId, 'tasks');
  assert.equal(t.priority, 4);
  assert.equal(t.dueDate, null);
  assert.equal(t.repeat, 'none');
  assert.deepEqual(t.tags, []);
  assert.equal(t.inMyDay, true);
  assert.equal(t.important, true);
});

test('BUG-45 updateTask 拒绝空标题并保护 id/createdAt', () => {
  const s = freshStore(null);
  const t = s.createTask({ title: 'orig' });
  const createdAt = t.createdAt;
  s.updateTask(t.id, { title: '   ' });
  assert.equal(t.title, 'orig');
  s.updateTask(t.id, { title: ' 新标题 ', id: 'hacked', createdAt: 1 });
  assert.equal(t.title, '新标题');
  assert.equal(t.createdAt, createdAt);
  assert.equal(s.updateTask('ghost', { title: 'x' }), null);
});

test('BUG-29 hideCompleted 死配置已移除', () => {
  const s = freshStore({ settings: { hideCompleted: true, sortBy: 'created' } });
  assert.equal('hideCompleted' in s.data.settings, false);
  assert.equal(s.data.settings.checkUpdateOnStartup, true);
});

test('BUG-45 updateSettings 忽略未知键', () => {
  const s = freshStore(null);
  s.updateSettings({ sortBy: 'alpha', evil: 1 });
  assert.equal(s.data.settings.sortBy, 'alpha');
  assert.equal('evil' in s.data.settings, false);
});

test('BUG-17 搜索/标签/优先级筛选贯通各视图', () => {
  const s = freshStore({ tags: [{ id: 't1', name: 'A', color: '#123456' }] });
  const today = U.toDateKey(new Date());
  s.createTask({ title: '买牛奶', dueDate: today, priority: 1 });
  s.createTask({ title: '写周报', dueDate: today, priority: 4, tags: ['t1'] });
  assert.equal(s.getNext7Days({ search: '牛奶' })[0].tasks.length, 1);
  assert.equal(s.getNext7Days({ priority: 1 })[0].tasks.length, 1);
  assert.equal(s.getCalendarTasks(new Date().getFullYear(), new Date().getMonth(), { tagId: 't1' }).length, 1);
  assert.equal(s.getTasksByDate(today, { search: '周报' }).length, 1);
  assert.equal(s.getMyDaySuggestions({ search: '不存在' }).length, 0);
});

test('排序：priority/dueDate/alpha 且已完成置底', () => {
  const s = freshStore(null);
  s.createTask({ title: 'b', priority: 2, dueDate: U.toDateKey(U.addDays(new Date(), 2)) });
  s.createTask({ title: 'a', priority: 1, dueDate: U.toDateKey(U.addDays(new Date(), 1)) });
  s.createTask({ title: 'c', priority: 3 });
  assert.deepEqual(s.getTasks({ sortBy: 'priority' }).map(t => t.title), ['a', 'b', 'c']);
  assert.deepEqual(s.getTasks({ sortBy: 'dueDate' }).map(t => t.title), ['a', 'b', 'c']);
  assert.deepEqual(s.getTasks({ sortBy: 'alpha' }).map(t => t.title), ['a', 'b', 'c']);
  s.data.tasks.find(t => t.title === 'a').completed = true;
  assert.equal(s.getTasks({ sortBy: 'priority' }).at(-1).title, 'a');
});

test('BUG-15 escapeHtml 转义引号', () => {
  assert.equal(U.escapeHtml('a"b\'c<d>&e'), 'a&quot;b&#39;c&lt;d&gt;&amp;e');
  assert.equal(U.escapeHtml(null), '');
  assert.equal(U.escapeHtml(undefined), '');
  assert.equal(U.escapeHtml(12), '12');
});

test('Utils 日期往返、月末与闰年处理', () => {
  assert.equal(U.toDateKey(U.parseDateKey('2026-09-19')), '2026-09-19');
  assert.equal(U.parseDateKey('2026-9-1').getDate(), 1);
  assert.equal(U.parseDateKey(''), null);
  assert.equal(U.parseDateKey('xxx'), null);
  assert.equal(U.toDateKey(U.addYears(U.parseDateKey('2024-02-29'), 1)), '2025-02-28');
  assert.equal(U.toDateKey(U.addMonths(U.parseDateKey('2026-12-31'), 1)), '2027-01-31');
  assert.equal(U.toDateKey(U.addMonths(U.parseDateKey('2026-01-31'), 1)), '2026-02-28');
  assert.equal(U.toDateKey(U.addMonths(U.parseDateKey('2024-01-31'), 1)), '2024-02-29');
  assert.equal(U.isValidDateKey('2026-09-19'), true);
  assert.equal(U.isValidDateKey('nope'), false);
  assert.equal(U.toDateTimeLocalValue(new Date(2026, 8, 19, 9, 5)), '2026-09-19T09:05');
  assert.equal(U.parseDateTimeLocal('2026-09-19T09:05').getHours(), 9);
});

test('番茄钟会话按日持久化并跨天重置', () => {
  const s = freshStore(null);
  assert.equal(s.getPomodoroSessions(), 0);
  assert.equal(s.addPomodoroSession(), 1);
  assert.equal(s.addPomodoroSession(), 2);
  assert.equal(s.getPomodoroSessions(), 2);
  s.data.stats.pomodoroDate = '2000-01-01';
  assert.equal(s.getPomodoroSessions(), 0);
  assert.equal(s.addPomodoroSession(), 1);
});

test('删除标签会清理任务引用', () => {
  const s = freshStore(null);
  const tag = s.createTag('A', '#123456');
  const t = s.createTask({ title: 'x', tags: [tag.id] });
  s.deleteTag(tag.id);
  assert.deepEqual(s.data.tasks.find(x => x.id === t.id).tags, []);
});

test('BUG-30 flush 上报写入失败并保持 dirty', async () => {
  const s = new Store();
  const originalWrite = globalThis.api.store.write;

  globalThis.api.store.write = async () => ({ ok: false, error: 'disk full' });
  s.save();
  assert.equal(await s.flush(), false);
  assert.equal(s.saveError, 'disk full');
  assert.equal(s.dirty, true);

  globalThis.api.store.write = async () => { throw new Error('boom'); };
  assert.equal(await s.flush(), false);
  assert.equal(s.saveError, 'boom');

  globalThis.api.store.write = originalWrite;
  assert.equal(await s.flush(), true);
  assert.equal(s.dirty, false);
});

test('BUG-30 load 从持久化数据恢复', async () => {
  mock.stored = {
    lists: [{ id: 'tasks', name: '任务', order: 0 }, { id: 'l2', name: '工作', order: 1 }],
    tasks: [{ id: 't1', title: '恢复的任务', listId: 'l2', priority: 2 }],
    tags: [],
    settings: { sortBy: 'alpha' },
  };
  const s = new Store();
  await s.load();
  assert.equal(s.data.tasks.length, 1);
  assert.equal(s.data.tasks[0].title, '恢复的任务');
  assert.equal(s.data.lists.length, 2);
  assert.equal(s.getSettings().sortBy, 'alpha');
  assert.equal(s.saveError, null);
});

test('BUG-50 番茄钟时长默认值与越界钳制', () => {
  const d = freshStore(null);
  assert.equal(d.data.settings.pomodoroWorkMinutes, 25);
  assert.equal(d.data.settings.pomodoroBreakMinutes, 5);

  const s = freshStore({ settings: { pomodoroWorkMinutes: 9999, pomodoroBreakMinutes: -3 } });
  assert.equal(s.data.settings.pomodoroWorkMinutes, 180, '超上限钳制到 180');
  assert.equal(s.data.settings.pomodoroBreakMinutes, 1, '低于下限钳制到 1');

  const g = freshStore({ settings: { pomodoroWorkMinutes: 'abc', pomodoroBreakMinutes: null } });
  assert.equal(g.data.settings.pomodoroWorkMinutes, 25, '非法值回退默认');
  assert.equal(g.data.settings.pomodoroBreakMinutes, 5);

  s.updateSettings({ pomodoroWorkMinutes: '50' });
  assert.equal(s.data.settings.pomodoroWorkMinutes, 50, '字符串数字可接受');
  s.updateSettings({ pomodoroWorkMinutes: 0 });
  assert.equal(s.data.settings.pomodoroWorkMinutes, 1);
});

test('运行期间无未处理异常或被吞掉的 Promise 拒绝', async () => {
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(runtimeErrors, []);
});

process.exit(await run() ? 1 : 0);
