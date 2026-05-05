<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const showPassword = ref(false)
const fieldErrors = ref<{ username?: string; password?: string }>({})
const usernameInput = ref<HTMLInputElement | null>(null)

function validateField(field: 'username' | 'password') {
  if (field === 'username') {
    if (!username.value.trim()) {
      fieldErrors.value = { ...fieldErrors.value, username: '请输入用户名' }
    } else {
      const { username: _, ...rest } = fieldErrors.value
      fieldErrors.value = rest
    }
  } else if (field === 'password') {
    if (!password.value) {
      fieldErrors.value = { ...fieldErrors.value, password: '请输入密码' }
    } else {
      const { password: _, ...rest } = fieldErrors.value
      fieldErrors.value = rest
    }
  }
}

function clearFieldError(field: 'username' | 'password') {
  if (field === 'username' && fieldErrors.value.username) {
    const { username: _, ...rest } = fieldErrors.value
    fieldErrors.value = rest
  }
  if (field === 'password' && fieldErrors.value.password) {
    const { password: _, ...rest } = fieldErrors.value
    fieldErrors.value = rest
  }
  if (errorMessage.value) {
    errorMessage.value = ''
  }
}

async function handleLogin() {
  if (isLoading.value) return

  if (!username.value || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const success = await authStore.login(username.value, password.value)
    if (success) {
      router.push('/')
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  usernameInput.value?.focus()
})
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="card-accent"></div>
      <div class="login-header">
        <div class="login-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
            <path d="M24 14c-3.3 0-6 2.7-6 6v2h-2c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V24c0-1.1-.9-2-2-2h-2v-2c0-3.3-2.7-6-6-6zm-4 8v-2c0-2.2 1.8-4 4-4s4 1.8 4 4v2H20zm2 6.3V31c0 .6.4 1 1 1s1-.4 1-1v-2.7c.6-.3 1-1 1-1.7 0-1.1-.9-2-2-2s-2 .9-2 2c0 .7.4 1.4 1 1.7z" fill="white" />
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stop-color="#4a90e2" />
                <stop offset="100%" stop-color="#357abd" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1>患者跌倒智能检测系统</h1>
        <p>请登录以继续</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form" aria-label="登录表单">
        <div class="form-group" :class="{ 'has-error': fieldErrors.username }">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            :disabled="isLoading"
            autocomplete="username"
            aria-required="true"
            ref="usernameInput"
            @blur="validateField('username')"
            @input="clearFieldError('username')"
          />
          <span v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</span>
        </div>

        <div class="form-group" :class="{ 'has-error': fieldErrors.password }">
          <label for="password">密码</label>
          <div class="password-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              :disabled="isLoading"
              autocomplete="current-password"
              aria-required="true"
              @blur="validateField('password')"
              @input="clearFieldError('password')"
            />
            <button
              type="button"
              class="password-toggle"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              tabindex="-1"
            >
              <svg v-if="showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
        </div>

        <div v-if="errorMessage" class="error-message" role="alert" aria-live="polite">
          <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          class="login-button"
          :disabled="isLoading"
          :aria-busy="isLoading"
        >
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="login-footer">
        <div class="test-accounts">
          <p>测试账号：</p>
          <code>admin / admin123</code>
          <code>nurse / nurse123</code>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --login-bg: linear-gradient(135deg, #4a90e2 0%, #2d5f9a 100%);
  --login-card-bg: #ffffff;
  --login-card-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  --login-input-bg: #f8f9fc;
  --login-input-border: #e2e5ed;
  --login-input-focus: #4a90e2;
  --login-input-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15);
  --login-btn-bg: #4a90e2;
  --login-btn-hover-bg: #357abd;
  --login-btn-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
  --login-btn-hover-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
  --login-error-bg: rgba(229, 57, 53, 0.08);
  --login-error-color: #e53935;
  --login-error-border: rgba(229, 57, 53, 0.2);
  --login-code-bg: rgba(74, 144, 226, 0.08);
  --login-code-color: #4a90e2;
  --login-footer-border: #e8eaef;
  --login-label-color: #4a4d5e;
  --login-text-color: #333333;
  --login-text-secondary: #888c9e;
  --login-disabled-bg: #f0f1f5;
  --login-accent-bar: #4a90e2;
}

