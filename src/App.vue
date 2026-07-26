<template>
  <div class="app" :data-theme="detectionStore.theme">
    <!-- 顶部导航栏 -->
    <header class="top-nav">
      <div class="logo">
        <h1>视觉目标检测驱动的患者行为分析与跌倒预警系统</h1>
      </div>
      <div class="nav-info">
        <div class="user-info" v-if="authStore.isAuthenticated">
          <span class="username">{{ authStore.userName }}</span>
          <span class="role-badge" :class="authStore.user?.role">
            {{ authStore.user?.role === 'admin' ? '管理员' : '护士' }}
          </span>
          <button class="logout-btn" @click="handleLogout">退出</button>
        </div>
        <div class="system-status" :class="`status-${systemStatus}`">
          {{ systemStatusText }}
        </div>
        <div class="date-time">{{ currentDateTime }}</div>
        <button class="theme-toggle" @click="detectionStore.toggleTheme">
          {{ detectionStore.theme === 'light' ? '🌙' : '☀️' }}
        </button>
      </div>
    </header>

    <!-- 主要内容区 -->
    <div class="main-content">
      <!-- 左侧功能侧边栏 -->
      <aside class="sidebar">
        <nav class="sidebar-nav">
          <div class="nav-section">
            <h3>{{ t('menu.coreFunctions') || '核心功能' }}</h3>
            <router-link to="/" class="nav-item">
              <span class="nav-icon">🏠</span>
              <span>{{ t('menu.home') }}</span>
            </router-link>
            <router-link to="/camera" class="nav-item">
              <span class="nav-icon">📹</span>
              <span>{{ t('menu.camera') }}</span>
            </router-link>
            <router-link to="/video" class="nav-item">
              <span class="nav-icon">🎥</span>
              <span>{{ t('menu.video') }}</span>
            </router-link>
            <router-link to="/deepseek" class="nav-item" v-if="authStore.isAdmin">
              <span class="nav-icon">🤖</span>
              <span>{{ t('menu.aiSettings') || 'AI参数设置' }}</span>
            </router-link>
          </div>

          <div class="nav-section">
            <h3>{{ t('menu.systemManagement') || '系统管理' }}</h3>
            <router-link to="/settings" class="nav-item">
              <span class="nav-icon">{{ authStore.isAdmin ? '⚙️' : '🔑' }}</span>
              <span>{{ authStore.isAdmin ? '系统设置' : '修改密码' }}</span>
            </router-link>
            <router-link to="/user-management" class="nav-item" v-if="authStore.isAdmin">
              <span class="nav-icon">🔐</span>
              <span>账号管理</span>
            </router-link>
            <router-link to="/events" class="nav-item">
              <span class="nav-icon">📋</span>
              <span>{{ t('menu.events') }}</span>
            </router-link>
            <router-link to="/patient-records" class="nav-item">
              <span class="nav-icon">👤</span>
              <span>{{ t('menu.patients') }}</span>
            </router-link>
            <router-link to="/analytics" class="nav-item" v-if="authStore.isAdmin">
              <span class="nav-icon">📊</span>
              <span>{{ t('menu.analytics') }}</span>
            </router-link>
            <router-link to="/logs" class="nav-item" v-if="authStore.isAdmin">
              <span class="nav-icon">⚠️</span>
              <span>{{ t('menu.logs') }}</span>
            </router-link>
            <router-link to="/medical-qa" class="nav-item">
              <span class="nav-icon">🤖</span>
              <span>{{ t('menu.medicalQA') }}</span>
            </router-link>
          </div>
        </nav>
      </aside>

      <!-- 中间核心展示区 -->
      <main class="content">
        <router-view />
      </main>

      <!-- 右侧数据栏 -->
      <aside class="data-panel">
        <div class="panel-section">
          <h3>实时数据</h3>
          <div class="data-item">
            <span class="data-label">当前人数</span>
            <span class="data-value">{{ currentPeople }}</span>
          </div>
          <div class="data-item">
            <span class="data-label">异常次数</span>
            <span class="data-value">{{ abnormalCount }}</span>
          </div>
          <div class="data-item">
            <span class="data-label">模型准确率</span>
            <span class="data-value">{{ accuracyRate }}%</span>
          </div>
        </div>

        <!-- FPS 仪表盘 -->
        <div class="panel-section">
          <h3>检测帧率</h3>
          <VChart
            class="fps-gauge"
            :option="fpsGaugeOption"
            autoresize
          />
        </div>

        <div class="panel-section">
          <h3>AI分析</h3>
          <div class="ai-analysis">
            <p>{{ aiAnalysisText }}</p>
          </div>
        </div>

        <div class="panel-section">
          <h3>参数调节</h3>
          <div v-if="!authStore.isAdmin" class="param-notice">
            仅管理员可调整参数
          </div>
          <div class="param-item">
            <label>置信度</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              v-model.number="detectionStore.params.confidence"
              :readonly="!authStore.isAdmin"
              :class="{ disabled: !authStore.isAdmin }"
            />
            <span>{{ detectionStore.params.confidence }}</span>
          </div>
          <div class="param-item">
            <label>检测频率</label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              v-model.number="detectionStore.params.frequency"
              :readonly="!authStore.isAdmin"
              :class="{ disabled: !authStore.isAdmin }"
            />
            <span>{{ detectionStore.params.frequency }} FPS</span>
          </div>
          <div class="param-item">
            <label>灵敏度</label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              v-model.number="detectionStore.params.sensitivity"
              :readonly="!authStore.isAdmin"
              :class="{ disabled: !authStore.isAdmin }"
            />
            <span>{{ detectionStore.params.sensitivity }}</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- 底部状态栏 -->
    <footer class="bottom-bar">
      <div class="status-info">
        <span>系统状态: {{ systemStatusText }}</span>
        <span>设备连接: 正常</span>
        <span>模型版本: v1.0</span>
      </div>
      <div class="copyright">
        © 2026 视觉目标检测驱动的患者行为分析与跌倒预警系统 | 基于YOLO + DeepSeek技术
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDetectionStore } from './stores/detection'
import { useAuthStore } from './stores/auth'

