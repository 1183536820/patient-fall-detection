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
    <!-- 医疗主题背景装饰 -->
    <div class="bg-gradient"></div>
    <div class="bg-pattern"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>

    <div class="login-card">
      <!-- 顶部品牌区 -->
      <div class="brand-section">
        <div class="logo-wrapper">
          <div class="logo-icon">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="url(#med-gradient)" />
              <path d="M22 12v20M12 22h20" stroke="white" stroke-width="3.5" stroke-linecap="round" />
              <defs>
                <linearGradient id="med-gradient" x1="0" y1="0" x2="44" y2="44">
                  <stop offset="0%" stop-color="#0ea5e9" />
                  <stop offset="100%" stop-color="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="logo-text">
            <h1>患者跌倒智能检测</h1>
            <p>Patient Fall Detection System</p>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <form @submit.prevent="handleLogin" class="login-form" aria-label="登录表单">
        <div class="form-group" :class="{ 'has-error': fieldErrors.username, 'is-filled': username }">
          <label for="username">账号</label>
          <div class="input-wrapper">
            <svg class="input-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
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
          </div>
          <span v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</span>
        </div>

        <div class="form-group" :class="{ 'has-error': fieldErrors.password, 'is-filled': password }">
          <label for="password">密码</label>
          <div class="input-wrapper">
            <svg class="input-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
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
              <svg v-if="showPassword" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
        </div>

        <div v-if="errorMessage" class="error-message" role="alert" aria-live="polite">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="login-button" :disabled="isLoading" :aria-busy="isLoading">
          <span v-if="isLoading" class="loading-spinner"></span>
          <span class="btn-text">{{ isLoading ? '登录中...' : '登录系统' }}</span>
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
  --login-bg-start: #eff6ff;
  --login-bg-end: #e0f2fe;
  --login-card-bg: #ffffff;
  --login-card-shadow: 0 20px 60px rgba(14, 165, 233, 0.15), 0 0 0 1px rgba(14, 165, 233, 0.06);
  --login-text-primary: #0f172a;
  --login-text-secondary: #64748b;
  --login-label-color: #334155;
  --login-input-bg: #f8fafc;
  --login-input-border: #e2e8f0;
  --login-input-focus: #0ea5e9;
  --login-input-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
  --login-btn-bg: linear-gradient(135deg, #0ea5e9, #14b8a6);
  --login-btn-hover: linear-gradient(135deg, #0284c7, #0d9488);
  --login-btn-shadow: 0 4px 16px rgba(14, 165, 233, 0.3);
  --login-error-bg: #fef2f2;
  --login-error-color: #ef4444;
  --login-error-border: #fecaca;
  --login-code-bg: #f0f9ff;
  --login-code-color: #0ea5e9;
  --login-footer-border: #f1f5f9;
  --login-divider: #e2e8f0;
}

:root[data-theme="dark"] {
  --login-bg-start: #0c1929;
  --login-bg-end: #0f1d2f;
  --login-card-bg: #1a2332;
  --login-card-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04);
  --login-text-primary: #f1f5f9;
  --login-text-secondary: #94a3b8;
  --login-label-color: #cbd5e1;
  --login-input-bg: rgba(255, 255, 255, 0.03);
  --login-input-border: rgba(255, 255, 255, 0.08);
  --login-input-focus: #38bdf8;
  --login-input-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
  --login-btn-bg: linear-gradient(135deg, #0ea5e9, #14b8a6);
  --login-btn-hover: linear-gradient(135deg, #0284c7, #0d9488);
  --login-btn-shadow: 0 4px 16px rgba(14, 165, 233, 0.25);
  --login-error-bg: rgba(239, 68, 68, 0.1);
  --login-error-color: #f87171;
  --login-error-border: rgba(239, 68, 68, 0.15);
  --login-code-bg: rgba(14, 165, 233, 0.08);
  --login-code-color: #38bdf8;
  --login-footer-border: rgba(255, 255, 255, 0.05);
  --login-divider: rgba(255, 255, 255, 0.06);
}
</style>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--login-bg-start) 0%, var(--login-bg-end) 50%, #dbeafe 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 径向渐变光晕 */
.bg-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 20% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 20%, rgba(20, 184, 166, 0.06) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 80%, rgba(99, 102, 241, 0.04) 0%, transparent 50%);
}

