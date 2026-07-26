<template>
  <div class="camera">
    <div class="camera-header">
      <h2>实时监控</h2>
      <p>AI智能跌倒预警系统</p>
      <div class="header-actions">
        <button @click="toggleViewMode" class="view-mode-button" :title="viewMode === 'single' ? '切换到宫格模式' : '切换到单路模式'">
          {{ viewMode === 'single' ? '🔲' : '⬛' }}
        </button>
      </div>
    </div>

    <!-- 摄像头选择 -->
    <div class="camera-selector" v-if="viewMode === 'single'">
      <div class="camera-selector-header">
        <h3>摄像头选择</h3>
        <button @click="scanCameras" class="refresh-cameras-button" title="刷新摄像头列表">
          🔄 刷新
        </button>
      </div>
      <div class="camera-list">
        <div 
          v-for="(cam, index) in cameras.filter(c => c)" 
          :key="index"
          @click="switchCamera(index)"
          :class="['camera-item', { active: currentCamera === index, disabled: cam.status === 'unavailable' }]"
        >
          <span class="camera-status-dot" :class="cam.status === 'available' ? 'online' : 'offline'"></span>
          <span class="camera-name">{{ cam?.name || '未知摄像头' }}</span>
          <span v-if="currentCamera === index && isDetecting" class="camera-active-badge">使用中</span>
        </div>
      </div>
      <div v-if="cameras.filter(c => c).length === 0" class="no-cameras-hint">
        未检测到摄像头，请确保摄像头已连接
      </div>
    </div>

    <!-- 单路模式 -->
    <div class="monitoring-area" v-if="viewMode === 'single'">
      <div class="video-container">
        <video ref="videoRef" autoplay></video>
        <canvas ref="canvasRef"></canvas>
        
        <!-- 检测信息叠加层 -->
        <div class="detection-overlay">
          <div class="overlay-item">
            <span>状态: </span>
            <span :class="statusClass">{{ statusText }}</span>
          </div>
          <div class="overlay-item">
            <span>帧率: </span>
            <span>{{ currentFPS }} FPS</span>
          </div>
          <div class="overlay-item">
            <span>置信度: </span>
            <span>{{ detectionStore.params.confidence.toFixed(2) }}</span>
          </div>
        </div>
        
        <!-- 录制状态指示器 -->
        <div class="recording-indicator" v-if="recordingStatus.isRecording">
          <div class="recording-dot"></div>
          <span>录制中</span>
        </div>
      </div>

      <!-- 控制区域 -->
      <div class="controls">
        <button @click="startDetection" :disabled="isDetecting" class="control-button primary">
          开始检测
        </button>
        <button @click="stopDetection" :disabled="!isDetecting" class="control-button secondary">
          停止检测
        </button>
        <button @click="takeScreenshot" :disabled="!isDetecting" class="control-button success">
          截图
        </button>
        <button @click="showSkeleton = !showSkeleton" :disabled="!isDetecting" class="control-button skeleton" :class="{ active: showSkeleton }">
          {{ showSkeleton ? '🦴 骨架' : '🧍 骨架' }}
        </button>
      </div>
    </div>

    <!-- 宫格模式 -->
    <div class="grid-monitoring" v-if="viewMode === 'grid'">
      <div class="grid-container">
        <div 
          v-for="(cam, index) in gridCameras.filter(c => c)" 
          :key="index"
          class="grid-item"
          @click="switchToSingleCamera(index)"
        >
          <div class="grid-video-container">
            <video :ref="el => setGridVideoRef(el, index)" autoplay></video>
            <canvas :ref="el => setGridCanvasRef(el, index)"></canvas>
            <div class="grid-overlay">
              <div class="grid-camera-name">{{ cam?.name || '未知摄像头' }}</div>
              <div class="grid-status" :class="gridStatuses[index]?.class || 'normal'">
                {{ gridStatuses[index]?.text || '未检测' }}
              </div>
            </div>
            
            <!-- 录制状态指示器 -->
            <div class="recording-indicator grid" v-if="recordingStatus.isRecording">
              <div class="recording-dot"></div>
              <span>录制中</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 浮动控制按钮 -->
      <div class="floating-controls">
        <button @click="startGridDetection" :disabled="isDetecting" class="floating-button primary">
          🔴 开始
        </button>
        <button @click="stopDetection" :disabled="!isDetecting" class="floating-button secondary">
          ⏹️ 停止
        </button>
        <button @click="showSkeleton = !showSkeleton" :disabled="!isDetecting" class="floating-button skeleton" :class="{ active: showSkeleton }">
          {{ showSkeleton ? '🦴' : '🧍' }}
        </button>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="status-panel" :class="statusClass">
      <h3>检测状态</h3>
      <div class="status-info">
        <div class="status-item">
          <span class="status-label">当前状态:</span>
          <span class="status-value">{{ statusText }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">风险等级:</span>
          <span class="status-value">{{ riskLevel }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">检测人数:</span>
          <span class="status-value">{{ detectedPeople }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">异常次数:</span>
          <span class="status-value">{{ abnormalCount }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">当前模式:</span>
          <span class="status-value">{{ viewMode === 'single' ? '单路' : '宫格' }}</span>
        </div>
      </div>
    </div>

    <!-- 录制视频列表 -->
    <div class="recordings" v-if="recordings.filter(r => r).length > 0">
      <h3>已录制视频</h3>
      <div class="recordings-grid">
        <div v-for="(recording, index) in recordings.filter(r => r)" :key="index" class="recording-card">
          <div class="recording-info">
            <h4>{{ recording?.name || '未知视频' }}</h4>
            <p>{{ recording?.timestamp || '' }}</p>
            <p>{{ typeof recording?.duration === 'number' ? recording.duration : 0 }}秒</p>
          </div>
          <div class="recording-actions">
            <button @click="playRecording(recording?.url || '')" class="action-button play">
              播放
            </button>
            <button @click="deleteRecording(index)" class="action-button delete">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 警报弹窗 -->
    <AlertModal
      :visible="!!currentAlert"
      :level="currentAlert?.level || 'warning'"
      :title="currentAlert?.title || ''"
      :message="currentAlert?.message || ''"
      :details="alertDetails"
      :has-recording="hasRecentRecording"
      :is-muted="detectionStore.isMuted"
      @close="closeAlert"
      @view-recording="viewRecording"
      @mute="toggleMute"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useDetectionStore } from '../stores/detection'
import AlertModal from '../components/common/AlertModal.vue'
import { useWebSocket } from '../composables/useWebSocket'
import { useAlertSound } from '../composables/useAlertSound'
import { useLoopRecording } from '../composables/useLoopRecording'
import { useAuthStore } from '../stores/auth'

const detectionStore = useDetectionStore()
const authStore = useAuthStore()
const { playAlertSound, playConfirmationSound, toggleMute: toggleSoundMute } = useAlertSound()
const { startLoopRecording, stopLoopRecording, triggerFallRecording, recordingStatus } = useLoopRecording()

// 使用 WebSocket 连接
useWebSocket({
  onConnect: () => {
    console.log('[Camera] WebSocket 已连接')
  },
  onDisconnect: () => {
    console.log('[Camera] WebSocket 已断开')
  }
})

// 检测间隔（骨架模式时加快刷新提升流畅度）
function getDetectionInterval() {
  return showSkeleton.value ? 200 : 500
}
let lastDetectionTime = 0
let isDetectingFrame = false // 防止同时处理多个帧
let pendingRequests = 0 // 追踪并行请求数量

// 连续检测验证机制：需要连续2帧检测到跌倒才触发告警（减少延迟）
const FALL_CONFIRM_THRESHOLD = 2
let fallDetectionHistory: boolean[] = [] // 存储最近的检测结果

// 统计连续跌倒检测次数
const countConsecutiveFalls = (history: boolean[]): number => {
  let count = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]) {
      count++
    } else {
      break
    }
  }
  return count
}

