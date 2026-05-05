# MySQL数据库设置指南

本项目支持MySQL数据库存储患者数据，以下是设置指南。

## 前置条件

1. 安装MySQL服务器
2. 安装MySQL Workbench（可选，用于管理数据库）
3. 确保Node.js环境已准备好

## 步骤1: 安装MySQL依赖

在项目根目录运行:

```bash
npm install mysql2
```

## 步骤2: 设置数据库

### 方式一: 使用MySQL Workbench

1. 打开MySQL Workbench
2. 连接到你的MySQL服务器
3. 点击 File -> Open SQL Script
4. 选择 `database/schema.sql` 文件
5. 点击闪电图标执行SQL脚本
6. 确认数据库和表已创建

### 方式二: 使用命令行

```bash
mysql -u root -p < database/schema.sql
```

## 步骤3: 配置环境变量

在项目根目录的 `.env` 文件中添加或修改以下配置:

```env
# 数据库类型设置为 mysql
DB_TYPE=mysql

# MySQL数据库连接配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的密码
MYSQL_DATABASE=fall_detection_system
```

如果 `.env` 文件不存在，请从 `.env.example` 复制。

## 步骤4: 验证数据库连接

启动后端服务器:

```bash
npm run dev:server
```

检查控制台输出，应该看到类似信息:

```
[DB] 使用数据库类型: mysql
[MySQL] 数据库连接成功!
```

## 数据库结构说明

### patients表
患者基本信息表，包含:
- id: 患者ID，格式如P001
- name: 姓名
- age: 年龄
- gender: 性别
- roomNumber: 房间号
- bedNumber: 床号
- admissionDate: 入院日期
- status: 状态 (active/discharged)
- diagnosis: 诊断
- fallRiskLevel: 跌倒风险等级 (low/medium/high)
- allergies: 过敏史
- specialCare: 特殊护理
- emergencyContactName: 紧急联系人姓名
- emergencyContactRelationship: 关系
- emergencyContactPhone: 电话
- createdAt: 创建时间

### fall_history表
患者跌倒历史记录，包含:
- patientId: 患者ID(外键关联)
- fallDate: 跌倒日期
- severity: 严重程度 (mild/moderate/severe)
- description: 描述
- actionsTaken: 处理措施
- videoUrl: 关联视频

### events表
事件记录表
### system_logs表
系统日志表

## 数据迁移(可选)

如果你想保留原JSON数据库的数据，可以通过以下方式迁移:

1. 确保 `server/data/db.json` 文件存在
2. 启动服务器时先使用 `DB_TYPE=json`
3. 通过API导出数据，再导入MySQL

## 切换回JSON数据库

如需切换回JSON数据库，只需修改 `.env` 文件:

```env
DB_TYPE=json
```

重启服务器即可。

## 常见问题

### Q: 连接数据库失败
A: 检查以下几点:
1. MySQL服务是否正在运行
2. 用户名和密码是否正确
3. 数据库名是否存在
4. 检查防火墙设置

### Q: 如何修改表结构
A: 修改 `database/schema.sql` 后，重新执行或使用ALTER TABLE语句

### Q: 如何备份数据库
A: 使用以下命令备份:
```bash
mysqldump -u root -p fall_detection_system > backup.sql
```
