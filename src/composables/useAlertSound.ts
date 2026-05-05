import { ref, onMounted, onUnmounted } from 'vue'
import { useDetectionStore } from '../stores/detection'

export function useAlertSound() {
  const audioContext = ref<AudioContext | null>(null)
  const detectionStore = useDetectionStore()
  
  // 初始化 AudioContext
  const initAudioContext = () => {
    if (!audioContext.value) {
      try {
        audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        console.error('无法初始化 AudioContext:', error)
      }
    }
  }
  
  /**
   * 播放告警音效（和弦版本）
   * @param type 告警类型: 'beep' | 'warning' | 'emergency'
   * @param duration 持续时间（毫秒）
   */
  const playAlertSound = (type: 'beep' | 'warning' | 'emergency' = 'beep', duration: number = 1000) => {
    if (detectionStore.isMuted) return
    
    initAudioContext()
    if (!audioContext.value) return
    
    try {
      const ctx = audioContext.value
      const now = ctx.currentTime
      const totalDuration = duration / 1000
      
      switch (type) {
        case 'beep':
          {
            const gainNode = ctx.createGain()
            gainNode.connect(ctx.destination)
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.connect(gainNode)
            osc.frequency.setValueAtTime(800, now)
            gainNode.gain.setValueAtTime(0, now)
            gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02)
            gainNode.gain.linearRampToValueAtTime(0.2, now + totalDuration - 0.02)
            gainNode.gain.linearRampToValueAtTime(0, now + totalDuration)
            osc.start(now)
            osc.stop(now + totalDuration)
          }
          break
        case 'warning':
          {
            const gainNode = ctx.createGain()
            gainNode.connect(ctx.destination)
            const osc = ctx.createOscillator()
            osc.type = 'square'
            osc.connect(gainNode)
            osc.frequency.setValueAtTime(700, now)
            gainNode.gain.setValueAtTime(0, now)
            gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02)
            gainNode.gain.linearRampToValueAtTime(0.25, now + totalDuration - 0.02)
            gainNode.gain.linearRampToValueAtTime(0, now + totalDuration)
            osc.start(now)
            osc.stop(now + totalDuration)
          }
          break
        case 'emergency':
          {
            // 紧急告警：1000Hz 单音波
            const gainNode = ctx.createGain()
            gainNode.connect(ctx.destination)
            
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.connect(gainNode)
            osc.frequency.setValueAtTime(1000, now)
            
            // 音量包络
            gainNode.gain.setValueAtTime(0, now)
            gainNode.gain.linearRampToValueAtTime(0.35, now + 0.02)
            gainNode.gain.linearRampToValueAtTime(0.35, now + totalDuration - 0.02)
            gainNode.gain.linearRampToValueAtTime(0, now + totalDuration)
            
            osc.start(now)
            osc.stop(now + totalDuration)
          }
          break
      }
      
    } catch (error) {
      console.error('播放音效失败:', error)
    }
  }
  
  /**
   * 静音/取消静音
   */
  const toggleMute = () => {
    detectionStore.toggleMute()
  }
  
  /**
   * 播放确认音效
   */
  const playConfirmationSound = () => {
    if (detectionStore.isMuted) return
    
    initAudioContext()
    if (!audioContext.value) return
    
    try {
      const oscillator = audioContext.value.createOscillator()
      const gainNode = audioContext.value.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.value.destination)
      
      oscillator.frequency.setValueAtTime(400, audioContext.value.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.value.currentTime + 0.2)
      
      gainNode.gain.setValueAtTime(0.2, audioContext.value.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.value.currentTime + 0.2)
      
      oscillator.start(audioContext.value.currentTime)
      oscillator.stop(audioContext.value.currentTime + 0.2)
      
    } catch (error) {
      console.error('播放确认音效失败:', error)
    }
  }
  
  onMounted(() => {
    // 预初始化 AudioContext
    initAudioContext()
  })
  
  onUnmounted(() => {
    if (audioContext.value) {
      audioContext.value.close()
    }
  })
  
  return {
    playAlertSound,
    playConfirmationSound,
    toggleMute,
    isMuted: ref(detectionStore.isMuted)
  }
}

export default useAlertSound