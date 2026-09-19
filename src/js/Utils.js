const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfToday() {
  return startOfDay(new Date());
}

export function parseDateKey(key) {
  if (!key) return null;
  const text = String(key).trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

export function isValidDateKey(key) {
  return Boolean(parseDateKey(key));
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function addYears(date, years) {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.getMonth();
  d.setDate(1);
  d.setMonth(0);
  d.setFullYear(d.getFullYear() + years);
  const isFeb29 = month === 1 && day === 29;
  d.setMonth(month);
  d.setDate(isFeb29 ? 28 : day);
  return d;
}

export function diffDays(from, to) {
  return Math.round((startOfDay(from).getTime() - startOfDay(to).getTime()) / MS_PER_DAY);
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function advanceToNextWeekday(date) {
  let d = addDays(date, 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = addDays(d, 1);
  }
  return d;
}

export function formatDueDateLabel(key) {
  const date = parseDateKey(key);
  if (!date) return '';
  const today = startOfToday();
  const delta = diffDays(date, today);
  if (delta === 0) return '今天';
  if (delta === 1) return '明天';
  if (delta === -1) return '昨天';
  if (delta < 0) return '已过期';
  if (delta <= 7) return `${delta} 天后`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function formatDayLabel(key) {
  const date = parseDateKey(key);
  if (!date) return '';
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
}

export function formatWeekdayLabel(date, offset) {
  if (offset === 0) return '今天';
  if (offset === 1) return '明天';
  return date.toLocaleDateString('zh-CN', { weekday: 'long', month: 'numeric', day: 'numeric' });
}

export function parseDateTimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateTimeLocalValue(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
