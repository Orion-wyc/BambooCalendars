import { store } from './Store.js';
import { eventBus } from './EventBus.js';
import { dialog } from './Dialog.js';
import { escapeHtml, isImeKeyEvent, preserveScroll } from './Utils.js';

export class TaskDetail {
  constructor() {
    this.currentTaskId = null;
    this.lastRenderedTaskId = null;
    this.selfUpdating = false;
    this.panel = document.getElementById('detail-panel');
    this.bindEvents();
  }

  isOpen() {
    return Boolean(this.currentTaskId) && !this.panel.classList.contains('hidden');
  }

  open(taskId) {
    if (!taskId || !store.data.tasks.some(t => t.id === taskId)) return;
    this.currentTaskId = taskId;
    this.panel.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.currentTaskId) return;
    this.currentTaskId = null;
    this.lastRenderedTaskId = null;
    this.panel.classList.add('hidden');
    this.panel.innerHTML = '';
    eventBus.emit('task:deselect');
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
    if (!this.currentTaskId) return;
    if (taskId && taskId !== this.currentTaskId) return;
    if (!this.getTask()) {
      this.close();
      return;
    }
    this.render();
  }

  render() {
    const task = this.getTask();
    if (!task) {
      this.close();
      return;
    }

    const lists = store.getLists();
    const subtaskProgress = this.getSubtaskProgress(task);

    const sameTask = this.lastRenderedTaskId === task.id;
    this.lastRenderedTaskId = task.id;

    preserveScroll(sameTask ? this.panel : null, '.detail-content', () => this.paint(task, lists, subtaskProgress));
  }

  paint(task, lists, subtaskProgress) {
    const completedSubtasks = task.subtasks.filter(s => s.completed).length;
    this.panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-title">任务详情</div>
        <button class="btn-close-detail" data-action="close-detail">✕</button>
      </div>
      <div class="detail-content">
        <div class="detail-section">
          <input type="text" class="detail-input" id="detail-title" value="${escapeHtml(task.title)}" placeholder="任务标题">
        </div>

        <div class="detail-section">
          <div class="detail-section-title">备注</div>
          <textarea class="detail-textarea" id="detail-note" placeholder="添加备注...">${escapeHtml(task.note || '')}</textarea>
        </div>

        <div class="detail-section">
          <div class="detail-toggle" data-action="toggle-myday">
            <span>添加到我的一天</span>
            <div class="toggle-switch ${task.inMyDay ? 'active' : ''}"></div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">优先级</div>
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
          <div class="detail-section-title">标签</div>
          <div class="tag-selector">
            ${store.getTags().map(t => `
              <div class="tag-option ${(task.tags || []).includes(t.id) ? 'active' : ''}" data-action="toggle-tag" data-tag-id="${escapeHtml(t.id)}">
                <span class="tag-dot" style="background:${escapeHtml(t.color)}"></span>
                <span class="tag-label">${escapeHtml(t.name)}</span>
              </div>
            `).join('')}
            ${store.getTags().length === 0 ? '<div style="font-size:12px;color:var(--text-muted);">暂无标签，请在设置的「标签」页中添加</div>' : ''}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-field">
            <div class="detail-field-label">截止日期</div>
            <input type="date" class="detail-input" id="detail-due-date" value="${escapeHtml(task.dueDate || '')}">
          </div>

          <div class="detail-field">
            <div class="detail-field-label">提醒</div>
            <input type="datetime-local" class="detail-input" id="detail-reminder" value="${escapeHtml(task.reminder || '')}">
          </div>

          <div class="detail-field">
            <div class="detail-field-label">重复</div>
            <select class="detail-select" id="detail-repeat">
              ${[['none', '不重复'], ['daily', '每天'], ['weekdays', '工作日'], ['weekly', '每周'], ['monthly', '每月'], ['yearly', '每年']]
                .map(([value, label]) => `<option value="${value}" ${task.repeat === value ? 'selected' : ''}>${label}</option>`)
                .join('')}
            </select>
          </div>

          <div class="detail-field">
            <div class="detail-field-label">清单</div>
            <select class="detail-select" id="detail-list">
              ${lists.map(list => `
                <option value="${escapeHtml(list.id)}" ${task.listId === list.id ? 'selected' : ''}>${escapeHtml(list.name)}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            步骤 ${task.subtasks.length > 0 ? `(${completedSubtasks}/${task.subtasks.length})` : ''}
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
                  ${subtask.completed ? '✓' : ''}
                </div>
                <div class="subtask-title">${escapeHtml(subtask.title)}</div>
                <button class="btn-delete-subtask" data-action="delete-subtask" data-subtask-id="${escapeHtml(subtask.id)}">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="add-subtask-wrapper">
            <input type="text" class="add-subtask-input" id="add-subtask-input" placeholder="添加步骤...">
            <button class="btn-add-subtask" data-action="add-subtask">+</button>
          </div>
        </div>

        <div class="detail-section" style="margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-muted);">
            创建于 ${new Date(task.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      <div class="detail-footer">
        <button class="btn-delete-task" data-action="delete-task">删除任务</button>
      </div>
    `;
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
    eventBus.on('task:deselect', () => this.close());
    eventBus.on('task:deleted', (taskId) => {
      if (this.currentTaskId === taskId) this.close();
    });
    eventBus.on('list:delete', () => {
      const task = this.getTask();
      if (!task) this.close();
      else this.render();
    });
  }

  handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target || !this.panel.contains(target)) return;
    const action = target.dataset.action;
    const task = this.getTask();
    if (!task && action !== 'close-detail') return;

    switch (action) {
      case 'close-detail':
        this.close();
        break;
      case 'toggle-myday':
        store.toggleMyDay(task.id);
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
      case 'detail-due-date':
        store.updateTask(task.id, { dueDate: e.target.value || null });
        this.emitUpdate(task.id);
        break;
      case 'detail-reminder':
        store.updateTask(task.id, { reminder: e.target.value || null, reminderNotified: false });
        this.emitUpdate(task.id);
        break;
      case 'detail-repeat':
        store.updateTask(task.id, { repeat: e.target.value });
        this.emitUpdate(task.id);
        break;
      case 'detail-list':
        store.updateTask(task.id, { listId: e.target.value });
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
    this.panel.classList.add('hidden');
    this.panel.innerHTML = '';
    store.deleteTask(id);
    eventBus.emit('task:deleted', id);
  }

  getSubtaskProgress(task) {
    if (!task.subtasks.length) return 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return (completed / task.subtasks.length) * 100;
  }

  focusField(taskId, fieldId) {
    const id = taskId || this.currentTaskId;
    if (!id) return;
    this.open(id);
    const input = document.getElementById(fieldId);
    if (input) input.focus();
  }

  focusReminder(taskId) {
    this.focusField(taskId, 'detail-reminder');
  }

  focusDueDate(taskId) {
    this.focusField(taskId, 'detail-due-date');
  }

  priorityLabel(p) {
    return { 1: '紧急', 2: '高', 3: '中', 4: '低' }[p] || '低';
  }

  priorityColor(p) {
    const colors = { 1: '#c50f1f', 2: '#f7630c', 3: '#0f6cbd', 4: '#9d9d9d' };
    return colors[p] || '#9d9d9d';
  }
}
