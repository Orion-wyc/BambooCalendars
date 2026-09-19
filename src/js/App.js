import { store } from './Store.js';
import { theme } from './Theme.js';
import { eventBus } from './EventBus.js';
import { Sidebar } from './Sidebar.js';
import { TaskList } from './TaskList.js';
import { TaskDetail } from './TaskDetail.js';
import { Settings } from './Settings.js';
import { Pomodoro } from './Pomodoro.js';
import { parseDateTimeLocal } from './Utils.js';

const REMINDER_WINDOW_MS = 60 * 1000;
const REMINDER_MISSED_GRACE_MS = 10 * 60 * 1000;
const AUTOSAVE_INTERVAL_MS = 30 * 1000;

class App {
  constructor() {
    this.sidebar = null;
    this.taskList = null;
    this.taskDetail = null;
    this.settings = null;
    this.pomodoro = null;
  }

  async init() {
    try {
      await store.load();
    } catch (e) {
      this.showFatalError(e);
      return;
    }
    await theme.load();

    const settings = store.getSettings();
    theme.apply(settings.theme);
    theme.applyMode(settings.mode || 'normal');
    theme.setAutoNight(Boolean(settings.autoNightMode));

    const root = document.documentElement;
    root.classList.toggle('side-bar-hidden', Boolean(settings.sideBarHidden));
    root.classList.toggle('compact-mode', Boolean(settings.compactMode));

    this.sidebar = new Sidebar();
    this.taskList = new TaskList();
    this.taskDetail = new TaskDetail();
    this.settings = new Settings();
    this.pomodoro = new Pomodoro();

    this.bindEvents();
    this.bindMenuActions();
    this.bindKeyboard();
    this.setupReminderChecker();
    this.bindLifecycle();

    if (store.saveError) {
      console.warn('数据读取异常:', store.saveError);
    }
  }

