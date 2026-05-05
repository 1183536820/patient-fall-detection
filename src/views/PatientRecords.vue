<template>
  <div class="patient-records">
    <div class="records-header">
      <h2>患者档案</h2>
      <p>患者基本信息与健康记录管理</p>
    </div>

    <!-- 只读提示 -->
    <div class="readonly-notice" v-if="authStore.isAuthenticated && !authStore.isAdmin">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>您当前为只读模式，可查看患者信息，如需修改请联系管理员</span>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="search-section">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索患者姓名、ID或房间号..." 
          class="search-input"
        />
        <button @click="searchPatients" class="search-button">
          🔍 搜索
        </button>
      </div>
      <button @click="openAddPatientModal" class="add-button" v-if="authStore.isAdmin">
        ➕ 添加患者
      </button>
    </div>

    <!-- 患者列表 -->
    <div class="patients-list">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
      
      <div v-else-if="filteredPatients.length === 0" class="empty-state">
        <div class="empty-icon">👥</div>
        <h4>暂无患者记录</h4>
        <p>点击"添加患者"按钮创建新的患者档案</p>
      </div>
      
      <div v-else class="patients-grid">
        <div 
          v-for="patient in paginatedPatients" 
          :key="patient.id" 
          class="patient-card"
          @click="viewPatientDetails(patient)"
        >
          <div class="patient-header">
            <div class="patient-info">
              <h3>{{ patient.name }}</h3>
              <p class="patient-id">ID: {{ patient.id }}</p>
            </div>
            <div class="patient-status" :class="patient.status">
              {{ patient.status === 'active' ? '在院' : '出院' }}
            </div>
          </div>
          
          <div class="patient-details">
            <div class="detail-item">
              <span class="label">年龄:</span>
              <span class="value">{{ patient.age }}岁</span>
            </div>
            <div class="detail-item">
              <span class="label">性别:</span>
              <span class="value">{{ patient.gender }}</span>
            </div>
            <div class="detail-item">
              <span class="label">房间:</span>
              <span class="value">{{ patient.roomNumber }}</span>
            </div>
            <div class="detail-item">
              <span class="label">跌倒风险:</span>
              <span class="value" :class="patient.fallRiskLevel">
                {{ patient.fallRiskLevel === 'high' ? '高' : patient.fallRiskLevel === 'medium' ? '中' : '低' }}
              </span>
            </div>
          </div>
          
          <div class="patient-actions" v-if="authStore.isAdmin">
            <button @click.stop="editPatient(patient)" class="action-button edit">
              ✏️ 编辑
            </button>
            <button @click.stop="deletePatient(patient.id)" class="action-button delete">
              🗑️ 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="filteredPatients.length > 0" class="pagination">
      <button 
        @click="currentPage--" 
        :disabled="currentPage === 1" 
        class="page-button"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页
      </span>
      <button 
        @click="currentPage++" 
        :disabled="currentPage === totalPages" 
        class="page-button"
      >
        下一页
      </button>
    </div>

    <!-- 患者详情模态框 -->
    <div v-if="showDetailsModal" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>患者详情</h3>
          <button @click="closeDetailsModal" class="close-button">×</button>
        </div>
        
        <div v-if="selectedPatient" class="patient-detail-content">
          <div class="basic-info">
            <h4>基本信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">姓名:</span>
                <span class="value">{{ selectedPatient.name }}</span>
              </div>
              <div class="info-item">
                <span class="label">ID:</span>
                <span class="value">{{ selectedPatient.id }}</span>
              </div>
              <div class="info-item">
                <span class="label">年龄:</span>
                <span class="value">{{ selectedPatient.age }}岁</span>
              </div>
              <div class="info-item">
                <span class="label">性别:</span>
                <span class="value">{{ selectedPatient.gender }}</span>
              </div>
              <div class="info-item">
                <span class="label">房间:</span>
                <span class="value">{{ selectedPatient.roomNumber }}</span>
              </div>
              <div class="info-item">
                <span class="label">床号:</span>
                <span class="value">{{ selectedPatient.bedNumber }}</span>
              </div>
              <div class="info-item">
                <span class="label">入院日期:</span>
                <span class="value">{{ selectedPatient.admissionDate }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态:</span>
                <span class="value" :class="selectedPatient.status">{{ selectedPatient.status === 'active' ? '在院' : '出院' }}</span>
              </div>
            </div>
          </div>
          
          <div class="medical-info">
            <h4>医疗信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">跌倒风险:</span>
                <span class="value" :class="selectedPatient.fallRiskLevel">
                  {{ selectedPatient.fallRiskLevel === 'high' ? '高' : selectedPatient.fallRiskLevel === 'medium' ? '中' : '低' }}
                </span>
              </div>
              <div class="info-item">
                <span class="label">主要诊断:</span>
                <span class="value">{{ selectedPatient.diagnosis }}</span>
              </div>
              <div class="info-item">
                <span class="label">过敏史:</span>
                <span class="value">{{ selectedPatient.allergies || '无' }}</span>
              </div>
              <div class="info-item">
                <span class="label">特殊护理:</span>
                <span class="value">{{ selectedPatient.specialCare || '无' }}</span>
              </div>
            </div>
          </div>
          
          <div class="contact-info">
            <h4>联系信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">联系人:</span>
                <span class="value">{{ selectedPatient.emergencyContact?.name }}</span>
              </div>
              <div class="info-item">
                <span class="label">关系:</span>
                <span class="value">{{ selectedPatient.emergencyContact?.relationship }}</span>
              </div>
              <div class="info-item">
                <span class="label">电话:</span>
                <span class="value">{{ selectedPatient.emergencyContact?.phone }}</span>
              </div>
            </div>
          </div>
          
          <div class="fall-history">
            <h4>跌倒记录</h4>
            <div v-if="!selectedPatient.fallHistory || selectedPatient.fallHistory.length === 0" class="empty-history">
              <p>暂无跌倒记录</p>
            </div>
            <div v-else class="history-list">
              <div 
                v-for="(record, index) in selectedPatient.fallHistory" 
                :key="index" 
                class="history-item"
              >
                <div class="history-header">
                  <span class="history-date">{{ record.date }}</span>
                  <span class="history-severity" :class="record.severity">
                    {{ record.severity === 'severe' ? '严重' : record.severity === 'moderate' ? '中等' : '轻微' }}
                  </span>
                </div>
                <div class="history-description">{{ record.description }}</div>
                <div class="history-actions">{{ record.actions }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑患者模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑患者' : '添加患者' }}</h3>
          <button @click="closeEditModal" class="close-button">×</button>
        </div>
        
        <div class="form-content">
          <form @submit.prevent="savePatient">
            <div class="form-section">
              <h4>基本信息</h4>
              <div class="form-grid">
                <div class="form-item">
                  <label>姓名 *</label>
                  <input type="text" v-model="formData.name" required />
                </div>
                <div class="form-item">
                  <label>年龄 *</label>
                  <input type="number" v-model.number="formData.age" min="0" required />
                </div>
                <div class="form-item">
                  <label>性别 *</label>
                  <select v-model="formData.gender" required>
                    <option value="">请选择</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div class="form-item">
                  <label>房间号 *</label>
                  <input type="text" v-model="formData.roomNumber" required />
                </div>
                <div class="form-item">
                  <label>床号 *</label>
                  <input type="text" v-model="formData.bedNumber" required />
                </div>
                <div class="form-item">
                  <label>入院日期 *</label>
                  <input type="date" v-model="formData.admissionDate" required />
                </div>
                <div class="form-item">
                  <label>状态</label>
                  <select v-model="formData.status">
                    <option value="active">在院</option>
                    <option value="discharged">出院</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h4>医疗信息</h4>
              <div class="form-grid">
                <div class="form-item">
                  <label>主要诊断</label>
                  <input type="text" v-model="formData.diagnosis" />
                </div>
                <div class="form-item">
                  <label>跌倒风险等级</label>
                  <select v-model="formData.fallRiskLevel">
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div class="form-item full-width">
                  <label>过敏史</label>
                  <textarea v-model="formData.allergies" rows="2"></textarea>
                </div>
                <div class="form-item full-width">
                  <label>特殊护理需求</label>
                  <textarea v-model="formData.specialCare" rows="2"></textarea>
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h4>联系信息</h4>
              <div class="form-grid">
                <div class="form-item">
                  <label>联系人姓名</label>
                  <input type="text" v-model="formData.emergencyContact.name" />
                </div>
                <div class="form-item">
                  <label>关系</label>
                  <input type="text" v-model="formData.emergencyContact.relationship" />
                </div>
                <div class="form-item">
                  <label>联系电话</label>
                  <input type="tel" v-model="formData.emergencyContact.phone" />
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" @click="closeEditModal" class="cancel-button">
                取消
              </button>
              <button type="submit" class="save-button">
                {{ isEditing ? '保存修改' : '添加患者' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { api } from '../utils/api'

const authStore = useAuthStore()

// 患者数据类型
interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

interface FallHistory {
  date: string
  severity: string
  description: string
  actions: string
}

interface Patient {
  id: string
  name: string
  age: number
  gender: string
  roomNumber: string
  bedNumber: string
  admissionDate: string
  status: string
  diagnosis: string
  fallRiskLevel: string
  allergies: string
  specialCare: string
  emergencyContact: EmergencyContact
  fallHistory: FallHistory[]
}

// 将后端 snake_case 数据映射为前端 camelCase
function mapPatientData(data: any): Patient {
  return {
    id: data.id || '',
    name: data.name || '',
    age: data.age || 0,
    gender: data.gender || '',
    roomNumber: data.roomNumber || data.room_number || '',
    bedNumber: data.bedNumber || data.bed_number || '',
    admissionDate: data.admissionDate || data.admission_date || '',
    status: data.status || 'active',
    diagnosis: data.diagnosis || '',
    fallRiskLevel: data.fallRiskLevel || data.fall_risk_level || 'low',
    allergies: data.allergies || '',
    specialCare: data.specialCare || data.special_care || '',
    emergencyContact: {
      name: data.emergencyContact?.name || data.emergency_contact_name || '',
      relationship: data.emergencyContact?.relationship || data.emergency_contact_relationship || '',
      phone: data.emergencyContact?.phone || data.emergency_contact_phone || ''
    },
    fallHistory: Array.isArray(data.fallHistory) ? data.fallHistory : []
  }
}

// 患者数据
const patients = ref<Patient[]>([])

// 加载状态
const isLoading = ref(false)

// 错误信息
const errorMessage = ref('')

// 从后端加载患者数据
async function loadPatients() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const response = await api.get<{patients: Patient[]}>('/api/patients')
    patients.value = (response.patients || []).map(mapPatientData)
  } catch (error) {
    console.error('[PatientRecords] 加载患者数据失败:', error)
    errorMessage.value = '加载患者数据失败,请稍后重试'
  } finally {
    isLoading.value = false
  }
}

// 搜索和过滤
const searchQuery = ref('')
const filteredPatients = computed(() => {
  if (!searchQuery.value) return patients.value
  
  const query = searchQuery.value.toLowerCase()
  return patients.value.filter(patient => 
    patient.name.toLowerCase().includes(query) ||
    patient.id.toLowerCase().includes(query) ||
    patient.roomNumber.toLowerCase().includes(query)
  )
})

// 分页
const currentPage = ref(1)
const pageSize = 10
const paginatedPatients = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredPatients.value.slice(start, end)
})
const totalPages = computed(() => {
  return Math.ceil(filteredPatients.value.length / pageSize)
})

