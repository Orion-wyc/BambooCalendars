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

  close() {
    this.overlay.classList.add('hidden');
  }

  render() {
    const themes = theme.getAllThemes();
    const currentTheme = store.getSettings().theme;

    this.overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <div class="settings-title">设置</div>
          <button class="btn-close-settings" id="btn-close-settings">✕</button>
        </div>
        <div class="settings-content">
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
            <div class="settings-section-title">关于</div>
            <div style="color: var(--text-secondary); font-size: 13px; line-height: 1.8;">
              <div>Bamboo Todo v1.0.0</div>
              <div>离线待办事项桌面应用</div>
              <div style="margin-top: 8px;">数据存储在本地，完全离线运行</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindSettingsEvents();
  }

  bindSettingsEvents() {
    // Close
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.close();
    });

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Theme selection
    this.overlay.addEventListener('click', (e) => {
      const card = e.target.closest('.theme-card');
      if (card) {
        const themeId = card.dataset.themeId;
        theme.apply(themeId);
        store.updateSettings({ theme: themeId });
        this.render();
        eventBus.emit('theme:change', themeId);
      }
    });
  }

  bindEvents() {
    eventBus.on('settings:open', () => {
      this.open();
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close();
      }
    });
  }
}
