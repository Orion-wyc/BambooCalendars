# 代码检视缺陷清单（2026-09-19）

> 检视范围：`main.js`、`preload.js`、`src/js/*.js`、`src/themes/presets.js`、`src/index.html`、`src/css/main.css`
> 检视方式：全量静态阅读 + 关键逻辑 Node 实测复现（时区、事件递归、计数覆盖）
> 状态标记：`[ ]` 待修复 `[x]` 已修复 `[-]` 误报/不修
>
> **修复进度：BUG-01 ~ BUG-37（首轮检视）+ BUG-39 ~ BUG-52（修复过程中新发现与用户报告）全部修复完成，
> BUG-38 复核为误报。合计 51 项修复。回归用例见 `tests/`，验证记录见文末。**

---

## P0 致命（功能不可用 / 崩溃 / 数据损坏）

### BUG-01 应用无法退出
- 位置：`main.js:304-311`、`main.js:373-375`、`main.js:210`、`main.js:116`
- 现象：`close` 事件在 `requestExitConfirmation !== false`（默认 true）时 `preventDefault()` 并隐藏窗口。托盘"退出"与菜单"退出"都调用 `app.quit()`，而 `app.quit()` 同样会派发 `close` 事件 → 被拦截 → 退出流程中止。默认配置下只能杀进程。
- 修复：引入 `isQuitting` 标志，`before-quit` 置位，`close` 处理器在退出流程中放行。
- 状态：[x]

### BUG-02 `task:deselect` 无限递归导致栈溢出
- 位置：`TaskDetail.js:17-21`（`close()` 无条件 emit）、`TaskDetail.js:325-327`（监听同一事件回调 `close()`）
- 现象：实测 `RangeError: Maximum call stack size exceeded`，`close()` 被调用 1496 次，每层还触发 `App.js:83` 的整列表重渲染 → UI 卡死后抛错。触发路径：Esc、详情面板 ✕、删除选中任务（`TaskList.js:786`）。
- 修复：`close()` 增加已关闭短路判断；`task:deselect` 不再由 `close()` 反向发出。
- 状态：[x]

### BUG-03 事件监听器随渲染次数累积
- 位置：`TaskDetail.js:232`（挂在持久元素 `this.panel`，`bindDetailEvents()` 每次 `render()` 都调用）、`Settings.js:201,213`（挂在持久元素 `this.overlay`，`bindSettingsEvents()` 每次 `render()` 都调用）
- 现象：详情面板第 2 次点击子任务触发 2 个 handler，`toggleSubtask` 执行两次互相抵消 → 勾选无反应；设置面板点一次主题卡片触发 N 个 handler，每个又调 `render()` → 指数级增长直至冻结。
- 修复：委托监听在构造函数中注册一次，`render()` 只更新 DOM。
- 状态：[x]

### BUG-04 点击任务无法打开详情（事件委托只看 `e.target`）
- 位置：`TaskList.js:535-557`，尤其 `:536-537`
- 现象：`data-action="select"` 在 `.task-content` 上，但子元素 `.task-title` / `.task-meta` 铺满整个区域，点击时 `e.target` 是子元素 → `action` 为 undefined → 无响应。同问题导致"我的一天"建议项 `+` 号（`TaskList.js:373`）点不动。同文件 `:548` 的 section header 用了 `closest()`，写法不一致。
- 修复：统一 `e.target.closest('[data-action]')` 后取 dataset。
- 状态：[x]

### BUG-05 日历 / 最近 7 天日期整体错位一天
- 位置：`Store.js:434`（`getNext7Days`）、`TaskList.js:223`（日历格子）、`Store.js:444-449`（`getCalendarTasks`）、`TaskList.js:902-918`（`formatDueDate`）、`Store.js:396,415`
- 现象：本地零点 Date 调 `toISOString()` 取日期串。实测 `TZ=Asia/Shanghai`：next7 前 3 个 key 为 `2026-09-18/19/20`（应为 19 起），日历 9 月前 3 格 key 为 `2026-08-31/09-01/09-02`（应为 09-01 起）→ 所有任务在日历中晚显示一天。`TZ=America/New_York`：`getCalendarTasks(2026,8)` 对 `2026-09-01` 算出 `getMonth()=7` → 任务从 9 月日历消失；`formatDueDate('2026-09-19')` 返回 `2026/9/18`，"今天/明天"判定同步偏移。
- 根因：`dueDate` 存 `YYYY-MM-DD` 却被 `new Date()` 当 UTC 解析，与本地时区混用。
- 修复：新增 `src/js/DateUtil.js`，统一 `parseDate` / `toDateKey` / `startOfToday` / `addDays`，全部走本地时区。
- 状态：[x]

### BUG-06 store.json 结构缺失导致白屏 + 非原子写盘丢数据
- 位置：`Store.js:24-34`、`main.js:28-30`、`main.js:156-159`、`main.js:341-344`
- 现象：`load()` 直接 `this.data = saved`，不做默认值合并与字段归一化；`this.data.tasks.forEach` 在 `tasks` 缺失时抛 TypeError。主进程用 `{ settings: {} }` 作 fallback 整体写盘，首次启动点菜单"始终置顶"就会产出只含 settings 的文件 → 下次启动白屏且无法自愈。`writeFileSync` 非原子，进程崩溃会留下截断 JSON，`readJSON` 静默返回 null → 全量数据丢失。
- 修复：`load()` 深度合并默认结构 + 逐任务字段归一化；`writeJSON` 改临时文件 + `renameSync`；`App.init()` 增加加载失败兜底。
- 状态：[x]

