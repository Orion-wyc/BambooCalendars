import { store } from './Store.js';
import { eventBus } from './EventBus.js';

export class TaskList {
  constructor() {
    this.currentView = 'tasks';
    this.currentListId = null;
    this.searchQuery = '';
    this.selectedTaskId = null;
    this.collapsedSections = { completed: true };
    this.render();
    this.bindEvents();
  }

  setView(view, listId = null) {
    this.currentView = view;
    this.currentListId = listId;
    this.render();
  }

  setSearch(query) {
    this.searchQuery = query;
    this.render();
  }

  getTasks() {
    const filter = {
      view: this.currentView,
      listId: this.currentListId,
      search: this.searchQuery
    };
    return store.getTasks(filter);
  }

  render() {
    this.renderHeader();
    this.renderInput();
    this.renderTasks();
  }

  renderHeader() {
    const header = document.getElementById('list-header');
    let title = '任务';
    
    if (this.currentView === 'my-day') title = '☀ 我的一天';
    else if (this.currentView === 'important') title = '★ 重要';
    else if (this.currentView === 'planned') title = '📅 已计划';
    else if (this.currentView === 'list' && this.currentListId) {
      const list = store.data.lists.find(l => l.id === this.currentListId);
      title = `📋 ${list ? list.name : '清单'}`;
    }

    header.innerHTML = `<h1>${title}</h1>`;
  }

  renderInput() {
    const area = document.getElementById('task-input-area');
    area.innerHTML = `
      <div class="task-input-wrapper">
        <div class="task-input-icon">+</div>
        <input type="text" class="task-input" id="task-input" placeholder="添加任务..." autocomplete="off">
      </div>
    `;
  }