// 绘制人体骨架
function drawSkeleton(canvas: HTMLCanvasElement, keypoints: Array<{index: number, x: number, y: number, confidence: number}>, opacity: number = 0.8) {
  if (!keypoints || keypoints.length === 0) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const minConfidence = detectionStore.params.minKeypointConfidence || 0.3

  const validKeypoints = keypoints.filter(kp => kp.confidence >= minConfidence)
  if (validKeypoints.length === 0) return

  const kpMap = new Map(validKeypoints.map(kp => [kp.index, kp]))

  ctx.save()
  ctx.globalAlpha = opacity

  SKELETON_CONNECTIONS.forEach(([i, j]) => {
    const a = kpMap.get(i)
    const b = kpMap.get(j)
    if (a && b) {
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 3
      ctx.stroke()
    }
  })

  kpMap.forEach(kp => {
    ctx.beginPath()
    ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ff4444'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })

  ctx.restore()
}

function waitForOnline(): Promise<void> {
  return new Promise(resolve => {
    if (navigator.onLine) return resolve()
    const handler = () => { window.removeEventListener('online', handler); resolve() }
    window.addEventListener('online', handler)
  })
}

// 发送帧到服务器检测
const sendFrameToServer = async (videoElement: HTMLVideoElement, canvas: HTMLCanvasElement, _cameraIndex: number = 0, _retryCount: number = 0) => {
  if (!navigator.onLine) {
    await waitForOnline()
  }

  if (isDetectingFrame && pendingRequests >= 2) {
    return
  }
  
  isDetectingFrame = true
  pendingRequests++
  
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    isDetectingFrame = false
    pendingRequests--
    return
  }

  try {
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.6)
    })

    if (!blob) {
      isDetectingFrame = false
      pendingRequests--
      return
    }

    const formData = new FormData()
    formData.append('image', blob, `frame-${Date.now()}.jpg`)
    
    formData.append('confidence', detectionStore.params.confidence.toString())
    formData.append('sensitivity', detectionStore.params.sensitivity.toString())
    formData.append('shoulderHipThreshold', detectionStore.params.shoulderHipThreshold.toString())
    formData.append('minKeypointConfidence', detectionStore.params.minKeypointConfidence.toString())
    formData.append('useAngleDetection', detectionStore.params.useAngleDetection.toString())
    formData.append('fallAngleThreshold', detectionStore.params.fallAngleThreshold.toString())
    
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, 15000)
    
    try {
      const response = await fetch('/api/detect-frame', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        body: formData,
        signal: abortController.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        await response.text().catch(() => {})
        return
      }
      
      const result = await response.json()
      
      detectedPeople.value = result.personCount || 0
      
      if (showSkeleton.value && result.detections && result.detections.length > 0) {
        const allKps = result.detections.flatMap((d: any) => d.keypoints || [])
        if (viewMode.value === 'single') {
          detectionKeypoints.value = allKps
        } else {
          gridKeypointsList.value[_cameraIndex] = allKps
        }
      }
      
      const currentFallDetected = result.hasFall || (result.events && result.events.some((e: any) => e.type === 'fall'))
      
      fallDetectionHistory.push(currentFallDetected)
      if (fallDetectionHistory.length > FALL_CONFIRM_THRESHOLD) {
        fallDetectionHistory.shift()
      }
      
      const consecutiveFalls = countConsecutiveFalls(fallDetectionHistory)
      
      if (currentFallDetected) {
        if (consecutiveFalls >= FALL_CONFIRM_THRESHOLD) {
          if (viewMode.value === 'single') {
            handleFall(result.eventId)
          } else {
            handleGridFall(_cameraIndex, result.eventId)
          }
        } else {
          if (viewMode.value === 'single') {
            statusText.value = '预警'
            statusClass.value = 'warning'
            riskLevel.value = '中'
          } else {
            gridStatuses.value[_cameraIndex] = { text: '预警', class: 'warning' }
          }
        }
      } else {
        fallDetectionHistory = []
        if (viewMode.value === 'single') {
          resetStatus()
        } else {
          resetGridStatus(_cameraIndex)
        }
      }
      
      if (!currentFallDetected && result.events && result.events.length > 0) {
        const hasBend = result.events.some((e: any) => e.type === 'bend')
        const hasTilt = result.events.some((e: any) => e.type === 'tilt')
        if (hasBend || hasTilt) {
          if (viewMode.value === 'single') {
            statusText.value = hasBend ? '弯腰' : '倾斜'
            statusClass.value = 'warning'
            riskLevel.value = '中'
          } else {
            gridStatuses.value[_cameraIndex] = { text: hasBend ? '弯腰' : '倾斜', class: 'warning' }
          }
          const now = Date.now()
          const lastTime = viewMode.value === 'single' ? lastBendTiltTime : (gridLastBendTiltTimes[_cameraIndex] || 0)
          if (now - lastTime >= BEND_TILT_COOLDOWN) {
            if (viewMode.value === 'single') {
              lastBendTiltTime = now
            } else {
              gridLastBendTiltTimes[_cameraIndex] = now
            }
            const camId = viewMode.value === 'single'
              ? (cameras.value[currentCamera.value]?.id || 'unknown')
              : (gridCameras.value[_cameraIndex]?.id || 'unknown')
            syncEventToServer(hasBend ? 'bend' : 'tilt', '中等', camId, undefined, 1)
            
            detectionStore.addAlert({
              level: 'warning',
              title: hasBend ? '弯腰检测' : '倾斜检测',
              message: `摄像头 ${viewMode.value === 'single' ? (cameras.value[currentCamera.value]?.name || currentCamera.value + 1) : (_cameraIndex + 1)} 检测到${hasBend ? '弯腰' : '身体倾斜'}行为`
            })
          }
        }
      }
    } catch (fetchError: any) {
      await waitForOnline()
      if (_retryCount < 1) {
        clearTimeout(timeoutId)
        isDetectingFrame = false
        pendingRequests--
        await new Promise(r => setTimeout(r, 300))
        return sendFrameToServer(videoElement, canvas, _cameraIndex, _retryCount + 1)
      }
    } finally {
      clearTimeout(timeoutId)
    }
    
  } finally {
    isDetectingFrame = false
    pendingRequests--
  }
}