---

## P1 严重

### BUG-07 右键菜单"编辑标题"无效
- 位置：`TaskList.js:775-776` → `TaskList.js:804`
- 现象：`startInlineEdit` 刚插入 input，`handleContextAction` 末尾的 `this.render()` 立刻把 input 冲掉。另 `document.querySelector` 返回 null 时 `item.dataset` 抛 TypeError。
- 状态：[x]

### BUG-08 任务排序方式设置无效
- 位置：`Settings.js:272-277`
- 现象：只在 click 委托里读 `sortByEl.value`（此时值尚未变更），且没有 `change` 监听 → 选择任何排序都不生效。
- 状态：[x]

### BUG-09 菜单快捷键重复注册，后者永久失效
- 位置：`main.js:90,139`（`Ctrl+Shift+N` 完成任务 / 正常模式）、`main.js:101,151`（`Ctrl+Shift+M` 我的一天 / 紧凑模式）、`main.js:103,153`（`Ctrl+Shift+P` 已计划 / 始终置顶）、`main.js:78,122`（`Ctrl+Y` 重命名清单 / `role:'redo'`）
- 现象：实测 `Ctrl+Shift+N`、`Ctrl+Shift+M`、`Ctrl+Shift+P` 各出现 2 次；`Ctrl+Y` 与 Win/Linux 默认 redo 冲突。
- 修复：正常模式 → `Ctrl+Shift+G`，紧凑模式 → `Ctrl+Shift+J`，始终置顶 → `Ctrl+Shift+O`，重命名清单 → `Ctrl+Shift+Y`，移除 `Escape` accelerator（改由渲染进程处理），同步 `App.js` 与设置页说明。
- 状态：[x]

### BUG-10 紧凑模式重启后失效
- 位置：`main.js:288-290`、`App.js:28-30`
- 现象：主进程在 `loadURL` 之后立刻 `webContents.send`，渲染进程尚未注册监听，消息被丢弃；`App.init()` 只恢复了 `sideBarHidden`，未恢复 `compactMode`。
- 状态：[x]

### BUG-11 `tags` 数组引用共享（浅拷贝）
- 位置：`Store.js:341`（`createNextOccurrence`）、`Store.js:465`（`duplicateTask`）
- 现象：`{...task}` 后 `nextTask.tags === task.tags`，给副本增删标签会同时修改原任务。
- 状态：[x]

### BUG-12 重复任务逻辑错误
- 位置：`Store.js:227-230`、`Store.js:349-369`
- 现象：勾选生成下一次实例后，再取消勾选不会回收已生成实例 → 反复勾选持续增殖；逾期很久的重复任务只 +1 天，新实例仍落在过去，形成"追赶"堆积。
- 修复：仅在 `未完成 → 完成` 的边沿生成；下次日期循环推进到今天之后。
- 状态：[x]

### BUG-13 侧边栏"任务"计数错误
- 位置：`Store.js:374-386`
- 现象：内置清单 `id:'tasks'` 的计数键覆盖了智能视图的 `tasks` 键。实测 3 个未完成任务显示为 1。
- 修复：`getCounts()` 拆分为 `{ views, lists }` 两个命名空间，同步 `Sidebar.js`。
- 状态：[x]

### BUG-14 内置"任务"清单可被删除
- 位置：`Sidebar.js:82`、`Store.js:69-73`、`Store.js:184`
- 现象：删除后 `createTask` 仍写入 `listId:'tasks'`，新任务归属悬空，详情面板清单下拉无匹配项。
- 修复：`deleteList` 拒绝内置清单；侧边栏对内置清单隐藏删除按钮。
- 状态：[x]

### BUG-15 XSS / HTML 注入
- 位置：`TaskDetail.js:42,330`（`escapeHtml` 不转义引号，用于 `value="${...}"` 可属性逃逸）、`TaskList.js:93`（清单名 + 搜索词）、`TaskList.js:453,484`（标签名）、`TaskList.js:720,741`（菜单项 label）、`Settings.js:170`（标签名裸拼进 value 属性）、`Settings.js:61`（主题名）、`Sidebar.js:294`（未判空）
- 现象：`div.textContent → innerHTML` 只转义 `& < >`，不转义引号；多处标签名/清单名/搜索词完全未转义直接拼入 innerHTML。
- 修复：`escapeHtml` 改为字符映射表（含 `"` `'`），所有插值统一转义。
- 状态：[x]

### BUG-16 侧边栏重渲染清空搜索框
- 位置：`Sidebar.js:24-28,182`、`App.js:58-69`
- 现象：任何 `task:update` 都触发 `sidebar.update()` → `renderSearch()` 重建 `#search-input`，焦点与关键词被清空，但 `taskList.searchQuery` 仍生效 → 界面与筛选状态不一致。
- 修复：搜索框只创建一次，不参与重渲染。
- 状态：[x]

### BUG-17 搜索与筛选在部分视图静默失效
- 位置：`TaskList.js:115-133`、`:176,208,318`
- 现象：已计划 / 最近 7 天 / 日历视图不走 `getTasks()`，搜索词与优先级、标签筛选完全无效；`emptyState('search')` 是死分支。
- 状态：[x]

