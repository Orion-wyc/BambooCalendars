import {
  addDays, addMonths, addYears, advanceToNextWeekday, parseDateKey,
  startOfToday, toDateKey
} from './Utils.js';

const BUILTIN_LIST_ID = 'tasks';

const SETTING_KEYS = [
  'theme', 'mode', 'autoNightMode', 'sideBarHidden', 'requestExitConfirmation',
  'compactMode', 'sortBy', 'alwaysOnTop', 'checkUpdateOnStartup',
  'pomodoroWorkMinutes', 'pomodoroBreakMinutes'
];

const POMODORO_LIMITS = {
  pomodoroWorkMinutes: { min: 1, max: 180, fallback: 25 },
  pomodoroBreakMinutes: { min: 1, max: 60, fallback: 5 },
};

const REPEAT_VALUES = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'];

function defaultSettings() {
  return {
    theme: 'default',
    mode: 'normal',
    autoNightMode: false,
    sideBarHidden: false,
    requestExitConfirmation: true,
    compactMode: false,
    sortBy: 'created',
    alwaysOnTop: false,
    checkUpdateOnStartup: true,
    pomodoroWorkMinutes: 25,
    pomodoroBreakMinutes: 5,
  };
}

function defaultData() {
  return {
    lists: [
      { id: BUILTIN_LIST_ID, name: '任务', createdAt: Date.now(), order: 0, builtin: true }
    ],
    tasks: [],
    tags: [],
    settings: defaultSettings(),
    stats: { pomodoroDate: '', pomodoroSessions: 0 },
  };
}

function clampSettingNumber(value, rule) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num)) return rule.fallback;
  return Math.min(rule.max, Math.max(rule.min, num));
}

export class Store {
  constructor() {
    this.data = defaultData();
    this.saveTimer = null;
    this.dirty = false;
    this.saveError = null;
    this._idSeq = 0;
  }

  async load() {
    let saved = null;
    try {
      saved = await window.api.store.read();
    } catch (e) {
      this.saveError = e.message;
    }
    this.data = this.normalize(saved);
    this.dirty = false;
    return this.data;
  }

  normalize(saved) {
    const base = defaultData();
    if (!saved || typeof saved !== 'object') return base;

    const lists = Array.isArray(saved.lists) ? saved.lists : [];
    const normalizedLists = lists
      .filter(l => l && typeof l === 'object' && l.id)
      .map((l, index) => ({
        id: String(l.id),
        name: typeof l.name === 'string' && l.name ? l.name : '未命名清单',
        createdAt: Number(l.createdAt) || Date.now(),
        order: Number.isFinite(l.order) ? l.order : index,
        builtin: l.id === BUILTIN_LIST_ID,
      }));
    if (!normalizedLists.some(l => l.id === BUILTIN_LIST_ID)) {
      normalizedLists.unshift({
        id: BUILTIN_LIST_ID, name: '任务', createdAt: Date.now(), order: -1, builtin: true
      });
    }

    const knownListIds = new Set(normalizedLists.map(l => l.id));
    const tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
    const seenTaskIds = new Set();
    const normalizedTasks = [];
    tasks.forEach(t => {
      if (!t || typeof t !== 'object' || !t.id) return;
      const id = String(t.id);
      if (seenTaskIds.has(id)) return;
      seenTaskIds.add(id);
      normalizedTasks.push(this.normalizeTask(t, knownListIds));
    });

    const tags = Array.isArray(saved.tags) ? saved.tags : [];
    const normalizedTags = tags
      .filter(t => t && typeof t === 'object' && t.id)
      .map(t => ({
        id: String(t.id),
        name: String(t.name || '标签'),
        color: typeof t.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#4a90d9',
      }));
    const knownTagIds = new Set(normalizedTags.map(t => t.id));
    normalizedTasks.forEach(t => {
      t.tags = t.tags.filter(id => knownTagIds.has(id));
    });

    const settings = defaultSettings();
    if (saved.settings && typeof saved.settings === 'object') {
      SETTING_KEYS.forEach(key => {
        if (saved.settings[key] !== undefined) settings[key] = saved.settings[key];
      });
    }
    Object.keys(POMODORO_LIMITS).forEach(key => {
      settings[key] = clampSettingNumber(settings[key], POMODORO_LIMITS[key]);
    });

    const stats = saved.stats && typeof saved.stats === 'object' ? saved.stats : {};
    return {
      lists: normalizedLists,
      tasks: normalizedTasks,
      tags: normalizedTags,
      settings,
      stats: {
        pomodoroDate: typeof stats.pomodoroDate === 'string' ? stats.pomodoroDate : '',
        pomodoroSessions: Number.isFinite(stats.pomodoroSessions) ? Math.max(0, stats.pomodoroSessions) : 0,
      },
    };
  }

