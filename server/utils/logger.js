import winston from 'winston'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const logsDir = join(__dirname, '../logs')

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'patient-fall-detection' },
  transports: [
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10
    })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

export default logger

export function logInfo(message, meta = {}) {
  logger.info(message, { ...meta, timestamp: new Date().toISOString() })
}

export function logError(message, error = null, meta = {}) {
  logger.error(message, {
    ...meta,
    error: error?.message || error,
    stack: error?.stack,
    timestamp: new Date().toISOString()
  })
}

export function logWarn(message, meta = {}) {
  logger.warn(message, { ...meta, timestamp: new Date().toISOString() })
}

export function logDebug(message, meta = {}) {
  logger.debug(message, { ...meta, timestamp: new Date().toISOString() })
}