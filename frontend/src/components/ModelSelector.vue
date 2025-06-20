<template>
  <div class="model-selector">
    <!-- Header del selector -->
    <div class="selector-header">
      <h5 class="mb-0">
        <i class="bi bi-cpu me-2"></i>
        Modo de Inferencia
      </h5>
      <small class="text-muted">Elige dónde ejecutar el modelo de IA</small>
    </div>

    <!-- Opciones de modelo -->
    <div class="model-options">
      <div 
        v-for="model in availableModels" 
        :key="model.id"
        class="model-option"
        :class="{ 
          'selected': selectedModel === model.id,
          'disabled': !model.available 
        }"
        @click="model.available && selectModel(model.id)"
      >
        <!-- Header de la opción -->
        <div class="option-header">
          <div class="option-title">
            <i :class="getModelIcon(model.id)" class="me-2"></i>
            {{ model.name }}
          </div>
          <div class="option-status">
            <span v-if="!model.available" class="badge bg-secondary">No Disponible</span>
            <span v-else-if="selectedModel === model.id" class="badge bg-primary">Seleccionado</span>
            <span v-else class="badge bg-outline-secondary">Disponible</span>
          </div>
        </div>

        <!-- Descripción -->
        <p class="option-description">{{ model.description }}</p>

        <!-- Ventajas y desventajas -->
        <div class="pros-cons" v-if="model.available && selectedModel === model.id">
          <div class="row">
            <div class="col-md-6">
              <div class="pros">
                <strong class="text-success">
                  <i class="bi bi-check-circle me-1"></i>Ventajas:
                </strong>
                <ul class="small mt-1">
                  <li v-for="pro in model.pros" :key="pro">{{ pro }}</li>
                </ul>
              </div>
            </div>
            <div class="col-md-6">
              <div class="cons">
                <strong class="text-warning">
                  <i class="bi bi-exclamation-triangle me-1"></i>Consideraciones:
                </strong>
                <ul class="small mt-1">
                  <li v-for="con in model.cons" :key="con">{{ con }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Estadísticas de rendimiento -->
        <div v-if="showPerformance && model.available && performanceData[model.id]" class="performance-stats">
          <div class="stats-row">
            <span class="stat-label">Última ejecución:</span>
            <span class="stat-value">{{ formatTime(performanceData[model.id].lastTime) }}</span>
          </div>
          <div class="stats-row" v-if="performanceData[model.id].avgTime">
            <span class="stat-label">Tiempo promedio:</span>
            <span class="stat-value">{{ formatTime(performanceData[model.id].avgTime) }}</span>
          </div>
          <div class="stats-row" v-if="performanceData[model.id].relative">
            <span class="stat-label">Velocidad relativa:</span>
            <span class="stat-value text-success">{{ performanceData[model.id].relative.toFixed(1) }}x más rápido</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Estado de carga de modelos locales -->
    <div v-if="isLoadingLocal" class="loading-local">
      <div class="d-flex align-items-center">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Cargando modelos locales...</span>
      </div>
    </div>

    <!-- Error de carga -->
    <div v-if="localError" class="alert alert-warning mt-3">
      <i class="bi bi-exclamation-triangle me-2"></i>
      <strong>Advertencia:</strong> {{ localError }}
      <button @click="retryLoadLocal" class="btn btn-sm btn-outline-warning ms-2">
        Reintentar
      </button>
    </div>

    <!-- Información adicional -->
    <div class="info-section">
      <div class="info-item">
        <i class="bi bi-info-circle text-info me-2"></i>
        <strong>Comparación Educativa:</strong> Este selector demuestra diferentes estrategias de deployment de modelos ML.
      </div>
      
      <div class="comparison-table" v-if="showComparison">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Característica</th>
              <th>Servidor</th>
              <th>Local Optimizado</th>
              <th>Local Quantizado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Precisión</td>
              <td><span class="badge bg-success">Alta (~85%)</span></td>
              <td><span class="badge bg-info">Media (~80%)</span></td>
              <td><span class="badge bg-warning">Básica (~75%)</span></td>
            </tr>
            <tr>
              <td>Velocidad</td>
              <td><span class="badge bg-warning">Media</span></td>
              <td><span class="badge bg-info">Rápida</span></td>
              <td><span class="badge bg-success">Muy Rápida</span></td>
            </tr>
            <tr>
              <td>Privacidad</td>
              <td><span class="badge bg-warning">Datos enviados</span></td>
              <td><span class="badge bg-success">100% Local</span></td>
              <td><span class="badge bg-success">100% Local</span></td>
            </tr>
            <tr>
              <td>Conexión</td>
              <td><span class="badge bg-danger">Requerida</span></td>
              <td><span class="badge bg-success">Offline</span></td>
              <td><span class="badge bg-success">Offline</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button 
        @click="showComparison = !showComparison" 
        class="btn btn-sm btn-outline-info mt-2"
      >
        <i class="bi bi-table me-1"></i>
        {{ showComparison ? 'Ocultar' : 'Ver' }} Comparación Detallada
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLocalModels } from '../composables/useLocalModels.js'

