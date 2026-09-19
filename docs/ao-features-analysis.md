# Ao 功能分析报告

> 分析时间：2026-09-13
> 分析目标：https://github.com/klaudiosinani/ao
> 当前项目：BambooCalendars

## 一、Ao 项目概述

Ao 是一个非官方的 Microsoft To-Do 桌面客户端，通过 Electron 封装 Microsoft To-Do 网页版实现。版本 6.9.0，采用 MIT 协议。

### 技术栈
- Electron 4.2.2
- electron-settings（配置文件管理）
- auto-launch（开机自启）
- electron-context-menu（右键菜单）
- electron-dl（文件下载）

### 核心架构
- `src/browser.js`：渲染进程入口，定义所有 IPC 响应
- `src/win.js`：主窗口管理，窗口状态记忆
- `src/mode.js`：主题模式管理（Black/Dark/Sepia + Auto Night）
- `src/nav.js`：DOM 导航与操作（列表切换、缩放）
- `src/settings.js`：设置持久化管理
- `src/menu/`：菜单栏定义（File/Edit/View/Window/Help）
- `src/style/`：主题 CSS（black-mode/dark-mode/sepia-mode）

---

## 二、功能全景清单

### 2.1 主题系统

| 功能 | Ao | BambooCalendars（当前） |
|------|----|------------------------|
| Black Theme | ✓ 黑色背景，白色文字 | ✗ |
| Dark Theme | ✓ 深色背景 | ✗ |
| Sepia Theme | ✓ 棕褐色背景 | ✗ |
| Auto Night Mode | ✓ 根据时间自动切换 Dark | ✗ |
| 预设主题 | Black/Dark/Sepia | ✓ 5 色主题（默认/海洋/森林/日落/紫罗兰） |
| 自定义主题 | 通过 CSS 覆盖 | ✓ presets.js 配置 |

### 2.2 快捷键系统

| 功能 | Ao | BambooCalendars |
|------|----|-----------------|
| 40+ 本地快捷键 | ✓ | ✗ |
| 全局快捷键 | ✓（系统级） | ✗ |
| 快捷键自定义 | ✓ `~/.ao.json` | ✗ |
| 快捷键编辑入口 | ✓ Cmd/Ctrl + . | ✗ |

### 2.3 导航与列表

| 功能 | Ao | BambooCalendars |
|------|----|-----------------|
| 列表 Tab 切换 | ✓ Cmd/Ctrl + Tab | ✗ |
| 列表序号跳转 | ✓ Cmd/Ctrl + 1-9 | ✗ |
| 侧边栏切换 | ✓ Cmd/Ctrl + O | ✗ |
| 返回待办 | ✓ Esc | ✗ |

### 2.4 缩放与显示

| 功能 | Ao | BambooCalendars |
|------|----|-----------------|
| 放大 | ✓ Cmd/Ctrl + Shift + = | ✗ |
| 缩小 | ✓ Cmd/Ctrl + - | ✗ |
| 重置缩放 | ✓ Cmd/Ctrl + 0 | ✗ |
| 缩放持久化 | ✓ electron-settings 保存 | ✗ |
| 紧凑模式 | ✓ 缩小窗口进入 | ✗ |

### 2.5 任务操作

| 功能 | Ao（通过网页实现） | BambooCalendars |
|------|-------------------|-----------------|
| 新建任务 | ✓ Cmd/Ctrl + N | ✓ |
| 删除任务 | ✓ Cmd/Ctrl + D | ✓ |
| 重命名任务 | ✓ Cmd/Ctrl + T | ✓ |
| 完成任务 | ✓ Cmd/Ctrl + Shift + N | ✓ |
| 标记重要 | ✓ Cmd/Ctrl + I | ✓ |
| 添加到我的一天 | ✓ Cmd/Ctrl + K | ✓ |
| 跳转清单 | ✓ Cmd/Ctrl + M/I/P/A | ✓ |
| 截止日期 | ✓ Cmd/Ctrl + Shift + T | ✓ |
| 提醒 | ✓ Cmd/Ctrl + Shift + E | ✓ |
| 隐藏已完成 | ✓ Cmd/Ctrl + Shift + H | ✗（但有折叠组件） |
| 搜索 | ✓ Cmd/Ctrl + F | ✓ |

