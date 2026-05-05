# 视觉目标检测驱动的患者行为分析与跌倒预警系统

## 📋 项目简介

本系统基于 YOLOv8-pose 模型和 Vue 3 + TypeScript + Express 框架，实现了实时患者行为分析与跌倒预警功能。系统支持多路摄像头监控、AI 智能检测、自动录制、告警通知等核心功能，为医疗护理提供智能化的安全保障。

## 🛠️ 技术栈

### 前端
- **框架**: Vue 3.5 + TypeScript 5.6
- **状态管理**: Pinia 3.0
- **路由**: Vue Router 4.4
- **图表**: ECharts 6.0 + vue-echarts
- **实时通信**: WebSocket
- **构建工具**: Vite 6.0
- **UI**: 响应式设计，支持明暗主题

### 后端
- **框架**: Express 4.22 + Node.js 18
- **认证**: JWT + bcryptjs 密码哈希
- **数据库**: lowdb (JSON 文件存储)
- **AI 检测**: Python 3 + YOLOv8-pose (ultralytics)
- **WebSocket**: ws 8.20
- **速率限制**: express-rate-limit
- **文件上传**: multer

## 📱 功能列表

### 核心功能
- ✅ **实时监控**: 支持单路和 4 路宫格模式
- ✅ **AI 跌倒检测**: 基于 YOLOv8-pose 人体姿态估计
- ✅ **自动录制**: 跌倒事件自动保存视频片段
- ✅ **告警通知**: 实时弹窗和音效告警
- ✅ **视频分析**: 上传视频进行离线 AI 分析

### 安全功能
- ✅ **JWT 认证**: 安全的用户身份验证
- ✅ **密码哈希**: bcryptjs 加密存储
- ✅ **速率限制**: 登录接口防暴力破解
- ✅ **CORS 限制**: 可配置的安全跨域策略
- ✅ **全局错误处理**: 统一异常捕获和日志记录

### 数据功能
- ✅ **患者管理**: CRUD 患者档案
- ✅ **事件记录**: 跌倒事件持久化存储
- ✅ **数据可视化**: 实时数据面板和统计图表

## 🚀 环境要求

| 组件 | 版本要求 |
|------|---------|
| Node.js | >= 18.0 |
| Python | >= 3.8 |
| npm | >= 8.0 |
| pip | >= 20.0 |
| Docker | >= 20.0 (可选) |

## 🔧 安装步骤

### 方式一：本地运行

#### 1. 克隆项目
```bash
git clone <repository-url>
cd bisai4
```

#### 2. 安装前端依赖
```bash
npm install
```

#### 3. 安装 Python 依赖
```bash
pip install ultralytics opencv-python numpy
```

