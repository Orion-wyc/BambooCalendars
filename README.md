# BambooCalendars (质日) - 使用指南

## 项目简介

BambooCalendars（质日）是一个现代化的 Todo 管理应用，支持任务管理、附件上传、图片预览等功能。

## 技术栈

### 后端
- Flask 3.0+ (Python Web 框架)
- SQLAlchemy (ORM)
- SQLite (数据库)
- JWT (认证)
- Pillow (图片处理)

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- Ant Design 5.x (UI 组件库)
- React Query (数据获取)
- Zustand (状态管理)
- Axios (HTTP 客户端)

## 快速开始

### 1. 后端启动

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（首次运行）
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖（首次运行）
pip install -r requirements.txt

# 初始化数据库（首次运行）
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# 启动后端服务
python run.py
```

后端服务将在 `http://localhost:5000` 启动

### 2. 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖（首次运行）
npm install

# 启动前端开发服务器
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

## 访问应用

打开浏览器访问：`http://localhost:5173`

首次使用需要注册账号：
- 点击"立即注册"
- 填写用户名、邮箱和密码
- 注册成功后自动登录

## 功能说明

### 核心功能

1. **用户认证**
   - 用户注册和登录
   - JWT Token 认证
   - 自动登录状态保持

2. **任务管理**
   - 创建、编辑、删除任务
   - 设置任务优先级（高、中、低）
   - 设置截止日期
   - 标记任务完成/未完成
   - 任务搜索和筛选

3. **附件管理**
   - 上传文件附件
   - 支持图片、文档等多种格式
   - 图片自动压缩和缩略图生成
   - 文件下载功能
   - 图片预览功能

4. **用户界面**
   - 现代化的卡片式布局
   - 响应式设计，支持移动端
   - 搜索和筛选功能
   - 流畅的动画效果

## API 端点

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/logout` - 用户登出

### Todo 相关
- `GET /api/todos` - 获取任务列表
- `GET /api/todos/:id` - 获取单个任务
- `POST /api/todos` - 创建任务
- `PUT /api/todos/:id` - 更新任务
- `DELETE /api/todos/:id` - 删除任务
- `PATCH /api/todos/:id/complete` - 切换完成状态

### 附件相关
- `GET /api/attachments/todo/:id` - 获取任务的附件列表
- `POST /api/attachments/todo/:id` - 上传附件
- `GET /api/attachments/:id` - 获取附件详情
- `GET /api/attachments/:id/download` - 下载附件
- `GET /api/attachments/:id/preview` - 预览附件（图片）
- `DELETE /api/attachments/:id` - 删除附件

## 项目结构

### 后端结构
```
backend/
├── app/
│   ├── __init__.py          # Flask 应用工厂
│   ├── config.py            # 配置管理
│   ├── models/              # 数据模型
│   │   ├── user.py
│   │   ├── todo.py
│   │   └── attachment.py
│   ├── api/                 # API 路由
│   │   ├── auth.py
│   │   ├── todos.py
│   │   └── attachments.py
│   ├── services/            # 业务逻辑
│   │   └── auth_service.py
│   └── utils/               # 工具函数
│       ├── decorators.py
│       └── helpers.py
├── migrations/              # 数据库迁移
├── uploads/                 # 上传文件存储
├── requirements.txt         # Python 依赖
├── .env                     # 环境变量
└── run.py                   # 应用入口
```

### 前端结构
```
frontend/
├── src/
│   ├── main.tsx             # 应用入口
│   ├── App.tsx              # 根组件
│   ├── components/           # 通用组件
│   ├── pages/               # 页面组件
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── TodoDetailPage.tsx
│   ├── services/            # API 服务
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── todoService.ts
│   │   └── attachmentService.ts
│   ├── store/               # 状态管理
│   │   ├── authStore.ts
│   │   └── todoStore.ts
│   ├── types/               # TypeScript 类型
│   │   └── index.ts
│   └── styles/              # 样式文件
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 配置说明

### 后端配置 (.env)
```env
FLASK_APP=app
FLASK_ENV=development
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
DATABASE_URL=sqlite:///bamboo.db
UPLOAD_FOLDER=./uploads
MAX_CONTENT_LENGTH=10485760  # 10MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp,pdf,doc,docx,txt,md,zip,rar
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 前端配置
前端通过 Vite 代理配置与后端通信，无需额外配置。

## 开发说明

### 后端开发
- 使用 Flask 蓝图组织路由
- 使用 SQLAlchemy ORM 进行数据库操作
- 使用 JWT 进行用户认证
- 使用 Pillow 处理图片

### 前端开发
- 使用 React 18 和 TypeScript
- 使用 Ant Design 组件库
- 使用 React Query 管理服务器状态
- 使用 Zustand 管理客户端状态
- 使用 React Router 进行路由管理

## 测试

### 后端测试
```bash
cd backend
source venv/bin/activate
# 运行测试（需要先编写测试用例）
pytest
```

### 前端测试
```bash
cd frontend
# 运行测试（需要先编写测试用例）
npm test
```

## 部署

### 生产环境部署

#### 后端部署
1. 使用 Gunicorn 作为 WSGI 服务器
2. 使用 Nginx 作为反向代理
3. 配置 HTTPS
4. 使用 PostgreSQL 替代 SQLite

#### 前端部署
1. 构建生产版本：`npm run build`
2. 使用 Nginx 静态文件服务
3. 配置路由重写

## 常见问题

### 后端启动失败
- 检查 Python 版本（需要 3.9+）
- 检查依赖是否正确安装
- 检查数据库是否正确初始化

### 前端启动失败
- 检查 Node.js 版本（需要 14+）
- 检查依赖是否正确安装
- 检查后端服务是否正常运行

### 文件上传失败
- 检查文件大小是否超过限制
- 检查文件类型是否被允许
- 检查上传目录权限

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

如有问题，请提交 Issue。