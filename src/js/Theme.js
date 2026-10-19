import { THEME_PRESETS } from '../themes/presets.js';
import { syncTitlebarOverlay } from './TitleBar.js';

const NIGHT_START_HOUR = 19;
const NIGHT_END_HOUR = 7;

// 主题可覆盖的中性面变量（不含 --sidebar-bg / status-btn 等被测试钉死的令牌）
export const SURFACE_KEYS = [
  '--bg-main', '--bg-panel', '--bg-hover', '--bg-active',
  '--border', '--border-light', '--border-soft',
  '--text-primary', '--text-secondary', '--text-muted',
];

// surfaces 既可用 camelCase（bgMain）也可用 kebab（bg-main / --bg-main）声明
function resolveSurface(surfaces, key) {
  if (!surfaces) return undefined;
  const camel = key.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const kebab = key.replace(/^--/, '');
  const value = surfaces[camel];
  if (value !== undefined && value !== null) return value;
  const alt = surfaces[kebab];
  if (alt !== undefined && alt !== null) return alt;
  return surfaces[key];
}

export class Theme {
  constructor() {
    this.currentTheme = 'passion';
    this.userTheme = 'passion';
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
    const c = t.colors || {};
    const { primary, accent, secondary } = c;
    const root = document.documentElement;
    const put = (name, value) => {
      if (value === undefined || value === null) root.style.removeProperty(name);
      else root.style.setProperty(name, value);
    };
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-light', this.lighten(primary, 20));
    root.style.setProperty('--primary-dark', this.darken(primary, 15));
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-light', this.lighten(accent, 15));
    root.style.setProperty('--accent-dark', c.accentDark || this.darken(accent, 10));
    root.style.setProperty('--secondary', secondary);
    root.style.setProperty('--secondary-light', this.lighten(secondary, 20));
    root.style.setProperty('--secondary-dark', this.darken(secondary, 15));
    put('--success', c.success);
    put('--success-dark', c.successDark);
    put('--success-btn', c.successBtn);
    put('--warning', c.warning);
    put('--warning-dark', c.warningDark);
    put('--danger', c.danger);
    put('--danger-dark', c.dangerDark);
    put('--danger-btn', c.dangerBtn);
    put('--on-accent', c.onAccent);
    put('--on-success', c.onSuccess);
    put('--on-warning', c.onWarning);
    put('--on-danger', c.onDanger);
    root.style.setProperty('--sidebar-bg', c.sidebarBg || primary);
    root.style.setProperty('--sidebar-text', c.sidebarText || '#ffffff');
    root.style.setProperty('--sidebar-hover', c.sidebarHover || 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--sidebar-active', c.sidebarActive || 'rgba(255, 255, 255, 0.15)');
    root.style.setProperty('--sidebar-border', c.sidebarBorder || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--sidebar-search-bg', c.sidebarSearchBg || 'rgba(255, 255, 255, 0.15)');
    root.style.setProperty('--sidebar-search-hover', c.sidebarSearchHover || 'rgba(255, 255, 255, 0.25)');
    root.style.setProperty('--sidebar-placeholder', c.sidebarPlaceholder || 'rgba(255, 255, 255, 0.6)');
    root.style.setProperty('--sidebar-icon-hover', c.sidebarIconHover || 'rgba(255, 255, 255, 0.2)');
    root.style.setProperty('--header-bg', c.headerBg || `linear-gradient(135deg, ${primary}, ${accent})`);
    root.style.setProperty('--header-text', c.headerText || '#ffffff');
    root.style.setProperty('--accent-bg', this.hexToRgba(accent, 0.08));
    root.style.setProperty('--accent-soft', this.hexToRgba(accent, 0.18));
    const surfaces = c.surfaces || {};
    SURFACE_KEYS.forEach(key => {
      put(key, resolveSurface(surfaces, key));
    });
    root.classList.toggle('dark-mode', t.darkSurfaces === true);
    syncTitlebarOverlay();
  }

  _nightTarget(themeId) {
    const t = this.getTheme(themeId);
    if (t.darkVariant) return t.darkVariant;
    if (t.darkSurfaces) return t.id;
    // 无深色变体时，回退到第一个深色预设
    const firstDark = this.getAllThemes().find(x => x.darkSurfaces);
    return firstDark ? firstDark.id : t.id;
  }

  setUserTheme(themeId) {
    const t = this.getTheme(themeId);
    this.userTheme = t.id;
    this.autoApplied = false;
    if (this.autoNight && this.isNightTime()) {
      const target = this._nightTarget(t.id);
      this.autoApplied = target !== t.id;
      this.apply(target);
    } else {
      this.apply(t.id);
    }
    return this.currentTheme;
  }

  setAutoNight(enabled) {
    this.autoNight = Boolean(enabled);
    if (this.nightTimer) {
      clearInterval(this.nightTimer);
      this.nightTimer = null;
    }
    if (!this.autoNight) {
      if (this.autoApplied) this.apply(this.userTheme);
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
    const target = isNight ? this._nightTarget(this.userTheme) : this.userTheme;
    this.autoApplied = isNight && target !== this.userTheme;
    if (this.currentTheme !== target) this.apply(target);
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