:root[data-theme="dark"] {
  --login-bg: linear-gradient(135deg, #0f1923 0%, #16213e 100%);
  --login-card-bg: #1f2937;
  --login-card-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  --login-input-bg: #262840;
  --login-input-border: #374151;
  --login-input-focus: #60a5fa;
  --login-input-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
  --login-btn-bg: #3b82f6;
  --login-btn-hover-bg: #2563eb;
  --login-btn-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  --login-btn-hover-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  --login-error-bg: rgba(239, 68, 68, 0.12);
  --login-error-color: #ef4444;
  --login-error-border: rgba(239, 68, 68, 0.25);
  --login-code-bg: rgba(96, 165, 250, 0.1);
  --login-code-color: #60a5fa;
  --login-footer-border: #374151;
  --login-label-color: #c8cce0;
  --login-text-color: #e5e7eb;
  --login-text-secondary: #8b8fa8;
  --login-disabled-bg: #2a2d45;
  --login-accent-bar: #60a5fa;
}
</style>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--login-bg);
  padding: 20px;
}

.login-card {
  position: relative;
  background: var(--login-card-bg);
  border-radius: 10px;
  box-shadow: var(--login-card-shadow);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  overflow: hidden;
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--login-accent-bar);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.login-logo svg {
  display: block;
}

.login-header h1 {
  font-size: 1.35rem;
  color: var(--login-text-color);
  margin-bottom: 8px;
  font-weight: 600;
}

.login-header p {
  color: var(--login-text-secondary);
  font-size: 0.95rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--login-label-color);
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid var(--login-input-border);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--login-input-bg);
  color: var(--login-text-color);
  transition: border-color 0.25s, box-shadow 0.25s;
  outline: none;
}

.form-group input:focus {
  border-color: var(--login-input-focus);
  box-shadow: var(--login-input-shadow);
}

.form-group input:disabled {
  background: var(--login-disabled-bg);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group.has-error input {
  border-color: var(--login-error-color);
}

.form-group.has-error input:focus {
  box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.12);
}

.field-error {
  font-size: 0.8rem;
  color: var(--login-error-color);
  padding-left: 2px;
}

.password-wrapper {
  position: relative;
}

.password-wrapper input {
  width: 100%;
  padding-right: 44px;
}

.password-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--login-text-secondary);
  opacity: 0.6;
  transition: opacity 0.2s;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.password-toggle:hover {
  opacity: 1;
  color: var(--login-input-focus);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--login-error-color);
  font-size: 0.9rem;
  text-align: center;
  padding: 10px 14px;
  background: var(--login-error-bg);
  border: 1px solid var(--login-error-border);
  border-radius: 8px;
  animation: shake 0.4s ease-in-out;
}

.error-icon {
  flex-shrink: 0;
}

.login-button {
  position: relative;
  padding: 14px;
  background: var(--login-btn-bg);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s, box-shadow 0.2s;
  box-shadow: var(--login-btn-shadow);
}

.login-button:hover:not(:disabled) {
  background: var(--login-btn-hover-bg);
  transform: translateY(-1px);
  box-shadow: var(--login-btn-hover-shadow);
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}

.login-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--login-footer-border);
}

.test-accounts {
  text-align: center;
  color: var(--login-text-secondary);
  font-size: 0.85rem;
}

.test-accounts p {
  margin-bottom: 8px;
}

.test-accounts code {
  display: inline-block;
  margin: 4px 6px;
  padding: 4px 12px;
  background: var(--login-code-bg);
  border-radius: 6px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.82rem;
  color: var(--login-code-color);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%, 45%, 75% { transform: translateX(-3px); }
  30%, 60%, 90% { transform: translateX(3px); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
