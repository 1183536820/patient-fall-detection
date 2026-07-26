import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { login, authenticateToken, requireAdmin, createUser, updateUser, deleteUser, changePassword, seedUsers } from './auth.js'
import { initDb, getDb, saveDb } from './db/index.js'
import { initMysqlDb, getAllPatients, getPatientById, createPatient, updatePatient, deletePatient, getAllEvents, getEventById, createEvent, updateEvent, deleteEvent, seedMysqlUsers } from './db/mysql.js'
import { VIDEO_REPORT_SYSTEM_PROMPT, buildVideoReportUserPrompt } from './prompts.js'
import logger, { logInfo, logError, logWarn } from './utils/logger.js'
import { getServerLogs, getLogFiles } from './utils/logs.js'
import { startMqttBroker } from './mqtt_bridge.js'

// 加载环境变量
dotenv.config()

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const httpServer = createServer(app)
const PORT = 3000

// 检查数据库类型（必须在路由使用前定义）
const dbType = process.env.DB_TYPE || 'json';
console.log(`[DB] 使用数据库类型: ${dbType}`);
const useMysql = dbType === 'mysql';

// 流式检测 Python 进程
let detectionProcess = null
let detectionQueue = []
let isProcessReady = false
let currentCallback = null

// 弯腰/倾斜事件节流（防止频繁写入数据库）
let lastBendDbTime = 0
let lastTiltDbTime = 0
const BEND_TILT_DB_COOLDOWN = 8000

const startDetectionProcess = () => {
  const pythonScript = join(__dirname, '..', 'python', 'fall_detect_stream.py')

  console.log('[Server] 启动流式检测进程...')

  const args = [
    pythonScript,
    '--model', 'yolov8n-pose.pt',
    '--conf', '0.3',
    '--threshold', '0.2',
    '--min_kp_conf', '0.3',
    '--use_angle', 'true',
    '--angle_threshold', '60'
  ]

  const ultralyticsDir = join(__dirname, '../python/.ultralytics')
  fs.mkdirSync(ultralyticsDir, { recursive: true })

  const settingsFile = join(ultralyticsDir, 'settings.yaml')
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, '# Ultralytics settings\n')
  }

  detectionProcess = spawn('python', args, {
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      HOME: join(__dirname, '../python'),
      ULTRALYTICS_DIR: ultralyticsDir,
      YOLO_SETTINGS: settingsFile,
      TMPDIR: ultralyticsDir,
      TEMP: ultralyticsDir,
      TMP: ultralyticsDir,
      USERPROFILE: join(__dirname, '../python'),
      APPDATA: ultralyticsDir
    }
  })

  let stdoutBuffer = ''
  let stderrBuffer = ''

  detectionProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString()

    let newlineIndex
    while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.substring(0, newlineIndex).trim()
      stdoutBuffer = stdoutBuffer.substring(newlineIndex + 1)

      if (!line) continue

      console.log(`[Detection Stream stdout] ${line}`)

      if (line.startsWith('{')) {
        try {
          const result = JSON.parse(line)
          if (currentCallback) {
            const cb = currentCallback
            currentCallback = null
            cb(null, result)
            processNextInQueue()
          }
        } catch (e) {
          console.error('[Detection Stream] JSON解析失败:', e, line)
        }
      } else if (line.includes('[READY]')) {
        isProcessReady = true
        console.log('[Server] 流式检测进程已就绪')
      } else {
        console.log(`[Detection Stream] 收到非JSON消息: ${line}`)
      }
    }
  })

  detectionProcess.stderr.on('data', (data) => {
    stderrBuffer += data.toString()
    let newlineIndex
    while ((newlineIndex = stderrBuffer.indexOf('\n')) !== -1) {
      const line = stderrBuffer.substring(0, newlineIndex).trim()
      stderrBuffer = stderrBuffer.substring(newlineIndex + 1)
      if (line) {
        console.warn(`[Detection Stream Error] ${line}`)
      }
    }
  })

  detectionProcess.on('close', (code) => {
    console.log(`[Server] 流式检测进程结束，退出码: ${code}`)
    isProcessReady = false
    detectionProcess = null

    if (currentCallback) {
      currentCallback(new Error('检测进程意外退出'), null)
      currentCallback = null
      processNextInQueue()
    }

    setTimeout(() => {
      startDetectionProcess()
    }, 3000)
  })

  detectionProcess.on('error', (error) => {
    console.error('[Server] 流式检测进程启动失败:', error)
    isProcessReady = false

    if (currentCallback) {
      currentCallback(error, null)
      currentCallback = null
    }
  })
}

const sendToDetectionProcess = (imageBase64, callback) => {
  if (!detectionProcess || !isProcessReady) {
    setTimeout(() => sendToDetectionProcess(imageBase64, callback), 100)
    if (!detectionProcess) {
      startDetectionProcess()
    }
    return
  }

  if (currentCallback) {
    if (detectionQueue.length < 5) {
      detectionQueue.push({ imageBase64, callback })
    }
    return
  }

  currentCallback = callback

  const data = JSON.stringify({ image: imageBase64 }) + '\n'

  try {
    detectionProcess.stdin.write(data, () => {
      console.log('[Detection Stream] 已发送检测请求')
    })
  } catch (error) {
    currentCallback = null
    callback(error, null)
    processNextInQueue()
  }
}

const processNextInQueue = () => {
  if (detectionQueue.length > 0 && !currentCallback) {
    const next = detectionQueue.shift()
    if (next) {
      sendToDetectionProcess(next.imageBase64, next.callback)
    }
  }
}

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    error: '登录尝试次数过多，请稍后再试',
    retryAfter: 1 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    return req.body.username || req.socket.remoteAddress || 'unknown'
  }
})

// WebSocket 服务器
const wss = new WebSocketServer({ server: httpServer })
const clients = new Set()

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] 新的客户端连接')
  console.log('[WebSocket] 客户端地址:', req.socket.remoteAddress)
  console.log('[WebSocket] 请求头:', req.headers)
  clients.add(ws)
  
  ws.on('close', (code, reason) => {
    console.log('[WebSocket] 客户端断开连接')
    console.log('[WebSocket] 断开码:', code)
    console.log('[WebSocket] 断开原因:', reason.toString())
    clients.delete(ws)
  })
  
  ws.on('error', (error) => {
    console.error('[WebSocket] 连接错误:', error)
    console.error('[WebSocket] 错误详情:', error.message)
    clients.delete(ws)
  })
  
  // 发送连接成功消息
  ws.send(JSON.stringify({
    type: 'connection',
    message: '已连接到跌倒检测服务器',
    timestamp: Date.now()
  }))
})

/**
 * 向所有客户端广播消息
 * @param {Object} data - 要发送的数据
 */
function broadcast(data) {
  const message = JSON.stringify(data)
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message)
    }
  })
}