### BUG-18 拖拽排序：`order` 字段恒为 0 且偷偷改全局设置
- 位置：`TaskList.js:815-826`、`Store.js:199,168-169`
- 现象：所有任务 `order` 均为 0，"手动排序"实际依赖数组物理顺序；一次拖拽就把用户的 `settings.sortBy` 改成 `'manual'` 且无任何提示；跨"已完成"分组、跨视图拖拽结果错乱。
- 修复：新建任务分配递增 `order`；拖拽后对全集重排 `order`；仅在 `sortBy !== 'manual'` 时切换并提示。
- 状态：[x]

### BUG-19 全局快捷键不判断输入焦点
- 位置：`App.js:220-270`
- 现象：在标题/备注输入框中按 Ctrl+B/H/G 切主题、Ctrl+D 删任务、Ctrl+Shift+D 删清单、Ctrl+1-9 跳视图。`e.key` 为 undefined 时 `toLowerCase()` 抛错。
- 修复：可编辑元素内只放行少数无害组合，并做空值保护。
- 状态：[x]

### BUG-20 无选中任务时快捷键误删第一个任务
- 位置：`TaskList.js:842-865`
- 现象：`deleteSelectedTask` 在没有选中项时自动 `selectFirstActive()` 并删除列表第一个任务（含筛选态下的第一个可见任务）。
- 修复：无选中项时直接 no-op。
- 状态：[x]

---

## P2 一般

### BUG-21 番茄钟计时不准 + 切视图被中断
- 位置：`Pomodoro.js:25-29,49-72`、`App.js:47-51`
- 现象：`setTimeout` 递归累积漂移，后台/最小化被 Chromium 节流；`start()` 直接调 `ticker()` 立刻 `remaining--`，第一秒显示 24:59；切换视图触发 `toggle()` → `stop()` 中断计时；`sessions` 不持久化、不跨零点重置。
- 修复：改为基于 `endTime` 时间戳计算，`setInterval` 只负责刷新；面板隐藏不重置计时；会话数按日期持久化。
- 状态：[x]

### BUG-22 提醒可能重复或永久漏掉
- 位置：`App.js:273-286`
- 现象：无 `notified` 标记，`setInterval` 漂移可致同一提醒重复通知；已错过的提醒（diff ≤ 0）永不触发。
- 状态：[x]

### BUG-23 自动夜间模式覆盖用户手动选择
- 位置：`Theme.js:75-85`
- 现象：白天强制 `applyMode('normal')`，冲掉用户手选的黑色/棕褐色；夜间强制 dark 冲掉 black；变更不写回 store，重启后状态分裂。
- 修复：记录进入夜间前的用户模式，白天恢复该模式；变更后持久化。
- 状态：[x]

### BUG-24 窗口状态写盘风暴 + 未校验显示器范围
- 位置：`main.js:240-260,313-314`
- 现象：`resize`/`move` 每次都 `writeFileSync` 同步写盘；恢复时不校验 x/y 是否仍在可见显示器内，换显示器后窗口开到屏幕外。
- 修复：写盘防抖；恢复前用 `screen.getAllDisplays()` 校验。
- 状态：[x]

### BUG-25 更新检查版本比较硬编码
- 位置：`main.js:45-66,293`
- 现象：`tag_name !== 'v1.0.0'` 写死，任何 tag（含更旧版本）都提示"发现新版本"；每次启动无条件联网请求 GitHub，与 README "完全离线"表述矛盾。
- 修复：用 `app.getVersion()` 做语义化比较；启动检查改为可配置，默认仅手动触发。
- 状态：[x]

### BUG-26 自定义协议处理不安全
- 位置：`main.js:357-361`
- 现象：`path.join` 未防目录穿越；未 `decodeURIComponent`，含中文/空格的路径失效；`'file://' + filePath` 在 Windows 下缺第三个斜杠。
- 修复：解析后校验前缀是否仍在 `src` 内，改用 `pathToFileURL`。
- 状态：[x]

### BUG-27 `Ctrl+1~9` 标签与实际行为不符
- 位置：`main.js:106-109`、`Sidebar.js:237-249,274-279`、`App.js:265-269`
- 现象：菜单标签写"清单 N"，实际 `_getOrderedViews()` 前 7 项是智能视图，Ctrl+1 跳到"我的一天"。
- 修复：`jumpToList(n)` 只索引真实清单。
- 状态：[x]

### BUG-28 设置页快捷键说明有误
- 位置：`Settings.js:141-147`
- 现象：写 `Ctrl/Cmd + . 打开设置`（实际 `Ctrl+,`）、`Ctrl/Cmd + Shift + = / - / 0 缩放`（实际无 Shift）；BUG-09 调整后需整体同步。
- 状态：[x]

### BUG-29 `hideCompleted` 是死配置
- 位置：`Store.js:14`、`TaskList.js:897-900`
- 现象：设置项从未被读取；菜单"隐藏已完成任务"实际只做折叠。
- 修复：移除死配置，菜单文案改为"折叠/展开已完成任务"。
- 状态：[x]

### BUG-30 保存可靠性
- 位置：`Store.js:36-41`
- 现象：100ms 防抖期间退出会丢数据；`window.api.store.write` 返回的 promise 未 catch，写盘失败静默。
- 修复：`pagehide`/`visibilitychange` 时立即 flush；write 失败上报。
- 状态：[x]

### BUG-31 内联编辑失焦静默丢弃修改
- 位置：`TaskList.js:674-687`
- 现象：blur 直接 `render()` 丢弃输入；Enter 路径先 emit 再 render，重复渲染两次。
- 修复：blur 提交修改，并做重入保护。
- 状态：[x]