// 视图模式
const viewMode = ref<'single' | 'grid'>('single')

// 视频和画布引用（单路模式）
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// 视频和画布引用（宫格模式）
const gridVideoRefs = ref<(HTMLVideoElement | null)[]>([])
const gridCanvasRefs = ref<(HTMLCanvasElement | null)[]>([])

// 检测状态
const isDetecting = ref(false)
const isFalling = ref(false)
const isInFallState = ref(false) // 标记是否处于跌倒状态（防止同一事件重复入库）
const statusText = ref('未检测')
const statusClass = ref('normal')
const riskLevel = ref('低')
const detectedPeople = ref(0)
const abnormalCount = ref(0)
const currentFPS = ref(0)

// 骨架模式
const showSkeleton = ref(false)
const detectionKeypoints = ref<Array<{index: number, x: number, y: number, confidence: number}>>([])
const gridKeypointsList = ref<Array<Array<{index: number, x: number, y: number, confidence: number}>>>([])

// COCO 人体骨架连线定义
const SKELETON_CONNECTIONS: [number, number][] = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15],
  [12, 14], [14, 16]
]

// 跌倒告警冷却时间（毫秒）
const FALL_ALERT_COOLDOWN = 3000
let lastFallAlertTime = 0
let lastGridFallAlertTimes: number[] = [0, 0, 0, 0]

// 弯腰/倾斜事件冷却时间
const BEND_TILT_COOLDOWN = 8000
let lastBendTiltTime = 0
const gridLastBendTiltTimes: number[] = [0, 0, 0, 0]

// 摄像头相关
const cameras = ref<Array<{ name: string; id: string; deviceId: string; status: string }>>([])
const currentCamera = ref(0)
const currentStream = ref<MediaStream | null>(null)

// 宫格模式摄像头
const gridCameras = ref<Array<{ name: string; id: string; deviceId: string }>>([])
const gridStreams = ref<(MediaStream | null)[]>([])
const gridStatuses = ref<Array<{ text: string; class: string }>>([])
const gridAnimationFrameIds = ref<(number | null)[]>([])
const gridLastFrameTimes = ref<number[]>([])
const gridFrameCounts = ref<number[]>([])
const gridLastDetectionTimes = ref<number[]>([])
const gridInFallState = ref<boolean[]>([])

