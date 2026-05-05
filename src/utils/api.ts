import { useAuthStore } from '../stores/auth'

const API_BASE = 'http://localhost:3000'

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const authStore = useAuthStore()

  const { params, ...fetchOptions } = options

  let url = `${API_BASE}${endpoint}`

  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authStore.getAuthHeaders(),
    ...(options.headers as Record<string, string>)
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers
  } as RequestInit)

  if (response.status === 401 || response.status === 403) {
    authStore.logout()
    window.location.href = '/login'
    throw new Error('认证失败，请重新登录')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new Error(error.error || `请求失败: ${response.status}`)
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'POST', body }),

  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PUT', body }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' })
}

export async function uploadVideo(file: File): Promise<{ videoId: string; path: string; events: unknown[] }> {
  const authStore = useAuthStore()

  const formData = new FormData()
  formData.append('video', file)

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authStore.token}`
    },
    body: formData
  })

  if (response.status === 401 || response.status === 403) {
    authStore.logout()
    window.location.href = '/login'
    throw new Error('认证失败，请重新登录')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '上传失败' }))
    throw new Error(error.error || '上传失败')
  }

  return response.json()
}

export async function uploadFallVideo(
  file: Blob,
  eventType: string,
  cameraId: string,
  onProgress?: (progress: number) => void
): Promise<{ videoUrl: string; videoName: string }> {
  const authStore = useAuthStore()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status === 401 || xhr.status === 403) {
        authStore.logout()
        window.location.href = '/login'
        reject(new Error('认证失败，请重新登录'))
        return
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('解析响应失败'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.error || '上传失败'))
        } catch {
          reject(new Error('上传失败'))
        }
      }
    }

    xhr.onerror = () => reject(new Error('网络错误'))

    xhr.open('POST', `${API_BASE}/api/upload-fall`)
    xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`)

    const formData = new FormData()
    formData.append('video', file, 'fall.webm')
    formData.append('eventType', eventType)
    formData.append('cameraId', cameraId)
    formData.append('timestamp', Date.now().toString())

    xhr.send(formData)
  })
}

export default api
