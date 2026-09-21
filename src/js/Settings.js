import { theme } from './Theme.js';
import { store } from './Store.js';
import { eventBus } from './EventBus.js';
import { dialog } from './Dialog.js';
import { buttonFocusKey, escapeHtml, preserveScroll, restoreFocus } from './Utils.js';

const SORT_OPTIONS = [
  ['created', '按创建时间'],
  ['dueDate', '按截止日期'],
  ['priority', '按优先级'],
  ['important', '按重要程度'],
  ['alpha', '按名称排序'],
  ['manual', '手动排序'],
];

const MODE_OPTIONS = [
  ['normal', '正常'],
  ['dark', '深色'],
  ['black', '黑色'],
  ['sepia', '棕褐色'],
];

const SHORTCUTS = [
  'Ctrl/Cmd + N 新建任务 · Ctrl/Cmd + F 搜索',
  'Ctrl/Cmd + L 新建清单 · Ctrl/Cmd + Shift + Y 重命名清单',
  'Ctrl/Cmd + Shift + D 删除清单 · Ctrl/Cmd + Shift + H 折叠已完成',
  'Ctrl/Cmd + D 删除任务 · Ctrl/Cmd + T 重命名任务 · Ctrl/Cmd + Shift + N 完成任务',
  'Ctrl/Cmd + K 加入我的一天 · Ctrl/Cmd + I 标记重要',
  'Ctrl/Cmd + Shift + E 设置提醒 · Ctrl/Cmd + Shift + T 设置截止日期',
  'Ctrl/Cmd + Shift + O 窗口置顶 · Ctrl/Cmd + Shift + J 紧凑模式',
  'Ctrl/Cmd + Shift + M/I/A 跳转 我的一天/重要/所有任务',
  'Ctrl/Cmd + 1-9 跳转清单 · Ctrl/Cmd + Tab 下一个视图',
  'Ctrl/Cmd + O 切换侧边栏 · Ctrl/Cmd + Shift + G 正常模式',
  'Ctrl/Cmd + H/B/G 深色/黑色/棕褐色主题',
  'Ctrl/Cmd + + / - / 0 放大/缩小/重置缩放',
  'Ctrl/Cmd + , 打开设置 · Esc 关闭面板',
  'Ctrl/Cmd + Alt + C 全局新建任务 · Ctrl/Cmd + Alt + A 全局显示/隐藏窗口',
];

export class Settings {
  constructor() {
    this.overlay = document.getElementById('settings-overlay');
    this.currentTab = 'general';
    this.lastRenderedTab = null;
    this.isOpen = false;
    this.appVersion = '';
    this.dataDir = '';
    this.bindEvents();
    this.loadAppInfo();
  }

  async loadAppInfo() {
    try {
      this.appVersion = await window.api.app.getVersion();
      this.dataDir = await window.api.window.getPath('userData');
    } catch {
      this.appVersion = '';
      this.dataDir = '';
    }
  }

  open(tab = 'general') {
    this.isOpen = true;
    this.currentTab = tab;
    this.lastRenderedTab = null;
    this.overlay.classList.remove('hidden');
    this.render();
  }

  openAbout() {
    this.open('about');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.lastRenderedTab = null;
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
  }

  render() {
    if (!this.isOpen) return;
    const tabs = [['general', '常规'], ['tags', '标签'], ['about', '关于']];
    const sameTab = this.lastRenderedTab === this.currentTab;
    const focusKey = buttonFocusKey(document.activeElement, this.overlay);
    this.lastRenderedTab = this.currentTab;

    const rebuild = () => {
      this.overlay.innerHTML = `
        <div class="settings-modal">
          <div class="settings-header">
            <div class="settings-title">设置</div>
            <button class="btn-close-settings" data-action="close-settings">✕</button>
          </div>
          <div class="settings-tabs">
            ${tabs.map(([id, label]) => `
              <button class="settings-tab ${this.currentTab === id ? 'active' : ''}" data-action="switch-tab" data-tab="${id}">${label}</button>
            `).join('')}
          </div>
          <div class="settings-content">
            ${this.renderTab(this.currentTab)}
          </div>
        </div>
      `;
    };

    if (sameTab) preserveScroll(this.overlay, '.settings-content', rebuild);
    else rebuild();
    restoreFocus(this.overlay, focusKey);
  }

