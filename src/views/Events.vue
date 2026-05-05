<template>
  <div class="events">
    <div class="events-header">
      <h2>事件回溯</h2>
      <p>查看历史检测事件记录</p>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-grid">
        <div class="filter-item">
          <label>日期范围</label>
          <div class="date-range">
            <input type="date" v-model="filter.startDate" />
            <span>至</span>
            <input type="date" v-model="filter.endDate" />
          </div>
        </div>
        
        <div class="filter-item">
          <label>摄像头</label>
          <select v-model="filter.camera">
            <option value="">全部摄像头</option>
            <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
              {{ cam.name }}
            </option>
          </select>
        </div>
        
        <div class="filter-item">
          <label>事件类型</label>
          <div class="event-types">
            <label v-for="type in eventTypes" :key="type.value" class="type-checkbox">
              <input type="checkbox" v-model="filter.eventTypes" :value="type.value" />
              <span>{{ type.label }}</span>
            </label>
          </div>
        </div>
        
        <div class="filter-actions">
          <button @click="applyFilter" class="filter-button">
            应用筛选
          </button>
          <button @click="resetFilter" class="reset-button">
            重置
          </button>
          <button @click="confirmDeleteAll" class="delete-all-button">
            删除全部
          </button>
        </div>
      </div>
    </div>

    <!-- 事件统计 -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-icon emergency">⚠️</div>
        <div class="stat-info">
          <h3>跌倒事件</h3>
          <p>{{ stats.fall }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon normal">📊</div>
        <div class="stat-info">
          <h3>总事件数</h3>
          <p>{{ stats.total }}</p>
        </div>
      </div>
    </div>

    <!-- 事件时间轴 -->
    <div class="timeline-section">
      <h3>事件时间轴</h3>
      <div class="timeline">
        <div v-for="(event, index) in filteredEvents.filter(e => e)" :key="event?.id || index" class="timeline-card">
          <div class="timeline-marker" :class="event?.type || 'unknown'"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <h4>{{ getEventTypeName(event?.type || '') }}</h4>
              <span class="event-time">{{ formatTime(event?.timestamp || 0) }}</span>
            </div>
            <div class="timeline-body">
              <div class="event-info">
                <p><strong>摄像头:</strong> {{ getCameraName(event?.cameraId || '') }}</p>
                <p><strong>严重程度:</strong> {{ event?.severity || '未知' }}</p>
                <p v-if="event?.duration"><strong>持续时间:</strong> {{ event?.duration }}秒</p>
              </div>
              <div v-if="event?.videoUrl" class="event-thumbnail">
                <img :src="getThumbnailUrl(event?.videoUrl || '')" :alt="event?.type || 'event'" />
              </div>
            </div>
            <div class="timeline-footer">
              <button @click="viewEvent(event)" class="action-button primary">
                查看片段
              </button>
              <button @click="viewEventDetails(event)" class="action-button secondary">
                查看详情
              </button>
              <button @click="deleteEvent(event.id)" class="action-button delete">
                删除
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="filteredEvents.filter(e => e).length === 0" class="empty-state">
          <div class="empty-icon">📅</div>
          <h4>暂无事件记录</h4>
          <p>请调整筛选条件或检查设备连接状态</p>
        </div>
      </div>
    </div>

    <!-- 事件播放弹窗 -->
    <div class="event-modal" v-if="selectedEvent">
      <div class="modal-content">
        <div class="modal-header">
          <h3>事件回放</h3>
          <button @click="selectedEvent = null" class="close-button">×</button>
        </div>
        <div class="modal-body">
          <div class="video-container">
            <video v-if="selectedEvent.videoUrl" controls autoplay @error="handleVideoError">
              <source :src="selectedEvent.videoUrl" type="video/webm" />
              您的浏览器不支持视频播放
            </video>
            <div v-else class="no-video">
              <div class="no-video-icon">🎥</div>
              <p>该事件暂无视频记录</p>
            </div>
          </div>
          <div class="event-details">
            <h4>{{ getEventTypeName(selectedEvent.type) }}</h4>
            <p><strong>时间:</strong> {{ formatTime(selectedEvent.timestamp) }}</p>
            <p><strong>摄像头:</strong> {{ getCameraName(selectedEvent.cameraId) }}</p>
            <p><strong>严重程度:</strong> {{ selectedEvent.severity }}</p>
            <p v-if="selectedEvent.duration"><strong>持续时间:</strong> {{ selectedEvent.duration }}秒</p>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="selectedEvent = null" class="modal-button">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useWebSocket } from '../composables/useWebSocket'

const authStore = useAuthStore()

// 摄像头列表
const cameras = ref([
  { id: 'cam1', name: '病房1' },
  { id: 'cam2', name: '病房2' },
  { id: 'cam3', name: '走廊' }
])

// 事件类型
const eventTypes = [
  { value: 'fall', label: '跌倒' },
  { value: 'high_risk', label: '高风险姿态' },
  { value: 'bend', label: '弯腰' },
  { value: 'tilt', label: '倾斜' },
  { value: 'wandering', label: '徘徊' },
  { value: 'bed_exit', label: '离床' },
  { value: 'no_movement', label: '长时间静止' }
]

