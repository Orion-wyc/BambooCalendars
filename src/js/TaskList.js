import { store } from './Store.js';
import { eventBus } from './EventBus.js';
import { dialog } from './Dialog.js';
import {
  escapeHtml, formatDayLabel, formatDueDateLabel, isImeKeyEvent,
  startOfToday, toDateKey
} from './Utils.js';
import { icon } from './icons.js';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_NAMES, PRIORITY_FALLBACK } from './priority.js';
import { renderTaskItem as renderTaskItemHtml, highlightSearch as highlightText } from './taskItem.js';
import { flashEnter, clearClassAfterAnim } from './motion.js';

// 日历单日格内最多展示的彩色圆点数（两行 × 每行 5），超出不再显示圆点
const CAL_MAX_DOTS = 10;

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
    this.calendarMonth = startOfToday();
    this.calendarSelectedDate = null;
    this.editingTaskId = null;
    this.lastFilterHtml = null;
    this.notice = '';
    // 一次性入场控制：'all'=切换视图时整体淡入；Set=仅指定任务（如新建）入场
    this._animate = null;
    this._enterAll = false;
    this._enterIds = null;
    this._animIndex = 0;
    this.render();
    this.bindEvents();
  }

  setView(view, listId = null) {
    this.currentView = view;
    this.currentListId = listId;
    this.selectedTaskId = null;
    this.notice = '';
    this.calendarSelectedDate = null;
    this._animate = 'all';
    this.render();
  }

  setSearch(query) {
    this.searchQuery = query || '';
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

  clearFilters() {
    this.filterPriority = null;
    this.filterTagId = null;
    this.render();
  }

  hasFilter() {
    return Boolean(this.filterPriority || this.filterTagId || this.searchQuery);
  }

  getFilter() {
    return {
      search: this.searchQuery,
      priority: this.filterPriority,
      tagId: this.filterTagId,
    };
  }

  getTasks() {
    return store.getTasks({
      view: this.currentView,
      listId: this.currentListId,
      ...this.getFilter(),
    });
  }

  render() {
    this._animIndex = 0;
    this._enterAll = this._animate === 'all';
    this._enterIds = (this._animate instanceof Set) ? this._animate : null;
    const flash = this._enterAll;
    this._animate = null;

    this.renderHeader();
    this.renderInput();
    this.renderTasks();

    // 视图切换：整体淡入一次（仅 opacity+轻微位移，不影响任何几何测量）
    if (flash) {
      const area = document.getElementById('task-list-area');
      const header = document.getElementById('list-header');
      flashEnter(area, 'anim-in');
      flashEnter(header, 'anim-in');
      clearClassAfterAnim(area, 'anim-in');
      clearClassAfterAnim(header, 'anim-in');
    }
  }

  renderHeader() {
    const header = document.getElementById('list-header');
    let iconName = 'checkSquare';
    let title = '任务';

    if (this.currentView === 'my-day') { iconName = 'sun'; title = '我的一天'; }
    else if (this.currentView === 'important') { iconName = 'star'; title = '重要'; }
    else if (this.currentView === 'next7') { iconName = 'calendarCheck'; title = '最近 7 天'; }
    else if (this.currentView === 'calendar') { iconName = 'calendarGrid'; title = '日历'; }
    else if (this.currentView === 'list' && this.currentListId) {
      const list = store.getList(this.currentListId);
      iconName = 'clipboard';
      title = list ? escapeHtml(list.name) : '清单';
    }

    const parts = [];
    if (this.searchQuery) parts.push(`搜索"${escapeHtml(this.searchQuery)}"的结果`);
    if (this.filterPriority) parts.push(`优先级 ${PRIORITY_LABELS[this.filterPriority]}`);
    if (this.filterTagId) {
      const tag = store.getTag(this.filterTagId);
      parts.push(`标签 ${escapeHtml(tag ? tag.name : '未知')}`);
    }
    if (this.notice) parts.push(escapeHtml(this.notice));

    const subtitle = parts.length
      ? `<div class="list-header-subtitle">${parts.join(' · ')}</div>`
      : '';

    header.innerHTML = `
      <div class="list-header-inner">
        <span class="list-header-icon">${icon(iconName)}</span>
        <div class="list-header-text">
          <h1>${title}</h1>
          ${subtitle}
        </div>
      </div>
    `;
  }

  renderInput() {
    const area = document.getElementById('task-input-area');
    if (this.currentView === 'calendar') {
      area.innerHTML = '';
      this.lastFilterHtml = null;
      return;
    }

    const filterHtml = this.renderFilterBar();
    const previous = document.getElementById('task-input');
    if (previous && this.lastFilterHtml === filterHtml) return;
    this.lastFilterHtml = filterHtml;

    const draft = previous ? previous.value : '';
    const hadFocus = previous ? previous === document.activeElement : false;
    const caret = previous ? previous.selectionStart : 0;

    area.innerHTML = `
      <div class="task-input-wrapper">
        <span class="task-input-icon">${icon('plus', { size: 18 })}</span>
        <input type="text" class="task-input" id="task-input" placeholder="添加任务" autocomplete="off">
      </div>
      ${filterHtml}
    `;

    const input = document.getElementById('task-input');
    if (draft) {
      input.value = draft;
      if (hadFocus) {
        input.focus();
        const pos = typeof caret === 'number' ? caret : input.value.length;
        input.setSelectionRange(pos, pos);
      }
    }
  }

  renderTasks() {
    const area = document.getElementById('task-list-area');
    this.closeContextMenu();

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

    html += this.renderCompletedSection(completedTasks);

    area.innerHTML = html;
  }

  renderCompletedSection(completedTasks) {
    if (completedTasks.length === 0) return '';
    const isCollapsed = this.collapsedSections.completed;
    return `
      <div class="task-section completed-section">
        <div class="task-section-header" data-section="completed">
          <div class="task-section-toggle ${isCollapsed ? 'collapsed' : ''}">${icon('chevronDown', { size: 16 })}</div>
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

  renderNext7View(area) {
    const groups = store.getNext7Days(this.getFilter());

    if (!groups.some(g => g.tasks.length > 0)) {
      area.innerHTML = this.emptyState('next7');
      return;
    }

    area.innerHTML = groups.map(group => {
      if (group.tasks.length === 0) return '';
      return `
        <div class="task-section">
          <div class="task-section-header">
            <div class="task-section-title">${escapeHtml(group.label)}</div>
            <div class="task-section-count">${group.tasks.length}</div>
          </div>
          <div class="task-list">
            ${group.tasks.map(t => this.renderTaskItem(t)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderCalendarView(area) {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const tasks = store.getCalendarTasks(year, month, this.getFilter());
    const today = startOfToday();

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell empty" aria-hidden="true"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const dateStr = toDateKey(cellDate);
      const dayTasks = tasks.filter(t => t.dueDate === dateStr);
      const isToday = cellDate.getTime() === today.getTime();
      const isSelected = this.calendarSelectedDate === dateStr;
      const pending = dayTasks.filter(t => !t.completed);
      const done = dayTasks.filter(t => t.completed);
      // 未完成在前、已完成在尾；最多两行（每行 5，共 10）；超出 10 不显示圆点
      const shown = pending.concat(done).slice(0, CAL_MAX_DOTS);
      cells += `
        <div class="cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayTasks.length ? 'has-tasks' : ''}"
             data-date="${dateStr}" tabindex="0" role="button" aria-label="${escapeHtml(formatDayLabel(dateStr))}${dayTasks.length ? `，${pending.length} 项待办 / 共 ${dayTasks.length} 个任务` : ''}">
          <div class="cal-day-num">${d}</div>
          ${dayTasks.length ? `
          <div class="cal-dots" aria-hidden="true">
            ${shown.map(t => {
              const c = PRIORITY_COLORS[t.priority] || PRIORITY_FALLBACK;
              return t.completed
                ? `<span class="cal-dot is-done" data-task-id="${escapeHtml(t.id)}" style="color:${c}"></span>`
                : `<span class="cal-dot" data-task-id="${escapeHtml(t.id)}" style="background:${c}"></span>`;
            }).join('')}
          </div>
          <div class="cal-count" aria-hidden="true">${pending.length}<span class="cal-count-sep">|</span>${dayTasks.length}</div>` : ''}
        </div>
      `;
    }

    const monthName = `${year} 年 ${month + 1} 月`;
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    area.innerHTML = `
      <div class="calendar-view">
        <div class="calendar-header">
          <button class="btn-calendar-nav" id="cal-prev" title="上个月">${icon('chevronLeft', { size: 18 })}</button>
          <div class="calendar-title">${monthName}</div>
          <button class="btn-calendar-nav" id="cal-next" title="下个月">${icon('chevronRight', { size: 18 })}</button>
          <button class="btn-calendar-nav btn-calendar-today" id="cal-today">今天</button>
        </div>
        <div class="calendar-weekdays">
          ${weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        </div>
        <div class="calendar-grid">
          ${cells}
        </div>
      </div>
    `;

    this.bindCalendarEvents();
  }

  selectCalendarDay(dateStr) {
    this.calendarSelectedDate = dateStr;
    this.render();
    eventBus.emit('calendar:select', { date: dateStr, filter: this.getFilter() });
  }

  bindCalendarEvents() {
    const area = document.getElementById('task-list-area');
    area.querySelector('#cal-prev').addEventListener('click', () => {
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
      this.clearCalendarSelection();
    });
    area.querySelector('#cal-next').addEventListener('click', () => {
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
      this.clearCalendarSelection();
    });
    area.querySelector('#cal-today').addEventListener('click', () => {
      this.calendarMonth = startOfToday();
      this.selectCalendarDay(toDateKey(startOfToday()));
    });
  }

  clearCalendarSelection() {
    if (this.calendarSelectedDate === null) { this.render(); return; }
    this.calendarSelectedDate = null;
    this.render();
    eventBus.emit('calendar:deselect');
  }

  async createTaskForDate(date) {
    if (!date) return;
    const title = await dialog.input({
      title: `${formatDayLabel(date)} · 新建任务`,
      label: '任务标题',
      placeholder: '输入任务标题',
      confirmText: '创建',
    });
    if (!title) return;
    const extra = {};
    if (this.filterPriority) extra.priority = this.filterPriority;
    if (this.filterTagId) extra.tags = [this.filterTagId];
    const task = store.createTask({ title, listId: 'tasks', dueDate: date, ...extra });
    this.calendarSelectedDate = date;
    this.render();
    eventBus.emit('task:create', task.id);
    // 新建后刷新右侧当日清单（若正显示该日）
    eventBus.emit('calendar:select', { date, filter: this.getFilter() });
  }

  renderMyDayView(area) {
    const allTasks = this.getTasks();
    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);
    const suggestions = store.getMyDaySuggestions(this.getFilter());

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
        <div class="task-section suggestion-section">
          <div class="task-section-header">
            <span class="task-section-icon">${icon('bulb', { size: 16 })}</span>
            <div class="task-section-title">建议</div>
            <div class="task-section-desc">未添加到我的日的任务</div>
          </div>
          <div class="task-list">
            ${suggestions.map(task => `
              <div class="task-item suggestion-item" data-task-id="${escapeHtml(task.id)}">
                <div class="task-suggestion-add" data-action="add-suggestion" data-task-id="${escapeHtml(task.id)}" title="添加到我的一天">${icon('plus', { size: 14 })}</div>
                <div class="task-content" data-action="select" data-task-id="${escapeHtml(task.id)}">
                  <div class="task-title">${this.highlightSearch(task.title)}</div>
                  <div class="task-meta">
                    ${task.important ? `<div class="task-meta-item is-important">${icon('star', { size: 13 })}<span>重要</span></div>` : ''}
                    ${task.dueDate ? `<div class="task-meta-item task-due-date">${icon('flag', { size: 13 })}<span>${escapeHtml(formatDueDateLabel(task.dueDate))}</span></div>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += this.renderCompletedSection(completedTasks);

    if (!html.trim()) {
      area.innerHTML = this.emptyState('my-day');
      return;
    }
    area.innerHTML = html;
  }

  emptyState(view) {
    if (this.hasFilter()) {
      view = 'search';
    }
    const map = {
      'my-day': ['cloudSun', '我的一天是空的', '添加任务或从建议中选择'],
      'important': ['star', '暂无重要任务', '点击任务旁的星标标记重要'],
      'next7': ['calendarCheck', '未来 7 天没有任务', '为任务设置截止日期'],
      'tasks': ['inbox', '暂无任务', '在上方输入框添加新任务'],
      'list': ['clipboard', '此清单暂无任务', '在上方输入框添加新任务'],
      'search': ['search', '未找到匹配任务', '换个关键词或清除筛选条件试试']
    };
    const [iconName, title, desc] = map[view] || map['tasks'];
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon(iconName, { size: 56, strokeWidth: 1.3 })}</div>
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
              <button class="filter-chip ${this.filterTagId === t.id ? 'active' : ''}" data-filter-tag="${escapeHtml(t.id)}">
                <span class="chip-dot" style="background:${escapeHtml(t.color)}"></span>
                ${escapeHtml(t.name)}
              </button>
            `).join('')}
          </div>
        ` : ''}
        ${(this.filterPriority || this.filterTagId) ? `<button class="filter-clear" data-action="clear-filter"><span>清除筛选</span>${icon('close', { size: 13 })}</button>` : ''}
      </div>
    `;
  }

  renderTaskItem(task) {
    const enter = this._enterAll || (this._enterIds && this._enterIds.has(task.id));
    const index = Math.min(this._animIndex++, 12);
    return renderTaskItemHtml(task, {
      query: this.searchQuery,
      selected: this.selectedTaskId === task.id,
      editing: this.editingTaskId === task.id,
      enter: !!enter,
      index,
    });
  }

  renderInlineEdit(task) {
    return `<input type="text" class="inline-edit-input" data-inline-edit="${escapeHtml(task.id)}" value="${escapeHtml(task.title)}">`;
  }

  highlightSearch(title) {
    return highlightText(title, this.searchQuery);
  }

  bindEvents() {
    const area = document.getElementById('task-list-area');
    const inputArea = document.getElementById('task-input-area');

    inputArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'task-input' && !isImeKeyEvent(e)) {
        this.createTaskFromInput(e.target);
      }
    });

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
      if (e.target.closest('[data-action="clear-filter"]')) {
        this.clearFilters();
      }
    });

    area.addEventListener('click', (e) => this.handleAreaClick(e));

    area.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.task-item');
      if (item && !item.classList.contains('completed')) {
        this.startInlineEdit(item.dataset.taskId);
      }
    });

    area.addEventListener('keydown', (e) => {
      const input = e.target.closest('[data-inline-edit]');
      if (!input) return;
      if (isImeKeyEvent(e)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitInlineEdit(input);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelInlineEdit();
      }
    });

    area.addEventListener('focusin', (e) => {
      const input = e.target.closest('[data-inline-edit]');
      if (input) input.select();
    });

    area.addEventListener('focusout', (e) => {
      const input = e.target.closest('[data-inline-edit]');
      if (input) this.commitInlineEdit(input);
    });

    area.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.task-item');
      if (item) {
        e.preventDefault();
        this.showContextMenu(item.dataset.taskId, e.clientX, e.clientY);
      }
    });

    area.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      if (this.editingTaskId) {
        e.preventDefault();
        return;
      }
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.taskId);
    });

    area.addEventListener('dragend', (e) => {
      const item = e.target.closest('.task-item');
      if (item) item.classList.remove('dragging');
      area.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    area.addEventListener('dragover', (e) => {
      const item = e.target.closest('.task-item');
      if (!item || item.classList.contains('dragging')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      area.querySelectorAll('.drag-over').forEach(el => {
        if (el !== item) el.classList.remove('drag-over');
      });
      item.classList.add('drag-over');
    });

    area.addEventListener('dragleave', (e) => {
      const item = e.target.closest('.task-item');
      if (item && !item.contains(e.relatedTarget)) item.classList.remove('drag-over');
    });

    area.addEventListener('drop', (e) => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      e.preventDefault();
      item.classList.remove('drag-over');
      this.reorderTasks(e.dataTransfer.getData('text/plain'), item.dataset.taskId);
    });

    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.closeContextMenu();
      }
    });

    // 详情面板"当日清单"里的新建按钮回流到列表侧创建
    eventBus.on('calendar:add-task', ({ date }) => this.createTaskForDate(date));
    // 详情面板关闭日清单时，同步清除日历选中态
    eventBus.on('calendar:deselect', () => {
      if (this.calendarSelectedDate !== null) {
        this.calendarSelectedDate = null;
        this.render();
      }
    });
  }

  handleAreaClick(e) {
    const calCell = e.target.closest('.cal-cell[data-date]');
    if (calCell) {
      this.selectCalendarDay(calCell.dataset.date);
      return;
    }

    const target = e.target.closest('[data-action]');
    if (target) {
      const action = target.dataset.action;
      const taskId = target.dataset.taskId;
      if (action === 'select') {
        if (!this.editingTaskId) this.selectTask(taskId);
        return;
      }
      if (action === 'toggle-complete') {
        this.toggleComplete(taskId);
        return;
      }
      if (action === 'toggle-important') {
        this.toggleImportant(taskId);
        return;
      }
      if (action === 'toggle-myday-inline') {
        this.toggleMyDayTask(taskId);
        return;
      }
      if (action === 'add-suggestion') {
        this.addSuggestionToMyDay(taskId);
        return;
      }
    }

    const header = e.target.closest('.task-section-header');
    if (header && header.dataset.section) {
      const section = header.dataset.section;
      this.collapsedSections[section] = !this.collapsedSections[section];
      this.render();
      return;
    }

    const interactive = e.target.closest(
      '.task-item, .cal-cell, .cal-dot, .task-section-header, [data-action], button, input, textarea, select, a, label'
    );
    if (!interactive && this.selectedTaskId !== null) {
      eventBus.emit('task:deselect');
    }
  }

  createTaskFromInput(input) {
    const title = input.value.trim();
    if (!title) return;
    let listId = 'tasks';
    if (this.currentView === 'list' && this.currentListId) listId = this.currentListId;

    const extra = {};
    if (this.currentView === 'my-day') extra.inMyDay = true;
    if (this.currentView === 'important') extra.important = true;
    if (this.currentView === 'next7') {
      extra.dueDate = toDateKey(startOfToday());
    }
    if (this.filterPriority) extra.priority = this.filterPriority;
    if (this.filterTagId) extra.tags = [this.filterTagId];

    const task = store.createTask({ title, listId, ...extra });
    input.value = '';
    this._animate = new Set([task.id]);
    this.render();
    const fresh = document.getElementById('task-input');
    if (fresh) fresh.focus();
    eventBus.emit('task:create', task.id);
  }

  toggleComplete(taskId) {
    store.toggleComplete(taskId);
    this.render();
    eventBus.emit('task:update', taskId);
  }

  toggleImportant(taskId) {
    store.toggleImportant(taskId);
    this.render();
    eventBus.emit('task:update', taskId);
  }

  toggleMyDayTask(taskId) {
    store.toggleMyDay(taskId);
    this.render();
    eventBus.emit('task:update', taskId);
  }

  addSuggestionToMyDay(taskId) {
    store.updateTask(taskId, { inMyDay: true });
    this.render();
    eventBus.emit('task:update', taskId);
  }

  selectTask(taskId) {
    if (!taskId) return;
    this.selectedTaskId = taskId;
    this.render();
    eventBus.emit('task:select', taskId);
  }

  clearSelection() {
    if (this.selectedTaskId === null) return;
    this.selectedTaskId = null;
    this.render();
  }

  startInlineEdit(taskId) {
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    this.editingTaskId = taskId;
    this.render();
    const input = document.querySelector(`[data-inline-edit="${taskId}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }

  commitInlineEdit(input) {
    const taskId = input.dataset.inlineEdit;
    if (this.editingTaskId !== taskId) return;
    this.editingTaskId = null;
    const value = input.value.trim();
    const task = store.data.tasks.find(t => t.id === taskId);
    if (task && value && value !== task.title) {
      store.updateTask(taskId, { title: value });
      eventBus.emit('task:update', taskId);
      return;
    }
    this.render();
  }

  cancelInlineEdit() {
    this.editingTaskId = null;
    this.render();
  }

  showContextMenu(taskId, x, y) {
    this.closeContextMenu();
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - 240))}px`;
    menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - 360))}px`;

    const items = [
      { icon: 'check', label: task.completed ? '取消完成' : '完成任务', action: 'complete' },
      { icon: 'star', label: task.important ? '取消重要' : '标记重要', action: 'important' },
      { icon: 'sun', label: task.inMyDay ? '从我的日移除' : '添加到我的日', action: 'myday' },
      {
        icon: 'flag', label: '设置优先级', submenu: [1, 2, 3, 4].map(p => ({
          label: `${PRIORITY_LABELS[p]}  ${PRIORITY_NAMES[p]}`,
          action: 'set-priority',
          value: p,
          checked: task.priority === p,
          color: PRIORITY_COLORS[p],
        }))
      },
      {
        icon: 'tag', label: '添加标签', empty: '暂无标签',
        submenu: store.getTags().map(t => ({
          label: `#${t.name}`,
          action: 'toggle-tag',
          value: t.id,
          checked: (task.tags || []).includes(t.id),
        }))
      },
      { icon: 'edit', label: '编辑标题', action: 'rename' },
      {
        icon: 'move', label: '移动到...', submenu: store.getLists().map(l => ({
          label: l.name,
          action: 'move-to',
          value: l.id,
          checked: task.listId === l.id,
        }))
      },
      { icon: 'copy', label: '复制任务', action: 'duplicate' },
      { icon: 'trash', label: '删除', action: 'delete', danger: true },
    ];

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      if (item.danger) el.classList.add('danger');

      const iconEl = document.createElement('span');
      iconEl.className = 'context-menu-icon';
      iconEl.innerHTML = icon(item.icon, { size: 15 });
      el.appendChild(iconEl);
      el.appendChild(document.createTextNode(item.label));

      if (item.submenu) {
        el.classList.add('has-submenu');
        const sub = document.createElement('div');
        sub.className = 'context-menu-submenu';
        if (item.submenu.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'context-menu-item disabled';
          empty.textContent = item.empty || '暂无可选项';
          sub.appendChild(empty);
        }
        item.submenu.forEach(subItem => {
          const li = document.createElement('div');
          li.className = 'context-menu-item';
          const mark = document.createElement('span');
          mark.className = 'context-menu-icon';
          if (subItem.checked) mark.innerHTML = icon('check', { size: 15, strokeWidth: 2.4 });
          else if (subItem.color) mark.innerHTML = `<span class="context-menu-dot" style="background:${subItem.color}"></span>`;
          li.appendChild(mark);
          li.appendChild(document.createTextNode(subItem.label));
          li.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleContextAction(subItem.action, taskId, subItem.value);
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

  handleContextAction(action, taskId, value) {
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
      case 'set-priority':
        store.setPriority(taskId, value);
        break;
      case 'toggle-tag':
        store.toggleTagOnTask(taskId, value);
        break;
      case 'move-to':
        store.moveTaskToList(taskId, value);
        break;
      case 'duplicate':
        store.duplicateTask(taskId);
        break;
      case 'delete':
        this.closeContextMenu();
        this.confirmDeleteTask(taskId);
        return;
      case 'rename':
        this.closeContextMenu();
        this.startInlineEdit(taskId);
        return;
      default:
        break;
    }
    this.closeContextMenu();
    this.render();
    eventBus.emit('task:update', taskId);
  }

  closeContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  reorderTasks(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const sortChanged = store.reorderTask(draggedId, targetId);
    this.notice = sortChanged ? '已切换为手动排序' : '';
    this.render();
    eventBus.emit('settings:changed');
  }

  focusInput() {
    const input = document.getElementById('task-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  getSelectedTask() {
    if (!this.selectedTaskId) return null;
    return store.data.tasks.find(t => t.id === this.selectedTaskId) || null;
  }

  async confirmDeleteTask(taskId) {
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    const confirmed = await dialog.confirm({
      title: '删除任务',
      message: `任务"${task.title}"将被永久删除。`,
      confirmText: '删除',
      danger: true,
    });
    if (!confirmed) return;
    store.deleteTask(taskId);
    if (this.selectedTaskId === taskId) this.selectedTaskId = null;
    eventBus.emit('task:deleted', taskId);
    this.render();
  }

  deleteSelectedTask() {
    const task = this.getSelectedTask();
    if (!task) return;
    this.confirmDeleteTask(task.id);
  }

  renameSelectedTask() {
    const task = this.getSelectedTask();
    if (!task) return;
    this.startInlineEdit(task.id);
  }

  toggleCompleteSelected() {
    const task = this.getSelectedTask();
    if (!task) return;
    this.toggleComplete(task.id);
  }

  toggleImportantSelected() {
    const task = this.getSelectedTask();
    if (!task) return;
    this.toggleImportant(task.id);
  }

  toggleMyDaySelected() {
    const task = this.getSelectedTask();
    if (!task) return;
    store.toggleMyDay(task.id);
    this.render();
    eventBus.emit('task:update', task.id);
  }

  toggleHideCompleted() {
    this.collapsedSections.completed = !this.collapsedSections.completed;
    this.render();
  }
}