// 录制相关
let mediaRecorder: MediaRecorder | null = null
const recordings = ref<Array<{ name: string; url: string; timestamp: string; duration: number }>>([])

// 警报相关
const hasRecentRecording = ref(false)

// 视频流和动画帧
let stream: MediaStream | null = null
let animationFrameId: number | null = null
let lastFrameTime = 0
let frameCount = 0

// 设置宫格视频引用
const setGridVideoRef = (el: any, index: number) => {
  gridVideoRefs.value[index] = el as HTMLVideoElement | null
}

// 设置宫格画布引用
const setGridCanvasRef = (el: any, index: number) => {
  gridCanvasRefs.value[index] = el as HTMLCanvasElement | null
}

// 切换视图模式
const toggleViewMode = () => {
  if (isDetecting.value) {
    stopDetection()
  }
  viewMode.value = viewMode.value === 'single' ? 'grid' : 'single'
}

// 切换到单路模式并聚焦指定摄像头
const switchToSingleCamera = (index: number) => {
  if (viewMode.value === 'grid') {
    currentCamera.value = index
    viewMode.value = 'single'
  }
}

// 扫描可用摄像头
const scanCameras = async () => {
  try {
    // 请求一次临时的摄像头权限以获取设备标签
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach(track => track.stop())
    } catch {
      // 用户可能拒绝了权限，使用默认设备名
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(device => device.kind === 'videoinput')
    
    if (videoDevices.length === 0) {
      cameras.value = []
      return
    }
    
    const scanned = videoDevices.map((device) => ({
      name: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
      id: device.deviceId,
      deviceId: device.deviceId,
      status: 'available'
    }))
    
    cameras.value = scanned
    
    if (currentCamera.value >= cameras.value.length) {
      currentCamera.value = 0
    }
    
    console.log(`[Camera] 扫描到 ${scanned.length} 个摄像头`)
  } catch (error) {
    console.error('[Camera] 扫描摄像头失败:', error)
  }
}



// 开始检测（单路模式）
const startDetection = async () => {
  try {
    if (cameras.value.length === 0) {
      await scanCameras()
    }
    
    // 确保至少有一个摄像头
    if (cameras.value.length === 0) {
      statusText.value = '未找到摄像头'
      return
    }
    
    const deviceId = cameras.value[currentCamera.value]?.deviceId
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: deviceId ? { deviceId: { exact: deviceId } } : true 
    })
    
    currentStream.value = stream
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
    
    isDetecting.value = true
    detectionStore.isDetecting = true
    statusText.value = '检测中'
    statusClass.value = 'normal'
    
    // 开始循环录制
    startLoopRecording(stream!)
    
    lastFrameTime = performance.now()
    lastDetectionTime = 0
    frameCount = 0
    
    processVideo()
  } catch (error) {
    console.error('无法访问摄像头:', error)
    statusText.value = '摄像头访问失败'
  }
}

// 开始检测（宫格模式）
const startGridDetection = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(device => device.kind === 'videoinput')
    
    // 准备4个摄像头（如果设备不足，使用模拟数据）
    const availableCameras = videoDevices.map((device, index) => ({
      name: device.label || `摄像头 ${index + 1}`,
      id: device.deviceId,
      deviceId: device.deviceId
    }))
    
    // 如果摄像头不足4个，创建模拟摄像头
    const totalCameras = Math.max(4, availableCameras.length)
    const gridCamerasList: Array<{ name: string; id: string; deviceId: string }> = []
    const hasCamera = availableCameras.length > 0
    const firstDeviceId = hasCamera ? availableCameras[0].deviceId : ''
    
    for (let i = 0; i < totalCameras; i++) {
      if (i < availableCameras.length) {
        gridCamerasList.push(availableCameras[i])
      } else {
        // 模拟摄像头
        gridCamerasList.push({
          name: `模拟摄像头 ${i + 1}`,
          id: `mock-${i}`,
          deviceId: firstDeviceId
        })
      }
    }
    
    gridCameras.value = gridCamerasList
    gridStatuses.value = Array.from({ length: totalCameras }, () => ({ text: '未检测', class: 'normal' }))
    gridAnimationFrameIds.value = Array.from({ length: totalCameras }, () => null)
    gridLastFrameTimes.value = new Array(totalCameras).fill(0)
    gridLastDetectionTimes.value = new Array(totalCameras).fill(0)
    gridKeypointsList.value = Array.from({ length: totalCameras }, () => [])
    gridInFallState.value = new Array(totalCameras).fill(false)

    // 启动所有4个摄像头用于检测
    for (let i = 0; i < Math.min(4, gridCamerasList.length); i++) {
      const camera = gridCamerasList[i]
      try {
        const gridStream = await navigator.mediaDevices.getUserMedia({
          video: camera.deviceId ? { deviceId: { exact: camera.deviceId } } : true
        })

        gridStreams.value[i] = gridStream
        if (gridVideoRefs.value[i]) {
          gridVideoRefs.value[i]!.srcObject = gridStream
        }

        gridStatuses.value[i] = { text: '检测中', class: 'normal' }

        // 开始处理视频
        processGridVideo(i)

        // 第一个摄像头开始循环录制
        if (i === 0) {
          startLoopRecording(gridStream!)
        }
      } catch (error) {
        console.error(`摄像头 ${i + 1} 启动失败:`, error)
        gridStatuses.value[i] = { text: '启动失败', class: 'emergency' }
      }
    }

    isDetecting.value = true
    detectionStore.isDetecting = true
    statusText.value = '宫格检测中'
    statusClass.value = 'normal'
    
  } catch (error) {
    console.error('无法访问摄像头:', error)
    statusText.value = '摄像头访问失败'
  }
}