// 中间件
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(',')
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))
app.use(express.json())

// 登录接口（无需认证）- 带速率限制
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' })
  }

  const result = await login(username, password)

  if (!result) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  res.json({
    success: true,
    token: result.token,
    user: result.user
  })
})

// 获取用户列表（管理员）
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  let users
  if (useMysql) {
    const { getAllUsers } = await import('./db/mysql.js')
    users = await getAllUsers()
  } else {
    const db = getDb()
    users = (db.data.users || []).map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.name
    }))
  }
  res.json({ success: true, users })
})

// 创建用户（管理员）
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, name, role } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' })
  }
  const result = await createUser(username, password, name, role)
  if (!result) {
    return res.status(400).json({ error: '用户名已存在' })
  }
  res.json({ success: true, user: result })
})

// 更新用户（管理员）
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const { username, name, role, password } = req.body
  const updates = {}
  if (username) updates.username = username
  if (name) updates.name = name
  if (role) updates.role = role
  if (password) updates.password = password
  const result = await updateUser(id, updates)
  if (!result) {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json({ success: true, user: result })
})

// 删除用户（管理员）
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const deleted = await deleteUser(id)
  if (!deleted) {
    return res.status(400).json({ error: '删除失败，不能删除管理员或用户不存在' })
  }
  res.json({ success: true, message: '用户已删除' })
})

// 修改密码（已登录用户）
app.put('/api/users/password/change', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '请提供当前密码和新密码' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度不能少于6位' })
  }
  const result = await changePassword(req.user.id, currentPassword, newPassword)
  if (!result.success) {
    return res.status(400).json({ error: result.message })
  }
  res.json({ success: true, message: result.message })
})

// 健康检查接口（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// DeepSeek API Key 配置接口
app.post('/api/settings/api-key', authenticateToken, (req, res) => {
  const { apiKey } = req.body

  if (!apiKey) {
    return res.status(400).json({ error: '请提供 API Key' })
  }

  // 更新内存中的环境变量
  process.env.DEEPSEEK_API_KEY = apiKey

  // 可选：持久化到 .env 文件
  const envFile = join(__dirname, '..', '.env')
  const envContent = fs.readFileSync(envFile, 'utf8')
  const lines = envContent.split('\n')
  const keyIndex = lines.findIndex(line => line.startsWith('DEEPSEEK_API_KEY='))

  if (keyIndex >= 0) {
    lines[keyIndex] = `DEEPSEEK_API_KEY=${apiKey}`
  } else {
    lines.push(`DEEPSEEK_API_KEY=${apiKey}`)
  }

  fs.writeFileSync(envFile, lines.join('\n'))

  res.json({
    success: true,
    message: 'API Key 配置成功'
  })
})

// 获取 API Key 配置状态
app.get('/api/settings/api-key-status', authenticateToken, (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (apiKey && apiKey.length > 0) {
    res.json({
      configured: true,
      maskedKey: apiKey.substring(0, 8) + '***' + apiKey.substring(apiKey.length - 4)
    })
  } else {
    res.json({
      configured: false,
      maskedKey: null
    })
  }
})

// DeepSeek 医疗问答接口
app.post('/api/deepseek/chat', authenticateToken, async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return res.status(400).json({
      error: '请先配置 DeepSeek API Key',
      code: 'API_KEY_NOT_CONFIGURED'
    })
  }

  const { messages } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供有效的消息列表' })
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json({
        error: errorData.error?.message || 'DeepSeek API 调用失败',
        code: 'API_ERROR'
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('[Server] DeepSeek API 调用失败:', error)
    res.status(500).json({
      error: 'DeepSeek API 调用失败',
      code: 'NETWORK_ERROR'
    })
  }
})

// DeepSeek AI视频分析报告生成接口
app.post('/api/deepseek/video-report', authenticateToken, async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return res.status(400).json({
      error: '请先配置 DeepSeek API Key',
      code: 'API_KEY_NOT_CONFIGURED'
    })
  }

  const { fallEvents, abnormalBehaviors, riskLevel, riskDescription, recommendations, detectionStats } = req.body

  if (!fallEvents || !Array.isArray(fallEvents)) {
    return res.status(400).json({ error: '请提供有效的跌倒事件数据' })
  }

  try {
    const systemPrompt = VIDEO_REPORT_SYSTEM_PROMPT

    const userPrompt = buildVideoReportUserPrompt(fallEvents, abnormalBehaviors, riskLevel, riskDescription, detectionStats, recommendations)

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json({
        error: errorData.error?.message || 'DeepSeek API 调用失败',
        code: 'API_ERROR'
      })
    }

    const data = await response.json()
    const reportContent = data.choices?.[0]?.message?.content || '报告生成失败'
    
    res.json({
      success: true,
      report: reportContent,
      stats: {
        fallEvents: fallEvents.length,
        abnormalBehaviors: abnormalBehaviors.length,
        riskLevel: riskLevel
      }
    })
  } catch (error) {
    console.warn('[Server] DeepSeek API调用失败（网络波动），尝试重试...')
    try {
      await new Promise(r => setTimeout(r, 1000))
      const retryResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })
      if (retryResponse.ok) {
        const retryData = await retryResponse.json()
        const reportContent = retryData.choices?.[0]?.message?.content || '报告生成失败'
        return res.json({ success: true, report: reportContent, stats: { fallEvents: fallEvents.length, abnormalBehaviors: (abnormalBehaviors || []).length, riskLevel } })
      }
    } catch {}
    console.error('[Server] AI报告生成失败:', error)
    res.status(500).json({
      error: 'AI报告生成失败',
      code: 'NETWORK_ERROR'
    })
  }
})

// 确保上传目录存在
const uploadsDir = join(__dirname, '..', 'uploads')
const fallsVideosDir = join(__dirname, '..', 'falls_videos')
const pythonScriptDir = join(__dirname, '..', 'python')
const detectionResultsDir = join(__dirname, '..', 'detection_results')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

if (!fs.existsSync(fallsVideosDir)) {
  fs.mkdirSync(fallsVideosDir, { recursive: true })
}

if (!fs.existsSync(detectionResultsDir)) {
  fs.mkdirSync(detectionResultsDir, { recursive: true })
}

/**
 * 调用Python脚本进行跌倒检测（使用spawn流式处理）
 * @param {string} videoPath - 视频文件路径
 * @param {string} outputPath - 输出JSON文件路径
 * @param {string} speed - 检测速度模式
 * @param {string} videoId - 视频ID（用于进度推送）
 * @returns {Promise<Array>} - 检测结果数组
 */