### 2.6 窗口管理

| 功能 | Ao | BambooCalendars |
|------|----|-----------------|
| 窗口状态记忆 | ✓ 坐标/宽高 | ✗ |
| 始终置顶 | ✓ Cmd/Ctrl + Shift + P | ✗ |
| 全屏 | ✓ F11 / Cmd+Ctrl+F | ✗ |
| 隐藏菜单栏 | ✓ | ✓（已禁用菜单栏） |
| 启动时最小化 | ✓ | ✗ |
| 请求退出确认 | ✓ | ✗ |

### 2.7 系统集成

| 功能 | Ao | BambooCalendars |
|------|----|-----------------|
| 系统托盘 | ✓ 隐藏/显示窗口 | ✗ |
| 隐藏托盘图标 | ✓ | ✗ |
| 全局快捷键 | ✓ 系统级 | ✗ |
| 开机自启 | ✓ auto-launch | ✗ |
| 更新通知 | ✓ update-check | ✗ |
| 服务通知 | ✓ 系统通知 | ✓ |

### 2.8 菜单栏

| 功能 | Ao | BambooCalendars |
|------|----|-----------------|
| File 菜单 | ✓ 搜索/列表/任务/退出 | ✗ |
| Edit 菜单 | ✓ 撤销/剪切/复制/粘贴 | ✗ |
| View 菜单 | ✓ 缩放/主题/列表导航/窗口 | ✗ |
| Window 菜单 | ✓ 最小化/关闭 | ✗ |
| Help 菜单 | ✓ 关于/更新/快捷键 | ✗ |

---

## 三、差异分析与适配方案

### 3.1 Ao 的特色功能（需移植）

按实现复杂度分组：

**P0 - 基础功能（1-2 天）**
- 菜单栏（全量移植 ao 的 File/Edit/View/Window/Help 菜单）
- 快捷键系统（40+ 本地快捷键映射到当前 API）
- 窗口状态记忆（坐标、宽高、全屏、置顶）

**P1 - 增强功能（3-5 天）**
- 主题系统扩展（新增 Black/Dark/Sepia + Auto Night Mode）
- 系统托盘（最小化到托盘 + 快捷键）
- 缩放功能（Ctrl +/-/0）
- 侧边栏切换（Ctrl + O）

**P2 - 高级功能（5-7 天）**
- 全局快捷键（系统级注册）
- 开机自启（auto-launch）
- 退出确认对话框
- 紧凑模式（响应式布局）

### 3.2 适配差异

Ao 作为网页封装，其"任务操作"（新建/删除/完成等）通过 DOM 点击模拟。BambooCalendars 需要直接调用 Store API：

```
Ao: nav.click('.taskItem.selected.active') 
→ Bamboo: store.createTask({...})
```

### 3.3 Fluent Design UI 改造

Fluent Design 的核心元素：
1. **Acrylic 亚克力效果**：半透明毛玻璃背景
2. **Reveal 高亮**：鼠标悬停时的发光边缘效果  
3. **Depth 层次**：Z 轴纵深，阴影层次
4. **Motion 动画**：平滑过渡，持续时间和缓动函数
5. **Segoe UI 字体**：微软官方字体
6. **图标**：Fluent UI Icons (Segoe MDL2 Assets)
7. **控件**：CommandBar、NavigationView、ContentDialog 风格
8. **色彩体系**：Fluent Neutral Palette + Accent Color

Fluent Design 配色参考：
- 背景层：白色 #FFFFFF → #FAF9F8 → #F3F2F1 → #EDEBE9
- 卡片层：白色 #FFFFFF 阴影 Elevation 4/8/16
- 分割线：#EDEBE9
- 文字主色：#323130
- 文字次级：#605E5C
- 强调色：#0078D4（默认蓝色）

---

## 四、实现优先级

```
Phase 1: Fluent Design UI 重写
Phase 2: 菜单栏 + 快捷键系统
Phase 3: 主题系统扩展（Black/Dark/Sepia + Auto Night）
Phase 4: 系统托盘 + 窗口管理
Phase 5: 全局快捷键 + 高级特性
Phase 6: 收尾优化
```