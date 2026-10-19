// 锚定浮层（Popover）：把内容悬浮在某个锚点元素附近。
// 负责：定位（下方优先，空间不足翻到上方）、超出视口夹取、窗口缩放/滚动时重排、
//       点击外部或按 Esc 关闭。动画通过 .popover--open 类触发。
export class Popover {
  constructor() {
    this.el = null;
    this.anchor = null;
    this.onClose = null;
    this._cleanups = [];
    this._closing = null; // 正在做退出动画、尚未从 DOM 移除的旧节点
  }

  isOpen() {
    return Boolean(this.el);
  }

  open({ anchor, content, className = '', onClose = null } = {}) {
    this.close();
    // 退出动画中的旧节点立即移除，保证同一时刻只有一个浮层在 DOM 中
    if (this._closing) {
      if (this._closing.parentNode) this._closing.parentNode.removeChild(this._closing);
      this._closing = null;
    }
    const el = document.createElement('div');
    el.className = `popover ${className}`.trim();
    el.setAttribute('role', 'dialog');
    if (typeof content === 'string') el.innerHTML = content;
    else if (content) el.appendChild(content);
    document.body.appendChild(el);
    this.el = el;
    this.anchor = anchor || null;
    this.onClose = onClose;

    this._position();
    requestAnimationFrame(() => { if (this.el === el) el.classList.add('popover--open'); });

    const onPointerDown = (e) => {
      if (!this.el) return;
      if (this.el.contains(e.target)) return;
      if (this.anchor && this.anchor.contains(e.target)) return;
      this.close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    const onReflow = () => this._position();
    // 延迟挂载，避免“打开浮层的那次点击”立即被判定为外部点击
    const timer = setTimeout(() => document.addEventListener('pointerdown', onPointerDown, true), 0);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);

    this._cleanups.push(() => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    });
    return el;
  }

  close() {
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    const cb = this.onClose;
    this.onClose = null;
    this.anchor = null;
    this._cleanups.forEach((fn) => fn());
    this._cleanups = [];
    el.classList.remove('popover--open');
    this._closing = el;
    const drop = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (this._closing === el) this._closing = null;
    };
    if (typeof setTimeout === 'function') setTimeout(drop, 160);
    else drop();
    if (cb) cb();
  }

  _position() {
    if (!this.el || !this.anchor) return;
    const a = this.anchor.getBoundingClientRect();
    const p = this.el.getBoundingClientRect();
    const margin = 8;
    const gap = 8;

    let top = a.bottom + gap;
    if (top + p.height > window.innerHeight - margin && a.top - gap - p.height >= margin) {
      top = a.top - gap - p.height; // 下方放不下则翻到上方
    }
    top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - margin - p.height));

    let left = a.left;
    if (left + p.width > window.innerWidth - margin) left = window.innerWidth - margin - p.width;
    left = Math.max(margin, left);

    this.el.style.top = `${Math.round(top)}px`;
    this.el.style.left = `${Math.round(left)}px`;
  }
}