### BUG-32 删除清单后详情面板残留已删任务
- 位置：`App.js:79-81`、`TaskDetail.js:23-30`
- 现象：`list:delete` 只重渲染任务列表，若详情面板正打开该清单的任务，面板继续展示已删除数据，后续 `updateTask` 静默失败。
- 状态：[x]

### BUG-33 `Ctrl+K` 无选中时操作到不相干任务
- 位置：`TaskDetail.js:285-296`
- 现象：取 `document.querySelector('.task-item')`，在"我的一天"视图第一个可能是建议项，会把不相干任务加入我的一天。
- 修复：由 `App` 统一取 `taskList.getSelectedTask()`，无选中则 no-op。
- 状态：[x]

### BUG-34 详情面板部分字段变更不刷新列表
- 位置：`TaskDetail.js:173-175,191-198`
- 现象：备注、提醒、重复方式变更后未 emit `task:update`，列表与侧边栏计数不同步。
- 状态：[x]

### BUG-35 菜单 / 托盘回调缺少窗口空指针保护
- 位置：`main.js:155-160,164,209-218,229-236`
- 现象：窗口已 closed 时 `mainWindow.setAlwaysOnTop` / `isVisible()` 抛 TypeError。
- 状态：[x]

### BUG-36 死代码与未接线功能
- 位置：`main.js:322-338`（`themes:readPresets` 正则手撕 JS 转 JSON，渲染进程实际直接 import；`window:isMaximized` 无调用方）、`Theme.js:113-122`（`saveUserTheme`/`deleteUserTheme` 无 UI 入口）、`Pomodoro.js:111`（`pomodoro:toggle` 无发射方）、`TaskList.js:764`（`handleContextAction` 第三参数 `listId` 从未传入）、`EventBus.js:19-22`（`emit` 遍历原数组，回调中 `off()` 会漏调用）、`Store.js:337`（`substr` 已废弃）
- 修复：删除无用 IPC 与未接线方法，`app:getPath` 接入关于页展示数据目录；`emit` 遍历副本；`substr` → `slice`。
- 状态：[x]

### BUG-37 设置页信息架构问题
- 位置：`Settings.js:152-194`
- 现象：标签管理放在"关于"页，而 `TaskDetail.js:78` 提示"请在设置中添加"，用户找不到入口。
- 修复：拆出独立"标签"页签。
- 状态：[x]

---

## 误报（复核后不修）

### BUG-38 `#calendar-day-detail` 缺少样式
- 复核：该元素同时带 `class="calendar-tasks-list"`（`TaskList.js:263`），CSS `main.css:1703` 已覆盖。
- 状态：[-]

---

## 修复顺序

```
P0: BUG-01 → 02 → 03 → 04 → 05 → 06
P1: BUG-07 → 20（按文件聚合，减少反复改动）
P2: BUG-21 → 37
验证：node --check 全量语法校验 + Store/DateUtil 逻辑回归脚本
```

---

## 修复过程中新增发现（同步修复）

### BUG-39 任务输入框草稿在重渲染时丢失
- 位置：`TaskList.js:96-109`（原 `renderInput`）
- 现象：`renderInput()` 每次 `render()` 都重建 `#task-input`，输入到一半时若发生任意重渲染（选中任务、切换勾选、后台更新），草稿与焦点全部丢失。
- 修复：渲染前抓取 value / focus / 光标位置，渲染后回填。
- 状态：[x]

### BUG-40 番茄钟 `start()` 用已置位的 `isRunning` 计算 `endsAt`
- 位置：`Pomodoro.js:36-46`
- 现象：`this.isRunning = true` 之后再调 `this.remainingSeconds()`，该方法走"运行中"分支读取尚未赋值的 `endsAt`（0）→ `endsAt = Date.now() + 0` → 计时器立即判定结束，番茄钟一启动就跳到休息阶段。
- 发现方式：Node 假 DOM 回归用例 `BUG-21 番茄钟启动后第一秒不跳秒` 报 "实际 0"。
- 修复：先取秒数再置 `isRunning`。
- 状态：[x]

### BUG-41 Esc 一次关闭多层浮层
- 位置：`TaskList.js`（原独立的 document Esc 监听）、`Settings.js`（原独立的 Esc 监听）、`App.js`
- 现象：三处各自监听 Escape，注册顺序导致一次 Esc 先被 TaskList 消费掉右键菜单，再被 App 判定"无菜单"而连带关闭详情面板；设置面板同理会被连带关闭。
- 修复：Esc 统一由 `App.dismissOverlays()` 分层处理（设置 → 右键菜单 → 详情面板），每次只关一层；其余模块移除各自的 Esc 监听。
- 状态：[x]

### BUG-42 托盘图标使用 512×512 大图
- 位置：`main.js:265`（原 `createTray`）
- 现象：托盘使用 `icon.png`（512×512），Linux/Windows 托盘会被缩放导致模糊。
- 修复：Windows 用 `icon.ico`，其余平台用 `icon@32.png`。
- 状态：[x]

### BUG-43 主进程与渲染进程共写 store.json 存在竞态
- 位置：`main.js:156-159,341-344`
- 现象：菜单"始终置顶"与 `menu:apply-setting` 直接读改写 store.json，与渲染进程 100ms 防抖写盘互相覆盖，极端情况下丢任务数据（也是 BUG-06 产出残缺文件的来源）。
- 修复：主进程窗口级设置独立存到 `app-state.json`，store.json 仅由渲染进程写入；首次运行时从 store.json 种子迁移。
- 状态：[x]

