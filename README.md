# Bamboo Todo

离线待办事项桌面应用，模仿 Microsoft To Do 设计。

## 功能特性

### 核心功能
- **三栏布局**：侧边栏 + 主列表 + 详情面板
- **智能清单**：
  - 我的一天 - 每日重点任务（含智能建议）
  - 重要 - 星标任务汇总
  - 已计划 - 按日期分组的任务
  - 最近 7 天 - 按天分组的截止视图
  - 日历 - 月历视图，点击日期查看当天任务
  - 任务 - 所有任务
  - 番茄钟 - 专注计时，时长可在设置中调整（默认 25/5 分钟）
- **自定义清单**：创建、重命名、删除
- **任务管理**：
  - 添加/编辑/删除任务
  - 完成任务（自动折叠到已完成区域）
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
- 默认配色：#1f3b52（深蓝）、#eb6157（珊瑚红）、#615b54（暖灰）
- 5 个预设主题（默认、海洋、森林、日落、紫罗兰）
- 主题配置入口：`src/themes/presets.js`
- 用户自定义主题存储在本地

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

编辑 `src/themes/presets.js` 添加新主题：

```javascript
export const THEME_PRESETS = [
  {
    id: 'my-theme',
    name: '我的主题',
    colors: {
      primary: '#your-primary',    // 主色（侧边栏、标题）
      accent: '#your-accent',      // 强调色（按钮、高亮）
      secondary: '#your-secondary' // 辅助色（次要文本）
    }
  },
  // ...
];
```

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
