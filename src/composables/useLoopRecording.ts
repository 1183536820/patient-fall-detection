import { ref, computed, onUnmounted } from 'vue'
import { useDetectionStore } from '../stores/detection'

export function useLoopRecording() {
  const detectionStore = useDetectionStore()
  
  // 录制状态
  const isRecording = ref(false)
  const isUploading = ref(false)
  const uploadProgress = ref(0)
  const recordedBlobs = ref<Blob[]>([])
  const mediaRecorder = ref<MediaRecorder | null>(null)
  
  // 配置
  const config = {
    timeSlice: 10000, // 10秒一个切片
    maxSlices: 3, // 最多保留3个切片（约30秒）
    mimeType: 'video/webm'
  }
  
  /**
   * 开始循环录制
   * @param stream 视频流
   */
  const startLoopRecording = (stream: MediaStream) => {
    if (isRecording.value || !stream) return
    
    try {
      mediaRecorder.value = new MediaRecorder(stream, { mimeType: config.mimeType })
      recordedBlobs.value = []
      
      // 数据可用时的处理
      mediaRecorder.value.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedBlobs.value.push(event.data)
          
          // 保持最多保留maxSlices个切片
          if (recordedBlobs.value.length > config.maxSlices) {
            recordedBlobs.value.shift() // 移除最旧的切片
          }
        }
      }
      
      // 录制停止时的处理
      mediaRecorder.value.onstop = () => {
        console.log('循环录制已停止')
        isRecording.value = false
      }
      
      // 开始录制，每timeSlice毫秒生成一个数据块
      mediaRecorder.value.start(config.timeSlice)
      isRecording.value = true
      console.log('开始循环录制')
      
    } catch (error) {
      console.error('开始循环录制失败:', error)
      isRecording.value = false
    }
  }
  
  /**
   * 停止循环录制
   */
  const stopLoopRecording = () => {
    if (!isRecording.value || !mediaRecorder.value) return
    
    try {
      mediaRecorder.value.stop()
      mediaRecorder.value = null
      recordedBlobs.value = []
      isRecording.value = false
      console.log('停止循环录制')
    } catch (error) {
      console.error('停止循环录制失败:', error)
    }
  }
  
  /**
   * 触发跌倒录制
   * 合并当前队列中的所有切片并上传
   * @param eventType 事件类型
   * @param cameraId 摄像头ID
   * @returns Promise<string> 上传后的视频URL
   */
  const triggerFallRecording = async (eventType: string = 'fall', cameraId: string = 'unknown'): Promise<string | null> => {
    if (recordedBlobs.value.length === 0) {
      console.warn('没有录制数据可上传')
      return null
    }
    
    try {
      // 合并所有切片
      const combinedBlob = new Blob(recordedBlobs.value, { type: config.mimeType })
      console.log('合并切片完成，大小:', combinedBlob.size, 'bytes')
      
      // 上传视频
      const videoUrl = await uploadFallVideo(combinedBlob, eventType, cameraId)
      return videoUrl
      
    } catch (error) {
      console.error('触发跌倒录制失败:', error)
      return null
    }
  }
  
  /**
   * 上传跌倒视频到服务端
   * @param blob 视频blob
   * @param eventType 事件类型
   * @param cameraId 摄像头ID
   * @returns Promise<string> 上传后的视频URL
   */
  const uploadFallVideo = async (blob: Blob, eventType: string, cameraId: string, retryCount: number = 0): Promise<string | null> => {
    isUploading.value = true
    uploadProgress.value = 0
    
    try {
      const formData = new FormData()
      formData.append('video', blob, `fall-${Date.now()}.webm`)
      formData.append('eventType', eventType)
      formData.append('cameraId', cameraId)
      formData.append('timestamp', Date.now().toString())
      
      const token = localStorage.getItem('auth_token')
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      
      try {
        const response = await fetch('/api/upload-fall', {
          method: 'POST',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: formData,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`上传失败: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (data.videoUrl) {
          detectionStore.addFallEvent({
            startTime: Date.now() / 1000,
            duration: recordedBlobs.value.length * 10,
            severity: '严重'
          })
          
          console.log('视频上传成功:', data.videoUrl)
          return data.videoUrl
        } else {
          throw new Error('服务端未返回视频URL')
        }
      } catch {
        clearTimeout(timeoutId)
        throw new Error('上传请求失败')
      }
      
    } catch (error) {
      if (retryCount < 2) {
        isUploading.value = false
        await new Promise(r => setTimeout(r, 1000))
        return uploadFallVideo(blob, eventType, cameraId, retryCount + 1)
      }
      
      console.error('上传视频失败(已重试):', error)
      
      const blobUrl = URL.createObjectURL(blob)
      console.log('视频上传失败，使用本地预览:', blobUrl)
      
      detectionStore.addFallEvent({
        startTime: Date.now() / 1000,
        duration: recordedBlobs.value.length * 10,
        severity: '严重'
      })
      
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl)
          console.log('已释放blob URL:', blobUrl)
        } catch (e) {
          console.warn('释放blob URL失败:', e)
        }
      }, 1800000)
      
      return blobUrl
      
    } finally {
      isUploading.value = false
      uploadProgress.value = 100
    }
  }
  
  /**
   * 获取录制状态
   */
  const recordingStatus = computed(() => {
    return {
      isRecording: isRecording.value,
      isUploading: isUploading.value,
      uploadProgress: uploadProgress.value,
      sliceCount: recordedBlobs.value.length,
      estimatedDuration: recordedBlobs.value.length * 10 // 每个切片10秒
    }
  })
  
  // 组件卸载时停止录制
  onUnmounted(() => {
    stopLoopRecording()
  })
  
  return {
    startLoopRecording,
    stopLoopRecording,
    triggerFallRecording,
    recordingStatus,
    isRecording,
    isUploading,
    uploadProgress
  }
}

export default useLoopRecording