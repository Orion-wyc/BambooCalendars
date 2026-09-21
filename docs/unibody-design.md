# Unibody 窗口设计方案

> 版本：v1.0（设计稿 + 实现说明）
> 目标：移除系统标题栏，改为 Fluent 风格 Unibody（一体式）窗口：应用内容延伸至窗口顶部，窗口控制按钮由系统原生覆盖层（Window Controls Overlay）提供
>
> 基线：Fluent 2 主题改造提交 `5dbad22`

---

## 1. 背景与现状

| 项 | 现状 |
|------|------|
| 窗口样式 | macOS `hiddenInset`；Windows/Linux `default`（系统标题栏 + 常驻菜单栏） |
| 菜单 | `createMenu()` 应用级菜单，承载全部快捷键 accelerator |
| 渲染层快捷键 | `App.bindKeyboard()` 已实现菜单中几乎全部快捷键（Ctrl+F/N/D/T/L/K/I/O、主题、缩放、清单切换等） |
| 窗口控制 IPC | 无（仅 `window:show`） |
| 关闭行为 | `close` 事件拦截 → 最小化到托盘（非 macOS 恒可用） |

痛点：Windows/Linux 上"系统标题栏 + 菜单栏 + 应用侧边栏"三段式堆叠，垂直空间浪费约 90px，与 Fluent 2 / Microsoft To Do 的一体化观感不符。

---

## 2. 方案选型

| 方案 | 窗口控制按钮 | 拖拽/双击/Aero Snap | 工作量 | 结论 |
|------|------------|-------------------|--------|------|
| A：`frame: false` 全自绘 | HTML 自绘 + IPC（最小化/最大化/还原/关闭 + 最大化状态同步） | 自绘 drag region；Snap 布局菜单需自行处理 | 高（+2d） | ❌ |
| **B：`titleBarStyle: 'hidden'` + `titleBarOverlay`（WCO）** | **系统原生覆盖层按钮**（含 Win11 Snap 布局、最大化图标自动切换） | 原生 drag region 行为 | 低 | ✅ 选用 |

选 B 的理由：
1. 窗口控制按钮零自绘、零 IPC，关闭按钮天然走既有 `close` 拦截逻辑（托盘最小化不受影响）
2. Win11 Snap Layouts 悬停菜单、双击最大化、Aero Snap 均为系统行为，无兼容成本
3. Electron 28 全平台支持：Windows / Linux（≥20）走 `titleBarOverlay`，macOS 走 `hiddenInset` 红绿灯悬浮
4. 菜单不需要迁移：`autoHideMenuBar: true` 隐藏菜单栏但 accelerator 全部保留，Alt 可临时唤出（导出 JSON、DevTools 等低频入口不丢失）

---

## 3. 平台矩阵

| 平台 | titleBarStyle | titleBarOverlay | 菜单栏 | 红绿灯/控制按钮 | 标题栏左内边距 |
|------|--------------|-----------------|--------|----------------|---------------|
| Windows | `hidden` | `{ color, symbolColor, height }` | `autoHideMenuBar: true` | 原生 WCO（右上） | 12px |
| Linux | `hidden` | 同 Windows（不支持时静默降级） | `autoHideMenuBar: true` | 原生 WCO（右上） | 12px |
| macOS | `hiddenInset` | 不适用 | 系统菜单栏（不变） | 红绿灯（左上悬浮） | 84px（避让红绿灯） |

全屏（F11 / 菜单）时：标题栏整体隐藏（`html.fullscreen`），内容区恢复 `100vh`。

---

## 4. 架构与数据流

```
渲染进程                                主进程
┌──────────────────────────┐   IPC   ┌─────────────────────────────────┐
│ index.html #titlebar     │         │ BrowserWindow                   │
│  (drag region, 36px)     │         │  titleBarStyle: 'hidden'        │
│                          │         │  titleBarOverlay: {…}  ← WCO    │
│ TitleBar.js              │         │                                 │
│  init: platform class    │         │ ipcMain                         │
│  WCO bounds → CSS var    │         │  'titlebar:set-overlay' (on)    │
│  mode 变化 → setOverlay ─┼────────▶│   → win.setTitleBarOverlay()    │
│                          │         │  'window:toggleFullscreen'(hdl) │
│ App.js                   │         │                                 │
│  F11 → toggleFullscreen ─┼────────▶│ enter/leave-full-screen         │
│  'fullscreen-changed' ◀──┼─────────┤  → send('fullscreen-changed')   │
│ Theme.applyMode          │         │  (复用 menu-action 通道)         │
│  → syncTitlebarOverlay   │         │                                 │
│ preload setZoom          │         │                                 │
│  → overlay height 联动 ──┼────────▶│ 合并 patch（color/height）       │
└──────────────────────────┘         └─────────────────────────────────┘
```

### IPC 契约

| 通道 | 方向 | 载荷 | 说明 |
|------|------|------|------|
| `titlebar:set-overlay` | R→M (send) | `{ color?, symbolColor?, height? }` | 增量 patch，主进程合并后 `setTitleBarOverlay`；macOS 忽略；height 钳制 24–80 |
| `window:toggleFullscreen` | R→M (invoke) | — | 切换全屏 |
| `fullscreen-changed` | M→R | `boolean` | 复用 `menu-action` 通道，渲染层切换 `html.fullscreen` |

### 主题联动

标题栏背景取 `--bg-panel`、文字取 `--text-secondary`（computed style 读取实际值），WCO 符号色取 `--text-primary`。`Theme.applyMode()` 末尾调用 `syncTitlebarOverlay()`，四种显示模式对应：