  showFatalError(error) {
    const root = document.getElementById('app');
    if (!root) return;
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-title">数据加载失败</div>
        <div class="empty-state-desc">${error && error.message ? error.message : error}</div>
      </div>
    `;
  }

  bindEvents() {
    eventBus.on('view:change', ({ view, listId }) => {
      this.taskList.setView(view, listId);
      if (view === 'pomodoro') this.pomodoro.show();
      else this.pomodoro.hide();
    });

    eventBus.on('search:change', (query) => {
      this.taskList.setSearch(query);
    });

    eventBus.on('task:create', () => {
      this.sidebar.update();
    });

    eventBus.on('task:update', (taskId) => {
      this.sidebar.update();
      this.taskList.render();
      this.taskDetail.refreshIfShowing(taskId);
    });

    eventBus.on('task:deleted', (taskId) => {
      if (this.taskList.selectedTaskId === taskId) {
        this.taskList.selectedTaskId = null;
      }
      this.sidebar.update();
      this.taskList.render();
    });

    eventBus.on('task:deselect', () => {
      this.taskList.clearSelection();
    });

    eventBus.on('list:create', () => {
      this.sidebar.update();
      this.taskList.render();
    });

    eventBus.on('list:update', () => {
      this.sidebar.update();
      this.taskList.render();
      this.taskDetail.refreshIfShowing(this.taskDetail.currentTaskId);
    });

    eventBus.on('list:delete', () => {
      this.taskList.selectedTaskId = null;
      this.sidebar.update();
      this.taskList.render();
    });

    eventBus.on('tag:delete', (tagId) => {
      if (this.taskList.filterTagId === tagId) this.taskList.setTagFilter(tagId);
      this.taskList.render();
      this.taskDetail.refreshIfShowing(this.taskDetail.currentTaskId);
    });

    eventBus.on('settings:changed', () => {
      this.sidebar.update();
      this.taskList.render();
    });
  }

  bindMenuActions() {
    window.api.onMenuAction((action, data) => {
      try {
        this.handleAction(action, data);
      } catch (e) {
        console.error('菜单动作执行失败:', action, e);
      }
    });
  }

  handleAction(action, data) {
    switch (action) {
      case 'search':
        this.sidebar.focusSearch();
        break;
      case 'new-list':
        this.sidebar.addList();
        break;
      case 'rename-list':
        this.sidebar.renameCurrentList();
        break;
      case 'delete-list':
        this.sidebar.deleteCurrentList();
        break;
      case 'hide-completed':
        this.taskList.toggleHideCompleted();
        break;
      case 'new-todo':
        this.taskList.focusInput();
        break;
      case 'delete-todo':
        this.taskList.deleteSelectedTask();
        break;
      case 'rename-todo':
        this.taskList.renameSelectedTask();
        break;
      case 'complete-todo':
        this.taskList.toggleCompleteSelected();
        break;
      case 'add-my-day':
        this.taskList.toggleMyDaySelected();
        break;
      case 'toggle-important':
        this.taskList.toggleImportantSelected();
        break;
      case 'set-reminder':
        this.taskDetail.focusReminder(this.taskList.selectedTaskId);
        break;
      case 'add-due-date':
        this.taskDetail.focusDueDate(this.taskList.selectedTaskId);
        break;
      case 'my-day':
        this.sidebar.jumpToView('my-day');
        break;
      case 'important':
        this.sidebar.jumpToView('important');
        break;
      case 'planned':
        this.sidebar.jumpToView('planned');
        break;
      case 'tasks':
        this.sidebar.jumpToView('tasks');
        break;
      case 'jump-list':
        this.sidebar.jumpToList(Number(data));
        break;
      case 'next-list':
        this.sidebar.nextList();
        break;
      case 'prev-list':
        this.sidebar.prevList();
        break;
      case 'return':
        this.dismissOverlays();
        break;
      case 'settings':
        this.settings.open();
        break;
      case 'toggle-sidebar':
        this.toggleSidebar();
        break;
      case 'always-on-top':
        store.updateSettings({ alwaysOnTop: Boolean(data) });
        break;
      case 'toggle-mode':
        this.applyMode(theme.toggleMode(data));
        break;
      case 'zoom-in':
        window.api.zoom.in();
        break;
      case 'zoom-out':
        window.api.zoom.out();
        break;
      case 'zoom-reset':
        window.api.zoom.reset();
        break;
      case 'about':
        this.settings.openAbout();
        break;
      case 'toggle-compact':
        this.toggleCompact();
        break;
      case 'compact-mode':
        document.documentElement.classList.toggle('compact-mode', Boolean(data));
        break;
      case 'auto-night':
        theme.setAutoNight(Boolean(data));
        store.updateSettings({ autoNightMode: Boolean(data), mode: theme.userMode });
        break;
      case 'popup-new-todo':
        window.api.window.show().then(() => this.taskList.focusInput());
        break;
      case 'popup-search':
        window.api.window.show().then(() => this.sidebar.focusSearch());
        break;
      default:
        break;
    }
  }

  applyMode(mode) {
    theme.setUserMode(mode);
    store.updateSettings({ mode });
  }

  dismissOverlays() {
    if (this.settings.isOpen) {
      this.settings.close();
      return true;
    }
    if (this.taskList.contextMenu) {
      this.taskList.closeContextMenu();
      return true;
    }
    if (this.taskDetail.isOpen()) {
      this.taskDetail.close();
      return true;
    }
    return false;
  }

  toggleSidebar() {
    const hidden = document.documentElement.classList.toggle('side-bar-hidden');
    store.updateSettings({ sideBarHidden: hidden });
  }

  toggleCompact() {
    const enabled = document.documentElement.classList.toggle('compact-mode');
    store.updateSettings({ compactMode: enabled });
    window.api.app.applySetting('compactMode', enabled);
  }

  isEditableTarget(target) {
    if (!target || !target.closest) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.isEditableTarget(e.target)) this.dismissOverlays();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      if (this.isEditableTarget(e.target)) return;
      if (!e.key) return;

      const key = e.key.toLowerCase();

      if (e.shiftKey) {
        switch (key) {
          case 'h': this.taskList.toggleHideCompleted(); break;
          case 'n': this.taskList.toggleCompleteSelected(); break;
          case 'd': this.sidebar.deleteCurrentList(); break;
          case 'y': this.sidebar.renameCurrentList(); break;
          case 't': this.taskDetail.focusDueDate(this.taskList.selectedTaskId); break;
          case 'e': this.taskDetail.focusReminder(this.taskList.selectedTaskId); break;
          case 'm': this.sidebar.jumpToView('my-day'); break;
          case 'i': this.sidebar.jumpToView('important'); break;
          case 'p': this.sidebar.jumpToView('planned'); break;
          case 'a': this.sidebar.jumpToView('tasks'); break;
          case 'g': this.applyMode(theme.toggleMode('normal')); break;
          case 'j': this.toggleCompact(); break;
          case 'o': this.toggleAlwaysOnTop(); break;
          case 'tab': this.sidebar.prevList(); break;
          default: return;
        }
        e.preventDefault();
        return;
      }

      switch (key) {
        case 'f': this.sidebar.focusSearch(); break;
        case 'n': this.taskList.focusInput(); break;
        case 'd': this.taskList.deleteSelectedTask(); break;
        case 't': this.taskList.renameSelectedTask(); break;
        case 'l': this.sidebar.addList(); break;
        case 'k': this.taskList.toggleMyDaySelected(); break;
        case 'i': this.taskList.toggleImportantSelected(); break;
        case 'o': this.toggleSidebar(); break;
        case ',': this.settings.open(); break;
        case 'h': this.applyMode(theme.toggleMode('dark')); break;
        case 'b': this.applyMode(theme.toggleMode('black')); break;
        case 'g': this.applyMode(theme.toggleMode('sepia')); break;
        case '0': window.api.zoom.reset(); break;
        case '-': window.api.zoom.out(); break;
        case '=':
        case '+': window.api.zoom.in(); break;
        case 'tab': this.sidebar.nextList(); break;
        default: {
          const n = parseInt(key, 10);
          if (Number.isNaN(n) || n < 1 || n > 9) return;
          this.sidebar.jumpToList(n - 1);
          break;
        }
      }
      e.preventDefault();
    });
  }

  toggleAlwaysOnTop() {
    const enabled = !store.getSettings().alwaysOnTop;
    store.updateSettings({ alwaysOnTop: enabled });
    window.api.app.applySetting('alwaysOnTop', enabled);
  }

  bindLifecycle() {
    const flush = () => { store.flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
    setInterval(() => {
      if (store.dirty) store.flush();
    }, AUTOSAVE_INTERVAL_MS);
  }

  setupReminderChecker() {
    this.checkReminders();
    setInterval(() => this.checkReminders(), REMINDER_WINDOW_MS);
  }

  checkReminders() {
    const now = Date.now();
    let changed = false;

    store.data.tasks.forEach(task => {
      if (task.completed || !task.reminder || task.reminderNotified) return;
      const when = parseDateTimeLocal(task.reminder);
      if (!when) {
        task.reminderNotified = true;
        changed = true;
        return;
      }
      const diff = when.getTime() - now;
      if (diff > REMINDER_WINDOW_MS) return;

      if (diff > 0) {
        this.notifyReminder(task, when, false);
      } else if (-diff <= REMINDER_MISSED_GRACE_MS) {
        this.notifyReminder(task, when, true);
      }
      task.reminderNotified = true;
      changed = true;
    });

    if (changed) store.save();
  }

  notifyReminder(task, when, missed) {
    const timeText = when.toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    window.api.notify(
      missed ? '任务提醒（已错过）' : '任务提醒',
      `${task.title} - ${timeText}`
    );
  }
}

const app = new App();
app.init().catch(e => {
  console.error('应用初始化失败:', e);
});

export { app };