  normalizeTask(task, knownListIds) {
    const priority = Number(task.priority);
    const dueDate = parseDateKey(task.dueDate) ? toDateKey(parseDateKey(task.dueDate)) : null;
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    return {
      id: String(task.id),
      listId: knownListIds && knownListIds.has(task.listId) ? task.listId : BUILTIN_LIST_ID,
      title: typeof task.title === 'string' && task.title ? task.title : '未命名任务',
      note: typeof task.note === 'string' ? task.note : '',
      completed: Boolean(task.completed),
      completedAt: Number(task.completedAt) || null,
      important: Boolean(task.important),
      inMyDay: Boolean(task.inMyDay),
      priority: priority >= 1 && priority <= 4 ? priority : 4,
      tags: Array.isArray(task.tags) ? task.tags.filter(id => typeof id === 'string') : [],
      dueDate,
      reminder: typeof task.reminder === 'string' && task.reminder ? task.reminder : null,
      reminderNotified: Boolean(task.reminderNotified),
      repeat: REPEAT_VALUES.includes(task.repeat) ? task.repeat : 'none',
      subtasks: subtasks
        .filter(s => s && typeof s === 'object' && s.id)
        .map(s => ({
          id: String(s.id),
          title: String(s.title || ''),
          completed: Boolean(s.completed),
        })),
      createdAt: Number(task.createdAt) || Date.now(),
      updatedAt: Number(task.updatedAt) || Number(task.createdAt) || Date.now(),
      order: Number.isFinite(task.order) ? task.order : 0,
    };
  }

