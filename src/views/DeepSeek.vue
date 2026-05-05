<template>
  <div class="deepseek">
    <div class="deepseek-header">
      <h2>AI参数设置</h2>
      <p>基于DeepSeek的智能参数优化</p>
    </div>

    <!-- 视频上传区域 -->
    <div class="upload-section">
      <h3>视频上传</h3>
      <div class="upload-container">
        <input type="file" ref="fileInput" accept="video/*" @change="handleFileUpload" />
        <label for="fileInput" class="upload-label">
          <span class="upload-icon">📁</span>
          <span>{{ selectedFile ? selectedFile.name : '选择视频文件' }}</span>
        </label>
      </div>
    </div>

    <!-- 视频播放区域 -->
    <div class="video-player" v-if="videoUrl">
      <video ref="videoRef" controls>
        <source :src="videoUrl" type="video/mp4" />
        您的浏览器不支持视频播放
      </video>
    </div>

    <!-- 分析按钮 -->
    <div class="analysis-controls" v-if="videoUrl">
      <button @click="analyzeVideo" :disabled="isAnalyzing" class="control-button primary">
        {{ isAnalyzing ? '分析中...' : '分析视频' }}
      </button>
    </div>

    <!-- 分析进度条 -->
    <div class="progress-container" v-if="isAnalyzing">
      <div class="progress-bar">
        <div class="progress" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="progress-text">分析进度: {{ Math.round(progress) }}%</p>
    </div>

    <!-- 分析结果 -->
    <div class="analysis-result" v-if="analysisComplete">
      <h3>分析结果</h3>
      <div class="result-card">
        <div class="result-item">
          <span class="label">检测到跌倒事件:</span>
          <span class="value">{{ fallEventsCount }}次</span>
        </div>
        <div class="result-item">
          <span class="label">异常行为:</span>
          <span class="value">{{ abnormalBehaviorsCount }}次</span>
        </div>
        <div class="result-item">
          <span class="label">平均身体角度:</span>
          <span class="value">{{ avgBodyAngle }}°</span>
        </div>
        <div class="result-item">
          <span class="label">平均垂直距离:</span>
          <span class="value">{{ avgVerticalDistance }}px</span>
        </div>
        <div class="result-item">
          <span class="label">是否检测到人:</span>
          <span class="value">{{ personDetected ? '是' : '否' }}</span>
        </div>
        <div class="result-item">
          <span class="label">检测帧数:</span>
          <span class="value">{{ rawDetectionResults?.detectionResults?.length || 0 }}帧</span>
        </div>
        <div class="result-item">
          <span class="label">分析建议:</span>
          <span class="value" style="font-size:0.85rem;text-align:right;">{{ adjustmentSuggestion }}</span>
        </div>
      </div>
    </div>

    <!-- 分析错误提示 -->
    <div class="analysis-result" v-if="analysisError" style="border-left: 4px solid #dc3545;">
      <h3 style="border-left-color: #dc3545; color: #dc3545;">分析失败</h3>
      <p style="color: #dc3545;">{{ analysisError }}</p>
    </div>

    <!-- 参数调整区域 -->
    <div class="params-section">
      <h3>基础参数</h3>
      <div class="params-grid">
        <div class="param-item">
          <label>置信度阈值</label>
          <input type="range" min="0.1" max="0.9" step="0.1" v-model.number="detectionStore.params.confidence" />
          <span class="param-value">{{ detectionStore.params.confidence }}</span>
        </div>
        <div class="param-item">
          <label>IoU阈值</label>
          <input type="range" min="0.1" max="0.9" step="0.1" v-model.number="detectionStore.params.iou" />
          <span class="param-value">{{ detectionStore.params.iou }}</span>
        </div>
        <div class="param-item">
          <label>检测频率 (FPS)</label>
          <input type="range" min="1" max="10" step="1" v-model.number="detectionStore.params.frequency" />
          <span class="param-value">{{ detectionStore.params.frequency }} FPS</span>
        </div>
        <div class="param-item">
          <label>检测灵敏度</label>
          <input type="range" min="1" max="10" step="1" v-model.number="detectionStore.params.sensitivity" />
          <span class="param-value">{{ detectionStore.params.sensitivity }}</span>
        </div>
      </div>
      
      <h3 style="margin-top: 25px;">精确跌倒检测参数</h3>
      <div class="params-grid">
        <div class="param-item">
          <label>肩髋垂直距离阈值</label>
          <input type="range" min="0.05" max="0.4" step="0.02" v-model.number="detectionStore.params.shoulderHipThreshold" />
          <span class="param-value">{{ detectionStore.params.shoulderHipThreshold }}</span>
        </div>
        <div class="param-item">
          <label>关键点最小置信度</label>
          <input type="range" min="0.1" max="0.8" step="0.05" v-model.number="detectionStore.params.minKeypointConfidence" />
          <span class="param-value">{{ detectionStore.params.minKeypointConfidence }}</span>
        </div>
        <div class="param-item">
          <label>跌倒角度阈值 (度)</label>
          <input type="range" min="30" max="90" step="5" v-model.number="detectionStore.params.fallAngleThreshold" />
          <span class="param-value">{{ detectionStore.params.fallAngleThreshold }}°</span>
        </div>
        <div class="param-item" style="display: flex; align-items: center; gap: 10px;">
          <label>启用角度检测</label>
          <input type="checkbox" v-model="detectionStore.params.useAngleDetection" style="width: 20px; height: 20px;" />
          <span class="param-value">{{ detectionStore.params.useAngleDetection ? '是' : '否' }}</span>
        </div>
      </div>

      <div class="param-actions">
        <button @click="applyParams" :disabled="!analysisComplete" class="action-button primary">
          应用参数
        </button>
        <button @click="optimizeParams" :disabled="!analysisComplete || isOptimizing" class="action-button success">
          {{ isOptimizing ? 'AI优化中...' : 'DeepSeek自动优化' }}
        </button>
        <button @click="resetParams" class="action-button secondary">
          重置参数
        </button>
      </div>
    </div>

    <!-- 优化结果 -->
    <div class="optimization-result" v-if="optimizationComplete">
      <h3>优化结果</h3>
      <div class="optimization-card">
        <div class="optimization-item">
          <span class="label">优化前置信度:</span>
          <span class="value">{{ originalParams.confidence }}</span>
        </div>
        <div class="optimization-item">
          <span class="label">优化后置信度:</span>
          <span class="value">{{ detectionStore.params.confidence }}</span>
        </div>
        <div class="optimization-item">
          <span class="label">优化前肩髋距离阈值:</span>
          <span class="value">{{ originalParams.shoulderHipThreshold }}</span>
        </div>
        <div class="optimization-item">
          <span class="label">优化后肩髋距离阈值:</span>
          <span class="value">{{ detectionStore.params.shoulderHipThreshold }}</span>
        </div>
        <div class="optimization-item">
          <span class="label">优化前角度阈值:</span>
          <span class="value">{{ originalParams.fallAngleThreshold }}°</span>
        </div>
        <div class="optimization-item">
          <span class="label">优化后角度阈值:</span>
          <span class="value">{{ detectionStore.params.fallAngleThreshold }}°</span>
        </div>
        <div class="optimization-message">
          <p>{{ optimizationMessage }}</p>
        </div>
      </div>
    </div>

    <!-- 医疗智能问答 -->
    <div class="medical-qa">
      <h3>医疗智能问答</h3>
      <div class="api-key-status" v-if="apiKeyStatus">
        <span :class="apiKeyStatus.configured ? 'key-configured' : 'key-missing'">
          {{ apiKeyStatus.configured ? '✅ DeepSeek API 已配置' : '⚠️ 未配置 DeepSeek API Key' }}
          <span v-if="apiKeyStatus.configured && apiKeyStatus.maskedKey">({{ apiKeyStatus.maskedKey }})</span>
        </span>
      </div>
      <div class="qa-container">
        <div class="qa-input">
          <input type="text" v-model="qaQuestion" placeholder="输入医疗相关问题，如：老人跌倒护理注意事项" @keydown.enter.prevent="askQuestion" />
          <button @click="askQuestion" :disabled="!qaQuestion || qaLoading" class="qa-button">
            {{ qaLoading ? '回答中...' : '提问' }}
          </button>
        </div>
        <div class="qa-error" v-if="qaError">
          <p>⚠️ {{ qaError }}</p>
        </div>
        <div class="qa-result" v-if="qaAnswer">
          <h4>AI回答:</h4>
          <p style="white-space: pre-wrap;">{{ qaAnswer }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDetectionStore } from '../stores/detection'
