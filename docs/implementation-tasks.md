# BambooCalendars 实现任务清单

> 基于 ao 功能分析，分阶段实现 Fluent Design 风格的离线待办桌面应用

---

## Phase 1: Fluent Design UI 重写

### 1.1 设计令牌系统（Design Tokens）
- [ ] 建立 Fluent Design 色板（Neutral #F3F2F1, Accent #0078D4, Text #323130）
- [ ] 定义阴影层级 Elevation（4/8/16/64）
- [ ] 定义圆角标准（2px/4px/8px）
- [ ] 定义动画曲线（Fluent 缓动函数）
- [ ] 定义字体系统（Segoe UI 优先）

### 1.2 布局重写
- [ ] 三栏布局改用 Fluent NavigationView 模式
- [ ] 侧边栏改用窄图标模式（可展开）
- [ ] CommandBar 顶部操作栏
- [ ] 内容区域内边距与间距标准化

### 1.3 组件重写
- [ ] 按钮：Fluent Button（无边框、填充样式）
- [ ] 复选框：Fluent Checkbox（圆形→方形）
- [ ] 输入框：Fluent TextField（下划线样式）
- [ ] 切换开关：Fluent ToggleSwitch
- [ ] 日期选择器：Fluent DatePicker
- [ ] 选择器：Fluent Dropdown
- [ ] 弹出面板：Fluent Panel（右侧滑出）
- [ ] 对话框：Fluent ContentDialog
- [ ] 任务项：Fluent ListItem（带 Reveal 高亮）

### 1.4 动画与过渡
- [ ] 面板滑入缓动曲线（Fluent Motion）
- [ ] 任务完成动画（XAML 风格）
- [ ] 主题切换过渡
- [ ] 悬停高亮 Reveal 效果

---

## Phase 2: 菜单栏 + 快捷键系统

### 2.1 主菜单栏
- [ ] **File 菜单**：搜索 | 清单操作 | 任务操作 | 清单跳转 | 退出
- [ ] **Edit 菜单**：撤销/重做 | 剪切/复制/粘贴 | 全选
- [ ] **View 菜单**：主题切换 | 导航 | 缩放 | 始终置顶 | 全屏
- [ ] **Window 菜单**：最小化 | 切换窗口
- [ ] **Help 菜单**：关于 | 版本信息

### 2.2 快捷键系统
- [ ] 任务快捷键：新建(N)/删除(D)/重命名(T)/完成(Shift+N)
- [ ] 清单快捷键：新建(L)/删除(Shift+D)/重命名(Y)
- [ ] 跳转快捷键：我的一天(M)/重要(I)/已计划(P)/任务(A)/清单序号 1-9
- [ ] 导航快捷键：下一个列表(Tab)/上一个列表(Shift+Tab)/返回(Esc)
- [ ] 视图快捷键：搜索(F)/侧边栏(O)/主题(B/H/G)/夜间模式(Alt+N)
- [ ] 缩放快捷键：放大(Shift+=)/缩小(-)/重置(0)
- [ ] 全局快捷键：新建(Alt+C)/搜索(Alt+F)/切换窗口(Alt+A)

### 2.3 快捷键自定义
- [ ] 快捷键配置持久化（JSON 文件）
- [ ] 快捷键编辑入口（设置面板）
- [ ] 快捷键冲突检测

---

## Phase 3: 主题系统扩展

### 3.1 新增主题
- [ ] Black Mode：纯黑背景白色文字
- [ ] Dark Mode：深灰背景浅色文字
- [ ] Sepia Mode：棕褐色背景

### 3.2 Auto Night Mode
- [ ] 基于日出日落时间自动切换
- [ ] 平滑过渡动画
- [ ] 用户可选启用/禁用

### 3.3 主题持久化
- [ ] 主题选择保存到 localStorage
- [ ] 启动时恢复上次主题
- [ ] 主题切换不丢失状态

---

## Phase 4: 系统托盘 + 窗口管理

### 4.1 系统托盘
- [ ] 托盘图标（可带徽标）
- [ ] 托盘右键菜单（显示/隐藏/退出）
- [ ] 关闭窗口→最小化到托盘
- [ ] 隐藏托盘图标选项

### 4.2 窗口状态
- [ ] 窗口坐标持久化
- [ ] 窗口大小持久化
- [ ] 最大化状态持久化
- [ ] 始终置顶功能
- [ ] 全屏切换（F11）

### 4.3 启动选项
- [ ] 开机自启（auto-launch）
- [ ] 启动时最小化
- [ ] 退出确认对话框

---

## Phase 5: 全局快捷键 + 高级功能

### 5.1 全局快捷键
- [ ] Alt+C：全局新建任务（即使在后台）
- [ ] Alt+F：全局搜索
- [ ] Alt+A：切换窗口可见性

### 5.2 紧凑模式
- [ ] 窗口缩小到阈值高度时切换紧凑布局
- [ ] 紧凑模式下隐藏部分 UI 元素

### 5.3 缩放
- [ ] 渲染进程缩放（webFrame.setZoomFactor）
- [ ] 缩放比例持久化
- [ ] 缩放范围限制（0.3x - 3x）

### 5.4 更新通知
- [ ] GitHub Releases 版本检查
- [ ] 更新通知弹窗
- [ ] 检查周期可配置

---

## 实现顺序

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1（UI 基础）是其他所有功能的前提
Phase 2（菜单+快捷键）与 Phase 1 可同步
Phase 3（主题扩展）依赖 Phase 1
Phase 4（托盘+窗口）相对独立
Phase 5（高级功能）最后
```

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| main.js | 重写 | 菜单栏、托盘、全局快捷键、窗口管理 |
| preload.js | 重写 | 新增 IPC API |
| src/index.html | 更新 | Fluent 布局结构调整 |
| src/css/main.css | 重写 | Fluent Design 完整样式 |
| src/js/App.js | 重写 | 整合新模式 |
| src/js/Store.js | 优化 | 设置数据结构扩展 |
| src/js/Theme.js | 重写 | 支持 Black/Dark/Sepia + Auto Night |
| src/js/Sidebar.js | 重写 | Fluent 风格侧边栏 |
| src/js/TaskList.js | 重写 | CommandBar + Fluent 列表 |
| src/js/TaskDetail.js | 重写 | Fluent Panel |
| src/js/Settings.js | 重写 | Fluent ContentDialog |
| src/themes/presets.js | 扩展 | 新增主题预设 |
| - | 新增 | src/js/Keyboard.js |
| - | 新增 | src/js/Menu.js |
| - | 新增 | src/js/Tray.js |
| - | 新增 | docs/ao-features-analysis.md |
| - | 新增 | docs/implementation-tasks.md |