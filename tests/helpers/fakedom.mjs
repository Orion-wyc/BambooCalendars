export const mock = {
  stored: null,
  writes: [],
  notifications: [],
  appliedSettings: [],
  confirmResult: true,
  promptResult: null,
  version: '1.0.0',
  userDataPath: '/tmp/bamboo-test-userdata',
};

export function resetMock() {
  mock.stored = null;
  mock.writes = [];
  mock.notifications = [];
  mock.appliedSettings = [];
  mock.confirmResult = true;
  mock.promptResult = null;
}

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => x && this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, force) {
    const next = force === undefined ? !this.set.has(c) : Boolean(force);
    if (next) this.set.add(c); else this.set.delete(c);
    return next;
  }
}

function camelize(name) {
  return name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function matches(el, selector) {
  if (!el || !selector) return false;
  return selector.split(',').map(x => x.trim()).some(sel => {
    const attrEq = /^\[([a-zA-Z-]+)="([^"]*)"\]$/.exec(sel);
    if (attrEq) return el.dataset && el.dataset[camelize(attrEq[1])] === attrEq[2];
    const attr = /^\[([a-zA-Z-]+)\]$/.exec(sel);
    if (attr) return el.dataset && el.dataset[camelize(attr[1])] !== undefined;
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return el.tagName === sel.toUpperCase();
  });
}

const registry = new Map();

function parseInto(el, html) {
  el.children = [];
  const re = /<(input|button|div|span|select|textarea|option)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const child = new FakeElement(m[1]);
    const attrs = m[2];
    const id = /\sid="([^"]*)"/.exec(attrs);
    if (id) { child.id = id[1]; registry.set(id[1], child); }
    const cls = /\sclass="([^"]*)"/.exec(attrs);
    if (cls) cls[1].split(/\s+/).forEach(c => c && child.classList.add(c));
    const dataRe = /\sdata-([a-z-]+)="([^"]*)"/g;
    let d;
    while ((d = dataRe.exec(attrs))) child.dataset[camelize(d[1])] = d[2];
    const valueRe = /\svalue="([^"]*)"/.exec(attrs);
    if (valueRe) child.value = valueRe[1];
    child.parentNode = el;
    el.children.push(child);
  }
}

export class FakeElement {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = new FakeClassList();
    this._html = '';
    this.textContent = '';
    this.value = '';
    this.id = '';
    this.selectionStart = 0;
    this.scrollTop = 0;
    this.focused = false;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); parseInto(this, this._html); }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(f => f !== fn);
  }
  listenerCount(type) { return (this.listeners[type] || []).length; }
  dispatch(type, event) { (this.listeners[type] || []).forEach(fn => fn(event)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this);
  }
  contains(other) {
    let node = other;
    while (node) { if (node === this) return true; node = node.parentNode; }
    return false;
  }
  closest(selector) {
    let node = this;
    while (node) { if (matches(node, selector)) return node; node = node.parentNode; }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => node.children.forEach(child => {
      if (matches(child, selector)) out.push(child);
      walk(child);
    });
    walk(this);
    return out;
  }
  focus() { this.focused = true; document.activeElement = this; }
  blur() { this.focused = false; }
  select() {}
  setSelectionRange() {}
}

export function createElement(tag) {
  return new FakeElement(tag);
}

export function tree(specs) {
  let parent = null;
  let leaf = null;
  specs.forEach(spec => {
    const el = new FakeElement(spec.tag || 'div');
    Object.assign(el.dataset, spec.dataset || {});
    (spec.classes || []).forEach(c => el.classList.add(c));
    if (spec.id) el.id = spec.id;
    if (spec.text) el.textContent = spec.text;
    if (spec.value !== undefined) el.value = spec.value;
    if (parent) parent.appendChild(el);
    parent = el;
    leaf = el;
  });
  return leaf;
}

const windowListeners = {};

globalThis.document = {
  activeElement: null,
  documentElement: new FakeElement('html'),
  body: new FakeElement('body'),
  hidden: false,
  listeners: {},
  getElementById(id) {
    if (!registry.has(id)) {
      const el = new FakeElement('div');
      el.id = id;
      registry.set(id, el);
    }
    return registry.get(id);
  },
  createElement(tag) { return new FakeElement(tag); },
  querySelector(sel) { return this.getElementById('task-list-area').querySelector(sel); },
  querySelectorAll(sel) { return this.getElementById('task-list-area').querySelectorAll(sel); },
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
  removeEventListener() {},
  dispatch(type, event) { (this.listeners[type] || []).slice().forEach(fn => fn(event)); },
};

globalThis.window = globalThis;
globalThis.navigator = { userAgent: 'bamboo-test' };
globalThis.confirm = () => mock.confirmResult;
globalThis.prompt = () => mock.promptResult;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.addEventListener = (type, fn) => { (windowListeners[type] = windowListeners[type] || []).push(fn); };
globalThis.removeEventListener = () => {};
globalThis.dispatchWindow = (type, ev) => (windowListeners[type] || []).slice().forEach(fn => fn(ev));

globalThis.api = {
  store: {
    read: async () => (mock.stored ? JSON.parse(JSON.stringify(mock.stored)) : null),
    write: async (data) => {
      mock.writes.push(data);
      mock.stored = JSON.parse(JSON.stringify(data));
      return { ok: true };
    },
  },
  themes: { readUser: async () => [] },
  notify: async (title, body) => { mock.notifications.push(`${title}|${body}`); return true; },
  window: { show: async () => {}, getPath: async () => mock.userDataPath },
  app: {
    applySetting: (k, v) => { mock.appliedSettings.push([k, v]); },
    getVersion: async () => mock.version,
    checkUpdate: async () => {},
    quit: async () => {},
  },
  zoom: { get: () => 1, set: () => {}, in: () => {}, out: () => {}, reset: () => {} },
  onMenuAction: (cb) => { globalThis.__menuAction = cb; },
};

export const runtimeErrors = [];

process.on('unhandledRejection', (reason) => {
  runtimeErrors.push(`unhandledRejection: ${(reason && reason.stack) || reason}`);
});
process.on('uncaughtExceptionMonitor', (e) => {
  runtimeErrors.push(`uncaughtException: ${(e && e.stack) || e}`);
});

export function emitMenuAction(action, data) {
  if (globalThis.__menuAction) globalThis.__menuAction(action, data);
}
