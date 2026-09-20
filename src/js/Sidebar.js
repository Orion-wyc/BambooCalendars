import { store } from './Store.js';
import { eventBus } from './EventBus.js';
import { escapeHtml, isImeKeyEvent } from './Utils.js';

const NAV_ITEMS = [
  { view: 'my-day', icon: '☀', label: '我的一天', countKey: 'myDay' },
  { view: 'important', icon: '★', label: '重要', countKey: 'important' },
  { view: 'planned', icon: '📅', label: '已计划', countKey: 'planned' },
  { view: 'next7', icon: '🗓', label: '最近 7 天' },
  { view: 'tasks', icon: '✓', label: '任务', countKey: 'tasks' },
  { view: 'calendar', icon: '📆', label: '日历' },
  { view: 'pomodoro', icon: '🍅', label: '番茄钟' },
];

export class Sidebar {
  constructor() {
    this.currentView = 'tasks';
    this.currentListId = null;
    this.el = {
      user: document.getElementById('sidebar-user'),
      search: document.getElementById('sidebar-search'),
      nav: document.getElementById('sidebar-nav'),
      lists: document.getElementById('sidebar-lists'),
      footer: document.getElementById('sidebar-footer'),
    };
    this.renderStatic();
    this.bindEvents();
    this.render();
  }

  renderStatic() {
    this.el.user.innerHTML = '📋 Bamboo Todo';
    this.el.search.innerHTML = `<input type="text" id="search-input" placeholder="搜索任务...">`;
    this.el.footer.innerHTML = `
      <button class="btn-add-list" id="btn-add-list">
        <div class="btn-add-list-icon">+</div>
        <div>新清单</div>
      </button>
      <div class="nav-item" id="btn-settings">
        <div class="nav-item-icon">⚙</div>
        <div class="nav-item-label">设置</div>
      </div>
    `;
  }

  render() {
    this.renderNav();
    this.renderLists();
  }

  renderNav() {
    const counts = store.getCounts().views;
    this.el.nav.innerHTML = NAV_ITEMS.map(item => {
      const count = item.countKey ? counts[item.countKey] : 0;
      return `
        <div class="nav-item ${this.currentView === item.view ? 'active' : ''}" data-view="${item.view}">
          <div class="nav-item-icon">${item.icon}</div>
          <div class="nav-item-label">${item.label}</div>
          <div class="nav-item-count">${count || ''}</div>
        </div>
      `;
    }).join('');
  }

