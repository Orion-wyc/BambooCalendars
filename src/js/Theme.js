import { THEME_PRESETS } from '../themes/presets.js';

export class Theme {
  constructor() {
    this.currentTheme = 'default';
    this.userThemes = [];
  }

  async load() {
    try {
      this.userThemes = await window.api.themes.readUser();
    } catch {
      this.userThemes = [];
    }
  }

  getAllThemes() {
    return [...THEME_PRESETS, ...this.userThemes];
  }

  getTheme(id) {
    return this.getAllThemes().find(t => t.id === id) || THEME_PRESETS[0];
  }

  apply(id) {
    const theme = this.getTheme(id);
    if (!theme) return;

    this.currentTheme = id;
    const { primary, accent, secondary } = theme.colors;

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

  async saveUserTheme(theme) {
    const index = this.userThemes.findIndex(t => t.id === theme.id);
    if (index >= 0) {
      this.userThemes[index] = theme;
    } else {
      this.userThemes.push(theme);
    }
    await window.api.themes.writeUser(this.userThemes);
  }

  async deleteUserTheme(id) {
    this.userThemes = this.userThemes.filter(t => t.id !== id);
    await window.api.themes.writeUser(this.userThemes);
  }
}

export const theme = new Theme();