  renderTab(tab) {
    if (tab === 'tags') return this.renderTags();
    if (tab === 'about') return this.renderAbout();
    return this.renderGeneral();
  }

  toggleRow(setting, title, desc, enabled) {
    return `
      <div class="settings-toggle-row" data-action="toggle-setting" data-setting="${setting}">
        <div class="settings-toggle-label">
          <div class="settings-toggle-title">${title}</div>
          <div class="settings-toggle-desc">${desc}</div>
        </div>
        <div class="toggle-switch ${enabled ? 'active' : ''}"></div>
      </div>
    `;
  }

  renderGeneral() {
    const settings = store.getSettings();
    const themes = theme.getAllThemes();

    return `
      <div class="settings-section">
        <div class="settings-section-title">主题配色</div>
        <div class="theme-grid">
          ${themes.map(t => `
            <div class="theme-card ${settings.theme === t.id ? 'active' : ''}" data-action="select-theme" data-theme-id="${escapeHtml(t.id)}">
              <div class="theme-preview">
                <div class="theme-color" style="background: ${escapeHtml(t.colors.primary)}"></div>
                <div class="theme-color" style="background: ${escapeHtml(t.colors.accent)}"></div>
                <div class="theme-color" style="background: ${escapeHtml(t.colors.secondary)}"></div>
              </div>
              <div class="theme-name">${escapeHtml(t.name)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">显示模式</div>
        <div class="mode-grid">
          ${MODE_OPTIONS.map(([mode, label]) => `
            <div class="mode-card ${(settings.mode || 'normal') === mode ? 'active' : ''}" data-action="select-mode" data-mode="${mode}">
              <div class="mode-preview mode-preview-${mode}"></div>
              <div class="mode-name">${label}</div>
            </div>
          `).join('')}
        </div>
        ${this.toggleRow('autoNightMode', '自动夜间模式', '夜间（19:00 - 07:00）自动切换到深色主题', Boolean(settings.autoNightMode))}
      </div>

      <div class="settings-section">
        <div class="settings-section-title">界面选项</div>
        ${this.toggleRow('sideBarHidden', '隐藏侧边栏', '折叠侧边栏，扩大任务区域', Boolean(settings.sideBarHidden))}
        ${this.toggleRow('compactMode', '紧凑模式', '缩小界面元素，显示更多内容', Boolean(settings.compactMode))}
        ${this.toggleRow('alwaysOnTop', '窗口置顶', '窗口始终显示在其他窗口之上', Boolean(settings.alwaysOnTop))}
        ${this.toggleRow('requestExitConfirmation', '关闭时最小化到托盘', '点击窗口关闭按钮时最小化到系统托盘（关闭后可直接从窗口退出）', settings.requestExitConfirmation !== false)}
        ${this.toggleRow('checkUpdateOnStartup', '启动时检查更新', '启动时向 GitHub 查询是否有新版本', settings.checkUpdateOnStartup !== false)}
        <div class="settings-field" style="margin-top: 12px;">
          <div class="detail-field-label">任务排序方式</div>
          <select class="detail-select" id="setting-sort-by">
            ${SORT_OPTIONS.map(([value, label]) => `
              <option value="${value}" ${settings.sortBy === value ? 'selected' : ''}>${label}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">番茄钟</div>
        <div class="settings-field-row">
          <div class="settings-field">
            <div class="detail-field-label">专注时长（分钟）</div>
            <input type="number" class="detail-input settings-number" id="setting-pomodoro-work"
                   min="1" max="180" step="1" value="${settings.pomodoroWorkMinutes}">
          </div>
          <div class="settings-field">
            <div class="detail-field-label">休息时长（分钟）</div>
            <input type="number" class="detail-input settings-number" id="setting-pomodoro-break"
                   min="1" max="60" step="1" value="${settings.pomodoroBreakMinutes}">
          </div>
        </div>
        <div class="settings-toggle-desc" style="margin-top: 8px;">
          保存后立即作用于尚未开始的计时；进行中的番茄不受影响，将在下一段生效
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">快捷键</div>
        <div style="color: var(--text-secondary); font-size: 13px; line-height: 2;">
          ${SHORTCUTS.map(s => `<div>${s}</div>`).join('')}
        </div>
      </div>
    `;
  }

  renderTags() {
    const tags = store.getTags();
    return `
      <div class="settings-section">
        <div class="settings-section-title">标签管理</div>
        <div class="tag-manager">
          ${tags.map(t => `
            <div class="tag-manager-item" data-tag-id="${escapeHtml(t.id)}">
              <span class="tag-manager-dot" style="background:${escapeHtml(t.color)}"></span>
              <input class="tag-manager-name" value="${escapeHtml(t.name)}" data-tag-id="${escapeHtml(t.id)}">
              <input type="color" class="tag-manager-color" value="${escapeHtml(t.color)}" data-tag-id="${escapeHtml(t.id)}">
              <button class="tag-manager-delete" data-action="delete-tag" data-tag-id="${escapeHtml(t.id)}" title="删除标签">✕</button>
            </div>
          `).join('')}
          ${tags.length === 0 ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">暂无标签</div>' : ''}
          <div class="tag-manager-add">
            <input class="tag-manager-input" id="new-tag-name" placeholder="新标签名称">
            <input type="color" class="tag-manager-color" id="new-tag-color" value="#4a90d9">
            <button class="tag-manager-btn" data-action="add-tag">添加</button>
          </div>
        </div>
      </div>
    `;
  }

  renderAbout() {
    return `
      <div class="settings-section">
        <div class="settings-section-title">Bamboo Todo</div>
        <div style="color: var(--text-secondary); font-size: 13px; line-height: 2;">
          <div>版本：${escapeHtml(this.appVersion || '未知')}</div>
          <div>类型：离线待办事项桌面应用</div>
          <div>数据存储：本地 JSON 文件${escapeHtml(this.dataDir ? `（${this.dataDir}）` : '')}</div>
          <div>技术栈：Electron + 原生 JS</div>
        </div>
        <div class="settings-actions" style="margin-top: 12px; display: flex; gap: 8px;">
          <button class="tag-manager-btn" data-action="check-update">检查更新</button>
          <button class="tag-manager-btn" data-action="quit-app">退出应用</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">特色功能</div>
        <div style="color: var(--text-secondary); font-size: 13px; line-height: 2;">
          <div>• Fluent 2 设计风格（品牌蓝配色）</div>
          <div>• 显示模式（正常/深色/黑色/棕褐色 + 自动夜间）</div>
          <div>• 键盘快捷键 + 全局快捷键</div>
          <div>• 系统托盘 / 窗口状态记忆 / 缩放</div>
          <div>• 子任务 / 备注 / 重复 / 提醒 / 番茄钟 / 日历</div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.overlay.addEventListener('click', (e) => this.handleClick(e));
    this.overlay.addEventListener('change', (e) => this.handleChange(e));
    eventBus.on('settings:open', () => this.open());
    eventBus.on('settings:changed', () => { if (this.isOpen) this.render(); });
  }

  handleClick(e) {
    if (e.target === this.overlay) {
      this.close();
      return;
    }
    const target = e.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
      case 'close-settings':
        this.close();
        break;
      case 'switch-tab':
        this.currentTab = target.dataset.tab;
        this.render();
        break;
      case 'select-theme':
        this.applyTheme(target.dataset.themeId);
        break;
      case 'select-mode':
        this.applyMode(target.dataset.mode);
        break;
      case 'toggle-setting':
        this.toggleSetting(target.dataset.setting);
        break;
      case 'add-tag':
        this.addTag();
        break;
      case 'delete-tag':
        this.deleteTag(target.dataset.tagId);
        break;
      case 'check-update':
        window.api.app.checkUpdate();
        break;
      case 'quit-app':
        this.quitApp();
        break;
      default:
        break;
    }
  }

  handleChange(e) {
    if (e.target.id === 'setting-sort-by') {
      store.updateSettings({ sortBy: e.target.value });
      eventBus.emit('task:update');
      return;
    }
    if (e.target.id === 'setting-pomodoro-work' || e.target.id === 'setting-pomodoro-break') {
      const key = e.target.id === 'setting-pomodoro-work'
        ? 'pomodoroWorkMinutes' : 'pomodoroBreakMinutes';
      store.updateSettings({ [key]: e.target.value });
      const normalized = store.getSettings()[key];
      if (String(normalized) !== String(e.target.value)) e.target.value = normalized;
      eventBus.emit('pomodoro:settings');
      return;
    }
    if (e.target.classList.contains('tag-manager-name')) {
      const name = e.target.value.trim();
      if (!name) {
        this.render();
        return;
      }
      store.updateTag(e.target.dataset.tagId, { name });
      eventBus.emit('task:update');
      this.render();
      return;
    }
    if (e.target.classList.contains('tag-manager-color') && e.target.dataset.tagId) {
      store.updateTag(e.target.dataset.tagId, { color: e.target.value });
      eventBus.emit('task:update');
      this.render();
    }
  }

  applyTheme(themeId) {
    theme.apply(themeId);
    store.updateSettings({ theme: themeId });
    this.render();
  }

  applyMode(mode) {
    theme.setUserMode(mode);
    store.updateSettings({ mode: theme.mode });
    this.render();
  }

  toggleSetting(setting) {
    const settings = store.getSettings();
    const next = !settings[setting];
    store.updateSettings({ [setting]: next });

    switch (setting) {
      case 'autoNightMode':
        theme.setAutoNight(next);
        store.updateSettings({ mode: theme.userMode });
        break;
      case 'sideBarHidden':
        document.documentElement.classList.toggle('side-bar-hidden', next);
        break;
      case 'compactMode':
        document.documentElement.classList.toggle('compact-mode', next);
        window.api.app.applySetting('compactMode', next);
        break;
      case 'alwaysOnTop':
        window.api.app.applySetting('alwaysOnTop', next);
        break;
      case 'requestExitConfirmation':
      case 'checkUpdateOnStartup':
        window.api.app.applySetting(setting, next);
        break;
      default:
        break;
    }
    this.render();
    eventBus.emit('settings:changed');
  }

  addTag() {
    const nameInput = this.overlay.querySelector('#new-tag-name');
    const colorInput = this.overlay.querySelector('#new-tag-color');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    store.createTag(name, colorInput ? colorInput.value : '#4a90d9');
    eventBus.emit('task:update');
    this.render();
    const fresh = this.overlay.querySelector('#new-tag-name');
    if (fresh) fresh.focus();
  }

  async deleteTag(tagId) {
    const tag = store.getTag(tagId);
    if (!tag) return;
    const used = store.data.tasks.filter(t => (t.tags || []).includes(tagId)).length;
    const confirmed = await dialog.confirm({
      title: '删除标签',
      message: used > 0
        ? `标签"${tag.name}"正被 ${used} 个任务使用，删除后这些任务会移除该标签。`
        : `标签"${tag.name}"将被删除。`,
      confirmText: '删除',
      danger: true,
    });
    if (!confirmed) return;
    store.deleteTag(tagId);
    eventBus.emit('task:update');
    eventBus.emit('tag:delete', tagId);
    this.render();
  }

  async quitApp() {
    const confirmed = await dialog.confirm({
      title: '退出应用', message: '确定退出 Bamboo Todo？', confirmText: '退出', danger: true,
    });
    if (confirmed) window.api.app.quit();
  }
}