### BUG-44 新建任务忽略当前视图与筛选上下文
- 位置：`TaskList.js:623-635`（原 `createTaskFromInput`）
- 现象：在"重要"视图新建的任务不带星标、在"已计划/最近 7 天"新建的任务无截止日期、筛选态下新建的任务因不满足筛选条件而"凭空消失"。
- 修复：新建时继承视图语义（我的一天/重要/已计划今天）与当前优先级、标签筛选。
- 状态：[x]

### BUG-46 渲染进程缺少内容安全策略（CSP）
- 位置：`src/index.html`
- 现象：页面无 `Content-Security-Policy`，Electron 开发模式持续告警；一旦存在 BUG-15 那类注入点，
  注入的脚本可自由加载外部资源，缺少最后一道防线。
- 修复：加入 CSP meta（`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self' data:`）。保留 `style-src 'unsafe-inline'` 是因为组件大量使用
  内联 `style` 属性渲染主题色；脚本全部为外部模块文件，不需要 `unsafe-eval`。
- 发现方式：端到端测试捕获渲染进程控制台告警。
- 状态：[x]

### BUG-47 输入法合成态 Enter 被当作提交，中文任务无法输入（用户报告）
- 位置：`TaskList.js`（任务输入框 keydown、内联编辑 keydown）、`TaskDetail.js`（子任务输入框 keydown）、
  `Sidebar.js`（搜索框 Esc）、`App.js`（全局 Esc）
- 现象：所有 Enter / Esc 处理只判断 `e.key`，未判断输入法合成状态。中文用户按 Enter **确认候选词**时，
  事件同样带 `key === 'Enter'`（`isComposing: true`、`keyCode: 229`），于是：
  - 拼音被当成任务标题直接提交（实测生成任务 `"mai cai"`），输入框随即被 `value = ''` 清空并重建；
  - 用户观感即"输入框打不进字 / 无法新建任务"——每次按 Enter 选词，内容就消失一次；
  - 子任务输入框同样会把拼音提交成步骤；内联编辑会把未上屏的拼音写回标题；
    搜索框的合成态 Esc（取消候选）会连带清空关键词。
- 复现（修复前，真实 Electron）：
  ```
  场景一 合成态 Enter: {"tasksAfterImeEnter":["mai cai"],"inputValueAfter":""}
  场景三 子任务合成态 Enter: {"subtasks":["xi zao"]}
  ```
- 修复：`Utils.js` 新增 `isImeKeyEvent(e)`（`e.isComposing || e.keyCode === 229`），
  上述五处按键处理统一加守卫，合成态按键交还给输入法；
  同时 `renderInput()` 在筛选栏 HTML 未变化时不再重建输入框，
  避免重渲染打断焦点与正在进行的合成（原实现每次 `render()` 都会销毁并重建 `#task-input`）。
- 修复后：
  ```
  场景一 合成态 Enter: {"tasksAfterImeEnter":[],"inputValueAfter":"mai cai"}
  场景二 正常 Enter:   {"tasks":["买蔬菜"]}
  场景三 子任务合成态 Enter: {"subtasks":[]}
  ```
- 备注：该缺陷自首个提交即存在，非本轮修复引入；端到端用例原先以脚本直接赋值 `input.value`
  触发 Enter，绕过了输入法合成路径，因此未能发现。现已补充合成事件用例与
  `sendInputEvent` 真实键鼠用例各一组。
- 状态：[x]

### BUG-48 设置面板操作后滚动位置与焦点丢失（用户报告）
- 位置：`Settings.js:render()`、`TaskDetail.js:render()`
- 现象：切换主题、显示模式或任意开关后，设置对话框跳回顶部，用户需要重新滚动才能继续调整相邻选项。
- 根因：`render()` 用 `this.overlay.innerHTML = ...` 整体重建对话框，**滚动容器 `.settings-content`
  本身被销毁重建**，`scrollTop` 随旧节点一起消失；`document.activeElement` 也随旧节点失效，
  键盘操作（Tab 到页签/按钮后回车）每次都要重新定位。
  详情面板同理：`.detail-content` 被重建，勾选靠下的步骤后视图跳回顶部。
- 对比：`#task-list-area`、`#sidebar-lists` 自身常驻、仅替换 innerHTML，Chromium 在同一同步任务内
  重新布局，scrollTop 不受影响（实测 400 → 400），因此只有被重建的容器会跳。
- 复现（修复前，真实 Electron）：
  ```
  切换主题:       scrollTop=300 → 0   ← 跳回顶部
  切换显示模式:   scrollTop=300 → 0   ← 跳回顶部
  切换紧凑模式:   scrollTop=300 → 0   ← 跳回顶部
  切换置顶:       scrollTop=300 → 0   ← 跳回顶部
  详情面板勾步骤: scrollTop=200 → 0   ← 跳回顶部
  ```
- 修复：`Utils.js` 新增 `preserveScroll(root, selector, mutate)`、`buttonFocusKey()`、`restoreFocus()`。
  - 设置面板：同一页签内重渲染时保留 `.settings-content` 的 `scrollTop`，并把焦点还原到操作前的按钮；
    **切换页签、重新打开时仍回到顶部**（内容已变，属于预期行为）。
  - 详情面板：同一任务内重渲染保留 `.detail-content` 的 `scrollTop`；**切换到其他任务时回到顶部**。