| 模式 | overlay color | symbolColor |
|------|--------------|-------------|
| normal | `#ffffff` | `#242424` |
| dark | `#292929` | `#ffffff` |
| black | `#0a0a0a` | `#ffffff` |
| sepia | `#faf4e8` | `#5b4636` |

### 缩放联动

`webFrame.setZoomFactor` 后标题栏 CSS 高度按 DIP 缩放（36 × zoom），preload 在 `setZoom()` 内同步发送 `height: round(36 × zoom)`，保持 WCO 与标题栏等高。

---

## 5. DOM / CSS 设计

```html
<body>
  <div id="titlebar">
    <span class="titlebar-icon">📋</span>
    <span class="titlebar-title">Bamboo Todo</span>
  </div>
  <div id="app">…</div>
</body>
```

```css
:root { --titlebar-h: 36px; --titlebar-controls-w: 138px; }

#titlebar {
  height: var(--titlebar-h);
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  -webkit-app-region: drag;   /* 整条可拖拽；双击最大化由系统处理 */
}
html.platform-darwin #titlebar { padding-left: 84px; }            /* 红绿灯避让 */
html.platform-win32 #titlebar,
html.platform-linux #titlebar { padding-right: var(--titlebar-controls-w); }

#app { height: calc(100vh - var(--titlebar-h)); }                  /* 原 100vh */
html.fullscreen #titlebar { display: none; }
html.fullscreen #app { height: 100vh; }
```

`--titlebar-controls-w` 初值 138px（Windows 3 键标准宽），`TitleBar.js` 启动后从 `navigator.windowControlsOverlay.getBounds()` 读实测宽度覆盖，并监听其 `resize` 事件。

---

## 6. 改动清单

| 文件 | 改动 |
|------|------|
| `main.js` | BrowserWindow 参数（titleBarStyle/titleBarOverlay/autoHideMenuBar）；新增 `titlebar:set-overlay`、`window:toggleFullscreen` IPC；`enter/leave-full-screen` 事件转发；overlay patch 合并状态 |
| `preload.js` | 暴露 `api.platform`、`api.window.toggleFullscreen`、`api.titlebar.setOverlay`；`setZoom` 联动 overlay 高度 |
| `src/js/TitleBar.js`（新增） | 平台 class、WCO 宽度探测与监听、`syncTitlebarOverlay()`（全防御式，测试环境静默跳过） |
| `src/js/App.js` | F11 → toggleFullscreen；`fullscreen-changed` → 切换 `html.fullscreen` |
| `src/js/Theme.js` | `applyMode()` 末尾调用 `syncTitlebarOverlay()` |
| `src/index.html` | 新增 `#titlebar` 节点 |
| `src/css/main.css` | 标题栏样式、`#app` 高度改 calc、fullscreen 规则、platform padding |
| `tests/helpers/fakedom.mjs` | mock 补充 `platform / window.toggleFullscreen / titlebar.setOverlay` |

不改动：菜单模板（accelerator 全部保留）、托盘、关闭拦截、窗口状态持久化、紧凑模式。

---

## 7. 测试计划

1. **单元/编排（fakedom）**：`fullscreen-changed` 动作切换 class；F11 分发；mock 扩展后全量回归通过
2. **e2e（真实 Electron + xvfb）**：现有 134 项冒烟不回归（`main.js` 被 bootstrap 直接加载，覆盖新窗口参数路径）
3. **手工平台矩阵**：
   - Windows：拖拽/双击最大化/Aero Snap/Snap Layouts 悬停菜单；Alt 唤出菜单栏；主题切换后 WCO 配色跟随；缩放后标题栏与按钮等高
   - macOS：红绿灯不与标题栏内容重叠；全屏自动隐藏
   - Linux：GNOME/KDE 下 WCO 渲染（不支持时无按钮但 drag region 仍可移动窗口，记录为已知限制）
   - 关闭按钮 → 仍最小化到托盘

---

## 8. 风险与回退

| 风险 | 缓解 |
|------|------|
| Linux 部分 WM 对 WCO 支持不完整 | `titleBarOverlay` 包 try/catch；drag region 保证窗口仍可移动；文档记录已知限制 |
| 缩放极端值下 overlay 高度取整误差 | height 钳制 24–80；zoom 范围本已钳制 0.3–3 |
| 主题切换瞬间 WCO 配色滞后 | `applyMode` 同步发送，延迟 <1 帧 IPC，肉眼不可辨 |
| 回退 | 单提交回滚即可：恢复 `titleBarStyle: 'default'`、移除 `#titlebar` 节点与 CSS |

---

## 9. 工作量对照（相对此前评估 4~4.5 人日）

| 工作项 | 原估 | 采用 WCO 后 |
|------|------|------------|
| 无边框窗口 + overlay | 0.5d | 0.5d |
| 窗口控制按钮 + IPC + 状态同步 | 0.5d | **0d**（系统原生） |
| 自绘标题栏 HTML/CSS | 1d | 0.5d（无按钮，仅 drag 条） |
| 菜单/快捷键迁移 | 1d | **0.25d**（autoHideMenuBar 保留全部 accelerator，仅补 F11） |
| 托盘/置顶/紧凑适配 | 0.5d | 0.25d（关闭链路复用原生按钮） |
| 主题/缩放联动 | — | 0.5d |
| 平台回归 | 1d | 1d |
| **合计** | 4~4.5d | **≈3d** |