// 停止检测
const stopDetection = () => {
  // 停止单路模式
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
    currentStream.value = null
  }
  
  // 停止宫格模式
  gridStreams.value.forEach((gridStream, index) => {
    if (gridStream) {
      gridStream.getTracks().forEach(track => track.stop())
      gridStreams.value[index] = null
    }
    if (gridAnimationFrameIds.value[index]) {
      cancelAnimationFrame(gridAnimationFrameIds.value[index]!)
      gridAnimationFrameIds.value[index] = null
    }
  })
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  
  if (mediaRecorder) {
    (mediaRecorder as MediaRecorder).stop()
  }
  
  isDetecting.value = false
  detectionStore.isDetecting = false
  statusText.value = '未检测'
  statusClass.value = 'normal'
  
  // 清空检测历史
  fallDetectionHistory = []
  
  // 清空骨架数据
  detectionKeypoints.value = []
  gridKeypointsList.value = []
  gridInFallState.value = []
  
  // 停止循环录制
  stopLoopRecording()
  
  gridStatuses.value = []
}

// 处理视频帧（单路模式）
const processVideo = () => {
  if (!isDetecting.value || !videoRef.value || !canvasRef.value) return
  
  const currentTime = performance.now()
  
  frameCount++
  if (currentTime - lastFrameTime >= 1000) {
    currentFPS.value = frameCount
    detectionStore.setCurrentFPS(frameCount)
    frameCount = 0
    lastFrameTime = currentTime
  }
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (ctx) {
    canvas.width = videoRef.value.videoWidth
    canvas.height = videoRef.value.videoHeight
    ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
    
    if (showSkeleton.value && detectionKeypoints.value.length > 0) {
      drawSkeleton(canvas, detectionKeypoints.value)
    }
    
    if (currentTime - lastDetectionTime >= getDetectionInterval()) {
      sendFrameToServer(videoRef.value, canvas)
      lastDetectionTime = currentTime
    }
  }
  
  animationFrameId = requestAnimationFrame(processVideo)
}

// 处理视频帧（宫格模式）
const processGridVideo = (index: number) => {
  if (!isDetecting.value || !gridVideoRefs.value[index] || !gridCanvasRefs.value[index]) return
  
  const currentTime = performance.now()
  
  gridFrameCounts.value[index]++
  if (currentTime - gridLastFrameTimes.value[index] >= 1000) {
    gridFrameCounts.value[index] = 0
    gridLastFrameTimes.value[index] = currentTime
  }
  
  const canvas = gridCanvasRefs.value[index]!
  const video = gridVideoRefs.value[index]!
  const ctx = canvas.getContext('2d')
  if (ctx) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (showSkeleton.value && gridKeypointsList.value[index]?.length > 0) {
      drawSkeleton(canvas, gridKeypointsList.value[index])
    }

    if (currentTime - gridLastDetectionTimes.value[index] >= getDetectionInterval()) {
      sendFrameToServer(video, canvas, index)
      gridLastDetectionTimes.value[index] = currentTime
    }
  }
  
  gridAnimationFrameIds.value[index] = requestAnimationFrame(() => processGridVideo(index))
}



