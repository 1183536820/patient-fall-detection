本文件夹存放作品的文档说明及相关资料。

文件说明：
1. readme.txt                   - 本文件，简要说明文件夹作用及文件描述
2. (项目根目录README.md)         - 项目总说明文档，包含项目简介、技术栈、安装步骤、API接口等完整说明

项目根目录各模块说明：

一、源代码部分（作品团队自主研发）

【★ 核心/代表性代码 ★】标记如下：

====== Python AI检测引擎（核心算法） ======

├── python/                     # Python AI检测脚本
│   ├── ★ fall_detect.py          - 【核心】视频文件跌倒检测脚本。
│   │                              YOLOv8-pose人体姿态估计，肩髋距离+身体角度双判据跌倒判定，
│   │                              支持可调置信度/阈值/角度参数，输出JSON检测结果。
│   │                              
│   └── ★ fall_detect_stream.py   - 【核心】实时流式跌倒检测脚本。
│                                  读取Base64图像帧→调用YOLO模型推理→关键点分析→
│                                  跌倒/弯腰/倾斜判定→JSON结果输出，支持进程间管道通信。

====== 后端Node.js服务（核心业务逻辑） ======

├── server/                     # 后端Express + Node.js源码
│   ├── ★ index.js                - 【核心】服务器主入口。包含：
│   │                              ① 全部API路由（登录/检测/上传/事件/患者管理）
│   │                              ② WebSocket实时广播系统
│   │                              ③ Python检测进程管理（启动/停止/重启/消息队列）
│   │                              ④ 文件上传、日志查询、统计分析
│   │                              
│   ├── auth.js                 - JWT认证模块（登录验证、Token签发、权限中间件）
│   ├── prompts.js              - DeepSeek AI视频报告提示词模板
│   ├── yoloDetector.js         - YOLO检测器封装（Python subprocess调用）
│   ├── db/
│   │   ├── index.js            - JSON数据库(lowdb)操作
│   │   └── mysql.js            - MySQL数据库操作
│   └── utils/
│       ├── logger.js           - Winston日志工具
│       └── logs.js             - 日志查询接口

====== 前端Vue 3 + TypeScript（核心功能页面） ======

├── src/                        # 前端Vue 3 + TypeScript源码
│   ├── views/                  # 页面组件
│   │   ├── ★ Camera.vue          - 【核心】实时监控页面。
│   │   │                         摄像头调用、单路/四路宫格切换、实时帧捕获→后端检测→
│   │   │                         结果叠加显示、跌倒告警弹窗、循环录制触发
│   │   │                         
│   │   ├── ★ Video.vue           - 【核心】视频分析页面。
│   │   │                         视频上传→AI分析→结果展示、检测参数调优界面、
│   │   │                         分析进度实时推送、检测历史查看
│   │   │                         
│   │   ├── Analytics.vue       - 数据分析可视化（ECharts统计图表）
│   │   ├── Events.vue          - 事件记录与查询列表
│   │   ├── DeepSeek.vue        - DeepSeek AI对话页面
│   │   ├── Home.vue            - 首页/仪表盘
│   │   ├── Login.vue           - 登录页面
│   │   ├── Logs.vue            - 系统日志页面
│   │   ├── MedicalQA.vue       - 医疗问答页面
│   │   ├── PatientRecords.vue  - 患者档案管理页面
│   │   ├── Settings.vue        - 系统设置页面
│   │   └── UserManagement.vue  - 用户管理页面
│   │                             
│   ├── composables/            # 组合式函数（核心逻辑层）
│   │   ├── ★ useWebSocket.ts     - 【核心】WebSocket实时通信。
│   │   │                         指数退避断线重连、消息分类分发、状态管理联动
│   │   │                         
│   │   ├── ★ useLoopRecording.ts - 【核心】循环录制系统。
│   │   │                         环形缓冲区（保留最近30秒）、跌倒触发自动上传、
│   │   │                         失败重试机制、Blob合并与本地回退
│   │   │                         
│   │   └── useAlertSound.ts    - 告警音效播放控制
│   │                             
│   ├── stores/                 # Pinia状态管理
│   │   ├── auth.ts             - 认证状态管理
│   │   └── ★ detection.ts        - 【核心】检测状态管理。
│   │                              AI参数配置持久化（置信度/灵敏度/角度阈值等8项参数）、
│   │                              多层告警规则引擎（弹窗/音效/WebSocket/邮件/短信）、
│   │                              跌倒事件管理与主题切换
│   │                             
│   ├── components/common/
│   │   └── AlertModal.vue      - 告警弹窗组件
│   ├── locales/                - 国际化语言包（中/英）
│   ├── router/index.ts         - 前端路由配置
│   ├── utils/                  - 工具函数
│   ├── workers/detection.worker.ts - 检测Web Worker
│   ├── App.vue                 - Vue应用根组件
│   └── main.ts                 - Vue应用入口文件

├── database/
│   └── schema.sql              - MySQL数据库建表脚本

├── 配置文件
│   ├── .env.example            - 环境变量模板
│   ├── Dockerfile              - Docker容器构建文件
│   ├── docker-compose.yml       - Docker Compose编排配置
│   ├── nginx.conf              - Nginx反向代理配置
│   ├── vite.config.ts          - Vite构建配置
│   ├── tsconfig.json           - TypeScript配置
│   ├── tsconfig.node.json      - Node端TypeScript配置
│   ├── package.json            - 项目依赖与脚本
│   ├── index.html              - HTML入口文件
│   └── .gitignore              - Git忽略规则

二、代表性素材说明

当前作品中未包含图片、视频、音乐等外部素材文件。
AI检测模型文件 yolov8n-pose.pt 为开源预训练模型，
属于外部依赖，不计入作品源码。

三、作品与答辩材料

- Docker部署方案：支持 docker-compose up -d --build 一键部署
- 本地运行：详见 README.md 安装步骤说明
- 访问地址：
  前端：http://localhost:5173
  后端API：http://localhost:3000