- 修复后：
  ```
  切换主题/模式/开关: scrollTop=300 → 300  OK
  切换页签:           scrollTop → 0        OK（预期）
  重新打开:           scrollTop → 0        OK（预期）
  页签点击后焦点:     about                OK
  详情面板勾步骤:     scrollTop=150 → 150  OK
  切换到另一任务:     scrollTop → 0        OK（预期）
  ```
- 状态：[x]

### BUG-49 日历「今天」按钮文字折成两行（用户报告）
- 位置：`TaskList.js:255`（原 `<button class="btn-calendar-nav" id="cal-today">今天</button>`）、
  `main.css:1600`（`.btn-calendar-nav { width: 32px; height: 32px; font-size: 16px }`）
- 现象：「今天」按钮复用了给 `‹` `›` 箭头设计的 32×32 方形图标按钮样式，两个 16px 汉字加内边距
  远超 32px 宽度，被挤成两行并撑破按钮。
- 复现（修复前，真实 Electron）：
  ```
  今天按钮: {"行数":2,"宽":32,"高":32}
  ```
- 修复：新增 `.btn-calendar-today`（`width:auto; min-width:56px; padding:0 12px; font-size:13px;
  line-height:30px; white-space:nowrap; flex:none`），与箭头按钮共存两个 class，
  箭头按钮保持 32×32 方形不受影响。
- 修复后：`行数=1`，高度 32，`scrollWidth <= clientWidth`，宽度大于翻页按钮。
- 状态：[x]

### BUG-50 番茄钟时长固定 25/5 分钟，无法调节（用户报告）
- 位置：`Pomodoro.js:9-10`（`workDuration = 25 * 60`、`breakDuration = 5 * 60` 硬编码）
- 现象：专注与休息时长写死在构造函数里，没有任何设置入口，用户无法按自己的节奏调整。
- 复现（修复前）：`{"专注时长输入框":false,"workDuration":1500,"breakDuration":300}`，
  store 中无对应配置项。
- 修复：
  - `Store.js` 新增设置项 `pomodoroWorkMinutes`（1-180，默认 25）、`pomodoroBreakMinutes`（1-60，默认 5），
    纳入 `SETTING_KEYS` 白名单，读写与 `normalize()` 统一走 `clampSettingNumber()` 钳制，
    非法值回退默认；
  - `Pomodoro.js` 构造时 `applySettings()` 从 store 读取时长，新增 `applySettings()` /
    `minutesOf()`：**空闲时调整立即生效**（重算 `remaining` 并重绘），
    **进行中的番茄不被打断**，新时长从下一段开始生效；面板底部显示当前 `专注/休息` 时长；
  - `Settings.js` 常规页新增「番茄钟」区块（两个 number 输入，带 min/max/step），
    `change` 时写入 store、回显钳制后的值，并发 `pomodoro:settings` 事件；
    **不触发整页重渲染**，避免输入框被重建（参见 BUG-48/BUG-39）；
  - `App.js` 监听 `pomodoro:settings` → `pomodoro.applySettings()`。
- 修复后：50/10 生效、面板显示 `50:00`、9999 钳制为 180 并回显、0 钳制为 1、恢复 25/5 后显示 `25:00`。
- 状态：[x]

### BUG-51 紧凑模式下侧边栏标题溢出边界（用户报告）
- 位置：`Sidebar.js:21`（`#sidebar-user` 直接写入纯文本 `📋 Bamboo Todo`）、
  `main.css:97`、`main.css:1243`（紧凑模式 `#sidebar { width: 60px }` + `#sidebar-user { padding:12px 8px }`）
- 现象：紧凑模式把侧边栏收窄到 60px，导航项的文字都通过 `.nav-item-label { display:none }` 隐藏了，
  但标题是**裸文本节点**，没有可隐藏的子元素，"Bamboo" 单词比 44px 的内容宽度更宽，
  横向溢出侧边栏边界（`#sidebar` 没有 `overflow:hidden`，直接画到外面）。
- 复现（修复前，等待宽度过渡结束后测量）：
  ```
  紧凑模式侧边栏: {"侧边栏宽":60,"scrollWidth":64,"clientWidth":59,"文本":"📋 Bamboo Todo"}
  ```
  `scrollWidth 64 > clientWidth 59` 即内容溢出。
- 修复：标题改为 `<span class="sidebar-user-icon">📋</span><span class="sidebar-user-label">Bamboo Todo</span>`
  结构，与导航项一致；紧凑模式隐藏 `.sidebar-user-label` 只留图标并居中；
  `#sidebar-user` 补 `display:flex; overflow:hidden; white-space:nowrap`，
  `.sidebar-user-label` 补 `text-overflow:ellipsis`，常规模式过窄时也只省略号截断而不溢出。
- 修复后：常规与紧凑模式下 `scrollWidth <= clientWidth`，标题右边界不越过侧边栏。
- 备注：测量需等待 `--transition-normal: 0.3s` 的宽度过渡结束，否则读到中间值（首次实测得到 74px）。
- 状态：[x]