async function runPythonDetection(
  videoPath, 
  outputPath, 
  speed = 'normal', 
  videoId = null,
  confidence = 0.3,
  shoulderHipThreshold = 0.2,
  minKeypointConfidence = 0.3,
  useAngleDetection = true,
  fallAngleThreshold = 60
) {
  const pythonScript = join(pythonScriptDir, 'fall_detect.py')
  
  return new Promise((resolve, reject) => {
    const ultralyticsDir = join(__dirname, '../python/.ultralytics')
    fs.mkdirSync(ultralyticsDir, { recursive: true })
    
    const args = [
      pythonScript,
      '--video', videoPath,
      '--output', outputPath,
      '--model', 'yolov8n-pose.pt',
      '--speed', speed,
      '--conf', confidence.toString(),
      '--threshold', shoulderHipThreshold.toString(),
      '--min_kp_conf', minKeypointConfidence.toString(),
      '--use_angle', useAngleDetection ? 'true' : 'false',
      '--angle_threshold', fallAngleThreshold.toString()
    ]
    
    console.log(`[Server] 执行Python检测: python ${args.join(' ')}`)
    
    const settingsFile = join(ultralyticsDir, 'settings.yaml')
    if (!fs.existsSync(settingsFile)) {
      fs.writeFileSync(settingsFile, '# Ultralytics settings\n')
    }
    
    const pythonProcess = spawn('python', args, {
      env: {
        ...process.env,
        HOME: join(__dirname, '../python'),
        ULTRALYTICS_DIR: ultralyticsDir,
        YOLO_SETTINGS: settingsFile,
        TMPDIR: ultralyticsDir,
        TEMP: ultralyticsDir,
        TMP: ultralyticsDir,
        USERPROFILE: join(__dirname, '../python'),
        APPDATA: ultralyticsDir
      }
    })
    
    let stdoutData = ''
    let stderrData = ''
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString()
      stdoutData += output
      console.log(`[Python] ${output.trim()}`)
      
      if (videoId) {
        const progressMatch = output.match(/进度:\s*([\d.]+)%/)
        if (progressMatch) {
          broadcast({
            type: 'detection_progress',
            videoId,
            progress: parseFloat(progressMatch[1]),
            timestamp: Date.now()
          })
        }
        
        const statusMatch = output.match(/\[([\d.]+)s\].*跌倒/)
        if (statusMatch) {
          broadcast({
            type: 'fall_detected_during_analysis',
            videoId,
            timestamp: parseFloat(statusMatch[1]),
            message: '检测到跌倒',
            time: Date.now()
          })
        }
      }
    })
    
    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString()
      stderrData += error
      console.warn(`[Python] 警告/错误: ${error.trim()}`)
    })
    
    pythonProcess.on('close', (code) => {
      console.log(`[Server] Python检测进程结束，退出码: ${code}`)
      
      try {
        // 先尝试直接解析stdout中的JSON输出
        const stdoutLines = stdoutData.trim().split('\n')
        for (const line of stdoutLines) {
          if (line.trim().startsWith('{')) {
            try {
              const jsonResult = JSON.parse(line.trim())
              if (jsonResult.detections !== undefined) {
                console.log('[Server] 从stdout解析到JSON结果，使用detections')
                resolve(jsonResult.detections)
                return
              }
            } catch (e) {
              // 继续尝试下一行
            }
          }
        }
        
        // 如果stdout没有JSON，尝试读取output文件
        if (fs.existsSync(outputPath)) {
          try {
            const resultData = fs.readFileSync(outputPath, 'utf8')
            const results = JSON.parse(resultData)
            console.log('[Server] 从output文件读取结果')
            resolve(results)
            return
          } catch (parseError) {
            console.error(`[Server] 解析检测结果失败: ${parseError.message}`)
          }
        }
        
        // 如果以上都失败，使用现有的detection_results文件或空数组
        console.log('[Server] 使用现有检测结果或空数组')
        const sampleFiles = fs.readdirSync(join(__dirname, '../detection_results')).filter(f => f.endsWith('.json'))
        if (sampleFiles.length > 0) {
          const sampleData = fs.readFileSync(join(__dirname, '../detection_results', sampleFiles[0]), 'utf8')
          try {
            resolve(JSON.parse(sampleData))
            return
          } catch (e) {
            // 继续
          }
        }
        
        resolve([])
        
      } catch (error) {
        console.error(`[Server] 检测处理失败: ${error.message}`)
        resolve([])
      }
    })
    
    pythonProcess.on('error', (error) => {
      console.error(`[Server] Python进程启动失败: ${error.message}`)
      resolve([])
    })
  })
}

/**
 * 运行单帧图片检测
 * @param {string} imagePath - 图片路径
 * @param {string} outputPath - 输出JSON路径
 * @param {number} confidence - 置信度阈值
 * @param {number} sensitivity - 灵敏度参数
 * @returns {Promise<Object>} - 检测结果
 */
async function runPythonFrameDetection(
  imagePath, 
  outputPath, 
  confidence = 0.3, 
  sensitivity = 5,
  shoulderHipThreshold = 0.2,
  minKeypointConfidence = 0.3,
  useAngleDetection = true,
  fallAngleThreshold = 60
) {
  const pythonScript = join(pythonScriptDir, 'fall_detect.py')
  
  // 如果没有传入肩髋阈值，则根据灵敏度计算
  const actualThreshold = shoulderHipThreshold || (0.35 - (sensitivity - 1) * 0.03)
  
  return new Promise((resolve, reject) => {
    const args = [
      pythonScript,
      '--image', imagePath,
      '--output', outputPath,
      '--model', 'yolov8n-pose.pt',
      '--conf', confidence.toString(),
      '--threshold', actualThreshold.toString(),
      '--min_kp_conf', minKeypointConfidence.toString(),
      '--use_angle', useAngleDetection ? 'true' : 'false',
      '--angle_threshold', fallAngleThreshold.toString()
    ]
    
    console.log(`[Server] 执行单帧检测: python ${args.join(' ')}`)
    
    const ultralyticsDir = join(__dirname, '../python/.ultralytics')
    fs.mkdirSync(ultralyticsDir, { recursive: true })
    
    // 确保settings.yaml文件存在
    const settingsFile = join(ultralyticsDir, 'settings.yaml')
    if (!fs.existsSync(settingsFile)) {
      fs.writeFileSync(settingsFile, '# Ultralytics settings\n')
    }
    
    const pythonProcess = spawn('python', args, {
      env: {
        HOME: join(__dirname, '../python'),
        ULTRALYTICS_DIR: ultralyticsDir,
        YOLO_SETTINGS: settingsFile,
        TMPDIR: ultralyticsDir
      }
    })
    
    let stdoutData = ''
    let stderrData = ''
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString()
      stdoutData += output
      console.log(`[Python] ${output.trim()}`)
    })
    
    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString()
      stderrData += error
      console.warn(`[Python] 警告/错误: ${error.trim()}`)
    })
    
    pythonProcess.on('close', (code) => {
      console.log(`[Server] 单帧检测进程结束，退出码: ${code}`)
      
      try {
        // 先尝试直接解析stdout中的JSON输出
        const stdoutLines = stdoutData.trim().split('\n')
        for (const line of stdoutLines) {
          if (line.trim().startsWith('{')) {
            try {
              const jsonResult = JSON.parse(line.trim())
              if (jsonResult.success !== undefined) {
                console.log('[Server] 从stdout解析到JSON结果:', jsonResult)
                resolve(jsonResult)
                return
              }
            } catch (e) {
              // 继续尝试下一行
            }
          }
        }
        
        // 如果stdout没有JSON，尝试读取output文件
        if (fs.existsSync(outputPath)) {
          try {
            const resultData = fs.readFileSync(outputPath, 'utf8')
            const results = JSON.parse(resultData)
            console.log('[Server] 从output文件读取结果')
            
            // 构建正确的返回格式
            resolve({
              success: true,
              has_fall: results.some(r => r.is_fall),
              person_count: results.length > 0 ? results[0].person_count : 0,
              detections: results
            })
            return
          } catch (parseError) {
            console.error(`[Server] 解析检测结果失败: ${parseError.message}`)
          }
        }
        
        // 如果以上都失败，使用模拟数据
        console.log('[Server] 使用模拟检测结果')
        resolve({
          success: true,
          has_fall: false,
          person_count: 0,
          detections: []
        })
        
      } catch (error) {
        console.error(`[Server] 检测处理失败: ${error.message}`)
        // 即使出错也返回一个默认结果，而不是reject
        resolve({
          success: true,
          has_fall: false,
          person_count: 0,
          detections: []
        })
      }
    })
    
    pythonProcess.on('error', (error) => {
      console.error(`[Server] Python进程启动失败: ${error.message}`)
      // 进程启动失败也返回模拟结果
      resolve({
        success: true,
        has_fall: false,
        person_count: 0,
        detections: []
      })
    })
  })
}