import { useAuthStore } from '../stores/auth'
import { PARAM_OPTIMIZATION_SYSTEM_PROMPT, buildParamOptimizationUserPrompt } from '../utils/prompts'

interface DetectionResult {
  success: boolean
  videoId: string
  events: Array<{
    type: string
    timestamp: number
    severity: string
    duration: number
    frameCount: number
  }>
  detectionResults: Array<{
    is_fall: boolean
    timestamp: number
    body_angle: number
    vertical_distance: number
    person_count: number
  }>
}

const detectionStore = useDetectionStore()
const authStore = useAuthStore()

// API Key 状态
const apiKeyStatus = ref<{ configured: boolean; maskedKey: string | null } | null>(null)

// 视频相关
const videoRef = ref<HTMLVideoElement>()
const fileInput = ref<HTMLInputElement>()
const videoUrl = ref('')
const selectedFile = ref<File | null>(null)

// 分析相关
const isAnalyzing = ref(false)
const progress = ref(0)
const analysisComplete = ref(false)
const analysisError = ref('')
const fallEventsCount = ref(0)
const abnormalBehaviorsCount = ref(0)
const avgBodyAngle = ref(0)
const avgVerticalDistance = ref(0)
const personDetected = ref(false)
const adjustmentSuggestion = ref('')
const rawDetectionResults = ref<DetectionResult | null>(null)

