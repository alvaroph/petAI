import { ref, reactive, computed } from 'vue'

export function useMLOps() {
  // Reactive state
  const loading = ref(false)
  const error = ref(null)
  
  // MLOps data
  const schedulerStatus = ref(null)
  const retrainingTriggers = ref(null)
  const modelMetrics = ref(null)
  const deploymentHistory = ref([])
  const modelVersions = ref([])
  const systemStatus = ref(null)

  // Configuration
  const config = reactive({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    notifications: true
  })

  // Computed properties
  const isSchedulerRunning = computed(() => 
    schedulerStatus.value?.running || false
  )
  
  const shouldRetrain = computed(() => 
    retrainingTriggers.value?.shouldRetrain || false
  )
  
  const currentAccuracy = computed(() => 
    modelMetrics.value?.accuracy || 0
  )
  
  const modelHealth = computed(() => {
    const accuracy = currentAccuracy.value
    if (accuracy >= 0.8) return { status: 'excellent', color: 'success' }
    if (accuracy >= 0.7) return { status: 'good', color: 'info' }
    if (accuracy >= 0.6) return { status: 'fair', color: 'warning' }
    return { status: 'poor', color: 'danger' }
  })

  // API functions for Scheduler Management
  async function getSchedulerStatus() {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('/api/images/mlops/scheduler/status')
      const data = await response.json()
      
      if (data.success) {
        schedulerStatus.value = data.data
        return data.data
      } else {
        throw new Error(data.message || 'Error getting scheduler status')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error getting scheduler status:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function controlScheduler(action) {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('/api/images/mlops/scheduler/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })
      
      const data = await response.json()
      
      if (data.success) {
        schedulerStatus.value = data.data
        return data.data
      } else {
        throw new Error(data.message || 'Error controlling scheduler')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error controlling scheduler:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function startScheduler() {
    return await controlScheduler('start')
  }

  async function stopScheduler() {
    return await controlScheduler('stop')
  }

  // API functions for Retraining
  async function getRetrainingTriggers() {
    try {
      const response = await fetch('/api/images/mlops/triggers')
      const data = await response.json()
      
      if (data.success) {
        retrainingTriggers.value = data.data
        return data.data
      } else {
        throw new Error(data.message || 'Error getting retraining triggers')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error getting retraining triggers:', err)
      return null
    }
  }

  async function triggerManualRetraining() {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('/api/images/mlops/retrain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          manual: true,
          reason: 'Manual retraining triggered from dashboard'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Error triggering manual retraining')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error triggering manual retraining:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // API functions for Metrics
  async function getAdvancedMetrics() {
    try {
      const response = await fetch('/api/images/metrics/advanced')
      const data = await response.json()
      
      if (data.success) {
        modelMetrics.value = data.data
        return data.data
      } else {
        throw new Error(data.message || 'Error getting advanced metrics')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error getting advanced metrics:', err)
      return null
    }
  }

  async function getQualityMetrics() {
    try {
      const response = await fetch('/api/images/tests/quality-metrics')
      const data = await response.json()
      
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Error getting quality metrics')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error getting quality metrics:', err)
      return null
    }
  }

  async function runModelTests() {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('/api/images/tests/run', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Error running model tests')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error running model tests:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // API functions for Deployment
  async function getDeploymentHistory() {
    try {
      const response = await fetch('/api/images/winner-selection/deployment-history')
      const data = await response.json()
      
      if (data.success) {
        deploymentHistory.value = data.data.history || []
        return data.data
      } else {
        throw new Error(data.message || 'Error getting deployment history')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error getting deployment history:', err)
      return null
    }
  }

  async function executeRollback(version, reason = 'manual_rollback') {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('/api/images/winner-selection/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version, reason })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh deployment history
        await getDeploymentHistory()
        return data.data
      } else {
        throw new Error(data.message || 'Error executing rollback')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error executing rollback:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // API functions for Model Versions
  async function getModelVersions() {
    try {
      const response = await fetch('/api/images/versions')
      const data = await response.json()
      
      if (data.success) {
        modelVersions.value = data.data || []
        return data.data
      } else {
        throw new Error(data.message || 'Error getting model versions')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error getting model versions:', err)
      return null
    }
  }

  async function deployVersion(version) {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch(`/api/images/versions/${version}/deploy`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh versions and deployment history
        await Promise.all([
          getModelVersions(),
          getDeploymentHistory()
        ])
        return data.data
      } else {
        throw new Error(data.message || 'Error deploying version')
      }
    } catch (err) {
      error.value = err.message
      console.error('Error deploying version:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // Utility functions
  async function refreshAllData() {
    try {
      await Promise.all([
        getSchedulerStatus(),
        getRetrainingTriggers(),
        getAdvancedMetrics(),
        getDeploymentHistory(),
        getModelVersions()
      ])
    } catch (err) {
      console.error('Error refreshing data:', err)
    }
  }

  function formatDuration(milliseconds) {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000))
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000))
    
    if (days > 0) {
      return `${days}d ${hours}h`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  function formatDate(date) {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Status helpers
  function getHealthStatusText(accuracy) {
    if (accuracy >= 0.8) return 'Excelente'
    if (accuracy >= 0.7) return 'Bueno'
    if (accuracy >= 0.6) return 'Regular'
    return 'Crítico'
  }

  function getHealthStatusColor(accuracy) {
    if (accuracy >= 0.8) return 'success'
    if (accuracy >= 0.7) return 'info'
    if (accuracy >= 0.6) return 'warning'
    return 'danger'
  }

  // Initialize
  async function initialize() {
    await refreshAllData()
  }

  return {
    // State
    loading,
    error,
    config,
    
    // Data
    schedulerStatus,
    retrainingTriggers,
    modelMetrics,
    deploymentHistory,
    modelVersions,
    systemStatus,
    
    // Computed
    isSchedulerRunning,
    shouldRetrain,
    currentAccuracy,
    modelHealth,
    
    // Scheduler methods
    getSchedulerStatus,
    controlScheduler,
    startScheduler,
    stopScheduler,
    
    // Retraining methods
    getRetrainingTriggers,
    triggerManualRetraining,
    
    // Metrics methods
    getAdvancedMetrics,
    getQualityMetrics,
    runModelTests,
    
    // Deployment methods
    getDeploymentHistory,
    executeRollback,
    
    // Version methods
    getModelVersions,
    deployVersion,
    
    // Utilities
    refreshAllData,
    formatDuration,
    formatDate,
    getHealthStatusText,
    getHealthStatusColor,
    initialize
  }
}