  renderLists() {
    const lists = store.getLists();
    const counts = store.getCounts().lists;

    this.el.lists.innerHTML = `
      <div class="lists-section-title">我的清单</div>
      ${lists.map(list => {
        const active = this.currentView === 'list' && this.currentListId === list.id;
        const builtin = store.isBuiltinList(list.id);
        return `
          <div class="list-item ${active ? 'active' : ''}" data-view="list" data-list-id="${escapeHtml(list.id)}">
            <div class="list-item-icon">📋</div>
            <div class="list-item-label">${escapeHtml(list.name)}</div>
            <div class="list-item-count">${counts[list.id] || ''}</div>
            <div class="list-item-actions">
              <button class="btn-icon-sm btn-rename-list" data-list-id="${escapeHtml(list.id)}" title="重命名">✎</button>
              ${builtin ? '' : `<button class="btn-icon-sm btn-delete-list" data-list-id="${escapeHtml(list.id)}" title="删除">✕</button>`}
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  bindEvents() {
    this.el.nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item || !item.dataset.view) return;
      this.jumpToView(item.dataset.view);
    });

    this.el.lists.addEventListener('click', (e) => {
      const renameBtn = e.target.closest('.btn-rename-list');
      if (renameBtn) {
        e.stopPropagation();
        this.renameList(renameBtn.dataset.listId);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete-list');
      if (deleteBtn) {
        e.stopPropagation();
        this.deleteList(deleteBtn.dataset.listId);
        return;
      }
      const item = e.target.closest('.list-item');
      if (item && item.dataset.listId) {
        this.jumpToListId(item.dataset.listId);
      }
    });

    this.el.footer.addEventListener('click', (e) => {
      if (e.target.closest('#btn-add-list')) this.addList();
      else if (e.target.closest('#btn-settings')) eventBus.emit('settings:open');
    });

    const input = this.el.search.querySelector('#search-input');
    input.addEventListener('input', (e) => {
      eventBus.emit('search:change', e.target.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value && !isImeKeyEvent(e)) {
        e.stopPropagation();
        input.value = '';
        eventBus.emit('search:change', '');
      }
    });
  }

  update() {
    this.render();
  }

  getSearchValue() {
    const input = this.el.search.querySelector('#search-input');
    return input ? input.value : '';
  }

  focusSearch() {
    const input = this.el.search.querySelector('#search-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  jumpToView(view) {
    this.currentView = view;
    this.currentListId = null;
    eventBus.emit('view:change', { view });
    this.render();
  }

  jumpToListId(listId) {
    if (!store.getList(listId)) return;
    this.currentView = 'list';
    this.currentListId = listId;
    eventBus.emit('view:change', { view: 'list', listId });
    this.render();
  }

  addList() {
    const name = prompt('新清单名称:');
    if (!name || !name.trim()) return;
    const list = store.createList(name.trim());
    this.render();
    eventBus.emit('list:create', list);
  }

  renameList(listId) {
    const list = store.getList(listId);
    if (!list) return;
    const newName = prompt('重命名清单:', list.name);
    if (!newName || !newName.trim() || newName.trim() === list.name) return;
    store.updateList(listId, { name: newName.trim() });
    this.render();
    eventBus.emit('list:update');
  }

  deleteList(listId) {
    if (store.isBuiltinList(listId)) return;
    const list = store.getList(listId);
    if (!list) return;
    const taskCount = store.data.tasks.filter(t => t.listId === listId).length;
    const message = taskCount > 0
      ? `确定删除清单"${list.name}"及其 ${taskCount} 个任务？`
      : `确定删除清单"${list.name}"？`;
    if (!confirm(message)) return;
    store.deleteList(listId);
    if (this.currentListId === listId) {
      this.currentView = 'tasks';
      this.currentListId = null;
      eventBus.emit('view:change', { view: 'tasks' });
    }
    this.render();
    eventBus.emit('list:delete', listId);
  }

  renameCurrentList() {
    if (this.currentView === 'list' && this.currentListId) {
      this.renameList(this.currentListId);
    }
  }

  deleteCurrentList() {
    if (this.currentView === 'list' && this.currentListId) {
      this.deleteList(this.currentListId);
    }
  }

  _getOrderedViews() {
    const smart = NAV_ITEMS.map(item => ({ type: 'smart', view: item.view, id: null }));
    const lists = store.getLists().map(l => ({ type: 'list', view: 'list', id: l.id }));
    return [...smart, ...lists];
  }

  _currentIndex() {
    const views = this._getOrderedViews();
    const idx = views.findIndex(v =>
      v.type === 'smart'
        ? v.view === this.currentView && this.currentView !== 'list'
        : (this.currentView === 'list' && v.id === this.currentListId)
    );
    return idx === -1 ? 0 : idx;
  }

  nextList() {
    const views = this._getOrderedViews();
    if (!views.length) return;
    this._jumpToView(views[(this._currentIndex() + 1) % views.length]);
  }

  prevList() {
    const views = this._getOrderedViews();
    if (!views.length) return;
    this._jumpToView(views[(this._currentIndex() - 1 + views.length) % views.length]);
  }

  jumpToList(n) {
    const lists = store.getLists();
    if (n >= 0 && n < lists.length) {
      this.jumpToListId(lists[n].id);
    }
  }

  _jumpToView(v) {
    if (v.type === 'smart') this.jumpToView(v.view);
    else this.jumpToListId(v.id);
  }
}
