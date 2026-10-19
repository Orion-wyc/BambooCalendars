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
    ok('启动完成，侧边栏导航已渲染', $$('#sidebar-nav .nav-item').length >= 5, $$('#sidebar-nav .nav-item').length);
    ok('已计划视图已移除', !$('#sidebar-nav [data-view="planned"]'));
    ok('番茄钟 tab 已移除，改为侧边栏按钮', !$('#sidebar-nav [data-view="pomodoro"]') && Boolean($('#btn-pomodoro')));
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
    ok('BUG-04 点击任务标题打开详情面板', app.taskDetail.isOpen() && Boolean($('#detail-panel .detail-content')));
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
    ok('BUG-02 关闭后显示占位提示', !app.taskDetail.isOpen()
      && Boolean($('.detail-empty')) && !$('.detail-content'));
    ok('BUG-02 占位提示文案正确',
      $('.detail-empty-text') && $('.detail-empty-text').textContent.includes('点击任务标题显示详情'));

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
    ok('BUG-05 日历格子含任务圆点', todayCell && todayCell.querySelectorAll('.cal-dot').length === 1);
    ok('BUG-05 圆点带任务 id 便于下钻', todayCell && todayCell.querySelector('.cal-dot')
      && Boolean(todayCell.querySelector('.cal-dot').dataset.taskId));

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

    click($('#btn-pomodoro'));
    await sleep(50);
    ok('番茄钟面板显示', !$('#pomodoro-panel').classList.contains('hidden'));
    ok('番茄钟有开始按钮', Boolean($('#pomo-start')));
    ok('番茄钟按钮高亮', $('#btn-pomodoro').classList.contains('active'));
    click($('#pomo-start'));
    await sleep(50);
    const left = app.pomodoro.remainingSeconds();
    ok('BUG-21 开始后剩余时间接近 25 分钟', left > 24 * 60 && left <= 25 * 60, left);
    ok('BUG-40 计时基于时间戳', app.pomodoro.endsAt > Date.now());
    click($('#sidebar-nav [data-view="tasks"]'));
    await sleep(50);
    ok('BUG-21 切换视图不中断计时', app.pomodoro.isRunning === true);
    ok('切换视图后番茄钟面板保持显示', !$('#pomodoro-panel').classList.contains('hidden'));
    click($('#pomo-close'));
    await sleep(50);
    ok('关闭按钮隐藏番茄钟面板', $('#pomodoro-panel').classList.contains('hidden'));
    app.pomodoro.stop();

    const ime = $('#task-input');
    ime.focus();
    ime.value = 'mai cai';
    ime.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'mai cai' }));
    ime.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 229, which: 229,
      isComposing: true, bubbles: true, cancelable: true,
    }));
    await sleep(80);
    ok('BUG-47 合成态 Enter 不创建拼音任务', !store.data.tasks.some(t => t.title === 'mai cai'));
    ok('BUG-47 合成态 Enter 不清空输入框', $('#task-input').value === 'mai cai', $('#task-input').value);
    ime.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '买菜' }));
    ime.value = '买菜';
    ime.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(100);
    ok('BUG-47 合成结束后 Enter 正常提交中文任务', store.data.tasks.some(t => t.title === '买菜'));
    ok('BUG-47 提交后输入框已清空', $('#task-input').value === '', $('#task-input').value);

    app.settings.open();
    await sleep(80);
    const scroller = $('.settings-content');
    ok('BUG-48 设置内容可滚动', scroller.scrollHeight > scroller.clientHeight,
      `${scroller.scrollHeight}/${scroller.clientHeight}`);
    scroller.scrollTop = 300;
    click($('.theme-card'));
    await sleep(80);
    ok('BUG-48 切换主题后保持滚动位置', $('.settings-content').scrollTop === 300,
      $('.settings-content').scrollTop);
    click($('[data-action="toggle-setting"][data-setting="compactMode"]'));
    await sleep(80);
    ok('BUG-48 切换开关后保持滚动位置', $('.settings-content').scrollTop === 300,
      $('.settings-content').scrollTop);
    click($('[data-action="switch-tab"][data-tab="tags"]'));
    await sleep(80);
    ok('BUG-48 切换页签回到顶部', $('.settings-content').scrollTop === 0,
      $('.settings-content').scrollTop);
    click($('[data-action="switch-tab"][data-tab="general"]'));
    await sleep(80);
    const tabFocus = await (async () => {
      $('[data-action="switch-tab"][data-tab="about"]').focus();
      $('[data-action="switch-tab"][data-tab="about"]').click();
      await sleep(80);
      return document.activeElement && document.activeElement.dataset
        ? document.activeElement.dataset.tab : document.activeElement.tagName;
    })();
    ok('BUG-48 页签点击后焦点不丢失', tabFocus === 'about', tabFocus);
    app.settings.close();
    await sleep(50);

    const detailTask = store.data.tasks[0];
    for (let i = 0; i < 20; i++) store.addSubtask(detailTask.id, `步骤${i}`);
    app.taskDetail.open(detailTask.id);
    await sleep(80);
    const detailScroller = $('.detail-content');
    detailScroller.scrollTop = 160;
    click($('[data-action="toggle-subtask"]'));
    await sleep(80);
    ok('BUG-48 详情面板勾选步骤后保持滚动位置', $('.detail-content').scrollTop === 160,
      $('.detail-content').scrollTop);
    app.taskDetail.close();

    // ---- BUG-52 删除步骤保持滚动位置 ----
    const delTask = store.createTask({ title: '删除步骤滚动' });
    for (let i = 1; i <= 20; i++) store.addSubtask(delTask.id, `步骤${i}`);
    app.taskDetail.open(delTask.id);
    await sleep(150);
    $('.detail-content').scrollTop = 300;
    await sleep(80);
    const beforeDelete = $('.detail-content').scrollTop;
    const deleteButtons = $$('[data-action="delete-subtask"]');
    ok('BUG-52 步骤删除按钮已渲染', deleteButtons.length === 20, deleteButtons.length);
    deleteButtons[3].click();
    await sleep(150);
    ok('BUG-52 删除步骤后保持滚动位置', $('.detail-content').scrollTop === beforeDelete,
      `${beforeDelete} → ${$('.detail-content').scrollTop}`);
    ok('BUG-52 删除后焦点落到相邻步骤按钮',
      document.activeElement && document.activeElement.dataset
        && document.activeElement.dataset.action === 'delete-subtask',
      document.activeElement && document.activeElement.tagName);

    const scroller2 = $('.detail-content');
    scroller2.scrollTop = scroller2.scrollHeight;
    await sleep(80);
    const tail = $$('[data-action="delete-subtask"]');
    tail[tail.length - 1].click();
    await sleep(150);
    const scroller3 = $('.detail-content');
    const maxAfter = scroller3.scrollHeight - scroller3.clientHeight;
    ok('BUG-52 贴底删除最后一步仍贴底（跟随内容缩短）',
      Math.abs(scroller3.scrollTop - maxAfter) <= 2, `${scroller3.scrollTop}/${maxAfter}`);
    app.taskDetail.close();
    await sleep(50);

    // ---- BUG-50 番茄钟时长可配置 ----
    app.settings.open();
    await sleep(80);
    const workInput = $('#setting-pomodoro-work');
    const breakInput = $('#setting-pomodoro-break');
    ok('BUG-50 设置页提供专注/休息时长输入', Boolean(workInput) && Boolean(breakInput));
    ok('BUG-50 默认时长为 25/5', workInput && workInput.value === '25' && breakInput.value === '5',
      workInput && `${workInput.value}/${breakInput.value}`);
    workInput.value = '50';
    workInput.dispatchEvent(new Event('change', { bubbles: true }));
    breakInput.value = '10';
    breakInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(100);
    ok('BUG-50 时长写入 store',
      store.getSettings().pomodoroWorkMinutes === 50 && store.getSettings().pomodoroBreakMinutes === 10,
      JSON.stringify(store.getSettings().pomodoroWorkMinutes));
    ok('BUG-50 番茄钟应用新时长',
      app.pomodoro.workDuration === 50 * 60 && app.pomodoro.breakDuration === 10 * 60,
      `${app.pomodoro.workDuration}/${app.pomodoro.breakDuration}`);
    ok('BUG-50 面板倒计时按新时长显示', $('#pomo-time').textContent === '50:00', $('#pomo-time').textContent);
    ok('BUG-50 编辑时长不重渲染设置页（焦点/输入保留）',
      $('#setting-pomodoro-work') === workInput, '输入框被重建');

    workInput.value = '9999';
    workInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(80);
    ok('BUG-50 超范围输入被钳制到上限', store.getSettings().pomodoroWorkMinutes === 180,
      store.getSettings().pomodoroWorkMinutes);
    ok('BUG-50 输入框回显钳制后的值', $('#setting-pomodoro-work').value === '180',
      $('#setting-pomodoro-work').value);
    workInput.value = '0';
    workInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(80);
    ok('BUG-50 非法输入回退到下限', store.getSettings().pomodoroWorkMinutes === 1,
      store.getSettings().pomodoroWorkMinutes);
    const reset = $('#setting-pomodoro-work');
    reset.value = '25';
    reset.dispatchEvent(new Event('change', { bubbles: true }));
    $('#setting-pomodoro-break').value = '5';
    $('#setting-pomodoro-break').dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(80);
    ok('BUG-50 恢复默认时长', app.pomodoro.workDuration === 25 * 60 && $('#pomo-time').textContent === '25:00',
      $('#pomo-time').textContent);
    app.settings.close();
    await sleep(50);

    // ---- BUG-51 紧凑模式侧边栏标题 ----
    document.documentElement.classList.remove('compact-mode');
    await sleep(400);
    const userBlock = $('#sidebar-user');
    ok('BUG-51 常规模式标题不溢出', userBlock.scrollWidth <= userBlock.clientWidth + 1,
      `${userBlock.scrollWidth}/${userBlock.clientWidth}`);
    document.documentElement.classList.add('compact-mode');
    await sleep(450);
    const sidebarRect = $('#sidebar').getBoundingClientRect();
    const userRect = $('#sidebar-user').getBoundingClientRect();
    ok('BUG-51 紧凑模式侧边栏收窄', sidebarRect.width <= 80, sidebarRect.width);
    ok('BUG-51 紧凑模式标题未超出侧边栏边界',
      userRect.right <= sidebarRect.right + 0.5 && userRect.left >= sidebarRect.left - 0.5,
      `user ${userRect.left.toFixed(1)}~${userRect.right.toFixed(1)} / sidebar ${sidebarRect.left.toFixed(1)}~${sidebarRect.right.toFixed(1)}`);
    ok('BUG-51 紧凑模式标题内容不溢出',
      $('#sidebar-user').scrollWidth <= $('#sidebar-user').clientWidth + 1,
      `${$('#sidebar-user').scrollWidth}/${$('#sidebar-user').clientWidth}`);
    ok('BUG-51 紧凑模式隐藏标题文字仅留图标',
      getComputedStyle($('#sidebar-user .sidebar-user-label')).display === 'none');
    document.documentElement.classList.remove('compact-mode');
    await sleep(450);

    // ---- BUG-56 侧边栏底部图标对齐 ----
    const iconCenter = (sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return { cx: b.left + b.width / 2, w: b.width };
    };
    const probeAlign = () => ({
      add: iconCenter('.btn-add-list-icon'),
      settings: iconCenter('#btn-settings .nav-item-icon'),
      nav: iconCenter('#sidebar-nav .nav-item .nav-item-icon'),
      sidebar: (() => {
        const b = document.getElementById('sidebar').getBoundingClientRect();
        return { left: b.left, width: b.width, center: b.left + b.width / 2 };
      })(),
      overflow: (() => {
        const sb = document.getElementById('sidebar');
        return sb.scrollWidth > sb.clientWidth + 1;
      })(),
    });

    document.documentElement.classList.remove('compact-mode');
    await sleep(450);
    const normalAlign = probeAlign();
    ok('BUG-56 常规模式新清单图标与设置图标对齐',
      Math.abs(normalAlign.add.cx - normalAlign.settings.cx) <= 0.5,
      `${normalAlign.add.cx} vs ${normalAlign.settings.cx}`);
    ok('BUG-56 常规模式新清单图标与导航图标对齐',
      Math.abs(normalAlign.add.cx - normalAlign.nav.cx) <= 0.5,
      `${normalAlign.add.cx} vs ${normalAlign.nav.cx}`);
    ok('BUG-56 常规模式侧边栏无横向溢出', normalAlign.overflow === false);

    document.documentElement.classList.add('compact-mode');
    await sleep(450);
    const compactAlign = probeAlign();
    ok('BUG-56 紧凑模式新清单图标与设置图标对齐',
      Math.abs(compactAlign.add.cx - compactAlign.settings.cx) <= 0.5,
      `${compactAlign.add.cx} vs ${compactAlign.settings.cx}`);
    ok('BUG-56 紧凑模式新清单加号居中（偏离侧边栏中心 ≤1px）',
      Math.abs(compactAlign.add.cx - compactAlign.sidebar.center) <= 1,
      `${compactAlign.add.cx} vs 中心 ${compactAlign.sidebar.center}`);
    ok('BUG-56 紧凑模式图标未被 flex 压缩', compactAlign.add.w >= 19,
      `宽 ${compactAlign.add.w}`);
    ok('BUG-56 紧凑模式侧边栏无横向溢出', compactAlign.overflow === false);
    document.documentElement.classList.remove('compact-mode');
    await sleep(450);

    // ---- BUG-49 日历「今天」按钮 ----
    click($('#sidebar-nav [data-view="calendar"]'));
    await sleep(200);
    const todayBtn = $('#cal-today');
    ok('BUG-49 今天按钮存在', Boolean(todayBtn));
    const btnRect = todayBtn.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(todayBtn);
    const lines = range.getClientRects().length;
    ok('BUG-49 今天按钮文字单行显示', lines === 1, `行数=${lines}`);
    ok('BUG-49 今天按钮高度正常（未撑高）', btnRect.height >= 28 && btnRect.height <= 40, btnRect.height);
    ok('BUG-49 今天按钮文字未溢出', todayBtn.scrollWidth <= todayBtn.clientWidth + 1,
      `${todayBtn.scrollWidth}/${todayBtn.clientWidth}`);
    const navRect = $('#cal-prev').getBoundingClientRect();
    ok('BUG-49 翻页按钮仍为方形图标按钮', Math.abs(navRect.width - navRect.height) < 2,
      `${navRect.width}x${navRect.height}`);
    ok('BUG-49 今天按钮比翻页按钮宽', btnRect.width > navRect.width, `${btnRect.width}/${navRect.width}`);

    // ---- 日历：点击日期→右侧当日清单→下钻单任务→返回 ----
    const calTodayCell = $('.cal-cell.today');
    const todayDateStr = calTodayCell && calTodayCell.dataset.date;
    ok('日历存在今天单元格', Boolean(calTodayCell));
    const dayPaneBefore = $('#detail-panel').getBoundingClientRect().width;
    click(calTodayCell);
    await sleep(150);
    ok('点击日期在右侧打开当日清单(day 模式)',
      app.taskDetail.isOpen() && app.taskDetail.currentTaskId === null
      && app.taskDetail.dayContext === todayDateStr,
      JSON.stringify({ open: app.taskDetail.isOpen(), day: app.taskDetail.dayContext }));
    ok('当日清单渲染在详情面板内',
      Boolean($('#detail-panel .day-sheet-add')) && Boolean($('#detail-panel .day-sheet-summary')));
    ok('当日清单不改变详情面板宽度',
      Math.abs($('#detail-panel').getBoundingClientRect().width - dayPaneBefore) <= 0.5,
      `${dayPaneBefore} → ${$('#detail-panel').getBoundingClientRect().width}`);

    const firstRow = $('#detail-panel .day-sheet-body .task-item .task-title');
    ok('当日清单含任务行', Boolean(firstRow));
    if (firstRow) {
      click(firstRow);
      await sleep(120);
      ok('二次点击任务进入单任务详情',
        app.taskDetail.isOpen() && Boolean(app.taskDetail.currentTaskId) && Boolean($('#detail-title')),
        JSON.stringify(app.taskDetail.currentTaskId));
      click($('[data-action="close-detail"]'));
      await sleep(120);
      ok('关闭单任务详情后返回当日清单（保留当日选中）',
        app.taskDetail.isOpen() && app.taskDetail.currentTaskId === null
        && app.taskDetail.dayContext === todayDateStr && Boolean($('#detail-panel .day-sheet-summary')));
    }

    const calAdd = $('[data-action="calendar-add-task"]');
    ok('当日清单仍带「新建任务」按钮', Boolean(calAdd));
    const targetDate = calAdd && calAdd.dataset.date;
    const calBefore = store.data.tasks.length;
    click(calAdd);
    await sleep(120);
    ok('日历新建任务弹出对话框', !$('#dialog-overlay').classList.contains('hidden'));
    $('#dialog-input').value = '日历任务';
    click($('[data-action="dialog-ok"]'));
    await sleep(150);
    const calCreated = store.data.tasks.find(t => t.title === '日历任务');
    ok('日历新建任务写入对应截止日期', Boolean(calCreated) && calCreated.dueDate === targetDate,
      calCreated && calCreated.dueDate);
    ok('日历新建任务数量 +1', store.data.tasks.length === calBefore + 1);
    if (calCreated) { store.deleteTask(calCreated.id); await sleep(30); }

    // 关闭当日清单→回到占位并清除日历选中
    click($('#detail-panel [data-action="close-detail"]'));
    await sleep(120);
    ok('关闭当日清单显示占位且无选中态',
      !app.taskDetail.isOpen() && Boolean($('.detail-empty')) && !$('.cal-cell.selected'));

    // ---- 详情面板：固定宽度 + 占位提示 ----
    click($('#sidebar-nav [data-view="tasks"]'));
    await sleep(100);
    app.taskDetail.close();
    await sleep(60);
    ok('未选中任务时显示占位提示',
      Boolean($('.detail-empty')) && !app.taskDetail.isOpen() && !$('.detail-content'));
    const taskItem = $$('.task-item:not(.completed)')[0] || $('.task-item');
    ok('存在可选中任务', Boolean(taskItem));
    const paneBefore = $('#detail-panel').getBoundingClientRect().width;
    const mainBefore = $('#main-content').getBoundingClientRect().width;
    click(taskItem.querySelector('.task-title'));
    await sleep(100);
    const mainAfter = $('#main-content').getBoundingClientRect().width;
    const paneAfter = $('#detail-panel').getBoundingClientRect().width;
    ok('选中任务后主视图宽度不变', Math.abs(mainBefore - mainAfter) <= 0.5, `${mainBefore} → ${mainAfter}`);
    ok('选中任务后详情面板宽度不变', Math.abs(paneBefore - paneAfter) <= 0.5, `${paneBefore} → ${paneAfter}`);
    ok('选中任务后显示详情内容', app.taskDetail.isOpen() && Boolean($('.detail-content')));
    click($('#task-list-area'));
    await sleep(100);
    ok('点击空白处关闭详情并显示占位',
      !app.taskDetail.isOpen() && Boolean($('.detail-empty')) && !$('.detail-content'));
    click($('.task-item .task-title'));
    await sleep(80);
    click($('#sidebar-nav [data-view="important"]'));
    await sleep(100);
    ok('切换页面自动关闭详情',
      !app.taskDetail.isOpen() && Boolean($('.detail-empty')));
    click($('#sidebar-nav [data-view="tasks"]'));
    await sleep(60);

    // ---- 详情：提醒滚轮浮层（仿 iPhone 时间轮） ----
    {
      const seed = $$('.task-item:not(.completed)')[0] || $('.task-item');
      click(seed.querySelector('.task-title'));
      await sleep(100);
      const taskId = app.taskDetail.currentTaskId;
      const remField = $('#detail-reminder');
      ok('提醒字段为可点击按钮', Boolean(remField) && remField.tagName === 'BUTTON');

      click(remField);
      await sleep(80);
      let pop = $('.popover--reminder');
      ok('点击提醒字段弹出浮层', Boolean(pop));
      ok('浮层含时/分两个滚轮', Boolean(pop) && pop.querySelectorAll('.wheel').length === 2);
      ok('滚轮存在居中高亮项', Boolean(pop) && Boolean(pop.querySelector('.wheel__item.is-center')));

      const hourWheel = pop.querySelectorAll('.wheel')[0];
      const before = hourWheel.getAttribute('aria-valuetext');
      const mkPtr = (type, y) => new PointerEvent(type, {
        pointerId: 1, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true, view: window,
      });
      // 缓慢上拖共 80px（40px/项 → +2 项），尾部零速位移消除惯性
      hourWheel.dispatchEvent(mkPtr('pointerdown', 100));
      await sleep(30); window.dispatchEvent(mkPtr('pointermove', 60));
      await sleep(30); window.dispatchEvent(mkPtr('pointermove', 20));
      await sleep(60); window.dispatchEvent(mkPtr('pointermove', 20));
      window.dispatchEvent(mkPtr('pointerup', 20));
      await sleep(700);
      const after = hourWheel.getAttribute('aria-valuetext');
      const expect = String((parseInt(before, 10) + 2) % 24).padStart(2, '0');
      ok('滚轮可拖拽并吸附到目标项', after === expect, `${before} → ${after}（期望 ${expect}）`);
      ok('居中高亮跟随选中项', pop.querySelector('.wheel__item.is-center')?.textContent === after,
        pop.querySelector('.wheel__item.is-center')?.textContent);

      click(pop.querySelector('[data-role="ok"]'));
      await sleep(220);
      const stored = store.data.tasks.find(x => x.id === taskId);
      ok('完成写回提醒（YYYY-MM-DDTHH:mm）',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stored.reminder || ''), stored.reminder);
      ok('完成后浮层关闭', !$('.popover--reminder'));
      ok('提醒字段显示已设置值', Boolean($('#detail-reminder')) && !$('#detail-reminder').classList.contains('is-empty'));

      click($('#detail-reminder'));
      await sleep(80);
      ok('可重新打开滚轮浮层', Boolean($('.popover--reminder')));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(240);
      ok('Esc 关闭浮层', !$('.popover--reminder'));

      click($('#detail-reminder'));
      await sleep(80);
      click($('.popover--reminder [data-role="clear"]'));
      await sleep(220);
      ok('清除按钮清空提醒', store.data.tasks.find(x => x.id === taskId).reminder === null);
      ok('清除后字段回到未设置态', $('#detail-reminder').classList.contains('is-empty'));
      app.taskDetail.close();
      await sleep(60);
    }


    const todayKey = U.toDateKey(U.startOfToday());
    click($('#sidebar-nav [data-view="calendar"]'));
    await sleep(150);
    const paneRect = $('.cal-cell.today').getBoundingClientRect();
    ok('日历窗格固定高度 76px', Math.round(paneRect.height) === 76, paneRect.height);

    const calMonthStart = app.taskList.calendarMonth;
    const capDate = U.toDateKey(new Date(calMonthStart.getFullYear(), calMonthStart.getMonth(), 24));
    const capIds = [];
    for (let i = 0; i < 8; i++) capIds.push(store.createTask({ title: `待办${i}`, dueDate: capDate, priority: 1 }).id);
    for (let i = 0; i < 4; i++) { const t = store.createTask({ title: `完成${i}`, dueDate: capDate, priority: 2 }); store.toggleComplete(t.id); capIds.push(t.id); }
    app.taskList.render();
    await sleep(120);
    const capCell = $(`.cal-cell[data-date="${capDate}"]`);
    const capDots = [...capCell.querySelectorAll('.cal-dot')];
    ok('圆点封顶两行共 10 个', capDots.length === 10, `dots=${capDots.length}`);
    ok('前 8 为未完成实心、尾部为已完成空心',
      capDots.slice(0, 8).every(d => !d.classList.contains('is-done'))
      && capDots.slice(8).every(d => d.classList.contains('is-done')));
    ok('不再出现「+N」更多标记', !capCell.querySelector('.cal-more'));
    ok('第三行固定显示 开启数|总数', capCell.querySelector('.cal-count').textContent.replace(/\s/g, '') === '8|12',
      capCell.querySelector('.cal-count').textContent);
    ok('窗格内容不溢出固定高度', capCell.scrollHeight <= capCell.clientHeight + 1,
      `${capCell.scrollHeight}/${capCell.clientHeight}`);
    capIds.forEach(id => store.deleteTask(id));
    app.taskList.render();
    await sleep(80);

    const quietDate = U.toDateKey(new Date(calMonthStart.getFullYear(), calMonthStart.getMonth(), 3));
    const quietIds = [];
    for (let i = 0; i < 4; i++) quietIds.push(store.createTask({ title: `窗格恰好${i}`, dueDate: quietDate }).id);
    app.taskList.render();
    await sleep(120);
    const quietCell = $(`.cal-cell[data-date="${quietDate}"]`);
    ok('恰好 4 个时全部以实心圆点显示', Boolean(quietCell)
      && quietCell.querySelectorAll('.cal-dot').length === 4
      && !quietCell.querySelector('.cal-dot.is-done'));
    ok('恰好 4 个计数为 4|4', quietCell.querySelector('.cal-count').textContent.replace(/\s/g, '') === '4|4',
      quietCell.querySelector('.cal-count').textContent);
    ok('恰好4个内容不溢出', Boolean(quietCell) && quietCell.scrollHeight <= quietCell.clientHeight + 1,
      quietCell && `${quietCell.scrollHeight}/${quietCell.clientHeight}`);
    quietIds.forEach(id => store.deleteTask(id));
    app.taskList.render();
    await sleep(80);

    // ---- 日历默认单页内不触发滚动条 ----
    click($('#sidebar-nav [data-view="calendar"]'));
    await sleep(150);
    const calArea = $('#task-list-area');
    ok('日历视图单页内无纵向滚动条', calArea.scrollHeight <= calArea.clientHeight + 2,
      `${calArea.scrollHeight}/${calArea.clientHeight}`);

    // ---- 主题：仅 Passion / Passion 深色 ----
    click($('#sidebar-nav [data-view="tasks"]'));
    await sleep(60);
    app.settings.open();
    await sleep(80);
    const rootVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase();
    ok('主题卡片为两个', $$('[data-action="select-theme"]').length === 2,
      $$('[data-action="select-theme"]').length);
    ok('不再提供浅色/深色入口',
      !$('[data-theme-id="light"]') && !$('[data-theme-id="dark"]'));
    click($('[data-theme-id="passion-dark"]'));
    await sleep(450);
    ok('切换Passion深色：深色表面+Passion状态色', document.documentElement.classList.contains('dark-mode')
      && getComputedStyle($('#sidebar')).backgroundColor === 'rgb(32, 32, 32)'
      && rootVar('--success-btn') === '#4db6ac' && rootVar('--on-success') === '#212121'
      && rootVar('--accent') === '#1976d2' && store.getSettings().theme === 'passion-dark',
      `${rootVar('--success-btn')}/${rootVar('--on-success')}`);
    click($('[data-theme-id="passion"]'));
    await sleep(450);
    ok('切换Passion：退出深色类并保持浅色UI', !document.documentElement.classList.contains('dark-mode')
      && getComputedStyle($('#sidebar')).backgroundColor === 'rgb(243, 243, 243)');
    ok('Passion主题色生效', rootVar('--primary') === '#4285f4' && rootVar('--accent') === '#1976d2'
      && rootVar('--success') === '#4db6ac' && rootVar('--warning') === '#ffca28'
      && rootVar('--danger') === '#ef5350',
      `${rootVar('--primary')}/${rootVar('--accent')}/${rootVar('--success')}`);
    ok('Passion文字对比度：实底蓝白字、浅状态色黑字', rootVar('--on-accent') === '#ffffff'
      && rootVar('--on-success') === '#212121' && rootVar('--on-warning') === '#212121'
      && rootVar('--on-danger') === '#212121');
    ok('Passion悬浮深色为主题深色列', rootVar('--accent-dark') === '#1565c0'
      && rootVar('--danger-dark') === '#d32f2f' && rootVar('--success-dark') === '#00897b');
    ok('Passion实底状态按钮跟随主题色', rootVar('--success-btn') === '#4db6ac'
      && rootVar('--danger-btn') === '#ef5350', `${rootVar('--success-btn')}/${rootVar('--danger-btn')}`);
    app.settings.close();
    await sleep(50);

    // ---- 通知设置：到期/提醒开关存在且可切换并持久化 ----
    app.settings.open();
    await sleep(80);
    const dueToggle = $('[data-action="toggle-setting"][data-setting="notifyDue"]');
    const remToggle = $('[data-action="toggle-setting"][data-setting="notifyReminder"]');
    ok('通知设置提供到期/提醒开关', Boolean(dueToggle) && Boolean(remToggle));
    const dueBefore = store.getSettings().notifyDue;
    if (dueToggle) { click(dueToggle); await sleep(80); }
    ok('到期开关点击后持久化', store.getSettings().notifyDue === !dueBefore,
      `${dueBefore} → ${store.getSettings().notifyDue}`);
    app.settings.close();
    await sleep(50);

    // ---- BUG-53 清单/任务增删改走应用内对话框 ----
    const dialogHidden = () => $('#dialog-overlay').classList.contains('hidden');
    const listCountBefore = store.getLists().length;
    click($('#btn-add-list'));
    await sleep(120);
    ok('BUG-53 点击「新清单」弹出对话框', !dialogHidden());
    ok('BUG-53 对话框自动聚焦输入框',
      document.activeElement && document.activeElement.id === 'dialog-input',
      document.activeElement && document.activeElement.id);

    $('#dialog-input').value = '   ';
    click($('[data-action="dialog-ok"]'));
    await sleep(80);
    ok('BUG-53 空白名称不允许提交', !dialogHidden());

    $('#dialog-input').value = '工作';
    key($('#dialog-input'), 'Enter');
    await sleep(150);
    ok('BUG-53 回车创建清单', store.getLists().length === listCountBefore + 1, store.getLists().length);
    ok('BUG-53 新清单出现在侧边栏',
      $$('#sidebar-lists .list-item').some(el => el.textContent.includes('工作')));
    ok('BUG-53 创建后对话框关闭', dialogHidden());

    const workList = store.getLists().find(l => l.name === '工作');
    ok('BUG-53 新清单带重命名/删除按钮',
      Boolean($(`.btn-rename-list[data-list-id="${workList.id}"]`)) &&
      Boolean($(`.btn-delete-list[data-list-id="${workList.id}"]`)));

    click($(`.btn-rename-list[data-list-id="${workList.id}"]`));
    await sleep(120);
    ok('BUG-53 点击重命名按钮弹出对话框并预填名称',
      !dialogHidden() && $('#dialog-input').value === '工作', $('#dialog-input').value);
    $('#dialog-input').value = '工作安排';
    click($('[data-action="dialog-ok"]'));
    await sleep(150);
    ok('BUG-53 重命名生效', store.getList(workList.id).name === '工作安排', store.getList(workList.id).name);
    ok('BUG-53 侧边栏显示新名称',
      $$('#sidebar-lists .list-item').some(el => el.textContent.includes('工作安排')));

    click($(`.btn-rename-list[data-list-id="${workList.id}"]`));
    await sleep(100);
    key($('#dialog-input'), 'Escape');
    await sleep(120);
    ok('BUG-53 Esc 取消对话框', dialogHidden());
    ok('BUG-53 取消后名称未变', store.getList(workList.id).name === '工作安排');

    click($(`.btn-delete-list[data-list-id="${workList.id}"]`));
    await sleep(120);
    ok('BUG-53 删除清单弹出确认框', !dialogHidden());
    ok('BUG-53 确认框文案含清单名',
      $('.dialog-message').textContent.includes('工作安排'), $('.dialog-message').textContent);
    click($('[data-action="dialog-cancel"]'));
    await sleep(120);
    ok('BUG-53 取消后清单保留', Boolean(store.getList(workList.id)));

    click($(`.btn-delete-list[data-list-id="${workList.id}"]`));
    await sleep(100);
    click($('[data-action="dialog-ok"]'));
    await sleep(150);
    ok('BUG-53 确认后清单被删除', store.getList(workList.id) === null);

    const victim = store.createTask({ title: '待删除任务' });
    app.taskList.selectedTaskId = victim.id;
    app.taskList.deleteSelectedTask();
    await sleep(120);
    ok('BUG-53 删除任务弹出确认框', !dialogHidden());
    click($('[data-action="dialog-cancel"]'));
    await sleep(120);
    ok('BUG-53 取消后任务保留', Boolean(store.data.tasks.find(t => t.id === victim.id)));
    app.taskList.deleteSelectedTask();
    await sleep(120);
    click($('[data-action="dialog-ok"]'));
    await sleep(150);
    ok('BUG-53 确认后任务被删除', !store.data.tasks.some(t => t.id === victim.id));
    ok('BUG-53 对话框已关闭', dialogHidden());
  } catch (e) {
    results.push({ name: '渲染进程冒烟异常中断', pass: false, extra: String((e && e.stack) || e) });
  }

  return { results };
})();
