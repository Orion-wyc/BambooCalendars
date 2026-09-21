const DEFAULT_CONTROLS_WIDTH = 138;

function setControlsWidth(width) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return;
  try {
    document.documentElement.style.setProperty('--titlebar-controls-w', `${Math.ceil(w)}px`);
  } catch {}
}

function readThemeColors() {
  try {
    if (typeof getComputedStyle !== 'function') return null;
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--bg-panel').trim();
    const fg = cs.getPropertyValue('--text-primary').trim();
    if (!bg || !fg) return null;
    return { color: bg, symbolColor: fg };
  } catch {
    return null;
  }
}

export function syncTitlebarOverlay() {
  try {
    if (!window.api || !window.api.titlebar) return;
    if (window.api.platform === 'darwin') return;
    const colors = readThemeColors();
    if (colors) window.api.titlebar.setOverlay(colors);
  } catch {}
}

export function initTitleBar() {
  try {
    const platform = (window.api && window.api.platform) || 'win32';
    document.documentElement.classList.add(`platform-${platform}`);
    if (platform === 'darwin') return;

    const wco = typeof navigator !== 'undefined' && navigator.windowControlsOverlay;
    if (!wco || typeof wco.getBounds !== 'function') {
      setControlsWidth(DEFAULT_CONTROLS_WIDTH);
      return;
    }
    const update = () => {
      try { setControlsWidth(wco.getBounds().width); } catch {}
    };
    update();
    if (typeof wco.addEventListener === 'function') wco.addEventListener('resize', update);
  } catch {}
}
