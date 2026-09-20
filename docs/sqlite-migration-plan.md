# SQLite 存储迁移方案

> 版本：v1.1（设计稿）
> 目标：底层数据存储由单文件 JSON 迁移到 SQLite，保证可扩展性、跨版本数据迁移、CI 打包适配
>
> 修订记录：
> - v1.0：初稿，基线提交 `c8c305c`
> - v1.1：纳入基线后提交 `b78753e`（Dialog 组件 / 移除已计划视图）、`0a416a1`（图标对齐）的影响分析，见第 12 节

---

## 1. 背景与动机

当前存储为 `userData/data/store.json` 单文件全量读写：

- 优点：实现简单、零依赖、易备份
- 缺点：
  1. 每次变更全量 `JSON.stringify` + 整文件重写，数据量增大后写入放大
  2. 非原子写入，崩溃/断电可能损坏整个数据文件
  3. 无索引、无查询能力，过滤/搜索/分页全部在渲染进程内存中做
  4. 标签以数组内嵌在 task 中，无法做反向查询与统计

迁移到 SQLite 后获得：原子事务、WAL 崩溃安全、索引查询、FTS 全文搜索、schema 版本化演进能力。

---

## 2. 技术选型

| 方案 | 原生编译 | 性能 | 打包复杂度 | 结论 |
|------|---------|------|-----------|------|
| **better-sqlite3** | 需要（有 Electron 预编译包，缺失时源码编译） | 同步 API，最优 | 中（asarUnpack + install-app-deps） | ✅ 选用 |
| sql.js (WASM) | 不需要 | 内存全量导出，写放大同 JSON | 低 | 备选（仅 exotic 架构兜底） |
| node:sqlite 内置 | 不需要 | 好 | 低 | ❌ 需 Electron ≥35（Node 22.5+），当前 Electron 28 不可用 |

**选择 better-sqlite3 的理由：**
1. 同步 API 与主进程 IPC handler 模型天然契合，无需异步桥接
2. 支持 WAL、事务、FTS5，扩展空间最大
3. Electron 生态事实标准（大量桌面应用使用），GitHub Releases 提供 Electron ABI 预编译包
4. 预编译缺失时可源码编译：windows-latest runner 预装 VS2022 + Python3，满足 node-gyp 条件

**版本锁定：** `better-sqlite3: ^11.x`（支持 Electron 28 ABI 预编译）。

---

## 3. 目标架构

```
渲染进程                          主进程
┌─────────────┐   IPC    ┌──────────────────────────────┐
│ Store.js    │ ───────▶ │ ipc-handlers.js              │
│ (内存缓存)   │          │   └─▶ repositories/tasks.js  │
│ Dialog.js   │          │   └─▶ repositories/lists.js  │
│ (异步对话框, │          │   └─▶ repositories/tags.js   │
│  不涉存储)   │          │   └─▶ repositories/themes.js │
│             │          │   └─▶ repositories/settings.js│
└─────────────┘          │         └─▶ db.js (连接/PRAGMA/迁移)│
                         │               └─▶ bamboo.db (WAL) │
                         └──────────────────────────────┘
```

分层职责：
- `src/main/db.js`：打开连接、设置 PRAGMA、执行 schema 迁移
- `src/main/migrations.js`：版本化迁移脚本数组 + runner
- `src/main/repositories/*.js`：各实体 CRUD 与查询（SQL 集中于此）
- `src/main/storage-init.js`：启动时 JSON→SQLite 检测与迁移
- `main.js`：仅保留窗口/菜单/IPC 注册，IPC handler 调用 repository

---

## 4. 数据库设计

### 4.1 PRAGMA

```sql
PRAGMA journal_mode = WAL;      -- 崩溃安全 + 读写并发
PRAGMA foreign_keys = ON;       -- 级联删除依赖外键
PRAGMA busy_timeout = 5000;     -- 单进程使用，防偶发锁等待
PRAGMA synchronous = NORMAL;    -- WAL 下的性能/安全平衡点
```

### 4.2 Schema（version 1）

