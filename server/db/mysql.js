import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 数据库连接配置
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'fall_detection_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 数据库初始化函数
export async function initMysqlDb() {
  try {
    const connection = await pool.getConnection();
    console.log('[MySQL] 数据库连接成功!');
    connection.release();
    
    // 自动创建表结构
    await initDatabaseSchema();
    return true;
  } catch (error) {
    console.error('[MySQL] 数据库连接失败:', error.message);
    return false;
  }
}

// 自动创建数据库表（如不存在）
async function initDatabaseSchema() {
  const createPatientsTable = `
    CREATE TABLE IF NOT EXISTS patients (
      id VARCHAR(20) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      age INT NOT NULL,
      gender ENUM('男', '女') NOT NULL,
      room_number VARCHAR(50) NOT NULL,
      bed_number VARCHAR(50) NOT NULL,
      admission_date DATE NOT NULL,
      status ENUM('active', 'discharged') DEFAULT 'active',
      diagnosis TEXT,
      fall_risk_level ENUM('low', 'medium', 'high') DEFAULT 'medium',
      allergies TEXT,
      special_care TEXT,
      emergency_contact_name VARCHAR(100),
      emergency_contact_relationship VARCHAR(50),
      emergency_contact_phone VARCHAR(20),
      avatar VARCHAR(255),
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_name (name),
      INDEX idx_room (room_number),
      INDEX idx_status (status),
      INDEX idx_risk_level (fall_risk_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const createFallHistoryTable = `
    CREATE TABLE IF NOT EXISTS fall_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id VARCHAR(20) NOT NULL,
      fall_date DATE NOT NULL,
      severity ENUM('mild', 'moderate', 'severe') NOT NULL,
      description TEXT,
      actions_taken TEXT,
      video_url VARCHAR(255),
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      INDEX idx_patient (patient_id),
      INDEX idx_date (fall_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const createEventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(50) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      camera_id VARCHAR(50) NOT NULL,
      patient_id VARCHAR(20),
      video_url VARCHAR(255),
      duration FLOAT DEFAULT 0,
      timestamp BIGINT NOT NULL,
      status ENUM('active', 'acknowledged', 'dismissed') DEFAULT 'active',
      extra_info JSON,
      created_at BIGINT DEFAULT 0,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
      INDEX idx_type (type),
      INDEX idx_camera (camera_id),
      INDEX idx_timestamp (timestamp),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const createSystemLogsTable = `
    CREATE TABLE IF NOT EXISTS system_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      level VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      module VARCHAR(100),
      meta JSON,
      created_at BIGINT DEFAULT 0,
      INDEX idx_level (level),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'nurse') DEFAULT 'nurse',
      name VARCHAR(100) DEFAULT '',
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_username (username),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  try {
    await query(createPatientsTable)
    await query(createFallHistoryTable)
    await query(createEventsTable)
    await query(createSystemLogsTable)
    await query(createUsersTable)
    console.log('[MySQL] 数据库表结构初始化完成')
  } catch (error) {
    console.warn('[MySQL] 表结构初始化失败（可能无权限），将使用JSON数据库模式:', error.message)
  }
}

// 获取连接池
export function getMysqlPool() {
  return pool;
}

// 执行查询
export async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('[MySQL] 查询失败:', error.message);
    console.error('[MySQL] SQL:', sql);
    throw error;
  }
}

// 获取单个结果
export async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// 执行插入并返回ID
export async function insert(sql, params = []) {
  const result = await query(sql, params);
  return result.insertId;
}

// 关闭连接池
export async function closePool() {
  await pool.end();
}

// ==================== 患者相关操作 ====================

// 获取所有患者
export async function getAllPatients(search = null, room = null, condition = null) {
  let sql = 'SELECT * FROM patients WHERE 1=1';
  const params = [];
  
  if (search) {
    sql += ' AND (name LIKE ? OR id LIKE ? OR room_number LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  if (room) {
    sql += ' AND room_number = ?';
    params.push(room);
  }
  
  // 注意：原数据库中没有condition字段,我们使用fall_risk_level替代
  if (condition) {
    sql += ' AND fall_risk_level = ?';
    params.push(condition);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const patients = await query(sql, params);
  
  // 为每个患者获取跌倒历史
  for (let patient of patients) {
    patient.fallHistory = await getFallHistoryByPatientId(patient.id);
  }
  
  return patients;
}

// 根据ID获取患者
export async function getPatientById(id) {
  const patient = await getOne('SELECT * FROM patients WHERE id = ?', [id]);
  
  if (patient) {
    // 获取跌倒历史
    patient.fallHistory = await getFallHistoryByPatientId(id);
  }
  
  return patient;
}

// 创建新患者
export async function createPatient(patientData) {
  const now = Date.now();
  
  const sql = `
    INSERT INTO patients (
      id, name, age, gender, room_number, bed_number, admission_date, status,
      diagnosis, fall_risk_level, allergies, special_care,
      emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    patientData.id,
    patientData.name,
    patientData.age,
    patientData.gender,
    patientData.roomNumber || patientData.room,
    patientData.bedNumber || patientData.bed,
    patientData.admissionDate,
    patientData.status || 'active',
    patientData.diagnosis || null,
    patientData.fallRiskLevel || patientData.fall_risk_level || 'medium',
    patientData.allergies || null,
    patientData.specialCare || patientData.special_care || null,
    patientData.emergencyContact?.name || null,
    patientData.emergencyContact?.relationship || null,
    patientData.emergencyContact?.phone || null,
    now,
    now
  ];
  
  await query(sql, params);
  
  // 如果有跌倒历史,添加它们
  if (patientData.fallHistory && patientData.fallHistory.length > 0) {
    for (let history of patientData.fallHistory) {
      await createFallHistory(patientData.id, history);
    }
  }
  
  return await getPatientById(patientData.id);
}

// 更新患者
export async function updatePatient(id, updates) {
  const now = Date.now();
  
  // 构建更新语句
  const updateFields = [];
  const params = [];
  
  // 映射前端字段到数据库字段
  const fieldMapping = {
    roomNumber: 'room_number',
    bedNumber: 'bed_number',
    admissionDate: 'admission_date',
    fallRiskLevel: 'fall_risk_level',
    specialCare: 'special_care',
    emergencyContact: 'emergency_contact'
  };
  
  for (let key in updates) {
    if (key === 'id' || key === 'createdAt' || key === 'fallHistory') continue;
    
    let dbField = fieldMapping[key] || key;
    
    // 处理紧急联系人对象
    if (key === 'emergencyContact' && typeof updates[key] === 'object') {
      const contact = updates[key];
      if (contact.name !== undefined) {
        updateFields.push('emergency_contact_name = ?');
        params.push(contact.name);
      }
      if (contact.relationship !== undefined) {
        updateFields.push('emergency_contact_relationship = ?');
        params.push(contact.relationship);
      }
      if (contact.phone !== undefined) {
        updateFields.push('emergency_contact_phone = ?');
        params.push(contact.phone);
      }
    } else {
      updateFields.push(`${dbField} = ?`);
      params.push(updates[key]);
    }
  }
  
  if (updateFields.length === 0) return null;
  
  updateFields.push('updated_at = ?');
  params.push(now);
  params.push(id);
  
  const sql = `UPDATE patients SET ${updateFields.join(', ')} WHERE id = ?`;
  await query(sql, params);
  
  // 处理跌倒历史的更新(简化处理:替换整个列表)
  if (updates.fallHistory) {
    await deleteFallHistoryByPatientId(id);
    for (let history of updates.fallHistory) {
      await createFallHistory(id, history);
    }
  }
  
  return await getPatientById(id);
}

// 删除患者
export async function deletePatient(id) {
  // 级联删除会自动处理fall_history
  const result = await query('DELETE FROM patients WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

// ==================== 跌倒历史相关操作 ====================

// 获取患者的跌倒历史
export async function getFallHistoryByPatientId(patientId) {
  return await query('SELECT * FROM fall_history WHERE patient_id = ? ORDER BY fall_date DESC', [patientId]);
}

// 创建跌倒历史
export async function createFallHistory(patientId, historyData) {
  const now = Date.now();
  const sql = `
    INSERT INTO fall_history (
      patient_id, fall_date, severity, description, actions_taken, video_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    patientId,
    historyData.date || historyData.fall_date,
    historyData.severity,
    historyData.description,
    historyData.actions || historyData.actions_taken,
    historyData.videoUrl || historyData.video_url || null,
    now
  ];
  return await insert(sql, params);
}

// 删除患者的所有跌倒历史
export async function deleteFallHistoryByPatientId(patientId) {
  await query('DELETE FROM fall_history WHERE patient_id = ?', [patientId]);
}

// ==================== 事件相关操作 ====================

// 获取所有事件
export async function getAllEvents(start = null, end = null, camera = null, type = null, patientId = null) {
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  
  if (start) {
    sql += ' AND timestamp >= ?';
    params.push(new Date(start).getTime());
  }
  
  if (end) {
    sql += ' AND timestamp <= ?';
    params.push(new Date(end).getTime() + 24 * 60 * 60 * 1000);
  }
  
  if (camera) {
    sql += ' AND camera_id = ?';
    params.push(camera);
  }
  
  if (type) {
    if (Array.isArray(type)) {
      sql += ` AND type IN (${type.map(() => '?').join(',')})`;
      params.push(...type);
    } else {
      sql += ' AND type = ?';
      params.push(type);
    }
  }
  
  if (patientId) {
    sql += ' AND patient_id = ?';
    params.push(patientId);
  }
  
  sql += ' ORDER BY timestamp DESC';
  
  return await query(sql, params);
}

// 根据ID获取事件
export async function getEventById(id) {
  return await getOne('SELECT * FROM events WHERE id = ?', [id]);
}

// 创建事件
export async function createEvent(eventData) {
  const now = Date.now();
  const sql = `
    INSERT INTO events (
      id, type, severity, camera_id, patient_id, video_url, duration, timestamp, status, extra_info, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    eventData.id,
    eventData.type,
    eventData.severity,
    eventData.cameraId || eventData.camera_id,
    eventData.patientId || eventData.patient_id || null,
    eventData.videoUrl || eventData.video_url || null,
    eventData.duration || 1,
    eventData.timestamp || now,
    eventData.status || 'active',
    eventData.extraInfo || eventData.extra_info ? JSON.stringify(eventData.extraInfo || eventData.extra_info) : null,
    now
  ];
  await query(sql, params);
  return await getEventById(eventData.id);
}

// 更新事件
export async function updateEvent(id, updates) {
  const updateFields = [];
  const params = [];
  
  for (let key in updates) {
    if (key === 'id' || key === 'timestamp' || key === 'createdAt') continue;
    
    let dbField = key;
    if (key === 'cameraId') dbField = 'camera_id';
    if (key === 'patientId') dbField = 'patient_id';
    if (key === 'videoUrl') dbField = 'video_url';
    if (key === 'extraInfo') dbField = 'extra_info';
    
    updateFields.push(`${dbField} = ?`);
    params.push(dbField === 'extra_info' && typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
  }
  
  if (updateFields.length === 0) return null;
  
  params.push(id);
  
  const sql = `UPDATE events SET ${updateFields.join(', ')} WHERE id = ?`;
  await query(sql, params);
  
  return await getEventById(id);
}

// 删除事件
export async function deleteEvent(id) {
  const result = await query('DELETE FROM events WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

// ==================== 用户相关操作 ====================

export async function getAllUsers() {
  return await query('SELECT id, username, role, name FROM users ORDER BY id ASC');
}

export async function getUserByUsername(username) {
  return await getOne('SELECT * FROM users WHERE username = ?', [username]);
}

export async function getUserById(id) {
  return await getOne('SELECT id, username, role, name FROM users WHERE id = ?', [id]);
}

export async function createMysqlUser(username, hashedPassword, name, role) {
  const now = Date.now();
  const sql = 'INSERT INTO users (username, password, role, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)';
  const result = await query(sql, [username, hashedPassword, role || 'nurse', name || username, now, now]);
  return await getUserById(result.insertId);
}

export async function updateMysqlUser(id, updates) {
  const updateFields = [];
  const params = [];
  const now = Date.now();
  for (let key in updates) {
    if (key === 'id') continue;
    updateFields.push(`${key} = ?`);
    params.push(updates[key]);
  }
  if (updateFields.length === 0) return null;
  updateFields.push('updated_at = ?');
  params.push(now);
  params.push(id);
  await query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, params);
  return await getUserById(id);
}

export async function deleteMysqlUser(id) {
  const result = await query('DELETE FROM users WHERE id = ? AND role != ?', [id, 'admin']);
  return result.affectedRows > 0;
}

export async function seedMysqlUsers() {
  const existingCount = await getOne('SELECT COUNT(*) as count FROM users');
  if (existingCount && existingCount.count > 0) return;
  const bcrypt = await import('bcryptjs');
  const adminPwd = await bcrypt.hash('admin123', 10);
  const nursePwd = await bcrypt.hash('nurse123', 10);
  const now = Date.now();
  await query('INSERT INTO users (username, password, role, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['admin', adminPwd, 'admin', '系统管理员', now, now]);
  await query('INSERT INTO users (username, password, role, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['nurse', nursePwd, 'nurse', '护士张晓燕', now, now]);
  console.log('[MySQL] 初始用户已写入数据库');
}

export default {
  initMysqlDb,
  getMysqlPool,
  query,
  getOne,
  insert,
  closePool,
  // 患者操作
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  // 跌倒历史操作
  getFallHistoryByPatientId,
  createFallHistory,
  deleteFallHistoryByPatientId,
  // 事件操作
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
