import { store } from './Store.js';
import { eventBus } from './EventBus.js';
import { dialog } from './Dialog.js';
import { escapeHtml, isImeKeyEvent, preserveScroll, formatDayLabel, formatDueDateLabel, parseDateTimeLocal } from './Utils.js';
import { icon } from './icons.js';
import { priorityColor, PRIORITY_NAMES } from './priority.js';
import { renderTaskItem as renderTaskItemHtml } from './taskItem.js';
import { flashEnter, clearClassAfterAnim } from './motion.js';
import { Popover } from './popover.js';
import { buildDateTimeContent } from './DateTimePicker.js';

const REPEAT_OPTIONS = [
  ['none', '不重复'], ['daily', '每天'], ['weekdays', '工作日'],
  ['weekly', '每周'], ['monthly', '每月'], ['yearly', '每年'],
];
const LIST_COLORS = ['#5b8def', '#7e8cff', '#59b3a3', '#e08a5e', '#c77dbb', '#d9a441'];

export class TaskDetail {
  constructor() {
    this.currentTaskId = null;
    this.lastRenderedTaskId = null;
    this.selfUpdating = false;
    this.dayContext = null;   // 日历"当日清单"模式下的日期键
    this.dayFilter = {};
    this._enterPending = false;
    this.popover = new Popover();
    this.panel = document.getElementById('detail-panel');
    this.bindEvents();
    this.renderPlaceholder();
  }

  // 仅在"打开/切换到某内容"的一次性跃迁后，于常驻面板上重放一次入场动画
  _consumeEnter() {
    if (!this._enterPending || !this.panel) return;
    this._enterPending = false;
    flashEnter(this.panel, 'anim-in');
    clearClassAfterAnim(this.panel, 'anim-in');
  }

  isOpen() {
    return Boolean(this.currentTaskId || this.dayContext);
  }

  open(taskId) {
    if (!taskId || !store.data.tasks.some(t => t.id === taskId)) return;
    if (this.popover) this.popover.close();
    const switching = this.currentTaskId !== taskId;
    this.currentTaskId = taskId;
    this.lastRenderedTaskId = null;
    if (switching) this._enterPending = true;
    this.render();
  }

  openDay(date, filter = {}) {
    if (!date) return;
    if (this.popover) this.popover.close();
    this.dayContext = date;
    this.dayFilter = filter || {};
    this.currentTaskId = null;
    this.lastRenderedTaskId = null;
    this._enterPending = true;
    this.renderDay();
  }

  close() {
    if (this.popover) this.popover.close();
    // 任务模式：若在日历当日清单里打开的任务，返回当日清单（保留选中）
    if (this.currentTaskId) {
      this.currentTaskId = null;
      this.lastRenderedTaskId = null;
      if (this.dayContext) { this._enterPending = true; this.renderDay(); return; }
      this.renderPlaceholder();
      eventBus.emit('task:deselect');
      return;
    }
    // 日模式：退出并清除日历选中
    if (this.dayContext) {
      this.dayContext = null;
      this.dayFilter = {};
      this.renderPlaceholder();
      eventBus.emit('calendar:deselect');
      return;
    }
  }

  renderPlaceholder() {
    if (!this.panel) return;
    if (this.popover) this.popover.close();
    this.panel.innerHTML = `
      <div class="detail-empty">
        <div class="detail-empty-icon">${icon('note', { size: 40, strokeWidth: 1.3 })}</div>
        <div class="detail-empty-text">点击任务标题显示详情</div>
      </div>
    `;
  }

