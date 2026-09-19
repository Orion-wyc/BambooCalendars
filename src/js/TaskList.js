import { store } from './Store.js';
import { eventBus } from './EventBus.js';

const PRIORITY_COLORS = {
  1: '#e74c3c',
  2: '#e67e22',
  3: '#4a90d9',
  4: '#95a5a6'
};

const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };

export class TaskList {
  constructor() {
    this.currentView = 'tasks';
    this.currentListId = null;
    this.searchQuery = '';
    this.selectedTaskId = null;
    this.collapsedSections = { completed: true };
    this.contextMenu = null;
    this.filterPriority = null;
    this.filterTagId = null;
    this.calendarMonth = new Date();
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

  setPriorityFilter(p) {
    this.filterPriority = this.filterPriority === p ? null : p;
    this.render();
  }

  setTagFilter(tagId) {
    this.filterTagId = this.filterTagId === tagId ? null : tagId;
    this.render();
  }

  getTasks() {
    const filter = {
      view: this.currentView,
      listId: this.currentListId,
      search: this.searchQuery,
      priority: this.filterPriority,
      tagId: this.filterTagId
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
    else if (this.currentView === 'next7') title = '🗓 最近 7 天';
    else if (this.currentView === 'calendar') title = '📆 日历';
    else if (this.currentView === 'pomodoro') title = '🍅 番茄钟';
    else if (this.currentView === 'list' && this.currentListId) {
      const list = store.data.lists.find(l => l.id === this.currentListId);
      title = `📋 ${list ? list.name : '清单'}`;
    }
    if (this.searchQuery) subtitle = `搜索"${this.searchQuery}"的结果`;
    if (this.filterPriority || this.filterTagId) {
      const parts = [];
      if (this.filterPriority) parts.push(`优先级 ${PRIORITY_LABELS[this.filterPriority]}`);
      if (this.filterTagId) {
        const tag = store.getTag(this.filterTagId);
        parts.push(`标签 ${tag ? tag.name : ''}`);
      }
      subtitle = subtitle ? `${subtitle} · ${parts.join(' · ')}` : `筛选: ${parts.join(' · ')}`;
    }

    header.innerHTML = `<h1>${title}</h1>${subtitle ? `<div class="list-header-subtitle">${subtitle}</div>` : ''}`;
  }

  renderInput() {
    const area = document.getElementById('task-input-area');
    if (this.currentView === 'calendar') {
      area.innerHTML = '';
      return;
    }
    area.innerHTML = `
      <div class="task-input-wrapper">
        <div class="task-input-icon">+</div>
        <input type="text" class="task-input" id="task-input" placeholder="添加任务..." autocomplete="off">
      </div>
      ${this.renderFilterBar()}
    `;
  }

  renderTasks() {
    const area = document.getElementById('task-list-area');
    this.closeContextMenu();

    if (this.currentView === 'planned') {
      this.renderPlannedView(area);
      return;
    }

    if (this.currentView === 'next7') {
      this.renderNext7View(area);
      return;
    }

    if (this.currentView === 'calendar') {
      this.renderCalendarView(area);
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

  renderNext7View(area) {
    const groups = store.getNext7Days();
    let html = '';

    groups.forEach(group => {
      if (group.tasks.length === 0) return;
      html += `
        <div class="task-section">
          <div class="task-section-header">
            <div class="task-section-title">${group.label}</div>
            <div class="task-section-count">${group.tasks.length}</div>
          </div>
          <div class="task-list">
            ${group.tasks.map(t => this.renderTaskItem(t)).join('')}
          </div>
        </div>
      `;
    });

    if (!html) {
      area.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🗓</div>
          <div class="empty-state-title">未来 7 天没有任务</div>
          <div class="empty-state-desc">给任务设置截止日期后会显示在这里</div>
        </div>
      `;
      return;
    }
    area.innerHTML = html;
  }

  renderCalendarView(area) {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const tasks = store.getCalendarTasks(year, month);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = new Date(year, month, d).toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => t.dueDate === dateStr);
      const isToday = (() => {
        const dd = new Date(year, month, d);
        dd.setHours(0, 0, 0, 0);
        return dd.getTime() === today.getTime();
      })();
      cells += `
        <div class="cal-cell ${isToday ? 'today' : ''} ${dayTasks.length ? 'has-tasks' : ''}" data-date="${dateStr}">
          <div class="cal-day-num">${d}</div>
          <div class="cal-day-tasks">
            ${dayTasks.slice(0, 3).map(t => `
              <div class="cal-task" data-task-id="${t.id}">
                <span class="cal-priority" style="background:${PRIORITY_COLORS[t.priority] || '#95a5a6'}"></span>
                <span class="cal-task-title">${this.escapeHtml(t.title)}</span>
              </div>
            `).join('')}
            ${dayTasks.length > 3 ? `<div class="cal-more">+${dayTasks.length - 3} 更多</div>` : ''}
          </div>
        </div>
      `;
    }

    const monthName = `${year} 年 ${month + 1} 月`;
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    area.innerHTML = `
      <div class="calendar-view">
        <div class="calendar-header">
          <button class="btn-calendar-nav" id="cal-prev">‹</button>
          <div class="calendar-title">${monthName}</div>
          <button class="btn-calendar-nav" id="cal-next">›</button>
          <button class="btn-calendar-nav" id="cal-today">今天</button>
        </div>
        <div class="calendar-weekdays">
          ${weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        </div>
        <div class="calendar-grid">
          ${cells}
        </div>
        <div class="calendar-tasks-list" id="calendar-day-detail"></div>
      </div>
    `;

    this.bindCalendarEvents();
  }

  bindCalendarEvents() {
    const area = document.getElementById('task-list-area');
    area.querySelector('#cal-prev').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1);
      this.render();
    });
    area.querySelector('#cal-next').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1);
      this.render();
    });
    area.querySelector('#cal-today').addEventListener('click', () => {
      this.calendarMonth = new Date();
      this.render();
    });

    area.querySelectorAll('.cal-cell.has-tasks').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.cal-task')) return;
        const date = cell.dataset.date;
        this.showCalendarDayTasks(date);
      });
    });

    area.querySelectorAll('.cal-task').forEach(task => {
      task.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = task.dataset.taskId;
        this.selectTask(taskId);
      });
    });
  }

  showCalendarDayTasks(date) {
    const detail = document.getElementById('calendar-day-detail');
    const dayTasks = store.data.tasks.filter(t => t.dueDate === date);
    const dateLabel = new Date(date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    if (!dayTasks.length) {
      detail.innerHTML = `<div class="cal-day-empty">${dateLabel} 无任务</div>`;
      return;
    }
    detail.innerHTML = `
      <div class="cal-day-title">${dateLabel} · ${dayTasks.length} 个任务</div>
      <div class="task-list">
        ${dayTasks.map(t => this.renderTaskItem(t)).join('')}
      </div>
    `;
  }

  renderPlannedView(area) {
    const groups = store.getPlannedGroups();
    const groupTitles = { overdue: '已过期', today: '今天', tomorrow: '明天', thisWeek: '本周', later: '以后' };
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
      'next7': ['🗓', '未来 7 天没有任务', '为任务设置截止日期'],
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

  renderFilterBar() {
    const tags = store.getTags();
    return `
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">优先级</span>
          ${[1, 2, 3, 4].map(p => `
            <button class="filter-chip ${this.filterPriority === p ? 'active' : ''}" data-filter-priority="${p}">
              <span class="chip-dot" style="background:${PRIORITY_COLORS[p]}"></span>
              ${PRIORITY_LABELS[p]}
            </button>
          `).join('')}
        </div>
        ${tags.length ? `
          <div class="filter-group">
            <span class="filter-label">标签</span>
            ${tags.map(t => `
              <button class="filter-chip ${this.filterTagId === t.id ? 'active' : ''}" data-filter-tag="${t.id}">
                <span class="chip-dot" style="background:${t.color}"></span>
                ${t.name}
              </button>
            `).join('')}
          </div>
        ` : ''}
        ${(this.filterPriority || this.filterTagId) ? `<button class="filter-clear" id="filter-clear">清除筛选 ✕</button>` : ''}
      </div>
    `;
  }

  renderTaskItem(task) {
    const dueDateStr = this.formatDueDate(task.dueDate);
    const dueDateClass = this.getDueDateClass(task.dueDate, task.completed);
    const highlighted = this.highlightSearch(this.escapeHtml(task.title));
    const priorityColor = PRIORITY_COLORS[task.priority] || '#95a5a6';
    const tags = (task.tags || []).map(id => store.getTag(id)).filter(Boolean);

    return `
      <div class="task-item ${task.completed ? 'completed' : ''} ${this.selectedTaskId === task.id ? 'selected' : ''}" 
           data-task-id="${task.id}" draggable="true">
        <div class="task-priority-bar" style="background:${priorityColor}"></div>
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle-complete" data-task-id="${task.id}">
          ${task.completed ? '✓' : ''}
        </div>
        <div class="task-content" data-action="select" data-task-id="${task.id}">
          <div class="task-title">${highlighted}</div>
          <div class="task-meta">
            ${task.priority < 4 ? `<div class="task-priority-badge" style="color:${priorityColor};border-color:${priorityColor}">${PRIORITY_LABELS[task.priority]}</div>` : ''}
            ${task.important ? '<div>★</div>' : ''}
            ${task.dueDate ? `<div class="task-due-date ${dueDateClass}">📅 ${dueDateStr}</div>` : ''}
            ${task.subtasks.length > 0 ? `<div>📝 ${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length}</div>` : ''}
            ${tags.length ? `<div class="task-tags">${tags.map(t => `<span class="task-tag" style="background:${t.color}22;color:${t.color};border-color:${t.color}55">#${t.name}</span>`).join('')}</div>` : ''}
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
    const escaped = this.escapeHtml(this.searchQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return text;
    try {
      const re = new RegExp(`(${escaped})`, 'gi');
      return text.replace(re, '<mark>$1</mark>');
    } catch { return text; }
  }

  bindEvents() {
    const area = document.getElementById('task-list-area');
    const inputArea = document.getElementById('task-input-area');

    inputArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'task-input') {
        this.createTaskFromInput(e.target);
      }
    });

    // Filter bar
    inputArea.addEventListener('click', (e) => {
      const prioBtn = e.target.closest('[data-filter-priority]');
      if (prioBtn) {
        this.setPriorityFilter(parseInt(prioBtn.dataset.filterPriority, 10));
        return;
      }
      const tagBtn = e.target.closest('[data-filter-tag]');
      if (tagBtn) {
        this.setTagFilter(tagBtn.dataset.filterTag);
        return;
      }
      if (e.target.closest('#filter-clear')) {
        this.filterPriority = null;
        this.filterTagId = null;
        this.render();
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
    const tags = store.getTags();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 400)}px`;

    const items = [
      { icon: '✏️', label: task.completed ? '取消完成' : '完成任务', action: 'complete' },
      { icon: task.important ? '⭐' : '☆', label: task.important ? '取消重要' : '标记重要', action: 'important' },
      { icon: '☀', label: task.inMyDay ? '从我的日移除' : '添加到我的日', action: 'myday' },
      { icon: '⚑', label: '设置优先级', action: 'priority', submenu: [1, 2, 3, 4].map(p => ({ label: `${PRIORITY_LABELS[p]}  ${p === 1 ? '紧急' : p === 2 ? '高' : p === 3 ? '中' : '低'}`, action: `set-priority-${p}` })) },
      { icon: '🏷', label: '添加标签', action: 'tag', submenu: tags.map(t => ({ label: `#${t.name}`, action: `toggle-tag-${t.id}` })) },
      { icon: '✏️', label: '编辑标题', action: 'rename' },
      { icon: '📋', label: '移动到...', action: 'move', submenu: lists.map(l => ({ label: l.name, action: `move-to-${l.id}` })) },
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
        item.submenu.forEach(subItem => {
          const li = document.createElement('div');
          li.className = 'context-menu-item';
          li.dataset.taskId = taskId;
          li.dataset.action = subItem.action;
          if (subItem.action.startsWith('set-priority-')) {
            const p = parseInt(subItem.action.split('-')[2], 10);
            li.innerHTML = `<span class="context-menu-icon" style="color:${PRIORITY_COLORS[p]}">${task.priority === p ? '✓' : '•'}</span>${subItem.label}`;
          } else if (subItem.action.startsWith('toggle-tag-')) {
            const tagId = subItem.action.split('-')[2];
            li.innerHTML = `<span class="context-menu-icon">${task.tags.includes(tagId) ? '✓' : ''}</span>${subItem.label}`;
          } else if (subItem.action.startsWith('move-to-')) {
            const lid = subItem.action.split('-')[2];
            li.innerHTML = `<span class="context-menu-icon">${task.listId === lid ? '✓' : ''}</span>${subItem.label}`;
          } else {
            li.innerHTML = subItem.label;
          }
          li.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleContextAction(subItem.action, taskId);
          });
          sub.appendChild(li);
        });
        el.appendChild(sub);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.submenu) return;
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
      case 'duplicate':
        store.duplicateTask(taskId);
        break;
      case 'delete':
        if (confirm('确定删除此任务？')) {
          store.deleteTask(taskId);
          if (this.selectedTaskId === taskId) {
            this.selectedTaskId = null;
            eventBus.emit('task:deselect');
          }
        }
        break;
      default:
        if (action.startsWith('set-priority-')) {
          store.setPriority(taskId, parseInt(action.split('-')[2], 10));
        } else if (action.startsWith('toggle-tag-')) {
          const tagId = action.split('-')[2];
          const task = store.data.tasks.find(t => t.id === taskId);
          if (task && task.tags.includes(tagId)) store.removeTagFromTask(taskId, tagId);
          else store.addTagToTask(taskId, tagId);
        } else if (action.startsWith('move-to-')) {
          store.moveTaskToList(taskId, action.split('-')[2]);
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