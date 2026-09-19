import { THEME_PRESETS } from '../themes/presets.js';

const NIGHT_START_HOUR = 19;
const NIGHT_END_HOUR = 7;
const MODES = ['normal', 'dark', 'black', 'sepia'];
const MODE_CLASSES = { dark: 'dark-mode', black: 'black-mode', sepia: 'sepia-mode' };

export class Theme {
  constructor() {
    this.currentTheme = 'default';
    this.mode = 'normal';
    this.userMode = 'normal';
    this.autoNight = false;
    this.autoApplied = false;
    this.lastNightState = null;
    this.nightTimer = null;
    this.userThemes = [];
  }

  async load() {
    try {
      const themes = await window.api.themes.readUser();
      this.userThemes = Array.isArray(themes) ? themes.filter(t => t && t.id && t.colors) : [];
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

  apply(themeId) {
    const t = this.getTheme(themeId);
    this.currentTheme = t.id;
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
    this.applyMode(this.mode, false);
  }

  applyMode(mode, fromUser = true) {
    const next = MODES.includes(mode) ? mode : 'normal';
    if (fromUser) {
      this.userMode = next;
      this.autoApplied = false;
    }
    this.mode = next;
    const root = document.documentElement;
    Object.values(MODE_CLASSES).forEach(cls => root.classList.remove(cls));
    if (MODE_CLASSES[next]) root.classList.add(MODE_CLASSES[next]);
    return this.mode;
  }

  setUserMode(mode) {
    const next = MODES.includes(mode) ? mode : 'normal';
    this.userMode = next;
    this.applyMode(next, false);
    return this.mode;
  }

  toggleMode(mode) {
    const target = MODES.includes(mode) ? mode : 'normal';
    return this.applyMode(this.mode === target ? 'normal' : target);
  }

  setAutoNight(enabled) {
    this.autoNight = Boolean(enabled);
    if (this.nightTimer) {
      clearInterval(this.nightTimer);
      this.nightTimer = null;
    }
    if (!this.autoNight) {
      if (this.autoApplied) this.applyMode(this.userMode, false);
      this.autoApplied = false;
      this.lastNightState = null;
      return;
    }
    this.lastNightState = null;
    this.refreshAutoNight(true);
    this.nightTimer = setInterval(() => this.refreshAutoNight(), 60000);
  }

  isNightTime(now = new Date()) {
    const h = now.getHours();
    return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
  }

  refreshAutoNight(force = false) {
    if (!this.autoNight) return;
    const isNight = this.isNightTime();
    if (!force && isNight === this.lastNightState) return;
    this.lastNightState = isNight;
    const darken = isNight && this.userMode === 'normal';
    const target = darken ? 'dark' : this.userMode;
    if (this.mode !== target) {
      this.applyMode(target, false);
      this.autoApplied = darken;
    }
  }

  normalizeHex(hex) {
    const raw = String(hex || '').trim().replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
    return parseInt(expanded, 16);
  }

  lighten(hex, percent) {
    return this.shift(hex, percent, 255);
  }

  darken(hex, percent) {
    return this.shift(hex, -percent, 0);
  }

  shift(hex, percent, clampTarget) {
    const num = this.normalizeHex(hex);
    if (num === null) return typeof hex === 'string' ? hex : '#000000';
    const amt = Math.round(2.55 * percent);
    const clamp = (value) => (amt >= 0
      ? Math.min(clampTarget, value + amt)
      : Math.max(clampTarget, value + amt));
    const R = clamp((num >> 16) & 0xFF);
    const G = clamp((num >> 8) & 0xFF);
    const B = clamp(num & 0xFF);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  hexToRgba(hex, alpha) {
    const num = this.normalizeHex(hex);
    if (num === null) return `rgba(0, 0, 0, ${alpha})`;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }
}

export const theme = new Theme();
