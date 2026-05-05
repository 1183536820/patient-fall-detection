import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Home.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/camera',
      name: 'Camera',
      component: () => import('../views/Camera.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/video',
      name: 'Video',
      component: () => import('../views/Video.vue'),
      meta: { requiresAuth: true }
    },
    {
    path: '/deepseek',
    name: 'DeepSeek',
    component: () => import('../views/DeepSeek.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/medical-qa',
    name: 'MedicalQA',
    component: () => import('../views/MedicalQA.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/patient-records',
    name: 'PatientRecords',
    component: () => import('../views/PatientRecords.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('../views/Analytics.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('../views/Logs.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/Settings.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/events',
      name: 'Events',
      component: () => import('../views/Events.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/user-management',
      name: 'UserManagement',
      component: () => import('../views/UserManagement.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false
  const requiresAdmin = to.meta.requiresAdmin === true

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
    return
  }

  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
    return
  }

  if (requiresAdmin && !authStore.isAdmin) {
    next('/')
    return
  }

  next()
})

export default router
