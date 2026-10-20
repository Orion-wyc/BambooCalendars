// 统一的日期时间选择器内容：快捷 Chips（今天/明天/下周一/清除） + 月历网格 +
// 仿 iPhone 滚轮（时/分）。两种模式：
//   mode='date'      仅选日期（供“截止日期”）
//   mode='datetime'  日期 + 时间（供“提醒”）
// 只负责构建浮层内容与读取值；浮层开关/定位交给 Popover，写回由调用方处理。
import { icon } from './icons.js';
import { toDateKey, parseDateKey, startOfToday, addDays, isSameDay } from './Utils.js';
import { WheelPicker } from './wheelPicker.js';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// 严格“下一个周一”距今天的天数（今天为周一则 +7）。
export function nextMondayDelta(from) {
  const day = from.getDay();
  return ((1 - day) % 7 + 7) % 7 || 7;
}

// 生成某月的日历网格数据：42 个格子（6 行 × 7 列），含相邻月补位。
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = addDays(start, i);
    cells.push({ date: d, key: toDateKey(d), out: d.getMonth() !== month });
  }
  return cells;
}

export function buildDateTimeContent({
  mode = 'datetime',
  date = null,
  time = null,
  taskDots = null,        // (year, month) => Set<dateKey>
  onApply = null,
  onClear = null,
  onCancel = null,
} = {}) {
  const withTime = mode === 'datetime';
  const today = startOfToday();
  let selected = date ? parseDateKey(date) : null;
  const now = new Date();
  const [initH, initM] = (time || `${pad2(now.getHours())}:${pad2(now.getMinutes())}`).split(':').map(Number);
  const base = selected || today;
  let view = { y: base.getFullYear(), m: base.getMonth() };
  let dots = new Set(taskDots ? taskDots(view.y, view.m) : []);

  const wrap = document.createElement('div');
  wrap.className = `dt-picker ${withTime ? 'dt-picker--datetime' : 'dt-picker--date'}`;
  wrap.innerHTML = `
    <div class="dt-chips">
      <button type="button" class="dt-chip" data-chip="today">今天</button>
      <button type="button" class="dt-chip" data-chip="tomorrow">明天</button>
      <button type="button" class="dt-chip" data-chip="next-monday">下周一</button>
      <button type="button" class="dt-chip dt-chip--clear" data-chip="clear">清除</button>
    </div>
    <div class="dt-body">
      <div class="dt-calendar">
        <div class="dt-cal-head">
          <button type="button" class="dt-cal-nav" data-nav="-1" aria-label="上个月">${icon('chevronLeft', { size: 16 })}</button>
          <span class="dt-cal-month"></span>
          <button type="button" class="dt-cal-nav" data-nav="1" aria-label="下个月">${icon('chevronRight', { size: 16 })}</button>
        </div>
        <div class="dt-cal-week">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="dt-cal-grid" role="grid"></div>
      </div>
      <div class="dt-divider" aria-hidden="true"></div>
      <div class="dt-wheels"></div>
    </div>
    <div class="dt-footer">
      <button type="button" class="rp-btn rp-btn--ghost" data-role="clear">清除</button>
      <div class="dt-footer-right">
        <button type="button" class="rp-btn rp-btn--ghost" data-role="cancel">取消</button>
        <button type="button" class="rp-btn rp-btn--primary" data-role="ok">完成</button>
      </div>
    </div>
  `;

  const gridEl = wrap.querySelector('.dt-cal-grid');
  const monthEl = wrap.querySelector('.dt-cal-month');
  const chips = [...wrap.querySelectorAll('.dt-chip')];

  // 滚轮（仅 datetime 模式）
  let hourWheel = null;
  let minuteWheel = null;
  if (withTime) {
    hourWheel = new WheelPicker({ values: HOURS, index: initH, rows: 5, itemHeight: 40, ariaLabel: '小时' });
    minuteWheel = new WheelPicker({ values: MINUTES, index: initM, rows: 5, itemHeight: 40, ariaLabel: '分钟' });
    const wheels = wrap.querySelector('.dt-wheels');
    wheels.appendChild(hourWheel.el);
    const sep = document.createElement('div');
    sep.className = 'dt-wheels-sep';
    sep.textContent = ':';
    wheels.appendChild(sep);
    wheels.appendChild(minuteWheel.el);
  } else {
    wrap.querySelector('.dt-divider').remove();
    wrap.querySelector('.dt-wheels').remove();
  }

  function renderCalendar() {
    monthEl.textContent = `${view.y}年${view.m + 1}月`;
    gridEl.innerHTML = monthGrid(view.y, view.m).map((c) => {
      const cls = ['dt-day'];
      if (c.out) cls.push('is-out');
      if (isSameDay(c.date, today)) cls.push('is-today');
      if (selected && isSameDay(c.date, selected)) cls.push('is-selected');
      if (dots.has(c.key)) cls.push('has-dot');
      return `<button type="button" class="${cls.join(' ')}" data-date="${c.key}">${c.date.getDate()}</button>`;
    }).join('');
    gridEl.querySelectorAll('.dt-day').forEach((el) => {
      el.addEventListener('click', () => selectDate(parseDateKey(el.dataset.date)));
    });
    renderChips();
  }

  function renderChips() {
    const t = today;
    const picks = {
      today: t,
      tomorrow: addDays(t, 1),
      'next-monday': addDays(t, nextMondayDelta(t)),
    };
    chips.forEach((chip) => {
      const key = chip.dataset.chip;
      const d = picks[key];
      chip.classList.toggle('active', Boolean(d) && Boolean(selected) && isSameDay(d, selected));
    });
  }

  function selectDate(d) {
    if (!d) return;
    selected = d;
    view = { y: d.getFullYear(), m: d.getMonth() };
    renderCalendar();
  }

  function loadDots() {
    dots = new Set(taskDots ? taskDots(view.y, view.m) : []);
  }

  wrap.querySelector('.dt-cal-head').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    const delta = Number(nav.dataset.nav);
    let m = view.m + delta;
    let y = view.y;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    view = { y, m };
    loadDots();
    renderCalendar();
  });

  wrap.querySelector('.dt-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    const key = chip.dataset.chip;
    if (key === 'clear') { if (onClear) onClear(); return; }
    const t = today;
    const target = key === 'today' ? t
      : key === 'tomorrow' ? addDays(t, 1)
        : addDays(t, nextMondayDelta(t));
    loadDots();
    selectDate(target);
  });

  wrap.querySelector('[data-role="clear"]').addEventListener('click', () => { if (onClear) onClear(); });
  wrap.querySelector('[data-role="cancel"]').addEventListener('click', () => { if (onCancel) onCancel(); });
  wrap.querySelector('[data-role="ok"]').addEventListener('click', () => {
    const d = selected || today;
    const value = { date: toDateKey(d) };
    if (withTime) value.time = `${hourWheel.getValue()}:${minuteWheel.getValue()}`;
    if (onApply) onApply(value);
  });

  renderCalendar();

  return {
    el: wrap,
    getValue() {
      return {
        date: selected ? toDateKey(selected) : null,
        time: withTime ? `${hourWheel.getValue()}:${minuteWheel.getValue()}` : null,
      };
    },
    destroy() {
      if (hourWheel) hourWheel.destroy();
      if (minuteWheel) minuteWheel.destroy();
    },
  };
}
