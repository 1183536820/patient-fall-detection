import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 跌倒事件类型
 * @typedef {Object} FallEvent
 * @property {number} startTime - 事件开始时间（秒）
 * @property {number} duration - 持续时间（秒）
 * @property {string} severity - 严重程度：轻微/中等/严重
 * @property {string} type - 事件类型：fall/high_risk/normal
 * @property {number} confidence - 置信度 0-1
 */

const YOLO_SCRIPT_PATH = path.join(__dirname, 'yolo_script.py')

/**
 * 检测视频中的跌倒事件
 * 
 * 当前版本返回模拟数据，实际使用时：
 * 1. 确保 Python 环境中安装了 ultralytics (pip install ultralytics)
 * 2. 将 yolo_script.py 替换为真实的 YOLO 推理脚本
 * 
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<FallEvent[]>} 检测到的跌倒事件列表
 */
export async function detectFall(videoPath) {
  console.log(`[YOLODetector] 开始分析视频: ${videoPath}`)
  
  try {
    // 方案1：使用 Python subprocess 调用真实 YOLO 模型
    // const result = await runPythonYOLO(videoPath)
    // return result
    
    // 方案2：当前使用模拟数据
    const mockResult = generateMockDetection(videoPath)
    console.log(`[YOLODetector] 检测完成，发现 ${mockResult.length} 个事件`)
    return mockResult
    
  } catch (error) {
    console.error('[YOLODetector] 检测失败:', error)
    throw error
  }
}

/**
 * 调用 Python YOLO 脚本进行真实检测
 * 
 * 需要创建 yolo_script.py 文件，内容示例：
 * ```python
 * from ultralytics import YOLO
 * import sys
 * import json
 * 
 * model = YOLO('yolov8n-pose.pt')
 * results = model(sys.argv[1], verbose=False)
 * # 处理结果并输出 JSON
 * print(json.dumps(events))
 * ```
 * 
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<FallEvent[]>}
 */
function runPythonYOLO(videoPath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [YOLO_SCRIPT_PATH, videoPath])
    let output = ''
    let errorOutput = ''
    
    python.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error('[YOLODetector] Python 脚本错误:', errorOutput)
        reject(new Error(`Python 脚本执行失败: ${errorOutput}`))
        return
      }
      
      try {
        const events = JSON.parse(output)
        resolve(events)
      } catch (error) {
        reject(new Error(`解析检测结果失败: ${error.message}`))
      }
    })
    
    python.on('error', (error) => {
      reject(new Error(`启动 Python 进程失败: ${error.message}`))
    })
  })
}

/**
 * 生成模拟检测数据
 * 用于开发测试
 * 
 * @param {string} videoPath - 视频文件路径
 * @returns {FallEvent[]}
 */
function generateMockDetection(videoPath) {
  const events = []
  const random = Math.random()
  
  // 模拟检测逻辑：30% 概率检测到跌倒
  if (random < 0.3) {
    // 检测到跌倒事件
    const fallStart = Math.floor(Math.random() * 30) + 5
    events.push({
      startTime: fallStart,
      duration: Math.floor(Math.random() * 5) + 2,
      severity: random < 0.15 ? '严重' : (random < 0.25 ? '中等' : '轻微'),
      type: 'fall',
      confidence: (Math.random() * 0.3 + 0.7).toFixed(2)
    })
  }
  
  // 模拟检测到高危姿态
  if (Math.random() < 0.4) {
    const riskStart = Math.floor(Math.random() * 20) + 2
    events.push({
      startTime: riskStart,
      duration: Math.floor(Math.random() * 8) + 3,
      severity: Math.random() < 0.5 ? '中等' : '轻微',
      type: 'high_risk',
      confidence: (Math.random() * 0.3 + 0.5).toFixed(2)
    })
  }
  
  return events.sort((a, b) => a.startTime - b.startTime)
}

/**
 * 获取检测配置
 */
export function getDetectionConfig() {
  return {
    confidenceThreshold: 0.5,
    iouThreshold: 0.45,
    modelPath: 'yolov8n-pose.pt',
    device: 'cuda' // 或 'cpu'
  }
}

export default {
  detectFall,
  getDetectionConfig
}