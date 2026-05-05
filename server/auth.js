import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb, saveDb } from './db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'patient-fall-detection-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function isMysql() {
  return (process.env.DB_TYPE || 'json') === 'mysql';
}

const SEED_USERS = [
  { id: 1, username: 'admin', password: '$2b$10$3GTAW9i0NQtQVcXLRcLZLOsoNUpDMRmhBzLNzu/io.YvPNWZZ1xrC', role: 'admin', name: '系统管理员' },
  { id: 2, username: 'nurse', password: '$2b$10$BmJ0fsprNr0yu/ZC.HTKHuFJ0sAT48DtEB.1nH3b/KPOfL8JiUrw6', role: 'nurse', name: '护士张晓燕' }
];

export async function seedUsers() {
  const db = getDb();
  if (!db.data.users || db.data.users.length === 0) {
    db.data.users = SEED_USERS;
    await saveDb();
    console.log('[Auth] 初始用户已写入数据库');
  }
}

function getUsers() {
  if (isMysql()) return [];
  const db = getDb();
  return db.data.users || [];
}

export async function login(username, password) {
  let user;
  if (isMysql()) {
    const { getUserByUsername } = await import('./db/mysql.js');
    user = await getUserByUsername(username);
  } else {
    const users = getUsers();
    user = users.find(u => u.username === username);
  }
  if (!user) return null;

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return null;

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name }
  };
}

export async function createUser(username, password, name, role) {
  if (isMysql()) {
    const { getUserByUsername, createMysqlUser } = await import('./db/mysql.js');
    const existing = await getUserByUsername(username);
    if (existing) return null;
    const hashedPassword = await bcrypt.hash(password, 10);
    return await createMysqlUser(username, hashedPassword, name, role);
  } else {
    const users = getUsers();
    const existing = users.find(u => u.username === username);
    if (existing) return null;
    const maxId = users.length > 0 ? Math.max(...users.map(u => u.id)) : 0;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: maxId + 1, username, password: hashedPassword, role: role || 'nurse', name: name || username };
    users.push(newUser);
    const db = getDb();
    db.data.users = users;
    await saveDb();
    return { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name };
  }
}

export async function updateUser(id, updates) {
  if (isMysql()) {
    const { updateMysqlUser } = await import('./db/mysql.js');
    const updateData = {};
    if (updates.username) updateData.username = updates.username;
    if (updates.name) updateData.name = updates.name;
    if (updates.role) updateData.role = updates.role;
    if (updates.password) updateData.password = await bcrypt.hash(updates.password, 10);
    return await updateMysqlUser(id, updateData);
  } else {
    const db = getDb();
    const users = db.data.users || [];
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    if (updates.password) updates.password = await bcrypt.hash(updates.password, 10);
    Object.keys(updates).forEach(key => { if (key !== 'id') users[index][key] = updates[key]; });
    db.data.users = users;
    await saveDb();
    return { id: users[index].id, username: users[index].username, role: users[index].role, name: users[index].name };
  }
}

export async function deleteUser(id) {
  if (isMysql()) {
    const { deleteMysqlUser } = await import('./db/mysql.js');
    return await deleteMysqlUser(id);
  } else {
    const db = getDb();
    const users = db.data.users || [];
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;
    if (users[index].role === 'admin') return false;
    users.splice(index, 1);
    db.data.users = users;
    await saveDb();
    return true;
  }
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (isMysql()) {
    const { getUserById } = await import('./db/mysql.js');
    const { default: mysqlModule } = await import('./db/mysql.js');
    const user = await mysqlModule.getOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return { success: false, message: '用户不存在' };
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return { success: false, message: '当前密码错误' };
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { query } = await import('./db/mysql.js');
    await query('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, Date.now(), userId]);
    return { success: true, message: '密码修改成功' };
  } else {
    const db = getDb();
    const users = db.data.users || [];
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: '用户不存在' };
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return { success: false, message: '当前密码错误' };
    user.password = await bcrypt.hash(newPassword, 10);
    db.data.users = users;
    await saveDb();
    return { success: true, message: '密码修改成功' };
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.user = decoded;
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

export { JWT_SECRET };