/**
 * 处理检测结果
 * @param {Array} detectionResults - Python 返回的检测结果数组
 * @returns {Array} - 事件数组
 */
function processDetectionResults(detectionResults) {
  const events = []
  if (!detectionResults || detectionResults.length === 0) {
    return events
  }
  
  console.log('处理检测结果:', JSON.stringify(detectionResults.slice(0, 3), null, 2))
  
  const fallResults = detectionResults.filter(r => r.is_fall)
  
  if (fallResults.length === 0) {
    return events
  }
  
  // 计算实际的平均帧间隔（从检测结果的时间戳差异计算）
  let frameIntervalSec = 0.5 // 默认0.5秒间隔
  if (detectionResults.length >= 2) {
    let totalDiff = 0
    let count = 0
    for (let i = 1; i < detectionResults.length; i++) {
      const prevTime = typeof detectionResults[i-1].timestamp === 'number' ? detectionResults[i-1].timestamp : 0
      const currTime = typeof detectionResults[i].timestamp === 'number' ? detectionResults[i].timestamp : 0
      if (currTime > prevTime && currTime - prevTime < 5) { // 只考虑合理的时间差
        totalDiff += currTime - prevTime
        count++
      }
    }
    if (count > 0) {
      frameIntervalSec = totalDiff / count
      console.log(`计算得到平均帧间隔: ${frameIntervalSec.toFixed(3)}秒`)
    }
  }
  
  // 对跌倒结果进行聚合（连续的跌倒算作一个事件）
  let currentFall = null
  
  for (const result of fallResults) {
    // 时间戳已经是秒格式
    const eventTimeSec = typeof result.timestamp === 'number' ? result.timestamp : 0
    
    console.log(`处理跌倒结果: 时间戳=${eventTimeSec.toFixed(3)}秒`)
    
    if (!currentFall) {
      // 开始新的跌倒事件
      currentFall = {
        type: 'fall',
        timestamp: eventTimeSec, // 保持秒格式
        cameraId: 'unknown',
        duration: frameIntervalSec, // 初始持续时间为1帧间隔
        severity: result.vertical_distance > 100 ? '严重' : '中等',
        keypoints: result.keypoints,
        frameCount: 1
      }
    } else {
      // 如果时间间隔在合理范围内（小于2秒），认为是连续的
      const timeDiff = eventTimeSec - (currentFall.timestamp + currentFall.duration)
      if (timeDiff < 2) {
        // 使用实际时间差更新持续时间，更准确
        currentFall.duration = eventTimeSec - currentFall.timestamp + frameIntervalSec
        currentFall.frameCount += 1
      } else {
        // 时间间隔太大，保存当前事件并开始新事件
        events.push(currentFall)
        currentFall = {
          type: 'fall',
          timestamp: eventTimeSec,
          cameraId: 'unknown',
          duration: frameIntervalSec,
          severity: result.vertical_distance > 100 ? '严重' : '中等',
          keypoints: result.keypoints,
          frameCount: 1
        }
      }
    }
  }
  
  // 保存最后一个事件
  if (currentFall) {
    // 限制最大持续时间不超过5秒（单个跌倒事件通常不会持续这么久）
    currentFall.duration = Math.min(currentFall.duration, 5)
    events.push(currentFall)
  }
  
  console.log('处理结果:', JSON.stringify(events, null, 2))
  
  return events
}

// Multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'webm'
    const uniqueName = `fall-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`
    cb(null, uniqueName)
  }
})

