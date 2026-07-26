<template>
  <div class="home">
    <div class="home-header">
      <h2>系统总览</h2>
      <p>基于YOLO与DeepSeek的患者跌倒智能检测系统</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon normal">📹</div>
        <div class="stat-info">
          <h3>摄像头状态</h3>
          <p>在线: 3/3</p>
          <p>运行正常</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon normal">📊</div>
        <div class="stat-info">
          <h3>今日监测</h3>
          <p>患者: 12人</p>
          <p>异常: {{ totalAlerts }}次</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon normal">🤖</div>
        <div class="stat-info">
          <h3>AI模型</h3>
          <p>YOLOv8 + DeepSeek</p>
          <p>准确率: 95.2%</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon normal">⚙️</div>
        <div class="stat-info">
          <h3>系统状态</h3>
          <p>运行时间: 72h</p>
          <p>无异常</p>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-section">
      <h3>数据分析</h3>
      <div class="charts-grid">
        <!-- 24小时跌倒趋势图 -->
        <div class="chart-card">
          <h4>24小时跌倒趋势</h4>
          <VChart
            class="trend-chart"
            :option="trendChartOption"
            autoresize
          />
        </div>
        
        <!-- 摄像头热力分布 -->
        <div class="chart-card">
          <h4>摄像头风险热力分布</h4>
          <VChart
            class="heatmap-chart"
            :option="heatmapChartOption"
            autoresize
          />
        </div>
      </div>
    </div>

    <div class="features-section">
      <h3>核心功能</h3>
      <div class="features-grid">
        <router-link to="/camera" class="feature-card">
          <div class="feature-icon">📹</div>
          <h4>实时监控</h4>
          <p>实时监测患者状态，预警跌倒风险</p>
          <div class="feature-arrow">→</div>
        </router-link>
        
        <router-link to="/video" class="feature-card">
          <div class="feature-icon">🎥</div>
          <h4>视频分析</h4>
          <p>分析历史视频，识别跌倒事件</p>
          <div class="feature-arrow">→</div>
        </router-link>
        
        <router-link to="/deepseek" class="feature-card">
          <div class="feature-icon">🤖</div>
          <h4>AI参数设置</h4>
          <p>智能优化检测参数，提高准确率</p>
          <div class="feature-arrow">→</div>
        </router-link>
        
        <router-link to="/events" class="feature-card">
          <div class="feature-icon">📋</div>
          <h4>异常日志</h4>
          <p>查看历史异常事件记录</p>
          <div class="feature-arrow">→</div>
        </router-link>
        
        <router-link to="/patient-records" class="feature-card" v-if="authStore.isAdmin">
          <div class="feature-icon">👤</div>
          <h4>患者档案</h4>
          <p>管理患者基本信息</p>
          <div class="feature-arrow">→</div>
        </router-link>
        
        <router-link to="/medical-qa" class="feature-card">
          <div class="feature-icon">❓</div>
          <h4>医疗问答</h4>
          <p>AI辅助医疗咨询</p>
          <div class="feature-arrow">→</div>
        </router-link>
      </div>
    </div>

    <div class="system-info">
      <h3>系统信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">系统版本</span>
          <span class="info-value">v1.0.0</span>
        </div>
        <div class="info-item">
          <span class="info-label">AI模型</span>
          <span class="info-value">YOLOv8 + DeepSeek</span>
        </div>
        <div class="info-item">
          <span class="info-label">检测精度</span>
          <span class="info-value">95.2%</span>
        </div>
        <div class="info-item">
          <span class="info-label">响应时间</span>
          <span class="info-value">< 500ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDetectionStore } from '../stores/detection'
import { useAuthStore } from '../stores/auth'

const detectionStore = useDetectionStore()
const authStore = useAuthStore()

// 原始事件数据
const rawEvents = ref<Array<{
  type: string
  severity: string
  timestamp: number
  cameraId: string
}>>([])

let pollTimer: ReturnType<typeof setInterval> | null = null

// 从API获取事件数据
const fetchEvents = async () => {
  try {
    const response = await fetch('/api/events', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    if (!response.ok) return
    const data = await response.json()
    rawEvents.value = (data.events || []).map((e: any) => ({
      type: e.type,
      severity: e.severity,
      timestamp: e.timestamp,
      cameraId: e.cameraId || e.camera_id || 'unknown'
    }))
  } catch (error) {
    console.error('[Home] 获取事件数据失败:', error)
  }
}

// 获取事件的小时（0-23）
const getEventHour = (timestamp: number): number => {
  return new Date(timestamp).getHours()
}

// 计算总告警次数（过去24小时内fall和high_risk事件的数量）
const totalAlerts = computed(() => {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  return rawEvents.value.filter(e => {
    const t = e.timestamp
    return t >= oneDayAgo && t <= now && (e.type === 'fall' || e.type === 'high_risk')
  }).length
})

// 24小时跌倒趋势图配置（基于真实事件数据）
const trendChartOption = computed(() => {
  const hourCounts = new Array(24).fill(0)
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  rawEvents.value.forEach(e => {
    const t = e.timestamp
    if (t >= oneDayAgo && t <= now && (e.type === 'fall' || e.type === 'high_risk')) {
      const hour = getEventHour(t)
      hourCounts[hour]++
    }
  })

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      outerLabels: { show: true }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: {
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      }
    },
    series: [
      {
        name: '跌倒次数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: '#4a90e2',
          width: 2
        },
        itemStyle: {
          color: '#4a90e2'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(74, 144, 226, 0.3)' },
              { offset: 1, color: 'rgba(74, 144, 226, 0.05)' }
            ]
          }
        },
        data: hourCounts
      }
    ]
  }
})