const { t } = useI18n()

const router = useRouter()
const detectionStore = useDetectionStore()
const authStore = useAuthStore()

// 系统状态
const systemStatus = ref('normal') // normal, warning, emergency
const currentPeople = ref(1)
const abnormalCount = ref(0)
const accuracyRate = ref(95)
const aiAnalysisText = ref('系统就绪，开始监测...')

// FPS 仪表盘配置
const fpsGaugeOption = computed(() => ({
  series: [
    {
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 30,
      splitNumber: 6,
      radius: '90%',
      center: ['50%', '70%'],
      axisLine: {
        lineStyle: {
          width: 10,
          color: [
            [0.3, '#67c23a'],
            [0.7, '#e6a23c'],
            [1, '#f56c6c']
          ]
        }
      },
      pointer: {
        itemStyle: {
          color: '#4a90e2'
        }
      },
      axisTick: {
        distance: -15,
        length: 5,
        lineStyle: {
          color: 'auto'
        }
      },
      splitLine: {
        distance: -15,
        length: 10,
        lineStyle: {
          color: 'auto'
        }
      },
      axisLabel: {
        distance: 20,
        color: '#999',
        fontSize: 10
      },
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color: '#333',
        fontSize: 20,
        offsetCenter: [0, '30%']
      },
      data: [
        {
          value: detectionStore.currentFPS
        }
      ]
    }
  ]
}))

// 系统状态计算
const systemStatusText = computed(() => {
  const statusMap = {
    normal: '正常',
    warning: '预警',
    emergency: '紧急'
  }
  return statusMap[systemStatus.value as keyof typeof statusMap] || '正常'
})

// 当前时间
const currentDateTime = ref('')
let timerId: ReturnType<typeof setInterval>

const updateDateTime = () => {
  const now = new Date()
  currentDateTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  // 更新 FPS 模拟数据
  if (detectionStore.isDetecting) {
    detectionStore.setCurrentFPS(Math.floor(Math.random() * 5) + 3)
  }
}

onMounted(() => {
  updateDateTime()
  timerId = setInterval(updateDateTime, 1000)
  
  // 版本检查和参数重置
  const CURRENT_CONFIG_VERSION = '1.4'
  const storedVersion = localStorage.getItem('configVersion')
  
  if (storedVersion !== CURRENT_CONFIG_VERSION) {
    console.log('[App] 检测到配置版本更新，重置检测参数...')
    localStorage.removeItem('detectionParams')
    localStorage.removeItem('recordings')
    localStorage.removeItem('detection_history.json')
    localStorage.setItem('configVersion', CURRENT_CONFIG_VERSION)
  }
  
  detectionStore.loadParamsFromLocalStorage()
  detectionStore.loadThemeFromLocalStorage()
})

onUnmounted(() => {
  clearInterval(timerId)
})

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

// 监听主题变化
watch(() => detectionStore.theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
})
</script>

<style>
/* CSS 变量定义 — 现代深色系主题 */
:root {
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-card: #ffffff;
  --bg-card-hover: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.06);
  --shadow-hover: rgba(0, 0, 0, 0.1);
  --shadow-lg: rgba(0, 0, 0, 0.08);
  --accent-color: #0ea5e9;
  --accent-hover: #0284c7;
  --accent-light: rgba(14, 165, 233, 0.08);
  --accent-glow: rgba(14, 165, 233, 0.2);
  --success-color: #10b981;
  --success-light: rgba(16, 185, 129, 0.1);
  --warning-color: #f59e0b;
  --warning-light: rgba(245, 158, 11, 0.1);
  --danger-color: #ef4444;
  --danger-light: rgba(239, 68, 68, 0.1);
  --info-bg: rgba(14, 165, 233, 0.05);
  --nav-bg: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.3);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