### BUG-52 删除步骤时详情面板滚动位置（用户报告）
- 位置：`TaskDetail.js` 的 `delete-subtask` 分支与 `render()`
- 用户报告：删除步骤会回到详情面板顶部。
- 排查结论：**该症状由 BUG-48 的修复覆盖**（BUG-48 已在 `render()` 中保留 `.detail-content` 的
  `scrollTop`）。在含 BUG-48 修复的代码上，用真实 Electron 遍历以下路径均**未复现**跳顶：
  ```
  合成点击勾选步骤:  300 → 300 OK
  合成点击删除步骤:  300 → 300 OK
  真实鼠标点击删除:  400 → 400 OK（0/50/150/400/900ms 采样均无回落）
  键盘聚焦后删除:    860 → 860 OK
  底部删除最后一步:  965 → 924（= 新的最大可滚动值，贴底跟随内容缩短，符合预期）
  连续删除 5 步:     596→555→514→473→432→391（始终贴底，无跳顶）
  窗口 1200x800 / 900x600 / 紧凑模式 × 步骤数 3~25 组合: 中部滚动全部 OK
  ```
  唯一会使位置变化的是内容缩短到不足一屏时浏览器强制钳制 `scrollTop`，此时全部内容已可见，不属于缺陷。
- 本次仍做了两处加固：
  1. `render()` 改为复用 `Utils.preserveScroll()`，与设置面板同一套实现，避免两处逻辑漂移；
     拆出 `paint()` 专职渲染，`preserveScroll(root, selector, mutate)` 包裹重建过程；
     切换到其他任务时传入 `null` 根节点，明确回到顶部。
  2. 删除步骤后把焦点交给**相邻步骤的删除按钮**（`focus({ preventScroll: true })`，不引起滚动），
     删空后落到"添加步骤"输入框。此前焦点会掉到 `body`，键盘用户连续删除多个步骤时每次都要从头 Tab。
- 回归用例：组件层 3 项 + 端到端 8 项（含真实鼠标点击，并用 `elementFromPoint` 校验确实命中按钮）。
- 状态：[x]（已修复并加固 + 用例锁定）

### BUG-45 设置项缺少白名单，脏数据可污染配置
- 位置：`Store.js:330-333`（原 `updateSettings`）
- 现象：`Object.assign(this.data.settings, updates)` 接受任意键；`settings` 缺失时直接抛错。
- 修复：`SETTING_KEYS` 白名单过滤 + 缺失时补默认结构。
- 状态：[x]

---

## 修复涉及的文件

| 文件 | 变更 | 覆盖缺陷 |
|------|------|---------|
| `main.js` | 重写窗口/菜单/托盘/协议/持久化逻辑 | 01 06 09 10 24 25 26 35 36 42 43 |
| `preload.js` | 精简 IPC 面，补齐 app 接口，缩放钳制收敛 | 36 |
| `src/js/Utils.js` | **新增**：日期（本地时区）、HTML 转义、输入法事件判定、滚动/焦点保持 | 05 15 47 48 |
| `src/js/Store.js` | 重写：结构归一化、日期、重复任务、计数、排序 | 05 06 11 12 13 14 17 18 29 30 36 45 |
| `src/js/TaskList.js` | 重写：事件委托、转义、筛选贯通、内联编辑 | 04 05 07 15 17 18 20 31 39 44 |
| `src/js/TaskDetail.js` | 重写：递归保护、监听器单次绑定、转义 | 02 03 15 32 33 34 41 |
| `src/js/Sidebar.js` | 重写：搜索框常驻、计数命名空间、内置清单保护 | 13 14 15 16 27 |
| `src/js/Settings.js` | 重写：监听器单次绑定、change 事件、标签页 | 03 08 15 28 37 |
| `src/js/Theme.js` | 重写：自动夜间不再覆盖用户选择、颜色解析健壮性 | 23 36 |
| `src/js/Pomodoro.js` | 重写：时间戳计时、会话持久化、后台不中断 | 21 40 |
| `src/js/App.js` | 重写：快捷键守卫、Esc 分层、提醒去重、启动恢复 | 10 19 22 27 30 32 33 41 |
| `src/js/EventBus.js` | emit 遍历副本 | 36 |
| `src/css/main.css` | 补充 `.cal-cell.selected`、`.task-due-date.tomorrow`、`.context-menu-item.disabled` 样式 | 05 31 |
| `src/index.html` | 加入 CSP meta | 46 |
| `src/js/{TaskList,TaskDetail,Sidebar,App}.js` | Enter/Esc 增加输入法合成态守卫；输入框按需重建 | 47 |
| `src/js/Settings.js`、`src/js/TaskDetail.js` | 重渲染保留滚动容器位置与按钮焦点 | 48 |
| `src/css/main.css`、`src/js/TaskList.js` | 日历「今天」按钮独立样式，不再复用方形图标按钮 | 49 |
| `src/js/{Store,Pomodoro,Settings,App}.js` | 番茄钟时长可配置（含钳制、空闲即时生效、进行中不打断） | 50 |
| `src/js/Sidebar.js`、`src/css/main.css` | 侧边栏标题结构化为图标+文字，紧凑模式只留图标并防溢出 | 51 |
| `src/js/TaskDetail.js` | 复用 `preserveScroll`；删除步骤后焦点移交相邻步骤 | 52 |
| `src/package.json` | **新增** `{"type":"module"}`，使 Node 可直接加载 src 下 ESM 源码用于测试 | - |
| `tests/**` | **新增** 零依赖测试套件（逻辑/组件/编排/端到端） | 全部 |
| `package.json` | 新增 `test` / `test:logic` / `test:e2e` 脚本 | - |
| `README.md` | 同步功能与数据文件说明 | 25 |