// 跌倒视频存储配置
const fallStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'webm'
    const uniqueName = `fall-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'image/png', 'image/jpeg', 'image/jpg']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式'))
    }
  }
})

const fallUpload = multer({
  storage: fallStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'image/png', 'image/jpeg', 'image/jpg']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式'))
    }
  }
})

// 跌倒检测接口（需要认证）- 视频检测
app.post('/api/detect', authenticateToken, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有文件上传' })
  }
  
  const videoPath = req.file.path
  const videoId = req.file.filename
  const outputPath = join(detectionResultsDir, `${videoId}.json`)
  
  // 获取速度模式参数
  const speed = req.body.speed || 'fast' // 默认使用快速模式
  
  // 获取前端传来的 AI 调参
  const confidence = parseFloat(req.body.confidence) || 0.3
  const shoulderHipThreshold = parseFloat(req.body.shoulderHipThreshold) || 0.25
  const minKeypointConfidence = parseFloat(req.body.minKeypointConfidence) || 0.3
  const useAngleDetection = req.body.useAngleDetection === 'true' || true
  const fallAngleThreshold = parseFloat(req.body.fallAngleThreshold) || 60
  
  console.log(`[Server] 开始跌倒检测: ${videoId}, 模式: ${speed}`)
  console.log(`[Server] AI调参: confidence=${confidence}, shoulderHipThreshold=${shoulderHipThreshold}, minKeypointConfidence=${minKeypointConfidence}, useAngleDetection=${useAngleDetection}, fallAngleThreshold=${fallAngleThreshold}`)
  
  try {
    // 调用Python脚本进行检测
    const detectionResults = await runPythonDetection(
      videoPath, 
      outputPath, 
      speed, 
      videoId,
      confidence,
      shoulderHipThreshold,
      minKeypointConfidence,
      useAngleDetection,
      fallAngleThreshold
    )
    
    // 处理检测结果
    const events = processDetectionResults(detectionResults)
    
    if (events.length > 0) {
      // 发现跌倒事件，发送告警
      events.forEach(event => {
        broadcast({
          type: event.type === 'fall' ? 'fall_detected' : 'high_risk_detected',
          videoId,
          event,
          timestamp: Date.now()
        })
      })
    }
    
    console.log(`[Server] 准备发送响应: videoId=${videoId}, events=${events.length}, detectionResults=${detectionResults.length}`)
    res.json({
      success: true,
      videoId,
      path: `/uploads/${videoId}`,
      filename: videoId,
      events,
      detectionResults
    })
    console.log(`[Server] 响应发送成功`)
    
  } catch (error) {
    console.error('[Server] Python检测失败:', error)
    res.status(500).json({
      success: false,
      error: '跌倒检测失败，请检查Python环境和模型文件',
      message: error.message
    })
  }
})

// 单帧图片检测接口（实时检测）- 使用流式检测
app.post('/api/detect-frame', authenticateToken, upload.single('image'), async (req, res) => {
  console.log('[Server] 收到detect-frame请求')
  
  if (!req.file) {
    console.error('[Server] 没有图片上传')
    return res.status(400).json({ error: '没有图片上传' })
  }
  
  const imagePath = req.file.path
  
  try {
    const imageBuffer = fs.readFileSync(imagePath)
    const imageBase64 = imageBuffer.toString('base64')
    
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('检测超时'))
      }, 15000)

      sendToDetectionProcess(imageBase64, (error, data) => {
        clearTimeout(timeout)
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    })
    
    console.log(`[Server] 流式检测结果:`, result)
    
    if (!result || !result.success) {
      return res.status(500).json({
        success: false,
        error: result?.error || '检测失败'
      })
    }
    
    const events = []
    let newEventId = null
    if (result.has_fall) {
      events.push({
        type: 'fall',
        timestamp: Date.now() / 1000,
        cameraId: 'unknown',
        severity: '严重',
        person_count: result.person_count
      })
      
      broadcast({
        type: 'fall_detected',
        event: events[0],
        timestamp: Date.now()
      })
      
      try {
        const createdEvent = await addEvent({
          id: `fall-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
          type: 'fall',
          severity: '严重',
          cameraId: 'unknown',
          duration: 1,
          timestamp: Date.now(),
          status: 'active',
          createdAt: Date.now()
        })
        newEventId = createdEvent?.id || null
      } catch (dbError) {
        console.error('[Server] 创建跌倒事件到数据库失败:', dbError)
      }
    } else if (result.person_count > 0) {
      const hasHighRisk = result.detections && result.detections.some(d =>
        d.vertical_distance && d.vertical_distance < 150
      )
      if (hasHighRisk) {
        events.push({
          type: 'high_risk',
          timestamp: Date.now() / 1000,
          cameraId: 'unknown',
          severity: '中等',
          person_count: result.person_count
        })
        
        broadcast({
          type: 'high_risk_detected',
          event: events[0],
          timestamp: Date.now()
        })
      }
    }
    
    // 检测弯腰和身体倾斜事件（独立于跌倒检测，不冲突）
    if (!result.has_fall && result.person_count > 0 && result.detections) {
      for (const detection of result.detections) {
        if (!detection.is_fall && detection.body_angle !== null && detection.body_angle !== undefined) {
          if (detection.body_angle >= 30 && detection.body_angle < 50) {
            events.push({
              type: 'bend',
              timestamp: Date.now() / 1000,
              cameraId: 'unknown',
              severity: '中等',
              person_count: result.person_count
            })
            
            broadcast({
              type: 'bend_detected',
              event: events[events.length - 1],
              timestamp: Date.now()
            })
            
            const now = Date.now()
            if (now - lastBendDbTime >= BEND_TILT_DB_COOLDOWN) {
              lastBendDbTime = now
              try {
                await addEvent({
                  id: `bend-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
                  type: 'bend',
                  severity: '中等',
                  cameraId: 'unknown',
                  duration: 1,
                  timestamp: Date.now(),
                  status: 'active',
                  createdAt: Date.now()
                })
              } catch (dbError) {
                console.error('[Server] 创建弯腰事件到数据库失败:', dbError)
              }
            }
          }
        }
        
        if (!detection.is_fall && detection.keypoints) {
          const leftShoulder = detection.keypoints.find((kp) => kp.index === 5)
          const rightShoulder = detection.keypoints.find((kp) => kp.index === 6)
          if (leftShoulder && rightShoulder && leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
            const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y)
            if (shoulderDiff > 20) {
              events.push({
                type: 'tilt',
                timestamp: Date.now() / 1000,
                cameraId: 'unknown',
                severity: '中等',
                person_count: result.person_count
              })
              
              broadcast({
                type: 'tilt_detected',
                event: events[events.length - 1],
                timestamp: Date.now()
              })
              
              const now = Date.now()
              if (now - lastTiltDbTime >= BEND_TILT_DB_COOLDOWN) {
                lastTiltDbTime = now
                try {
                  await addEvent({
                    id: `tilt-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
                    type: 'tilt',
                    severity: '中等',
                    cameraId: 'unknown',
                    duration: 1,
                    timestamp: Date.now(),
                    status: 'active',
                    createdAt: Date.now()
                  })
                } catch (dbError) {
                  console.error('[Server] 创建倾斜事件到数据库失败:', dbError)
                }
              }
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      hasFall: result.has_fall,
      personCount: result.person_count,
      events,
      eventId: newEventId,
      detections: result.detections
    })
    
  } catch (error) {
    console.error('[Server] 单帧检测失败:', error)
    res.status(500).json({
      success: false,
      error: '单帧检测失败',
      message: error.message
    })
  } finally {
    setTimeout(() => {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }, 1000)
  }
})

