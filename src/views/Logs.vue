<template>
  <div class="logs">
    <div class="logs-header">
      <h2>异常日志</h2>
      <p>系统异常事件记录与分析</p>
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
          <label>日志级别</label>
          <select v-model="filter.level">
            <option value="">全部级别</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>
        </div>
        
        <div class="filter-item">
          <label>模块</label>
          <select v-model="filter.module">
            <option value="">全部模块</option>
            <option value="camera">摄像头</option>
            <option value="video">视频分析</option>
            <option value="ai">AI模型</option>
            <option value="system">系统</option>
          </select>
        </div>
        
        <div class="filter-actions">
          <button @click="applyFilter" class="filter-button">
            应用筛选
          </button>
          <button @click="resetFilter" class="reset-button">
            重置
          </button>
          <button @click="exportLogs" class="export-button">
            📊 导出日志
          </button>
        </div>
      </div>
    </div>

    <!-- 日志统计 -->
    <div class="stats-section">
      <div class="stat-card error">
        <div class="stat-icon">❌</div>
        <div class="stat-info">
          <h3>错误</h3>
          <p>{{ stats.error }}</p>
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info">
          <h3>警告</h3>
          <p>{{ stats.warning }}</p>
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">ℹ️</div>
        <div class="stat-info">
          <h3>信息</h3>
          <p>{{ stats.info }}</p>
        </div>
      </div>
      <div class="stat-card total">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <h3>总计</h3>
          <p>{{ stats.total }}</p>
        </div>
      </div>
    </div>

    <!-- 日志列表 -->
    <div class="logs-section">
      <div class="section-header">
        <h3>日志列表</h3>
        <div class="header-actions">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜索日志..." 
            class="search-input"
          />
          <button @click="clearLogs" class="clear-button">
            🗑️ 清空日志
          </button>
        </div>
      </div>
      
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
      
      <div v-else-if="filteredLogs.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h4>暂无日志记录</h4>
        <p>系统运行正常，未发现异常</p>
      </div>
      
      <div v-else class="logs-list">
        <div 
          v-for="log in paginatedLogs" 
          :key="log.id" 
          class="log-card"
          :class="log.level"
        >
          <div class="log-header">
            <div class="log-meta">
              <span class="log-level-badge" :class="log.level">
                {{ getLevelLabel(log.level) }}
              </span>
              <span class="log-module">{{ log.module }}</span>
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            </div>
            <button @click="toggleLogDetails(log)" class="details-button">
              {{ log.showDetails ? '收起' : '详情' }}
            </button>
          </div>
          <div class="log-content">
            <p class="log-message">{{ log.message }}</p>
            <div v-if="log.showDetails" class="log-details">
              <div class="detail-item">
                <span class="detail-label">错误代码:</span>
                <span class="detail-value">{{ log.errorCode || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">影响范围:</span>
                <span class="detail-value">{{ log.impact || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">处理状态:</span>
                <span class="detail-value" :class="log.status">{{ log.status || '未处理' }}</span>
              </div>
              <div v-if="log.stack" class="detail-item">
                <span class="detail-label">堆栈信息:</span>
                <pre class="stack-trace">{{ log.stack }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="filteredLogs.length > 0" class="pagination">
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
    </div>

    <!-- 日志分析 -->
    <div class="analysis-section">
      <h3>日志分析</h3>
      <div class="charts-grid">
        <div class="chart-card">
          <h4>日志级别分布</h4>
          <VChart
            class="pie-chart"
            :option="levelDistributionOption"
            autoresize
          />
        </div>
        <div class="chart-card">
          <h4>模块错误分布</h4>
          <VChart
            class="pie-chart"
            :option="moduleDistributionOption"
            autoresize
          />
        </div>
        <div class="chart-card">
          <h4>24小时错误趋势</h4>
          <VChart
            class="trend-chart"
            :option="errorTrendOption"
            autoresize
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

// 筛选条件
const filter = ref({
  startDate: '',
  endDate: '',
  level: '',
  module: ''
})

// 搜索查询
const searchQuery = ref('')

// 加载状态
const isLoading = ref(false)

// 日志数据（初始为空，从API加载）
const logs = ref<Array<{
  id: number | string
  level: string
  module: string
  message: string
  errorCode?: string
  impact?: string
  status?: string
  timestamp: number
  stack?: string
  showDetails: boolean
}>>([])

// 分页
const currentPage = ref(1)
const pageSize = 10

// 计算过滤后的日志
const filteredLogs = computed(() => {
  let result = [...logs.value]
  
  // 按日期筛选
  if (filter.value.startDate) {
    const start = new Date(filter.value.startDate).getTime()
    result = result.filter(log => log.timestamp >= start)
  }
  
  if (filter.value.endDate) {
    const end = new Date(filter.value.endDate).getTime() + 24 * 60 * 60 * 1000
    result = result.filter(log => log.timestamp <= end)
  }
  
  // 按级别筛选
  if (filter.value.level) {
    result = result.filter(log => log.level === filter.value.level)
  }
  
  // 按模块筛选
  if (filter.value.module) {
    result = result.filter(log => log.module === filter.value.module)
  }
  
  // 按搜索查询筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(log => 
      log.message.toLowerCase().includes(query) ||
      log.module.toLowerCase().includes(query) ||
      (log.errorCode && log.errorCode.toLowerCase().includes(query))
    )
  }
  
  // 按时间倒序排序
  return result.sort((a, b) => b.timestamp - a.timestamp)
})

// 分页后的日志
const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredLogs.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredLogs.value.length / pageSize)
})

