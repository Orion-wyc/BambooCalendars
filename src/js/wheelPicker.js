// 仿 iPhone 闹钟的滚轮选择器（原生 JS + 纯 CSS scroll-snap）。
// 特性：CSS 原生吸附（scroll-snap-type: y mandatory）、原生惯性、上下渐隐
//       （mask-image）、居中高亮（selection-overlay）、无限循环。
// 与旧版的区别：不再用 transform + requestAnimationFrame 自绘惯性，惯性与吸附
// 全部交给浏览器原生滚动，逻辑更少、手感更真。
// 纯索引数学抽成纯函数（mod / centerIndex / wrapIndex / shortestDelta），便于无 DOM 单测。

export const mod = (a, n) => ((a % n) + n) % n;

// 由滚动位移换算“全局项索引”（含拷贝副本，未取模）。
export function centerIndex(scrollTop, itemHeight) {
  return Math.round(scrollTop / itemHeight);
}

// 全局索引 → 逻辑值索引（环绕）。
export function wrapIndex(globalIndex, count) {
  return count ? mod(globalIndex, count) : 0;
}

// 从 from 到 to 的最短环绕步数（用于 setIndex 走最近路径）。
export function shortestDelta(from, to, count) {
  if (!count) return 0;
  let d = mod(to - from, count);
  if (d > count / 2) d -= count;
  return d;
}