```sql
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);                              -- 迁移标记等 KV（schema 版本用 PRAGMA user_version）

CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,   -- 预留：清单归档
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  list_id      TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  important    INTEGER NOT NULL DEFAULT 0,
  in_my_day    INTEGER NOT NULL DEFAULT 0,
  priority     INTEGER NOT NULL DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),
  due_date     TEXT,                          -- YYYY-MM-DD
  reminder     TEXT,                          -- YYYY-MM-DDTHH:mm
  repeat       TEXT NOT NULL DEFAULT 'none',
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4a90d9'
);

CREATE TABLE IF NOT EXISTS task_tags (         -- M:N，替代 task.tags 数组
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE IF NOT EXISTS subtasks (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS themes (            -- 替代 user-themes.json
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  colors     TEXT NOT NULL,                    -- JSON: {primary,accent,secondary}
  is_builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (          -- 替代 store.json 内 settings 对象
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                          -- JSON 序列化值
);

CREATE INDEX IF NOT EXISTS idx_tasks_list     ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_updated  ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_subtasks_task  ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag  ON task_tags(tag_id);
```

### 4.3 字段映射（JSON → SQLite）

| JSON 路径 | 表.列 | 转换 |
|-----------|-------|------|
| lists[].order | lists.order_index | 重命名 |
| tasks[].tags[] | task_tags 行 | 数组展开为 M:N 行 |
| tasks[].subtasks[] | subtasks 行 | 数组展开，index→order_index |
| tasks[].inMyDay | tasks.in_my_day | camel→snake |
| settings.* | settings 行 | 每个 key 一行，value 为 JSON |
| user-themes.json[] | themes 行 | colors 对象→JSON 字符串，is_builtin=0 |
| window-state.json | 不迁移 | 保留 JSON（易失 UI 状态，无迁移价值） |

---

## 5. Schema 版本管理与演进

采用 `PRAGMA user_version` 记录 schema 版本，迁移 runner 模式：

```js
// src/main/migrations.js
const MIGRATIONS = [
  { version: 1, up: (db) => db.exec(SCHEMA_V1) },
  // 未来扩展示例：
  // { version: 2, up: (db) => db.exec(`
  //     ALTER TABLE tasks ADD COLUMN project_id TEXT;
  //     CREATE INDEX idx_tasks_project ON tasks(project_id);
  //   `) },
  // { version: 3, up: (db) => db.exec(`
  //     CREATE VIRTUAL TABLE tasks_fts USING fts5(title, note, content='tasks', content_rowid='rowid');
  //   `) },
];

function runMigrations(db) {
  const current = db.pragma('user_version', { simple: true }) || 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    const tx = db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    });
    tx();
  }
}
```

**扩展性保证：**
1. 新增字段/表 = 追加一个 migration 条目，老库自动升级
2. 布尔统一用 INTEGER 0/1，日期统一 TEXT ISO，时间戳 INTEGER ms——避免后续类型迁移
3. 预留列（lists.archived）减少早期 migration 频率
4. FTS5 搜索、项目/分组等未来功能均以 migration 形式增量加入

---

## 6. 跨版本迁移：JSON → SQLite

### 6.1 触发条件（覆盖安装检测）

应用启动、创建窗口**之前**执行 `storageInit()`：

```
dbPath     = userData/data/bamboo.db
legacyJson = userData/data/store.json
legacyThm  = userData/data/user-themes.json

