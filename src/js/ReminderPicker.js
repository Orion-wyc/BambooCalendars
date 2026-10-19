// 提醒选择器内容：日期 + 仿 iPhone 滚轮的时/分选择 + 完成/清除/取消。
// 仅负责构建浮层内容与读取值，浮层的开关/定位交给 Popover，写回交由调用方 onApply。
import { icon } from './icons.js';
import { parseDateTimeLocal, toDateKey } from './Utils.js';
import { WheelPicker } from './wheelPicker.js';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

export function buildReminderContent({ value = null, onApply = null, onClear = null, onCancel = null } = {}) {
  const parsed = value ? parseDateTimeLocal(value) : null;
  const now = new Date();
  const base = parsed || now;

  const wrap = document.createElement('div');
  wrap.className = 'reminder-picker';
  wrap.innerHTML = `
    <div class="reminder-picker__date">
      <span class="reminder-picker__label">${icon('calendar', { size: 14 })}<span>日期</span></span>
      <input type="date" class="reminder-picker__date-input" value="${toDateKey(base)}">
    </div>
    <div class="reminder-picker__time">
      <div class="reminder-picker__col">
        <div class="reminder-picker__col-label">时</div>
        <div class="reminder-picker__wheel" data-wheel="hour"></div>
      </div>
      <div class="reminder-picker__sep">:</div>
      <div class="reminder-picker__col">
        <div class="reminder-picker__col-label">分</div>
        <div class="reminder-picker__wheel" data-wheel="minute"></div>
      </div>
    </div>
    <div class="reminder-picker__footer">
      <button type="button" class="rp-btn rp-btn--ghost" data-role="clear">清除</button>
      <div class="reminder-picker__footer-right">
        <button type="button" class="rp-btn rp-btn--ghost" data-role="cancel">取消</button>
        <button type="button" class="rp-btn rp-btn--primary" data-role="ok">完成</button>
      </div>
    </div>
  `;

  const hourWheel = new WheelPicker({ values: HOURS, index: base.getHours(), rows: 5, itemHeight: 40, ariaLabel: '小时' });
  const minuteWheel = new WheelPicker({ values: MINUTES, index: base.getMinutes(), rows: 5, itemHeight: 40, ariaLabel: '分钟' });
  wrap.querySelector('[data-wheel="hour"]').appendChild(hourWheel.el);
  wrap.querySelector('[data-wheel="minute"]').appendChild(minuteWheel.el);

  const dateInput = wrap.querySelector('.reminder-picker__date-input');
  wrap.querySelector('[data-role="clear"]').addEventListener('click', () => { if (onClear) onClear(); });
  wrap.querySelector('[data-role="cancel"]').addEventListener('click', () => { if (onCancel) onCancel(); });
  wrap.querySelector('[data-role="ok"]').addEventListener('click', () => {
    const day = dateInput.value;
    if (!day) { if (onCancel) onCancel(); return; }
    if (onApply) onApply(`${day}T${hourWheel.getValue()}:${minuteWheel.getValue()}`);
  });

  return {
    el: wrap,
    getValue: () => `${dateInput.value}T${hourWheel.getValue()}:${minuteWheel.getValue()}`,
    destroy() {
      hourWheel.destroy();
      minuteWheel.destroy();
    },
  };
}
