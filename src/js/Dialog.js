import { escapeHtml, isImeKeyEvent } from './Utils.js';

export class Dialog {
  constructor() {
    this.overlay = document.getElementById('dialog-overlay');
    this.resolve = null;
    this.current = null;
    this.bindEvents();
  }

  isOpen() {
    return this.resolve !== null;
  }

  input(options = {}) {
    return this.open({
      title: '请输入',
      label: '',
      value: '',
      placeholder: '',
      confirmText: '确定',
      cancelText: '取消',
      allowEmpty: false,
      ...options,
      type: 'input',
    });
  }

  confirm(options = {}) {
    return this.open({
      title: '请确认',
      message: '',
      confirmText: '确定',
      cancelText: '取消',
      danger: false,
      ...options,
      type: 'confirm',
    });
  }

  open(options) {
    if (this.isOpen()) this.cancel();
    return new Promise(resolve => {
      this.resolve = resolve;
      this.current = options;
      this.render();
    });
  }

  render() {
    const o = this.current;
    if (!o) return;
    const body = o.type === 'input'
      ? `
        ${o.label ? `<div class="dialog-label">${escapeHtml(o.label)}</div>` : ''}
        <input type="text" class="dialog-input" id="dialog-input"
               value="${escapeHtml(o.value)}" placeholder="${escapeHtml(o.placeholder)}"
               autocomplete="off" spellcheck="false">
      `
      : `<div class="dialog-message">${escapeHtml(o.message)}</div>`;

    this.overlay.innerHTML = `
      <div class="dialog-modal" role="dialog" aria-modal="true">
        <div class="dialog-title">${escapeHtml(o.title)}</div>
        <div class="dialog-body">${body}</div>
        <div class="dialog-footer">
          <button class="dialog-btn" data-action="dialog-cancel">${escapeHtml(o.cancelText)}</button>
          <button class="dialog-btn primary ${o.danger ? 'danger' : ''}" data-action="dialog-ok">${escapeHtml(o.confirmText)}</button>
        </div>
      </div>
    `;
    this.overlay.classList.remove('hidden');

    const focusTarget = this.overlay.querySelector('#dialog-input')
      || this.overlay.querySelector('[data-action="dialog-ok"]');
    if (focusTarget) {
      focusTarget.focus();
      if (focusTarget.select) focusTarget.select();
    }
  }

  value() {
    const input = this.overlay.querySelector('#dialog-input');
    return input ? input.value : '';
  }

  submit() {
    if (!this.isOpen()) return;
    if (this.current.type === 'input') {
      const text = this.value().trim();
      if (!text && !this.current.allowEmpty) {
        const input = this.overlay.querySelector('#dialog-input');
        if (input) {
          input.classList.add('invalid');
          input.focus();
        }
        return;
      }
      this.finish(text);
      return;
    }
    this.finish(true);
  }

  cancel() {
    if (!this.isOpen()) return;
    this.finish(this.current.type === 'confirm' ? false : null);
  }

  finish(result) {
    const resolve = this.resolve;
    this.resolve = null;
    this.current = null;
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
    if (resolve) resolve(result);
  }

  bindEvents() {
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.cancel();
        return;
      }
      const target = e.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'dialog-ok') this.submit();
      else if (target.dataset.action === 'dialog-cancel') this.cancel();
    });

    this.overlay.addEventListener('keydown', (e) => {
      if (isImeKeyEvent(e)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
      }
    });

    this.overlay.addEventListener('input', (e) => {
      if (e.target.id === 'dialog-input') e.target.classList.remove('invalid');
    });
  }
}

export const dialog = new Dialog();