场景判定：
A. db 不存在 且 json 存在        → 覆盖安装自 v1 旧版 → 执行迁移
B. db 存在但为空 且 json 存在     → 上次迁移中断/失败 → 重新执行迁移
C. db 存在且有数据 且 json 存在    → 冲突（降级后又升级等）→ 不迁移，json 归档到 legacy/conflict-<ts>/
D. db 存在且有数据 且 json 不存在  → 正常启动
E. 都不存在                       → 全新安装，建空库
```

判定 B 的"空"定义：`meta.json_migrated_at IS NULL` 且 `tasks`/`lists` 行数为 0。

### 6.2 迁移流程

```js
function migrateJsonToSqlite(db, jsonPath, themesPath) {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const tx = db.transaction(() => {
    // 1. lists
    for (const l of raw.lists || []) insertList(l);
    // 2. tags
    for (const t of raw.tags || []) insertTag(t);
    // 3. tasks（含 tags 展开、subtasks 展开）
    for (const t of raw.tasks || []) insertTask(t);
    // 4. settings 逐 key 写入
    for (const [k, v] of Object.entries(raw.settings || {})) setSetting(k, v);
    // 5. 用户主题
    for (const t of readJson(themesPath, [])) insertTheme(t);
    // 6. 迁移标记
    setMeta('json_migrated_at', String(Date.now()));
    setMeta('json_migrated_from', path.basename(jsonPath));
    setMeta('migrated_app_version', app.getVersion());
  });
  tx();                                  // 单事务：全成功或全回滚
  archiveLegacy(jsonPath);               // 移动到 data/legacy/store.json.<iso>.bak
  archiveLegacy(themesPath);
}
```

**安全策略：**
1. **单事务**：迁移中途崩溃 → 回滚 → 下次启动重走场景 B
2. **不删除原文件**：重命名归档到 `data/legacy/`，保留回滚能力
3. **数据清洗**：非法行（缺 id/title）跳过并计数，写入 `meta.migration_skipped`
4. **冲突保护**：场景 C 绝不覆盖已有 DB 数据
5. **幂等**：`INSERT OR IGNORE` + meta 标记双重防护

### 6.3 回滚与降级

- 设置/开发菜单提供「导出数据库为 JSON」，生成 `store-export.json`，供降级回 v1 使用
- legacy 目录保留最近 3 份备份，超出自动清理
- DB 打开失败（文件损坏）：重命名损坏文件为 `bamboo.db.corrupt-<ts>`，尝试从 legacy json 恢复，失败则建空库并系统通知

---

## 7. IPC / API 演进（两阶段）

### Phase 1：存储替换，接口兼容（本次实施）

- `store:read` → 主进程 SELECT 全表组装为**与现有 JSON 完全相同的结构**返回
- `store:write` → 主进程单事务 diff 替换（delete-all + insert，事务保证原子）
- 渲染进程 `Store.js` **零改动**，风险最小
- 收益：原子写入、WAL 崩溃安全、二进制体积约为 JSON 的 40-60%

### Phase 2：查询下推（后续迭代，接口已预留）

新增细粒度 IPC，渲染进程 Store 退化为缓存层：

```
tasks:query(filter)   → SQL WHERE/ORDER/LIMIT（分页）
                        filter.view 取值以当前视图集为准：
                        my-day / important / next7 / tasks / calendar / list
                        （已计划视图已于 b78753e 移除，不再纳入）
tasks:create/update/delete
lists:*  tags:*  themes:*  settings:get/set
tags:usageCount(id)   → SELECT COUNT(*) FROM task_tags WHERE tag_id=?
                        （替代 Settings.deleteTag 中内存遍历 tasks 统计用量，
                          命中 idx_task_tags_tag 索引）
search:fts(q)         → FTS5 全文搜索（替代内存 includes）
```

Phase 2 解锁：万级任务分页加载、FTS 搜索、按标签/优先级 SQL 聚合统计。

**与 Dialog 异步流的衔接**：b78753e 后所有破坏性操作（删除任务/清单/标签、退出）
均为 `await dialog.confirm(...)` 的 Promise 流程。Phase 2 将同步 IPC 换成
异步细粒度 IPC 时，这些 await 点即天然插入位置，无需再改交互层。

---

## 8. 打包与 Workflow 适配

### 8.1 package.json 变更

```jsonc
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"          // 新增：运行时依赖
  },
  "scripts": {
    "postinstall": "electron-builder install-app-deps"   // 新增：按 Electron ABI 重建原生模块
  },
  "build": {
    "asarUnpack": ["**/*.node"],          // 新增：原生 .node 必须解包出 asar
    "npmRebuild": true,                   // 显式声明（默认 true）
    "files": [
      "main.js", "preload.js", "src/**/*", "assets/**/*"
      // 生产 node_modules 由 electron-builder 依赖分析自动包含，无需显式列出
    ]
  }
}
```

### 8.2 workflow 变更（.github/workflows/build.yml）

```yaml
    - name: Install dependencies
      run: npm ci

    - name: Rebuild native modules for Electron   # 新增（postinstall 已覆盖，显式步骤便于失败重试与日志定位）
      run: npx electron-builder install-app-deps

    - name: Build Windows installer
      run: npm run build:win

    - name: Verify native module packaged          # 新增：防 .node 漏打包
      run: |
        $p = "dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3"
        if (-not (Test-Path "$p/build/Release/better-sqlite3.node")) {
          throw "better-sqlite3 native binary missing in package"
        }
```

### 8.3 编译链路说明

```
npm ci
  └─ postinstall: electron-builder install-app-deps
       └─ prebuild-install --runtime=electron --abi=<Electron28 ABI>
            ├─ 命中 GitHub 预编译包 → 直接下载（秒级）
            └─ 未命中 → node-gyp 源码编译
                 ├─ windows-latest: VS2022 + Python3 预装 ✅
                 ├─ macOS runner: Xcode CLT 预装 ✅
                 └─ linux arm64 开发机: 需 gcc/make/python3（已具备）
