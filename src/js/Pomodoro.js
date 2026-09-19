import { eventBus } from './EventBus.js';

export class Pomodoro {
  constructor() {
    this.panel = document.getElementById('pomodoro-panel');
    this.content = document.getElementById('pomodoro-content');
    this.isRunning = false;
    this.isWork = true;
    this.workDuration = 25 * 60;
    this.breakDuration = 5 * 60;
    this.remaining = this.workDuration;
    this.sessions = 0;
    this.timer = null;
    this.visible = false;
    this.render();
    this.bindEvents();
  }

  toggle() {
    this.visible = !this.visible;
    this.panel.classList.toggle('hidden', !this.visible);
    if (!this.visible) this.stop();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.ticker();
  }

  pause() {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
  }

  stop() {
    this.pause();
    this.isWork = true;
    this.remaining = this.workDuration;
    this.render();
  }

  reset() {
    this.stop();
    this.sessions = 0;
    this.render();
  }

  ticker() {
    if (!this.isRunning) return;
    this.remaining--;
    this.render();

    if (this.remaining <= 0) {
      this.isRunning = false;
      if (this.isWork) {
        this.sessions++;
        if (Notification.permission !== 'granted') Notification.requestPermission();
        window.api.notify('番茄钟', `专注完成！休息 ${this.breakDuration / 60} 分钟`);
        this.isWork = false;
        this.remaining = this.breakDuration;
      } else {
        window.api.notify('番茄钟', '休息结束！开始新的专注');
        this.isWork = true;
        this.remaining = this.workDuration;
      }
      this.render();
      return;
    }

    this.timer = setTimeout(() => this.ticker(), 1000);
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  render() {
    const label = this.isWork ? '专注' : '休息';
    const progress = this.isWork
      ? (this.workDuration - this.remaining) / this.workDuration * 100
      : (this.breakDuration - this.remaining) / this.breakDuration * 100;

    this.content.innerHTML = `
      <div class="pomodoro-header">🍅 番茄钟</div>
      <div class="pomodoro-label">${label}</div>
      <div class="pomodoro-time ${!this.isWork ? 'break' : ''}">${this.formatTime(this.remaining)}</div>
      <div class="pomodoro-progress">
        <div class="pomodoro-progress-bar" style="width: ${progress}%"></div>
      </div>
      <div class="pomodoro-actions">
        ${!this.isRunning
          ? `<button class="pomodoro-btn primary" id="pomo-start">${this.remaining < (this.isWork ? this.workDuration : this.breakDuration) ? '继续' : '开始'}</button>`
          : `<button class="pomodoro-btn" id="pomo-pause">暂停</button>`
        }
        <button class="pomodoro-btn" id="pomo-stop">重置</button>
      </div>
      <div class="pomodoro-sessions">今日完成: ${this.sessions} 个</div>
    `;
  }

  bindEvents() {
    this.content.addEventListener('click', (e) => {
      if (e.target.id === 'pomo-start') this.start();
      if (e.target.id === 'pomo-pause') this.pause();
      if (e.target.id === 'pomo-stop') this.stop();
    });

    eventBus.on('pomodoro:toggle', () => this.toggle());
  }
}