// 模态框状态
const showDetailsModal = ref(false)
const showEditModal = ref(false)
const isEditing = ref(false)
const selectedPatient = ref<Patient | null>(null)

// 表单数据
const formData = ref({
  id: '',
  name: '',
  age: 0,
  gender: '',
  roomNumber: '',
  bedNumber: '',
  admissionDate: '',
  status: 'active',
  diagnosis: '',
  fallRiskLevel: 'low',
  allergies: '',
  specialCare: '',
  emergencyContact: {
    name: '',
    relationship: '',
    phone: ''
  },
  fallHistory: []
})

// 搜索患者
const searchPatients = () => {
  console.log('搜索患者:', searchQuery.value)
}

// 查看患者详情
const viewPatientDetails = async (patient: Patient) => {
  isLoading.value = true
  try {
    const response = await api.get<{patient: any}>(`/api/patients/${patient.id}`)
    selectedPatient.value = mapPatientData(response.patient)
    showDetailsModal.value = true
  } catch (error) {
    console.error('[PatientRecords] 获取患者详情失败:', error)
    alert('获取患者详情失败')
  } finally {
    isLoading.value = false
  }
}

// 关闭详情模态框
const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedPatient.value = null
}

// 打开添加患者模态框
const openAddPatientModal = () => {
  isEditing.value = false
  formData.value = {
    id: '',
    name: '',
    age: 0,
    gender: '',
    roomNumber: '',
    bedNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'active',
    diagnosis: '',
    fallRiskLevel: 'low',
    allergies: '',
    specialCare: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    fallHistory: []
  }
  showEditModal.value = true
}

