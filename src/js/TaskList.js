import { store } from './Store.js';
import { eventBus } from './EventBus.js';

export class TaskList {
  constructor() {
    this.currentView = 'tasks';
    this.currentListId = null;
    this.searchQuery = '';
    this.selectedTaskId = null;
    this.collapsedSections = { completed: true };
    this.contextMenu = null;
    this.render();
    this.bindEvents();
  }

  setView(view, listId = null) {
    this.currentView = view;
    this.currentListId = listId;
    this.selectedTaskId = null;
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
    let subtitle = '';

    if (this.currentView === 'my-day') title = '☀ 我的一天';
    else if (this.currentView === 'important') title = '★ 重要';
    else if (this.currentView === 'planned') title = '📅 已计划';
    else if (this.currentView === 'list' && this.currentListId) {
      const list = store.data.lists.find(l => l.id === this.currentListId);
      title = `📋 ${list ? list.name : '清单'}`;
    }
    if (this.searchQuery) subtitle = `搜索"${this.searchQuery}"的结果`;

    header.innerHTML = `<h1>${title}</h1>${subtitle ? `<div class="list-header-subtitle">${subtitle}</div>` : ''}`;
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
    this.closeContextMenu();

    if (this.currentView === 'planned') {
      this.renderPlannedView(area);
      return;
    }

    if (this.currentView === 'my-day') {
      this.renderMyDayView(area);
      return;
    }

    const allTasks = this.getTasks();

    if (allTasks.length === 0) {
      area.innerHTML = this.emptyState(this.currentView);
      return;
    }

    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);

    let html = '';

    if (activeTasks.length > 0) {
      html += `<div class="task-section">
        <div class="task-list">
          ${activeTasks.map(task => this.renderTaskItem(task)).join('')}
        </div>
      </div>`;
    }

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

  renderPlannedView(area) {
    const groups = store.getPlannedGroups();
    const groupTitles = {
      overdue: '已过期',
      today: '今天',
      tomorrow: '明天',
      thisWeek: '本周',
      later: '以后'
    };
    const hasAny = Object.values(groups).some(g => g.length > 0);

    if (!hasAny) {
      area.innerHTML = this.emptyState('planned');
      return;
    }

    let html = '';
    Object.keys(groups).forEach(key => {
      const tasks = groups[key];
      if (tasks.length === 0) return;
      html += `
        <div class="task-section">
          <div class="task-section-header">
            <div class="task-section-title">${groupTitles[key]}</div>
            <div class="task-section-count">${tasks.length}</div>
          </div>
          <div class="task-list">
            ${tasks.map(t => this.renderTaskItem(t)).join('')}
          </div>
        </div>
      `;
    });
    area.innerHTML = html;
  }

  renderMyDayView(area) {
    const allTasks = this.getTasks();
    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);
    const suggestions = store.getMyDaySuggestions();

    let html = '';

    if (activeTasks.length > 0) {
      html += `<div class="task-section">
        <div class="task-list">
          ${activeTasks.map(task => this.renderTaskItem(task)).join('')}
        </div>
      </div>`;
    }

    if (suggestions.length > 0) {
      html += `
        <div class="task-section">
          <div class="task-section-header">
            <div class="task-section-title">💡 建议</div>
            <div class="task-section-desc">未添加到我的日的任务</div>
          </div>
          <div class="task-list">
            ${suggestions.map(task => `
              <div class="task-item suggestion-item" data-task-id="${task.id}" data-action="add-suggestion">
                <div class="task-suggestion-add">+</div>
                <div class="task-content" data-action="select" data-task-id="${task.id}">
                  <div class="task-title">${this.highlightSearch(this.escapeHtml(task.title))}</div>
                  <div class="task-meta">
                    ${task.important ? '<div>★ 重要</div>' : ''}
                    ${task.dueDate ? `<div class="task-due-date">📅 ${this.formatDueDate(task.dueDate)}</div>` : ''}
                  </div>
                </div>
                <button class="btn-task-action" data-action="add-suggestion" data-task-id="${task.id}" title="添加到我的日">＋</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

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

    if (html === '') {
      area.innerHTML = this.emptyState('my-day');
      return;
    }
    area.innerHTML = html;
  }