// 处理跌倒（单路模式）
const handleFall = (serverEventId?: string) => {
  const now = Date.now()
  
  // 检查冷却时间
  if (now - lastFallAlertTime < FALL_ALERT_COOLDOWN) {
    console.log('[Camera] 跌倒告警冷却中，忽略此次触发')
    return
  }
  
  lastFallAlertTime = now
  isFalling.value = true
  statusText.value = '跌倒！'
  statusClass.value = 'emergency'
  riskLevel.value = '高'
  abnormalCount.value++
  
  const alertMessage = '检测到患者跌倒！'
  
  detectionStore.addAlert({
    level: 'emergency',
    title: '紧急警报',
    message: alertMessage
  })
  
  // 播放告警音效
  if (!detectionStore.isMuted) {
    playAlertSound('emergency', 1500)
  }
  
  // 只在首次进入跌倒状态时触发录制（弹窗每3秒仍会提示）
  if (!isInFallState.value) {
    isInFallState.value = true
    
    const cameraId = cameras.value[currentCamera.value]?.id || 'unknown'
    
    if (serverEventId) {
      triggerFallRecording('fall', cameraId)
        .then(videoUrl => {
          if (videoUrl) {
            fetch(`/api/events/${serverEventId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authStore.token}`
              },
              body: JSON.stringify({ videoUrl })
            }).catch(e => console.warn('[Camera] 更新事件视频失败:', e))
            
            const recording = {
              name: `跌倒记录-${new Date().toLocaleString()}`,
              url: videoUrl,
              timestamp: new Date().toLocaleString(),
              duration: 30
            }
            recordings.value.unshift(recording)
            hasRecentRecording.value = true
            saveRecordings()
          }
        })
    } else {
      syncEventToServer('fall', '严重', cameraId, undefined, 5).then(eventId => {
        triggerFallRecording('fall', cameraId)
          .then(videoUrl => {
            if (videoUrl && eventId) {
              fetch(`/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                body: JSON.stringify({ videoUrl })
              }).catch(e => console.warn('[Camera] 更新事件视频失败:', e))
            }
            if (videoUrl) {
              const recording = {
                name: `跌倒记录-${new Date().toLocaleString()}`,
                url: videoUrl,
                timestamp: new Date().toLocaleString(),
                duration: 30
              }
              recordings.value.unshift(recording)
              hasRecentRecording.value = true
              saveRecordings()
            }
          })
      })
    }
  }
}

// 处理跌倒（宫格模式）
const handleGridFall = (index: number, serverEventId?: string) => {
  const now = Date.now()
  
  // 检查冷却时间
  if (now - lastGridFallAlertTimes[index] < FALL_ALERT_COOLDOWN) {
    console.log(`[Camera] 摄像头${index + 1} 跌倒告警冷却中，忽略此次触发`)
    return
  }
  
  lastGridFallAlertTimes[index] = now
  gridStatuses.value[index] = { text: '跌倒！', class: 'emergency' }
  
  const alertMessage = `摄像头 ${index + 1} 检测到患者跌倒！`
  
  detectionStore.addAlert({
    level: 'emergency',
    title: '紧急警报',
    message: alertMessage
  })
  
  // 播放告警音效
  if (!detectionStore.isMuted) {
    playAlertSound('emergency', 1500)
  }
  
  // 只在首次进入跌倒状态时触发录制（弹窗每3秒仍会提示）
  if (!gridInFallState.value[index]) {
    gridInFallState.value[index] = true
    
    const cameraId = gridCameras.value[index]?.id || 'unknown'
    
    if (serverEventId) {
      triggerFallRecording('fall', cameraId)
        .then(videoUrl => {
          if (videoUrl) {
            fetch(`/api/events/${serverEventId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authStore.token}`
              },
              body: JSON.stringify({ videoUrl })
            }).catch(e => console.warn('[Camera] 更新事件视频失败:', e))
            
            const recording = {
              name: `跌倒记录-${new Date().toLocaleString()}`,
              url: videoUrl,
              timestamp: new Date().toLocaleString(),
              duration: 30
            }
            recordings.value.unshift(recording)
            hasRecentRecording.value = true
            saveRecordings()
          }
        })
    } else {
      syncEventToServer('fall', '严重', cameraId, undefined, 5).then(eventId => {
        triggerFallRecording('fall', cameraId)
          .then(videoUrl => {
            if (videoUrl && eventId) {
              fetch(`/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                body: JSON.stringify({ videoUrl })
              }).catch(e => console.warn('[Camera] 更新事件视频失败:', e))
            }
            if (videoUrl) {
              const recording = {
                name: `跌倒记录-${new Date().toLocaleString()}`,
                url: videoUrl,
                timestamp: new Date().toLocaleString(),
                duration: 30
              }
              recordings.value.unshift(recording)
              hasRecentRecording.value = true
              saveRecordings()
            }
          })
      })
    }
  }
}

// 重置状态（单路模式）
const resetStatus = () => {
  if (isFalling.value) {
    detectionStore.addAlert({
      level: 'warning',
      title: '跌倒事件结束',
      message: '患者已恢复正常状态，请确认患者状况'
    })
  }
  isFalling.value = false
  isInFallState.value = false
  statusText.value = '正常'
  statusClass.value = 'normal'
  riskLevel.value = '低'
}

// 重置状态（宫格模式）
const resetGridStatus = (index: number) => {
  if (gridStatuses.value[index]?.text === '跌倒！') {
    detectionStore.addAlert({
      level: 'warning',
      title: '跌倒事件结束',
      message: `摄像头 ${index + 1} 患者已恢复正常状态`
    })
  }
  gridStatuses.value[index] = { text: '正常', class: 'normal' }
  if (gridInFallState.value[index] !== undefined) {
    gridInFallState.value[index] = false
  }
}

// 关闭警报
const closeAlert = () => {
  detectionStore.clearAlerts()
  playConfirmationSound()
}

// 切换静音
const toggleMute = () => {
  detectionStore.toggleMute()
  toggleSoundMute()
  playConfirmationSound()
}

// 同步事件到服务器（供事件回溯模块使用）
const syncEventToServer = (type: string, severity: string, cameraId: string, videoUrl?: string, duration?: number): Promise<string | null> => {
  return fetch('/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authStore.token}`
    },
    body: JSON.stringify({
      type,
      severity,
      cameraId,
      videoUrl: videoUrl || null,
      duration: duration || 1
    })
  }).then(res => {
    if (!res.ok) {
      console.warn('[Camera] 事件同步失败:', res.status)
      return null
    }
    return res.json()
  }).then(data => {
    return data?.event?.id || null
  }).catch(e => {
    console.warn('[Camera] 事件同步请求异常:', e)
    return null
  })
}

