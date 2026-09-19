import { store } from './Store.js';
import { eventBus } from './EventBus.js';

export class TaskDetail {
  constructor() {
    this.currentTaskId = null;
    this.panel = document.getElementById('detail-panel');
    this.bindEvents();
  }

  open(taskId) {
    this.currentTaskId = taskId;
    this.panel.classList.remove('hidden');
    this.render();
  }

  close() {
    this.currentTaskId = null;
    this.panel.classList.add('hidden');
    eventBus.emit('task:deselect');
  }

  render() {
    if (!this.currentTaskId) return;
    
    const task = store.data.tasks.find(t => t.id === this.currentTaskId);
    if (!task) {
      this.close();
      return;
    }

    const lists = store.getLists();
    const subtaskProgress = this.getSubtaskProgress(task);

    this.panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-title">任务详情</div>
        <button class="btn-close-detail" id="btn-close-detail">✕</button>
      </div>
      <div class="detail-content">
        <div class="detail-section">
          <input type="text" class="detail-input" id="detail-title" value="${this.escapeHtml(task.title)}" placeholder="任务标题">
        </div>

        <div class="detail-section">
          <div class="detail-section-title">备注</div>
          <textarea class="detail-textarea" id="detail-note" placeholder="添加备注...">${this.escapeHtml(task.note || '')}</textarea>
        </div>

        <div class="detail-section">
          <div class="detail-toggle" id="toggle-myday">
            <span>添加到我的一天</span>
            <div class="toggle-switch ${task.inMyDay ? 'active' : ''}"></div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">优先级</div>
          <div class="priority-selector">
            ${[1, 2, 3, 4].map(p => `
              <div class="priority-option ${task.priority === p ? 'active' : ''}" data-priority="${p}">
                <span class="priority-flag" style="background:${this.priorityColor(p)}"></span>
                <span class="priority-label">${p === 1 ? '紧急' : p === 2 ? '高' : p === 3 ? '中' : '低'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">标签</div>
          <div class="tag-selector">
            ${store.getTags().map(t => `
              <div class="tag-option ${(task.tags || []).includes(t.id) ? 'active' : ''}" data-tag-id="${t.id}">
                <span class="tag-dot" style="background:${t.color}"></span>
                <span class="tag-label">${this.escapeHtml(t.name)}</span>
              </div>
            `).join('')}
            ${store.getTags().length === 0 ? '<div style="font-size:12px;color:var(--text-muted);">暂无标签，请在设置中添加</div>' : ''}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-field">
            <div class="detail-field-label">截止日期</div>
            <input type="date" class="detail-input" id="detail-due-date" value="${task.dueDate || ''}">
          </div>

          <div class="detail-field">
            <div class="detail-field-label">提醒</div>
            <input type="datetime-local" class="detail-input" id="detail-reminder" value="${task.reminder || ''}">
          </div>

          <div class="detail-field">
            <div class="detail-field-label">重复</div>
            <select class="detail-select" id="detail-repeat">
              <option value="none" ${task.repeat === 'none' ? 'selected' : ''}>不重复</option>
              <option value="daily" ${task.repeat === 'daily' ? 'selected' : ''}>每天</option>
              <option value="weekdays" ${task.repeat === 'weekdays' ? 'selected' : ''}>工作日</option>
              <option value="weekly" ${task.repeat === 'weekly' ? 'selected' : ''}>每周</option>
              <option value="monthly" ${task.repeat === 'monthly' ? 'selected' : ''}>每月</option>
              <option value="yearly" ${task.repeat === 'yearly' ? 'selected' : ''}>每年</option>
            </select>
          </div>

          <div class="detail-field">
            <div class="detail-field-label">清单</div>
            <select class="detail-select" id="detail-list">
              ${lists.map(list => `
                <option value="${list.id}" ${task.listId === list.id ? 'selected' : ''}>${this.escapeHtml(list.name)}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            步骤 ${task.subtasks.length > 0 ? `(${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length})` : ''}
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
                     data-action="toggle-subtask" data-subtask-id="${subtask.id}">
                  ${subtask.completed ? '✓' : ''}
                </div>
                <div class="subtask-title">${this.escapeHtml(subtask.title)}</div>
                <button class="btn-delete-subtask" data-action="delete-subtask" data-subtask-id="${subtask.id}">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="add-subtask-wrapper">
            <input type="text" class="add-subtask-input" id="add-subtask-input" placeholder="添加步骤...">
            <button class="btn-add-subtask" id="btn-add-subtask">+</button>
          </div>
        </div>

        <div class="detail-section" style="margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-muted);">
            创建于 ${new Date(task.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      <div class="detail-footer">
        <button class="btn-delete-task" id="btn-delete-task">删除任务</button>
      </div>
    `;

    this.bindDetailEvents();
  }

  bindDetailEvents() {
    // Close button
    document.getElementById('btn-close-detail').addEventListener('click', () => {
      this.close();
    });

    // Title
    document.getElementById('detail-title').addEventListener('change', (e) => {
      const title = e.target.value.trim();
      if (title) {
        store.updateTask(this.currentTaskId, { title });
        eventBus.emit('task:update');
      }
    });

    // Note
    document.getElementById('detail-note').addEventListener('change', (e) => {
      store.updateTask(this.currentTaskId, { note: e.target.value });
    });

    // My Day toggle
    document.getElementById('toggle-myday').addEventListener('click', () => {
      store.toggleMyDay(this.currentTaskId);
      this.render();
      eventBus.emit('task:update');
    });

    // Due date
    document.getElementById('detail-due-date').addEventListener('change', (e) => {
      store.updateTask(this.currentTaskId, { dueDate: e.target.value || null });
      eventBus.emit('task:update');
    });

    // Reminder
    document.getElementById('detail-reminder').addEventListener('change', (e) => {
      store.updateTask(this.currentTaskId, { reminder: e.target.value || null });
    });

    // Repeat
    document.getElementById('detail-repeat').addEventListener('change', (e) => {
      store.updateTask(this.currentTaskId, { repeat: e.target.value });
    });

    // List
    document.getElementById('detail-list').addEventListener('change', (e) => {
      store.updateTask(this.currentTaskId, { listId: e.target.value });
      eventBus.emit('task:update');
    });

    // Priority
    this.panel.querySelectorAll('.priority-option').forEach(el => {
      el.addEventListener('click', () => {
        const p = parseInt(el.dataset.priority, 10);
        store.setPriority(this.currentTaskId, p);
        this.render();
        eventBus.emit('task:update');
      });
    });

    // Tags
    this.panel.querySelectorAll('.tag-option').forEach(el => {
      el.addEventListener('click', () => {
        const tagId = el.dataset.tagId;
        const task = store.data.tasks.find(t => t.id === this.currentTaskId);
        if (task && (task.tags || []).includes(tagId)) {
          store.removeTagFromTask(this.currentTaskId, tagId);
        } else {
          store.addTagToTask(this.currentTaskId, tagId);
        }
        this.render();
        eventBus.emit('task:update');
      });
    });

    // Subtasks
    this.panel.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const subtaskId = e.target.dataset.subtaskId;

      if (action === 'toggle-subtask') {
        store.toggleSubtask(this.currentTaskId, subtaskId);
        this.render();
        eventBus.emit('task:update');
      } else if (action === 'delete-subtask') {
        store.deleteSubtask(this.currentTaskId, subtaskId);
        this.render();
        eventBus.emit('task:update');
      }
    });

    // Add subtask
    document.getElementById('btn-add-subtask').addEventListener('click', () => {
      this.addSubtask();
    });

    document.getElementById('add-subtask-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.addSubtask();
      }
    });

    // Delete task
    document.getElementById('btn-delete-task').addEventListener('click', () => {
      if (confirm('确定删除此任务？')) {
        store.deleteTask(this.currentTaskId);
        this.close();
        eventBus.emit('task:delete');
      }
    });
  }

  addSubtask() {
    const input = document.getElementById('add-subtask-input');
    const title = input.value.trim();
    if (title) {
      store.addSubtask(this.currentTaskId, title);
      input.value = '';
      this.render();
      eventBus.emit('task:update');
    }
  }

  getSubtaskProgress(task) {
    if (task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return (completed / task.subtasks.length) * 100;
  }

  toggleMyDay() {
    if (!this.currentTaskId) {
      const first = document.querySelector('.task-item');
      if (first) {
        const taskId = first.dataset.taskId;
        if (taskId) {
          store.toggleMyDay(taskId);
          eventBus.emit('task:update');
        }
      }
      return;
    }
    store.toggleMyDay(this.currentTaskId);
    if (this.panel.classList.contains('hidden')) {
      eventBus.emit('task:update');
    } else {
      this.render();
      eventBus.emit('task:update');
    }
  }

  focusReminder() {
    if (!this.currentTaskId) return;
    this.open(this.currentTaskId);
    const input = document.getElementById('detail-reminder');
    if (input) input.focus();
  }

  focusDueDate() {
    if (!this.currentTaskId) return;
    this.open(this.currentTaskId);
    const input = document.getElementById('detail-due-date');
    if (input) input.focus();
  }

  bindEvents() {
    eventBus.on('task:select', (taskId) => {
      this.open(taskId);
    });

    eventBus.on('task:deselect', () => {
      this.close();
    });
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  priorityColor(p) {
    const colors = { 1: '#e74c3c', 2: '#e67e22', 3: '#4a90d9', 4: '#95a5a6' };
    return colors[p] || '#95a5a6';
  }
}