// 参数相关
const originalParams = ref({ ...detectionStore.params })
const optimizationComplete = ref(false)
const optimizationMessage = ref('')
const isOptimizing = ref(false)

// 医疗问答
const qaQuestion = ref('')
const qaAnswer = ref('')
const qaLoading = ref(false)
const qaError = ref('')

// 获取 API Key 状态
async function checkApiKeyStatus() {
  try {
    const res = await fetch('/api/settings/api-key-status', {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    if (res.ok) {
      apiKeyStatus.value = await res.json()
    }
  } catch {
    // 忽略
  }
}

// 处理文件上传
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
    videoUrl.value = URL.createObjectURL(selectedFile.value)
    analysisComplete.value = false
    analysisError.value = ''
    rawDetectionResults.value = null
  }
}

// 分析视频 - 调用真实检测 API
const analyzeVideo = async () => {
  if (!selectedFile.value) return

  isAnalyzing.value = true
  progress.value = 0
  analysisError.value = ''

  try {
    const formData = new FormData()
    formData.append('video', selectedFile.value)
    formData.append('confidence', detectionStore.params.confidence.toString())
    formData.append('shoulderHipThreshold', detectionStore.params.shoulderHipThreshold.toString())
    formData.append('minKeypointConfidence', detectionStore.params.minKeypointConfidence.toString())
    formData.append('useAngleDetection', detectionStore.params.useAngleDetection.toString())
    formData.append('fallAngleThreshold', detectionStore.params.fallAngleThreshold.toString())

    // 用 XHR 监听上传进度
    const result = await new Promise<DetectionResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/detect')
      xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          progress.value = Math.round((e.loaded / e.total) * 30)
        }
      }

      let pollTimer: ReturnType<typeof setInterval>
      xhr.onloadstart = () => {
        progress.value = 5
        let detectProgress = 30
        pollTimer = setInterval(() => {
          detectProgress += Math.random() * 3
          if (detectProgress < 95) {
            progress.value = Math.round(detectProgress)
          }
        }, 800)
      }

      xhr.onload = () => {
        clearInterval(pollTimer)
        if (xhr.status >= 200 && xhr.status < 300) {
          progress.value = 100
          resolve(JSON.parse(xhr.responseText))
        } else {
          try {
            const err = JSON.parse(xhr.responseText)
            reject(new Error(err.error || '检测失败'))
          } catch {
            reject(new Error(`检测失败 (${xhr.status})`))
          }
        }
      }

      xhr.onerror = () => {
        clearInterval(pollTimer)
        reject(new Error('网络错误'))
      }

      xhr.send(formData)
    })

    rawDetectionResults.value = result
    analysisComplete.value = true

    // 从真实结果中提取统计信息
    fallEventsCount.value = result.events?.length || 0
    abnormalBehaviorsCount.value = (result.detectionResults || []).filter(
      d => !d.is_fall && (d.body_angle > 45 || d.vertical_distance < 80)
    ).length

    personDetected.value = result.detectionResults?.length > 0

    // 计算平均身体角度和垂直距离
    const angles = (result.detectionResults || []).map(d => d.body_angle).filter(Boolean)
    const distances = (result.detectionResults || []).map(d => d.vertical_distance).filter(Boolean)
    avgBodyAngle.value = angles.length > 0
      ? Math.round(angles.reduce((a, b) => a + b, 0) / angles.length)
      : 0
    avgVerticalDistance.value = distances.length > 0
      ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)
      : 0

    // 生成调整建议
    if (fallEventsCount.value > 0) {
      adjustmentSuggestion.value = `检测到 ${fallEventsCount.value} 次跌倒事件，建议降低置信度阈值和角度阈值以提高检测灵敏度`
    } else if (avgBodyAngle.value > 40) {
      adjustmentSuggestion.value = `平均身体角度偏大 (${avgBodyAngle.value}°)，建议适当降低跌倒角度阈值`
    } else {
      adjustmentSuggestion.value = '当前参数表现良好，可根据实际场景微调'
    }

  } catch (error: any) {
    console.error('[DeepSeek] 视频分析失败:', error)
    analysisError.value = error.message || '视频分析失败，请重试'
  } finally {
    isAnalyzing.value = false
  }
}

