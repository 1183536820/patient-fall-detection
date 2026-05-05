<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const apiKey = ref('')
const showApiKey = ref(false)
const isLoading = ref(false)
const isTesting = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | ''>('')
const testResult = ref('')
const isTestSuccess = ref(false)

const maskedKey = ref('')
const isConfigured = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isChangingPwd = ref(false)
const pwdMessage = ref('')
const pwdMessageType = ref<'success' | 'error' | ''>('')

onMounted(async () => {
  await loadStatus()
})

async function loadStatus() {
  try {
    const response = await fetch('/api/settings/api-key-status', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      isConfigured.value = data.configured
      maskedKey.value = data.maskedKey || ''
    }
  } catch (error) {
    console.error('获取状态失败:', error)
  }
}

async function saveApiKey() {
  if (!apiKey.value.trim()) {
    statusMessage.value = '请输入 API Key'
    statusType.value = 'error'
    return
  }

  isLoading.value = true
  statusMessage.value = ''
  statusType.value = ''

  try {
    const response = await fetch('/api/settings/api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ apiKey: apiKey.value })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      statusMessage.value = 'API Key 保存成功！'
      statusType.value = 'success'
      apiKey.value = ''
      await loadStatus()
    } else {
      statusMessage.value = data.error || '保存失败'
      statusType.value = 'error'
    }
  } catch (error) {
    statusMessage.value = '保存失败，请检查网络连接'
    statusType.value = 'error'
    console.error('保存 API Key 失败:', error)
  } finally {
    isLoading.value = false
  }
}

async function testConnection() {
  if (!apiKey.value.trim()) {
    testResult.value = '请先输入 API Key'
    isTestSuccess.value = false
    return
  }

  isTesting.value = true
  testResult.value = '正在测试连接...'
  isTestSuccess.value = false

  try {
    const response = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '你好，请回复"测试成功"' }
        ]
      })
    })

    if (response.ok) {
      const data = await response.json()
      if (data.choices && data.choices[0]?.message?.content) {
        testResult.value = `连接成功！DeepSeek 回复: ${data.choices[0].message.content}`
        isTestSuccess.value = true
      } else {
        testResult.value = '连接成功，但响应格式异常'
        isTestSuccess.value = true
      }
    } else {
      const data = await response.json()
      testResult.value = data.error || '测试失败'
      isTestSuccess.value = false
    }
  } catch (error) {
    testResult.value = '测试失败，请检查网络连接'
    isTestSuccess.value = false
    console.error('测试连接失败:', error)
  } finally {
    isTesting.value = false
  }
}

async function changeUserPassword() {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    pwdMessage.value = '请填写所有密码字段'
    pwdMessageType.value = 'error'
    return
  }
  if (newPassword.value.length < 6) {
    pwdMessage.value = '新密码长度不能少于6位'
    pwdMessageType.value = 'error'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    pwdMessage.value = '两次输入的新密码不一致'
    pwdMessageType.value = 'error'
    return
  }
  isChangingPwd.value = true
  pwdMessage.value = ''
  try {
    const response = await fetch('/api/users/password/change', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    })
    const data = await response.json()
    if (response.ok && data.success) {
      pwdMessage.value = '密码修改成功！'
      pwdMessageType.value = 'success'
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } else {
      pwdMessage.value = data.error || '修改失败'
      pwdMessageType.value = 'error'
    }
  } catch (error) {
    pwdMessage.value = '修改失败，请检查网络连接'
    pwdMessageType.value = 'error'
  } finally {
    isChangingPwd.value = false
  }
}
</script>

