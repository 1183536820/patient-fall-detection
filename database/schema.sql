-- 创建数据库
CREATE DATABASE IF NOT EXISTS fall_detection_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fall_detection_system;

-- 患者表
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(20) PRIMARY KEY COMMENT '患者ID，如P001',
    name VARCHAR(100) NOT NULL COMMENT '患者姓名',
    age INT NOT NULL COMMENT '年龄',
    gender ENUM('男', '女') NOT NULL COMMENT '性别',
    room_number VARCHAR(50) NOT NULL COMMENT '房间号',
    bed_number VARCHAR(50) NOT NULL COMMENT '床号',
    admission_date DATE NOT NULL COMMENT '入院日期',
    status ENUM('active', 'discharged') DEFAULT 'active' COMMENT '状态：在院/出院',
    diagnosis TEXT COMMENT '主要诊断',
    fall_risk_level ENUM('low', 'medium', 'high') DEFAULT 'medium' COMMENT '跌倒风险等级',
    allergies TEXT COMMENT '过敏史',
    special_care TEXT COMMENT '特殊护理需求',
    emergency_contact_name VARCHAR(100) COMMENT '紧急联系人姓名',
    emergency_contact_relationship VARCHAR(50) COMMENT '关系',
    emergency_contact_phone VARCHAR(20) COMMENT '联系电话',
    avatar VARCHAR(255) COMMENT '头像路径',
    created_at BIGINT DEFAULT 0 COMMENT '创建时间戳',
    updated_at BIGINT DEFAULT 0 COMMENT '更新时间戳',
    INDEX idx_name (name),
    INDEX idx_room (room_number),
    INDEX idx_status (status),
    INDEX idx_risk_level (fall_risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='患者信息表';

-- 跌倒历史记录表
CREATE TABLE IF NOT EXISTS fall_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL COMMENT '患者ID',
    fall_date DATE NOT NULL COMMENT '跌倒日期',
    severity ENUM('mild', 'moderate', 'severe') NOT NULL COMMENT '严重程度',
    description TEXT COMMENT '跌倒描述',
    actions_taken TEXT COMMENT '处理措施',
    video_url VARCHAR(255) COMMENT '关联视频路径',
    created_at BIGINT DEFAULT 0 COMMENT '创建时间戳',
    updated_at BIGINT DEFAULT 0 COMMENT '更新时间戳',
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_date (fall_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='患者跌倒历史表';

-- 事件记录表
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(50) PRIMARY KEY COMMENT '事件ID',
    type VARCHAR(50) NOT NULL COMMENT '事件类型：fall/bend/tilt/single_leg',
    severity VARCHAR(20) NOT NULL COMMENT '严重程度',
    camera_id VARCHAR(50) NOT NULL COMMENT '摄像头ID',
    patient_id VARCHAR(20) COMMENT '关联患者ID',
    video_url VARCHAR(255) COMMENT '视频路径',
    duration FLOAT DEFAULT 0 COMMENT '持续时间(秒)',
    timestamp BIGINT NOT NULL COMMENT '时间戳',
    status ENUM('active', 'acknowledged', 'dismissed') DEFAULT 'active' COMMENT '状态',
    extra_info JSON COMMENT '额外信息',
    created_at BIGINT DEFAULT 0 COMMENT '创建时间戳',
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    INDEX idx_type (type),
    INDEX idx_camera (camera_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='事件记录表';

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    level VARCHAR(20) NOT NULL COMMENT '日志级别',
    message TEXT NOT NULL COMMENT '日志消息',
    module VARCHAR(100) COMMENT '模块',
    meta JSON COMMENT '元数据',
    created_at BIGINT DEFAULT 0 COMMENT '创建时间戳',
    INDEX idx_level (level),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统日志表';

-- 插入示例患者数据
INSERT INTO patients (id, name, age, gender, room_number, bed_number, admission_date, status, diagnosis, fall_risk_level, allergies, special_care, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, created_at) VALUES
('P001', '张三', 82, '男', '301', '1', '2024-04-01', 'active', '高血压、骨质疏松', 'high', '青霉素', '需要辅助行走', '张小明', '儿子', '13800138001', UNIX_TIMESTAMP(NOW()) * 1000),
('P002', '李四', 75, '女', '301', '2', '2024-04-05', 'active', '糖尿病、关节炎', 'medium', '无', '需要定期监测血糖', '李小红', '女儿', '13900139001', UNIX_TIMESTAMP(NOW()) * 1000),
('P003', '王五', 68, '男', '302', '1', '2024-03-20', 'discharged', '脑梗塞后遗症', 'high', '磺胺类药物', '需要轮椅辅助', '王小华', '孙子', '13700137001', UNIX_TIMESTAMP(NOW()) * 1000),
('P004', '赵六', 91, '女', '302', '2', '2024-02-15', 'active', '阿尔茨海默症', 'high', '无', '需要24小时陪护', '赵建国', '儿子', '13600136001', UNIX_TIMESTAMP(NOW()) * 1000)
ON DUPLICATE KEY UPDATE updated_at = UNIX_TIMESTAMP(NOW()) * 1000;

-- 插入示例跌倒历史记录
INSERT INTO fall_history (patient_id, fall_date, severity, description, actions_taken, created_at) VALUES
('P001', '2024-04-15', 'moderate', '在卫生间滑倒', '冰敷处理，观察24小时', UNIX_TIMESTAMP(NOW()) * 1000),
('P003', '2024-03-25', 'severe', '从床上跌落', '送医检查，住院观察', UNIX_TIMESTAMP(NOW()) * 1000)
ON DUPLICATE KEY UPDATE updated_at = UNIX_TIMESTAMP(NOW()) * 1000;

-- 显示表信息
SHOW TABLES;
DESCRIBE patients;
DESCRIBE fall_history;
DESCRIBE events;
DESCRIBE system_logs;
