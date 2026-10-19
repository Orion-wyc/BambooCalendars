// 仿 iPhone 闹钟的滚轮选择器（原生 JS）。
// 特性：无限循环、惯性滚动（momentum）、居中对齐（snap-to-center）、
//       上下渐隐遮罩（CSS mask）、鼠标滚轮 / 拖拽 / 键盘均可操作。
// 几何与吸附逻辑抽成纯函数（mod / snapPosition / slotLayout），便于无 DOM 单测。

export const mod = (a, n) => ((a % n) + n) % n;

// 由当前位置与释放速度推算吸附后的整数位置。
// pos：连续“值坐标”，整数对应某一项索引；
// velocity：px/ms（正=向下，负=向上）；itemHeight：单项像素高度。
// 手指向上（velocity<0）应继续增大索引，故减去 velocity 项。
// maxFling 限制惯性冲刺的项数，避免异常速度（如合成事件的极短 dt）把滚轮甩飞。
export function snapPosition(pos, velocity, itemHeight, { flingFactor = 130, minVelocity = 0.25, maxFling = 8 } = {}) {
  if (Math.abs(velocity) < minVelocity) return Math.round(pos);
  let fling = -(velocity / itemHeight) * flingFactor;
  fling = Math.max(-maxFling, Math.min(maxFling, fling));
  return Math.round(pos + fling);
}

