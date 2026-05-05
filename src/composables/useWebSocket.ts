import { ref, onMounted, onUnmounted } from 'vue'
import { useDetectionStore } from '../stores/detection'

interface WebSocketMessage {
  type: 'connection' | 'analysis_started' | 'fall_detected' | 'high_risk_detected' | 'detection_progress' | 'fall_detected_during_analysis' | 'error'
  message?: string
  videoId?: string
  event?: {
    startTime: number
    duration: number
    severity: string
    type: string
    confidence: number
  }
  timestamp: number
  progress?: number
}

interface UseWebSocketOptions {
  url?: string
  baseReconnectInterval?: number
  maxReconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = '/ws',
    baseReconnectInterval = 1000,
    maxReconnectInterval = 30000,
    maxReconnectAttempts = 10,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options

  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const reconnectAttempts = ref(0)
  const lastMessage = ref<WebSocketMessage | null>(null)
  const currentReconnectDelay = ref(0)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const detectionStore = useDetectionStore()

  const calculateBackoffDelay = (attempt: number): number => {
    const delay = Math.min(
      maxReconnectInterval,
      baseReconnectInterval * Math.pow(2, attempt)
    )
    return delay
  }

  const connect = () => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    connectionStatus.value = 'connecting'

    try {
      ws.value = new WebSocket(url)

      ws.value.onopen = () => {
        console.log('[WebSocket] 连接成功')
        isConnected.value = true
        connectionStatus.value = 'connected'
        reconnectAttempts.value = 0
        currentReconnectDelay.value = 0
        onConnect?.()
      }

      ws.value.onclose = () => {
        console.log('[WebSocket] 连接关闭')
        isConnected.value = false
        connectionStatus.value = 'reconnecting'
        onDisconnect?.()
        scheduleReconnect()
      }

      ws.value.onerror = (error) => {
        console.error('[WebSocket] 连接错误:', error)
        onError?.(error)
      }

      ws.value.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          lastMessage.value = message
          
          handleMessage(message)
          
          onMessage?.(message)
        } catch (error) {
          console.error('[WebSocket] 解析消息失败:', error)
        }
      }
    } catch (error) {
      console.error('[WebSocket] 创建连接失败:', error)
      scheduleReconnect()
    }
  }

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'connection':
        console.log('[WebSocket] 收到连接确认:', message.message)
        break
        
      case 'analysis_started':
        console.log('[WebSocket] 开始分析视频:', message.videoId)
        detectionStore.addAlert({
          level: 'warning',
          title: '视频分析',
          message: message.message || '开始分析视频...'
        })
        break
        
      case 'fall_detected':
        console.log('[WebSocket] 检测到跌倒:', message.event)
        detectionStore.addAlert({
          level: 'emergency',
          title: '紧急警报',
          message: `检测到患者跌倒！严重程度: ${message.event?.severity}`
        })
        if (message.event) {
          detectionStore.addFallEvent({
            startTime: message.event.startTime,
            duration: message.event.duration,
            severity: message.event.severity
          })
        }
        break
        
      case 'detection_progress':
        console.log(`[WebSocket] 检测进度: ${message.progress}%`)
        break
        
      case 'fall_detected_during_analysis':
        console.log('[WebSocket] 分析过程中检测到跌倒:', message)
        detectionStore.addAlert({
          level: 'emergency',
          title: '紧急警报',
          message: message.message || '检测到患者跌倒！'
        })
        break
        
      case 'error':
        console.error('[WebSocket] 服务器错误:', message.message)
        break
    }
  }

  const scheduleReconnect = () => {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      console.error('[WebSocket] 达到最大重连次数，停止重连')
      connectionStatus.value = 'disconnected'
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectAttempts.value++
    const delay = calculateBackoffDelay(reconnectAttempts.value - 1)
    currentReconnectDelay.value = delay
    
    console.log(`[WebSocket] ${delay / 1000}秒后尝试第${reconnectAttempts.value}次重连 (最多${maxReconnectAttempts}次)...`)

    reconnectTimer = setTimeout(() => {
      connect()
    }, delay)
  }

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    isConnected.value = false
    reconnectAttempts.value = 0
  }

  const send = (data: object) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
    } else {
      console.warn('[WebSocket] 无法发送消息，连接未打开')
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    ws,
    isConnected,
    connectionStatus,
    reconnectAttempts,
    currentReconnectDelay,
    lastMessage,
    connect,
    disconnect,
    send
  }
}

export default useWebSocket