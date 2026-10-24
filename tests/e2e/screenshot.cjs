const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = process.env.SHOT_DIR || path.join(REPO_ROOT, 'output');
require(path.join(REPO_ROOT, 'main.js'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seedAndCapture(win) {
  const js = (code) => win.webContents.executeJavaScript(code, true);

  const counts = await js(`(async () => {
    const { store } = await import('app://./js/Store.js');
    const { app: application } = await import('app://./js/App.js');
    store.data.tasks.length = 0;

    const D = (d) => '2026-10-' + String(d).padStart(2, '0');
    const work = store.createList('产品开发');
    const study = store.createList('学习计划');
    const life = store.createList('生活杂事');
    const club = store.createList('读书会');

    const tagWork = store.createTag('工作', '#4285F4');
    const tagHome = store.createTag('家庭', '#4DB6AC');
    const tagStudy = store.createTag('学习', '#7E57C2');

    const mk = (title, opts = {}) => {
      const t = store.createTask({
        title,
        listId: opts.list || store.data.lists[0].id,
        dueDate: opts.due ? D(opts.due) : null,
        priority: opts.p || 4,
        important: Boolean(opts.star),
        inMyDay: Boolean(opts.today),
        repeat: opts.repeat || 'none',
        reminder: opts.remind || null,
        note: opts.note || '',
        tags: opts.tags || [],
      });
      if (opts.done) store.toggleComplete(t.id);
      if (opts.subs) {
        opts.subs.forEach((s, i) => {
          const sub = store.addSubtask(t.id, s[0]);
          if (s[1]) store.toggleSubtask(t.id, sub.id);
        });
      }
      return t;
    };

    mk('完成 v2.0 日历视图视觉走查', { list: work.id, due: 24, p: 1, star: true, today: true, tags: [tagWork.id] });
    mk('修复滚轮选择器在 Linux 下的惯性回弹', { list: work.id, due: 24, p: 2, tags: [tagWork.id] });
    mk('整理主题令牌文档', { list: work.id, due: 26, p: 3, today: true });
    mk('SQLite 索引与批量写入优化', { list: work.id, due: 28, p: 2, tags: [tagWork.id] });
    mk('发布 v2.0.1 更新说明', { list: work.id, due: 30, p: 4 });
    mk('排查提醒通知重复推送', { list: work.id, due: 16, p: 2, done: true });
    mk('评审快捷键重映射方案', { list: work.id, due: 20, p: 3 });
    mk('详情页卡片去壳重构', { list: work.id, due: 13, p: 3, done: true });

    mk('阅读《重构》第 4 章：构建数据流', { list: study.id, due: 21, p: 3, tags: [tagStudy.id] });
    mk('Electron 性能剖析笔记', { list: study.id, due: 25, p: 3, today: true });
    mk('复习 CSS scroll-snap 规范', { list: study.id, due: 15, p: 4, done: true });
    mk('每周五整理本周代码笔记', { list: study.id, due: 23, p: 4, repeat: 'weekly' });
    mk('精读 better-sqlite3 事务源码', { list: study.id, due: 29, p: 3, tags: [tagStudy.id] });

    mk('缴纳本月电费', { list: life.id, due: 24, p: 2, star: true, remind: '2026-10-24 09:00', tags: [tagHome.id] });
    const buy = mk('周末采购清单', { list: life.id, due: 24, p: 4, tags: [tagHome.id],
      subs: [['牛奶和燕麦', true], ['猫砂', false], ['秋葵', false]] });
    mk('预约牙科洁牙', { list: life.id, due: 27, p: 2, tags: [tagHome.id] });
    mk('给妈妈打视频电话', { list: life.id, due: 19, p: 2, star: true, tags: [tagHome.id] });
    mk('整理换季衣物', { list: life.id, due: 31, p: 4 });
    mk('报废健身房年卡', { list: life.id, due: 10, p: 4, done: true });

    mk('共读《人月神话》第 1-3 章', { list: club.id, due: 29, p: 3 });
    mk('提交本月领读小结', { list: club.id, due: 31, p: 3, tags: [tagStudy.id] });
    mk('投票确定下月书目', { list: club.id, due: 22, p: 4 });

    store.flush();
    await new Promise((r) => setTimeout(r, 300));
    application.sidebar.render();
    application.taskList.setView('calendar');
    application.taskDetail.openDay('2026-10-24', {});
    return store.data.tasks.length;
  })()`);
  console.log(`SEEDED ${counts} tasks`);
  await sleep(900);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const grab = async (name) => {
    const img = await win.webContents.capturePage();
    const p = path.join(OUT_DIR, name);
    fs.writeFileSync(p, img.toPNG());
    console.log(`SHOT ${p} ${img.getSize().width}x${img.getSize().height}`);
  };

  await grab('readme-calendar-light.png');

  await js(`(async () => {
    const { theme } = await import('app://./js/Theme.js');
    const { store } = await import('app://./js/Store.js');
    theme.apply('passion-dark');
    store.updateSettings({ theme: 'passion-dark', autoNightMode: false });
  })()`);
  await sleep(700);
  await grab('readme-calendar-dark.png');
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0];
  win.setBounds({ width: 1420, height: 920 });
  await sleep(1500);
  try {
    await seedAndCapture(win);
    console.log('SHOT_DONE');
  } catch (e) {
    console.log('SHOT_FAIL ' + ((e && e.stack) || e));
  }
  await sleep(500);
  app.exit(0);
});