  emptyState(view) {
    const map = {
      'my-day': ['🌤', '我的一天是空的', '添加任务或从建议中选择'],
      'important': ['⭐', '暂无重要任务', '点击任务旁的星标标记重要'],
      'planned': ['🗓', '暂无已计划任务', '为任务设置截止日期'],
      'tasks': ['📝', '暂无任务', '在上方输入框添加新任务'],
      'list': ['📋', '此清单暂无任务', '在上方输入框添加新任务'],
      'search': ['🔍', '未找到匹配任务', '换个关键词试试']
    };
    const [icon, title, desc] = map[view] || map['tasks'];
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-desc">${desc}</div>
      </div>
    `;
  }

  renderTaskItem(task) {
    const dueDateStr = this.formatDueDate(task.dueDate);
    const dueDateClass = this.getDueDateClass(task.dueDate, task.completed);
    const highlighted = this.highlightSearch(this.escapeHtml(task.title));

    return `
      <div class="task-item ${task.completed ? 'completed' : ''} ${this.selectedTaskId === task.id ? 'selected' : ''}" 
           data-task-id="${task.id}" draggable="true">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle-complete" data-task-id="${task.id}">
          ${task.completed ? '✓' : ''}
        </div>
        <div class="task-content" data-action="select" data-task-id="${task.id}">
          <div class="task-title">${highlighted}</div>
          <div class="task-meta">
            ${task.important ? '<div>★</div>' : ''}
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

  highlightSearch(text) {
    if (!this.searchQuery) return text;
    const q = this.escapeHtml(this.searchQuery);
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return text;
    try {
      const re = new RegExp(`(${escaped})`, 'gi');
      return text.replace(re, '<mark>$1</mark>');
    } catch {
      return text;
    }
  }

  bindEvents() {
    const area = document.getElementById('task-list-area');
    const inputArea = document.getElementById('task-input-area');

    inputArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'task-input') {
        this.createTaskFromInput(e.target);
      }
    });

    area.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const taskId = e.target.dataset.taskId;

      if (action === 'toggle-complete') {
        this.toggleComplete(taskId);
      } else if (action === 'toggle-important') {
        this.toggleImportant(taskId);
      } else if (action === 'add-suggestion') {
        this.addSuggestionToMyDay(taskId);
      } else if (action === 'select') {
        this.selectTask(taskId);
      } else {
        const header = e.target.closest('.task-section-header');
        if (header) {
          const section = header.dataset.section;
          if (section) {
            this.collapsedSections[section] = !this.collapsedSections[section];
            this.render();
          }
        }
      }
    });

    // Double-click for inline editing
    area.addEventListener('dblclick', (e) => {
      const titleEl = e.target.closest('.task-title');
      if (titleEl) {
        const item = titleEl.closest('.task-item');
        if (item && !item.classList.contains('completed')) {
          this.startInlineEdit(item);
        }
      }
    });

    // Right-click context menu
    area.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.task-item');
      if (item) {
        e.preventDefault();
        const taskId = item.dataset.taskId;
        this.showContextMenu(taskId, e.clientX, e.clientY);
      }
    });

    // Drag and drop
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
      if (item) item.classList.remove('dragging');
    });

    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      const item = e.target.closest('.task-item');
      if (item && !item.classList.contains('dragging')) item.classList.add('drag-over');
    });

    area.addEventListener('dragleave', (e) => {
      const item = e.target.closest('.task-item');
      if (item) item.classList.remove('drag-over');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      const item = e.target.closest('.task-item');
      if (item) {
        item.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        this.reorderTasks(draggedId, item.dataset.taskId);
      }
    });

    // Close context menu on outside click
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.closeContextMenu();
      }
    });
  }

  createTaskFromInput(input) {
    const title = input.value.trim();
    if (!title) return;
    let listId = 'tasks';
    if (this.currentView === 'list' && this.currentListId) listId = this.currentListId;
    if (this.currentView === 'my-day') listId = 'tasks';
    const task = store.createTask({ title, listId });
    if (this.currentView === 'my-day') {
      store.updateTask(task.id, { inMyDay: true });
    }
    input.value = '';
    this.render();
    eventBus.emit('task:create');
  }

  toggleComplete(taskId) {
    store.toggleComplete(taskId);
    this.render();
    eventBus.emit('task:update');
  }

  toggleImportant(taskId) {
    store.toggleImportant(taskId);
    this.render();
    eventBus.emit('task:update');
  }

  addSuggestionToMyDay(taskId) {
    store.updateTask(taskId, { inMyDay: true });
    this.render();
    eventBus.emit('task:update');
  }

  selectTask(taskId) {
    this.selectedTaskId = taskId;
    this.render();
    eventBus.emit('task:select', taskId);
  }

  startInlineEdit(item) {
    const taskId = item.dataset.taskId;
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;

    const titleEl = item.querySelector('.task-title');
    const current = task.title;
    titleEl.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = current;
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        if (val) {
          store.updateTask(taskId, { title: val });
          eventBus.emit('task:update');
        }
        this.render();
      } else if (e.key === 'Escape') {
        this.render();
      }
    });
    input.addEventListener('blur', () => this.render());
    titleEl.appendChild(input);
    input.focus();
    input.select();
  }

  showContextMenu(taskId, x, y) {
    this.closeContextMenu();
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;

    const lists = store.getLists();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [
      { icon: '✏️', label: task.completed ? '取消完成' : '完成任务', action: 'complete' },
      { icon: task.important ? '⭐' : '☆', label: task.important ? '取消重要' : '标记重要', action: 'important' },
      { icon: '☀', label: task.inMyDay ? '从我的日移除' : '添加到我的日', action: 'myday' },
      { icon: '✏️', label: '编辑标题', action: 'rename' },
      { icon: '📋', label: '移动到...', action: 'move', submenu: lists },
      { icon: '📝', label: '复制任务', action: 'duplicate' },
      { icon: '🗑', label: '删除', action: 'delete', danger: true },
    ];

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      if (item.danger) el.classList.add('danger');
      el.innerHTML = `<span class="context-menu-icon">${item.icon}</span>${item.label}`;

      if (item.submenu) {
        el.classList.add('has-submenu');
        const sub = document.createElement('div');
        sub.className = 'context-menu-submenu';
        item.submenu.forEach(list => {
          const li = document.createElement('div');
          li.className = 'context-menu-item';
          li.dataset.action = 'move-to-list';
          li.dataset.taskId = taskId;
          li.dataset.listId = list.id;
          li.innerHTML = `<span class="context-menu-icon">${list.id === task.listId ? '✓' : ''}</span>${list.name}`;
          li.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleContextAction('move-to-list', taskId, list.id);
          });
          sub.appendChild(li);
        });
        el.appendChild(sub);
        el.addEventListener('mouseenter', () => {
          sub.style.display = 'block';
        });
        el.addEventListener('mouseleave', () => {
          sub.style.display = 'none';
        });
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleContextAction(item.action, taskId);
      });
      menu.appendChild(el);
    });

    document.body.appendChild(menu);
    this.contextMenu = menu;
  }

  handleContextAction(action, taskId, listId) {
    switch (action) {
      case 'complete':
        store.toggleComplete(taskId);
        break;
      case 'important':
        store.toggleImportant(taskId);
        break;
      case 'myday':
        store.toggleMyDay(taskId);
        break;
      case 'rename':
        this.startInlineEdit(document.querySelector(`.task-item[data-task-id="${taskId}"]`));
        break;
      case 'move-to-list':
        store.moveTaskToList(taskId, listId);
        eventBus.emit('task:update');
        break;
      case 'duplicate':
        store.duplicateTask(taskId);
        eventBus.emit('task:update');
        break;
      case 'delete':
        if (confirm('确定删除此任务？')) {
          store.deleteTask(taskId);
          if (this.selectedTaskId === taskId) {
            this.selectedTaskId = null;
            eventBus.emit('task:deselect');
          }
          eventBus.emit('task:delete');
        }
        break;
    }
    this.closeContextMenu();
    this.render();
    eventBus.emit('task:update');
  }

  closeContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  reorderTasks(draggedId, targetId) {
    if (draggedId === targetId) return;
    const tasks = store.data.tasks;
    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    const targetIndex = tasks.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const [draggedTask] = tasks.splice(draggedIndex, 1);
    tasks.splice(targetIndex, 0, draggedTask);
    store.data.settings.sortBy = 'manual';
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
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}