// 筛选条件
const filter = ref({
  startDate: '',
  endDate: '',
  camera: '',
  eventTypes: [] as string[]
})

// 事件数据
const events = ref<Array<{
  id: string
  type: string
  severity: string
  timestamp: number
  cameraId: string
  duration?: number
  videoUrl?: string
}>>([])

// 选中的事件
const selectedEvent = ref<any>(null)

// 计算过滤后的事件
const filteredEvents = computed(() => {
  let result = [...events.value]
  
  // 按日期筛选
  if (filter.value.startDate) {
    const start = new Date(filter.value.startDate).getTime()
    result = result.filter(event => event.timestamp >= start)
  }
  
  if (filter.value.endDate) {
    const end = new Date(filter.value.endDate).getTime() + 24 * 60 * 60 * 1000
    result = result.filter(event => event.timestamp <= end)
  }
  
  // 按摄像头筛选
  if (filter.value.camera) {
    result = result.filter(event => event.cameraId === filter.value.camera)
  }
  
  // 按事件类型筛选
  if (filter.value.eventTypes.length > 0) {
    result = result.filter(event => filter.value.eventTypes.includes(event.type))
  }
  
  // 按时间倒序排序
  return result.sort((a, b) => b.timestamp - a.timestamp)
})

// 统计数据
const stats = computed(() => {
  const fall = filteredEvents.value.filter(event => event.type === 'fall').length
  const total = filteredEvents.value.length
  
  return { fall, total }
})

// 应用筛选
const applyFilter = async () => {
  await fetchEvents()
}

// 重置筛选
const resetFilter = () => {
  filter.value = {
    startDate: '',
    endDate: '',
    camera: '',
    eventTypes: []
  }
  fetchEvents()
}

// 获取事件数据
const fetchEvents = async () => {
  try {
    const params = new URLSearchParams()
    if (filter.value.startDate) params.append('start', filter.value.startDate)
    if (filter.value.endDate) params.append('end', filter.value.endDate)
    if (filter.value.camera) params.append('camera', filter.value.camera)
    if (filter.value.eventTypes.length > 0) {
      filter.value.eventTypes.forEach(type => params.append('type', type))
    }
    
    const response = await fetch(`/api/events?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (!response.ok) {
      events.value = []
      return
    }
    
    const data = await response.json()
    events.value = (data.events || []).map((e: any) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      timestamp: e.timestamp,
      cameraId: e.cameraId || e.camera_id || '',
      duration: e.duration,
      videoUrl: e.videoUrl || e.video_url || undefined
    }))
  } catch (error) {
    console.error('获取事件失败:', error)
    events.value = []
  }
}

// 查看事件片段
const viewEvent = (event: any) => {
  selectedEvent.value = event
  
  // 如果没有视频URL，提示用户
  if (!event.videoUrl) {
    alert('该事件暂无视频记录')
    return
  }
  
  // 延迟执行，等待模态框渲染完成
  setTimeout(() => {
    const videoElement = document.querySelector('.modal-body video') as HTMLVideoElement
    if (videoElement) {
      videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, 100)
}

// 查看事件详情
const viewEventDetails = (event: any) => {
  selectedEvent.value = event
  
  // 延迟执行，等待模态框渲染完成，然后滚动到详情区域
  setTimeout(() => {
    const detailsElement = document.querySelector('.event-details') as HTMLElement
    if (detailsElement) {
      detailsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 100)
}

// 视频加载失败处理
const handleVideoError = (event: Event) => {
  const video = event.target as HTMLVideoElement
  console.error('[Events] 视频加载失败:', video.src)
  alert('视频加载失败，可能已被删除或不存在')
}

// 删除单个事件
const deleteEvent = async (eventId: string) => {
  if (!confirm('确定要删除这个事件吗？')) {
    return
  }
  
  try {
    const response = await fetch(`/api/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      events.value = events.value.filter(e => e.id !== eventId)
      alert('事件已删除')
    } else {
      alert('删除失败')
    }
  } catch (error) {
    console.error('删除事件失败:', error)
    alert('删除失败')
  }
}

// 确认删除全部事件
const confirmDeleteAll = () => {
  if (events.value.length === 0) {
    alert('没有可删除的事件')
    return
  }
  
  if (confirm(`确定要删除所有 ${events.value.length} 个事件吗？此操作不可撤销！`)) {
    deleteAllEvents()
  }
}

