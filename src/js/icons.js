// v2.0 线性图标系统（Feather/Lucide 风格，stroke=currentColor）
// 图标内容均为静态可信字符串，不含任何用户数据，避免 XSS。
// fake DOM 解析器只识别 input/button/div/span/select/textarea/option，
// <svg>/<path> 等不会生成子节点，也不会影响既有测试。

const PATHS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  star: '<polygon points="12 2.5 15.09 8.64 21.8 9.64 16.9 14.53 18.09 21.2 12 18.27 5.91 21.2 7.1 14.53 2.2 9.64 8.91 8.64"/>',
  calendarDays: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z"/><path d="M3 8.5h18M8 3v3M16 3v3"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 15.5h.01M12 15.5h.01"/>',
  calendar: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z"/><path d="M3 8.5h18M8 3v3M16 3v3"/>',
  checkSquare: '<path d="M20 7.5V18a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 18V6.5A2.5 2.5 0 0 1 6.5 4H16"/><path d="M9 13l2.2 2.2L19 7.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  clipboard: '<rect x="8" y="2.5" width="8" height="4" rx="1.2"/><path d="M16 4.5h2A2.5 2.5 0 0 1 20.5 7v12A2.5 2.5 0 0 1 18 21.5H6A2.5 2.5 0 0 1 3.5 19V7A2.5 2.5 0 0 1 6 4.5h2"/>',
  inbox: '<path d="M3 12.5 5.6 4.8A2 2 0 0 1 7.5 3.5h9A2 2 0 0 1 18.4 4.8L21 12.5"/><path d="M3 12.5h5l1 2.5h6l1-2.5h5v5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 12.9a1.7 1.7 0 0 0 .03 1.8l.09.15a2 2 0 1 1-3.16 2.34l-.15-.1a1.7 1.7 0 0 0-1.8.04 1.7 1.7 0 0 0-1 1.55v.18a2 2 0 1 1-4 .05v-.17a1.7 1.7 0 0 0-1.1-1.46 1.7 1.7 0 0 0-1.8.04l-.15.09a2 2 0 1 1-2.34-3.16l.1-.15a1.7 1.7 0 0 0-.04-1.8 1.7 1.7 0 0 0-1.55-1H3.2a2 2 0 1 1-.05-4h.17a1.7 1.7 0 0 0 1.46-1.1 1.7 1.7 0 0 0-.04-1.8l-.09-.15A2 2 0 1 1 7.81 3.2l.15.1a1.7 1.7 0 0 0 1.8-.04h.08a1.7 1.7 0 0 0 1-1.55V1.5a2 2 0 1 1 4 .05v.17a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.8-.04l.15-.09a2 2 0 1 1 2.34 3.16l-.1.15a1.7 1.7 0 0 0 .04 1.8v.08a1.7 1.7 0 0 0 1.55 1h.18a2 2 0 1 1-.05 4h-.17a1.7 1.7 0 0 0-1.55 1z"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>',
  trash: '<path d="M4 6.5h16M9 6.5V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2"/><path d="M6 6.5 6.9 19a2 2 0 0 0 2 1.9h6.2a2 2 0 0 0 2-1.9L18 6.5"/><path d="M10 10.5v6M14 10.5v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  flag: '<path d="M5 21V4M5 4.5h11.5l-2 3.5 2 3.5H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  note: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="M8.5 12.5h7M8.5 16h5"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  chevronLeft: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9.5 6l6 6-6 6"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6l.1.7h5.2l.1-.7c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"/>',
  tag: '<path d="M3.5 11.6V4.5A1 1 0 0 1 4.5 3.5h7.1a1 1 0 0 1 .7.3l7 7a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-7-7a1 1 0 0 1-.3-.7z"/><circle cx="7.8" cy="7.8" r="1.3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  alert: '<path d="M12 3.5 21 19.5H3z"/><path d="M12 9.5v4.5M12 17h.01"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  tomato: '<path d="M12 6.5c-4 0-7 2.9-7 6.6S8 20 12 20s7-3.2 7-6.9-3-6.6-7-6.6z"/><path d="M12 6.5c0-1.5-1-2.8-2.6-3M12 6.5c0-1.5 1-2.8 2.6-3"/>',
  cloudSun: '<path d="M7 17.5a3.5 3.5 0 0 1-.4-6.97A5 5 0 0 1 16 9.2a3.8 3.8 0 0 1 1.3 7.3z"/><path d="M16 4.5V3M19.8 6l1.2-1.2M21.5 10h1.5"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11V9a3 3 0 0 1 3-3H20.5"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 13v2a3 3 0 0 1-3 3H3.5"/>',
};

function attrs(opts = {}) {
  const size = opts.size ?? 20;
  const sw = opts.strokeWidth ?? 1.7;
  const cls = opts.class ? ` class="${opts.class}"` : '';
  const fill = opts.filled ? 'currentColor' : 'none';
  return `class="icon"${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" `
    + `stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" `
    + `aria-hidden="true" focusable="false"`;
}

// 返回一个内联 SVG 字符串。未知名称回退到 note，保证不产出空壳。
export function icon(name, opts = {}) {
  const key = Object.prototype.hasOwnProperty.call(PATHS, name) ? name : 'note';
  return `<svg ${attrs(opts)}>${PATHS[key]}</svg>`;
}

// 供既有测试读取的纯文本别名场景（例如占位/危险）不适用，图标一律走 SVG。
export const ICON_NAMES = Object.keys(PATHS);