```

### 8.4 升级安装数据路径稳定性

- `appId: com.bamboo.todo` 保持不变 → NSIS 覆盖安装后 `userData` 路径不变 → 旧 `store.json` 与新 `bamboo.db` 同目录，迁移检测成立
- 严禁变更 `productName`/`appId`，否则 userData 目录变化导致"找不到旧数据"

---

## 9. 测试计划

| 用例 | 内容 |
|------|------|
| 迁移正确性 | fixture store.json（含 tags/subtasks/settings）→ init → 断言行数、M:N 展开、settings KV |
| 迁移幂等 | 连续两次 init 不产生重复数据 |
| 中断恢复 | 迁移事务中注入异常 → 断言回滚 + 二次启动重迁成功 |
| 冲突策略 | db 有数据 + json 存在 → json 归档、db 数据不变 |
| 全新安装 | 无 json 无 db → 空库 schema version = 最新 |
| schema 升级 | v1 库 + v2 migration → user_version 递增、老数据保留 |
| e2e 迁移 | 带 legacy json 启动应用 → UI 显示迁移后任务 |
| e2e 对话流 | 迁移后经 Dialog 执行删除任务/删除清单/删除标签 → 断言 DB 行消失（b78753e 前 confirm() 会阻塞导致此类用例不可写，现已可覆盖） |

扩展既有零依赖测试套件（`tests/`），新增 `tests/migration.test.mjs`。
e2e 复用 `tests/helpers/fakedom.mjs`（已支持 `#dialog-overlay`）与
`tests/e2e/smoke-page.js` 的 Dialog 驱动能力（Enter 提交 / Escape 取消）。

---

## 10. 实施任务分解

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 1 | 引入 better-sqlite3，编写 db.js + migrations.js + schema v1 | - | 0.5d |
| 2 | repositories 五实体 + IPC handler 替换（Phase 1 兼容接口） | 1 | 1d |
| 3 | storage-init.js：JSON→SQLite 迁移 + legacy 归档 + 冲突策略 | 1 | 1d |
| 4 | 导出 DB→JSON 降级工具（菜单入口） | 2 | 0.5d |
| 5 | package.json / workflow 适配 + 打包验证（.node 在包内） | 1 | 0.5d |
| 6 | 迁移测试套件 + e2e（含 Dialog 驱动的删除流验证） | 3 | 1d |
| 7 | （Phase 2）查询下推 IPC + FTS5 + 分页 | 2 | 2d |

**总计 Phase 1：约 4.5 人日；Phase 2 另计 2 人日。**

---

## 11. 风险清单

| 风险 | 概率 | 缓解 |
|------|------|------|
| Electron ABI 预编译缺失导致 CI 编译失败 | 低 | runner 工具链预装；锁 better-sqlite3 版本与 Electron 版本组合 |
| asar 内 .node 无法加载 | 中 | asarUnpack + CI 验证步骤双保险 |
| 迁移数据丢失 | 低 | 单事务 + legacy 归档不删原文件 + 导出工具 |
| arm64 Linux 开发机无预编译 | 中 | 源码编译（工具链已具备）；失败时临时用 sql.js 兜底开发 |
| 用户降级回 v1 | 低 | 导出 JSON 工具 + legacy 备份 |

---

## 12. 基线与变更后影响分析（v1.1 新增）

### 12.1 基线定义

方案设计基线：`c8c305c`（fix: harden detail panel scroll retention when deleting a subtask）。
基线之后、实施之前的新增提交：

| 提交 | 内容 | 存储相关性 |
|------|------|-----------|
| `b78753e` | 新增 Dialog.js 替代 prompt()/confirm()；移除已计划视图；退出/删标签改异步确认 | 间接 |
| `0a416a1` | 侧边栏"新清单"图标与设置图标对齐 | 无 |

### 12.2 b78753e 影响评估

**1. 数据模型：零变更（schema 与映射不受影响）**

Store.js 的 diff 仅删除视图逻辑（`_matchesView` 的 planned 分支、`getCounts.planned`、
`getPlannedGroups()`），任务/清单/标签/子任务/设置的字段结构未变。
第 4 节 schema 与第 4.3 节字段映射**无需修改**，v1.0 设计继续有效。

