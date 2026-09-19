import { theme } from './Theme.js';
import { store } from './Store.js';
import { eventBus } from './EventBus.js';

export class Settings {
  constructor() {
    this.overlay = document.getElementById('settings-overlay');
    this.bindEvents();
  }

  open() {
    this.overlay.classList.remove('hidden');
    this.render();
  }

  openAbout() {
    this.overlay.classList.remove('hidden');
    this.render('about');
  }

  close() {
    this.overlay.classList.add('hidden');
  }

  render(tab = 'general') {
    const themes = theme.getAllThemes();
    const settings = store.getSettings();
    const currentTheme = settings.theme;

    this.overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <div class="settings-title">设置</div>
          <button class="btn-close-settings" id="btn-close-settings">✕</button>
        </div>
        <div class="settings-tabs">
          <button class="settings-tab ${tab === 'general' ? 'active' : ''}" data-tab="general">常规</button>
          <button class="settings-tab ${tab === 'about' ? 'active' : ''}" data-tab="about">关于</button>
        </div>
        <div class="settings-content">
          ${tab === 'general' ? this.renderGeneral(themes, settings, currentTheme) : this.renderAbout()}
        </div>
      </div>
    `;

    this.bindSettingsEvents();
  }

  renderGeneral(themes, settings, currentTheme) {
    return `
      <div class="settings-section">
        <div class="settings-section-title">主题配色</div>
        <div class="theme-grid">
          ${themes.map(t => `
            <div class="theme-card ${currentTheme === t.id ? 'active' : ''}" data-theme-id="${t.id}">
              <div class="theme-preview">
                <div class="theme-color" style="background: ${t.colors.primary}"></div>
                <div class="theme-color" style="background: ${t.colors.accent}"></div>
                <div class="theme-color" style="background: ${t.colors.secondary}"></div>
              </div>
              <div class="theme-name">${t.name}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">显示模式</div>
        <div class="mode-grid">
          <div class="mode-card ${!settings.mode || settings.mode === 'normal' ? 'active' : ''}" data-mode="normal">
            <div class="mode-preview mode-preview-normal"></div>
            <div class="mode-name">正常</div>
          </div>
          <div class="mode-card ${settings.mode === 'dark' ? 'active' : ''}" data-mode="dark">
            <div class="mode-preview mode-preview-dark"></div>
            <div class="mode-name">深色</div>
          </div>
          <div class="mode-card ${settings.mode === 'black' ? 'active' : ''}" data-mode="black">
            <div class="mode-preview mode-preview-black"></div>
            <div class="mode-name">黑色</div>
          </div>
          <div class="mode-card ${settings.mode === 'sepia' ? 'active' : ''}" data-mode="sepia">
            <div class="mode-preview mode-preview-sepia"></div>
            <div class="mode-name">棕褐色</div>
          </div>
        </div>
        <div class="settings-toggle-row" id="toggle-auto-night">
          <div class="settings-toggle-label">
            <div class="settings-toggle-title">自动夜间模式</div>
            <div class="settings-toggle-desc">夜间自动切换到深色主题</div>
          </div>
          <div class="toggle-switch ${settings.autoNightMode ? 'active' : ''}"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">界面选项</div>
        <div class="settings-toggle-row" id="toggle-sidebar-setting">
          <div class="settings-toggle-label">
            <div class="settings-toggle-title">隐藏侧边栏</div>
            <div class="settings-toggle-desc">折叠侧边栏，扩大任务区域</div>
          </div>
          <div class="toggle-switch ${settings.sideBarHidden ? 'active' : ''}"></div>
        </div>
        <div class="settings-toggle-row" id="toggle-compact-setting">
          <div class="settings-toggle-label">
            <div class="settings-toggle-title">紧凑模式</div>
            <div class="settings-toggle-desc">缩小界面元素，显示更多内容</div>
          </div>
          <div class="toggle-switch ${settings.compactMode ? 'active' : ''}"></div>
        </div>
        <div class="settings-toggle-row" id="toggle-always-top">
          <div class="settings-toggle-label">
            <div class="settings-toggle-title">窗口置顶</div>
            <div class="settings-toggle-desc">窗口始终显示在其他窗口之上</div>
          </div>
          <div class="toggle-switch ${settings.alwaysOnTop ? 'active' : ''}"></div>
        </div>
        <div class="settings-toggle-row" id="toggle-exit-confirm">
          <div class="settings-toggle-label">
            <div class="settings-toggle-title">关闭时最小化到托盘</div>
            <div class="settings-toggle-desc">点击窗口关闭按钮时最小化到系统托盘</div>
          </div>
          <div class="toggle-switch ${settings.requestExitConfirmation !== false ? 'active' : ''}"></div>
        </div>
        <div class="settings-field" style="margin-top: 12px;">
          <div class="detail-field-label">任务排序方式</div>
          <select class="detail-select" id="setting-sort-by">
            <option value="created" ${settings.sortBy === 'created' ? 'selected' : ''}>按创建时间</option>
            <option value="dueDate" ${settings.sortBy === 'dueDate' ? 'selected' : ''}>按截止日期</option>
            <option value="important" ${settings.sortBy === 'important' ? 'selected' : ''}>按重要程度</option>
            <option value="alpha" ${settings.sortBy === 'alpha' ? 'selected' : ''}>按字母排序</option>
            <option value="manual" ${settings.sortBy === 'manual' ? 'selected' : ''}>手动排序</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">快捷键</div>
        <div style="color: var(--text-secondary); font-size: 13px; line-height: 2;">
          <div>Ctrl/Cmd + N 新建任务 | Ctrl/Cmd + F 搜索</div>
          <div>Ctrl/Cmd + L 新清单 | Ctrl/Cmd + Tab 下一个清单</div>
          <div>Ctrl/Cmd + 1-9 跳转清单 | Ctrl/Cmd + O 切换侧边栏</div>
          <div>Ctrl/Cmd + H/B/G 深色/黑色/棕褐色主题</div>
          <div>Ctrl/Cmd + Shift + = / - / 0 缩放</div>
          <div>Ctrl/Cmd + . 打开设置</div>
        </div>
      </div>
    `;
  }

  renderAbout() {
    return `
      <div class="settings-section">
        <div class="settings-section-title">Bamboo Todo</div>
        <div style="color: var(--text-secondary); font-size: 13px; line-height: 2;">
          <div>版本：v1.0.0</div>
          <div>类型：离线待办事项桌面应用</div>
          <div>数据存储：本地 JSON 文件（完全离线）</div>
          <div>技术栈：Electron + 原生 JS</div>
</div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">标签管理</div>
        <div class="tag-manager">
          ${store.getTags().map(t => `
            <div class="tag-manager-item" data-tag-id="${t.id}">
              <span class="tag-manager-dot" style="background:${t.color}"></span>
              <input class="tag-manager-name" value="${t.name}" data-tag-id="${t.id}">
              <input type="color" class="tag-manager-color" value="${t.color}" data-tag-id="${t.id}">
              <button class="tag-manager-delete" data-tag-id="${t.id}" title="删除标签">✕</button>
            </div>
          `).join('')}
          <div class="tag-manager-add">
            <input class="tag-manager-input" id="new-tag-name" placeholder="新标签名称">
            <input type="color" class="tag-manager-color" id="new-tag-color" value="#4a90d9">
            <button class="tag-manager-btn" id="btn-add-tag">添加</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">特色功能</div>
        <div style="color: var(--text-secondary); font-size: 13px; line-height: 2;">
          <div>• 多主题配色（默认/海洋/森林/日落/紫罗兰）</div>
          <div>• 显示模式（正常/深色/黑色/棕褐色 + 自动夜间）</div>
          <div>• 40+ 键盘快捷键 + 全局快捷键</div>
          <div>• 系统托盘 / 窗口状态记忆 / 缩放</div>
          <div>• 子任务 / 备注 / 重复 / 提醒</div>
        </div>
      </div>
    `;
  }

  bindSettingsEvents() {
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.close();
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Tabs
    this.overlay.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.render(tab.dataset.tab);
      });
    });

    // Theme selection
    this.overlay.addEventListener('click', (e) => {
      const card = e.target.closest('.theme-card');
      if (card) {
        const themeId = card.dataset.themeId;
        theme.apply(themeId);
        store.updateSettings({ theme: themeId });
        this.render('general');
        eventBus.emit('theme:change', themeId);
        return;
      }

      // Mode selection
      const modeCard = e.target.closest('.mode-card');
      if (modeCard) {
        const mode = modeCard.dataset.mode;
        theme.applyMode(mode);
        store.updateSettings({ mode });
        this.render('general');
        return;
      }

      // Auto night toggle
      if (e.target.closest('#toggle-auto-night')) {
        const enabled = !store.getSettings().autoNightMode;
        theme.setAutoNight(enabled);
        store.updateSettings({ autoNightMode: enabled });
        this.render('general');
        return;
      }

      // Sidebar toggle
      if (e.target.closest('#toggle-sidebar-setting')) {
        const hidden = !store.getSettings().sideBarHidden;
        document.documentElement.classList.toggle('side-bar-hidden', hidden);
        store.updateSettings({ sideBarHidden: hidden });
        this.render('general');
        return;
      }

      // Compact mode toggle
      if (e.target.closest('#toggle-compact-setting')) {
        const val = !store.getSettings().compactMode;
        document.documentElement.classList.toggle('compact-mode', val);
        store.updateSettings({ compactMode: val });
        window.api.app.applySetting('compactMode', val);
        this.render('general');
        return;
      }

      // Always on top toggle
      if (e.target.closest('#toggle-always-top')) {
        const val = !store.getSettings().alwaysOnTop;
        store.updateSettings({ alwaysOnTop: val });
        window.api.app.applySetting('alwaysOnTop', val);
        this.render('general');
        return;
      }

      // Sort by change
      const sortByEl = e.target.closest('#setting-sort-by');
      if (sortByEl) {
        store.updateSettings({ sortBy: sortByEl.value });
        eventBus.emit('task:update');
        return;
      }

      // Exit confirmation toggle
      if (e.target.closest('#toggle-exit-confirm')) {
        const val = store.getSettings().requestExitConfirmation !== false;
        store.updateSettings({ requestExitConfirmation: !val });
        this.render('general');
        return;
      }

      // Add tag
      if (e.target.closest('#btn-add-tag')) {
        const nameInput = document.getElementById('new-tag-name');
        const colorInput = document.getElementById('new-tag-color');
        const name = nameInput.value.trim();
        if (name) {
          store.createTag(name, colorInput.value);
          eventBus.emit('task:update');
          this.render('general');
        }
        return;
      }

      // Delete tag
      const delBtn = e.target.closest('.tag-manager-delete');
      if (delBtn) {
        store.deleteTag(delBtn.dataset.tagId);
        eventBus.emit('task:update');
        this.render('general');
        return;
      }
    });

    // Tag name/color change
    this.overlay.querySelectorAll('.tag-manager-name').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.value.trim();
        if (name) {
          store.updateTag(input.dataset.tagId, { name });
          eventBus.emit('task:update');
          this.render('general');
        }
      });
    });
    this.overlay.querySelectorAll('.tag-manager-color').forEach(input => {
      input.addEventListener('change', () => {
        store.updateTag(input.dataset.tagId, { color: input.value });
        eventBus.emit('task:update');
        this.render('general');
      });
    });
  }

  bindEvents() {
    eventBus.on('settings:open', () => this.open());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close();
      }
    });
  }
}