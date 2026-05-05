import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const logsDir = join(__dirname, '../logs')

export function getServerLogs(limit = 100, level = null) {
  const combinedLogPath = join(logsDir, 'combined.log')
  const errorLogPath = join(logsDir, 'error.log')
  
  const logs = []
  
  const readLogFile = (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        const lines = content.split('\n').filter(line => line.trim())
        return lines.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return {
              message: line,
              timestamp: new Date().toISOString(),
              level: 'info'
            }
          }
        })
      }
    } catch (error) {
      console.error('读取日志文件失败:', error)
    }
    return []
  }
  
  if (level === 'error') {
    logs.push(...readLogFile(errorLogPath))
  } else {
    logs.push(...readLogFile(combinedLogPath))
    if (level === 'error') {
      logs.push(...readLogFile(errorLogPath))
    }
  }
  
  logs.sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime()
    const timeB = new Date(b.timestamp || 0).getTime()
    return timeB - timeA
  })
  
  return logs.slice(0, limit)
}

export function getLogFiles() {
  const logFiles = []
  
  try {
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir)
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = join(logsDir, file)
          const stats = fs.statSync(filePath)
          logFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            modifiedAt: stats.mtime
          })
        }
      }
    }
  } catch (error) {
    console.error('获取日志文件列表失败:', error)
  }
  
  return logFiles
}