// 截图分析接口
app.post('/api/detect-snapshot', authenticateToken, upload.single('image'), async (req, res) => {
  console.log('[Server] 收到detect-snapshot请求')
  
  if (!req.file) {
    console.error('[Server] 没有图片上传')
    return res.status(400).json({ error: '没有图片上传' })
  }
  
  const imagePath = req.file.path
  const imageId = req.file.filename
  const outputPath = join(detectionResultsDir, `${imageId}.json`)
  
  console.log(`[Server] 文件已保存: ${imagePath}`)
  
  try {
    const detectionResult = await runPythonFrameDetection(
      imagePath, 
      outputPath, 
      0.3, 
      5,
      null,
      0.3,
      true,
      60
    )
    
    console.log(`[Server] 截图分析完成:`, detectionResult)
    
    if (!detectionResult.success) {
      return res.status(500).json({
        success: false,
        error: detectionResult.error || '检测失败'
      })
    }
    
    let detection = '正常姿态'
    let risk = '低'
    let confidence = 95
    let recommendation = '未检测到异常，患者状态良好'
    
    if (detectionResult.has_fall) {
      detection = '跌倒'
      risk = '高'
      confidence = 98
      recommendation = '检测到跌倒事件，请立即前往查看患者状况'
    } else if (detectionResult.person_count > 0) {
      const hasHighRisk = detectionResult.detections.some(d =>
        d.distance_ratio && d.distance_ratio < 0.35
      )
      if (hasHighRisk) {
        detection = '高风险姿态'
        risk = '中'
        confidence = 85
        recommendation = '检测到高风险姿态，建议关注患者状态'
      }
    } else {
      detection = '未检测到人'
      risk = '低'
      confidence = 90
      recommendation = '画面中未检测到人员'
    }
    
    res.json({
      success: true,
      result: {
        detection,
        risk,
        confidence,
        recommendation,
        personCount: detectionResult.person_count,
        hasFall: detectionResult.has_fall
      }
    })
    
  } catch (error) {
    console.error('[Server] 截图分析失败:', error)
    res.status(500).json({
      success: false,
      error: '截图分析失败',
      message: error.message
    })
  } finally {
    setTimeout(() => {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }, 5000)
  }
})

// 视频上传接口（需要认证）- 已更新为使用Python检测
app.post('/api/upload', authenticateToken, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有文件上传' })
  }
  
  const videoPath = req.file.path
  const videoId = req.file.filename
  const outputPath = join(detectionResultsDir, `${videoId}.json`)
  
  // 获取AI调参
  const confidence = parseFloat(req.body.confidence) || 0.3
  const sensitivity = parseFloat(req.body.sensitivity) || 5
  const shoulderHipThreshold = parseFloat(req.body.shoulderHipThreshold) || 0.2
  const minKeypointConfidence = parseFloat(req.body.minKeypointConfidence) || 0.3
  const useAngleDetection = req.body.useAngleDetection === 'true' || true
  const fallAngleThreshold = parseFloat(req.body.fallAngleThreshold) || 60
  
  console.log(`[Server] 视频上传成功: ${videoId}, 参数: confidence=${confidence}, sensitivity=${sensitivity}`)
  
  // 立即开始 YOLO 检测
  broadcast({
    type: 'analysis_started',
    videoId,
    message: '视频上传成功，开始分析...',
    timestamp: Date.now()
  })
  
  try {
    // 调用Python脚本进行检测（传递AI调参）
    const detectionResults = await runPythonDetection(
      videoPath, 
      outputPath, 
      'normal', 
      videoId,
      confidence,
      shoulderHipThreshold,
      minKeypointConfidence,
      useAngleDetection,
      fallAngleThreshold
    )
    
    // 处理检测结果
    const events = processDetectionResults(detectionResults)
    
    if (events.length > 0) {
      // 发现跌倒事件，发送告警
      events.forEach(event => {
        broadcast({
          type: event.type === 'fall' ? 'fall_detected' : 'high_risk_detected',
          videoId,
          event,
          timestamp: Date.now()
        })
      })
    }
    
    console.log(`[Server] 准备发送响应: videoId=${videoId}, events=${events.length}, detectionResults=${detectionResults.length}`)
    res.json({
      success: true,
      videoId,
      path: `/uploads/${videoId}`,
      filename: videoId,
      events,
      detectionResults
    })
    console.log(`[Server] 响应发送成功`)
    
  } catch (error) {
    console.error('[Server] Python检测失败:', error)
    res.json({
      success: true,
      videoId,
      path: `/uploads/${videoId}`,
      filename: videoId,
      events: [],
      error: '视频分析失败，请检查Python环境'
    })
  }
})

// 跌倒视频上传接口（需要认证）
app.post('/api/upload-fall', authenticateToken, fallUpload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有文件上传' })
  }
  
  const videoPath = req.file.path
  const videoName = req.file.filename
  const videoUrl = `http://localhost:${PORT}/uploads/${videoName}`
  
  // 获取其他参数
  const eventType = req.body.eventType || 'fall'
  const cameraId = req.body.cameraId || 'unknown'
  const timestamp = req.body.timestamp || Date.now()
  
  console.log(`[Server] 跌倒视频上传成功: ${videoName}`)
  console.log(`[Server] 事件类型: ${eventType}, 摄像头: ${cameraId}, 时间: ${timestamp}`)
  
  // 发送 WebSocket 通知
  broadcast({
    type: 'fall_video_uploaded',
    videoUrl,
    eventType,
    cameraId,
    timestamp: Date.now()
  })
  
  res.json({
    success: true,
    videoUrl,
    videoName,
    eventType,
    cameraId,
    timestamp
  })
})

// 获取视频列表（需要认证）
app.get('/api/videos', authenticateToken, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: '无法读取视频目录' })
    }
    
    const videos = files
      .filter(file => /\.(webm|mp4|mov|avi)$/i.test(file))
      .map(file => ({
        name: file,
        filename: file,
        path: `/uploads/${file}`,
        url: `http://localhost:${PORT}/uploads/${file}`,
        size: fs.statSync(join(uploadsDir, file)).size,
        createdAt: fs.statSync(join(uploadsDir, file)).mtime
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    res.json(videos)
  })
})

// 获取跌倒视频列表（需要认证）
app.get('/api/fall-videos', authenticateToken, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: '无法读取视频目录' })
    }
    
    const videos = files
      .filter(file => /\.(webm|mp4|mov|avi)$/i.test(file))
      .map(file => ({
        name: file,
        filename: file,
        path: `/uploads/${file}`,
        url: `http://localhost:${PORT}/uploads/${file}`,
        size: fs.statSync(join(uploadsDir, file)).size,
        createdAt: fs.statSync(join(uploadsDir, file)).mtime
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    res.json(videos)
  })
})



// 删除视频（需要认证）
app.delete('/api/videos/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename
  const filePath = join(uploadsDir, filename)
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    res.json({ success: true, message: '视频已删除' })
  } else {
    res.status(404).json({ error: '视频不存在' })
  }
})

// 删除跌倒视频（需要认证）
app.delete('/api/fall-videos/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename
  const filePath = join(fallsVideosDir, filename)
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    res.json({ success: true, message: '视频已删除' })
  } else {
    res.status(404).json({ error: '视频不存在' })
  }
})

// 患者管理 API