#### 4. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，修改 JWT_SECRET 为安全的随机字符串
```

#### 5. 启动后端服务
```bash
npm run dev:server
```

#### 6. 启动前端服务（新终端）
```bash
npm run dev
```

#### 7. 访问系统
- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3000

### 方式二：Docker 部署（推荐）

#### 1. 构建并运行
```bash
docker-compose up -d --build
```

#### 2. 访问系统
- **前端**: http://localhost (80 端口)
- **后端 API**: http://localhost:3000

#### 3. 停止服务
```bash
docker-compose down
```

## 🔐 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 护士 | nurse | nurse123 |

## 📁 项目结构

```
├── src/                    # 前端 Vue 3 源码
│   ├── views/              # 页面组件
│   │   ├── Camera.vue      # 实时监控页面
│   │   ├── Video.vue       # 视频分析页面
│   │   ├── Events.vue      # 事件记录页面
│   │   └── ...
│   ├── components/         # 通用组件
│   ├── stores/             # Pinia 状态管理
│   ├── composables/         # Vue Composables
│   └── utils/              # 工具函数
├── server/                 # 后端 Express 源码
│   ├── index.js            # 服务器入口
│   ├── auth.js             # 认证模块
│   ├── db/                 # 数据库模块
│   └── data/               # JSON 数据文件
├── python/                 # Python AI 检测
│   └── fall_detect.py      # 跌倒检测脚本
├── dist/                   # 构建输出（Git 提交时忽略）
├── uploads/                # 上传文件目录
├── falls_videos/           # 跌倒视频目录
├── .env                    # 环境变量（不提交到 Git）
├── Dockerfile              # Docker 构建文件
├── docker-compose.yml      # Docker Compose 配置
└── nginx.conf              # Nginx 反向代理配置
```

## 🌐 API 接口

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 用户登录 |
| POST | /api/settings/api-key | 配置 API Key |
| GET | /api/settings/api-key-status | 获取 API Key 状态 |

### 患者管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/patients | 获取患者列表 |
| GET | /api/patients/:id | 获取单个患者 |
| POST | /api/patients | 创建患者 |
| PUT | /api/patients/:id | 更新患者 |
| DELETE | /api/patients/:id | 删除患者 |

### 事件管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/events | 获取事件列表 |
| POST | /api/events | 创建事件 |
| PUT | /api/events/:id | 更新事件 |
| DELETE | /api/events/:id | 删除事件 |

### 检测接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/detect | 跌倒检测 |
| POST | /api/upload | 视频上传并检测 |
| POST | /api/upload-fall | 跌倒视频上传 |
| GET | /api/videos | 获取视频列表 |

## 🐳 Docker 部署说明

### 前置要求
- 安装 Docker Engine >= 20.0
- 安装 Docker Compose >= 2.0

### 部署步骤

#### 1. 修改生产环境配置
编辑 `docker-compose.yml` 中的环境变量：
```yaml
environment:
  - JWT_SECRET=your-very-secure-random-secret-key-here
  - CORS_ORIGIN=https://your-production-domain.com
```

#### 2. 构建并启动
```bash
docker-compose up -d --build
```

#### 3. 查看日志
```bash
docker-compose logs -f
```

#### 4. 更新部署
```bash
git pull origin main
docker-compose up -d --build
```

### 数据持久化
以下目录会持久化到宿主机：
- `./uploads` - 上传的视频文件
- `./falls_videos` - 跌倒事件视频
- `./server/data` - 数据库文件

## 🔒 安全配置

### 生产环境必须修改的项

1. **JWT_SECRET**: 在 `.env` 文件中设置强密码
   ```bash
   JWT_SECRET=$(openssl rand -base64 64)
   ```

2. **CORS_ORIGIN**: 设置为实际的前端域名
   ```bash
   CORS_ORIGIN=https://your-production-domain.com
   ```

3. **DeepSeek API Key**: 在设置页面配置第三方 API 密钥

### 安全特性

- ✅ 密码 bcrypt 哈希存储
- ✅ JWT Token 认证
- ✅ 登录速率限制（15 分钟内最多 5 次）
- ✅ CORS 源限制
- ✅ 全局错误处理和日志记录

## 📊 性能说明

### 检测性能
- YOLOv8n-pose 模型：约 12MB，轻量快速
- 快速模式：每 1 秒处理 1 帧
- 标准模式：每 0.5 秒处理 1 帧
- 支持 GPU 加速（需要 CUDA 环境）

### 系统要求
- **开发环境**: 4GB RAM, 2 CPU cores
- **生产环境**: 8GB RAM, 4 CPU cores
- **存储**: 根据视频量，建议预留 50GB+

## 📝 注意事项

1. **首次运行**: Python 模型会自动下载（约 12MB）
2. **摄像头权限**: 浏览器需要摄像头访问权限
3. **HTTPS**: 生产环境建议使用 HTTPS
4. **数据库备份**: 定期备份 `server/data/db.json`

## 🏆 比赛演示流程

### 快速启动
```bash
# 克隆并安装
git clone <repo>
npm install

# 配置环境
cp .env.example .env

# 启动后端
npm run dev:server

# 启动前端（新终端）
npm run dev
```

### 演示步骤

1. **登录系统**: http://localhost:5173
   - 管理员账号: admin / admin123

2. **实时监控**: 打开 Camera 页面，切换到宫格模式

3. **模拟跌倒**: 在摄像头前做跌倒动作，观察告警

4. **视频分析**: 上传测试视频，查看 AI 分析结果

5. **事件查看**: 查看事件记录和统计数据

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License