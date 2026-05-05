import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface User {
  id: number
  username: string
  role: 'admin' | 'nurse'
  name: string
}

// 简单的 JWT 过期检查
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    
    const payload = JSON.parse(atob(parts[1]))
    if (!payload.exp) return false
    
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

export const useAuthStore = defineStore('auth', () => {
  // 初始化时检查 token 是否过期
  const storedToken = localStorage.getItem('auth_token')
  const initialToken = storedToken && !isTokenExpired(storedToken) ? storedToken : null
  
  // 如果 token 过期，清除所有认证信息
  if (!initialToken && storedToken) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }
  
  const token = ref<string | null>(initialToken)
  const user = ref<User | null>(initialToken ? JSON.parse(localStorage.getItem('auth_user') || 'null') : null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isNurse = computed(() => user.value?.role === 'nurse')
  const userName = computed(() => user.value?.name || user.value?.username || '')

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '登录失败')
      }

      const data = await response.json()

      if (data.success && data.token) {
        token.value = data.token
        user.value = data.user
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_user', JSON.stringify(data.user))
        return true
      }

      return false
    } catch (error) {
      console.error('登录错误:', error)
      throw error
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  function getAuthHeaders(): Record<string, string> {
    if (token.value) {
      return {
        'Authorization': `Bearer ${token.value}`
      }
    }
    return {}
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isNurse,
    userName,
    login,
    logout,
    getAuthHeaders
  }
})
