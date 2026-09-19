import { store } from './Store.js';
import { theme } from './Theme.js';
import { eventBus } from './EventBus.js';
import { Sidebar } from './Sidebar.js';
import { TaskList } from './TaskList.js';
import { TaskDetail } from './TaskDetail.js';
import { Settings } from './Settings.js';
import { Pomodoro } from './Pomodoro.js';

class App {
  constructor() {
    this.sidebar = null;
    this.taskList = null;
    this.taskDetail = null;
    this.settings = null;
    this.pomodoro = null;
  }

  async init() {
    await store.load();
    await theme.load();

    const settings = store.getSettings();
    theme.apply(settings.theme);
    theme.applyMode(settings.mode || 'normal');
    theme.setAutoNight(!!settings.autoNightMode);

    if (settings.sideBarHidden) {
      document.documentElement.classList.add('side-bar-hidden');
    }

    this.sidebar = new Sidebar();
    this.taskList = new TaskList();
    this.taskDetail = new TaskDetail();
    this.settings = new Settings();
    this.pomodoro = new Pomodoro();

    this.bindEvents();
    this.bindMenuActions();
    this.bindKeyboard();
    this.setupReminderChecker();
  }

  bindEvents() {
    eventBus.on('view:change', ({ view, listId }) => {
      this.taskList.setView(view, listId);
      if (view === 'pomodoro') {
        if (!this.pomodoro.visible) this.pomodoro.toggle();
      } else if (this.pomodoro.visible) {
        this.pomodoro.toggle();
      }
    });
    eventBus.on('search:change', (query) => {
      this.taskList.setSearch(query);
    });

    eventBus.on('task:create', () => {
      this.sidebar.update();
    });

    eventBus.on('task:update', () => {
      this.sidebar.update();
      this.taskList.render();
    });

    eventBus.on('task:delete', () => {
      this.sidebar.update();
      this.taskList.render();
    });

    eventBus.on('list:create', () => {
      this.sidebar.update();
    });

    eventBus.on('list:update', () => {
      this.taskList.render();
    });

    eventBus.on('list:delete', () => {
      this.taskList.render();
    });

    eventBus.on('task:deselect', () => {
      this.taskList.selectedTaskId = null;
      this.taskList.render();
    });
  }

  bindMenuActions() {
    window.api.onMenuAction((action, data) => {
      this.handleAction(action, data);
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
        this.taskDetail.toggleMyDay();
        break;
      case 'toggle-important':
        this.taskList.toggleImportantSelected();
        break;
      case 'set-reminder':
        this.taskDetail.focusReminder();
        break;
      case 'add-due-date':
        this.taskDetail.focusDueDate();
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
        this.sidebar.jumpToList(data);
        break;
      case 'next-list':
        this.sidebar.nextList();
        break;
      case 'prev-list':
        this.sidebar.prevList();
        break;
      case 'return':
        this.taskDetail.close();
        break;
      case 'settings':
        this.settings.open();
        break;
      case 'toggle-sidebar':
        this.toggleSidebar();
        break;
      case 'always-on-top':
        store.updateSettings({ alwaysOnTop: data });
        break;
      case 'toggle-mode':
        const mode = theme.toggleMode(data);
        store.updateSettings({ mode });
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
        document.documentElement.classList.toggle('compact-mode', data);
        break;
      case 'auto-night':
        theme.setAutoNight(data);
        store.updateSettings({ autoNightMode: data });
        break;
      case 'popup-new-todo':
        this.taskList.focusInput();
        window.api.window.show();
        break;
      case 'popup-search':
        this.sidebar.focusSearch();
        window.api.window.show();
        break;
      default:
        break;
    }
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

  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      if (e.shiftKey) {
        switch (key) {
          case 'h': this.taskList.toggleHideCompleted(); e.preventDefault(); return;
          case 'n': this.taskList.toggleCompleteSelected(); e.preventDefault(); return;
          case 'd': this.sidebar.deleteCurrentList(); e.preventDefault(); return;
          case 't': this.taskDetail.focusDueDate(); e.preventDefault(); return;
          case 'e': this.taskDetail.focusReminder(); e.preventDefault(); return;
          case 'm': this.sidebar.jumpToView('my-day'); e.preventDefault(); return;
          case 'i': this.sidebar.jumpToView('important'); e.preventDefault(); return;
          case 'p': this.sidebar.jumpToView('planned'); e.preventDefault(); return;
          case 'a': this.sidebar.jumpToView('tasks'); e.preventDefault(); return;
        }
      }

      switch (key) {
        case 'f': this.sidebar.focusSearch(); e.preventDefault(); return;
        case 'n': this.taskList.focusInput(); e.preventDefault(); return;
        case 'd': this.taskList.deleteSelectedTask(); e.preventDefault(); return;
        case 't': this.taskList.renameSelectedTask(); e.preventDefault(); return;
        case 'l': this.sidebar.addList(); e.preventDefault(); return;
        case 'y': this.sidebar.renameCurrentList(); e.preventDefault(); return;
        case 'k': this.taskDetail.toggleMyDay(); e.preventDefault(); return;
        case 'i': this.taskList.toggleImportantSelected(); e.preventDefault(); return;
        case 'o': this.toggleSidebar(); e.preventDefault(); return;
        case ',': this.settings.open(); e.preventDefault(); return;
        case 'h': theme.toggleMode('dark'); store.updateSettings({ mode: theme.mode }); e.preventDefault(); return;
        case 'b': theme.toggleMode('black'); store.updateSettings({ mode: theme.mode }); e.preventDefault(); return;
        case 'g': theme.toggleMode('sepia'); store.updateSettings({ mode: theme.mode }); e.preventDefault(); return;
        case '0': window.api.zoom.reset(); e.preventDefault(); return;
        case '-': window.api.zoom.out(); e.preventDefault(); return;
        case '=':
        case '+': window.api.zoom.in(); e.preventDefault(); return;
        case 'tab':
          e.preventDefault();
          if (e.shiftKey) this.sidebar.prevList();
          else this.sidebar.nextList();
          return;
      }

      const n = parseInt(key, 10);
      if (n > 0 && n < 10) {
        this.sidebar.jumpToList(n - 1);
        e.preventDefault();
      }
    });
  }

  setupReminderChecker() {
    setInterval(() => this.checkReminders(), 60000);
  }

  checkReminders() {
    const now = new Date();
    store.data.tasks.filter(t => !t.completed && t.reminder).forEach(task => {
      const reminderTime = new Date(task.reminder);
      const diff = reminderTime - now;
      if (diff > 0 && diff < 60000) {
        window.api.notify('任务提醒', `${task.title} - ${this.formatReminder(task)}`);
      }
    });
  }

  formatReminder(task) {
    return new Date(task.reminder).toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}

const app = new App();
app.init();