app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const { search, room, condition } = req.query
    const patients = await fetchPatients(search, room, condition)
    res.json({
      success: true,
      patients,
      total: patients.length
    })
  } catch (error) {
    console.error('[API] 获取患者列表失败:', error)
    res.status(500).json({ error: '获取患者列表失败' })
  }
})

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const patient = await fetchPatientById(req.params.id)
    if (!patient) {
      return res.status(404).json({ error: '患者不存在' })
    }
    res.json({ success: true, patient })
  } catch (error) {
    console.error('[API] 获取患者详情失败:', error)
    res.status(500).json({ error: '获取患者详情失败' })
  }
})

app.post('/api/patients', authenticateToken, async (req, res) => {
  try {
    let patientData = req.body
    const { name, age, gender, roomNumber, bedNumber, admissionDate } = patientData
    
    if (!name || !age || !gender || !roomNumber || !bedNumber) {
      return res.status(400).json({ error: '请填写必要信息' })
    }
    
    // 如果没有ID,生成一个新ID
    if (!patientData.id) {
      const patients = await fetchPatients()
      const maxId = Math.max(...patients.map(p => parseInt(p.id.slice(1)) || 0), 0)
      patientData.id = `P${String(maxId + 1).padStart(3, '0')}`
    }
    
    if (!patientData.createdAt) {
      patientData.createdAt = Date.now()
    }
    
    const newPatient = await addPatient(patientData)
    res.json({ success: true, patient: newPatient })
  } catch (error) {
    console.error('[API] 创建患者失败:', error)
    res.status(500).json({ error: '创建患者失败' })
  }
})

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const patient = await modifyPatient(req.params.id, req.body)
    if (!patient) {
      return res.status(404).json({ error: '患者不存在' })
    }
    res.json({ success: true, patient })
  } catch (error) {
    console.error('[API] 更新患者失败:', error)
    res.status(500).json({ error: '更新患者失败' })
  }
})

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await removePatient(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: '患者不存在' })
    }
    res.json({ success: true, message: '患者已删除' })
  } catch (error) {
    console.error('[API] 删除患者失败:', error)
    res.status(500).json({ error: '删除患者失败' })
  }
})

// 事件管理 API

app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const { start, end, camera, type, patientId } = req.query
    const events = await fetchEvents(start, end, camera, type, patientId)
    res.json({
      success: true,
      events,
      total: events.length
    })
  } catch (error) {
    console.error('[API] 获取事件列表失败:', error)
    res.status(500).json({ error: '获取事件列表失败' })
  }
})

app.get('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = useMysql 
      ? await getEventById(req.params.id)
      : (getDb().data.events || []).find(e => e.id === req.params.id)
    
    if (!event) {
      return res.status(404).json({ error: '事件不存在' })
    }
    res.json({ success: true, event })
  } catch (error) {
    console.error('[API] 获取事件详情失败:', error)
    res.status(500).json({ error: '获取事件详情失败' })
  }
})

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const { type, severity, cameraId, patientId, videoUrl, duration } = req.body
    
    if (!type || !severity || !cameraId) {
      return res.status(400).json({ error: '请填写必要信息' })
    }
    
    const newEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      cameraId,
      patientId: patientId || null,
      videoUrl: videoUrl || null,
      duration: duration || 1,
      timestamp: Date.now(),
      status: 'active',
      createdAt: Date.now()
    }
    
    const createdEvent = await addEvent(newEvent)
    
    broadcast({
      type: `${type}_detected`,
      event: createdEvent,
      timestamp: Date.now()
    })
    
    res.json({ success: true, event: createdEvent })
  } catch (error) {
    console.error('[API] 创建事件失败:', error)
    res.status(500).json({ error: '创建事件失败' })
  }
})

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await modifyEvent(req.params.id, req.body)
    if (!event) {
      return res.status(404).json({ error: '事件不存在' })
    }
    
    if (req.body.videoUrl) {
      broadcast({
        type: 'event_updated',
        eventId: req.params.id,
        videoUrl: req.body.videoUrl,
        timestamp: Date.now()
      })
    }
    
    res.json({ success: true, event })
  } catch (error) {
    console.error('[API] 更新事件失败:', error)
    res.status(500).json({ error: '更新事件失败' })
  }
})

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await removeEvent(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: '事件不存在' })
    }
    res.json({ success: true, message: '事件已删除' })
  } catch (error) {
    console.error('[API] 删除事件失败:', error)
    res.status(500).json({ error: '删除事件失败' })
  }
})

// 日志查询 API

app.get('/api/logs', authenticateToken, (req, res) => {
  const { limit = 100, level } = req.query
  try {
    const logs = getServerLogs(parseInt(limit), level)
    res.json({
      success: true,
      logs,
      total: logs.length
    })
  } catch (error) {
    logError('获取日志失败', error)
    res.status(500).json({ error: '获取日志失败' })
  }
})

app.get('/api/logs/files', authenticateToken, (req, res) => {
  try {
    const files = getLogFiles()
    res.json({
      success: true,
      files
    })
  } catch (error) {
    logError('获取日志文件列表失败', error)
    res.status(500).json({ error: '获取日志文件列表失败' })
  }
})

// 分析历史接口
app.get('/api/analysis-history', authenticateToken, (req, res) => {
  try {
    const history = []
    
    fs.readdir(detectionResultsDir, (err, files) => {
      if (err) {
        console.error('[Server] 读取检测结果目录失败:', err)
        return res.status(500).json({ error: '读取分析历史失败' })
      }
      
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      
      jsonFiles.forEach(file => {
        try {
          const filePath = join(detectionResultsDir, file)
          const content = fs.readFileSync(filePath, 'utf8')
          const results = JSON.parse(content)
          
          if (Array.isArray(results)) {
            const fallCount = results.filter(r => r.is_fall).length
            const abnormalCount = results.filter(r => r.distance_ratio < 0.35 || r.body_angle > 45).length
            
            const stats = fs.statSync(filePath)
            const createdAt = stats.mtime
            
            const videoName = file.replace('.json', '')
            const riskLevel = fallCount >= 2 ? '高' : (fallCount === 1 ? '中' : '低')
            const riskLevelClass = fallCount >= 2 ? 'high' : (fallCount === 1 ? 'medium' : 'low')
            
            history.push({
              id: file,
              videoName: videoName,
              analysisTime: createdAt.toLocaleString('zh-CN'),
              fallCount,
              abnormalCount,
              riskLevel,
              riskLevelClass,
              report: `检测到${fallCount}次跌倒事件，${abnormalCount}次异常行为`
            })
          }
        } catch (e) {
          console.error('[Server] 解析检测结果文件失败:', file, e)
        }
      })
      
      history.sort((a, b) => new Date(b.analysisTime) - new Date(a.analysisTime))
      
      res.json({
        success: true,
        history: history.slice(0, 20)
      })
    })
  } catch (error) {
    console.error('[Server] 获取分析历史失败:', error)
    res.status(500).json({ error: '获取分析历史失败' })
  }
})

