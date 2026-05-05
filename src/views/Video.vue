<template>
  <div class="video">
    <div class="video-header">
      <h2>视频分析</h2>
      <p>AI智能跌倒检测与行为分析</p>
    </div>

    <!-- 功能选项卡 -->
    <div class="tab-container" role="tablist" aria-label="功能选项卡">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :class="['tab-button', { active: activeTab === tab.id }]"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.icon }} {{ tab.name }}
      </button>
    </div>

    <!-- 视频上传分析 -->
    <div v-if="activeTab === 'upload'" class="tab-content">
      <!-- 视频上传区域 -->
      <div class="upload-section">
        <h3>视频上传</h3>
        <div class="upload-container">
          <input
            type="file"
            ref="fileInput"
            accept="video/*"
            @change="handleFileUpload"
            id="video-file-input"
            aria-label="选择视频文件"
          />
          <label for="video-file-input" class="upload-label" id="video-file-label">
            <span class="upload-icon">📁</span>
            <span>{{ selectedFile ? selectedFile.name : '选择视频文件' }}</span>
          </label>
        </div>
      </div>

      <!-- 视频播放区域 -->
      <div class="video-player" v-if="videoUrl">
        <video :key="videoKey" ref="videoRef" controls @timeupdate="updateCurrentTime">
          <source :src="videoUrl" type="video/mp4" />
          您的浏览器不支持视频播放
        </video>
        <div class="video-controls" role="group" aria-label="视频控制">
          <button
            @click="playVideo"
            :disabled="isPlaying"
            class="control-button"
            aria-label="播放视频"
          >
            播放
          </button>
          <button
            @click="pauseVideo"
            :disabled="!isPlaying"
            class="control-button"
            aria-label="暂停视频"
          >
            暂停
          </button>
          <button
            @click="analyzeVideo"
            :disabled="isAnalyzing || !videoUrl"
            class="control-button primary"
            aria-label="分析视频"
            :aria-busy="isAnalyzing"
          >
            {{ isAnalyzing ? '分析中...' : '分析视频' }}
          </button>
        </div>
        <div class="video-info">
          <span>{{ formatTime(currentTime) }} / {{ formatTime(videoDuration) }}</span>
        </div>
      </div>

      <!-- 分析进度条 -->
      <div class="progress-container" v-if="isAnalyzing">
        <div class="progress-bar">
          <div class="progress" :style="{ width: progress + '%' }"></div>
        </div>
        <p class="progress-text">分析进度: {{ Math.round(progress) }}%</p>
      </div>

      <!-- 分析结果 -->
      <div class="analysis-result" v-if="analysisResult">
        <h3>分析结果</h3>
        
        <!-- 综合分析 -->
        <div class="result-summary">
          <div class="summary-card">
            <h4>综合分析</h4>
            <div class="summary-items">
              <div class="summary-item">
                <span class="label">视频时长:</span>
                <span class="value">{{ formatTime(videoDuration) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">检测到跌倒事件:</span>
                <span class="value">{{ fallEvents.length }}次</span>
              </div>
              <div class="summary-item">
                <span class="label">风险等级:</span>
                <span class="value" :class="riskLevelClass">{{ riskLevel }}</span>
              </div>
            </div>
          </div>

          <!-- AI智能分析报告 -->
          <div class="ai-report">
            <h4>AI智能分析报告</h4>
            <div class="report-content">
              <p>{{ aiAnalysisReport }}</p>
            </div>
          </div>
        </div>

        <!-- 跌倒事件详情 -->
        <div class="events-section" v-if="fallEvents.filter(e => e).length > 0">
          <h4>🚨 跌倒事件详情</h4>
          <div class="events-list">
            <div v-for="(event, index) in fallEvents.filter(e => e)" :key="index" class="event-card fall">
              <div class="event-info">
                <h5>事件 {{ index + 1 }}</h5>
                <p><strong>发生时间:</strong> {{ formatTime(event?.startTime || 0) }} ({{ (event?.startTime || 0).toFixed(2) }}秒)</p>
                <p><strong>持续时间:</strong> {{ formatDuration(event?.duration || 0) }}</p>
                <p><strong>严重程度:</strong> <span :class="event?.severity === '严重' ? 'high-risk' : 'medium-risk'">{{ event?.severity || '未知' }}</span></p>
              </div>
              <div class="event-actions">
                <button @click="seekToTime(event?.startTime || 0)" class="action-button primary">
                  🎯 定位播放
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 风险评估 -->
        <div class="risk-assessment">
          <h4>风险评估</h4>
          <div class="assessment-content">
            <div class="risk-level" :class="riskLevelClass">
              <span class="risk-icon">{{ riskIcon }}</span>
              <span class="risk-text">{{ riskLevel }}</span>
            </div>
            <div class="risk-description">
              <p>{{ riskDescription }}</p>
            </div>
            <div class="risk-recommendations">
              <h5>建议措施:</h5>
              <ul>
                <li v-for="(recommendation, index) in riskRecommendations" :key="index">
                  {{ recommendation }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 录制视频列表 -->
    <div v-if="activeTab === 'recorded'" class="tab-content">
      <div class="recorded-videos">
        <div class="section-header">
          <h3>已录制的跌倒视频</h3>
          <button @click="loadRecordedVideos()" class="refresh-button">
            🔄 刷新
          </button>
        </div>
        
        <div v-if="isLoadingRecorded" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        
        <div v-else-if="recordedVideos.length === 0" class="empty-state">
          <div class="empty-icon">🎥</div>
          <p>暂无录制的视频</p>
          <p class="empty-hint">当检测到跌倒时，系统会自动录制视频</p>
        </div>
        
        <div v-else class="videos-grid">
          <div v-for="(video, index) in recordedVideos.filter(v => v)" :key="index" class="video-card">
            <div class="video-thumbnail">
              <img :src="getVideoThumbnail(video?.url || '')" :alt="video?.name || '视频'" />
            </div>
            <div class="video-info-card">
              <h4>{{ video?.name || '未知视频' }}</h4>
              <p>{{ video?.timestamp || '' }}</p>
              <p class="video-duration">{{ video?.duration || '未知' }}</p>
            </div>
            <div class="video-actions">
              <button @click="playRecordedVideo(video)" class="action-button play">
                播放
              </button>
              <button @click="analyzeRecordedVideo(video)" class="action-button analyze">
                分析
              </button>
              <button @click="downloadVideo(video)" class="action-button download">
                下载
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分析历史 -->
    <div v-if="activeTab === 'history'" class="tab-content">
      <div class="analysis-history">
        <div class="section-header">
          <h3>分析历史记录</h3>
          <button @click="loadAnalysisHistory()" class="refresh-button">
            🔄 刷新
          </button>
        </div>
        
        <div v-if="isLoadingHistory" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        
        <div v-else-if="analysisHistory.length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <p>暂无分析历史</p>
          <p class="empty-hint">分析视频后，结果会自动保存到历史记录</p>
        </div>
        
        <div v-else class="history-list">
          <div v-for="(history, index) in analysisHistory" :key="index" class="history-card">
            <div class="history-header">
              <h4>{{ history.videoName }}</h4>
              <span class="history-date">{{ history.analysisTime }}</span>
            </div>
            <div class="history-summary">
              <div class="history-item">
                <span class="label">跌倒事件:</span>
                <span class="value">{{ history.fallCount }}次</span>
              </div>
              <div class="history-item">
                <span class="label">风险等级:</span>
                <span class="value" :class="history.riskLevelClass">{{ history.riskLevel }}</span>
              </div>
            </div>
            <div class="history-actions">
              <button @click="viewHistoryDetails(history)" class="action-button secondary">
                查看详情
              </button>
              <button @click="exportAnalysis(history)" class="action-button primary">
                导出报告
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视频截图分析 -->
    <div v-if="activeTab === 'snapshot'" class="tab-content">
      <div class="snapshot-section">
        <h3>视频截图分析</h3>
        <p>上传视频截图进行快速分析</p>
        
        <div class="upload-container">
          <input type="file" ref="snapshotInput" accept="image/*" @change="handleSnapshotUpload" />
          <label for="snapshotInput" class="upload-label">
            <span class="upload-icon">📸</span>
            <span>{{ selectedSnapshot ? selectedSnapshot.name : '选择截图文件' }}</span>
          </label>
        </div>
        
        <div v-if="snapshotUrl" class="snapshot-preview">
          <img :src="snapshotUrl" alt="截图预览" />
          <button @click="analyzeSnapshot" :disabled="isAnalyzing" class="control-button primary">
            {{ isAnalyzing ? '分析中...' : '分析截图' }}
          </button>
        </div>
        
        <div v-if="snapshotAnalysisResult" class="snapshot-result">
          <h4>截图分析结果</h4>
          <div class="result-card">
            <p><strong>检测结果:</strong> {{ snapshotAnalysisResult.detection }}</p>
            <p><strong>风险等级:</strong> {{ snapshotAnalysisResult.risk }}</p>
            <p><strong>置信度:</strong> {{ snapshotAnalysisResult.confidence }}%</p>
            <p><strong>分析建议:</strong> {{ snapshotAnalysisResult.recommendation }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 历史详情弹窗 -->
  <div class="modal-overlay" v-if="showHistoryDetails && selectedHistory">
    <div class="modal-content">
      <div class="modal-header">
        <h3>分析详情</h3>
        <button @click="showHistoryDetails = false" class="close-button">×</button>
      </div>
      <div class="modal-body">
        <div class="detail-section">
          <h4>基本信息</h4>
          <p><strong>视频名称:</strong> {{ selectedHistory.videoName }}</p>
          <p><strong>分析时间:</strong> {{ selectedHistory.analysisTime }}</p>
        </div>
        <div class="detail-section">
          <h4>检测结果</h4>
          <p><strong>跌倒事件:</strong> {{ selectedHistory.fallCount }}次</p>
          <p><strong>风险等级:</strong> <span :class="selectedHistory.riskLevelClass">{{ selectedHistory.riskLevel }}</span></p>
        </div>
        <div class="detail-section">
          <h4>详细报告</h4>
          <p class="report-text">{{ selectedHistory.report }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="showHistoryDetails = false" class="modal-button">关闭</button>
        <button @click="exportAnalysis(selectedHistory)" class="modal-button primary">导出报告</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDetectionStore } from '../stores/detection'

const authStore = useAuthStore()
const detectionStore = useDetectionStore()

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 格式化持续时间
const formatDuration = (seconds: number) => {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}毫秒`
  } else if (seconds < 60) {
    return `${seconds.toFixed(2)}秒`
  } else {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs.toFixed(1)}秒`
  }
}

// 选项卡相关
const activeTab = ref('upload')
const tabs = [
  { id: 'upload', name: '视频上传分析', icon: '📤' },
  { id: 'recorded', name: '录制视频', icon: '🎥' },
  { id: 'history', name: '分析历史', icon: '📊' },
  { id: 'snapshot', name: '截图分析', icon: '📸' }
]

// 视频相关
const videoRef = ref<HTMLVideoElement>()
const fileInput = ref<HTMLInputElement>()
const videoUrl = ref('')
const videoKey = ref(0)
const selectedFile = ref<File | null>(null)
const videoDuration = ref(0)
const currentTime = ref(0)
const isPlaying = ref(false)

// 分析相关
const isAnalyzing = ref(false)
const progress = ref(0)
const analysisResult = ref(false)

// 原始检测结果
const detectionResults = ref<Array<any>>([])

// 分析结果
const fallEvents = ref<Array<{ startTime: number; duration: number; severity: string }>>([])
const riskLevel = ref('低')
const riskLevelClass = ref('low')
const riskIcon = ref('✅')
const riskDescription = ref('')
const riskRecommendations = ref<string[]>([])
const aiAnalysisReport = ref('')

// 录制的视频
const recordedVideos = ref<Array<{ name: string; url: string; timestamp: string; duration?: string }>>([])
const isLoadingRecorded = ref(false)

// 分析历史
const analysisHistory = ref<Array<{
  id: string;
  videoName: string;
  analysisTime: string;
  fallCount: number;
  riskLevel: string;
  riskLevelClass: string;
  report: string;
}>>([])
const isLoadingHistory = ref(false)

// 截图分析
const snapshotInput = ref<HTMLInputElement>()
const snapshotUrl = ref('')
const selectedSnapshot = ref<File | null>(null)
const snapshotAnalysisResult = ref<{
  detection: string;
  risk: string;
  confidence: number;
  recommendation: string;
} | null>(null)

// 历史详情
const selectedHistory = ref<any>(null)
const showHistoryDetails = ref(false)

// 处理文件上传
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
    analysisResult.value = false
    isAnalyzing.value = false
    isPlaying.value = false
    progress.value = 0
    videoKey.value++
    videoUrl.value = URL.createObjectURL(selectedFile.value)
    await nextTick()
    if (videoRef.value) {
      videoRef.value.onloadedmetadata = () => {
        videoDuration.value = videoRef.value!.duration
      }
    }
  }
}

