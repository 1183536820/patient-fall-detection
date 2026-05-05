import { defineStore } from 'pinia'

interface Alert {
  id: string
  level: 'normal' | 'warning' | 'emergency'
  title: string
  message: string
  timestamp: number
}

interface DetectionParams {
  confidence: number
  iou: number
  frequency: number
  sensitivity: number
  // 精确跌倒检测参数
  shoulderHipThreshold: number  // 肩髋垂直距离阈值 (0.05-0.4)
  minKeypointConfidence: number  // 关键点最小置信度 (0.1-0.8)
  useAngleDetection: boolean  // 是否使用身体倾斜角度检测
  fallAngleThreshold: number  // 跌倒角度阈值 (30-90度)
}

interface FallEvent {
  id: string
  startTime: number
  duration: number
  severity: string
  timestamp: number
}

interface AlertRule {
  popup: boolean
  sound: boolean
  websocket: boolean
  email: boolean
  sms: boolean
}

interface AlertRules {
  normal: AlertRule
  warning: AlertRule
  emergency: AlertRule
}

export const useDetectionStore = defineStore('detection', {
  state: () => ({
    params: {
      confidence: 0.6,
      iou: 0.5,
      frequency: 5,
      sensitivity: 3,
      shoulderHipThreshold: 0.12,
      minKeypointConfidence: 0.4,
      useAngleDetection: true,
      fallAngleThreshold: 75
    } as DetectionParams,
    alerts: [] as Alert[],
    isDetecting: false,
    fallEvents: [] as FallEvent[],
    theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
    currentFPS: 0,
    isMuted: localStorage.getItem('isMuted') === 'true',
    alertRules: {
      normal: {
        popup: false,
        sound: false,
        websocket: true,
        email: false,
        sms: false
      },
      warning: {
        popup: true,
        sound: true,
        websocket: true,
        email: false,
        sms: false
      },
      emergency: {
        popup: true,
        sound: true,
        websocket: true,
        email: true,
        sms: true
      }
    } as AlertRules
  }),
  
  actions: {
    addAlert(alert: Omit<Alert, 'id' | 'timestamp'>) {
      const newAlert: Alert = {
        ...alert,
        id: Date.now().toString(),
        timestamp: Date.now()
      }
      this.alerts.unshift(newAlert)
      
      console.log('[DetectionStore] 添加告警:', newAlert)
      console.log('[DetectionStore] 当前告警列表:', this.alerts)
      
      // 根据告警级别触发对应行为
      this.triggerAlertActions(alert.level, alert.message)
    },
    
    triggerAlertActions(level: 'normal' | 'warning' | 'emergency', message: string) {
      const rules = this.alertRules[level]
      
      // 触发 WebSocket 通知
      if (rules.websocket) {
        this.notifyWebSocket(level, message)
      }
      
      // 触发邮件通知（占位）
      if (rules.email) {
        this.sendEmailNotification(level, message)
      }
      
      // 触发短信通知（占位）
      if (rules.sms) {
        this.sendSmsNotification(level, message)
      }
    },
    
    notifyWebSocket(level: string, message: string) {
      // 这里可以通过 WebSocket 发送通知
      console.log(`[WebSocket] 发送${level}级告警通知: ${message}`)
    },
    
    sendEmailNotification(level: string, message: string) {
      // 邮件发送接口占位
      console.log(`[Email] 发送${level}级告警邮件: ${message}`)
      // 实际实现时可以调用后端 API
      // fetch('/api/notify/email', {
      //   method: 'POST',
      //   body: JSON.stringify({ level, message })
      // })
    },
    
    sendSmsNotification(level: string, message: string) {
      // 短信发送接口占位
      console.log(`[SMS] 发送${level}级告警短信: ${message}`)
      // 实际实现时可以调用后端 API
      // fetch('/api/notify/sms', {
      //   method: 'POST',
      //   body: JSON.stringify({ level, message })
      // })
    },
    
    updateParams(partialParams: Partial<DetectionParams>) {
      this.params = { ...this.params, ...partialParams }
      this.saveParamsToLocalStorage()
    },
    
    saveParamsToLocalStorage() {
      localStorage.setItem('detectionParams', JSON.stringify(this.params))
    },
    
    loadParamsFromLocalStorage() {
      const savedParams = localStorage.getItem('detectionParams')
      if (savedParams) {
        try {
          const parsedParams = JSON.parse(savedParams)
          // 验证并合并参数，确保所有必要字段都存在
          this.params = {
            confidence: parsedParams.confidence ?? this.params.confidence,
            iou: parsedParams.iou ?? this.params.iou,
            frequency: parsedParams.frequency ?? this.params.frequency,
            sensitivity: parsedParams.sensitivity ?? this.params.sensitivity,
            shoulderHipThreshold: parsedParams.shoulderHipThreshold ?? this.params.shoulderHipThreshold,
            minKeypointConfidence: parsedParams.minKeypointConfidence ?? this.params.minKeypointConfidence,
            useAngleDetection: parsedParams.useAngleDetection ?? this.params.useAngleDetection,
            fallAngleThreshold: parsedParams.fallAngleThreshold ?? this.params.fallAngleThreshold
          }
        } catch (error) {
          console.error('加载参数失败:', error)
        }
      }
    },
    
    addFallEvent(event: Omit<FallEvent, 'id' | 'timestamp'>) {
      const newEvent: FallEvent = {
        ...event,
        id: Date.now().toString(),
        timestamp: Date.now()
      }
      this.fallEvents.unshift(newEvent)
    },
    
    clearAlerts() {
      this.alerts = []
    },
    
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', this.theme)
      document.documentElement.setAttribute('data-theme', this.theme)
    },
    
    toggleMute() {
      this.isMuted = !this.isMuted
      localStorage.setItem('isMuted', this.isMuted.toString())
    },
    
    setCurrentFPS(fps: number) {
      this.currentFPS = fps
    },
    
    loadThemeFromLocalStorage() {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
      if (savedTheme) {
        this.theme = savedTheme
        document.documentElement.setAttribute('data-theme', savedTheme)
      }
    },
    
    loadMuteFromLocalStorage() {
      const savedMute = localStorage.getItem('isMuted')
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true'
      }
    }
  }
})