:root[data-theme="dark"] {
  --bg-primary: #0c1929;
  --bg-secondary: #0f1d2f;
  --bg-card: #1a2332;
  --bg-card-hover: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border-color: #1e293b;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-hover: rgba(0, 0, 0, 0.4);
  --shadow-lg: rgba(0, 0, 0, 0.4);
  --accent-color: #38bdf8;
  --accent-hover: #0ea5e9;
  --accent-light: rgba(56, 189, 248, 0.1);
  --accent-glow: rgba(56, 189, 248, 0.2);
  --success-color: #34d399;
  --success-light: rgba(52, 211, 153, 0.12);
  --warning-color: #fbbf24;
  --warning-light: rgba(251, 191, 36, 0.12);
  --danger-color: #f87171;
  --danger-light: rgba(248, 113, 113, 0.12);
  --info-bg: rgba(56, 189, 248, 0.06);
  --nav-bg: linear-gradient(135deg, #0369a1 0%, #0f766e 100%);
  --glass-bg: rgba(26, 35, 50, 0.7);
  --glass-border: rgba(255, 255, 255, 0.06);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
}

/* 顶部导航栏 */
.top-nav {
  background: var(--nav-bg);
  color: white;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px var(--shadow), 0 1px 2px var(--shadow);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo h1 {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.nav-info {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.3rem 0.8rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
}

.username {
  font-size: 0.9rem;
  font-weight: 500;
}

.role-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.role-badge.admin {
  background: rgba(255, 215, 0, 0.8);
  color: #333;
}

.role-badge.nurse {
  background: rgba(100, 181, 246, 0.8);
  color: #333;
}

.logout-btn {
  padding: 0.3rem 0.8rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.system-status {
  padding: 0.3rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.2);
}

.status-warning {
  background: rgba(255, 213, 79, 0.8);
  color: #333;
}

.status-emergency {
  background: rgba(244, 67, 54, 0.8);
}

.date-time {
  font-size: 0.9rem;
}

.theme-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 0.5rem 0.8rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.3s ease;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 主要内容区 */
.main-content {
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

/* 左侧侧边栏 */
.sidebar {
  width: 250px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.nav-section h3 {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
  padding-left: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item:hover {
  background-color: var(--accent-light);
  color: var(--accent-color);
  transform: translateX(2px);
}

.nav-item.router-link-active {
  background-color: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--accent-color);
}

.nav-icon {
  font-size: 1.1rem;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

/* 中间核心展示区 */
.content {
  flex: 1;
  background: var(--bg-card);
  border-radius: 10px;
  box-shadow: 0 2px 4px var(--shadow);
  padding: 1.5rem;
  overflow: auto;
}

/* 右侧数据栏 */
.data-panel {
  width: 300px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.panel-section h3 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  margin-bottom: 0.3rem;
  transition: background-color 0.2s;
}

.data-item:hover {
  background-color: var(--bg-secondary);
}

.data-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
}

.data-value {
  font-weight: 700;
  color: var(--accent-color);
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.fps-gauge {
  width: 100%;
  height: 150px;
}

.ai-analysis {
  background: var(--accent-light);
  padding: 1rem 1.2rem;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent-color);
  transition: all 0.3s ease;
}

.ai-analysis p {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.param-item {
  margin-bottom: 0.8rem;
}

.param-item label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.param-item input[type="range"] {
  width: 100%;
  margin-bottom: 0.2rem;
  accent-color: var(--accent-color);
  height: 4px;
  cursor: pointer;
}

.param-item input[type="range"].disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.param-item span {
  display: block;
  text-align: right;
  font-size: 0.75rem;
  color: var(--accent-color);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.param-notice {
  background: var(--warning-light);
  color: var(--warning-color);
  padding: 0.5rem 0.8rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 500;
}

/* 底部状态栏 */
.bottom-bar {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 0.7rem 2rem;
  border-top: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.status-info {
  display: flex;
  gap: 1.5rem;
}

.status-info span {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.status-info span::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success-color);
}

.copyright {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .data-panel {
    width: 250px;
  }
  
  .sidebar {
    width: 200px;
  }
}

@media (max-width: 992px) {
  .main-content {
    flex-direction: column;
  }
  
  .sidebar,
  .data-panel {
    width: 100%;
  }
  
  .sidebar {
    order: 1;
  }
  
  .content {
    order: 2;
  }
  
  .data-panel {
    order: 3;
  }
}

@media (max-width: 768px) {
  .logo h1 {
    font-size: 1rem;
  }
  
  .nav-info {
    gap: 0.8rem;
  }
  
  .date-time {
    display: none;
  }
  
  .top-nav {
    padding: 0.8rem 1rem;
  }
}
</style>