import { store } from './Store.js';
import { parseDateTimeLocal, toDateKey } from './Utils.js';

// 提醒到达的判定窗口（分钟级轮询），错过补发的宽限期，以及到期日当天触发时刻
const CHECK_INTERVAL_MS = 60 * 1000;
const REMINDER_WINDOW_MS = 60 * 1000;
const REMINDER_MISSED_GRACE_MS = 10 * 60 * 1000;
const DUE_TRIGGER_HOUR = 9;             // 到期当天 09:00 触发
const DUE_LATE_GRACE_MS = 12 * 3600 * 1000; // 距触发时刻超过则静默（避免久未打开后轰炸）
const DUE_SAME_DAY_GRACE_MS = 36 * 3600 * 1000; // “当天新建且当天到期”被跳过后的次日补发窗口

function timeText(date) {
  return date.toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function dayText(date) {
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export class NotificationService {
  constructor() {
    this.timer = null;
  }

  get settings() {
    return store.getSettings();
  }

  start() {
    this.stop();
    this.tick();
    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick(now = Date.now()) {
    const r = this.checkReminders(now);
    const d = this.checkDueDates(now);
    if (r || d) store.save();
  }

  // 提醒：到点或刚错过时触发一次，之后静默标记
  checkReminders(now = Date.now()) {
    const enabled = this.settings.notifyReminder !== false;
    let changed = false;
    store.data.tasks.forEach(task => {
      if (task.completed || !task.reminder || task.reminderNotified) return;
      const when = parseDateTimeLocal(task.reminder);
      if (!when) {
        task.reminderNotified = true;
        changed = true;
        return;
      }
      const diff = when.getTime() - now;
      if (diff > REMINDER_WINDOW_MS) return; // 尚未到点
      if (enabled) {
        if (diff > 0) this.notify(task, 'reminder', { when, missed: false });
        else if (-diff <= REMINDER_MISSED_GRACE_MS) this.notify(task, 'reminder', { when, missed: true });
      }
      task.reminderNotified = true;
      changed = true;
    });
    return changed;
  }

  // 到期：仅在到期当天、过了触发时刻后提示一次；历史逾期静默标记避免刷屏
  checkDueDates(now = Date.now()) {
    const enabled = this.settings.notifyDue !== false;
    let changed = false;
    const todayKey = toDateKey(new Date(now));
    store.data.tasks.forEach(task => {
      if (task.completed || !task.dueDate || task.dueNotified) return;
      if (task.dueDate > todayKey) return; // 未来日期
      const createdKey = task.createdAt ? toDateKey(new Date(task.createdAt)) : null;
      // 新建当天不触发到期通知（避免刚创建任务就弹）；次日仍会按下面的补发窗口处理
      if (createdKey === todayKey) return;
      const due = parseDateTimeLocal(`${task.dueDate}T00:00`);
      if (!due) {
        task.dueNotified = true;
        changed = true;
        return;
      }
      due.setHours(DUE_TRIGGER_HOUR, 0, 0, 0);
      const age = now - due.getTime();
      if (age < 0) return; // 到期当天但还没到触发时刻
      // “当天新建且当天到期”的任务被跳过一整天，次日用更宽的补发窗口避免永久丢失
      const sameDayCreated = createdKey && createdKey === task.dueDate;
      const grace = sameDayCreated ? DUE_SAME_DAY_GRACE_MS : DUE_LATE_GRACE_MS;
      if (enabled && age <= grace) this.notify(task, 'due', { when: due });
      task.dueNotified = true;
      changed = true;
    });
    return changed;
  }

  notify(task, kind, opts = {}) {
    const title = task.title || '未命名任务';
    if (kind === 'due') {
      window.api.notify('任务到期', `${title}（到期 ${dayText(opts.when)}）`, { tag: `due-${task.id}`, taskId: task.id });
    } else {
      const label = opts.missed ? '任务提醒（已错过）' : '任务提醒';
      window.api.notify(label, `${title} - ${timeText(opts.when)}`, { tag: `reminder-${task.id}`, taskId: task.id });
    }
  }
}

export const notificationService = new NotificationService();
