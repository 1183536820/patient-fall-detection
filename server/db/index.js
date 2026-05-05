import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '../data')

const defaultData = {
  patients: [
    { id: 'P001', name: '张三', age: 75, gender: '男', room: '301', bed: 'A', condition: '稳定', avatar: null, createdAt: Date.now() },
    { id: 'P002', name: '李四', age: 82, gender: '女', room: '301', bed: 'B', condition: '需观察', avatar: null, createdAt: Date.now() },
    { id: 'P003', name: '王五', age: 68, gender: '男', room: '302', bed: 'A', condition: '稳定', avatar: null, createdAt: Date.now() },
    { id: 'P004', name: '赵六', age: 91, gender: '女', room: '302', bed: 'B', condition: '重点关注', avatar: null, createdAt: Date.now() }
  ],
  events: [],
  logs: [],
  users: []
}

const adapter = new JSONFile(join(dbPath, 'db.json'))
const db = new Low(adapter, defaultData)

export async function initDb() {
  await db.read()
  if (!db.data.patients) db.data.patients = defaultData.patients
  if (!db.data.events) db.data.events = []
  if (!db.data.logs) db.data.logs = []
  if (!db.data.users) db.data.users = []
  await db.write()
}

export function getDb() {
  return db
}

export async function saveDb() {
  await db.write()
}