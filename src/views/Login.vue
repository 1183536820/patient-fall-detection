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
    <!-- 动态背景装饰 -->
    <div class="bg-grid"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>

    <div class="login-card">
      <!-- Logo区域 -->
      <div class="login-logo">
        <div class="logo-ring">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
            <path d="M24 14c-3.3 0-6 2.7-6 6v2h-2c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V24c0-1.1-.9-2-2-2h-2v-2c0-3.3-2.7-6-6-6zm-4 8v-2c0-2.2 1.8-4 4-4s4 1.8 4 4v2H20zm2 6.3V31c0 .6.4 1 1 1s1-.4 1-1v-2.7c.6-.3 1-1 1-1.7 0-1.1-.9-2-2-2s-2 .9-2 2c0 .7.4 1.4 1 1.7z" fill="white" />
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stop-color="#6366f1" />
                <stop offset="100%" stop-color="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <div class="login-header">
        <h1>欢迎回来</h1>
        <p>患者跌倒智能检测系统</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form" aria-label="登录表单">
        <div class="form-group" :class="{ 'has-error': fieldErrors.username, 'is-filled': username }">
          <div class="input-wrapper">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="用户名"
              :disabled="isLoading"
              autocomplete="username"
              aria-required="true"
              ref="usernameInput"
              @blur="validateField('username')"
              @input="clearFieldError('username')"
            />
          </div>
          <span v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</span>
        </div>

        <div class="form-group" :class="{ 'has-error': fieldErrors.password, 'is-filled': password }">
          <div class="input-wrapper">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="密码"
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
              <svg v-if="showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
        </div>

        <div v-if="errorMessage" class="error-message" role="alert" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          <span v-else class="btn-text">登录系统</span>
          <span v-if="isLoading" class="btn-text">登录中...</span>
        </button>
      </form>

      <div class="login-footer">
        <div class="test-accounts">
          <span class="hint">演示账号</span>
          <div class="codes">
            <code>admin / admin123</code>
            <code>nurse / nurse123</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --login-bg: #0b1120;
  --login-card-bg: rgba(26, 35, 50, 0.6);
  --login-card-border: rgba(255, 255, 255, 0.06);
  --login-text-color: #f1f5f9;
  --login-text-secondary: #94a3b8;
  --login-label-color: #c8cce0;
  --login-input-bg: rgba(255, 255, 255, 0.04);
  --login-input-border: rgba(255, 255, 255, 0.08);
  --login-input-focus: #818cf8;
  --login-input-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
  --login-btn-bg: linear-gradient(135deg, #6366f1, #8b5cf6);
  --login-btn-hover: linear-gradient(135deg, #4f46e5, #7c3aed);
  --login-btn-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  --login-error-bg: rgba(239, 68, 68, 0.1);
  --login-error-color: #f87171;
  --login-error-border: rgba(239, 68, 68, 0.2);
  --login-code-bg: rgba(129, 140, 248, 0.08);
  --login-code-color: #818cf8;
  --login-footer-border: rgba(255, 255, 255, 0.06);
  --login-disabled-bg: rgba(255, 255, 255, 0.04);
}

:root[data-theme="dark"] {
  --login-bg: #0b1120;
  --login-card-bg: rgba(26, 35, 50, 0.6);
  --login-card-border: rgba(255, 255, 255, 0.06);
  --login-text-color: #f1f5f9;
  --login-text-secondary: #94a3b8;
  --login-label-color: #c8cce0;
  --login-input-bg: rgba(255, 255, 255, 0.04);
  --login-input-border: rgba(255, 255, 255, 0.08);
  --login-input-focus: #818cf8;
  --login-input-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
  --login-btn-bg: linear-gradient(135deg, #6366f1, #8b5cf6);
  --login-btn-hover: linear-gradient(135deg, #4f46e5, #7c3aed);
  --login-btn-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  --login-error-bg: rgba(239, 68, 68, 0.1);
  --login-error-color: #f87171;
  --login-error-border: rgba(239, 68, 68, 0.2);
  --login-code-bg: rgba(129, 140, 248, 0.08);
  --login-code-color: #818cf8;
  --login-footer-border: rgba(255, 255, 255, 0.06);
  --login-disabled-bg: rgba(255, 255, 255, 0.04);
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
  position: relative;
  overflow: hidden;
}

/* 动态网格背景 */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%);
}

/* 光晕装饰 */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}

