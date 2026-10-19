// 共享任务行渲染：列表视图与日历"当日清单"复用同一结构，避免重复
import { store } from './Store.js';
import { escapeHtml, formatDueDateLabel, parseDateKey, addDays, startOfToday } from './Utils.js';
import { icon } from './icons.js';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_FALLBACK } from './priority.js';

export function highlightSearch(title, query) {
  const text = escapeHtml(title);
  if (!query) return text;
  const escaped = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return text;
  try {
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  } catch { return text; }
}

export function dueDateClass(dateStr, completed) {
  if (!dateStr || completed) return '';
  const date = parseDateKey(dateStr);
  if (!date) return '';
  const today = startOfToday();
  if (date < today) return 'overdue';
  if (date.getTime() === today.getTime()) return 'today';
  if (date.getTime() === addDays(today, 1).getTime()) return 'tomorrow';
  return '';
}

export function inlineEditInput(task) {
  return `<input type="text" class="inline-edit-input" data-inline-edit="${escapeHtml(task.id)}" value="${escapeHtml(task.title)}">`;
}

export function renderTaskItem(task, opts = {}) {
  const { query = '', selected = false, editing = false, enter = false, index = 0 } = opts;
  const dueLabel = formatDueDateLabel(task.dueDate);
  const dClass = dueDateClass(task.dueDate, task.completed);
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_FALLBACK;
  const tags = (task.tags || []).map(id => store.getTag(id)).filter(Boolean);
  const doneSteps = task.subtasks.filter(s => s.completed).length;
  const anim = enter ? ` data-anim="enter" style="--i:${index}"` : '';

  return `
    <div class="task-item ${task.completed ? 'completed' : ''} ${selected ? 'selected' : ''}"
         data-task-id="${escapeHtml(task.id)}" draggable="${editing ? 'false' : 'true'}"${anim}>
      <div class="task-priority-bar" style="background:${priorityColor}"></div>
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle-complete" data-task-id="${escapeHtml(task.id)}">
        ${task.completed ? icon('check', { size: 13, strokeWidth: 2.4 }) : ''}
      </div>
      <div class="task-content" data-action="select" data-task-id="${escapeHtml(task.id)}">
        <div class="task-title">${editing ? inlineEditInput(task) : highlightSearch(task.title, query)}</div>
        <div class="task-meta">
          ${task.priority < 4 ? `<div class="task-priority-badge" style="color:${priorityColor};border-color:${priorityColor}">${PRIORITY_LABELS[task.priority]}</div>` : ''}
          ${task.dueDate ? `<div class="task-meta-item task-due-date ${dClass}">${icon('flag', { size: 13 })}<span>${escapeHtml(dueLabel)}</span></div>` : ''}
          ${task.subtasks.length > 0 ? `<div class="task-meta-item">${icon('list', { size: 13 })}<span>${doneSteps}/${task.subtasks.length}</span></div>` : ''}
          ${task.note ? `<div class="task-meta-item">${icon('note', { size: 13 })}</div>` : ''}
          ${tags.length ? `<div class="task-tags">${tags.map(t => `<span class="task-tag" style="background:${escapeHtml(t.color)}22;color:${escapeHtml(t.color)};border-color:${escapeHtml(t.color)}55">#${escapeHtml(t.name)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-task-action ${task.inMyDay ? 'active is-myday' : ''}" data-action="toggle-myday-inline" data-task-id="${escapeHtml(task.id)}" title="我的一天">
          ${icon('sun', { size: 16 })}
        </button>
        <button class="btn-task-action ${task.important ? 'active is-star' : ''}" data-action="toggle-important" data-task-id="${escapeHtml(task.id)}" title="重要">
          ${icon('star', { size: 16, filled: task.important })}
        </button>
      </div>
    </div>
  `;
}
