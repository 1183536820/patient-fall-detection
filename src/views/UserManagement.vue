<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../utils/api'

interface User {
  id: number
  username: string
  role: string
  name: string
}

const users = ref<User[]>([])
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const editingUserId = ref<number | null>(null)
const formData = ref({
  username: '',
  password: '',
  name: '',
  role: 'nurse'
})
const errorMessage = ref('')
const successMessage = ref('')

async function loadUsers() {
  isLoading.value = true
  try {
    const data = await api.get<{ users: User[] }>('/api/users')
    users.value = data.users || []
  } catch (error) {
    console.error('[UserManagement] 加载用户失败:', error)
  } finally {
    isLoading.value = false
  }
}

function openAddModal() {
  isEditing.value = false
  editingUserId.value = null
  formData.value = { username: '', password: '', name: '', role: 'nurse' }
  errorMessage.value = ''
  showModal.value = true
}

function openEditModal(user: User) {
  isEditing.value = true
  editingUserId.value = user.id
  formData.value = { username: user.username, password: '', name: user.name, role: user.role }
  errorMessage.value = ''
  showModal.value = true
}

async function saveUser() {
  errorMessage.value = ''
  successMessage.value = ''
  if (!formData.value.username || (!isEditing.value && !formData.value.password)) {
    errorMessage.value = isEditing.value ? '请输入用户名' : '请填写用户名和密码'
    return
  }
  try {
    if (isEditing.value) {
      const payload: any = { username: formData.value.username, name: formData.value.name, role: formData.value.role }
      if (formData.value.password) payload.password = formData.value.password
      await api.put(`/api/users/${editingUserId.value}`, payload)
      successMessage.value = '用户已更新'
    } else {
      await api.post('/api/users', formData.value)
      successMessage.value = '用户已添加'
    }
    showModal.value = false
    await loadUsers()
  } catch (error: any) {
    errorMessage.value = error.message || '操作失败'
  }
}

async function deleteUser(user: User) {
  if (user.role === 'admin') return
  if (!confirm(`确定要删除用户「${user.name}」吗？`)) return
  try {
    await api.delete(`/api/users/${user.id}`)
    await loadUsers()
  } catch (error: any) {
    alert(error.message || '删除失败')
  }
}

function closeModal() {
  showModal.value = false
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="user-management">
    <div class="page-header">
      <h2>账号管理</h2>
      <p>管理系统账号，添加或管理护士账户</p>
    </div>

    <div class="action-bar">
      <div class="action-left">
        <span class="user-count">共 {{ users.length }} 个账号</span>
      </div>
      <button @click="openAddModal" class="add-button">➕ 添加账号</button>
    </div>

    <div v-if="successMessage" class="message success">{{ successMessage }}</div>

    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else class="users-table-wrapper">
      <table class="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>姓名</th>
            <th>角色</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.name }}</td>
            <td>
              <span :class="['role-badge', user.role]">
                {{ user.role === 'admin' ? '管理员' : '护士' }}
              </span>
            </td>
            <td class="actions">
              <button @click="openEditModal(user)" class="action-btn edit">编辑</button>
              <button
                @click="deleteUser(user)"
                class="action-btn delete"
                :disabled="user.role === 'admin'"
                :title="user.role === 'admin' ? '不能删除管理员' : ''"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ isEditing ? '编辑账号' : '添加账号' }}</h3>
            <button @click="closeModal" class="close-button">×</button>
          </div>
          <form @submit.prevent="saveUser">
            <div class="form-group">
              <label>用户名 *</label>
              <input type="text" v-model="formData.username" placeholder="登录用户名" required />
            </div>
            <div class="form-group">
              <label>姓名</label>
              <input type="text" v-model="formData.name" placeholder="显示名称" />
            </div>
            <div class="form-group">
              <label>密码 {{ isEditing ? '(留空不修改)' : '*' }}</label>
              <input type="password" v-model="formData.password" placeholder="登录密码" :required="!isEditing" />
            </div>
            <div class="form-group">
              <label>角色</label>
              <select v-model="formData.role">
                <option value="nurse">护士</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
            <div class="form-actions">
              <button type="button" @click="closeModal" class="cancel-btn">取消</button>
              <button type="submit" class="save-btn">{{ isEditing ? '保存修改' : '添加' }}</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.user-management {
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.page-header h2 {
  font-size: 1.8rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.page-header p {
  font-size: 1rem;
  color: var(--text-secondary);
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.user-count {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.add-button {
  padding: 0.7rem 1.5rem;
  background: var(--accent-color, #4a90e2);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.add-button:hover {
  background: var(--accent-hover, #357abd);
}

.message {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.loading-state {
  text-align: center;
  padding: 3rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--accent-color, #4a90e2);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.users-table-wrapper {
  background: var(--bg-card);
  border-radius: 10px;
  box-shadow: 0 2px 4px var(--shadow);
  overflow: hidden;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th {
  padding: 14px 16px;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.users-table td {
  padding: 12px 16px;
  font-size: 0.9rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.users-table tr:last-child td {
  border-bottom: none;
}

.users-table tr:hover td {
  background: var(--bg-secondary);
}

.role-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.role-badge.admin {
  background: rgba(255, 215, 0, 0.2);
  color: #b8860b;
}

.role-badge.nurse {
  background: rgba(74, 144, 226, 0.12);
  color: var(--accent-color, #4a90e2);
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-card);
  color: var(--text-primary);
}

.action-btn.edit:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.action-btn.delete {
  color: #e53935;
  border-color: #e53935;
}

.action-btn.delete:hover:not(:disabled) {
  background: #fff5f5;
}

.action-btn.delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 2rem;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 25px var(--shadow);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0.3rem;
  border-radius: 4px;
}

.close-button:hover {
  background: var(--bg-secondary);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.4rem;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--accent-color);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.cancel-btn {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
}

.save-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: var(--accent-color, #4a90e2);
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

.save-btn:hover {
  background: var(--accent-hover, #357abd);
}
</style>