// 统计数据
const stats = computed(() => {
  const error = filteredLogs.value.filter(log => log.level === 'error').length
  const warning = filteredLogs.value.filter(log => log.level === 'warning').length
  const info = filteredLogs.value.filter(log => log.level === 'info').length
  const total = filteredLogs.value.length
  
  return { error, warning, info, total }
})

// 应用筛选
const applyFilter = async () => {
  currentPage.value = 1
  await fetchLogs()
}

// 重置筛选
const resetFilter = () => {
  filter.value = {
    startDate: '',
    endDate: '',
    level: '',
    module: ''
  }
  searchQuery.value = ''
  currentPage.value = 1
  fetchLogs()
}

// 获取日志数据
const fetchLogs = async () => {
  isLoading.value = true
  try {
    const params = new URLSearchParams()
    if (filter.value.level) params.append('level', filter.value.level)
    
    const response = await fetch(`/api/logs?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (!response.ok) {
      logs.value = []
      return
    }
    
    const data = await response.json()
    logs.value = data.logs ? data.logs.map((log: any, index: number) => ({
      id: index + 1,
      level: log.level || 'info',
      message: typeof log.message === 'string' ? log.message : JSON.stringify(log.message),
      timestamp: new Date(log.timestamp || Date.now()).getTime(),
      module: log.module || log.service || 'system',
      errorCode: log.errorCode || log.code || '',
      impact: log.impact || '',
      status: log.status || '',
      stack: log.stack || log.error || '',
      showDetails: false
    })) : []
  } catch (error) {
    console.error('获取日志失败:', error)
    logs.value = []
  } finally {
    isLoading.value = false
  }
}

// 导出日志
const exportLogs = () => {
  // 实现导出逻辑
  console.log('导出日志')
  alert('日志已导出')
}

// 清空日志
const clearLogs = () => {
  if (confirm('确定要清空所有日志吗？')) {
    logs.value = []
    console.log('清空日志')
  }
}

// 切换日志详情
const toggleLogDetails = (log: any) => {
  log.showDetails = !log.showDetails
}

// 获取级别标签
const getLevelLabel = (level: string) => {
  const levelMap: Record<string, string> = {
    'error': '错误',
    'warning': '警告',
    'info': '信息'
  }
  return levelMap[level] || level
}

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 日志级别分布图
const levelDistributionOption = computed(() => ({
  tooltip: {
    trigger: 'item'
  },
  legend: {
    orient: 'vertical',
    left: 'left'
  },
  series: [
    {
      name: '日志级别',
      type: 'pie',
      radius: '60%',
      data: [
        { value: stats.value.error, name: '错误' },
        { value: stats.value.warning, name: '警告' },
        { value: stats.value.info, name: '信息' }
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }
  ]
}))

// 模块错误分布图
const moduleDistributionOption = computed(() => ({
  tooltip: {
    trigger: 'item'
  },
  legend: {
    orient: 'vertical',
    left: 'left'
  },
  series: [
    {
      name: '模块错误',
      type: 'pie',
      radius: '60%',
      data: [
        { value: logs.value.filter(l => l.level === 'error' && l.module === 'camera').length, name: '摄像头' },
        { value: logs.value.filter(l => l.level === 'error' && l.module === 'video').length, name: '视频分析' },
        { value: logs.value.filter(l => l.level === 'error' && l.module === 'ai').length, name: 'AI模型' },
        { value: logs.value.filter(l => l.level === 'error' && l.module === 'system').length, name: '系统' }
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }
  ]
}))

// 24小时错误趋势图
const errorTrendOption = computed(() => {
  const hourlyData = Array.from({ length: 24 }, () => 0)
  const now = Date.now()
  logs.value.forEach(log => {
    if (log.level === 'error' || log.level === 'warning') {
      const hoursAgo = Math.max(0, Math.min(23, Math.floor((now - log.timestamp) / 3600000)))
      hourlyData[23 - hoursAgo]++
    }
  })
  
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`)
    },
    yAxis: { type: 'value', min: 0 },
    series: [
      {
        name: '异常数',
        type: 'line',
        data: hourlyData
      }
    ]
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
  
  fetchLogs()
})
</script>