// 获取摄像头名称
const getCameraName = (cameraId: string): string => {
  const cameraMap: Record<string, string> = {
    'cam1': '摄像头1',
    'cam2': '摄像头2',
    'cam3': '摄像头3'
  }
  return cameraMap[cameraId] || cameraId
}

// 获取唯一的摄像头列表
const uniqueCameras = computed(() => {
  const cameras = new Set<string>()
  rawEvents.value.forEach(e => cameras.add(e.cameraId))
  const result = Array.from(cameras)
  return result.length > 0 ? result.slice(0, 3) : ['cam1', 'cam2', 'cam3']
})

// 摄像头风险热力分布图配置（基于真实事件数据）
const heatmapChartOption = computed(() => {
  const cameras = uniqueCameras.value
  const cameraLabels = cameras.map(c => getCameraName(c))
  
  // 构建 [cameraIndex, hour, riskLevel] 热力图数据
  const heatData: Array<[number, number, number]> = []
  
  cameras.forEach((cameraId, camIndex) => {
    for (let hour = 0; hour < 24; hour++) {
      const eventsInHour = rawEvents.value.filter(e => {
        const eHour = getEventHour(e.timestamp)
        return e.cameraId === cameraId && eHour === hour
      })
      
      let riskLevel = 0 // 默认低风险
      if (eventsInHour.length > 0) {
        const hasFall = eventsInHour.some(e => e.type === 'fall')
        const hasHighRisk = eventsInHour.some(e => e.type === 'high_risk')
        if (hasFall) {
          riskLevel = 2 // 高风险
        } else if (hasHighRisk) {
          riskLevel = 1 // 中风险
        }
      }
      
      heatData.push([camIndex, hour, riskLevel])
    }
  })
  
  return {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const camName = cameraLabels[params.data[0]] || `摄像头${params.data[0] + 1}`
        return `${camName}<br/>时间: ${params.data[1]}:00<br/>风险等级: ${params.data[2] === 0 ? '低' : params.data[2] === 1 ? '中' : '高'}`
      }
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: cameraLabels,
      axisLabel: {
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: {
        color: '#666',
        fontSize: 10
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    },
    visualMap: {
      min: 0,
      max: 2,
      calculable: true,
      orient: 'vertical',
      right: '2%',
      top: 'center',
      itemHeight: 100,
      itemWidth: 15,
      inRange: {
        color: ['#67c23a', '#e6a23c', '#f56c6c']
      },
      textStyle: {
        color: '#666'
      },
      formatter: (value: number) => {
        return value === 0 ? '低' : value === 1 ? '中' : '高'
      }
    },
    series: [
      {
        name: '风险等级',
        type: 'heatmap',
        data: heatData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
})

// 组件挂载时刷新数据
onMounted(() => {
  fetchEvents()
  pollTimer = setInterval(fetchEvents, 10000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.home {
  width: 100%;
}

.home-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.home-header h2 {
  font-size: 2rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.home-header p {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
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

.stat-icon {
  font-size: 2rem;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.normal {
  background: var(--info-bg);
  color: var(--accent-color);
}

.stat-info h3 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 0.3rem;
}

.stat-info p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

/* 图表区域 */
.charts-section {
  margin-bottom: 2rem;
}

.charts-section h3 {
  font-size: 1.5rem;
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
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.chart-card h4 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.trend-chart,
.heatmap-chart {
  width: 100%;
  height: 300px;
}

/* 功能卡片 */
.features-section {
  margin-bottom: 2rem;
}

.features-section h3 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 2rem;
  box-shadow: 0 2px 4px var(--shadow);
  text-decoration: none;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  position: relative;
  overflow: hidden;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px var(--shadow-hover);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--accent-color);
}

.feature-card h4 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.feature-card p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.4;
  flex: 1;
  margin-bottom: 1rem;
}

.feature-arrow {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  font-size: 1.5rem;
  color: var(--accent-color);
  transition: transform 0.3s ease;
}

.feature-card:hover .feature-arrow {
  transform: translateX(5px);
}

/* 系统信息 */
.system-info {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.system-info h3 {
  font-size: 1.3rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.info-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.info-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-grid,
  .features-grid,
  .info-grid,
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .home-header h2 {
    font-size: 1.5rem;
  }
  
  .home-header p {
    font-size: 1rem;
  }
  
  .trend-chart,
  .heatmap-chart {
    height: 250px;
  }
}
</style>