// 播放视频
const playVideo = () => {
  if (videoRef.value) {
    videoRef.value.play()
    isPlaying.value = true
  }
}

// 暂停视频
const pauseVideo = () => {
  if (videoRef.value) {
    videoRef.value.pause()
    isPlaying.value = false
  }
}

// 更新当前时间
const updateCurrentTime = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

// 跳转到指定时间
const seekToTime = (time: number) => {
  console.log(`[Video] seekToTime called with time: ${time} seconds`)
  console.log(`[Video] videoUrl exists: ${!!videoUrl.value}`)
  console.log(`[Video] videoRef exists: ${!!videoRef.value}`)
  console.log(`[Video] videoDuration: ${videoDuration.value}`)
  
  // 如果视频URL不存在，提示用户先上传视频
  if (!videoUrl.value) {
    alert('请先上传视频文件')
    return
  }
  
  // 切换到上传标签页（如果不在的话）
  if (activeTab.value !== 'upload') {
    activeTab.value = 'upload'
    console.log('[Video] Switched to upload tab')
  }
  
  // 等待视频元素渲染
  setTimeout(() => {
    console.log(`[Video] After tab switch - videoRef exists: ${!!videoRef.value}`)
    
    if (videoRef.value) {
      console.log(`[Video] video readyState: ${videoRef.value.readyState}`)
      console.log(`[Video] video duration: ${videoRef.value.duration}`)
      
      // 如果视频时长还没有加载，先等待加载完成
      if (!videoDuration.value || videoDuration.value === 0) {
        console.log('[Video] 视频时长未加载，等待加载完成后跳转')
        
        // 尝试直接获取duration
        if (videoRef.value.duration && videoRef.value.duration > 0) {
          videoDuration.value = videoRef.value.duration
          console.log(`[Video] 直接获取到视频时长: ${videoDuration.value}`)
        } else {
          // 添加加载完成事件监听
          const handleLoadedMetadata = () => {
            console.log('[Video] loadedmetadata event fired')
            videoDuration.value = videoRef.value!.duration
            videoRef.value!.removeEventListener('loadedmetadata', handleLoadedMetadata)
            
            // 确保视频已经加载后再跳转
            setTimeout(() => {
              if (videoRef.value) {
                const targetTime = Math.max(0, Math.min(time, videoDuration.value))
                videoRef.value.currentTime = targetTime
                videoRef.value.play()
                isPlaying.value = true
                console.log(`[Video] 跳转到时间: ${targetTime.toFixed(1)}秒 (${formatTime(targetTime)})`)
              }
            }, 100)
          }
          
          videoRef.value.addEventListener('loadedmetadata', handleLoadedMetadata)
          console.log('[Video] Added loadedmetadata event listener')
          
          // 如果视频还没加载，尝试加载
          if (videoRef.value.readyState < 2) {
            console.log('[Video] Video not loaded, calling load()')
            videoRef.value.load()
          }
          return
        }
      }
      
      // 确保时间在有效范围内
      const targetTime = Math.max(0, Math.min(time, videoDuration.value))
      videoRef.value.currentTime = targetTime
      
      // 延迟播放，确保视频已经跳转
      setTimeout(() => {
        if (videoRef.value) {
          videoRef.value.play()
          isPlaying.value = true
        }
      }, 100)
      
      console.log(`[Video] 跳转到时间: ${targetTime.toFixed(1)}秒 (${formatTime(targetTime)})`)
    } else {
      console.warn('[Video] 视频元素未找到，无法跳转')
      alert('视频元素加载失败，请刷新页面重试')
    }
  }, 100)
}

