import { store } from './Store.js';

const TICK_INTERVAL = 250;

export class Pomodoro {
  constructor() {
    this.panel = document.getElementById('pomodoro-panel');
    this.content = document.getElementById('pomodoro-content');
    this.workDuration = 25 * 60;
    this.breakDuration = 5 * 60;
    this.isWork = true;
    this.isRunning = false;
    this.remaining = this.workDuration;
    this.endsAt = 0;
    this.sessions = store.getPomodoroSessions();
    this.timer = null;
    this.visible = false;
    this.lastRenderedSecond = -1;
    this.applySettings();
    this.render();
    this.bindEvents();
  }

  applySettings() {
    const settings = store.getSettings();
    const work = this.minutesOf(settings.pomodoroWorkMinutes, 25);
    const rest = this.minutesOf(settings.pomodoroBreakMinutes, 5);
    if (work === this.workDuration && rest === this.breakDuration) return false;

    this.workDuration = work;
    this.breakDuration = rest;
    if (!this.isRunning) {
      this.remaining = this.duration();
      this.lastRenderedSecond = -1;
      this.render();
    }
    return true;
  }

  minutesOf(value, fallback) {
    const minutes = parseInt(value, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return fallback * 60;
    return minutes * 60;
  }

  toggle(force) {
    this.visible = force === undefined ? !this.visible : Boolean(force);
    this.panel.classList.toggle('hidden', !this.visible);
    if (this.visible) {
      this.lastRenderedSecond = -1;
      this.render();
    }
  }

  show() {
    this.toggle(true);
  }

  hide() {
    this.toggle(false);
  }

  duration() {
    return this.isWork ? this.workDuration : this.breakDuration;
  }

  remainingSeconds() {
    if (!this.isRunning) return Math.max(0, this.remaining);
    return Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
  }

  start() {
    if (this.isRunning) return;
    let seconds = this.remainingSeconds();
    if (seconds <= 0) {
      this.remaining = this.duration();
      seconds = this.remaining;
    }
    this.isRunning = true;
    this.endsAt = Date.now() + seconds * 1000;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL);
    this.lastRenderedSecond = -1;
    this.render();
  }

  pause() {
    if (!this.isRunning) return;
    this.remaining = this.remainingSeconds();
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isWork = true;
    this.remaining = this.workDuration;
    this.sessions = store.getPomodoroSessions();
    this.lastRenderedSecond = -1;
    this.render();
  }

  reset() {
    this.stop();
  }

  tick() {
    const left = this.remainingSeconds();
    if (left > 0) {
      this.updateDisplay(left);
      return;
    }
    this.completeSegment();
  }

  completeSegment() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;

    if (this.isWork) {
      this.sessions = store.addPomodoroSession();
      this.isWork = false;
      this.remaining = this.breakDuration;
      this.notify('番茄钟', `专注完成！休息 ${this.breakDuration / 60} 分钟`);
    } else {
      this.isWork = true;
      this.remaining = this.workDuration;
      this.notify('番茄钟', '休息结束，开始新的专注');
    }

    this.lastRenderedSecond = -1;
    this.render();
  }

  notify(title, body) {
    try {
      window.api.notify(title, body);
    } catch {}
  }

  updateDisplay(seconds) {
    if (!this.visible) return;
    if (seconds === this.lastRenderedSecond) return;
    this.lastRenderedSecond = seconds;
    const timeEl = this.content.querySelector('#pomo-time');
    const barEl = this.content.querySelector('#pomo-progress-bar');
    if (timeEl) timeEl.textContent = this.formatTime(seconds);
    if (barEl) barEl.style.width = `${this.progressOf(seconds)}%`;
  }

  progressOf(seconds) {
    const total = this.duration();
    if (!total) return 0;
    return Math.max(0, Math.min(100, ((total - seconds) / total) * 100));
  }

  formatTime(sec) {
    const safe = Math.max(0, Math.floor(sec));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  render() {
    if (!this.content) return;
    this.sessions = store.getPomodoroSessions();
    const seconds = this.remainingSeconds();
    this.lastRenderedSecond = seconds;
    const canContinue = seconds < this.duration();

    this.content.innerHTML = `
      <div class="pomodoro-header">🍅 番茄钟</div>
      <div class="pomodoro-label">${this.isWork ? '专注' : '休息'}</div>
      <div class="pomodoro-time ${this.isWork ? '' : 'break'}" id="pomo-time">${this.formatTime(seconds)}</div>
      <div class="pomodoro-progress">
        <div class="pomodoro-progress-bar" id="pomo-progress-bar" style="width: ${this.progressOf(seconds)}%"></div>
      </div>
      <div class="pomodoro-actions">
        ${this.isRunning
          ? `<button class="pomodoro-btn" id="pomo-pause">暂停</button>`
          : `<button class="pomodoro-btn primary" id="pomo-start">${canContinue ? '继续' : '开始'}</button>`}
        <button class="pomodoro-btn" id="pomo-stop">重置</button>
      </div>
      <div class="pomodoro-sessions">今日完成: ${this.sessions} 个</div>
      <div class="pomodoro-hint">${this.workDuration / 60} / ${this.breakDuration / 60} 分钟 · 时长可在设置中调整</div>
    `;
  }

  bindEvents() {
    this.content.addEventListener('click', (e) => {
      if (e.target.id === 'pomo-start') this.start();
      else if (e.target.id === 'pomo-pause') this.pause();
      else if (e.target.id === 'pomo-stop') this.stop();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isRunning) this.tick();
      if (!document.hidden) this.sessions = store.getPomodoroSessions();
    });
  }
}
