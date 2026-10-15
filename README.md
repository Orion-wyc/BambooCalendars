# Bamboo Todo

离线待办事项桌面应用，模仿 Microsoft To Do 设计。

## 功能特性

### 核心功能
- **三栏布局**：侧边栏 + 主列表 + 右侧固定宽度详情面板；未选中任务时显示占位提示（"点击任务标题显示详情"），选中任务不改变主视图宽度
- **Unibody 窗口**：无系统标题栏，自绘 Fluent 风格标题栏，窗口控制按钮由系统原生覆盖层（WCO）提供（设计方案见 `docs/unibody-design.md`）
- **智能清单**：
  - 我的一天 - 每日重点任务（含智能建议）
  - 重要 - 星标任务汇总
  - 最近 7 天 - 按天分组的截止视图
  - 日历 - 月历视图，窗格固定高度最多显示 4 行（超出时 3 条 + "更多 N"），点击日期查看当天任务并可直接新建任务
  - 任务 - 所有任务
- **番茄钟**：侧边栏底部按钮切换，浮动面板显示在右下角（任意视图可用），时长可在设置中调整（默认 25/5 分钟）
- **自定义清单**：创建、重命名、删除
- **任务管理**：
  - 添加/编辑/删除任务
  - 完成任务（详情页底部「完成任务」按钮 / 列表复选框，自动折叠到已完成区域）
  - 重要标记（星标）
  - 添加到我的一天
  - 截止日期和提醒
  - 重复任务（每天/工作日/每周/每月/每年）
  - 子任务（步骤）及进度条
  - 任务备注
  - 拖拽排序（自动切换为手动排序）
  - 优先级 P1-P4 与标签
- **搜索与筛选**：全局搜索，支持按优先级、标签筛选（在所有视图生效）
- **系统通知**：提醒时间到时推送系统通知，错过的提醒会补发一次
- **离线存储**：数据保存在本地 JSON 文件，原子写入避免损坏
- **可选更新检查**：默认启动时查询 GitHub Releases，可在设置中关闭

### 主题系统
- Fluent 2 设计风格，配色参考 Fluent 2 color tokens
- 内置四套主题（原"显示模式"已并入主题体系）：
  - 浅色模式（参考 Windows 11 浅色配色）：强调蓝 `#0067c0`/`#0078d4`、浅灰侧边栏 `#f3f3f3`、深色文字
  - 深色模式：Fluent dark tokens——侧边栏 `#202020`、表面 `#292929`、强调按钮 `#115ea3`、浅色文字
  - Passion（浅色 UI + Material 状态色）：进行中 `#4285F4`（实底按钮用深一档 `#1976D2` + 白字保证对比度）、处理中 `#FFCA28`、已完成 `#4DB6AC`、已取消 `#EF5350`（浅状态色上文字统一 `#212121`），hover 用更深的 `#1565C0`/`#FB8C00`/`#00897B`/`#D32F2F`
  - Passion 深色：深色表面 + 上述 Passion 状态色，是 Passion 在自动夜间下的联动变体
- 自动夜间模式：夜间（19:00 - 07:00）自动切换到所选主题对应的深色变体（浅色→深色模式，Passion→Passion 深色），日间恢复用户所选主题
- 主题配置入口：`src/themes/presets.js`；旧版本的 `theme: default/win11-light` 与 `mode` 数据自动迁移

## 技术栈

- **Electron 28** - 桌面运行环境
- **原生 HTML/CSS/JS** - 无框架依赖
- **ES Modules** - 模块化代码组织
- **本地 JSON 文件** - 持久化（临时文件 + rename 原子写入）

## 项目结构

```
BambooCalendars/
├── main.js              # Electron 主进程
├── preload.js           # IPC 桥接
├── package.json         # 项目配置
├── src/
│   ├── index.html       # 入口页面
│   ├── css/
│   │   └── main.css     # 全局样式 + CSS 变量主题
│   ├── js/
│   │   ├── App.js       # 主入口，初始化
│   │   ├── EventBus.js  # 事件总线
│   │   ├── Store.js     # 数据模型 + 存储
│   │   ├── Theme.js     # 主题管理
│   │   ├── Sidebar.js   # 侧边栏组件
│   │   ├── TaskList.js  # 任务列表组件
│   │   ├── TaskDetail.js# 详情面板组件
│   │   ├── Pomodoro.js  # 番茄钟组件
│   │   ├── Settings.js  # 设置面板
│   │   └── Utils.js     # 日期/转义等通用工具
│   └── themes/
│       └── presets.js   # 主题预设配置
└── assets/              # 图标资源
```