// 播放录制的视频
const playRecording = (url: string) => {
  const isBlobUrl = url.startsWith('blob:')
  
  if (isBlobUrl) {
    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;'
    modal.innerHTML = `
      <video controls autoplay playsinline style="max-width:90vw;max-height:80vh;border-radius:8px;">
        <source src="${url}" type="video/webm">
      </video>
      <div style="margin-top:1rem;display:flex;gap:1rem;">
        <button id="closeVideoBtn" style="padding:0.6rem 1.5rem;background:#4a90e2;color:white;border:none;border-radius:6px;cursor:pointer;font-size:1rem;">关闭</button>
        <button onclick="const a=document.createElement('a');a.href='${url}';a.download='recording.webm';a.click();setTimeout(()=>URL.revokeObjectURL('${url}'),1000);" style="padding:0.6rem 1.5rem;background:#28a745;color:white;border:none;border-radius:6px;cursor:pointer;font-size:1rem;">下载</button>
      </div>
    `
    document.body.appendChild(modal)
    document.getElementById('closeVideoBtn')!.onclick = () => {
      const video = modal.querySelector('video')
      if (video) { video.pause(); video.src = ''; video.load() }
      modal.remove()
    }
    return
  }
  
  const videoWindow = window.open('', '_blank', 'width=800,height=600')
  if (videoWindow) {
    videoWindow.document.write(`
      <html>
        <head>
          <title>视频回放</title>
          <style>
            body { margin: 0; padding: 20px; background: #1a1a1a; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
            .video-container { width: 100%; max-width: 760px; }
            video { width: 100%; border-radius: 8px; background: #000; }
            .controls { margin-top: 1rem; display: flex; gap: 1rem; }
            button { padding: 0.5rem 1rem; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #357abd; }
            .info { color: #fff; margin-top: 1rem; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <div class="video-container">
            <video controls autoplay playsinline>
              <source src="${url}" type="video/webm">
              您的浏览器不支持视频播放，请尝试使用最新版Chrome或Firefox
            </video>
          </div>
          <div class="info">🌐 服务器视频</div>
        </body>
      </html>
    `)
  }
}

// 删除录制的视频
const deleteRecording = (index: number) => {
  recordings.value.splice(index, 1)
  saveRecordings()
}

// 查看最近的录制
const viewRecording = () => {
  if (recordings.value.length > 0) {
    playRecording(recordings.value[0].url)
  }
  closeAlert()
}

// 保存录制到本地存储
const saveRecordings = () => {
  const data = recordings.value.map(r => ({
    name: r.name,
    url: r.url,
    timestamp: r.timestamp,
    duration: r.duration
  }))
  localStorage.setItem('recordings', JSON.stringify(data))
}

// 切换摄像头
const switchCamera = async (index: number) => {
  if (index === currentCamera.value) return

  // 如果正在检测中，切换摄像头需要停止旧流、启动新流
  if (isDetecting.value) {
    currentCamera.value = index

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    try {
      const deviceId = cameras.value[index]?.deviceId
      if (deviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } }
        })
        currentStream.value = stream

        if (videoRef.value) {
          videoRef.value.srcObject = stream
        }

        console.log(`切换到摄像头: ${cameras.value[index].name}`)
        statusText.value = '检测中'
      }
    } catch (error) {
      console.error('切换摄像头失败:', error)
      statusText.value = '摄像头切换失败'
    }
  } else {
    // 未检测时，只切换选择的索引，等待用户点击"开始检测"
    currentCamera.value = index
    console.log(`已选择摄像头: ${cameras.value[index].name}`)
  }
}