<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1>⚙️ 系统设置</h1>
      <p class="subtitle">配置系统参数和第三方服务</p>
    </div>

    <div class="settings-content">
      <div class="settings-section" v-if="authStore.isAdmin">
        <div class="section-header">
          <h2>🤖 DeepSeek API 配置</h2>
          <p class="section-desc">配置 DeepSeek API Key 以启用医疗问答功能</p>
        </div>

        <div class="settings-card">
          <div class="status-indicator">
            <span class="status-label">当前状态:</span>
            <span v-if="isConfigured" class="status-badge success">
              ✅ 已配置 ({{ maskedKey }})
            </span>
            <span v-else class="status-badge error">
              ❌ 未配置
            </span>
          </div>

          <div class="form-group">
            <label for="apiKey">DeepSeek API Key</label>
            <div class="input-wrapper">
              <input
                id="apiKey"
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="请输入您的 DeepSeek API Key"
                class="api-key-input"
              />
              <button
                type="button"
                class="toggle-visibility"
                @click="showApiKey = !showApiKey"
              >
                {{ showApiKey ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <div v-if="statusMessage" :class="['message', statusType]">
            {{ statusMessage }}
          </div>

          <div class="button-group">
            <button
              class="btn primary"
              @click="saveApiKey"
              :disabled="isLoading"
            >
              {{ isLoading ? '保存中...' : '💾 保存' }}
            </button>
            <button
              class="btn secondary"
              @click="testConnection"
              :disabled="isTesting || !apiKey.trim()"
            >
              {{ isTesting ? '测试中...' : '🔗 测试连接' }}
            </button>
          </div>

          <div v-if="testResult" :class="['test-result', isTestSuccess ? 'success' : 'error']">
            {{ testResult }}
          </div>
        </div>

        <div class="info-card">
          <h3>📖 如何获取 DeepSeek API Key?</h3>
          <ol>
            <li>访问 <a href="https://platform.deepseek.com/" target="_blank">DeepSeek 开放平台</a></li>
            <li>注册并登录您的账户</li>
            <li>在"API Keys"页面创建新的 API Key</li>
            <li>复制生成的 Key 并粘贴到上方输入框</li>
          </ol>
          <p class="note">⚠️ 请妥善保管您的 API Key，不要泄露给他人</p>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-header">
          <h2>🔑 修改密码</h2>
          <p class="section-desc">定期更换密码可以提高账号安全性</p>
        </div>

        <div class="settings-card">
          <div class="form-group">
            <label for="currentPassword">当前密码</label>
            <input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              placeholder="请输入当前密码"
              class="api-key-input"
            />
          </div>
          <div class="form-group">
            <label for="newPassword">新密码</label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              placeholder="请输入新密码（至少6位）"
              class="api-key-input"
            />
          </div>
          <div class="form-group">
            <label for="confirmPassword">确认新密码</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              class="api-key-input"
            />
          </div>

          <div v-if="pwdMessage" :class="['message', pwdMessageType]">
            {{ pwdMessage }}
          </div>

          <div class="button-group">
            <button
              class="btn primary"
              @click="changeUserPassword"
              :disabled="isChangingPwd"
            >
              {{ isChangingPwd ? '修改中...' : '🔑 修改密码' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 2rem;
}

.settings-header h1 {
  font-size: 2rem;
  color: var(--text-primary, #1a1a2e);
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--text-secondary, #666);
  font-size: 1rem;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-header {
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.25rem;
  color: var(--text-primary, #1a1a2e);
  margin-bottom: 0.5rem;
}

.section-desc {
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
}

.settings-card {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 1.5rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background: var(--card-bg, #fff);
  border-radius: 6px;
}

.status-label {
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
}

.api-key-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  font-size: 1rem;
  font-family: monospace;
  background: var(--card-bg, #fff);
  color: var(--text-primary, #1a1a2e);
}

.api-key-input:focus {
  outline: none;
  border-color: var(--primary-color, #4a90d9);
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.1);
}

.toggle-visibility {
  padding: 0.5rem 1rem;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.25rem;
}

.toggle-visibility:hover {
  background: var(--bg-secondary, #f0f0f0);
}

.message {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.button-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--primary-color, #4a90d9);
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #3a7bc8;
}

.btn.secondary {
  background: var(--bg-secondary, #6c757d);
  color: white;
}

.btn.secondary:hover:not(:disabled) {
  background: #5a6268;
}

.test-result {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  margin-top: 1rem;
}

.test-result.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.test-result.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.info-card {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #e7f3ff;
  border-radius: 8px;
  border-left: 4px solid #4a90d9;
}

.info-card h3 {
  font-size: 1rem;
  color: #1a1a2e;
  margin-bottom: 0.75rem;
}

.info-card ol {
  margin: 0;
  padding-left: 1.5rem;
  color: #666;
}

.info-card li {
  margin-bottom: 0.5rem;
}

.info-card a {
  color: #4a90d9;
  text-decoration: none;
}

.info-card a:hover {
  text-decoration: underline;
}

.info-card .note {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #856404;
  background: #fff3cd;
  padding: 0.5rem;
  border-radius: 4px;
}
</style>