**2. 视图集合变化 → 影响 Phase 2 查询接口**

当前智能视图集：`my-day / important / next7 / tasks / calendar` + 自定义清单。
已计划视图（含 Ctrl+Shift+P 绑定与菜单项）已删除，其快捷键让位给"窗口置顶"。
Phase 2 的 `tasks:query(filter)` 视图枚举已按新集合更新（第 7 节）。
对 Phase 1 无影响：`store:read` 组装的 JSON 结构不含视图定义。

**3. 交互异步化 → 利好 Phase 2 与测试**

- 所有破坏性操作改为 `await dialog.confirm/input(...)`（Promise）。
  Phase 2 细粒度异步 IPC 可直接嵌入这些 await 点，交互层零返工。
- `dialog.isOpen()` 时抑制全局快捷键、`App.dismissOverlays()` 优先关闭对话框——
  与存储层无耦合，迁移期间行为不变。
- Settings.deleteTag 新增"标签被 N 个任务使用"的用量提示（内存遍历统计），
  该查询在 Phase 2 下沉为 `tags:usageCount` SQL（第 7 节）。

**4. 测试能力增强 → 迁移测试计划扩充**

b78753e 前 `confirm()` 为原生同步对话框，e2e 无法驱动删除流（会永久挂起）；
现 Dialog 可被 fakedom/smoke-page 驱动（Enter 提交、Escape 取消、IME 守卫复用 BUG-47 修复）。
第 9 节据此新增"e2e 对话流"用例：迁移完成后经 UI 删除任务/清单/标签并断言 DB 状态。

**5. 退出流程**

退出确认由主进程 `requestExitConfirmation` + 渲染进程 `dialog.confirm` 共同完成
（Settings.quitApp）。该设置为 settings 表普通 KV，迁移映射不变。

### 12.3 0a416a1 影响评估

纯 CSS/图标对齐，无存储、无 IPC、无数据影响。仅记录于变更日志。

### 12.4 结论

- 第 4-6 节（schema / 版本管理 / JSON→SQLite 迁移）：**维持 v1.0 设计，无需改动**
- 第 7 节（API 演进）：视图枚举更新、新增 `tags:usageCount`、补充 Dialog 衔接说明
- 第 9-10 节（测试 / 任务分解）：新增 Dialog 驱动 e2e 用例
- 实施前基线复核点：若再有存储相关提交（字段增删、settings 新 key），
  须先更新第 4.3 节映射表再动工

---

## 13. 实施记录（Phase 1 已完成）

### 13.1 落地文件

| 文件 | 职责 |
|------|------|
| `src/main/migrations.js` | schema v1 DDL + `PRAGMA user_version` 迁移 runner |
| `src/main/mapper.js` | 纯函数：JSON↔行结构双向映射/清洗/组装 |
| `src/main/migrate-policy.js` | 纯函数：覆盖安装五场景判定 |
| `src/main/db.js` | 连接/PRAGMA/meta/dbHasData |
| `src/main/repositories/{lists,tasks,tags,themes,settings,index}.js` | 五实体仓储 + readStore/writeStore 事务 |
| `src/main/storage-init.js` | 启动迁移编排、legacy 归档与清理、app-state 播种 |
| `src/main/export-json.js` | DB→JSON 降级导出 |
| `src/main/package.json` | `type: commonjs` 作用域隔离（src/ 为 ESM） |

### 13.2 与方案的偏差

1. `better-sqlite3@11.10.0` 在 linux-arm64 / Electron 28 存在官方预编译包，
   开发与 CI 均无需源码编译（`install prebuilt binary`）
2. 场景判定与映射逻辑抽为纯模块（migrate-policy/mapper），
   使零依赖单元测试无需加载原生模块
3. 迁移成功后播种 `app-state.json`（v1 的 alwaysOnTop 等设置不丢失）

### 13.3 验证结果

- 单元测试 `tests/migration.test.mjs`：10/10 通过
- e2e 冒烟（含 SQLite 断言）：134 项 0 失败
- 迁移 e2e 三场景（migrate/conflict/fresh）：全部通过
- 打包校验：`app.asar.unpacked/node_modules/better-sqlite3/.../better_sqlite3.node` 存在
- 全量 `npm test`：9 个测试任务通过

### 13.4 遗留

- Phase 2（查询下推 + FTS5 + 分页）按方案第 7 节留待后续迭代