.bg-orb-1 {
  width: 400px;
  height: 400px;
  background: rgba(99, 102, 241, 0.15);
  top: -100px;
  right: -100px;
  animation: orbFloat 12s ease-in-out infinite;
}

.bg-orb-2 {
  width: 350px;
  height: 350px;
  background: rgba(139, 92, 246, 0.12);
  bottom: -80px;
  left: -80px;
  animation: orbFloat 15s ease-in-out infinite reverse;
}

.bg-orb-3 {
  width: 250px;
  height: 250px;
  background: rgba(168, 85, 247, 0.08);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: orbPulse 8s ease-in-out infinite;
}

@keyframes orbFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

@keyframes orbPulse {
  0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
}

/* 登录卡片 */
.login-card {
  position: relative;
  background: var(--login-card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--login-card-border);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  padding: 44px 40px 36px;
  width: 100%;
  max-width: 400px;
  z-index: 1;
  animation: cardEnter 0.6s ease-out;
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Logo */
.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.logo-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-ring::before {
  content: '';
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--accent-color);
  opacity: 0.1;
  animation: ringPulse 2s ease-in-out infinite;
}

@keyframes ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.1; }
  50% { transform: scale(1.15); opacity: 0.05; }
}

.login-logo svg {
  display: block;
  position: relative;
  z-index: 1;
}

/* 头部 */
.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--login-text-color);
  margin-bottom: 6px;
  letter-spacing: -0.02em;
}

.login-header p {
  color: var(--login-text-secondary);
  font-size: 0.9rem;
}

/* 表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 输入框容器 */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--login-input-bg);
  border: 1px solid var(--login-input-border);
  border-radius: 12px;
  transition: all 0.25s ease;
}

.input-wrapper:focus-within {
  border-color: var(--login-input-focus);
  box-shadow: var(--login-input-shadow);
  background: rgba(255, 255, 255, 0.06);
}

.input-icon {
  position: absolute;
  left: 14px;
  color: var(--login-text-secondary);
  opacity: 0.5;
  pointer-events: none;
  transition: opacity 0.25s;
}

.input-wrapper:focus-within .input-icon {
  opacity: 0.8;
  color: var(--login-input-focus);
}

.form-group input {
  width: 100%;
  padding: 14px 14px 14px 44px;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  font-family: inherit;
  background: transparent;
  color: var(--login-text-color);
  outline: none;
  transition: all 0.25s;
}

.form-group input::placeholder {
  color: var(--login-text-secondary);
  opacity: 0.4;
}

.form-group input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.form-group.has-error .input-wrapper {
  border-color: var(--login-error-color);
}

.form-group.has-error .input-wrapper:focus-within {
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.12);
}

.field-error {
  font-size: 0.78rem;
  color: var(--login-error-color);
  padding-left: 4px;
  font-weight: 500;
}

/* 密码切换按钮 */
.password-toggle {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--login-text-secondary);
  opacity: 0.4;
  transition: opacity 0.2s;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.password-toggle:hover {
  opacity: 0.8;
  color: var(--login-input-focus);
}

/* 错误消息 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--login-error-color);
  font-size: 0.85rem;
  padding: 10px 14px;
  background: var(--login-error-bg);
  border: 1px solid var(--login-error-border);
  border-radius: 10px;
  animation: shake 0.4s ease-in-out;
}

/* 登录按钮 */
.login-button {
  position: relative;
  padding: 14px 20px;
  background: var(--login-btn-bg);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--login-btn-shadow);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--login-btn-hover);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.login-button:hover:not(:disabled)::before {
  opacity: 1;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-text {
  position: relative;
  z-index: 1;
}

/* 加载旋转 */
.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  position: relative;
  z-index: 1;
}

/* 底部 */
.login-footer {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--login-footer-border);
}

.test-accounts {
  text-align: center;
}

.hint {
  font-size: 0.78rem;
  color: var(--login-text-secondary);
  opacity: 0.6;
  display: block;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
}

.codes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.test-accounts code {
  padding: 5px 14px;
  background: var(--login-code-bg);
  border-radius: 8px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.82rem;
  color: var(--login-code-color);
  letter-spacing: -0.01em;
  transition: all 0.2s;
}

.test-accounts code:hover {
  background: rgba(129, 140, 248, 0.15);
  transform: translateY(-1px);
}

/* 动画 */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%, 45%, 75% { transform: translateX(-3px); }
  30%, 60%, 90% { transform: translateX(3px); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
