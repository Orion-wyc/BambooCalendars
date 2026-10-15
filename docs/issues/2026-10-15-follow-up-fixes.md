# 缺陷修复记录（2026-10-15）

> 检视范围：`0c32679`（Passion 主题）之前的未提交改动 + 主题体系重构（`d451296`、`e66fed9`、`0c32679`）涉及文件
> 检视方式：人工检视意见（5 条）逐条复核 + 测试盲区补强；编号延续 `2026-09-19-code-review.md`（BUG-57 起）
> 状态标记：`[x]` 已修复 `[-]` 误报/不修

---

## P1 功能性缺陷

### BUG-57 子任务勾选框字号被误删（重构回归）
- 位置：`src/css/main.css:885`（`.subtask-checkbox.checked`）
- 现象：主题令牌重构（`e66fed9`）将 `color: white` 替换为 `color: var(--on-accent)` 时，连带删除了 `font-size: 12px`。`.subtask-checkbox` 为 18×18（含 2px 边框，内容区 14×14），`✓` 继承 body 字号后在框内偏大/溢出。22px 的 `.task-checkbox` 无此问题，故不易察觉。
- 修复：恢复 `font-size: 12px`。
- 状态：[x]

### BUG-58 夜间手动选择主题后，自动夜间整晚失效
- 位置：`src/js/Theme.js`（`setUserTheme` 与 `refreshAutoNight` 的配合）
- 现象：`refreshAutoNight` 首行 `if (!force && isNight === this.lastNightState) return;`；夜间用户手动选非深色主题后 `lastNightState` 仍为 `true`，60 秒定时器每次都早退，整晚停留在浅色，与"19:00 - 07:00 自动切换深色"的语义矛盾。
- 根因：旧 mode 体系遗留的行为，重构为"主题驱动 `dark-mode` 类"时未一并处理手动切换与自动夜间的时间状态耦合。
- 修复：`setUserTheme` 在 `autoNight && isNightTime() && 所选非 dark` 时记录用户意图（`userTheme`）但以 `dark` 呈现并置 `autoApplied=true`，关闭自动夜间时恢复用户主题；定时器早退路径不再产生错误状态。
- 测试盲区：`tests/app.test.mjs` 原 BUG-23 用例全程使用 `refreshAutoNight(true)`（force）绕过早退分支，掩盖真实路径。已补充非 force 定时器路径断言。
- 状态：[x]

---

## P2 一致性缺陷

### BUG-59 主题持久化写法两处不一致，且存在错误落盘风险
- 位置：`src/js/App.js:216`（菜单 `select-theme`，原写 `theme.currentTheme`）、`src/js/Settings.js`（`applyTheme`，原写原始 `themeId`）
- 现象：两条路径对 `settings.theme` 的取值来源不同。风险有二：(1) Settings 路径可把不存在的 id 原样写入配置；(2) App 路径在"自动夜间生效期间"会把自动套用的 `dark` 当作用户主题落盘，次日白天 `refreshAutoNight` 以 `userTheme='dark'` 为目标，深色将无法自动恢复。
- 修复：两处统一为 `store.updateSettings({ theme: theme.userTheme })`——`userTheme` 已经 `getTheme` 归一化兜底，且始终表达用户意图而非自动态。
- 状态：[x]

### BUG-60 死变量 `--brand-*` 残留与搜索高亮硬编码旧品牌色
- 位置：`src/css/main.css:2-17`（`--brand-10`…`--brand-160`）、`main.css:1358`（`mark`）
- 现象：`:root` 改为浅色硬编码后检视意见认为 `var(--brand-)` 引用为 0；复核实际残留 1 处——`mark { color: var(--brand-70) }`，且其 `background` 硬编码旧默认主题蓝 `rgba(15,108,189,.2)`，在 Passion/深色主题下不协调。
- 修复：`mark` 改为主题感知（`--accent-bg` 底 + `--text-primary` 字重加深，替代纯颜色强调）；删除全部 16 个 `--brand-*` 变量（`grey` 系列仍被 `dark-mode`/按钮引用，保留）。修复后 `grep brand` 为 0。
- 状态：[x]

---

## P3 测试缺陷

### BUG-61 BUG-12 工作日重复用例断言依赖运行日星期（测试设计缺陷）
- 位置：`tests/store.test.mjs:179`
- 现象：长期失败且失败值随日期漂移（`2!==1`、`3!==1`、`5!==1`），跨时区结果不一致。
- 根因：用例硬编码过去日期 `2026-09-18`（周五）并断言"下次到期=周一"；但 `createNextOccurrence` 的逾期追赶逻辑（`while (date <= today)`，产品正确行为，另有专项用例锁定）会把结果推到"运行日之后的第一个工作日"，断言随运行日星期变化。测试混用了"固定过去日期"与"依赖今天的逻辑"。
- 修复：基准改为动态求"今天之后的下一个周五"（严格未来，不触发追赶），确定性断言推进到下周一；4 时区验证通过。
- 状态：[x]

---

## 误报复核

### 检视第 5 条：light 主题缺 `headerBg` 走渐变回退
- 复核结论：`src/themes/presets.js` 中 `light` 已定义 `headerBg: '#f3f3f3'` 与 `headerText: '#1b1b1b'`，与 `:root` 默认一致；渐变回退仅作用于未声明该字段的旧自定义主题。不构成缺陷，不修改。
- 状态：[-]

---

## 验证记录

- `tests/store.test.mjs`：33 项 × 4 时区（Asia/Shanghai、UTC、America/New_York、Pacific/Kiritimati）全过
- `tests/components.test.mjs` 44 项、`tests/app.test.mjs` 15 项（含补强的 BUG-23 非 force 路径）、`tests/migration.test.mjs` 10 项全过
- Electron 端到端 164 项全过
- 修复后全套件零失败（此前长期失败的 BUG-12 即本清单 BUG-61）

| 文件 | 修复项 |
|------|--------|
| `src/css/main.css` | 57、60 |
| `src/js/Theme.js` | 58 |
| `src/js/App.js`、`src/js/Settings.js` | 59 |
| `tests/app.test.mjs` | 58（补非 force 路径） |
| `tests/store.test.mjs` | 61 |
