import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSuite } from './helpers/runner.mjs';

const require = createRequire(import.meta.url);
const mapper = require('../src/main/mapper.js');
const { MIGRATIONS } = require('../src/main/migrations.js');
const { decideAction } = require('../src/main/migrate-policy.js');

const { test, run } = createSuite('SQLite 迁移逻辑回归');

const fixture = () => ({
  lists: [
    { id: 'tasks', name: '任务', createdAt: 1000, order: 0 },
    { id: 'work', name: '工作', createdAt: 2000, order: 1 },
  ],
  tags: [{ id: 'tag1', name: '紧急', color: '#ff0000' }],
  tasks: [
    {
      id: 't1', listId: 'work', title: '任务一', note: '备注',
      completed: false, completedAt: null, important: true, inMyDay: true,
      priority: 1, tags: ['tag1', 'missing-tag', 'tag1'],
      dueDate: '2026-09-20', reminder: null, repeat: 'daily',
      subtasks: [{ id: 's1', title: '步骤1', completed: true }, { title: '无id应跳过' }],
      createdAt: 100, updatedAt: 200, order: 5,
    },
    {
      id: 't2', listId: 'gone', title: '任务二', completed: true, completedAt: 300,
      priority: 9, createdAt: 110, updatedAt: 120,
    },
    { id: '', title: '坏任务应跳过' },
  ],
  settings: { theme: 'default', sortBy: 'created', alwaysOnTop: false },
});

test('映射：清单/标签/设置行数与字段', () => {
  const m = mapper.mapStoreJson(fixture());
  assert.equal(m.lists.length, 2);
  assert.equal(m.lists[1].order_index, 1);
  assert.equal(m.tags.length, 1);
  assert.equal(m.tags[0].color, '#ff0000');
  assert.equal(m.settings.length, 3);
  const theme = m.settings.find(s => s.key === 'theme');
  assert.equal(theme.value, '"default"');
});

test('映射：非法任务跳过、非法优先级回退、未知清单回退内置清单', () => {
  const m = mapper.mapStoreJson(fixture());
  assert.equal(m.tasks.length, 2);
  assert.equal(m.skipped.tasks, 1);
  const t2 = m.tasks.find(t => t.id === 't2');
  assert.equal(t2.priority, 4);
  assert.equal(t2.list_id, 'tasks');
  assert.equal(t2.completed, 1);
  assert.equal(t2.completed_at, 300);
});

test('映射：标签去重且丢弃未知标签；子任务跳过无 id 行', () => {
  const m = mapper.mapStoreJson(fixture());
  assert.equal(m.taskTags.length, 1);
  assert.equal(m.taskTags[0].tag_id, 'tag1');
  assert.equal(m.subtasks.length, 1);
  assert.equal(m.skipped.subtasks, 1);
  assert.equal(m.subtasks[0].completed, 1);
});

test('映射：空清单时补内置清单保证外键可用', () => {
  const m = mapper.mapStoreJson({ tasks: [{ id: 'x', title: '仅任务' }] });
  assert.equal(m.lists.length, 1);
  assert.equal(m.lists[0].id, 'tasks');
  assert.equal(m.tasks[0].list_id, 'tasks');
});

test('映射：损坏输入不抛异常', () => {
  [null, undefined, 42, 'str', { tasks: 'nope' }].forEach(bad => {
    const m = mapper.mapStoreJson(bad);
    assert.equal(m.lists.length, 1);
    assert.equal(m.tasks.length, 0);
  });
});

test('组装：行结构还原为渲染进程 JSON 结构', () => {
  const m = mapper.mapStoreJson(fixture());
  const store = mapper.assembleStore(m);
  assert.equal(store.lists.length, 2);
  assert.equal(store.lists[0].order, 0);
  const t1 = store.tasks.find(t => t.id === 't1');
  assert.equal(t1.title, '任务一');
  assert.equal(t1.important, true);
  assert.equal(t1.inMyDay, true);
  assert.equal(t1.priority, 1);
  assert.deepEqual(t1.tags, ['tag1']);
  assert.equal(t1.subtasks.length, 1);
  assert.equal(t1.subtasks[0].completed, true);
  assert.equal(t1.dueDate, '2026-09-20');
  assert.equal(store.settings.theme, 'default');
  assert.equal(store.settings.alwaysOnTop, false);
});

test('组装：空库返回空结构且 settings 为对象', () => {
  const store = mapper.assembleStore({});
  assert.deepEqual(store, { lists: [], tasks: [], tags: [], settings: {} });
});

test('主题映射：非法项过滤、colors 序列化', () => {
  const rows = mapper.mapThemesJson([
    { id: 'u1', name: '自定义', colors: { primary: '#111111' } },
    { id: 'u2' },
    null,
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].colors, '{"primary":"#111111"}');
  assert.equal(rows[0].is_builtin, 0);
  const back = mapper.assembleThemes(rows);
  assert.deepEqual(back[0].colors, { primary: '#111111' });
});

test('场景判定：覆盖安装五种场景', () => {
  assert.equal(decideAction({ dbExists: false, dbHasData: false, jsonExists: true }), 'migrate');
  assert.equal(decideAction({ dbExists: true, dbHasData: false, jsonExists: true }), 'migrate');
  assert.equal(decideAction({ dbExists: true, dbHasData: true, jsonExists: true }), 'conflict');
  assert.equal(decideAction({ dbExists: true, dbHasData: true, jsonExists: false }), 'normal');
  assert.equal(decideAction({ dbExists: true, dbHasData: false, jsonExists: false }), 'normal');
  assert.equal(decideAction({ dbExists: false, dbHasData: false, jsonExists: false }), 'fresh');
});

test('迁移脚本：版本从 1 开始严格递增', () => {
  assert.ok(MIGRATIONS.length >= 1);
  MIGRATIONS.forEach((m, i) => {
    assert.equal(m.version, i + 1);
    assert.equal(typeof m.up, 'function');
  });
});

process.exit(await run() ? 1 : 0);