## 使用方法

### 开发模式

```bash
npm install
npm start
```

### 打包发布

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

打包后的安装包位于 `dist/` 目录。

## 自定义主题

编辑 `src/themes/presets.js` 添加或调整主题（配色参考 Fluent 2 color tokens：`https://fluent2.microsoft.design/color-tokens2/`，Windows 11 浅色主题可参考系统设置 > 个性化 > 颜色的强调色与浅色表面）：

```javascript
export const THEME_PRESETS = [
  {
    id: 'light',
    name: '浅色模式',
    colors: {
      primary: '#0078d4',     // 主色（日历选中、渐变起点）
      accent: '#0067c0',      // 强调色（按钮、高亮、选中指示条）
      secondary: '#5c5c5c',   // 辅助色
      // 以下可选，缺省时使用深色侧边栏回退值
      sidebarBg: '#f3f3f3',                 // 侧边栏背景（浅色主题用浅灰）
      sidebarText: '#1b1b1b',               // 侧边栏文字
      sidebarHover: 'rgba(0, 0, 0, 0.06)',  // 悬浮背景
      sidebarActive: 'rgba(0, 0, 0, 0.12)', // 选中背景
      sidebarBorder: 'rgba(0, 0, 0, 0.08)',
      sidebarSearchBg: 'rgba(0, 0, 0, 0.05)',
      sidebarSearchHover: 'rgba(0, 0, 0, 0.10)',
      sidebarPlaceholder: 'rgba(0, 0, 0, 0.45)',
      sidebarIconHover: 'rgba(0, 0, 0, 0.10)',
      headerBg: '#f3f3f3',    // 列表头部背景（缺省为 primary→accent 渐变）
      headerText: '#1b1b1b',  // 列表头部文字
      // 状态色（可选，缺省回退 Fluent 默认值；对应 进行中/已完成/处理中/已取消）
      accentDark: '#1976D2',                  // 强调色悬浮/图标圆形深底
      success: '#4DB6AC', successDark: '#00897B',
      warning: '#FFCA28', warningDark: '#FB8C00',
      danger: '#EF5350',  dangerDark: '#D32F2F',
      onAccent: '#212121', onSuccess: '#212121',    // 实底状态色上的文字
      onWarning: '#212121', onDanger: '#212121'
    }
  }
];
```

- `id: 'dark'` 的主题会额外启用 `html.dark-mode`，套用 Fluent dark tokens（表面/文字/描边/状态色）
- 状态色族（`success/warning/danger` 及各自 `*Dark`/`on*`）为可选内联覆盖：主题未定义时会回退到 CSS 默认值/深色模式值，切换主题不会残留；`successBtn/dangerBtn` 可单独控制实底状态按钮背景（与文字/指示用途的 `success/danger` 分离）
- 主题对象支持 `darkSurfaces: true`（启用 `html.dark-mode` 深色表面）与 `darkVariant`（自动夜间的夜间联动变体 id，缺省回落 `dark`）
- 主题切换入口：设置 > 主题，或菜单 视图 > 主题模式
- "显示模式"体系及其 `Ctrl/Cmd + H/B/G`、`Ctrl/Cmd + Shift + G` 快捷键已移除，由主题切换替代

## 数据存储位置

- Windows: `%APPDATA%/Bamboo Todo/data/`
- macOS: `~/Library/Application Support/Bamboo Todo/data/`
- Linux: `~/.config/Bamboo Todo/data/`

包含：
- `store.json` - 任务、清单、标签、设置、统计
- `app-state.json` - 主进程侧窗口状态（置顶、紧凑模式、关闭行为、更新检查）
- `window-state.json` - 窗口位置与尺寸
- `user-themes.json` - 用户自定义主题

## 构建优化

`package.json` 已配置：
- `compression: "maximum"` - 最大压缩
- `asar: true` - 代码打包
- `electronLanguages: ["zh-CN"]` - 仅保留中文语言包
- `files` 白名单 - 只打包必要文件

预计安装包体积：
- Windows NSIS: ~80-100MB
- macOS DMG: ~90-110MB
- Linux AppImage: ~85-105MB

## 许可证

MIT
# Trigger CI build