// 编辑患者
const editPatient = (patient: Patient) => {
  isEditing.value = true
  const patientCopy = JSON.parse(JSON.stringify(mapPatientData(patient)))
  formData.value = patientCopy
  showEditModal.value = true
}

// 关闭编辑模态框
const closeEditModal = () => {
  showEditModal.value = false
  formData.value = {
    id: '',
    name: '',
    age: 0,
    gender: '',
    roomNumber: '',
    bedNumber: '',
    admissionDate: '',
    status: 'active',
    diagnosis: '',
    fallRiskLevel: 'low',
    allergies: '',
    specialCare: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    fallHistory: []
  }
}

// 保存患者
const savePatient = async () => {
  try {
    const submitData = {
      ...formData.value,
      roomNumber: formData.value.roomNumber,
      bedNumber: formData.value.bedNumber,
      fallRiskLevel: formData.value.fallRiskLevel,
      specialCare: formData.value.specialCare,
      emergencyContact: formData.value.emergencyContact
    }
    if (isEditing.value) {
      await api.put(`/api/patients/${formData.value.id}`, submitData)
      alert('患者信息已更新')
    } else {
      await api.post('/api/patients', submitData)
      alert('患者已添加')
    }
    closeEditModal()
    await loadPatients()
  } catch (error) {
    console.error('[PatientRecords] 保存患者失败:', error)
    alert(isEditing.value ? '更新患者失败' : '添加患者失败')
  }
}