function prefersReduced() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export class WheelPicker {
  constructor({ values = [], index = 0, rows = 5, itemHeight = 40, onChange = null, ariaLabel = '', copies = 3 } = {}) {
    this.values = Array.isArray(values) ? values.slice() : [];
    this.count = this.values.length;
    this.rows = rows % 2 === 0 ? rows + 1 : rows; // 保持奇数，保证有正中心
    this.itemHeight = itemHeight;
    this.copies = Math.max(3, copies);            // 复制多份以实现无限循环
    this.onChange = onChange;

    this._active = this.count ? mod(index, this.count) : 0; // 逻辑索引
    this._activeGlobal = -1;
    this._suppress = false;                       // 静默平移拷贝时抑制事件
    this._settleTimer = null;
    this._initTries = 0;
    this._destroyed = false;

    const el = document.createElement('div');
    el.className = 'wheel';
    el.tabIndex = 0;
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', ariaLabel || '滚动选择');
    el.style.setProperty('--wheel-row-h', `${itemHeight}px`);
    el.style.setProperty('--wheel-rows', String(this.rows));

    const scroller = document.createElement('div');
    scroller.className = 'wheel__scroller';
    scroller.appendChild(this._makePad());

    this._items = [];
    const total = this.copies * this.count;
    for (let g = 0; g < total; g += 1) {
      const item = document.createElement('div');
      item.className = 'wheel__item';
      item.setAttribute('role', 'option');
      item.textContent = String(this.values[g % this.count]);
      scroller.appendChild(item);
      this._items.push(item);
    }
    scroller.appendChild(this._makePad());

    const overlay = document.createElement('div');
    overlay.className = 'selection-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    el.appendChild(scroller);
    el.appendChild(overlay);
    this.el = el;
    this.scroller = scroller;

    this._bindEvents();
    this._applyInitial(index);
  }

  getIndex() {
    if (!this.count) return 0;
    return wrapIndex(centerIndex(this.scroller.scrollTop, this.itemHeight), this.count);
  }

  getValue() {
    return this.count ? this.values[this.getIndex()] : undefined;
  }

  setIndex(i, { animate = false } = {}) {
    if (!this.count) return;
    const target = mod(Math.round(i), this.count);
    const curG = centerIndex(this.scroller.scrollTop, this.itemHeight);
    const delta = shortestDelta(wrapIndex(curG, this.count), target, this.count);
    const top = (curG + delta) * this.itemHeight;
    if (animate && !prefersReduced() && typeof this.scroller.scrollTo === 'function') {
      this.scroller.scrollTo({ top, behavior: 'smooth' });
    } else {
      this.scroller.scrollTop = top;
      this._setActive(curG + delta);
    }
  }

  setValue(value) {
    const i = this.values.indexOf(value);
    if (i >= 0) this.setIndex(i, { animate: true });
  }

  destroy() {
    this._destroyed = true;
    if (this._settleTimer) clearTimeout(this._settleTimer);
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this.scroller = null;
    this._items = [];
  }

  // ---- 内部实现 ----

  _makePad() {
    const pad = document.createElement('div');
    pad.className = 'wheel__pad';
    pad.setAttribute('aria-hidden', 'true');
    return pad;
  }

  _bindEvents() {
    this._onScroll = () => this._scheduleActive();
    this._onScrollEnd = () => this._settle();
    this.scroller.addEventListener('scroll', this._onScroll, { passive: true });
    this.scroller.addEventListener('scrollend', this._onScrollEnd);
    this.el.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  // 初次定位：必须在元素具备布局后再设置 scrollTop（否则会被夹到 0）。
  // 构造时组件可能尚未挂载，故用 rAF 重试若干帧。
  _applyInitial(index) {
    const initialLogical = this.count ? mod(index, this.count) : 0;
    const middleCopy = Math.floor(this.copies / 2);
    const initialG = middleCopy * this.count + initialLogical;
    const apply = () => {
      if (this._destroyed || !this.scroller) return;
      if (this.scroller.clientHeight > 0) {
        this.scroller.scrollTop = initialG * this.itemHeight;
        this._setActive(initialG);
        return;
      }
      if (this._initTries < 30 && typeof requestAnimationFrame === 'function') {
        this._initTries += 1;
        requestAnimationFrame(apply);
      }
    };
    apply();
  }

  _scheduleActive() {
    if (this._suppress) return;
    this._setActive(centerIndex(this.scroller.scrollTop, this.itemHeight));
    // 滚动停止后再做吸附校正与无限循环平移（无 scrollend 时同样适用）
    if (this._settleTimer) clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => this._settle(), 110);
  }

  _settle() {
    if (this._suppress || this._destroyed || !this.scroller) return;
    const g = centerIndex(this.scroller.scrollTop, this.itemHeight);
    this._setActive(g);
    this._normalizeLoop(g);
  }

  // 无限循环：当停在首/末拷贝区时，按“一份拷贝”的高度静默平移 scrollTop。
  _normalizeLoop(g) {
    const n = this.count;
    if (!n) return;
    const copyH = n * this.itemHeight;
    if (g < n) this._shiftCopy(+copyH);
    else if (g >= (this.copies - 1) * n) this._shiftCopy(-copyH);
  }

  _shiftCopy(dy) {
    this._suppress = true;
    const prev = this.scroller.style.scrollSnapType;
    this.scroller.style.scrollSnapType = 'none'; // 临时关吸附，避免平移时跳动
    this.scroller.scrollTop += dy;
    void this.scroller.offsetHeight;             // 强制回流后再恢复
    this.scroller.style.scrollSnapType = prev || '';
    this._suppress = false;
  }

  _onKeyDown(e) {
    const step = e.key === 'ArrowUp' ? -1
      : e.key === 'ArrowDown' ? 1
        : e.key === 'PageUp' ? -5
          : e.key === 'PageDown' ? 5 : 0;
    if (!step) return;
    e.preventDefault();
    this.setIndex(this.getIndex() + step, { animate: true });
  }

  _setActive(g) {
    const n = this.count;
    if (!n || !this._items.length) return;
    const clamped = Math.max(0, Math.min(this._items.length - 1, g));
    if (this._activeGlobal === clamped) return;
    if (this._items[this._activeGlobal]) this._items[this._activeGlobal].classList.remove('active');
    this._items[clamped].classList.add('active');
    this._activeGlobal = clamped;
    const logical = wrapIndex(clamped, n);
    const changed = logical !== this._active;
    this._active = logical;
    this.el.setAttribute('aria-valuetext', String(this.values[logical]));
    if (changed && this.onChange) this.onChange(logical, this.values[logical], this);
  }
}
