(async () => {
  const results = [];
  const ok = (name, cond, extra) => results.push({
    name, pass: Boolean(cond), extra: cond ? '' : String(extra === undefined ? '' : extra),
  });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const click = (el) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  const key = (el, k, opts = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  const { store } = await import('app://./js/Store.js');
  const { eventBus } = await import('app://./js/EventBus.js');
  const U = await import('app://./js/Utils.js');
  const { app } = await import('app://./js/App.js');

  try {
    ok('启动完成，侧边栏导航已渲染', $$('#sidebar-nav .nav-item').length >= 7, $$('#sidebar-nav .nav-item').length);
    ok('启动完成，任务输入框存在', Boolean($('#task-input')));
    ok('启动完成，内置清单已渲染', $$('#sidebar-lists .list-item').length >= 1);

    const input = $('#task-input');
    input.value = '冒烟测试任务';
    key(input, 'Enter');
    await sleep(30);
    ok('回车新建任务', store.data.tasks.length === 1, store.data.tasks.length);
    ok('任务渲染到列表', $$('.task-item').length === 1, $$('.task-item').length);

    click($('.task-item .task-title'));
    await sleep(30);
    ok('BUG-04 点击任务标题打开详情面板', !$('#detail-panel').classList.contains('hidden'));
    ok('BUG-04 详情面板标题正确', $('#detail-title') && $('#detail-title').value === '冒烟测试任务');

    $('#add-subtask-input').value = '步骤一';
    click($('[data-action="add-subtask"]'));
    await sleep(30);
    ok('添加子任务', store.data.tasks[0].subtasks.length === 1);
    click($('[data-action="toggle-subtask"]'));
    await sleep(30);
    ok('BUG-03 子任务第一次点击生效', store.data.tasks[0].subtasks[0].completed === true);
    click($('[data-action="toggle-subtask"]'));
    await sleep(30);
    ok('BUG-03 子任务第二次点击可取消（无监听器累积）', store.data.tasks[0].subtasks[0].completed === false);

    let detailRenders = 0;
    const dRender = app.taskDetail.render.bind(app.taskDetail);
    app.taskDetail.render = (...a) => { detailRenders += 1; return dRender(...a); };
    click($('[data-action="toggle-subtask"]'));
    await sleep(30);
    ok('BUG-03 单次操作只渲染详情面板一次', detailRenders === 1, detailRenders);
    app.taskDetail.render = dRender;

    let thrown = null;
    try { click($('[data-action="close-detail"]')); } catch (e) { thrown = e; }
    await sleep(30);
    ok('BUG-02 关闭详情面板不抛异常', thrown === null, thrown && thrown.message);
    ok('BUG-02 详情面板已隐藏', $('#detail-panel').classList.contains('hidden'));

    $('.task-item').dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: 120, clientY: 120, view: window,
    }));
    await sleep(30);
    ok('右键菜单已弹出', Boolean($('.context-menu')));
    click($$('.context-menu > .context-menu-item').find(el => el.textContent.includes('编辑标题')));
    await sleep(30);
    const inline = $('.inline-edit-input');
    ok('BUG-07 右键「编辑标题」保留输入框', Boolean(inline));
    if (inline) {
      inline.value = '改名后的任务';
      key(inline, 'Enter');
      await sleep(30);
      ok('BUG-07 内联重命名写入成功', store.data.tasks[0].title === '改名后的任务', store.data.tasks[0].title);
    }

    window.__xss = 0;
    store.createTask({ title: '<img src=x onerror="window.__xss=1"><script>window.__xss=1<\/script>' });
    app.taskList.render();
    await sleep(60);
    ok('BUG-15 恶意标题未被执行', window.__xss === 0);
    ok('BUG-15 恶意标题未注入元素', $$('#task-list-area img').length === 0);

    const counts = store.getCounts();
    ok('BUG-13 视图计数与清单计数分离',
      counts.views.tasks === store.data.tasks.filter(t => !t.completed).length, JSON.stringify(counts.views));

    const today = U.toDateKey(new Date());
    store.updateTask(store.data.tasks[0].id, { dueDate: today });
    eventBus.emit('task:update', store.data.tasks[0].id);
    click($('#sidebar-nav [data-view="calendar"]'));
    await sleep(50);
    const todayCell = $('.cal-cell.today');
    ok('BUG-05 日历中 today 格子日期正确', todayCell && todayCell.dataset.date === today,
      todayCell && todayCell.dataset.date);
    ok('BUG-05 今天的任务显示在今天的格子里', todayCell && todayCell.classList.contains('has-tasks'));
    ok('BUG-05 日历格子含任务条目', todayCell && todayCell.querySelectorAll('.cal-task').length === 1);

    click($('#sidebar-nav [data-view="next7"]'));
    await sleep(50);
    const firstSection = $('#task-list-area .task-section');
    ok('BUG-05 最近7天第一组是今天', firstSection && firstSection.textContent.includes('今天'));
    ok('BUG-05 最近7天今天组包含该任务', firstSection && firstSection.querySelectorAll('.task-item').length === 1);

    const search = $('#search-input');
    search.value = '改名后';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    ok('BUG-17 最近7天视图支持搜索', $$('#task-list-area .task-item').length === 1);
    search.value = '不存在的关键词zzz';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    ok('BUG-17 搜索无结果显示空状态',
      Boolean($('.empty-state')) && $('.empty-state').textContent.includes('未找到'));

    search.value = '改名后';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(30);
    store.toggleImportant(store.data.tasks[0].id);
    eventBus.emit('task:update', store.data.tasks[0].id);
    await sleep(50);
    ok('BUG-16 任务更新后搜索框内容保留', $('#search-input').value === '改名后', $('#search-input').value);
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(30);

    let settingsRenders = 0;
    const sRender = app.settings.render.bind(app.settings);
    app.settings.render = (...a) => { settingsRenders += 1; return sRender(...a); };
    app.settings.open();
    await sleep(30);
    app.settings.render();
    app.settings.render();
    const before = settingsRenders;
    click($('.theme-card'));
    await sleep(50);
    ok('BUG-03 设置面板点击一次只渲染一次', settingsRenders - before === 1, settingsRenders - before);
    click($('[data-action="switch-tab"][data-tab="tags"]'));
    await sleep(30);
    ok('BUG-37 标签页存在且可切换', Boolean($('.tag-manager')) && Boolean($('#new-tag-name')));
    $('#new-tag-name').value = '工作';
    click($('[data-action="add-tag"]'));
    await sleep(30);
    ok('新增标签生效', store.getTags().length === 1 && store.getTags()[0].name === '工作');

    click($('[data-action="switch-tab"][data-tab="general"]'));
    await sleep(30);
    const sel = $('#setting-sort-by');
    sel.value = 'alpha';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(30);
    ok('BUG-08 排序方式设置生效', store.getSettings().sortBy === 'alpha', store.getSettings().sortBy);
    app.settings.close();

    app.taskDetail.open(store.data.tasks[0].id);
    app.settings.open();
    await sleep(30);
    key(document.body, 'Escape');
    await sleep(30);
    ok('BUG-41 Esc 先关闭设置面板', !app.settings.isOpen);
    ok('BUG-41 Esc 不同时关闭详情面板', app.taskDetail.isOpen());
    key(document.body, 'Escape');
    await sleep(30);
    ok('BUG-41 Esc 再关闭详情面板', !app.taskDetail.isOpen());

    let inputFocused = 0;
    const fi = app.taskList.focusInput.bind(app.taskList);
    app.taskList.focusInput = () => { inputFocused += 1; fi(); };
    key($('#search-input'), 'n', { ctrlKey: true });
    await sleep(20);
    ok('BUG-19 输入框内 Ctrl+N 不触发新建', inputFocused === 0, inputFocused);
    key(document.body, 'n', { ctrlKey: true });
    await sleep(20);
    ok('BUG-19 空白区域 Ctrl+N 触发聚焦输入框', inputFocused === 1, inputFocused);
    app.taskList.focusInput = fi;

    app.taskList.selectedTaskId = null;
    const beforeCount = store.data.tasks.length;
    app.taskList.deleteSelectedTask();
    await sleep(20);
    ok('BUG-20 无选中任务时不误删', store.data.tasks.length === beforeCount);

    ok('BUG-14 内置清单无删除按钮', $$('#sidebar-lists .list-item').every(el =>
      el.dataset.listId !== 'tasks' || !el.querySelector('.btn-delete-list')));
    ok('BUG-14 store 层拒绝删除内置清单', store.deleteList('tasks') === false);

    store.updateSettings({ sortBy: 'created' });
    const ids = store.data.tasks.map(t => t.id);
    const changed = store.reorderTask(ids[ids.length - 1], ids[0]);
    ok('BUG-18 拖拽后切换为手动排序', changed === true && store.getSettings().sortBy === 'manual');
    ok('BUG-18 order 值唯一', new Set(store.data.tasks.map(t => t.order)).size === store.data.tasks.length);
    ok('BUG-18 手动排序按 order 输出', store.getTasks({ sortBy: 'manual' })[0].id === ids[ids.length - 1]);
    store.updateSettings({ sortBy: 'created' });

    click($('#sidebar-nav [data-view="pomodoro"]'));
    await sleep(50);
    ok('番茄钟面板显示', !$('#pomodoro-panel').classList.contains('hidden'));
    ok('番茄钟有开始按钮', Boolean($('#pomo-start')));
    click($('#pomo-start'));
    await sleep(50);
    const left = app.pomodoro.remainingSeconds();
    ok('BUG-21 开始后剩余时间接近 25 分钟', left > 24 * 60 && left <= 25 * 60, left);
    ok('BUG-40 计时基于时间戳', app.pomodoro.endsAt > Date.now());
    click($('#sidebar-nav [data-view="tasks"]'));
    await sleep(50);
    ok('BUG-21 切换视图不中断计时', app.pomodoro.isRunning === true);
    app.pomodoro.stop();
  } catch (e) {
    results.push({ name: '渲染进程冒烟异常中断', pass: false, extra: String((e && e.stack) || e) });
  }

  return { results };
})();
