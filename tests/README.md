# 测试说明

零依赖测试套件，只用 Node 内置 `assert` 与项目自带的 Electron，无需安装额外测试框架。

## 运行

```bash
npm test              # 全量：逻辑回归（4 个时区）+ 组件 + 编排 + Electron 端到端
npm run test:logic    # 仅 Node 层（快，约 2 秒）
npm run test:e2e      # 仅 Electron 端到端（需 node_modules 中的 electron）
SKIP_E2E=1 npm test   # 跳过端到端
```

Linux 无显示环境时，端到端会自动使用 `xvfb-run` 启动（未安装 xvfb 且无 `DISPLAY` 时 Electron 会自行报错）。
未安装 electron 时端到端用例输出 `SKIP` 并以 0 退出，不阻塞 CI。

## 目录结构

```
tests/
├── run.cjs              # 聚合入口：时区矩阵 + 各套件 + 端到端
├── helpers/
│   ├── runner.mjs       # 极简测试运行器（注册 / 执行 / 汇总 / 退出码）
│   └── fakedom.mjs      # 假 DOM 与 window.api mock
├── store.test.mjs       # Store / Utils 纯逻辑回归（29 项 × 4 时区）
├── components.test.mjs  # 组件层回归，基于假 DOM（30 项）
├── app.test.mjs         # App 编排层：快捷键、提醒、事件流（14 项）
└── e2e/
    ├── run.cjs          # 启动 Electron 子进程、收集结果、判定退出
    ├── bootstrap.cjs    # Electron 入口：加载真实 main.js 后注入检查
    ├── smoke-page.js    # 在真实渲染进程中执行的用户流程脚本
    └── package.json     # 让 Electron 读到正确的应用名与版本号
```

## 各层职责

| 套件 | 运行环境 | 覆盖 |
|------|---------|------|
| `store.test.mjs` | Node | 数据归一化、日期与时区、重复任务、计数、排序、筛选、转义、落盘 |
| `components.test.mjs` | Node + 假 DOM | 事件委托、监听器绑定次数、内联编辑、渲染转义、设置交互、输入法合成态 |
| `app.test.mjs` | Node + 假 DOM | 启动状态恢复、快捷键守卫与映射、Esc 分层、提醒去重、事件编排 |
| `e2e/` | 真实 Electron | 完整用户流程 + 真实键鼠输入（`sendInputEvent`）+ 主进程行为（托盘关闭、菜单、窗口状态、协议安全、退出） |

## 时区矩阵

`dueDate` 以 `YYYY-MM-DD` 存储，历史上混用 UTC 与本地时间导致日历与"最近 7 天"整体偏移一天。
`store.test.mjs` 会在 `Asia/Shanghai`（UTC+8）、`UTC`、`America/New_York`（UTC-4/-5）、
`Pacific/Kiritimati`（UTC+14）四个时区各跑一遍，覆盖东西半球与跨日期线场景。

## 关键实现说明

- **`src/package.json`**：内容为 `{"type": "module"}`，让 Node 直接把 `src/js/*.js` 当 ES Module 加载，
  从而无需打包或复制即可测试真实源码；根目录 `package.json` 不带 `type` 字段，
  `main.js` / `preload.js` 仍是 CommonJS，Electron 主进程不受影响。
- **输入法路径必须走真实事件**：`components.test.mjs` 用合成事件对象覆盖 `isComposing`/`keyCode 229`
  分支，`e2e/smoke-page.js` 派发真实 `CompositionEvent`，`e2e/bootstrap.cjs` 再用
  `webContents.sendInputEvent` 走 Chromium 输入管道逐字符键入。仅靠脚本给 `input.value` 赋值
  会绕过输入法路径，正是 BUG-47 当初漏网的原因。
- **端到端不改动产品代码**：`bootstrap.cjs` 通过 `require('../../main.js')` 加载真实主进程逻辑，
  再在 `app.whenReady()` 之后附加检查；`--user-data-dir` 指向临时目录，并预置
  `app-state.json`（关闭启动更新检查），测试结束后清理。
- **退出判定**：端到端除逐项断言外，还要求进程在 `app.quit()` 后自行退出（打印 `SMOKE_QUIT_OK`）。
  这是 BUG-01（应用无法退出）的回归防线——修复前 `close` 处理器会拦截退出，进程只能被外部超时强杀。
- **假 DOM 的边界**：`fakedom.mjs` 用正则做极简 HTML 解析，只为支撑事件委托与选择器查询，
  不模拟布局与样式。涉及真实渲染、焦点、时序的问题由 `e2e/` 覆盖。

## 新增用例

```javascript
import assert from 'node:assert/strict';
import { createSuite } from './helpers/runner.mjs';
import './helpers/fakedom.mjs';          // 需要 DOM 时导入，须在业务模块之前

const { store } = await import('../src/js/Store.js');
const { test, run } = createSuite('套件名');

test('用例名', () => {
  assert.equal(store.data.tasks.length, 0);
});

process.exit(await run() ? 1 : 0);
```

业务模块必须用动态 `import()` 引入：`fakedom.mjs` 需要先装好 `globalThis.window` / `globalThis.api`，
而静态 import 会被提升到赋值语句之前执行。