---

## 验证记录

无既有测试框架，本次以 Node 直跑 + Electron 真实渲染进程两种方式回归。

### 1. Store / Utils 逻辑回归（30 项 × 4 时区）
覆盖：结构归一化、损坏数据回退、旧版字段补齐、去重、日期 key、日历取月、已计划分组边界、
截止标签、计数命名空间、内置清单保护、tags 数组独立性、重复任务边沿与追赶、工作日/月末/闰年推进、
拖拽 order、入参校验、筛选贯通、排序、转义、番茄会话跨天、写盘失败上报。

```
TZ=Asia/Shanghai      共 30 项，失败 0 项
TZ=UTC                共 30 项，失败 0 项
TZ=America/New_York   共 30 项，失败 0 项
TZ=Pacific/Kiritimati 共 30 项，失败 0 项
```

### 2. 组件层回归（假 DOM，38 项）
覆盖：详情面板关闭不递归、面板/设置监听器不累积、子任务单次切换、标题点击命中、
右键重命名保留输入框、内联编辑提交与回退、排序 change 生效、侧边栏计数与内置清单保护、
搜索框不被重渲染清空、标签页、开关同步主进程、番茄钟计时、无选中不误删、XSS 转义。

```
共 38 项，失败 0 项
```

### 3. App 编排层回归（14 项）
覆盖：启动恢复紧凑模式/侧边栏/主题、输入框内不触发快捷键、Alt 组合不拦截、
快捷键映射（Ctrl+1-9 → 清单，Shift+M/G/J/O）、Esc 分层关闭、提醒只通知一次、
错过补发与久远静默、菜单动作分发、add-my-day 只作用选中项、删除清单关闭详情、变更落盘。

```
共 14 项，失败 0 项
```

### 4. Electron 端到端（xvfb 真实运行，106 项）
在真实 Chromium DOM 中执行完整用户流程：新建任务 → 点击标题开详情 → 加子任务并连续勾选两次 →
关闭面板 → 右键重命名 → 注入 `<img onerror>`/`<script>` 标题 → 日历"今天"格子命中 →
最近 7 天首组为今天 → 分组视图搜索 → 搜索框内容保持 → 设置面板点击只渲染一次 →
标签页增删 → 排序设置 → Esc 分层 → 输入框内快捷键抑制 → 无选中不误删 → 内置清单保护 →
拖拽 order → 番茄钟跨视图不中断。

```
共 106 项，失败 0 项
退出码: 0
```

其中 BUG-49/50/51 相关 21 项：按钮文字行数（Range.getClientRects）、按钮尺寸与溢出、
时长读写与钳制回显、面板倒计时文本、输入框不被重建、紧凑模式侧边栏宽度与标题溢出
（断言前等待 0.3s 宽度过渡结束，避免读到中间值）。

BUG-52 相关 8 项：删除按钮渲染、合成点击删除后保持滚动、焦点移交相邻步骤、贴底删除跟随内容缩短、
真实鼠标点击删除后保持滚动。真实点击用例先用 `scrollIntoView` 把目标滚入视野，再用
`document.elementFromPoint` 断言坐标确实命中 `delete-subtask`——首轮编写时坐标落在视口外
（y=875 > 视口高），点击落空却"位置未变"，差点形成假阳性。

其中 BUG-48 相关 6 项：设置内容可滚动、切换主题/开关后保持滚动位置、切换页签回到顶部、
页签点击后焦点不丢失、详情面板勾选步骤后保持滚动位置。

其中 BUG-47 相关 8 项：合成态 Enter 不提交/不清空、合成结束后中文正常提交、
以及经 `webContents.sendInputEvent` 走真实输入管道的鼠标聚焦、逐字符键入、回车建单。

### 5. 主进程端到端明细（含在上表 62 项内）
覆盖：窗口显示、resize 防抖落盘、尺寸一致、**点击关闭 → 隐藏到托盘**、菜单快捷键无重复、
Escape 不再是菜单快捷键、置顶菜单写入 app-state、渲染进程设置同步、store.json 结构完整、
取消置顶、`app://` 目录穿越被拦截（403/400）、**`app.quit()` 2ms 内正常退出**。

```
PASS  BUG-01 点击关闭 → 隐藏到托盘而非退出
PASS  BUG-01 app.quit() 正常退出（2~4ms）
PASS  BUG-09 菜单快捷键无重复 / Escape 不再是菜单快捷键
PASS  BUG-24 resize 防抖落盘 / 关闭时保存窗口状态
PASS  BUG-26 app:// 目录穿越被拦截（403），正常资源 200
PASS  BUG-43 置顶写入 app-state.json 且渲染进程同步
退出码: 0
```

> BUG-01 修复前的行为：`app.quit()` 会被 `close` 处理器 preventDefault，进程常驻，
> 冒烟脚本需靠外部 `timeout` 强杀（退出码 124）。修复后进程自主退出，退出码 0。

### 复现方式

用例已随仓库落地在 `tests/`，详见 `tests/README.md`：

```bash
npm test              # 全量：30×4 时区 + 38 组件 + 14 编排 + 106 端到端
npm run test:logic    # 仅 Node 层，约 2 秒
npm run test:e2e      # 仅 Electron 端到端（自动使用 xvfb-run）
SKIP_E2E=1 npm test   # 跳过端到端
```

全量结果：`全部 7 个测试任务通过`，退出码 0。
