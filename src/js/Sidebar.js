import { store } from './Store.js';
import { eventBus } from './EventBus.js';

export class Sidebar {
  constructor() {
    this.currentView = 'tasks';
    this.currentListId = null;
    this.render();
    this.bindEvents();
  }

  render() {
    this.renderUser();
    this.renderSearch();
    this.renderNav();
    this.renderLists();
    this.renderFooter();
  }

  renderUser() {
    document.getElementById('sidebar-user').innerHTML = '📋 Bamboo Todo';
  }

  renderSearch() {
    document.getElementById('sidebar-search').innerHTML = `
      <input type="text" id="search-input" placeholder="搜索任务...">
    `;
  }

  renderNav() {
    const counts = store.getCounts();
    document.getElementById('sidebar-nav').innerHTML = `
      <div class="nav-item ${this.currentView === 'my-day' ? 'active' : ''}" data-view="my-day">
        <div class="nav-item-icon">☀</div>
        <div class="nav-item-label">我的一天</div>
        <div class="nav-item-count">${counts.myDay || ''}</div>
      </div>
      <div class="nav-item ${this.currentView === 'important' ? 'active' : ''}" data-view="important">
        <div class="nav-item-icon">★</div>
        <div class="nav-item-label">重要</div>
        <div class="nav-item-count">${counts.important || ''}</div>
      </div>
      <div class="nav-item ${this.currentView === 'planned' ? 'active' : ''}" data-view="planned">
        <div class="nav-item-icon">📅</div>
        <div class="nav-item-label">已计划</div>
        <div class="nav-item-count">${counts.planned || ''}</div>
      </div>
      <div class="nav-item ${this.currentView === 'tasks' ? 'active' : ''}" data-view="tasks">
        <div class="nav-item-icon">✓</div>
        <div class="nav-item-label">任务</div>
        <div class="nav-item-count">${counts.tasks || ''}</div>
      </div>
    `;
  }

  renderLists() {
    const lists = store.getLists();
    const counts = store.getCounts();
    
    document.getElementById('sidebar-lists').innerHTML = `
      <div class="lists-section-title">我的清单</div>
      ${lists.map(list => `
        <div class="list-item ${this.currentView === 'list' && this.currentListId === list.id ? 'active' : ''}" 
             data-view="list" data-list-id="${list.id}">
          <div class="list-item-icon">📋</div>
          <div class="list-item-label">${this.escapeHtml(list.name)}</div>
          <div class="list-item-count">${counts[list.id] || ''}</div>
          <div class="list-item-actions">
            <button class="btn-icon-sm btn-rename-list" data-list-id="${list.id}" title="重命名">✎</button>
            <button class="btn-icon-sm btn-delete-list" data-list-id="${list.id}" title="删除">✕</button>
          </div>
        </div>
      `).join('')}
    `;
  }

  renderFooter() {
    document.getElementById('sidebar-footer').innerHTML = `
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

  bindEvents() {
    // Nav items
    document.getElementById('sidebar-nav').addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item) {
        const view = item.dataset.view;
        this.currentView = view;
        this.currentListId = null;
        eventBus.emit('view:change', { view });
        this.render();
      }
    });

    // List items
    document.getElementById('sidebar-lists').addEventListener('click', (e) => {
      const item = e.target.closest('.list-item');
      if (item) {
        const listId = item.dataset.listId;
        this.currentView = 'list';
        this.currentListId = listId;
        eventBus.emit('view:change', { view: 'list', listId });
        this.render();
      }
    });

    // Rename list
    document.getElementById('sidebar-lists').addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-rename-list')) {
        e.stopPropagation();
        const listId = e.target.dataset.listId;
        const list = store.data.lists.find(l => l.id === listId);
        const newName = prompt('重命名清单:', list.name);
        if (newName && newName.trim()) {
          store.updateList(listId, { name: newName.trim() });
          this.render();
          eventBus.emit('list:update');
        }
      }
    });

    // Delete list
    document.getElementById('sidebar-lists').addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-list')) {
        e.stopPropagation();
        const listId = e.target.dataset.listId;
        if (confirm('确定删除此清单及其所有任务？')) {
          store.deleteList(listId);
          if (this.currentListId === listId) {
            this.currentView = 'tasks';
            this.currentListId = null;
            eventBus.emit('view:change', { view: 'tasks' });
          }
          this.render();
          eventBus.emit('list:delete');
        }
      }
    });

    // Add list
    document.getElementById('sidebar-footer').addEventListener('click', (e) => {
      if (e.target.closest('#btn-add-list')) {
        const name = prompt('新清单名称:');
        if (name && name.trim()) {
          const list = store.createList(name.trim());
          this.render();
          eventBus.emit('list:create', list);
        }
      }

      if (e.target.closest('#btn-settings')) {
        eventBus.emit('settings:open');
      }
    });

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
      eventBus.emit('search:change', e.target.value);
    });
  }

  update() {
    this.render();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