// 应用参数
const applyParams = () => {
  detectionStore.saveParamsToLocalStorage()
  alert('参数已应用并保存！')
}

// DeepSeek 自动优化参数 - 调用真实 AI
const optimizeParams = async () => {
  if (!rawDetectionResults.value) return

  originalParams.value = { ...detectionStore.params }
  isOptimizing.value = true
  optimizationComplete.value = false

  try {
    const detectionStats = {
      totalFrames: rawDetectionResults.value.detectionResults?.length || 0,
      fallEvents: fallEventsCount.value,
      abnormalBehaviors: abnormalBehaviorsCount.value,
      avgBodyAngle: avgBodyAngle.value,
      avgVerticalDistance: avgVerticalDistance.value,
      personDetected: personDetected.value,
      currentParams: { ...detectionStore.params }
    }

    const response = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: PARAM_OPTIMIZATION_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: buildParamOptimizationUserPrompt(detectionStats)
          }
        ]
      })
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.error || 'API调用失败')
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 尝试从返回中提取 JSON
    let suggestion: any = null
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败
    }

    if (suggestion) {
      detectionStore.updateParams({
        confidence: Math.max(0.1, Math.min(0.9, suggestion.confidence ?? detectionStore.params.confidence)),
        shoulderHipThreshold: Math.max(0.05, Math.min(0.4, suggestion.shoulderHipThreshold ?? detectionStore.params.shoulderHipThreshold)),
        minKeypointConfidence: Math.max(0.1, Math.min(0.8, suggestion.minKeypointConfidence ?? detectionStore.params.minKeypointConfidence)),
        useAngleDetection: suggestion.useAngleDetection ?? detectionStore.params.useAngleDetection,
        fallAngleThreshold: Math.max(30, Math.min(90, suggestion.fallAngleThreshold ?? detectionStore.params.fallAngleThreshold))
      })
      optimizationMessage.value = suggestion.reason || 'DeepSeek AI 已根据检测数据优化参数'
    } else {
      optimizationMessage.value = 'DeepSeek AI 分析完成，保持当前参数设置'
    }

    optimizationComplete.value = true
  } catch (error: any) {
    console.error('[DeepSeek] 参数优化失败:', error)
    optimizationMessage.value = `AI优化失败: ${error.message}，请检查 API Key 配置`
    optimizationComplete.value = true
  } finally {
    isOptimizing.value = false
  }
}

// 重置参数
const resetParams = () => {
  detectionStore.updateParams({
    confidence: 0.5,
    iou: 0.5,
    frequency: 5,
    sensitivity: 5,
    shoulderHipThreshold: 0.2,
    minKeypointConfidence: 0.3,
    fallAngleThreshold: 60,
    useAngleDetection: true
  })
  optimizationComplete.value = false
  optimizationMessage.value = ''
}

