import { THEME_PRESETS } from '../themes/presets.js';

export class Theme {
  constructor() {
    this.currentTheme = 'default';
    this.mode = 'normal';
    this.autoNight = false;
    this.nightTimer = null;
    this.userThemes = [];
  }

  async load() {
    try {
      this.userThemes = await window.api.themes.readUser();
    } catch { this.userThemes = []; }
  }

  getAllThemes() {
    return [...THEME_PRESETS, ...this.userThemes];
  }

  getTheme(id) {
    return this.getAllThemes().find(t => t.id === id) || THEME_PRESETS[0];
  }

  apply(themeId) {
    const t = this.getTheme(themeId);
    if (!t) return;
    this.currentTheme = themeId;
    const { primary, accent, secondary } = t.colors;
    const root = document.documentElement;
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-light', this.lighten(primary, 20));
    root.style.setProperty('--primary-dark', this.darken(primary, 15));
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-light', this.lighten(accent, 15));
    root.style.setProperty('--accent-dark', this.darken(accent, 10));
    root.style.setProperty('--secondary', secondary);
    root.style.setProperty('--secondary-light', this.lighten(secondary, 20));
    root.style.setProperty('--secondary-dark', this.darken(secondary, 15));
    root.style.setProperty('--sidebar-bg', primary);
    root.style.setProperty('--header-gradient', `linear-gradient(135deg, ${primary}, ${accent})`);
    root.style.setProperty('--accent-bg', this.hexToRgba(accent, 0.08));
    this.applyMode(this.mode);
  }

  applyMode(mode) {
    this.mode = mode || 'normal';
    const root = document.documentElement;
    root.classList.remove('dark-mode', 'black-mode', 'sepia-mode');
    if (mode === 'dark') {
      root.classList.add('dark-mode');
    } else if (mode === 'black') {
      root.classList.add('black-mode');
    } else if (mode === 'sepia') {
      root.classList.add('sepia-mode');
    }
  }

  toggleMode(mode) {
    if (this.mode === mode) {
      this.applyMode('normal');
    } else {
      this.applyMode(mode);
    }
    return this.mode;
  }

  setAutoNight(enabled) {
    this.autoNight = enabled;
    if (this.nightTimer) clearTimeout(this.nightTimer);
    if (enabled) this._scheduleNightCheck();
  }

  _scheduleNightCheck() {
    if (!this.autoNight) return;
    const h = new Date().getHours();
    const isNight = h < 7 || h >= 19;
    if (isNight && this.mode === 'normal') {
      this.applyMode('dark');
    } else if (!isNight && this.mode !== 'normal') {
      this.applyMode('normal');
    }
    this.nightTimer = setTimeout(() => this._scheduleNightCheck(), 300000);
  }

  lighten(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  darken(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  hexToRgba(hex, alpha) {
    const num = parseInt(hex.replace('#', ''), 16);
    const R = (num >> 16) & 255;
    const G = (num >> 8) & 255;
    const B = num & 255;
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }

  async saveUserTheme(t) {
    const idx = this.userThemes.findIndex(u => u.id === t.id);
    if (idx >= 0) this.userThemes[idx] = t; else this.userThemes.push(t);
    await window.api.themes.writeUser(this.userThemes);
  }

  async deleteUserTheme(id) {
    this.userThemes = this.userThemes.filter(u => u.id !== id);
    await window.api.themes.writeUser(this.userThemes);
  }
}

export const theme = new Theme();