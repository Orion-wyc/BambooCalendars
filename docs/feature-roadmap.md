# Bamboo Todo 新特性规划（2026-10）

> 基线：v2.0.0（SQLite 存储、日历点状日格 + day sheet、DateTimePicker/滚轮选择器、系统通知、番茄钟、Passion 主题、WCO Unibody、托盘、全局快捷键）。
> 本文取代 `feature-gap-analysis.md` 中的缺口判断（多数 P0/P1 项已在 v1.x–v2.0 落地），并整合 `implementation-tasks.md` 的遗留项。
> 成本标记：S ≈ 1 人日，M ≈ 2-4 人日，L ≈ 5 人以上。

## P0 任务模型补全（核心竞争力）

### 1. 回收站与撤销
- 现状：删除即物理删除（`Store.deleteTask` → 仓储层全量重写），仅编辑框有标准 Undo。
- 方案：schema v2 为 `tasks` 加 `deleted_at` 列，查询层过滤；侧边栏"回收站"入口 + 30 天自动清理；删除后 toast 提供"撤销"（可基于 Dialog 体系做轻量 toast）。子任务、清单同策略。
- 成本：M

### 2. 快速添加自然语言解析
- 现状：输入框只收纯标题；提醒/截止/重复/清单需详情页多次点击。
- 方案：输入时解析 `写周报 每周五 @21:00 #重要 @工作 !1` → repeat/reminder/tags/listId/priority；输入框下方实时预览解析结果，回车落库。解析器放 `Utils.js`，`store.createTask` 已支持全字段。
- 成本：M（Todoist/TickTick 用户的第一迁移理由）

### 3. 自定义重复规则
- 现状：固定枚举 `none/daily/weekdays/weekly/monthly/yearly`（`Store.js:19`）。
- 方案：新增 `repeat_rule` JSON 列（间隔 N 天/周/月、每月第 N 个周 X、结束日期/次数），`_advanceRepeat` 重写为规则迭代器；重复下拉加"自定义"，编辑器复用 popover + wheelPicker。
- 成本：M

### 4. 右键菜单补全
- 现状：`showContextMenu` 已有（TaskList.js:593），动作不全。
- 方案：补"移动到清单"（`store.moveTaskToList` 已就绪）、"复制任务"、"添加子任务"、"转为重复"。
- 成本：S

## P1 规划视图增强

### 5. 议程（Agenda）分组视图
- 过期/今天/明天/本周/以后 分桶。`Store.getUpcoming` 已按天分组，扩展到桶 + 侧边栏入口即可；曾被移除的"已计划"以更成熟的形态回归。
- 成本：S-M

### 6. 日历拖拽改期
- 现状：列表已有 HTML5 DnD（仅用于排序），日历格不接收。
- 方案：任务行/建议项拖到月历格 → `updateTask({dueDate})`；day sheet 内任务可拖到月历其他日期；拖拽悬停高亮目标格。与"日历是规划中心"的产品定位强协同。
- 成本：M

### 7. 周视图 / 日程条
- 月历下方增加"周"切换，7 列小时密度或当日清单复用 day sheet。
- 成本：M

### 8. 清单图标与颜色
- `lists` 表加 `icon/color` 列，侧边栏渲染 Feather 图标选择器（icons.js 已集中管理）；日历点、day sheet 头、统计图同步取色。
- 成本：S-M

### 9. 搜索增强
- 命中词高亮（`taskItem.js` 渲染时包裹 `<mark>`）、备注/子任务参与匹配；接 SQLite Phase 2 计划的 FTS5 + `tasks:query` 分页下推，数据量上万不劣化。
- 成本：M（FTS5 部分含在存储演进内）

## P2 数据安全与互操作

### 10. 备份 / 恢复
- 现状：`export-json.js` 只服务降级回旧版。
- 方案：设置页"备份"导出 zip（bamboo.db + state 文件）；"恢复"支持整库替换与按 id+updatedAt 合并两种策略；可选每日自动备份（保留 N 份，沿用 legacy 归档思路）。
- 成本：M

### 11. ICS 导入导出
- 按离线定位实现：导出 `dueDate/reminder` 为 `.ics`（VTODO/VEVENT），导入外部 ICS 转任务。无网络依赖，与日历视图形成"日程进出"闭环。
- 成本：M

### 12. 通知快速操作与贪睡
- 通知上加"完成 / 贪睡 15 分钟 / 明天提醒"按钮（Electron Notification `actions`，Linux 降级为点击窗口聚焦）；贪睡写回 `reminder`，复用 NotificationService 的去重/补发逻辑。
- 成本：S-M

### 13. 统计面板
- `writeStore` 是全量替换写，不适合追加流水；新增 append-only `facts` 表（每日完成数、过期数、番茄场次），跨日时补记。
- 视图：年度热力图（GitHub 式）、月度趋势、清单/标签分布；纯 SVG 渲染，不引图表库。
- 成本：M-L

## P3 效率整合与体验完善

### 14. 番茄钟-任务绑定（任务计时）
- 浮动面板选当前任务，session 累计到任务耗时；`stats` 与 `POMODORO_LIMITS` 已就绪，加 `task_id` 关联与详情页展示。
- 成本：S-M

### 15. 习惯打卡
- "每日打卡"型条目：完成不滚存而是累计 streak（区别于重复任务的重置逻辑）；与 P2-13 facts 表共用，月历可为习惯加密度点，形成日历第二网格。
- 成本：M

### 16. 全局快速捕获小窗
- 现状 `Ctrl+Alt+C` 仅聚焦主窗。新增无边框置顶 mini 输入窗（独立 BrowserWindow，提交走既有 store IPC），TickTick 式快捕。
- 成本：S-M

### 17. 快捷键自定义
- 持久化到 settings 表、设置页编辑 UI、冲突检测（e2e BUG-09 已有菜单重复校验可扩展）。
- 成本：M

### 18. 遗留杂项（implementation-tasks P1 汇总）
- 开机自启、启动时最小化、缩放比例持久化、更新检查周期可配置、紧凑模式按窗口尺寸自动切换、隐藏托盘图标。
- 成本：各 S

### 19. i18n 英文语言包
- 文案集中 + `electronLanguages` 扩展；出海前提。
- 成本：M

### 20. 发布工程
- CI 目前仅 Windows；补 Linux AppImage / macOS DMG 构建矩阵与签名（SmartScreen/公证）。
- 成本：M

## 不做清单（与离线单机定位冲突或性价比低）
- 云同步、共享清单、成员分配、评论协作
- 邮箱转任务、位置提醒、语音输入
- 白噪音（音频资源体积与产品定位不符）

## 建议排期
| 版本 | 内容 | 目标 |
|------|------|------|
| v2.1 | 回收站/撤销、快添加语法、自定义重复、右键菜单补全 | 任务模型闭环 |
| v2.2 | 议程视图、日历拖拽改期、清单图标颜色、通知贪睡 | "日历即规划中心" |
| v2.3 | 备份恢复、ICS 互操作、统计面板 | 数据安全与留存 |
| v2.4+ | 番茄钟绑定、习惯打卡、快捕小窗、快捷键自定义、i18n、CI 多平台 | 效率整合与出海 |
