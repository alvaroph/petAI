import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MLOpsView from '../views/MLOpsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/mlops',
      name: 'mlops',
      component: MLOpsView,
      meta: {
        title: 'MLOps Dashboard - PetAI'
      }
    },
    // Redirect old A/B testing route to new MLOps dashboard
    {
      path: '/ab-testing',
      redirect: '/mlops'
    },
  ],
})

export default router