  renderDay() {
    if (!this.panel || !this.dayContext) return;
    if (this.popover) this.popover.close();
    const date = this.dayContext;
    const filter = this.dayFilter;
    const tasks = store.getTasksByDate(date, filter);
    const done = tasks.filter(t => t.completed).length;
    const dateLabel = formatDayLabel(date);
    const list = tasks.length
      ? `<div class="task-list">${tasks.map(t => renderTaskItemHtml(t, { query: filter.search || '' })).join('')}</div>`
      : `<div class="day-sheet-empty">${icon('calendar', { size: 34, strokeWidth: 1.3 })}<span>这一天暂无任务</span></div>`;

    this.panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-title">${icon('calendar', { size: 18 })}<span>${escapeHtml(dateLabel)}</span></div>
        <div class="day-sheet-actions">
          <button class="day-sheet-add" data-action="calendar-add-task" data-date="${escapeHtml(date)}" title="新建任务">${icon('plus', { size: 15 })}<span>新建</span></button>
          <button class="btn-close-detail" data-action="close-detail" title="关闭">${icon('close', { size: 18 })}</button>
        </div>
      </div>
      <div class="detail-content day-sheet-body">
        <div class="day-sheet-summary">
          ${tasks.length ? `<span>${tasks.length} 个任务</span>${done ? `<em>已完成 ${done}</em>` : ''}` : '<span>无任务</span>'}
        </div>
        ${list}
      </div>
    `;
    this._consumeEnter();
  }

  getTask() {
    if (!this.currentTaskId) return null;
    return store.data.tasks.find(t => t.id === this.currentTaskId) || null;
  }

  emitUpdate(taskId) {
    this.selfUpdating = true;
    try {
      eventBus.emit('task:update', taskId);
    } finally {
      this.selfUpdating = false;
    }
  }

  refreshIfShowing(taskId) {
    if (this.selfUpdating) return;
    if (this.currentTaskId) {
      if (taskId && taskId !== this.currentTaskId) return;
      if (!this.getTask()) {
        this.close();
        return;
      }
      this.render();
      return;
    }
    if (this.dayContext) {
      this.renderDay();
    }
  }

  render() {
    const task = this.getTask();
    if (!task) {
      this.renderPlaceholder();
      return;
    }

    const lists = store.getLists();
    const subtaskProgress = this.getSubtaskProgress(task);

    const sameTask = this.lastRenderedTaskId === task.id;
    this.lastRenderedTaskId = task.id;

    preserveScroll(sameTask ? this.panel : null, '.detail-content', () => this.paint(task, lists, subtaskProgress));
  }

  paint(task, lists, subtaskProgress) {
    if (this.popover) this.popover.close();
    const completedSubtasks = task.subtasks.filter(s => s.completed).length;
    this.panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-title">${icon('clipboard', { size: 18 })}<span>任务详情</span></div>
        <button class="btn-close-detail" data-action="close-detail" title="关闭">${icon('close', { size: 18 })}</button>
      </div>
      <div class="detail-content">
        <div class="detail-sheet">
          <input type="text" class="detail-input detail-title-input" id="detail-title" value="${escapeHtml(task.title)}" placeholder="任务标题">
          <div class="detail-chips">
            <div class="detail-chip ${task.inMyDay ? 'active' : ''}" data-action="toggle-myday">${icon('sun', { size: 15 })}<span>我的一天</span></div>
            <div class="detail-chip ${task.important ? 'active' : ''}" data-action="toggle-important">${icon('star', { size: 15, filled: task.important })}<span>重要</span></div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${icon('note', { size: 15 })}<span>备注</span></div>
          <textarea class="detail-textarea" id="detail-note" placeholder="添加备注...">${escapeHtml(task.note || '')}</textarea>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${icon('flag', { size: 15 })}<span>优先级</span></div>
          <div class="priority-selector">
            ${[1, 2, 3, 4].map(p => `
              <div class="priority-option ${task.priority === p ? 'active' : ''}" data-action="set-priority" data-priority="${p}">
                <span class="priority-flag" style="background:${this.priorityColor(p)}"></span>
                <span class="priority-label">${this.priorityLabel(p)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${icon('tag', { size: 15 })}<span>标签</span></div>
          <div class="tag-selector">
            ${store.getTags().map(t => `
              <div class="tag-option ${(task.tags || []).includes(t.id) ? 'active' : ''}" data-action="toggle-tag" data-tag-id="${escapeHtml(t.id)}">
                <span class="tag-dot" style="background:${escapeHtml(t.color)}"></span>
                <span class="tag-label">${escapeHtml(t.name)}</span>
              </div>
            `).join('')}
            ${store.getTags().length === 0 ? '<div class="detail-hint">暂无标签，请在设置的「标签」页中添加</div>' : ''}
          </div>
        </div>

        <div class="detail-card">
          <div class="detail-field">
            <div class="detail-field-label">${icon('calendar', { size: 14 })}<span>截止日期</span></div>
            <button type="button" id="detail-due-date" class="detail-picker-btn ${task.dueDate ? '' : 'is-empty'}"
                    data-action="open-due-date" aria-haspopup="dialog">
              <span class="detail-picker-btn__text">${task.dueDate ? escapeHtml(formatDueDateLabel(task.dueDate)) : '未设置'}</span>
              ${icon('chevronDown', { size: 15 })}
            </button>
          </div>

          <div class="detail-field">
            <div class="detail-field-label">${icon('bell', { size: 14 })}<span>提醒</span></div>
            <button type="button" id="detail-reminder" class="detail-picker-btn ${task.reminder ? '' : 'is-empty'}"
                    data-action="open-reminder" aria-haspopup="dialog">
              <span class="detail-picker-btn__text">${task.reminder ? escapeHtml(this.formatReminder(task.reminder)) : '未设置'}</span>
              ${icon('chevronDown', { size: 15 })}
            </button>
          </div>

          <div class="detail-field">
            <div class="detail-field-label">${icon('repeat', { size: 14 })}<span>重复</span></div>
            <button type="button" id="detail-repeat" class="detail-picker-btn ${task.repeat && task.repeat !== 'none' ? '' : 'is-empty'}"
                    data-action="open-repeat" aria-haspopup="menu" aria-expanded="false">
              <span class="detail-picker-btn__text">${escapeHtml(this.repeatLabel(task.repeat))}</span>
              ${icon('chevronDown', { size: 15 })}
            </button>
          </div>

          <div class="detail-field">
            <div class="detail-field-label">${icon('clipboard', { size: 14 })}<span>清单</span></div>
            <button type="button" id="detail-list" class="detail-picker-btn" data-action="open-list" aria-haspopup="menu" aria-expanded="false">
              <span class="detail-picker-btn__text detail-picker-btn__text--dot">
                <span class="list-dot" style="background:${escapeHtml(this.listColor(task.listId))}"></span>${escapeHtml(this.listName(task.listId))}
              </span>
              ${icon('chevronDown', { size: 15 })}
            </button>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            ${icon('checkSquare', { size: 15 })}<span>步骤</span>
            ${task.subtasks.length > 0 ? `<em>(${completedSubtasks}/${task.subtasks.length})</em>` : ''}
          </div>
          ${subtaskProgress > 0 ? `
            <div class="subtask-progress">
              <div class="subtask-progress-bar" style="width: ${subtaskProgress}%"></div>
            </div>
          ` : ''}
          <div class="subtask-list">
            ${task.subtasks.map(subtask => `
              <div class="subtask-item ${subtask.completed ? 'completed' : ''}">
                <div class="subtask-checkbox ${subtask.completed ? 'checked' : ''}"
                     data-action="toggle-subtask" data-subtask-id="${escapeHtml(subtask.id)}">
                  ${subtask.completed ? icon('check', { size: 11, strokeWidth: 2.6 }) : ''}
                </div>
                <div class="subtask-title">${escapeHtml(subtask.title)}</div>
                <button class="btn-delete-subtask" data-action="delete-subtask" data-subtask-id="${escapeHtml(subtask.id)}" title="删除步骤">${icon('close', { size: 14 })}</button>
              </div>
            `).join('')}
          </div>
          <div class="add-subtask-wrapper">
            <input type="text" class="add-subtask-input" id="add-subtask-input" placeholder="添加步骤">
            <button class="btn-add-subtask" data-action="add-subtask" title="添加">${icon('plus', { size: 16 })}</button>
          </div>
        </div>

        <div class="detail-section detail-meta">
          <div>创建于 ${new Date(task.createdAt).toLocaleString('zh-CN')}</div>
        </div>
      </div>

      <div class="detail-footer">
        <button class="btn-complete-task ${task.completed ? 'is-completed' : ''}" data-action="complete-task">
          ${icon(task.completed ? 'close' : 'check', { size: 15 })}<span>${task.completed ? '取消完成' : '完成任务'}</span>
        </button>
        <button class="btn-delete-task" data-action="delete-task">${icon('trash', { size: 15 })}<span>删除任务</span></button>
      </div>
    `;
    this._consumeEnter();
  }

  bindEvents() {
    this.panel.addEventListener('click', (e) => this.handleClick(e));
    this.panel.addEventListener('change', (e) => this.handleChange(e));
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'add-subtask-input' && !isImeKeyEvent(e)) {
        e.preventDefault();
        this.addSubtask();
      }
    });

    eventBus.on('task:select', (taskId) => this.open(taskId));
    eventBus.on('task:deselect', () => { if (this.currentTaskId) this.close(); });
    eventBus.on('task:deleted', (taskId) => {
      if (this.currentTaskId === taskId) this.close();
      else if (this.dayContext) this.renderDay();
    });
    eventBus.on('list:delete', () => {
      if (this.dayContext) { this.renderDay(); return; }
      const task = this.getTask();
      if (!task) this.close();
      else this.render();
    });
    eventBus.on('calendar:select', ({ date, filter }) => this.openDay(date, filter));
    eventBus.on('calendar:deselect', () => {
      if (!this.currentTaskId && this.dayContext) {
        this.dayContext = null;
        this.dayFilter = {};
        this.renderPlaceholder();
      }
    });
  }

  handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target || !this.panel.contains(target)) return;
    const action = target.dataset.action;

    // 通用：关闭 / 日清单新建
    if (action === 'close-detail') { this.close(); return; }
    if (action === 'calendar-add-task') {
      eventBus.emit('calendar:add-task', { date: target.dataset.date });
      return;
    }

    // 日模式：列表行操作
    if (this.dayContext && !this.currentTaskId) {
      const taskId = target.dataset.taskId;
      switch (action) {
        case 'select': this.open(taskId); return;
        case 'toggle-complete': store.toggleComplete(taskId); this.renderDay(); this.emitUpdate(taskId); return;
        case 'toggle-important': store.toggleImportant(taskId); this.renderDay(); this.emitUpdate(taskId); return;
        case 'toggle-myday-inline': store.toggleMyDay(taskId); this.renderDay(); this.emitUpdate(taskId); return;
        default: return;
      }
    }

    const task = this.getTask();
    if (!task) return;

    switch (action) {
      case 'open-reminder':
        this.openDateTimePopover(target, 'datetime');
        break;
      case 'open-due-date':
        this.openDateTimePopover(target, 'date');
        break;
      case 'open-repeat':
        this.openOptionsPopover(target, 'repeat');
        break;
      case 'open-list':
        this.openOptionsPopover(target, 'list');
        break;
      case 'toggle-myday':
        store.toggleMyDay(task.id);
        this.render();
        this.emitUpdate(task.id);
        break;
      case 'toggle-important':
        store.toggleImportant(task.id);
        this.render();
        this.emitUpdate(task.id);
        break;
      case 'set-priority':
        store.setPriority(task.id, parseInt(target.dataset.priority, 10));
        this.render();
        this.emitUpdate(task.id);
        break;
      case 'toggle-tag':
        store.toggleTagOnTask(task.id, target.dataset.tagId);
        this.render();
        this.emitUpdate(task.id);
        break;
      case 'toggle-subtask':
        store.toggleSubtask(task.id, target.dataset.subtaskId);
        this.render();
        this.emitUpdate(task.id);
        break;
      case 'delete-subtask': {
        const deletedIndex = task.subtasks.findIndex(s => s.id === target.dataset.subtaskId);
        store.deleteSubtask(task.id, target.dataset.subtaskId);
        this.render();
        this.focusNeighbour(deletedIndex);
        this.emitUpdate(task.id);
        break;
      }
      case 'add-subtask':
        this.addSubtask();
        break;
      case 'complete-task':
        store.toggleComplete(task.id);
        this.render();
        this.emitUpdate(task.id);
        break;
      case 'delete-task':
        this.deleteCurrentTask();
        break;
      default:
        break;
    }
  }

  handleChange(e) {
    const task = this.getTask();
    if (!task) return;

    switch (e.target.id) {
      case 'detail-title': {
        const title = e.target.value.trim();
        if (!title) {
          e.target.value = task.title;
          return;
        }
        store.updateTask(task.id, { title });
        this.emitUpdate(task.id);
        break;
      }
      case 'detail-note':
        store.updateTask(task.id, { note: e.target.value });
        this.emitUpdate(task.id);
        break;
      default:
        break;
    }
  }

  focusNeighbour(deletedIndex) {
    const buttons = this.panel.querySelectorAll('[data-action="delete-subtask"]');
    const target = buttons.length
      ? buttons[Math.max(0, Math.min(deletedIndex, buttons.length - 1))]
      : this.panel.querySelector('#add-subtask-input');
    if (target) target.focus({ preventScroll: true });
  }

  addSubtask() {
    const input = document.getElementById('add-subtask-input');
    if (!input) return;
    const title = input.value.trim();
    if (!title || !this.currentTaskId) return;
    store.addSubtask(this.currentTaskId, title);
    this.render();
    const next = document.getElementById('add-subtask-input');
    if (next) next.focus();
    this.emitUpdate(this.currentTaskId);
  }

  async deleteCurrentTask() {
    const task = this.getTask();
    if (!task) return;
    const confirmed = await dialog.confirm({
      title: '删除任务',
      message: `任务"${task.title}"将被永久删除。`,
      confirmText: '删除',
      danger: true,
    });
    if (!confirmed) return;
    const id = task.id;
    this.currentTaskId = null;
    this.lastRenderedTaskId = null;
    this.renderPlaceholder();
    store.deleteTask(id);
    eventBus.emit('task:deleted', id);
  }

  getSubtaskProgress(task) {
    if (!task.subtasks.length) return 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return (completed / task.subtasks.length) * 100;
  }

  focusReminder(taskId) {
    const id = taskId || this.currentTaskId;
    if (!id) return;
    this.open(id);
    const btn = document.getElementById('detail-reminder');
    if (btn) {
      btn.focus();
      this.openDateTimePopover(btn, 'datetime');
    }
  }

  focusDueDate(taskId) {
    const id = taskId || this.currentTaskId;
    if (!id) return;
    this.open(id);
    const btn = document.getElementById('detail-due-date');
    if (btn) {
      btn.focus();
      this.openDateTimePopover(btn, 'date');
    }
  }

  formatReminder(value) {
    const d = parseDateTimeLocal(value);
    if (!d) return '';
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  repeatLabel(value) {
    const found = REPEAT_OPTIONS.find(([v]) => v === value);
    return found ? found[1] : '不重复';
  }

  listName(listId) {
    const list = store.getList(listId);
    return list ? list.name : '清单';
  }

  listColor(listId) {
    const lists = store.getLists();
    const i = lists.findIndex(l => l.id === listId);
    return LIST_COLORS[(i < 0 ? 0 : i) % LIST_COLORS.length];
  }

  // 截止日期（date）/ 提醒（datetime）统一选择器
  openDateTimePopover(anchor, mode) {
    const task = this.getTask();
    if (!task || !this.popover) return;
    if (this.popover.isOpen()) { this.popover.close(); return; }
    const build = buildDateTimeContent({
      mode,
      date: mode === 'date' ? task.dueDate : (task.reminder ? task.reminder.slice(0, 10) : null),
      time: mode === 'datetime' && task.reminder ? task.reminder.slice(11, 16) : null,
      taskDots: (y, m) => new Set(store.getCalendarTasks(y, m).map(t => t.dueDate)),
      onApply: ({ date, time }) => {
        this.popover.close();
        if (mode === 'date') {
          store.updateTask(task.id, { dueDate: date || null });
        } else {
          store.updateTask(task.id, { reminder: date ? `${date}T${time}` : null, reminderNotified: false });
        }
        this.render();
        this.emitUpdate(task.id);
      },
      onClear: () => {
        this.popover.close();
        if (mode === 'date') store.updateTask(task.id, { dueDate: null });
        else store.updateTask(task.id, { reminder: null, reminderNotified: false });
        this.render();
        this.emitUpdate(task.id);
      },
      onCancel: () => this.popover.close(),
    });
    this.popover.open({
      anchor,
      content: build.el,
      className: 'popover--datetime',
      onClose: () => build.destroy(),
    });
  }

  // 重复 / 清单：锚定下拉浮层
  openOptionsPopover(anchor, kind) {
    const task = this.getTask();
    if (!task || !this.popover) return;
    if (this.popover.isOpen()) { this.popover.close(); return; }
    const isRepeat = kind === 'repeat';
    const items = isRepeat
      ? REPEAT_OPTIONS.map(([value, label]) => ({ value, label }))
      : store.getLists().map((l, i) => ({ value: l.id, label: l.name, color: LIST_COLORS[i % LIST_COLORS.length] }));
    const current = isRepeat ? task.repeat : task.listId;

    const board = document.createElement('div');
    board.className = 'option-menu';
    board.setAttribute('role', 'menu');
    board.innerHTML = items.map((it) => `
      <button type="button" class="option-menu__item ${it.value === current ? 'is-active' : ''}"
              role="menuitemradio" aria-checked="${it.value === current}" data-value="${escapeHtml(it.value)}">
        ${it.color ? `<span class="option-menu__dot" style="background:${escapeHtml(it.color)}"></span>` : ''}
        <span class="option-menu__label">${escapeHtml(it.label)}</span>
        <span class="option-menu__check">${icon('check', { size: 15 })}</span>
      </button>
    `).join('');

    board.addEventListener('click', (e) => {
      const item = e.target.closest('[data-value]');
      if (!item) return;
      this.popover.close();
      if (isRepeat) store.updateTask(task.id, { repeat: item.dataset.value });
      else store.updateTask(task.id, { listId: item.dataset.value });
      this.render();
      this.emitUpdate(task.id);
    });

    this.popover.open({
      anchor,
      content: board,
      className: 'popover--options',
    });
  }

  priorityLabel(p) {
    return PRIORITY_NAMES[p] || '低';
  }

  priorityColor(p) {
    return priorityColor(p);
  }
}
