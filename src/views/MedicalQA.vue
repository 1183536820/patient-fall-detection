<template>
  <div class="medical-qa">
    <div class="qa-header">
      <h2>医疗智能问答</h2>
      <p>基于DeepSeek的专业医疗咨询助手</p>
    </div>

    <!-- API Key 状态 -->
    <div class="api-key-banner" v-if="apiKeyStatus">
      <span :class="apiKeyStatus.configured ? 'key-ok' : 'key-missing'">
        {{ apiKeyStatus.configured ? '✅ DeepSeek API 已配置' : '⚠️ 未配置 DeepSeek API Key，请在"设置"页面中配置' }}
        <span v-if="apiKeyStatus.configured && apiKeyStatus.maskedKey">({{ apiKeyStatus.maskedKey }})</span>
      </span>
    </div>

    <!-- 问答界面 -->
    <div class="qa-container">
      <div class="chat-messages">
        <div v-for="(message, index) in messages" :key="index" class="message" :class="message.role">
          <div class="message-avatar">
            {{ message.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-name">{{ message.role === 'user' ? '您' : 'AI医疗助手' }}</span>
              <span class="message-time">{{ message.timestamp }}</span>
            </div>
            <div class="message-text">{{ message.content }}</div>
          </div>
        </div>
        
        <div v-if="isLoading" class="message ai">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-name">AI医疗助手</span>
              <span class="message-time">{{ formatTime(Date.now()) }}</span>
            </div>
            <div class="loading-message">
              <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>正在思考中...</p>
            </div>
          </div>
        </div>
      </div>

      <div class="qa-input-area">
        <textarea 
          v-model="inputMessage" 
          placeholder="请输入您的医疗问题，例如：老人跌倒后如何急救？" 
          class="input-textarea"
          @keydown.enter.prevent="handleEnterKey"
        ></textarea>
        <button 
          @click="sendMessage" 
          :disabled="!inputMessage.trim() || isLoading" 
          class="send-button"
        >
          {{ isLoading ? '发送中...' : '发送' }}
        </button>
      </div>
    </div>

    <!-- 常见问题 -->
    <div class="faq-section">
      <h3>常见问题</h3>
      <div class="faq-grid">
        <button 
          v-for="faq in faqs" 
          :key="faq.id" 
          @click="selectFaq(faq.question)" 
          class="faq-button"
        >
          {{ faq.question }}
        </button>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="history-section">
      <div class="section-header">
        <h3>历史记录</h3>
        <button @click="clearHistory" class="clear-button">
          🗑️ 清空历史
        </button>
      </div>
      <div v-if="history.length === 0" class="empty-history">
        <p>暂无历史记录</p>
      </div>
      <div v-else class="history-list">
        <div 
          v-for="(item, index) in history" 
          :key="index" 
          @click="loadHistory(item)" 
          class="history-item"
        >
          <div class="history-question">{{ item.question }}</div>
          <div class="history-time">{{ formatTime(item.timestamp) }}</div>
        </div>
      </div>
    </div>

    <!-- 医疗知识库 -->
    <div class="knowledge-section">
      <h3>医疗知识库</h3>
      <div class="knowledge-grid">
        <div v-for="category in knowledgeCategories" :key="category.id" class="knowledge-card">
          <h4>{{ category.title }}</h4>
          <ul>
            <li v-for="article in category.articles" :key="article.id">
              <button @click="selectKnowledge(article.question)" class="knowledge-link">
                {{ article.title }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

// API Key 状态
const apiKeyStatus = ref<{ configured: boolean; maskedKey: string | null } | null>(null)

// 消息列表
const messages = ref([
  {
    role: 'ai',
    content: '您好！我是您的AI医疗助手，专注于老年人跌倒护理和健康管理。请问有什么可以帮助您的？',
    timestamp: formatTime(Date.now())
  }
])

// 输入消息
const inputMessage = ref('')

// 加载状态
const isLoading = ref(false)

// 错误信息
const errorMessage = ref('')

// 常见问题
const faqs = ref([
  {
    id: 1,
    question: '老人跌倒后如何急救？'
  },
  {
    id: 2,
    question: '如何预防老人跌倒？'
  },
  {
    id: 3,
    question: '跌倒后的康复护理注意事项'
  },
  {
    id: 4,
    question: '老年人常见健康问题'
  }
])

// 历史记录
const history = ref<Array<{ question: string; answer: string; timestamp: number }>>([])

// 医疗知识库
const knowledgeCategories = ref([
  {
    id: 1,
    title: '跌倒护理',
    articles: [
      { id: 1, title: '跌倒急救指南', question: '老人跌倒急救指南' },
      { id: 2, title: '跌倒预防措施', question: '老年人跌倒预防措施' },
      { id: 3, title: '跌倒康复训练', question: '跌倒后的康复训练方法' }
    ]
  },
  {
    id: 2,
    title: '老年健康',
    articles: [
      { id: 4, title: '常见慢性病管理', question: '老年人常见慢性病管理' },
      { id: 5, title: '营养健康指导', question: '老年人营养健康指导' },
      { id: 6, title: '心理健康维护', question: '老年人心理健康维护' }
    ]
  },
  {
    id: 3,
    title: '居家安全',
    articles: [
      { id: 7, title: '居家环境改造', question: '老年人居家环境安全改造' },
      { id: 8, title: '安全用药指导', question: '老年人安全用药指导' },
      { id: 9, title: '紧急情况处理', question: '老年人紧急情况处理' }
    ]
  }
])

// 获取 API Key 状态
async function checkApiKeyStatus() {
  try {
    const res = await fetch('/api/settings/api-key-status', {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    if (res.ok) {
      apiKeyStatus.value = await res.json()
    }
  } catch {
    // 忽略
  }
}

// 发送消息 - 真实 API 调用
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return
  
  const question = inputMessage.value.trim()
  
  messages.value.push({
    role: 'user',
    content: question,
    timestamp: formatTime(Date.now())
  })
  
  inputMessage.value = ''
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `你是一个专业的医疗助手，专门回答关于老年人护理、跌倒预防和处理、慢性病管理等医疗健康问题。请用中文回答，回答要专业且易懂，内容适中，不要使用任何符号标记，按段落分段回答。`
          },
          {
            role: 'user',
            content: question
          }
        ]
      })
    })
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `API调用失败 (${response.status})`)
    }
    
    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content || '抱歉，无法获取回答'
    
    messages.value.push({
      role: 'ai',
      content: answer,
      timestamp: formatTime(Date.now())
    })
    
    history.value.unshift({
      question,
      answer,
      timestamp: Date.now()
    })
    
    if (history.value.length > 20) {
      history.value = history.value.slice(0, 20)
    }
    
  } catch (error: any) {
    console.error('[MedicalQA] API调用失败:', error)
    errorMessage.value = error.message || '问答服务暂不可用，请检查 API Key 配置'
    
    messages.value.push({
      role: 'ai',
      content: `⚠️ **问答服务暂不可用**\n\n原因：${error.message || '请检查 API Key 配置'}\n\n您可以在"设置"页面中配置 DeepSeek API Key，或在"AI参数设置"页面中查看 API Key 状态。`,
      timestamp: formatTime(Date.now())
    })
  } finally {
    isLoading.value = false
  }
}