  save() {
    this.dirty = true;
    this.saveTimer = setTimeout(() => this.flush(), 100);
  }

  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty) return true;
    this.dirty = false;
    try {
      const result = await window.api.store.write(this.data);
      if (result && result.ok === false) {
        this.dirty = true;
        this.saveError = result.error || '写入失败';
        console.error('保存失败:', this.saveError);
        return false;
      }
      this.saveError = null;
      return true;
    } catch (e) {
      this.dirty = true;
      this.saveError = e.message;
      console.error('保存失败:', e);
      return false;
    }
  }

  // Lists
  getLists() {
    return [...this.data.lists].sort((a, b) => a.order - b.order);
  }

  getList(id) {
    return this.data.lists.find(l => l.id === id) || null;
  }

  isBuiltinList(id) {
    return id === BUILTIN_LIST_ID;
  }

  createList(name) {
    const list = {
      id: this.generateId(),
      name,
      createdAt: Date.now(),
      order: this.data.lists.length,
      builtin: false,
    };
    this.data.lists.push(list);
    this.save();
    return list;
  }

  updateList(id, updates) {
    const list = this.data.lists.find(l => l.id === id);
    if (list) {
      Object.assign(list, this._safeUpdates(updates, ['id', 'builtin', 'createdAt']));
      this.save();
    }
    return list;
  }

  deleteList(id) {
    if (id === BUILTIN_LIST_ID) return false;
    this.data.lists = this.data.lists.filter(l => l.id !== id);
    this.data.tasks = this.data.tasks.filter(t => t.listId !== id);
    this.save();
    return true;
  }

  // Tags
  getTags() {
    return [...this.data.tags];
  }

  getTag(id) {
    return this.data.tags.find(t => t.id === id);
  }

  createTag(name, color) {
    const tag = {
      id: this.generateId(),
      name,
      color: /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#4a90d9'
    };
    this.data.tags.push(tag);
    this.save();
    return tag;
  }

  updateTag(id, updates) {
    const tag = this.data.tags.find(t => t.id === id);
    if (tag) {
      Object.assign(tag, this._safeUpdates(updates, ['id']));
      this.save();
    }
    return tag;
  }

  deleteTag(id) {
    this.data.tags = this.data.tags.filter(t => t.id !== id);
    this.data.tasks.forEach(t => {
      t.tags = (t.tags || []).filter(tagId => tagId !== id);
    });
    this.save();
  }

  // Tasks
  _matches(task, filter = {}) {
    if (filter.listId && task.listId !== filter.listId) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.tagId && !(task.tags || []).includes(filter.tagId)) return false;
    if (filter.completed !== undefined && task.completed !== filter.completed) return false;
    if (filter.search) {
      const q = String(filter.search).toLowerCase();
      const inTitle = (task.title || '').toLowerCase().includes(q);
      const inNote = (task.note || '').toLowerCase().includes(q);
      if (!inTitle && !inNote) return false;
    }
    return true;
  }

  _matchesView(task, view) {
    if (view === 'my-day') return Boolean(task.inMyDay);
    if (view === 'important') return Boolean(task.important);
    return true;
  }

  getTasks(filter = {}) {
    const tasks = this.data.tasks.filter(t =>
      this._matchesView(t, filter.view) && this._matches(t, filter)
    );
    return this._sortTasks(tasks, filter.sortBy || this.data.settings.sortBy || 'created');
  }

  _sortTasks(tasks, sortBy) {
    const cmp = (a, b) => {
      switch (sortBy) {
        case 'priority':
          if (a.priority !== b.priority) return a.priority - b.priority;
          return b.updatedAt - a.updatedAt;
        case 'dueDate': {
          const da = parseDateKey(a.dueDate);
          const db = parseDateKey(b.dueDate);
          if (!da && !db) return b.createdAt - a.createdAt;
          if (!da) return 1;
          if (!db) return -1;
          return da - db;
        }
        case 'important':
          if (a.important !== b.important) return a.important ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        case 'alpha':
          return String(a.title).localeCompare(String(b.title), 'zh-CN');
        case 'manual':
          return (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt;
        case 'created':
        default:
          return b.createdAt - a.createdAt;
      }
    };
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return cmp(a, b);
    });
  }

  _nextOrder() {
    return this.data.tasks.reduce((max, t) => Math.max(max, t.order || 0), 0) + 1;
  }

  createTask(taskData = {}) {
    const now = Date.now();
    const task = {
      id: this.generateId(),
      listId: this.getList(taskData.listId) ? taskData.listId : BUILTIN_LIST_ID,
      title: taskData.title,
      note: taskData.note || '',
      completed: false,
      completedAt: null,
      important: Boolean(taskData.important),
      inMyDay: Boolean(taskData.inMyDay),
      priority: taskData.priority >= 1 && taskData.priority <= 4 ? taskData.priority : 4,
      tags: Array.isArray(taskData.tags) ? [...taskData.tags] : [],
      dueDate: parseDateKey(taskData.dueDate) ? toDateKey(parseDateKey(taskData.dueDate)) : null,
      reminder: taskData.reminder || null,
      reminderNotified: false,
      repeat: REPEAT_VALUES.includes(taskData.repeat) ? taskData.repeat : 'none',
      subtasks: [],
      createdAt: now,
      updatedAt: now,
      order: this._nextOrder(),
    };
    this.data.tasks.push(task);
    this.save();
    return task;
  }

  updateTask(id, updates) {
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return null;
    const rest = this._safeUpdates(updates, ['id', 'createdAt']);
    if (rest.dueDate !== undefined) {
      const parsed = parseDateKey(rest.dueDate);
      rest.dueDate = parsed ? toDateKey(parsed) : null;
    }
    if (rest.priority !== undefined) {
      rest.priority = rest.priority >= 1 && rest.priority <= 4 ? rest.priority : 4;
    }
    if (rest.repeat !== undefined && !REPEAT_VALUES.includes(rest.repeat)) {
      rest.repeat = 'none';
    }
    if (rest.title !== undefined) {
      const title = String(rest.title).trim();
      if (!title) return task;
      rest.title = title;
    }
    Object.assign(task, rest, { updatedAt: Date.now() });
    this.save();
    return task;
  }

  _safeUpdates(updates, blockedKeys) {
    const result = {};
    Object.keys(updates || {}).forEach(key => {
      if (!blockedKeys.includes(key)) result[key] = updates[key];
    });
    return result;
  }

  deleteTask(id) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.save();
  }

  toggleComplete(id) {
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return null;
    const wasCompleted = task.completed;
    task.completed = !wasCompleted;
    task.completedAt = task.completed ? Date.now() : null;
    task.updatedAt = Date.now();

    if (!wasCompleted && task.completed && task.repeat !== 'none') {
      this.data.tasks.push(this.createNextOccurrence(task));
    }

    this.save();
    return task;
  }

  toggleImportant(id) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.important = !task.important;
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  toggleMyDay(id) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.inMyDay = !task.inMyDay;
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  setPriority(id, priority) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.priority = priority >= 1 && priority <= 4 ? priority : 4;
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  addTagToTask(id, tagId) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      if (!Array.isArray(task.tags)) task.tags = [];
      if (!task.tags.includes(tagId)) task.tags.push(tagId);
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  removeTagFromTask(id, tagId) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.tags = (task.tags || []).filter(t => t !== tagId);
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  toggleTagOnTask(id, tagId) {
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return task;
    if ((task.tags || []).includes(tagId)) this.removeTagFromTask(id, tagId);
    else this.addTagToTask(id, tagId);
    return task;
  }

  addSubtask(taskId, title) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      if (!Array.isArray(task.subtasks)) task.subtasks = [];
      task.subtasks.push({
        id: this.generateId(),
        title,
        completed: false
      });
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  toggleSubtask(taskId, subtaskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      const subtask = (task.subtasks || []).find(s => s.id === subtaskId);
      if (subtask) {
        subtask.completed = !subtask.completed;
        task.updatedAt = Date.now();
        this.save();
      }
    }
    return task;
  }

  deleteSubtask(taskId, subtaskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      task.subtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  reorderTask(draggedId, targetId) {
    if (draggedId === targetId) return false;
    const tasks = this.data.tasks;
    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    const targetIndex = tasks.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return false;
    const [draggedTask] = tasks.splice(draggedIndex, 1);
    tasks.splice(targetIndex, 0, draggedTask);
    tasks.forEach((t, index) => { t.order = index; });
    const changedSort = this.data.settings.sortBy !== 'manual';
    if (changedSort) this.data.settings.sortBy = 'manual';
    this.save();
    return changedSort;
  }

  // Settings
  getSettings() {
    return { ...this.data.settings };
  }

  updateSettings(updates) {
    if (!this.data.settings) this.data.settings = defaultSettings();
    Object.keys(updates || {}).forEach(key => {
      if (!SETTING_KEYS.includes(key)) return;
      this.data.settings[key] = POMODORO_LIMITS[key]
        ? clampSettingNumber(updates[key], POMODORO_LIMITS[key])
        : updates[key];
    });
    this.save();
  }

  // Helpers
  generateId() {
    this._idSeq += 1;
    return Date.now().toString(36) + this._idSeq.toString(36) +
      Math.random().toString(36).slice(2, 8);
  }

  createNextOccurrence(task) {
    const base = parseDateKey(task.dueDate) || startOfToday();
    let date = this._advanceRepeat(base, task.repeat);
    const today = startOfToday();
    let guard = 0;
    while (date <= today && guard < 5000) {
      date = this._advanceRepeat(date, task.repeat);
      guard += 1;
    }

    return {
      ...task,
      id: this.generateId(),
      completed: false,
      completedAt: null,
      reminderNotified: false,
      tags: [...(task.tags || [])],
      subtasks: (task.subtasks || []).map(s => ({ ...s, id: this.generateId(), completed: false })),
      dueDate: toDateKey(date),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: this._nextOrder(),
    };
  }

  _advanceRepeat(date, repeat) {
    switch (repeat) {
      case 'daily': return addDays(date, 1);
      case 'weekdays': return advanceToNextWeekday(date);
      case 'weekly': return addDays(date, 7);
      case 'monthly': return addMonths(date, 1);
      case 'yearly': return addYears(date, 1);
      default: return addDays(date, 1);
    }
  }

  getCounts() {
    const active = this.data.tasks.filter(t => !t.completed);
    const views = {
      myDay: active.filter(t => t.inMyDay).length,
      important: active.filter(t => t.important).length,
      tasks: active.length,
    };
    const lists = {};
    this.data.lists.forEach(list => {
      lists[list.id] = active.filter(t => t.listId === list.id).length;
    });
    return { views, lists };
  }

  getPomodoroSessions() {
    const today = toDateKey(new Date());
    if (this.data.stats.pomodoroDate !== today) return 0;
    return this.data.stats.pomodoroSessions;
  }

  addPomodoroSession() {
    const today = toDateKey(new Date());
    if (!this.data.stats) this.data.stats = { pomodoroDate: '', pomodoroSessions: 0 };
    if (this.data.stats.pomodoroDate !== today) {
      this.data.stats.pomodoroDate = today;
      this.data.stats.pomodoroSessions = 0;
    }
    this.data.stats.pomodoroSessions += 1;
    this.save();
    return this.data.stats.pomodoroSessions;
  }

  getMyDaySuggestions(filter = {}) {
    const today = startOfToday();
    return this.data.tasks.filter(t => {
      if (t.completed || t.inMyDay) return false;
      if (!this._matches(t, filter)) return false;
      if (t.important) return true;
      const due = parseDateKey(t.dueDate);
      return Boolean(due) && due <= today;
    });
  }

  getNext7Days(filter = {}) {
    const today = startOfToday();
    const groups = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(today, i);
      const key = toDateKey(day);
      groups.push({
        date: key,
        label: i === 0
          ? '今天'
          : i === 1
            ? '明天'
            : day.toLocaleDateString('zh-CN', { weekday: 'long', month: 'numeric', day: 'numeric' }),
        tasks: this.data.tasks.filter(t =>
          !t.completed && t.dueDate === key && this._matches(t, filter)
        ),
      });
    }
    return groups;
  }

  getCalendarTasks(year, month, filter = {}) {
    return this.data.tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = parseDateKey(t.dueDate);
      if (!d) return false;
      if (d.getFullYear() !== year || d.getMonth() !== month) return false;
      return this._matches(t, filter);
    });
  }

  getTasksByDate(dateKey, filter = {}) {
    return this.data.tasks.filter(t => t.dueDate === dateKey && this._matches(t, filter));
  }

  moveTaskToList(taskId, listId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task && this.getList(listId)) {
      task.listId = listId;
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  duplicateTask(taskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task) return null;
    const dup = {
      ...task,
      id: this.generateId(),
      title: `${task.title} (副本)`,
      completed: false,
      completedAt: null,
      reminderNotified: false,
      tags: [...(task.tags || [])],
      subtasks: (task.subtasks || []).map(s => ({ ...s, id: this.generateId(), completed: false })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: this._nextOrder(),
    };
    this.data.tasks.push(dup);
    this.save();
    return dup;
  }
}

export const store = new Store();
export { BUILTIN_LIST_ID, POMODORO_LIMITS };