// 删除全部事件
const deleteAllEvents = async () => {
  try {
    for (const event of events.value) {
      await fetch(`/api/events/${event.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
    }
    events.value = []
    alert('所有事件已删除')
  } catch (error) {
    console.error('删除事件失败:', error)
    alert('删除失败')
  }
}

// 获取事件类型名称
const getEventTypeName = (type: string) => {
  const typeMap: Record<string, string> = {
    'fall': '跌倒',
    'high_risk': '高风险姿态',
    'bend': '弯腰',
    'tilt': '倾斜',
    'wandering': '徘徊',
    'bed_exit': '离床',
    'no_movement': '长时间静止'
  }
  return typeMap[type] || type
}

// 获取摄像头名称
const getCameraName = (cameraId: string) => {
  const camera = cameras.value.find(cam => cam.id === cameraId)
  return camera ? camera.name : cameraId
}

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 获取缩略图 URL
const getThumbnailUrl = (_videoUrl: string) => {
  // 实际项目中可以生成视频缩略图
  return 'https://picsum.photos/120/80?random=1'
}

// 轮询间隔（毫秒）
const POLL_INTERVAL = 10000
let pollTimer: ReturnType<typeof setInterval> | null = null

// 使用 WebSocket 监听实时事件，有新事件时自动刷新
useWebSocket({
  onMessage: (message) => {
    if (message.type === 'fall_detected' || message.type === 'high_risk_detected' || message.type === 'event_updated' || message.type === 'bend_detected' || message.type === 'tilt_detected') {
      console.log('[Events] 收到实时事件通知，刷新事件列表:', message.type)
      fetchEvents()
    }
  },
  onConnect: () => {
    console.log('[Events] WebSocket 已连接，开始监听实时事件')
  },
  onDisconnect: () => {
    console.log('[Events] WebSocket 已断开')
  }
})

// 组件挂载
onMounted(() => {
  // 设置默认日期为最近7天
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 7)
  
  filter.value.endDate = endDate.toISOString().split('T')[0]
  filter.value.startDate = startDate.toISOString().split('T')[0]
  
  fetchEvents()

  // 启动定时轮询，作为兜底同步机制
  pollTimer = setInterval(() => {
    fetchEvents()
  }, POLL_INTERVAL)
})

// 组件卸载时清理
onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.events {
  width: 100%;
}

.events-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.events-header h2 {
  font-size: 1.8rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.events-header p {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* 筛选区域 */
.filter-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  align-items: end;
}

.filter-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-range input {
  flex: 1;
  padding: 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.date-range span {
  color: var(--text-secondary);
  white-space: nowrap;
}

select {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.event-types {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.type-checkbox {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
}

.filter-button,
.reset-button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.filter-button {
  background: var(--accent-color);
  color: white;
}

.filter-button:hover {
  background: var(--accent-hover);
}

.reset-button {
  background: var(--text-muted);
  color: white;
}

.reset-button:hover {
  background: var(--text-secondary);
}

.delete-all-button {
  background: var(--danger-color);
  color: white;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.delete-all-button:hover {
  background: #c82333;
}

/* 统计区域 */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.emergency {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger-color);
}

.stat-icon.warning {
  background: rgba(255, 193, 7, 0.1);
  color: var(--warning-color);
}

.stat-icon.normal {
  background: rgba(74, 144, 226, 0.1);
  color: var(--accent-color);
}

.stat-info h3 {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.stat-info p {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* 时间轴 */
.timeline-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.timeline-section h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.timeline {
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-color);
}

.timeline-card {
  position: relative;
  margin-bottom: 1.5rem;
  padding-left: 60px;
}

.timeline-marker {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  border: 3px solid var(--bg-card);
  z-index: 1;
}

.timeline-marker.fall {
  background: var(--danger-color);
}

.timeline-marker.high_risk {
  background: #ff8c00;
}

.timeline-marker.bend,
.timeline-marker.tilt {
  background: var(--warning-color);
}

.timeline-marker.wandering {
  background: #6f42c1;
}

.timeline-marker.bed_exit {
  background: #17a2b8;
}

.timeline-marker.no_movement {
  background: #6c757d;
}

.timeline-content {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.timeline-header h4 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin: 0;
}

.event-time {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.timeline-body {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.event-info {
  flex: 1;
}

.event-info p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0.3rem 0;
}

.event-thumbnail {
  width: 120px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.event-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.timeline-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.3s ease;
}

.action-button.primary {
  background: var(--accent-color);
  color: white;
}

.action-button.primary:hover {
  background: var(--accent-hover);
}

.action-button.secondary {
  background: var(--text-muted);
  color: white;
}

.action-button.secondary:hover {
  background: var(--text-secondary);
}

.action-button.delete {
  background: var(--danger-color);
  color: white;
}

.action-button.delete:hover {
  background: #c82333;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
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

/* 事件播放弹窗 */
.event-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 10px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.close-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.video-container {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-video {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem;
}

.no-video-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.event-details h4 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.event-details p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0.5rem 0;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.modal-button {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: 6px;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.modal-button:hover {
  background: var(--accent-hover);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-section {
    grid-template-columns: 1fr;
  }
  
  .timeline-body {
    flex-direction: column;
  }
  
  .event-thumbnail {
    width: 100%;
    height: 150px;
  }
  
  .timeline-footer {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
  }
  
  .modal-content {
    width: 95%;
    margin: 1rem;
  }
}
</style>