export default {
  name: 'ModelSelector',
  emits: ['model-selected', 'models-loaded'],
  setup(props, { emit }) {
    // Estado local
    const showComparison = ref(false)
    const showPerformance = ref(false)
    const selectedModel = ref('backend') // Por defecto backend

    // Usar composable de modelos locales
    const {
      isLoading: isLoadingLocal,
      error: localError,
      loadLocalModels,
      getAvailableModels,
      getPerformanceComparison
    } = useLocalModels()

    // Modelos disponibles
    const availableModels = computed(() => getAvailableModels())
    
    // Datos de rendimiento
    const performanceData = computed(() => getPerformanceComparison())

    /**
     * Selecciona un modelo
     */
    function selectModel(modelId) {
      selectedModel.value = modelId
      emit('model-selected', modelId)
      
      // Mostrar estadísticas de rendimiento después de primera predicción
      showPerformance.value = true
    }

    /**
     * Reintenta cargar modelos locales
     */
    function retryLoadLocal() {
      loadLocalModels()
    }

    /**
     * Obtiene el icono para cada tipo de modelo
     */
    function getModelIcon(modelId) {
      const icons = {
        backend: 'bi bi-cloud-fill text-primary',
        optimized: 'bi bi-laptop text-success',
        quantized: 'bi bi-phone text-info'
      }
      return icons[modelId] || 'bi bi-cpu'
    }

    /**
     * Formatea tiempo en milisegundos
     */
    function formatTime(ms) {
      if (ms === null || ms === undefined) return 'N/A'
      return `${Math.round(ms)}ms`
    }

    // Lifecycle
    onMounted(async () => {
      // Cargar modelos locales al montar
      await loadLocalModels()
      emit('models-loaded')
      
      // Seleccionar modelo por defecto
      selectModel('backend')
    })

    return {
      // Estado
      selectedModel,
      showComparison,
      showPerformance,
      isLoadingLocal,
      localError,
      
      // Computed
      availableModels,
      performanceData,
      
      // Métodos
      selectModel,
      retryLoadLocal,
      getModelIcon,
      formatTime
    }
  }
}
</script>

<style scoped>
.model-selector {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.selector-header {
  text-align: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.selector-header h5 {
  color: var(--text-primary);
  font-weight: 600;
}

.model-options {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.model-option {
  background: var(--bg-primary);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.model-option:hover:not(.disabled) {
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.model-option.selected {
  border-color: var(--primary);
  background: var(--primary-light);
  box-shadow: var(--shadow-md);
}

.model-option.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-tertiary);
}

.option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.option-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.option-description {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.pros-cons {
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 1rem;
}

.pros ul, .cons ul {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--text-secondary);
}

.performance-stats {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 1rem;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.stats-row:last-child {
  margin-bottom: 0;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.loading-local {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
}

.info-section {
  border-top: 1px solid var(--border);
  padding-top: 1.5rem;
}

.info-item {
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.comparison-table {
  margin-top: 1rem;
  overflow-x: auto;
}

.comparison-table table {
  font-size: 0.85rem;
}

.comparison-table th {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 600;
  border: none;
}

.comparison-table td {
  border-color: var(--border);
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .model-selector {
    padding: 1rem;
  }
  
  .option-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .pros-cons .row {
    flex-direction: column;
  }
}
</style>