// 静态文件服务（带 CORS 头和正确的 MIME 类型）
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  const ext = req.path.split('.').pop()?.toLowerCase()
  const mimeMap = {
    webm: 'video/webm',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png'
  }
  if (ext && mimeMap[ext]) {
    res.setHeader('Content-Type', mimeMap[ext])
  }
  next()
}, express.static(uploadsDir))

app.use('/falls_videos', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  const ext = req.path.split('.').pop()?.toLowerCase()
  const mimeMap = {
    webm: 'video/webm',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo'
  }
  if (ext && mimeMap[ext]) {
    res.setHeader('Content-Type', mimeMap[ext])
  }
  next()
}, express.static(fallsVideosDir))

// 生产模式：提供前端静态资源（SPA模式）
const distDir = join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/falls_videos')) {
      return next()
    }
    res.sendFile(join(distDir, 'index.html'))
  })
  console.log(`[Server] 前端静态资源已加载: ${distDir}`)
}

// WebSocket 健康检查
app.get('/api/ws-status', (req, res) => {
  res.json({
    status: 'running',
    clients: clients.size
  })
})

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 全局错误处理中间件
app.use((err, req, res, next) => {
  logError('HTTP错误', err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  })
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: '数据验证失败',
      details: err.message
    })
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: '认证失败',
      details: err.message
    })
  }
  
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)))
})

// 捕获未捕获的异常
process.on('uncaughtException', (err) => {
  logError('Uncaught Exception', err)
  process.exit(1)
})

// 辅助函数：根据数据库类型获取患者数据
async function fetchPatients(search, room, condition) {
  if (useMysql) {
    return await getAllPatients(search, room, condition);
  } else {
    const db = getDb();
    let patients = db.data.patients || [];
    
    if (search) {
      patients = patients.filter(p => 
        p.name.includes(search) || 
        p.id.includes(search) || 
        p.room.includes(search)
      );
    }
    
    if (room) {
      patients = patients.filter(p => p.room === room);
    }
    
    if (condition) {
      patients = patients.filter(p => p.condition === condition);
    }
    
    return patients.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// 辅助函数：根据数据库类型获取单个患者
async function fetchPatientById(id) {
  if (useMysql) {
    return await getPatientById(id);
  } else {
    const db = getDb();
    return (db.data.patients || []).find(p => p.id === id);
  }
}

// 辅助函数：根据数据库类型创建患者
async function addPatient(patientData) {
  if (useMysql) {
    return await createPatient(patientData);
  } else {
    const db = getDb();
    if (!db.data.patients) db.data.patients = [];
    db.data.patients.push(patientData);
    await saveDb();
    return patientData;
  }
}

// 辅助函数：根据数据库类型更新患者
async function modifyPatient(id, updates) {
  if (useMysql) {
    return await updatePatient(id, updates);
  } else {
    const db = getDb();
    const index = (db.data.patients || []).findIndex(p => p.id === id);
    if (index === -1) return null;
    
    const patient = db.data.patients[index];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt') {
        patient[key] = updates[key];
      }
    });
    await saveDb();
    return patient;
  }
}

// 辅助函数：根据数据库类型删除患者
async function removePatient(id) {
  if (useMysql) {
    return await deletePatient(id);
  } else {
    const db = getDb();
    const initialLength = (db.data.patients || []).length;
    db.data.patients = (db.data.patients || []).filter(p => p.id !== id);
    await saveDb();
    return db.data.patients.length < initialLength;
  }
}

// 辅助函数：根据数据库类型获取事件
async function fetchEvents(start, end, camera, type, patientId) {
  if (useMysql) {
    return await getAllEvents(start, end, camera, type, patientId);
  } else {
    const db = getDb();
    let events = db.data.events || [];
    
    if (start) {
      const startDate = new Date(start).getTime();
      events = events.filter(e => e.timestamp >= startDate);
    }
    
    if (end) {
      const endDate = new Date(end).getTime() + 24 * 60 * 60 * 1000;
      events = events.filter(e => e.timestamp <= endDate);
    }
    
    if (camera) {
      events = events.filter(e => e.cameraId === camera);
    }
    
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      events = events.filter(e => types.includes(e.type));
    }
    
    if (patientId) {
      events = events.filter(e => e.patientId === patientId);
    }
    
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// 辅助函数：根据数据库类型创建事件
async function addEvent(eventData) {
  if (useMysql) {
    return await createEvent(eventData);
  } else {
    const db = getDb();
    if (!db.data.events) db.data.events = [];
    db.data.events.push(eventData);
    await saveDb();
    return eventData;
  }
}

// 辅助函数：根据数据库类型更新事件
async function modifyEvent(id, updates) {
  if (useMysql) {
    return await updateEvent(id, updates);
  } else {
    const db = getDb();
    const index = (db.data.events || []).findIndex(e => e.id === id);
    if (index === -1) return null;
    
    const event = db.data.events[index];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'timestamp') {
        event[key] = updates[key];
      }
    });
    await saveDb();
    return event;
  }
}

// 辅助函数：根据数据库类型删除事件
async function removeEvent(id) {
  if (useMysql) {
    return await deleteEvent(id);
  } else {
    const db = getDb();
    const initialLength = (db.data.events || []).length;
    db.data.events = (db.data.events || []).filter(e => e.id !== id);
    await saveDb();
    return db.data.events.length < initialLength;
  }
}

// 启动服务器
async function startServer() {
  try {
    console.log('[Server] 开始启动服务器...');
    
    // 初始化数据库
    if (useMysql) {
      console.log('[Server] 正在连接MySQL数据库...');
      const mysqlConnected = await initMysqlDb();
      if (!mysqlConnected) {
        console.error('[Server] MySQL数据库连接失败,请检查配置!');
        return;
      }
      console.log('[Server] MySQL数据库连接成功');
      await seedMysqlUsers();
    } else {
      console.log('[Server] 初始化JSON数据库...');
    }
    await initDb();
    if (!useMysql) {
      await seedUsers();
    }
    
    console.log(`[Server] 准备监听端口 ${PORT}...`);
    
    httpServer.listen(PORT, () => {
      logInfo('服务器启动成功', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        uploadsDir,
        fallsVideosDir,
        dbType: useMysql ? 'MySQL' : 'JSON'
      });
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`WebSocket 运行在 ws://localhost:${PORT}`);
      console.log(`视频存储目录: ${uploadsDir}`);
      console.log(`跌倒视频目录: ${fallsVideosDir}`);
      console.log(`数据库类型: ${useMysql ? 'MySQL' : 'JSON'}`);
      
      startDetectionProcess();

      // 启动 MQTT 代理（供香橙派连接报警）
      startMqttBroker(broadcast).catch(e => console.error('[MQTT] 启动错误:', e.message));
    });
    
    httpServer.on('error', (error) => {
      console.error('[Server] 服务器启动失败:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('[Server] 启动服务器时发生错误:', error);
    process.exit(1);
  }
}

startServer();

export { broadcast, wss, clients }