  renderTasks() {
    const area = document.getElementById('task-list-area');
    const allTasks = this.getTasks();
    
    if (allTasks.length === 0) {
      area.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">暂无任务</div>
          <div class="empty-state-desc">添加新任务开始使用</div>
        </div>
      `;
      return;
    }

    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);

    let html = '';

    // Active tasks
    if (activeTasks.length > 0) {
      html += `<div class="task-section">
        <div class="task-list">
          ${activeTasks.map(task => this.renderTaskItem(task)).join('')}
        </div>
      </div>`;
    }

    // Completed tasks
    if (completedTasks.length > 0) {
      const isCollapsed = this.collapsedSections.completed;
      html += `
        <div class="task-section">
          <div class="task-section-header" data-section="completed">
            <div class="task-section-toggle ${isCollapsed ? 'collapsed' : ''}">▾</div>
            <div class="task-section-title">已完成</div>
            <div class="task-section-count">${completedTasks.length}</div>
          </div>
          ${!isCollapsed ? `
            <div class="task-list">
              ${completedTasks.map(task => this.renderTaskItem(task)).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    area.innerHTML = html;
  }

  renderTaskItem(task) {
    const dueDateStr = this.formatDueDate(task.dueDate);
    const dueDateClass = this.getDueDateClass(task.dueDate, task.completed);
    
    return `
      <div class="task-item ${task.completed ? 'completed' : ''} ${this.selectedTaskId === task.id ? 'selected' : ''}" 
           data-task-id="${task.id}" draggable="true">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle-complete" data-task-id="${task.id}">
          ${task.completed ? '✓' : ''}
        </div>
        <div class="task-content" data-action="select" data-task-id="${task.id}">
          <div class="task-title">${this.escapeHtml(task.title)}</div>
          <div class="task-meta">
            ${task.dueDate ? `<div class="task-due-date ${dueDateClass}">📅 ${dueDateStr}</div>` : ''}
            ${task.subtasks.length > 0 ? `<div>📝 ${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length}</div>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-task-action ${task.important ? 'active' : ''}" data-action="toggle-important" data-task-id="${task.id}" title="重要">
            ${task.important ? '★' : '☆'}
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Task input
    document.getElementById('task-input-area').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'task-input') {
        const title = e.target.value.trim();
        if (title) {
          const listId = this.currentView === 'list' ? this.currentListId : 'tasks';
          store.createTask({ title, listId });
          e.target.value = '';
          this.render();
          eventBus.emit('task:create');
        }
      }
    });

    // Task area clicks
    document.getElementById('task-list-area').addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const taskId = e.target.dataset.taskId;

      if (action === 'toggle-complete') {
        store.toggleComplete(taskId);
        this.render();
        eventBus.emit('task:update');
      } else if (action === 'toggle-important') {
        store.toggleImportant(taskId);
        this.render();
        eventBus.emit('task:update');
      } else if (action === 'select') {
        this.selectedTaskId = taskId;
        this.render();
        eventBus.emit('task:select', taskId);
      } else {
        // Section toggle
        const header = e.target.closest('.task-section-header');
        if (header) {
          const section = header.dataset.section;
          this.collapsedSections[section] = !this.collapsedSections[section];
          this.render();
        }
      }
    });

    // Drag and drop
    const area = document.getElementById('task-list-area');
    
    area.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.task-item');
      if (item) {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.taskId);
      }
    });

    area.addEventListener('dragend', (e) => {
      const item = e.target.closest('.task-item');
      if (item) {
        item.classList.remove('dragging');
      }
    });

    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      const item = e.target.closest('.task-item');
      if (item && !item.classList.contains('dragging')) {
        item.classList.add('drag-over');
      }
    });

    area.addEventListener('dragleave', (e) => {
      const item = e.target.closest('.task-item');
      if (item) {
        item.classList.remove('drag-over');
      }
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      const item = e.target.closest('.task-item');
      if (item) {
        item.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = item.dataset.taskId;
        this.reorderTasks(draggedId, targetId);
      }
    });
  }

  reorderTasks(draggedId, targetId) {
    const tasks = store.data.tasks;
    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    const targetIndex = tasks.findIndex(t => t.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const [draggedTask] = tasks.splice(draggedIndex, 1);
    tasks.splice(targetIndex, 0, draggedTask);
    
    store.save();
    this.render();
  }

  // Menu / shortcut action helpers
  focusInput() {
    const input = document.getElementById('task-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  getSelectedTask() {
    if (!this.selectedTaskId) return null;
    return store.data.tasks.find(t => t.id === this.selectedTaskId);
  }

  selectFirstActive() {
    const tasks = this.getTasks().filter(t => !t.completed);
    if (tasks.length > 0) {
      this.selectedTaskId = tasks[0].id;
      this.render();
      return tasks[0];
    }
    return null;
  }

  deleteSelectedTask() {
    let task = this.getSelectedTask();
    if (!task) task = this.selectFirstActive();
    if (!task) return;
    if (confirm(`确定删除任务"${task.title}"？`)) {
      store.deleteTask(task.id);
      if (this.selectedTaskId === task.id) {
        this.selectedTaskId = null;
        eventBus.emit('task:deselect');
      }
      this.render();
      eventBus.emit('task:delete');
    }
  }

  renameSelectedTask() {
    let task = this.getSelectedTask();
    if (!task) task = this.selectFirstActive();
    if (!task) return;
    const newTitle = prompt('重命名任务:', task.title);
    if (newTitle && newTitle.trim()) {
      store.updateTask(task.id, { title: newTitle.trim() });
      this.render();
      eventBus.emit('task:update');
    }
  }

  toggleCompleteSelected() {
    let task = this.getSelectedTask();
    if (!task) task = this.selectFirstActive();
    if (!task) return;
    store.toggleComplete(task.id);
    this.render();
    eventBus.emit('task:update');
  }

  toggleImportantSelected() {
    let task = this.getSelectedTask();
    if (!task) task = this.selectFirstActive();
    if (!task) return;
    store.toggleImportant(task.id);
    this.render();
    eventBus.emit('task:update');
  }

  toggleHideCompleted() {
    this.collapsedSections.completed = !this.collapsedSections.completed;
    this.render();
  }

  formatDueDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const taskDate = new Date(dateStr);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return '今天';
    if (taskDate.getTime() === tomorrow.getTime()) return '明天';
    if (taskDate < today) return '已过期';
    
    const diff = Math.ceil((taskDate - today) / (1000 * 60 * 60 * 24));
    if (diff <= 7) return `${diff} 天后`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  getDueDateClass(dateStr, completed) {
    if (!dateStr || completed) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dateStr);
    taskDate.setHours(0, 0, 0, 0);
    
    if (taskDate < today) return 'overdue';
    if (taskDate.getTime() === today.getTime()) return 'today';
    return '';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
