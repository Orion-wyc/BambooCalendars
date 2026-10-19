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
- **系统通知**：任务到期或提醒到点时推送系统通知，错过的提醒补发一次；可在设置中分别开关"到期通知""提醒通知"并测试发送。跨平台适配：Windows 归属 AppUserModelId、macOS 首次请求授权、Linux 依赖桌面通知服务与应用图标
- **离线存储**：数据保存在本地 JSON 文件，原子写入避免损坏
- **可选更新检查**：默认启动时查询 GitHub Releases，可在设置中关闭

### 主题系统（v2.0）
- 有机极简（Organic Minimalist / Nordic·Morandi）设计风格：大圆角（12–16px）、柔和弥散阴影、1px 微光描边（`rgba(255,255,255,.05)`）替代硬边框、暖色中性面、统一 Feather/Lucide 线性图标（`src/js/icons.js`，`stroke=currentColor`，随主题自动取色）；字体优先 Inter / Plus Jakarta Sans / SF Pro
- 三栏桌面布局：pill 式侧边栏导航（圆角选中态 + 主题色指示条）＋ 卡片化任务列表（宽屏居中为 ≤860px 阅读列）＋ 右侧详情 sheet（柔描边卡片 + 快捷 chip）
- 主题令牌分层：品牌/状态色由 `Theme.js` 注入，中性面（背景/边框/文字）可由每个主题的 `colors.surfaces` 覆盖，缺省回退 `:root` / `html.dark-mode`
- 内置两套主题（浅色/深色独立主题已并入 Passion 体系，默认 Passion）：
  - Passion（浅色 UI + Material 状态色）：进行中 `#4285F4`（实底按钮用深一档 `#1976D2` + 白字保证对比度）、处理中 `#FFCA28`、已完成 `#4DB6AC`、已取消 `#EF5350`（浅状态色上文字统一 `#212121`），hover 用更深的 `#1565C0`/`#FB8C00`/`#00897B`/`#D32F2F`
  - Passion 深色：深色表面 + 上述 Passion 状态色，也是自动夜间的联动变体
- 自动夜间模式：夜间（19:00 - 07:00）自动切换到所选主题对应的深色变体（Passion→Passion 深色），日间恢复用户所选主题
- 主题配置入口：`src/themes/presets.js`；旧版本的 `theme: light/dark/default/win11-light` 与 `mode: dark/black` 数据自动迁移为 Passion / Passion 深色

> v2.0 为纯界面重构（不新增功能、不改数据结构与主题 ID）；交互契约、快捷键、数据迁移与全部回归测试保持通过。


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
│   │   ├── icons.js     # v2.0 Feather 线性图标库（内联 SVG）
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

推送 `v*` 形式的 tag 会触发 GitHub Actions（`.github/workflows/build.yml`）自动构建 Windows 安装包并创建对应 Release：

```bash
git tag v1.0.0
git push github v1.0.0
```

也可以在 Actions 页面用 `workflow_dispatch` 手动触发构建（只产出 artifact，不建 Release）。

Release 说明取自 `docs/release-notes/<tag>.md`，缺失时回落到提交记录链接。

## 自定义主题

编辑 `src/themes/presets.js` 调整内置主题或在 `user-themes.json` 增加自定义主题。主题对象字段：

```javascript
export const THEME_PRESETS = [
  {
    id: 'passion',            // 主题 id（设置/菜单据此切换，数据中持久化）
    name: 'Passion',          // 显示名
    darkVariant: 'passion-dark', // 自动夜间的夜间联动变体 id
    // darkSurfaces: true,   // 深色主题：启用 html.dark-mode 深色表面
    colors: {
      primary: '#4285F4',     // 主色（日历选中、渐变起点）
      accent: '#1976D2',      // 强调色（按钮、高亮、选中指示条）
      accentDark: '#1565C0',  // 强调色悬浮/实底圆形深底
      secondary: '#5c5c5c',   // 辅助色
      sidebarBg: '#f3f3f3',   // 侧边栏/标题栏背景
      sidebarText: '#1b1b1b', // 侧边栏文字
      // 其余 sidebar* / header* 可选，缺省使用回退值
      // 状态色族可选：success/warning/danger 及各 *Dark，与实底按钮 successBtn/dangerBtn
      // 文字对比：onAccent/onSuccess/onWarning/onDanger
      // 中性面（可选）：surfaces: { bgMain, bgPanel, bgHover, bgActive, border,
      //   borderLight, borderSoft, textPrimary, textSecondary, textMuted }
    }
  }
];
```

- `darkSurfaces: true` 会启用 `html.dark-mode`，套用深色表面/文字/描边令牌；未提供 `surfaces` 时回退该类的中性色
- `surfaces` 支持 camelCase（`bgMain`）或 kebab（`bg-main`）两种写法，逐主题覆盖中性面
- 状态色族与 `surfaces` 均为可选内联覆盖：主题未定义时回退 CSS 默认值，切换主题不残留
- `darkVariant` 指定自动夜间联动变体；缺省时回退到第一个 `darkSurfaces` 主题
- 主题切换入口：设置 > 主题（含"自动夜间"），或菜单 视图 > 主题模式
- 历史 `theme: light/dark/default/win11-light`、`mode: dark/black` 数据在加载时自动迁移为 Passion / Passion 深色；"显示模式"体系及其快捷键已移除


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
