<template>
  <Teleport to="body">
    <Transition name="alert-fade">
      <div v-if="visible" class="alert-modal" @click.self="$emit('close')">
        <div class="alert-content" :class="level">
          <div class="alert-header">
            <h3>{{ title }}</h3>
            <div class="header-actions">
              <button @click="$emit('mute')" class="mute-button" :title="isMuted ? '取消静音' : '静音'">
                {{ isMuted ? '🔇' : '🔊' }}
              </button>
              <button @click="$emit('close')" class="close-button">×</button>
            </div>
          </div>
          <div class="alert-body">
            <p class="alert-message">{{ message }}</p>
            <div class="alert-details" v-if="details">
              <p v-if="details.time">时间: {{ details.time }}</p>
              <p v-if="details.location">位置: {{ details.location }}</p>
            </div>
          </div>
          <div class="alert-footer">
            <button @click="$emit('mute')" class="alert-button secondary">
              {{ isMuted ? '取消静音' : '静音' }}
            </button>
            <button @click="$emit('close')" class="alert-button primary">确认</button>
            <button
              v-if="hasRecording"
              @click="$emit('view-recording')"
              class="alert-button success"
            >
              查看录像
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface AlertDetails {
  time?: string
  location?: string
  [key: string]: string | undefined
}

defineProps<{
  visible: boolean
  level: 'normal' | 'warning' | 'emergency'
  title: string
  message: string
  details?: AlertDetails
  hasRecording?: boolean
  isMuted?: boolean
}>()

defineEmits<{
  close: []
  'view-recording': []
  mute: []
}>()
</script>

<style scoped>
.alert-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.alert-content {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 10px 25px var(--shadow);
  border-left: 4px solid #ffc107;
}

.alert-content.normal {
  border-left-color: var(--success-color);
}

.alert-content.warning {
  border-left-color: var(--warning-color);
}

.alert-content.emergency {
  border-left-color: var(--danger-color);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
  }
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-header h3 {
  font-size: 1.3rem;
  color: var(--text-primary);
  margin: 0;
}

.mute-button {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.3s ease;
  padding: 0.3rem;
  border-radius: 4px;
}

.mute-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.3s ease;
  padding: 0.3rem;
  border-radius: 4px;
}

.close-button:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.alert-body p {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.alert-details p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0.3rem 0;
}

.alert-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.alert-button {
  padding: 0.8rem 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.alert-button:hover {
  background: var(--bg-secondary);
}

.alert-button.primary {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.alert-button.primary:hover {
  background: var(--accent-hover);
}

.alert-button.secondary {
  background: var(--text-muted);
  color: white;
  border-color: var(--text-muted);
}

.alert-button.secondary:hover {
  background: var(--text-secondary);
}

.alert-button.success {
  background: var(--success-color);
  color: white;
  border-color: var(--success-color);
}

.alert-button.success:hover {
  background: #218838;
}

/* 过渡动画 */
.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: opacity 0.3s ease;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
}

.alert-fade-enter-active .alert-content,
.alert-fade-leave-active .alert-content {
  transition: transform 0.3s ease;
}

.alert-fade-enter-from .alert-content,
.alert-fade-leave-to .alert-content {
  transform: scale(0.9);
}

/* 响应式设计 */
@media (max-width: 480px) {
  .alert-content {
    padding: 1.5rem;
  }
  
  .alert-footer {
    flex-direction: column;
  }
  
  .alert-button {
    width: 100%;
  }
}
</style>