// 生成以 pos 为中心、共 rows 个可见槽位的布局：值索引 + 相对中心的偏移（单位：项）。
export function slotLayout(pos, count, rows) {
  if (!count) return [];
  const base = Math.round(pos);
  const delta = pos - base;
  const half = Math.floor(rows / 2);
  const slots = [];
  for (let k = -half; k <= half; k += 1) {
    slots.push({ index: mod(base + k, count), offset: k - delta });
  }
  return slots;
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
  constructor({ values = [], index = 0, rows = 5, itemHeight = 40, onChange = null, ariaLabel = '' } = {}) {
    this.values = Array.isArray(values) ? values.slice() : [];
    this.count = this.values.length;
    this.rows = rows % 2 === 0 ? rows + 1 : rows; // 保持奇数，保证有正中心
    this.itemHeight = itemHeight;
    this.onChange = onChange;
    this.pos = this.count ? mod(index, this.count) : 0;
    this._lastEmitted = this.count ? mod(index, this.count) : 0;
    this._anim = null;
    this._drag = null;
    this._wheelTimer = null;
    this._slots = [];

    const el = document.createElement('div');
    el.className = 'wheel';
    el.tabIndex = 0;
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', ariaLabel || '滚动选择');
    el.style.setProperty('--wheel-row-h', `${itemHeight}px`);
    el.style.setProperty('--wheel-rows', String(this.rows));
    el.innerHTML = '<div class="wheel__slots"></div><div class="wheel__highlight" aria-hidden="true"></div>';
    this.el = el;
    this.slotsEl = el.querySelector('.wheel__slots');

    for (let i = 0; i < this.rows; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'wheel__item';
      slot.setAttribute('role', 'option');
      this.slotsEl.appendChild(slot);
      this._slots.push(slot);
    }

    this._bindEvents();
    this._render();
  }

  getIndex() {
    return this.count ? mod(Math.round(this.pos), this.count) : 0;
  }

  getValue() {
    return this.count ? this.values[this.getIndex()] : undefined;
  }

  setIndex(i, { animate = false } = {}) {
    if (!this.count) return;
    const target = mod(Math.round(i), this.count);
    if (animate && !prefersReduced()) {
      const cur = Math.round(this.pos);
      const diff = mod(target - cur, this.count);
      const wrapped = diff > this.count / 2 ? diff - this.count : diff; // 走最短路径
      this._animateTo(cur + wrapped, 0.22);
    } else {
      this._stopAnim();
      this.pos = target;
      this._render();
      this._emitChange();
    }
  }

  setValue(value) {
    const i = this.values.indexOf(value);
    if (i >= 0) this.setIndex(i, { animate: true });
  }

  destroy() {
    this._stopAnim();
    if (this._wheelTimer) clearTimeout(this._wheelTimer);
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this._slots = [];
  }

  // ---- 内部实现 ----

  _bindEvents() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    el.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    el.addEventListener('keydown', (e) => this._onKeyDown(e));
    el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  _onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    this._stopAnim();
    if (this._wheelTimer) { clearTimeout(this._wheelTimer); this._wheelTimer = null; }
    try { this.el.setPointerCapture(e.pointerId); } catch { /* 某些环境不支持，忽略 */ }
    this._drag = { id: e.pointerId, lastY: e.clientY, lastT: performance.now(), v: 0 };
    this.el.classList.add('is-dragging');
    const move = (ev) => this._onPointerMove(ev);
    const up = (ev) => {
      this._onPointerUp(ev);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  _onPointerMove(e) {
    const d = this._drag;
    if (!d || e.pointerId !== d.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const dy = e.clientY - d.lastY;
    d.v = dy / dt;
    d.lastY = e.clientY;
    d.lastT = now;
    this.pos -= dy / this.itemHeight;
    this._render();
  }

  _onPointerUp() {
    if (!this._drag) return;
    const v = this._drag.v;
    this._drag = null;
    if (this.el) this.el.classList.remove('is-dragging');
    this._settle(v);
  }

  _onWheel(e) {
    e.preventDefault();
    this._stopAnim();
    // 一格滚轮约 100px ≈ 一项；触控板的小 delta 会平滑累积
    this.pos += e.deltaY / 100;
    this._render();
    if (this._wheelTimer) clearTimeout(this._wheelTimer);
    this._wheelTimer = setTimeout(() => { this._wheelTimer = null; this._settle(0); }, 120);
  }

  _onKeyDown(e) {
    const step = e.key === 'ArrowUp' ? -1
      : e.key === 'ArrowDown' ? 1
        : e.key === 'PageUp' ? -5
          : e.key === 'PageDown' ? 5 : 0;
    if (!step) return;
    e.preventDefault();
    this._stopAnim();
    this._animateTo(Math.round(this.pos) + step, 0.18);
  }

  _settle(velocity) {
    const target = snapPosition(this.pos, velocity, this.itemHeight);
    const dist = Math.abs(target - this.pos);
    const seconds = prefersReduced() ? 0 : Math.min(0.6, (200 + dist * 45) / 1000);
    this._animateTo(target, seconds);
  }

  _animateTo(target, seconds) {
    this._stopAnim();
    const from = this.pos;
    if (seconds <= 0 || from === target) {
      this.pos = target;
      this._normalize();
      this._render();
      this._emitChange();
      return;
    }
    const t0 = performance.now();
    const dur = seconds * 1000;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - t) ** 3; // easeOutCubic
      this.pos = from + (target - from) * eased;
      this._render();
      if (t < 1) {
        this._anim = requestAnimationFrame(tick);
      } else {
        this._anim = null;
        this.pos = target;
        this._normalize();
        this._render();
        this._emitChange();
      }
    };
    this._anim = requestAnimationFrame(tick);
  }

  _stopAnim() {
    if (this._anim) {
      cancelAnimationFrame(this._anim);
      this._anim = null;
    }
  }

  // 把 pos 收进 [0, count)，防止长滚后数值无限增长（视觉不变）
  _normalize() {
    if (this.count) this.pos = mod(this.pos, this.count);
  }

  _emitChange() {
    const idx = this.getIndex();
    if (idx === this._lastEmitted) return;
    this._lastEmitted = idx;
    if (this.onChange) this.onChange(idx, this.values[idx], this);
  }

  _render() {
    if (!this.count || !this.el) return;
    const slots = slotLayout(this.pos, this.count, this.rows);
    const h = this.itemHeight;
    const centerY = (this.rows * h) / 2;
    for (let i = 0; i < slots.length; i += 1) {
      const s = slots[i];
      const el = this._slots[i];
      if (!el) continue;
      const y = centerY + s.offset * h - h / 2;
      const d = Math.min(Math.abs(s.offset), 2.5);
      const scale = 1 - d * 0.07;
      const opacity = 1 - d * 0.30;
      el.style.transform = `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
      const text = String(this.values[s.index]);
      if (el.textContent !== text) el.textContent = text;
      const isCenter = Math.abs(s.offset) < 0.5;
      el.classList.toggle('is-center', isCenter);
      el.setAttribute('aria-selected', isCenter ? 'true' : 'false');
    }
    this.el.setAttribute('aria-valuetext', String(this.values[this.getIndex()]));
  }
}
