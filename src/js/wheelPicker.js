// 仿 iPhone 闹钟的滚轮选择器（原生 JS + 纯 CSS scroll-snap）。
// 特性：CSS 原生吸附（scroll-snap-type: y mandatory）、上下渐隐（mask-image）、
//       居中高亮（selection-overlay）、无限循环、滚轮/键盘/程序化驱动。
// 关键点：吸附项绝不能使用 transform（会破坏 scroll-snap 的吸附几何，导致原生
//         滚轮位移被吸附回原位、时间无法调整），选中态只用颜色/字重/透明度。
// 滚轮为“一格一项”的程序化步进，避免原生滚轮一次跳多项与抖动；吸附仍由 CSS 完成。
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

    this._g = 0;                                   // 权威“全局项索引”
    this._active = this.count ? mod(index, this.count) : 0; // 逻辑索引
    this._activeGlobal = -1;
    this._animating = false;
    this._suppress = false;                        // 静默平移拷贝时抑制事件
    this._acc = 0;                                 // 滚轮累积量（触控板小 delta 用）
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
    return wrapIndex(this._g, this.count);
  }

  getValue() {
    return this.count ? this.values[this.getIndex()] : undefined;
  }

  setIndex(i, { animate = false } = {}) {
    if (!this.count) return;
    const target = mod(Math.round(i), this.count);
    const delta = shortestDelta(wrapIndex(this._g, this.count), target, this.count);
    this._goTo(this._g + delta, animate);
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
    // 滚轮：拦截原生滚动，改成“一格一项”的程序化步进（可精确调整、不抖动）
    this.scroller.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    // 任何滚动（含外部/触控/程序化）停止后，同步选中项并静默归位到中间拷贝
    this.scroller.addEventListener('scroll', () => this._onScroll(), { passive: true });
    this.el.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  // 初次定位：必须在元素具备布局后再设置 scrollTop（否则会被夹到 0）。
  _applyInitial(index) {
    const logical = this.count ? mod(index, this.count) : 0;
    const middleCopy = Math.floor(this.copies / 2);
    this._g = middleCopy * this.count + logical;
    const apply = () => {
      if (this._destroyed || !this.scroller) return;
      if (this.scroller.clientHeight > 0) {
        this.scroller.scrollTop = this._g * this.itemHeight;
        this._setActive(this._g);
        return;
      }
      if (this._initTries < 30 && typeof requestAnimationFrame === 'function') {
        this._initTries += 1;
        requestAnimationFrame(apply);
      }
    };
    apply();
  }

  _onWheel(e) {
    if (!this.count) return;
    e.preventDefault();
    this._acc += e.deltaY;
    if (Math.abs(this._acc) < this.itemHeight * 0.5) return; // 触控板小 delta 先累积
    const dir = this._acc > 0 ? 1 : -1;                     // 向下滚 → 索引增大
    this._acc = 0;
    this._goTo(this._g + dir, true);
  }

  _onScroll() {
    if (this._suppress) return;
    // 非本组件动画驱动的滚动（外部/触控）实时同步选中项
    if (!this._animating) {
      const g = centerIndex(this.scroller.scrollTop, this.itemHeight);
      if (g !== this._g) {
        this._g = g;
        this._setActive(g);
      }
    }
    // 滚动停止 / 吸附完成后再静默归位（节流到停止瞬间，避免中途打断）
    this._scheduleSettle(120);
  }

  _scheduleSettle(delay = 120) {
    if (this._settleTimer) clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => this._settle(), delay);
  }

  // 收尾：同步权威索引 + 高亮，并静默归位到中间拷贝
  _settle() {
    if (this._suppress || this._destroyed || !this.scroller) return;
    this._animating = false;
    const g = centerIndex(this.scroller.scrollTop, this.itemHeight);
    this._g = g;
    this._setActive(g);
    this._normalizeLoop();
  }

  _onKeyDown(e) {
    const step = e.key === 'ArrowUp' ? -1
      : e.key === 'ArrowDown' ? 1
        : e.key === 'PageUp' ? -5
          : e.key === 'PageDown' ? 5 : 0;
    if (!step) return;
    e.preventDefault();
    this._goTo(this._g + step, true);
  }

  // 权威移动：更新 _g、滚动、同步高亮；收尾统一由 _settle/_normalizeLoop 处理
  _goTo(g, animate) {
    if (!this.count) return;
    const maxG = this.copies * this.count - 1;
    this._g = Math.max(0, Math.min(maxG, g));
    this._acc = 0;
    const smooth = animate && !prefersReduced() && typeof this.scroller.scrollTo === 'function';
    if (smooth) {
      this._animating = true;
      this.scroller.scrollTo({ top: this._g * this.itemHeight, behavior: 'smooth' });
      this._scheduleSettle(400); // 兜底：即便没有 scroll 事件也能收尾
    } else {
      this.scroller.scrollTop = this._g * this.itemHeight;
      this._settle();
    }
    this._setActive(this._g);
  }

  // 无限循环：把 _g 收回中间拷贝，并按“一份拷贝”高度静默平移 scrollTop（视觉不变）。
  // 目标：_g 始终落在中间组 [n, 2n)，从根本上避免滚到数组物理末端。
  _normalizeLoop() {
    const n = this.count;
    if (!n) return;
    const copy = n * this.itemHeight;
    let shifted = 0;
    while (this._g < n) { this._g += n; shifted += copy; }
    while (this._g >= (this.copies - 1) * n) { this._g -= n; shifted -= copy; }
    if (shifted !== 0) {
      this._shiftScroll(shifted);
      this._setActive(this._g);
    }
  }

  _shiftScroll(dy) {
    this._suppress = true;
    const prev = this.scroller.style.scrollSnapType;
    this.scroller.style.scrollSnapType = 'none'; // 临时关吸附，避免平移时跳动
    this.scroller.scrollTop += dy;
    void this.scroller.offsetHeight;             // 强制回流后再恢复
    this.scroller.style.scrollSnapType = prev || '';
    this._suppress = false;
  }

  _setActive(g) {
    const n = this.count;
    if (!n || !this._items.length) return;
    const clamped = Math.max(0, Math.min(this._items.length - 1, g));
    if (this._activeGlobal !== clamped) {
      if (this._items[this._activeGlobal]) this._items[this._activeGlobal].classList.remove('active');
      this._items[clamped].classList.add('active');
      this._activeGlobal = clamped;
    }
    const logical = wrapIndex(clamped, n);
    const changed = logical !== this._active;
    this._active = logical;
    this.el.setAttribute('aria-valuetext', String(this.values[logical]));
    if (changed && this.onChange) this.onChange(logical, this.values[logical], this);
  }
}
