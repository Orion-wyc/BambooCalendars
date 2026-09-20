'use strict';
// 纯函数模块：不依赖 electron / better-sqlite3，可被单元测试直接引用。
// 负责 JSON 结构 <-> 数据库行结构 的双向映射与清洗。

const BUILTIN_LIST_ID = 'tasks';

function toBoolInt(v) {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
}

function strOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : String(v);
}

function num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function mapStoreJson(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const now = Date.now();
  const skipped = { lists: 0, tasks: 0, tags: 0, subtasks: 0 };

  const srcLists = Array.isArray(raw.lists) ? raw.lists : [];
  const lists = srcLists
    .filter(l => l && typeof l === 'object' && l.id)
    .map((l, i) => ({
      id: String(l.id),
      name: typeof l.name === 'string' && l.name ? l.name : '未命名清单',
      color: typeof l.color === 'string' ? l.color : null,
      order_index: Number.isFinite(l.order) ? l.order : i,
      archived: 0,
      created_at: num(l.createdAt, now),
      updated_at: num(l.updatedAt, 0),
    }));
  skipped.lists = srcLists.length - lists.length;

  if (lists.length === 0) {
    lists.push({
      id: BUILTIN_LIST_ID, name: '任务', color: null,
      order_index: -1, archived: 0, created_at: now, updated_at: 0,
    });
  }
  const knownLists = new Set(lists.map(l => l.id));

  const srcTags = Array.isArray(raw.tags) ? raw.tags : [];
  const tags = srcTags
    .filter(t => t && typeof t === 'object' && t.id && t.name)
    .map(t => ({
      id: String(t.id),
      name: String(t.name),
      color: typeof t.color === 'string' ? t.color : '#4a90d9',
    }));
  skipped.tags = srcTags.length - tags.length;
  const knownTags = new Set(tags.map(t => t.id));

  const tasks = [];
  const subtasks = [];
  const taskTags = [];
  const srcTasks = Array.isArray(raw.tasks) ? raw.tasks : [];

  srcTasks.forEach(t => {
    if (!t || typeof t !== 'object' || !t.id || typeof t.title !== 'string' || !t.title.trim()) {
      skipped.tasks += 1;
      return;
    }
    const id = String(t.id);
    let listId = String(t.listId || '');
    if (!knownLists.has(listId)) listId = BUILTIN_LIST_ID;
    const priority = [1, 2, 3, 4].includes(t.priority) ? t.priority : 4;

    tasks.push({
      id,
      list_id: listId,
      title: t.title,
      note: typeof t.note === 'string' ? t.note : '',
      completed: toBoolInt(t.completed),
      completed_at: t.completedAt === null || t.completedAt === undefined ? null : num(t.completedAt, null),
      important: toBoolInt(t.important),
      in_my_day: toBoolInt(t.inMyDay),
      priority,
      due_date: strOrNull(t.dueDate),
      reminder: strOrNull(t.reminder),
      repeat: typeof t.repeat === 'string' ? t.repeat : 'none',
      order_index: Number.isFinite(t.order) ? t.order : 0,
      created_at: num(t.createdAt, now),
      updated_at: num(t.updatedAt, num(t.createdAt, now)),
    });

    (Array.isArray(t.subtasks) ? t.subtasks : []).forEach((s, si) => {
      if (!s || typeof s !== 'object' || !s.id || typeof s.title !== 'string') {
        skipped.subtasks += 1;
        return;
      }
      subtasks.push({
        id: String(s.id),
        task_id: id,
        title: s.title,
        completed: toBoolInt(s.completed),
        order_index: Number.isFinite(s.order) ? s.order : si,
      });
    });

    const seenTags = new Set();
    (Array.isArray(t.tags) ? t.tags : []).forEach(tagId => {
      const tid = String(tagId);
      if (!knownTags.has(tid) || seenTags.has(tid)) return;
      seenTags.add(tid);
      taskTags.push({ task_id: id, tag_id: tid });
    });
  });

  const settings = [];
  const sraw = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  Object.entries(sraw).forEach(([key, value]) => {
    settings.push({ key, value: JSON.stringify(value) });
  });

  return { lists, tasks, subtasks, taskTags, tags, settings, skipped };
}

function mapThemesJson(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .filter(t => t && typeof t === 'object' && t.id && t.name)
    .map(t => ({
      id: String(t.id),
      name: String(t.name),
      colors: JSON.stringify(t.colors && typeof t.colors === 'object' ? t.colors : {}),
      is_builtin: 0,
    }));
}

// rows: { lists, tasks, subtasks, taskTags, tags, settings } —— 元素为 SELECT 返回的列名对象
function assembleStore(rows) {
  const lists = (rows.lists || []).map(r => ({
    id: r.id,
    name: r.name,
    color: r.color === undefined ? null : r.color,
    createdAt: r.created_at,
    order: r.order_index,
  }));

  const subByTask = new Map();
  (rows.subtasks || []).forEach(s => {
    if (!subByTask.has(s.task_id)) subByTask.set(s.task_id, []);
    subByTask.get(s.task_id).push({ id: s.id, title: s.title, completed: Boolean(s.completed) });
  });

  const tagsByTask = new Map();
  (rows.taskTags || []).forEach(tt => {
    if (!tagsByTask.has(tt.task_id)) tagsByTask.set(tt.task_id, []);
    tagsByTask.get(tt.task_id).push(tt.tag_id);
  });

  const tasks = (rows.tasks || []).map(r => ({
    id: r.id,
    listId: r.list_id,
    title: r.title,
    note: r.note,
    completed: Boolean(r.completed),
    completedAt: r.completed_at,
    important: Boolean(r.important),
    inMyDay: Boolean(r.in_my_day),
    priority: r.priority,
    tags: tagsByTask.get(r.id) || [],
    dueDate: r.due_date,
    reminder: r.reminder,
    repeat: r.repeat,
    subtasks: subByTask.get(r.id) || [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    order: r.order_index,
  }));

  const tags = (rows.tags || []).map(r => ({ id: r.id, name: r.name, color: r.color }));

  const settings = {};
  (rows.settings || []).forEach(r => {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch { /* 跳过损坏值 */ }
  });

  return { lists, tasks, tags, settings };
}

function assembleThemes(rows) {
  return (rows || []).map(r => {
    let colors = {};
    try { colors = JSON.parse(r.colors); } catch {}
    return { id: r.id, name: r.name, colors };
  });
}

module.exports = {
  BUILTIN_LIST_ID,
  mapStoreJson,
  mapThemesJson,
  assembleStore,
  assembleThemes,
};