// 删除患者
const deletePatient = async (id: string) => {
  if (confirm('确定要删除该患者记录吗？')) {
    try {
      await api.delete(`/api/patients/${id}`)
      alert('患者记录已删除')
      await loadPatients()
    } catch (error) {
      console.error('[PatientRecords] 删除患者失败:', error)
      alert('删除患者失败')
    }
  }
}

// 组件挂载
onMounted(() => {
  loadPatients()
})
</script>

<style scoped>
.patient-records {
  width: 100%;
}

.records-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.records-header h2 {
  font-size: 1.8rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.records-header p {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* 只读提示 */
.readonly-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(74, 144, 226, 0.08);
  border: 1px solid rgba(74, 144, 226, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
  color: var(--accent-color, #4a90e2);
  font-size: 0.9rem;
}

/* 操作栏 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.search-section {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 300px;
}

.search-input {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-button,
.add-button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.search-button {
  background: var(--accent-color);
  color: white;
}

.search-button:hover {
  background: var(--accent-hover);
}

.add-button {
  background: var(--success-color);
  color: white;
}

.add-button:hover {
  background: #218838;
}

/* 患者列表 */
.patients-list {
  margin-bottom: 2rem;
}

.loading-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h4 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.patients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}

.patient-card {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
  cursor: pointer;
  transition: all 0.3s ease;
  border-left: 4px solid var(--accent-color);
}

.patient-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px var(--shadow-hover);
}

.patient-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.patient-info h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin: 0 0 0.3rem 0;
}

