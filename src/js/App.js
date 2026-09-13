import { store } from './Store.js';
import { theme } from './Theme.js';
import { eventBus } from './EventBus.js';
import { Sidebar } from './Sidebar.js';
import { TaskList } from './TaskList.js';
import { TaskDetail } from './TaskDetail.js';
import { Settings } from './Settings.js';

class App {
  constructor() {
    this.sidebar = null;
    this.taskList = null;
    this.taskDetail = null;
    this.settings = null;
  }

  async init() {
    // Load data
    await store.load();
    await theme.load();

    // Apply saved theme
    const settings = store.getSettings();
    theme.apply(settings.theme);

    // Initialize components
    this.sidebar = new Sidebar();
    this.taskList = new TaskList();
    this.taskDetail = new TaskDetail();
    this.settings = new Settings();

    // Bind global events
    this.bindEvents();

    // Setup reminder checker
    this.setupReminderChecker();
  }

  bindEvents() {
    eventBus.on('view:change', ({ view, listId }) => {
      this.taskList.setView(view, listId);
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

  setupReminderChecker() {
    setInterval(() => {
      this.checkReminders();
    }, 60000); // Check every minute
  }

  checkReminders() {
    const now = new Date();
    const tasks = store.data.tasks.filter(t => !t.completed && t.reminder);
    
    tasks.forEach(task => {
      const reminderTime = new Date(task.reminder);
      const diff = reminderTime - now;
      
      if (diff > 0 && diff < 60000) {
        window.api.notify('任务提醒', `${task.title} - ${this.formatReminder(task)}`);
      }
    });
  }

  formatReminder(task) {
    const reminder = new Date(task.reminder);
    return reminder.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Initialize app when DOM is ready
const app = new App();
app.init();