// 处理回车键发送
const handleEnterKey = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    inputMessage.value += '\n'
  } else if (!event.shiftKey) {
    sendMessage()
  }
}

// 选择常见问题
const selectFaq = (question: string) => {
  inputMessage.value = question
  sendMessage()
}

// 选择知识库内容
const selectKnowledge = (question: string) => {
  inputMessage.value = question
  sendMessage()
}

// 加载历史记录
const loadHistory = (item: { question: string; answer: string; timestamp: number }) => {
  inputMessage.value = item.question
  sendMessage()
}

// 清空历史
const clearHistory = () => {
  if (confirm('确定要清空所有历史记录吗？')) {
    history.value = []
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 组件挂载
onMounted(() => {
  checkApiKeyStatus()
  const savedHistory = localStorage.getItem('medical_qa_history')
  if (savedHistory) {
    try {
      history.value = JSON.parse(savedHistory)
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }
})

watch(history, (newHistory) => {
  localStorage.setItem('medical_qa_history', JSON.stringify(newHistory))
}, { deep: true })
</script>

<style scoped>
.medical-qa {
  width: 100%;
}

.qa-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.qa-header h2 {
  font-size: 1.8rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.qa-header p {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* API Key 状态横幅 */
.api-key-banner {
  margin-bottom: 1.5rem;
  padding: 0.8rem 1.2rem;
  border-radius: 8px;
  background: var(--bg-secondary);
}

.key-ok {
  color: var(--success-color);
  font-weight: 500;
  font-size: 0.9rem;
}

.key-missing {
  color: var(--danger-color);
  font-weight: 500;
  font-size: 0.9rem;
}

/* 问答容器 */
.qa-container {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
  margin-bottom: 2rem;
}

/* 聊天消息 */
.chat-messages {
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  gap: 1rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: var(--accent-color);
  color: white;
}

.message.ai .message-avatar {
  background: var(--success-color);
  color: white;
}

.message-content {
  flex: 1;
  max-width: 80%;
}

.message.user .message-content {
  text-align: right;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.message.user .message-header {
  flex-direction: row-reverse;
}

.message-name {
  font-weight: 600;
  color: var(--text-primary);
}

.message-time {
  color: var(--text-muted);
}

.message-text {
  padding: 0.8rem 1rem;
  border-radius: 8px;
  line-height: 1.4;
}

.message.user .message-text {
  background: var(--accent-color);
  color: white;
  border-bottom-right-radius: 2px;
}

.message.ai .message-text {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-bottom-left-radius: 2px;
}

/* 加载消息 */
.loading-message {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.loading-dots {
  display: flex;
  gap: 0.3rem;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-color);
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* 输入区域 */
.qa-input-area {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.input-textarea {
  flex: 1;
  min-height: 80px;
  max-height: 200px;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  resize: vertical;
  font-size: 1rem;
  font-family: inherit;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.send-button {
  padding: 1rem 1.5rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 常见问题 */
.faq-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
  margin-bottom: 2rem;
}

.faq-section h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.faq-button {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  font-size: 0.95rem;
}

.faq-button:hover {
  border-color: var(--accent-color);
  background: var(--bg-primary);
  color: var(--accent-color);
}

/* 历史记录 */
.history-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin: 0;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.clear-button {
  padding: 0.6rem 1.2rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.clear-button:hover {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.empty-history {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.3s ease;
}

.history-item:hover {
  border-color: var(--accent-color);
  background: var(--bg-primary);
}

.history-question {
  font-size: 0.95rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  line-height: 1.3;
}

.history-time {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* 医疗知识库 */
.knowledge-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px var(--shadow);
}

.knowledge-section h3 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
  border-left: 4px solid var(--accent-color);
}

.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.knowledge-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--accent-color);
}

.knowledge-card h4 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.knowledge-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.knowledge-link {
  padding: 0.6rem;
  border: none;
  background: transparent;
  color: var(--accent-color);
  cursor: pointer;
  text-align: left;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  border-radius: 4px;
}

.knowledge-link:hover {
  background: var(--bg-primary);
  padding-left: 1rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .qa-input-area {
    flex-direction: column;
    align-items: stretch;
  }
  
  .send-button {
    align-self: flex-end;
  }
  
  .message-content {
    max-width: 90%;
  }
  
  .faq-grid,
  .knowledge-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .clear-button {
    align-self: flex-end;
  }
}
</style>