.patient-id {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.patient-status {
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.patient-status.active {
  background: rgba(40, 167, 69, 0.1);
  color: var(--success-color);
}

.patient-status.discharged {
  background: rgba(108, 117, 125, 0.1);
  color: var(--text-secondary);
}

.patient-details {
  margin-bottom: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.detail-item .label {
  color: var(--text-secondary);
}

.detail-item .value {
  font-weight: 500;
  color: var(--text-primary);
}

.detail-item .value.high {
  color: var(--danger-color);
}

.detail-item .value.medium {
  color: var(--warning-color);
}

.detail-item .value.low {
  color: var(--success-color);
}

.patient-actions {
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
}

.action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  flex: 1;
  max-width: 100px;
}

.action-button.edit {
  background: var(--accent-color);
  color: white;
}

.action-button.edit:hover {
  background: var(--accent-hover);
}

.action-button.delete {
  background: var(--danger-color);
  color: white;
}

.action-button.delete:hover {
  background: #c82333;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.page-button {
  padding: 0.6rem 1.2rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
}

.page-button:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 10px;
  padding: 2rem;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 1.3rem;
  color: var(--text-primary);
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.close-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* 患者详情 */
.patient-detail-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.basic-info,
.medical-info,
.contact-info,
.fall-history {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
}

.basic-info h4,
.medical-info h4,
.contact-info h4,
.fall-history h4 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
  padding-left: 0.5rem;
  border-left: 3px solid var(--accent-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.info-item .label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.info-item .value {
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
}

.info-item .value.high {
  color: var(--danger-color);
}

.info-item .value.medium {
  color: var(--warning-color);
}

.info-item .value.low {
  color: var(--success-color);
}

.info-item .value.active {
  color: var(--success-color);
}

.info-item .value.discharged {
  color: var(--text-secondary);
}

.empty-history {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  background: white;
  border-radius: 6px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.history-date {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.history-severity {
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.history-severity.severe {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger-color);
}

.history-severity.moderate {
  background: rgba(255, 193, 7, 0.1);
  color: var(--warning-color);
}

.history-severity.mild {
  background: rgba(40, 167, 69, 0.1);
  color: var(--success-color);
}

.history-description {
  font-size: 0.95rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.history-actions {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
}

/* 表单 */
.form-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
}

.form-section h4 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
  padding-left: 0.5rem;
  border-left: 3px solid var(--accent-color);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-item.full-width {
  grid-column: 1 / -1;
}

.form-item label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-item input,
.form-item select,
.form-item textarea {
  padding: 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
}

.form-item textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.cancel-button,
.save-button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.cancel-button {
  background: var(--text-muted);
  color: white;
}

.cancel-button:hover {
  background: var(--text-secondary);
}

.save-button {
  background: var(--success-color);
  color: white;
}

.save-button:hover {
  background: #218838;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-section {
    min-width: auto;
  }
  
  .patients-grid {
    grid-template-columns: 1fr;
  }
  
  .patient-details {
    grid-template-columns: 1fr;
  }
  
  .info-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .modal-content {
    width: 95%;
    padding: 1.5rem;
  }
}
</style>