// 医疗问答 - 真实 API 调用
const askQuestion = async () => {
  if (!qaQuestion.value) return

  qaLoading.value = true
  qaAnswer.value = ''
  qaError.value = ''

  try {
    const response = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: '你是一个专业的医疗助手，专门回答关于患者护理、老年人跌倒预防与处理、慢性病管理等医疗健康问题。请用中文回答，回答要专业且易懂，内容适中，不要使用任何符号标记，按段落分段回答。'
          },
          { role: 'user', content: qaQuestion.value }
        ]
      })
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `API调用失败 (${response.status})`)
    }

    const data = await response.json()
    qaAnswer.value = data.choices?.[0]?.message?.content || '抱歉，无法获取回答'
  } catch (error: any) {
    console.error('[DeepSeek] 问答失败:', error)
    qaError.value = error.message || '问答服务暂不可用，请检查 API Key 配置'
  } finally {
    qaLoading.value = false
  }
}

// 组件挂载
onMounted(() => {
  detectionStore.loadParamsFromLocalStorage()
  checkApiKeyStatus()
})
</script>

<style scoped>
.deepseek {
  width: 100%;
}

.deepseek-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.deepseek-header h2 {
  font-size: 1.8rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.deepseek-header p {
  font-size: 1rem;
  color: #666;
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
  margin-bottom: 1.5rem;
}

.video-player video {
  width: 100%;
  max-width: 800px;
  display: block;
  margin: 0 auto;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 分析控制 */
.analysis-controls {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
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

/* 分析结果 */
.analysis-result {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.analysis-result h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 1rem;
  padding-left: 0.5rem;
  border-left: 4px solid #4a90e2;
}

.result-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item .label {
  color: #666;
  font-size: 0.95rem;
}

.result-item .value {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

/* 参数调整 */
.params-section {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.params-section h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid #4a90e2;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-item label {
  font-size: 0.95rem;
  color: #666;
  font-weight: 500;
}

.param-item input[type="range"] {
  width: 100%;
  margin: 0.5rem 0;
}

.param-value {
  font-size: 0.9rem;
  color: #4a90e2;
  font-weight: 600;
  text-align: right;
}

.param-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* 优化结果 */
.optimization-result {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.optimization-result h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 1rem;
  padding-left: 0.5rem;
  border-left: 4px solid #28a745;
}

.optimization-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.optimization-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.optimization-item:last-child {
  border-bottom: none;
}

.optimization-item .label {
  color: #666;
  font-size: 0.95rem;
}

.optimization-item .value {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.optimization-message {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.optimization-message p {
  font-size: 0.95rem;
  color: #333;
  line-height: 1.4;
}

/* 医疗问答 */
.medical-qa {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.medical-qa h3 {
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid #4a90e2;
}

.qa-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.qa-input {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.qa-input input {
  flex: 1;
  min-width: 300px;
  padding: 0.8rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.qa-button {
  padding: 0.8rem 1.5rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s ease;
}

.qa-button:hover:not(:disabled) {
  background: #357abd;
}

.qa-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qa-result {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid #4a90e2;
}

.qa-result h4 {
  font-size: 1rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.qa-result p {
  font-size: 0.95rem;
  color: #333;
  line-height: 1.4;
}

/* API Key 状态 */
.api-key-status {
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: #f8f9fa;
}

.key-configured {
  color: #28a745;
  font-size: 0.9rem;
}

.key-missing {
  color: #dc3545;
  font-size: 0.9rem;
}

/* 问答错误 */
.qa-error {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 0.8rem 1rem;
}

.qa-error p {
  color: #856404;
  font-size: 0.9rem;
  margin: 0;
}

/* 按钮样式 */
.control-button,
.action-button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.control-button:disabled,
.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.control-button.primary,
.action-button.primary {
  background: #4a90e2;
  color: white;
}

.control-button.primary:hover:not(:disabled),
.action-button.primary:hover:not(:disabled) {
  background: #357abd;
}

.action-button.success {
  background: #28a745;
  color: white;
}

.action-button.success:hover:not(:disabled) {
  background: #218838;
}

.action-button.secondary {
  background: #6c757d;
  color: white;
}

.action-button.secondary:hover:not(:disabled) {
  background: #5a6268;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .params-grid {
    grid-template-columns: 1fr;
  }
  
  .param-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .action-button {
    width: 100%;
    max-width: 300px;
  }
  
  .qa-input {
    flex-direction: column;
  }
  
  .qa-input input {
    min-width: auto;
  }
  
  .qa-button {
    width: 100%;
  }
}
</style>