// 截图
const takeScreenshot = () => {
  const canvas = viewMode.value === 'single' ? canvasRef.value : gridCanvasRefs.value[0]
  if (!canvas) return
  
  const dataURL = canvas.toDataURL('image/png')
  
  const link = document.createElement('a')
  link.download = `screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
  link.href = dataURL
  link.click()
}

// 计算当前警报
const currentAlert = computed(() => {
  const alert = detectionStore.alerts[0] || null
  console.log('[Camera] 当前警报:', alert)
  return alert
})

// 计算警报详情
const alertDetails = computed(() => {
  if (!currentAlert.value) return undefined
  return {
    time: new Date().toLocaleString(),
    location: viewMode.value === 'single' 
      ? cameras.value[currentCamera.value]?.name || '未知位置'
      : '宫格模式'
  }
})

// 监听警报自动关闭和音效
watch(currentAlert, (newAlert) => {
  if (newAlert && newAlert.level === 'warning') {
    setTimeout(() => {
      detectionStore.clearAlerts()
    }, 3000)
  }
  if (newAlert && newAlert.level === 'emergency') {
    // 来自香橙派MQTT或本地检测的紧急告警都播放音效
    if (!detectionStore.isMuted) {
      playAlertSound('emergency', 1500)
    }
  }
}, { immediate: true })

// 组件挂载
onMounted(() => {
  scanCameras()
  loadRecordings()
  detectionStore.loadParamsFromLocalStorage()
  detectionStore.loadMuteFromLocalStorage()
})

// 组件卸载
onUnmounted(() => {
  stopDetection()
})

// 加载录制
const loadRecordings = () => {
  console.log('加载录制')
  const saved = localStorage.getItem('recordings')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      if (Array.isArray(data)) {
        recordings.value = data.map(item => ({
          name: item.name || '',
          url: item.url || '',
          timestamp: item.timestamp || '',
          duration: typeof item.duration === 'number' ? item.duration : 0
        })).filter(item => item.url)
      }
    } catch (e) {
      console.error('加载录制失败:', e)
    }
  }
}
</script>

<style scoped>
.camera {
  width: 100%;
}

.camera-header {
  text-align: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.camera-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.3rem;
  letter-spacing: -0.02em;
}

.camera-header p {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.header-actions {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 0.5rem;
}

.view-mode-button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-mode-button:hover {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
  transform: scale(1.05);
}

/* 摄像头选择 */
.camera-selector {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1.2rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--glass-shadow);
}

.camera-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.camera-selector-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.refresh-cameras-button {
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.refresh-cameras-button:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-light);
}

.camera-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.camera-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.camera-item:hover {
  border-color: var(--accent-color);
  background: var(--accent-light);
  transform: translateX(2px);
}

.camera-item.active {
  border-color: var(--accent-color);
  background: var(--accent-light);
  box-shadow: 0 0 0 1px var(--accent-color);
}

.camera-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.camera-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.camera-status-dot.online {
  background: var(--success-color);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.camera-status-dot.offline {
  background: var(--danger-color);
}

.camera-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.camera-active-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  background: var(--success-color);
  color: white;
  border-radius: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.no-cameras-hint {
  text-align: center;
  padding: 1.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* 监控区域 */
.monitoring-area {
  margin-bottom: 2rem;
}

.video-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto 1.2rem;
  background: #000;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.3s ease;
}

.video-container:has(.detection-overlay .emergency) {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2);
}

.video-container video,
.video-container canvas {
  width: 100%;
  height: auto;
  display: block;
}

.video-container canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

/* 检测信息叠加层 */
.detection-overlay {
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  color: white;
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.overlay-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
}

.overlay-item span:first-child {
  opacity: 0.6;
}

/* 录制状态指示器 */
.recording-indicator {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  background: rgba(239, 68, 68, 0.9);
  backdrop-filter: blur(8px);
  color: white;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
}

.recording-indicator.grid {
  top: 0.4rem;
  right: 0.4rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.65rem;
}

.recording-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: white;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(220, 53, 69, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
}

/* 控制按钮 */
.controls {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  flex-wrap: wrap;
}

.control-button {
  padding: 0.65rem 1.4rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

.control-button.primary {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.control-button.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.control-button.secondary {
  background: var(--text-muted);
  color: white;
}

.control-button.secondary:hover:not(:disabled) {
  background: var(--text-secondary);
  transform: translateY(-1px);
}

.control-button.success {
  background: var(--success-color);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.control-button.success:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.control-button.skeleton {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
}

.control-button.skeleton:hover:not(:disabled),
.control-button.skeleton.active {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

/* 宫格模式 */
.grid-monitoring {
  margin-bottom: 2rem;
  position: relative;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8rem;
  max-width: 1000px;
  margin: 0 auto;
}

.grid-item {
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  aspect-ratio: 16/9;
}

.grid-item:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.grid-video-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.grid-video-container video,
.grid-video-container canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.grid-video-container canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.grid-overlay {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  right: 0.4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  color: white;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.grid-camera-name {
  font-weight: 500;
}

.grid-status {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-weight: 600;
}

.grid-status.normal {
  background: var(--success-color);
}

.grid-status.warning {
  background: var(--warning-color);
  color: #333;
}

.grid-status.emergency {
  background: var(--danger-color);
  animation: pulse 1s infinite;
}

/* 浮动控制按钮 */
.floating-controls {
  position: absolute;
  bottom: 0.8rem;
  right: 0.8rem;
  display: flex;
  gap: 0.4rem;
  z-index: 10;
}

.floating-button {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.floating-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

.floating-button.primary {
  background: var(--danger-color);
  color: white;
}

.floating-button.primary:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
}

.floating-button.secondary {
  background: rgba(100, 116, 139, 0.8);
  color: white;
}

.floating-button.secondary:hover:not(:disabled) {
  background: rgba(71, 85, 105, 0.9);
  transform: translateY(-2px);
}

.floating-button.skeleton {
  background: var(--accent-color);
  color: white;
  font-size: 1rem;
  padding: 0.6rem;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.floating-button.skeleton:hover:not(:disabled),
.floating-button.skeleton.active {
  background: var(--accent-hover);
  transform: translateY(-2px);
}

/* 状态面板 */
.status-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1.2rem 1.5rem;
  box-shadow: var(--glass-shadow);
  margin-bottom: 1.5rem;
  border-left: 3px solid var(--accent-color);
  transition: border-left-color 0.3s;
}

.status-panel.normal {
  border-left-color: var(--success-color);
}

.status-panel.warning {
  border-left-color: var(--warning-color);
}

.status-panel.emergency {
  border-left-color: var(--danger-color);
  animation: glowPulse 1s infinite;
}

@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.15), var(--glass-shadow); }
  50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.1), var(--glass-shadow); }
}

.status-panel h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.status-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.6rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  transition: background-color 0.2s;
}

.status-item:hover {
  background: var(--bg-card-hover);
}

.status-label {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 500;
}

.status-value {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

/* 录制视频 */
.recordings {
  margin-bottom: 2rem;
}

.recordings h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recordings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.8rem;
}

.recording-card {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 1.2rem 1.5rem;
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  transition: all 0.2s ease;
}

.recording-card:hover {
  border-color: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--shadow-hover);
}

.recording-info h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.3rem;
}

.recording-info p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0.15rem 0;
}

.recording-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.action-button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.action-button.play {
  background: var(--accent-color);
  color: white;
}

.action-button.play:hover {
  background: var(--accent-hover);
}

.action-button.delete {
  background: var(--danger-light);
  color: var(--danger-color);
}

.action-button.delete:hover {
  background: var(--danger-color);
  color: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: center;
  }

  .control-button {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }

  .grid-container {
    grid-template-columns: 1fr;
  }

  .status-info {
    grid-template-columns: 1fr;
  }

  .recordings-grid {
    grid-template-columns: 1fr;
  }

  .floating-controls {
    bottom: 0.5rem;
    right: 0.5rem;
  }

  .floating-button {
    padding: 0.5rem 0.8rem;
    font-size: 0.8rem;
  }
}
</style>