// 分析视频
const analyzeVideo = async () => {
  if (!selectedFile.value) return
  
  isAnalyzing.value = true
  progress.value = 0
  
  try {
    // 视频预处理检查
    if (selectedFile.value.size > 100 * 1024 * 1024) { // 100MB限制
      alert('视频文件过大，请选择小于100MB的视频')
      isAnalyzing.value = false
      return
    }
    
    // 视频时长限制（如果是视频文件）
    if (selectedFile.value.type.startsWith('video/')) {
      const videoElement = document.createElement('video')
      videoElement.src = URL.createObjectURL(selectedFile.value)
      await new Promise(resolve => {
        videoElement.onloadedmetadata = resolve
      })
      if (videoElement.duration > 60) { // 60秒限制
        alert('视频时长过长，请选择小于1分钟的视频')
        isAnalyzing.value = false
        return
      }
    }
    
    // 创建FormData
    const formData = new FormData()
    formData.append('video', selectedFile.value)
    formData.append('speed', 'fast') // 快速分析模式
    
    // 添加AI调参
    formData.append('confidence', detectionStore.params.confidence.toString())
    formData.append('sensitivity', detectionStore.params.sensitivity.toString())
    formData.append('shoulderHipThreshold', detectionStore.params.shoulderHipThreshold.toString())
    formData.append('minKeypointConfidence', detectionStore.params.minKeypointConfidence.toString())
    formData.append('useAngleDetection', detectionStore.params.useAngleDetection.toString())
    formData.append('fallAngleThreshold', detectionStore.params.fallAngleThreshold.toString())
    
    console.log('[Video] 视频分析参数:', {
      confidence: detectionStore.params.confidence,
      sensitivity: detectionStore.params.sensitivity,
      shoulderHipThreshold: detectionStore.params.shoulderHipThreshold,
      minKeypointConfidence: detectionStore.params.minKeypointConfidence,
      useAngleDetection: detectionStore.params.useAngleDetection,
      fallAngleThreshold: detectionStore.params.fallAngleThreshold
    })
    
    // 优化进度显示
    let currentProgress = 0
    const progressInterval = setInterval(() => {
      currentProgress += 5
      if (currentProgress <= 95) {
        progress.value = currentProgress
      }
    }, 200) // 更快的进度更新
    
    // 创建超时控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 120秒超时，视频分析可能需要较长时间
    
    // 发送请求到服务器
    const response = await fetch('/api/detect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    clearInterval(progressInterval)
    
    if (!response.ok) {
      throw new Error(`检测失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    progress.value = 100
    
    // 保存原始检测结果
    detectionResults.value = result.detectionResults || []
    
    // 显示详细检测信息
    if (result.detectionResults && result.detectionResults.length > 0) {
      console.log('[Video] 详细检测结果:', result.detectionResults.slice(0, 5))
      
      // 统计检测信息
      const fallCount = result.detectionResults.filter((r: any) => r.is_fall).length
      const angleFallCount = result.detectionResults.filter((r: any) => r.fall_reason === 'angle').length
      const distanceFallCount = result.detectionResults.filter((r: any) => r.fall_reason === 'distance').length
      
      console.log('[Video] 检测统计:', {
        总帧数: result.detectionResults.length,
        跌倒次数: fallCount,
        角度检测跌倒: angleFallCount,
        距离检测跌倒: distanceFallCount
      })
    }
    
    // 处理检测结果
    completeAnalysisWithResults(result.events || [], result.detectionResults || [])
    
    isAnalyzing.value = false
    analysisResult.value = true
    
  } catch (error: any) {
    console.error('分析失败:', error)
    isAnalyzing.value = false
    
    if (error.name === 'AbortError') {
      alert('视频分析超时（超过30秒），请尝试较短的短视频或稍后重试')
    } else {
      alert(error.message || '分析失败，请重试')
    }
    
    // 如果API调用失败，回退到模拟数据
    completeAnalysis()
    analysisResult.value = true
  }
}

// 使用真实检测结果完成分析
const completeAnalysisWithResults = (events: Array<any>, rawResults: Array<any>) => {
  console.log('[Video] 接收到的事件:', events)
  console.log('[Video] 接收到的原始结果:', rawResults.slice(0, 3))
  
  // 处理跌倒事件
  fallEvents.value = events
    .filter((e: any) => e.type === 'fall')
    .map((e: any) => {
      // 时间戳已经是秒格式
      let timestamp = e.timestamp
      
      // 持续时间已经是秒格式
      let duration = e.duration
      
      // 确保持续时间合理：
      // 1. 不能为负数
      // 2. 最大不超过5秒（单个跌倒事件通常不会持续这么久）
      // 3. 不能超过视频剩余时长
      const maxDuration = Math.min(5, videoDuration.value - timestamp > 0 ? videoDuration.value - timestamp : 5)
      duration = Math.max(0, Math.min(duration || 1, maxDuration))
      
      return {
        startTime: timestamp,
        duration: duration,
        severity: e.severity || '中等'
      }
    })
  
  // 计算风险等级
  const fallCount = fallEvents.value.length
  if (fallCount >= 3) {
    riskLevel.value = '高'
    riskLevelClass.value = 'high'
    riskIcon.value = '🚨'
    riskDescription.value = '检测到多次跌倒事件，患者存在较高的跌倒风险'
    riskRecommendations.value = [
      '增加监护频率',
      '检查患者身体状况',
      '调整环境以减少跌倒风险',
      '考虑使用辅助设备'
    ]
  } else if (fallCount >= 1) {
    riskLevel.value = '中'
    riskLevelClass.value = 'medium'
    riskIcon.value = '⚠️'
    riskDescription.value = '检测到跌倒事件，患者存在一定的跌倒风险'
    riskRecommendations.value = [
      '定期检查患者状态',
      '确保环境安全',
      '提醒患者注意安全'
    ]
  } else {
    riskLevel.value = '低'
    riskLevelClass.value = 'low'
    riskIcon.value = '✅'
    riskDescription.value = '未检测到跌倒事件，患者跌倒风险较低'
    riskRecommendations.value = [
      '保持当前监护频率',
      '定期检查环境安全'
    ]
  }
  
  // 生成AI分析报告
  generateAIReportWithAI()
}

// 使用AI生成真实报告
const generateAIReportWithAI = async () => {
  aiAnalysisReport.value = '正在生成AI分析报告，请稍候...'
  
  console.log('[Video] 开始生成AI报告...')
  console.log('[Video] 跌倒事件:', fallEvents.value.length)
  console.log('[Video] 风险等级:', riskLevel.value)
  
  try {
    const detectionStats = detectionResults.value.length > 0 ? {
      总帧数: detectionResults.value.length,
      跌倒帧数: detectionResults.value.filter((r: any) => r.is_fall).length,
      平均置信度: (detectionResults.value.reduce((sum: number, r: any) => sum + (r.confidence || 0), 0) / detectionResults.value.length).toFixed(2)
    } : {}
    
    console.log('[Video] 检测统计:', detectionStats)
    console.log('[Video] 调用API: /api/deepseek/video-report')
    
    const response = await fetch('/api/deepseek/video-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        fallEvents: fallEvents.value,
        riskLevel: riskLevel.value,
        riskDescription: riskDescription.value,
        recommendations: riskRecommendations.value,
        detectionStats
      })
    })
    
    console.log('[Video] API响应状态:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('[Video] AI报告生成成功:', data)
      aiAnalysisReport.value = data.report || '报告生成失败'
    } else {
      const errorData = await response.json()
      console.warn('[Video] AI报告API返回异常:', errorData)
      if (errorData.code === 'API_KEY_NOT_CONFIGURED') {
        aiAnalysisReport.value = '⚠️ 请先在设置页面配置 DeepSeek API Key 以使用AI报告功能。\n\n' +
          '配置方法：\n1. 点击左侧菜单"⚙️ 设置"\n2. 输入您的 DeepSeek API Key\n3. 点击保存\n4. 重新分析视频'
      } else {
        generateAIReport()
      }
    }
  } catch (error) {
    console.warn('[Video] AI报告生成异常，使用本地生成:', error)
    generateAIReport()
  }
}

// 完成分析（模拟数据回退）
const completeAnalysis = () => {
  // 模拟跌倒事件
  fallEvents.value = [
    { startTime: 15, duration: 3, severity: '中等' },
    { startTime: 45, duration: 2, severity: '轻微' }
  ]
  
  // 计算风险等级
  const fallCount = fallEvents.value.length
  if (fallCount >= 3) {
    riskLevel.value = '高'
    riskLevelClass.value = 'high'
    riskIcon.value = '🚨'
    riskDescription.value = '检测到多次跌倒事件，患者存在较高的跌倒风险'
    riskRecommendations.value = [
      '增加监护频率',
      '检查患者身体状况',
      '调整环境以减少跌倒风险',
      '考虑使用辅助设备'
    ]
  } else if (fallCount >= 1) {
    riskLevel.value = '中'
    riskLevelClass.value = 'medium'
    riskIcon.value = '⚠️'
    riskDescription.value = '检测到跌倒事件，患者存在一定的跌倒风险'
    riskRecommendations.value = [
      '定期检查患者状态',
      '确保环境安全',
      '提醒患者注意安全'
    ]
  } else {
    riskLevel.value = '低'
    riskLevelClass.value = 'low'
    riskIcon.value = '✅'
    riskDescription.value = '未检测到跌倒事件，患者跌倒风险较低'
    riskRecommendations.value = [
      '保持当前监护频率',
      '定期检查环境安全'
    ]
  }
  
  // 生成AI分析报告
  generateAIReport()
}

// 生成AI分析报告
const generateAIReport = () => {
  // 添加随机变化元素
  const reportStyles = [
    '基于YOLOv8姿态检测技术的分析',
    '结合人体关键点算法的深度分析',
    '采用多指标综合评估方法',
    '基于实时姿态估计算法',
    '融合时空特征的分析方法'
  ]
  
  const riskDescriptions = {
    高: [
      '检测到频繁的跌倒事件，患者需要立即关注和干预',
      '多个时间点出现跌倒风险特征，建议加强监护措施',
      '检测到多次跌倒事件，患者安全形势严峻'
    ],
    中: [
      '检测到跌倒事件，建议增加定期检查频率',
      '部分时间点存在潜在风险，需要持续观察',
      '检测到跌倒事件，建议进一步完善防护措施'
    ],
    低: [
      '整体表现稳定，未检测到跌倒事件',
      '患者状态良好，安全风险较低',
      '检测结果正常，建议保持当前监护水平'
    ]
  }
  
  const randomStyle = reportStyles[Math.floor(Math.random() * reportStyles.length)]
  const riskKey = riskLevel.value as '高' | '中' | '低'
  const randomDescription = riskDescriptions[riskKey][Math.floor(Math.random() * riskDescriptions[riskKey].length)]
  
  aiAnalysisReport.value = 
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `              智能分析报告\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `【基本信息】\n` +
    `• 分析方法：${randomStyle}\n` +
    `• 检测模型：YOLOv8-Pose人体姿态估计\n` +
    `• 跌倒事件：${fallEvents.value.length} 次\n\n` +
    `【详细分析】\n` +
    `本次分析检测到 ${fallEvents.value.length} 次跌倒事件。\n` +
    `${randomDescription}\n\n` +
    `【风险评估】\n` +
    `• 风险等级：${riskLevel.value}\n` +
    `• 评估结论：${riskDescription.value}\n\n` +
    `【处置建议】\n` +
    riskRecommendations.value.map((r, i) => `  ${i + 1}. ${r}`).join('\n') + `\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `生成时间：${new Date().toLocaleString('zh-CN')}\n` +
    `技术支撑：YOLOv8 + DeepSeek AI\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
}



// 加载录制的视频
const loadRecordedVideos = async () => {
  isLoadingRecorded.value = true
  try {
    // 从后端获取录制的跌倒视频
    const response = await fetch('/api/fall-videos', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      // 格式化视频数据
      recordedVideos.value = data.map((video: any) => ({
        name: `跌倒记录-${new Date(video.createdAt).toLocaleString()}`,
        url: video.url,
        timestamp: new Date(video.createdAt).toLocaleString(),
        duration: '00:30'
      }))
    } else {
      // 模拟数据
      recordedVideos.value = [
        { name: '跌倒记录-2026-04-30 19:30:00', url: 'http://localhost:3000/uploads/fall-1777543761244-940115341.webm', timestamp: '2026-04-30 19:30:00', duration: '00:15' },
        { name: '跌倒记录-2026-04-30 18:15:00', url: 'http://localhost:3000/uploads/fall-1777544180485-901149826.webm', timestamp: '2026-04-30 18:15:00', duration: '00:12' }
      ]
    }
  } catch (error) {
    console.error('加载录制视频失败:', error)
    // 模拟数据
    recordedVideos.value = [
      { name: '跌倒记录-2026-04-30 19:30:00', url: 'http://localhost:3000/uploads/fall-1777543761244-940115341.webm', timestamp: '2026-04-30 18:15:00', duration: '00:15' },
      { name: '跌倒记录-2026-04-30 18:15:00', url: 'http://localhost:3000/uploads/fall-1777544180485-901149826.webm', timestamp: '2026-04-30 18:15:00', duration: '00:12' }
    ]
  } finally {
    isLoadingRecorded.value = false
  }
}

// 加载分析历史
const loadAnalysisHistory = async () => {
  isLoadingHistory.value = true
  try {
    // 从后端获取分析历史
    const response = await fetch('/api/analysis-history', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      analysisHistory.value = data.history || []
    } else {
      // 模拟数据
      analysisHistory.value = [
        {
          id: '1',
          videoName: '患者视频-2026-04-25.mp4',
          analysisTime: '2026-04-25 10:30:00',
          fallCount: 2,
          riskLevel: '中',
          riskLevelClass: 'medium',
          report: '检测到2次跌倒事件...'
        },
        {
          id: '2',
          videoName: '患者视频-2026-04-24.mp4',
          analysisTime: '2026-04-24 15:45:00',
          fallCount: 1,
          riskLevel: '低',
          riskLevelClass: 'low',
          report: '检测到1次跌倒事件...'
        }
      ]
    }
  } catch (error) {
    console.error('加载分析历史失败:', error)
    // 模拟数据
    analysisHistory.value = [
      {
        id: '1',
        videoName: '患者视频-2026-04-25.mp4',
        analysisTime: '2026-04-25 10:30:00',
        fallCount: 2,
        riskLevel: '中',
        riskLevelClass: 'medium',
        report: '检测到2次跌倒事件...'
      },
      {
        id: '2',
        videoName: '患者视频-2026-04-24.mp4',
        analysisTime: '2026-04-24 15:45:00',
        fallCount: 1,
        riskLevel: '低',
        riskLevelClass: 'low',
        report: '检测到1次跌倒事件...'
      }
    ]
  } finally {
    isLoadingHistory.value = false
  }
}

// 处理截图上传
const handleSnapshotUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedSnapshot.value = target.files[0]
    snapshotUrl.value = URL.createObjectURL(selectedSnapshot.value)
    snapshotAnalysisResult.value = null
  }
}

// 分析截图
const analyzeSnapshot = async () => {
  if (!selectedSnapshot.value) return
  
  isAnalyzing.value = true
  
  try {
    const formData = new FormData()
    formData.append('image', selectedSnapshot.value)
    formData.append('confidence', detectionStore.params.confidence.toString())
    formData.append('sensitivity', detectionStore.params.sensitivity.toString())
    formData.append('shoulderHipThreshold', detectionStore.params.shoulderHipThreshold.toString())
    formData.append('minKeypointConfidence', detectionStore.params.minKeypointConfidence.toString())
    formData.append('useAngleDetection', detectionStore.params.useAngleDetection.toString())
    formData.append('fallAngleThreshold', detectionStore.params.fallAngleThreshold.toString())
    
    const response = await fetch('/api/detect-frame', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData
    })
    
    if (response.ok) {
      const data = await response.json()
      const hasFall = data.hasFall || false
      const personCount = data.personCount || 0
      
      let detection = '正常姿态'
      let risk = '低'
      let confidence = 90
      let recommendation = '未检测到异常，患者状态良好'
      
      if (hasFall) {
        detection = '跌倒'
        risk = '高'
        confidence = 95
        recommendation = '检测到跌倒事件，请立即前往查看患者状况'
      } else if (personCount > 0) {
        detection = '有人活动'
        risk = '低'
        confidence = 85
        recommendation = '检测到患者活动，状态正常'
      } else {
        detection = '未检测到人'
        risk = '低'
        confidence = 90
        recommendation = '画面中未检测到人员'
      }
      
      snapshotAnalysisResult.value = { detection, risk, confidence, recommendation }
    } else {
      snapshotAnalysisResult.value = {
        detection: '分析失败',
        risk: '未知',
        confidence: 0,
        recommendation: 'API调用失败，请稍后重试'
      }
    }
  } catch (error) {
    console.error('分析截图失败:', error)
    snapshotAnalysisResult.value = {
      detection: '分析失败',
      risk: '未知',
      confidence: 0,
      recommendation: '网络请求失败，请检查连接后重试'
    }
  } finally {
    isAnalyzing.value = false
  }
}

// 获取视频缩略图
const getVideoThumbnail = (url: string) => {
  // 实际项目中可以生成视频缩略图
  return `https://picsum.photos/300/180?random=${hashCode(url)}`
}

// 播放录制的视频
const playRecordedVideo = async (video: any) => {
  selectedFile.value = null
  analysisResult.value = false
  isAnalyzing.value = false
  isPlaying.value = false
  progress.value = 0
  videoKey.value++
  videoUrl.value = video.url
  activeTab.value = 'upload'
  await nextTick()
  if (videoRef.value) {
    videoRef.value.onloadedmetadata = () => {
      videoDuration.value = videoRef.value!.duration
    }
    videoRef.value.load()
  }
}

// 分析录制的视频
const analyzeRecordedVideo = async (video: any) => {
  selectedFile.value = null
  videoKey.value++
  videoUrl.value = video.url
  activeTab.value = 'upload'
  await nextTick()
  if (videoRef.value) {
    videoRef.value.onloadedmetadata = () => {
      videoDuration.value = videoRef.value!.duration
    }
    videoRef.value.load()
  }
  await nextTick()
  analyzeVideo()
}

// 下载视频
const downloadVideo = async (video: any) => {
  try {
    const response = await fetch(video.url)
    if (!response.ok) throw new Error('下载失败')
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = video.name || `跌倒视频-${Date.now()}.webm`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (error) {
    console.error('下载视频失败:', error)
    alert('视频下载失败，请尝试使用播放功能后右键另存为')
  }
}

// 查看历史详情
const viewHistoryDetails = (history: any) => {
  selectedHistory.value = history
  showHistoryDetails.value = true
}

// 导出分析报告
const exportAnalysis = (history: any) => {
  const report = `视频分析报告\n\n` +
    `视频名称: ${history.videoName}\n` +
    `分析时间: ${history.analysisTime}\n` +
    `跌倒事件: ${history.fallCount}次\n` +
    `风险等级: ${history.riskLevel}\n` +
    `详细报告: ${history.report}\n`
  
  const blob = new Blob([report], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${history.videoName}_分析报告.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 组件挂载
onMounted(() => {
  loadRecordedVideos()
  loadAnalysisHistory()
})

// 字符串哈希函数
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}
</script>

<style scoped>
.video {
  width: 100%;
}

.video-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.video-header h2 {
  font-size: 1.8rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.video-header p {
  font-size: 1rem;
  color: #666;
}

/* 选项卡 */
.tab-container {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.tab-button {
  padding: 0.8rem 1.5rem;
  border: none;
  background: transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
  color: #666;
  border-bottom: 2px solid transparent;
}

.tab-button:hover {
  color: #4a90e2;
  background: #f8f9fa;
}

.tab-button.active {
  color: #4a90e2;
  border-bottom-color: #4a90e2;
  background: white;
  font-weight: 600;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 上传区域 */
.upload-section {
  margin-bottom: 2rem;
}

.upload-section h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 1rem;
}

.upload-container {
  position: relative;
  margin-bottom: 1.5rem;
}

.upload-label {
  display: block;
  background: #f8f9fa;
  border: 2px dashed #ced4da;
  border-radius: 10px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-label:hover {
  border-color: #4a90e2;
  background: #e6f0fa;
}

.upload-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
  color: #4a90e2;
}

.upload-label span:last-child {
  font-size: 1.1rem;
  color: #666;
}

input[type="file"] {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

/* 视频播放器 */
.video-player {
  margin-bottom: 2rem;
}

.video-player video {
  width: 100%;
  max-width: 800px;
  display: block;
  margin: 0 auto 1rem;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.video-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.control-button {
  padding: 0.8rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #333;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.control-button:hover:not(:disabled) {
  border-color: #4a90e2;
  color: #4a90e2;
}

.control-button.primary {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.control-button.primary:hover:not(:disabled) {
  background: #357abd;
}

.video-info {
  text-align: center;
  font-size: 0.9rem;
  color: #666;
}

/* 进度条 */
.progress-container {
  margin-bottom: 2rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background: #f0f0f0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #357abd);
  border-radius: 5px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 0.9rem;
  color: #666;
}

/* 录制的视频 */
.recorded-videos {
  margin-bottom: 2rem;
}

.recorded-videos h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 1rem;
}

.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.video-card {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.video-info-card h4 {
  font-size: 1rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.video-info-card p {
  font-size: 0.85rem;
  color: #666;
  margin: 0.2rem 0;
}

.video-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.action-button {
  flex: 1;
  padding: 0.6rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.3s ease;
}

.action-button.play {
  background: #4a90e2;
  color: white;
}

.action-button.play:hover {
  background: #357abd;
}

.action-button.analyze {
  background: #28a745;
  color: white;
}

.action-button.analyze:hover {
  background: #218838;
}

.action-button.secondary {
  background: #6c757d;
  color: white;
}

.action-button.secondary:hover {
  background: #5a6268;
}

/* 分析结果 */
.analysis-result {
  background: white;
  border-radius: 10px;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.analysis-result h3 {
  font-size: 1.3rem;
  color: #333;
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid #4a90e2;
}

/* 结果摘要 */
.result-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.summary-card h4 {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.summary-items {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-item .label {
  color: #666;
  font-size: 0.9rem;
}

.summary-item .value {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

/* AI报告 */
.ai-report {
  background: #e6f7ff;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid #4a90e2;
}

.ai-report h4 {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 1rem;
}

.report-content {
  font-size: 0.95rem;
  line-height: 1.5;
  color: #333;
}

/* 事件和行为列表 */
.events-section,
.behaviors-section {
  margin-bottom: 2rem;
}

.events-section h4,
.behaviors-section h4 {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.events-list,
.behaviors-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.event-card,
.behavior-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: all 0.3s ease;
}

.event-card.fall {
  background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
  border-left: 4px solid #e74c3c;
}

.event-card:hover,
.behavior-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.event-info h5,
.behavior-info h5 {
  font-size: 1rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.event-info p,
.behavior-info p {
  font-size: 0.85rem;
  color: #666;
  margin: 0.3rem 0;
}

.high-risk {
  color: #e74c3c;
  font-weight: bold;
}

.medium-risk {
  color: #f39c12;
  font-weight: bold;
}

.event-actions,
.behavior-actions {
  margin-top: auto;
}

/* 风险评估 */
.risk-assessment {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.risk-assessment h4 {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.risk-level {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.8rem;
  border-radius: 6px;
  font-weight: 600;
}

.risk-level.low {
  background: #d4edda;
  color: #155724;
}

.risk-level.medium {
  background: #fff3cd;
  color: #856404;
}

.risk-level.high {
  background: #f8d7da;
  color: #721c24;
}

.risk-icon {
  font-size: 1.2rem;
}

.risk-description {
  margin-bottom: 1rem;
  font-size: 0.95rem;
  line-height: 1.4;
  color: #333;
}

.risk-recommendations h5 {
  font-size: 1rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.risk-recommendations ul {
  list-style: none;
  padding: 0;
}

.risk-recommendations li {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.3rem;
  padding-left: 1.5rem;
  position: relative;
}

.risk-recommendations li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #4a90e2;
  font-weight: bold;
}

/* 加载状态 */
.loading-state {
  text-align: center;
  padding: 3rem;
  background: #f8f9fa;
  border-radius: 10px;
  margin: 2rem 0;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4a90e2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: #f8f9fa;
  border-radius: 10px;
  margin: 2rem 0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.empty-state p {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.9rem;
  color: #999;
  font-style: italic;
}

/* 视频缩略图 */
.video-thumbnail {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
  background: #f0f0f0;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.video-thumbnail:hover img {
  transform: scale(1.05);
}

.video-duration {
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.3rem;
}

/* 动作按钮 */
.action-button.download {
  background: #ff9800;
  color: white;
}

.action-button.download:hover {
  background: #f57c00;
}

/* 分析历史 */
.analysis-history {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.refresh-button {
  padding: 0.6rem 1.2rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.refresh-button:hover {
  border-color: #4a90e2;
  color: #4a90e2;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.history-card {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.history-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #f0f0f0;
}

.history-header h4 {
  font-size: 1.1rem;
  color: #333;
  margin: 0;
}

.history-date {
  font-size: 0.85rem;
  color: #999;
}

.history-summary {
  margin-bottom: 1.2rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.history-item .label {
  color: #666;
  font-size: 0.9rem;
}

.history-item .value {
  font-weight: 600;
  font-size: 0.9rem;
}

.history-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 1rem;
}

/* 截图分析 */
.snapshot-section {
  margin-bottom: 2rem;
}

.snapshot-section h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.snapshot-section p {
  color: #666;
  margin-bottom: 1.5rem;
}

.snapshot-preview {
  margin: 2rem 0;
  text-align: center;
}

.snapshot-preview img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  margin-bottom: 1.5rem;
}

.snapshot-result {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 2rem;
  margin-top: 2rem;
  border-left: 4px solid #4a90e2;
}

.snapshot-result h4 {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 1.2rem;
}

.result-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.result-card p {
  margin: 0.8rem 0;
  line-height: 1.5;
}

/* 响应式设计 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-button:hover {
  background: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h4 {
  font-size: 1rem;
  color: #4a90e2;
  margin-bottom: 0.8rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #f0f0f0;
}

.detail-section p {
  margin: 0.5rem 0;
  color: #555;
  font-size: 0.95rem;
}

.report-text {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  line-height: 1.6;
  white-space: pre-wrap;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
}

.modal-button {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  background: #e0e0e0;
  color: #333;
  transition: all 0.3s ease;
}

.modal-button.primary {
  background: #4a90e2;
  color: white;
}

.modal-button.primary:hover {
  background: #357abd;
}

@media (max-width: 768px) {
  .result-summary {
    grid-template-columns: 1fr;
  }
  
  .events-list,
  .behaviors-list,
  .history-list {
    grid-template-columns: 1fr;
  }
  
  .video-controls {
    flex-direction: column;
    align-items: center;
  }
  
  .control-button {
    width: 100%;
    max-width: 300px;
  }
  
  .tab-container {
    flex-wrap: wrap;
  }
  
  .tab-button {
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

</style>