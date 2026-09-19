export class Store {
  constructor() {
    this.data = {
      lists: [
        { id: 'tasks', name: '任务', createdAt: Date.now(), order: 0 }
      ],
      tasks: [],
      settings: {
        theme: 'default',
        mode: 'normal',
        autoNightMode: false,
        sideBarHidden: false,
        hideCompleted: true,
        requestExitConfirmation: true,
        compactMode: false,
        sortBy: 'created',
        alwaysOnTop: false,
      }
    };
    this.saveTimer = null;
  }

  async load() {
    const saved = await window.api.store.read();
    if (saved) {
      this.data = saved;
    }
  }

  save() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      window.api.store.write(this.data);
    }, 100);
  }

  // Lists
  getLists() {
    return [...this.data.lists].sort((a, b) => a.order - b.order);
  }

  createList(name) {
    const list = {
      id: this.generateId(),
      name,
      createdAt: Date.now(),
      order: this.data.lists.length
    };
    this.data.lists.push(list);
    this.save();
    return list;
  }

  updateList(id, updates) {
    const list = this.data.lists.find(l => l.id === id);
    if (list) {
      Object.assign(list, updates);
      this.save();
    }
    return list;
  }

  deleteList(id) {
    this.data.lists = this.data.lists.filter(l => l.id !== id);
    this.data.tasks = this.data.tasks.filter(t => t.listId !== id);
    this.save();
  }

  // Tasks
  getTasks(filter = {}) {
    let tasks = [...this.data.tasks];

    if (filter.listId) {
      tasks = tasks.filter(t => t.listId === filter.listId);
    }

    if (filter.view === 'my-day') {
      tasks = tasks.filter(t => t.inMyDay);
    } else if (filter.view === 'important') {
      tasks = tasks.filter(t => t.important);
    } else if (filter.view === 'planned') {
      tasks = tasks.filter(t => t.dueDate);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q))
      );
    }

    if (filter.completed !== undefined) {
      tasks = tasks.filter(t => t.completed === filter.completed);
    }

    return this._sortTasks(tasks, filter.sortBy || this.data.settings.sortBy || 'created');
  }

  _sortTasks(tasks, sortBy) {
    const sorted = [...tasks];
    const cmp = (a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        case 'important':
          if (a.important !== b.important) return a.important ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        case 'alpha':
          return a.title.localeCompare(b.title, 'zh-CN');
        case 'manual':
          return (a.order || 0) - (b.order || 0);
        case 'created':
        default:
          return b.createdAt - a.createdAt;
      }
    };
    // keep completed at bottom always
    return sorted.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return cmp(a, b);
    });
  }

  createTask(taskData) {
    const task = {
      id: this.generateId(),
      listId: taskData.listId || 'tasks',
      title: taskData.title,
      note: taskData.note || '',
      completed: false,
      completedAt: null,
      important: false,
      inMyDay: false,
      dueDate: null,
      reminder: null,
      repeat: 'none',
      subtasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    };
    this.data.tasks.push(task);
    this.save();
    return task;
  }

  updateTask(id, updates) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      Object.assign(task, updates, { updatedAt: Date.now() });
      this.save();
    }
    return task;
  }

  deleteTask(id) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.save();
  }

  toggleComplete(id) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;
      task.updatedAt = Date.now();

      if (task.repeat !== 'none' && task.completed && task.dueDate) {
        const nextTask = this.createNextOccurrence(task);
        this.data.tasks.push(nextTask);
      }

      this.save();
    }
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

  addSubtask(taskId, title) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
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
      const subtask = task.subtasks.find(s => s.id === subtaskId);
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
      task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  // Settings
  getSettings() {
    return { ...this.data.settings };
  }

  updateSettings(updates) {
    Object.assign(this.data.settings, updates);
    this.save();
  }

  // Helpers
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  createNextOccurrence(task) {
    const nextTask = { ...task };
    nextTask.id = this.generateId();
    nextTask.completed = false;
    nextTask.completedAt = null;
    nextTask.createdAt = Date.now();
    nextTask.updatedAt = Date.now();
    nextTask.subtasks = task.subtasks.map(s => ({ ...s, completed: false }));

    const date = new Date(task.dueDate);
    switch (task.repeat) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekdays':
        do {
          date.setDate(date.getDate() + 1);
        } while (date.getDay() === 0 || date.getDay() === 6);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    nextTask.dueDate = date.toISOString().split('T')[0];

    return nextTask;
  }

  getCounts() {
    const active = this.data.tasks.filter(t => !t.completed);
    return {
      myDay: active.filter(t => t.inMyDay).length,
      important: active.filter(t => t.important).length,
      planned: active.filter(t => t.dueDate).length,
      tasks: active.length,
      ...this.data.lists.reduce((acc, list) => {
        acc[list.id] = active.filter(t => t.listId === list.id).length;
        return acc;
      }, {})
    };
  }

  getMyDaySuggestions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.data.tasks.filter(t => {
      if (t.completed || t.inMyDay) return false;
      if (t.important) return true;
      if (t.dueDate) {
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        if (due <= today) return true;
        if (due.getTime() === today.getTime()) return true;
      }
      return false;
    });
  }

  getPlannedGroups() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [] };

    this.data.tasks.filter(t => !t.completed && t.dueDate).forEach(t => {
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < today) groups.overdue.push(t);
      else if (due.getTime() === today.getTime()) groups.today.push(t);
      else if (due.getTime() === tomorrow.getTime()) groups.tomorrow.push(t);
      else if (due <= weekEnd) groups.thisWeek.push(t);
      else groups.later.push(t);
    });

    return groups;
  }

  moveTaskToList(taskId, listId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      task.listId = listId;
      task.updatedAt = Date.now();
      this.save();
    }
    return task;
  }

  duplicateTask(taskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      const dup = {
        ...task,
        id: this.generateId(),
        title: task.title + ' (副本)',
        completed: false,
        completedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        subtasks: task.subtasks.map(s => ({ ...s, id: this.generateId(), completed: false })),
      };
      this.data.tasks.push(dup);
      this.save();
      return dup;
    }
    return null;
  }
}

export const store = new Store();