/* 医疗十字网格背景 */
.bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 24px 24px, rgba(14, 165, 233, 0.03) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 50% 50%, black 35%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 35%, transparent 70%);
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
  background: rgba(14, 165, 233, 0.1);
  top: -120px;
  right: -80px;
  animation: orbFloat 14s ease-in-out infinite;
}

.bg-orb-2 {
  width: 350px;
  height: 350px;
  background: rgba(20, 184, 166, 0.08);
  bottom: -100px;
  left: -60px;
  animation: orbFloat 18s ease-in-out infinite reverse;
}

@keyframes orbFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(25px, -25px) scale(1.05); }
  66% { transform: translate(-15px, 15px) scale(0.95); }
}

/* 登录卡片 */
.login-card {
  position: relative;
  background: var(--login-card-bg);
  border-radius: 20px;
  box-shadow: var(--login-card-shadow);
  padding: 36px 36px 28px;
  width: 100%;
  max-width: 400px;
  z-index: 1;
  animation: cardEnter 0.5s ease-out;
}

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 品牌区 */
.brand-section {
  margin-bottom: 24px;
}

.logo-wrapper {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo-icon {
  flex-shrink: 0;
}

.logo-icon svg {
  display: block;
}

.logo-text h1 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--login-text-primary);
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.logo-text p {
  font-size: 0.72rem;
  color: var(--login-text-secondary);
  margin-top: 2px;
  letter-spacing: 0.02em;
}

/* 分割线 */
.divider {
  height: 1px;
  background: var(--login-divider);
  margin-bottom: 24px;
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

.form-group label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--login-label-color);
  padding-left: 2px;
}

/* 输入框 */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--login-input-bg);
  border: 1.5px solid var(--login-input-border);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--login-input-focus);
  box-shadow: var(--login-input-shadow);
  background: var(--login-card-bg);
}

.input-icon {
  position: absolute;
  left: 13px;
  color: var(--login-text-secondary);
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.2s, color 0.2s;
}

.input-wrapper:focus-within .input-icon {
  opacity: 0.7;
  color: var(--login-input-focus);
}

.form-group input {
  width: 100%;
  padding: 11px 12px 11px 40px;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: inherit;
  background: transparent;
  color: var(--login-text-primary);
  outline: none;
  transition: all 0.2s;
}

.form-group input::placeholder {
  color: var(--login-text-secondary);
  opacity: 0.35;
}

.form-group input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.form-group.has-error .input-wrapper {
  border-color: var(--login-error-color);
}

.form-group.has-error .input-wrapper:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.field-error {
  font-size: 0.75rem;
  color: var(--login-error-color);
  padding-left: 4px;
  font-weight: 500;
}

/* 密码切换 */
.password-toggle {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--login-text-secondary);
  opacity: 0.35;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.password-toggle:hover {
  opacity: 0.7;
  color: var(--login-input-focus);
}

/* 错误消息 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--login-error-color);
  font-size: 0.82rem;
  padding: 10px 14px;
  background: var(--login-error-bg);
  border: 1px solid var(--login-error-border);
  border-radius: 10px;
  animation: shake 0.4s ease-in-out;
}

.error-message span {
  line-height: 1.3;
}

/* 登录按钮 */
.login-button {
  position: relative;
  padding: 13px 20px;
  background: var(--login-btn-bg);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--login-btn-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.login-button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: var(--login-btn-hover);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.login-button:hover:not(:disabled)::before {
  opacity: 1;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.4);
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

/* 加载 */
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
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--login-footer-border);
}

.test-accounts {
  text-align: center;
}

.hint {
  font-size: 0.72rem;
  color: var(--login-text-secondary);
  opacity: 0.5;
  display: block;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.codes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.test-accounts code {
  padding: 4px 12px;
  background: var(--login-code-bg);
  border-radius: 6px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.78rem;
  color: var(--login-code-color);
  letter-spacing: -0.01em;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.test-accounts code:hover {
  border-color: var(--login-code-color);
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