<style scoped>
.logs {
  width: 100%;
}

.logs-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.logs-header h2 {
  font-size: 1.8rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.logs-header p {
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

select,
.search-input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-button,
.reset-button,
.export-button,
.clear-button {
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

.export-button {
  background: var(--success-color);
  color: white;
}

.export-button:hover {
  background: #218838;
}

.clear-button {
  background: var(--danger-color);
  color: white;
}

.clear-button:hover {
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
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px var(--shadow-hover);
}

.stat-card.error {
  border-left: 4px solid var(--danger-color);
}

.stat-card.warning {
  border-left: 4px solid var(--warning-color);
}

.stat-card.info {
  border-left: 4px solid var(--accent-color);
}

.stat-card.total {
  border-left: 4px solid var(--success-color);
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

.stat-card.error .stat-icon {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger-color);
}

.stat-card.warning .stat-icon {
  background: rgba(255, 193, 7, 0.1);
  color: var(--warning-color);
}

.stat-card.info .stat-icon {
  background: rgba(74, 144, 226, 0.1);
  color: var(--accent-color);
}

.stat-card.total .stat-icon {
  background: rgba(40, 167, 69, 0.1);
  color: var(--success-color);
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

/* 日志区域 */
.logs-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin: 0;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  width: 300px;
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

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.log-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 4px var(--shadow);
  transition: all 0.3s ease;
  border-left: 4px solid var(--accent-color);
}

.log-card:hover {
  box-shadow: 0 4px 8px var(--shadow-hover);
}

.log-card.error {
  border-left-color: var(--danger-color);
}

.log-card.warning {
  border-left-color: var(--warning-color);
}

.log-card.info {
  border-left-color: var(--accent-color);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.log-level-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.log-level-badge.error {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger-color);
}

.log-level-badge.warning {
  background: rgba(255, 193, 7, 0.1);
  color: var(--warning-color);
}

.log-level-badge.info {
  background: rgba(74, 144, 226, 0.1);
  color: var(--accent-color);
}

.log-module {
  font-size: 0.9rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

.log-time {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.details-button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.details-button:hover {
  background: var(--accent-hover);
}

.log-content {
  margin-top: 1rem;
}

.log-message {
  font-size: 1rem;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 1rem;
}

.log-details {
  background: var(--bg-primary);
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 3px solid var(--accent-color);
}

.detail-item {
  display: flex;
  margin-bottom: 0.5rem;
  align-items: flex-start;
}

.detail-label {
  width: 100px;
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.detail-value {
  flex: 1;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.detail-value.error {
  color: var(--danger-color);
}

.detail-value.warning {
  color: var(--warning-color);
}

.detail-value.success {
  color: var(--success-color);
}

.stack-trace {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 0.8rem;
  font-size: 0.85rem;
  line-height: 1.4;
  overflow-x: auto;
  margin-top: 0.5rem;
  color: #333;
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

/* 分析区域 */
.analysis-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.analysis-section h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.chart-card h4 {
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.pie-chart,
.trend-chart {
  width: 100%;
  height: 300px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-grid,
  .stats-section,
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .header-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input {
    width: 100%;
  }
  
  .filter-actions {
    flex-direction: column;
  }
  
  .filter-button,
  .reset-button,
  .export-button,
  .clear-button {
    width: 100%;
  }
  
  .log-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .detail-item {
    flex-direction: column;
    gap: 0.2rem;
  }
  
  .detail-label {
    width: auto;
  }
}
</style>