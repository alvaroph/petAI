<template>
  <div v-if="prediction" class="card mt-3 border-0 shadow-sm">
    <!-- Header con resultado principal -->
    <div class="card-header" :class="headerClasses">
      <div class="d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center">
          <i :class="resultIcon" class="me-2 fs-4"></i>
          <div>
            <h5 class="mb-1">{{ resultTitle }}</h5> 
            <small class="opacity-75">{{ resultSubtitle }}</small>
          </div>
        </div>
        <div class="text-end">
          <div class="badge" :class="confidenceBadgeClass">
            {{ formatConfidence(prediction.prediction.confidence) }}
          </div>
          <div class="small mt-1">{{ prediction.prediction.confidenceLevel }}</div>
        </div>
      </div>
    </div>

    <!-- Detalles de la predicción -->
    <div class="card-body">
      <!-- Información técnica -->
      <div class="row mb-3">
        <div class="col-md-6">
          <h6 class="text-muted mb-2">
            <i class="bi bi-cpu me-1"></i>
            Análisis ML Detallado
          </h6>
          <div class="small">
            <div class="d-flex justify-content-between mb-1">
              <span>Perro:</span>
              <span class="fw-bold">{{ formatConfidence(getDogPrediction()) }}</span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Gato:</span>
              <span class="fw-bold">{{ formatConfidence(getCatProbability()) }}</span>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <h6 class="text-muted mb-2">
            <i class="bi bi-info-circle me-1"></i>
            Información de Proceso
          </h6>
          <div class="small">
            <div>Archivo: {{ truncateFilename(prediction.originalName) }}</div>
            <div>Tamaño: {{ formatFileSize(prediction.size) }}</div>
            <div>Tiempo: {{ formatUploadTime(prediction.uploadTime) }}</div>
          </div>
        </div>
      </div>

      <!-- Barra de confianza visual -->
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <small class="text-muted">Nivel de Confianza</small>
          <small class="text-muted">{{ getConfidenceDescription(prediction.prediction.confidenceLevel) }}</small>
        </div>
        <div class="progress" style="height: 8px;">
          <div 
            class="progress-bar" 
            :class="progressBarClass"
            :style="{ width: formatConfidence(prediction.prediction.confidence) }"
            role="progressbar">
          </div>
        </div>
      </div>

      <!-- Recomendaciones -->
      <div class="alert" :class="recommendationAlertClass" role="alert">
        <h6 class="alert-heading mb-2">
          <i class="bi bi-lightbulb me-1"></i>
          Recomendaciones
        </h6>
        <ul class="mb-0 small">
          <li v-for="(recommendation, index) in recommendations" :key="index">
            {{ recommendation }}
          </li>
        </ul>
      </div>

      <!-- Sistema de validación por usuario - FASE 4 -->
      <div class="user-validation-section mb-4">
        <UserValidation 
          v-if="!validationSubmitted"
          :prediction="prediction.prediction"
          :image-id="prediction.imageId"
          :ab-test-info="prediction.abTest"
          @validation-submitted="handleValidationSubmitted"
          @new-analysis="$emit('new-analysis')"
        />
        
        <!-- Mensaje de agradecimiento después de validación -->
        <div v-if="validationSubmitted" class="alert alert-success border-success" role="alert">
          <div class="d-flex align-items-center">
            <i class="bi bi-check-circle-fill text-success fs-4 me-3"></i>
            <div class="flex-grow-1">
              <h6 class="mb-1">¡Validación completada!</h6>
              <p class="mb-0 small">Gracias por ayudar a mejorar nuestro modelo de IA</p>
            </div>
            <button @click="$emit('new-analysis')" class="btn btn-success btn-sm">
              <i class="bi bi-arrow-repeat me-1"></i>
              Analizar otra
            </button>
          </div>
        </div>
      </div>

      <!-- Acciones secundarias -->
      <div class="d-flex gap-2 flex-wrap">
        <button 
          type="button" 
          class="btn btn-outline-secondary btn-sm"
          @click="showTechnicalDetails = !showTechnicalDetails">
          <i class="bi bi-gear me-1"></i>
          {{ showTechnicalDetails ? 'Ocultar' : 'Ver' }} Detalles Técnicos
        </button>
      </div>

      <!-- Panel técnico colapsable -->
      <div v-if="showTechnicalDetails" class="mt-3 p-3 bg-light rounded">
        <h6 class="mb-2">Detalles Técnicos ML</h6>
        <div class="row small">
          <div class="col-md-6">
            <strong>Todas las Predicciones:</strong>
            <pre class="mt-1 small">{{ JSON.stringify(prediction.allPredictions, null, 2) }}</pre>
          </div>
          <div class="col-md-6">
            <strong>Metadata del Archivo:</strong>
            <div class="mt-1">
              <div>ID: {{ prediction.imageId }}</div>
              <div>Nombre archivo: {{ prediction.filename }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue'
import { useMachineLearning } from '../composables/useMachineLearning.js'
import UserValidation from './UserValidation.vue'

export default {
  name: 'MLPredictionResult',
  
  components: {
    UserValidation
  },
  
  props: {
    prediction: {
      type: Object,
      default: null
    }
  },

  emits: ['new-analysis'],

  setup(props) {
    var showTechnicalDetails = ref(false)
    var validationSubmitted = ref(false)
    var { 
      formatConfidence, 
      getConfidenceDescription
    } = useMachineLearning()

    // Manejar validación completada
    function handleValidationSubmitted(validationData) {
      validationSubmitted.value = true
      console.log('✅ Validación recibida en MLPredictionResult:', validationData)
    }

    // Debug function para entender la estructura de prediction
    function debugPrediction() {
      console.log('🔍 Debug prediction structure:', {
        prediction: props.prediction,
        confidence: props.prediction?.prediction?.confidence,
        directConfidence: props.prediction?.confidence,
        fullObject: JSON.stringify(props.prediction, null, 2)
      })
    }

    // Watch para debuguear cuando llega nueva prediction
    watch(() => props.prediction, (newPrediction) => {
      if (newPrediction) {
        debugPrediction()
      }
    }, { immediate: true })

    // Computadas para la UI
    var isDog = computed(function() {
      return props.prediction?.prediction?.isDog || false
    })

    var headerClasses = computed(function() {
      if (!props.prediction) return 'bg-secondary text-white'
      return isDog.value ? 'bg-success text-white' : 'bg-info text-white'
    })

    var resultIcon = computed(function() {
      if (!props.prediction) return 'bi bi-question-circle'
      return isDog.value ? 'bi bi-check-circle' : 'bi bi-check-circle'
    })

    var resultTitle = computed(function() {
      if (!props.prediction) return 'Sin Resultado'
      return isDog.value ? '🐕 Perro Detectado' : '🐱 Gato Detectado'
    })

    var resultSubtitle = computed(function() {
      if (!props.prediction) return ''
      return isDog.value 
        ? 'Características caninas identificadas - pelaje, orejas y estructura corporal típicas de perro'
        : 'Características felinas identificadas - estructura facial, bigotes y postura típicas de gato'
    })

    var confidenceBadgeClass = computed(function() {
      if (!props.prediction) return 'bg-secondary'
      var level = props.prediction.prediction.confidenceLevel
      if (level === 'alta') return 'bg-success'
      if (level === 'media') return 'bg-warning text-dark'
      return 'bg-danger'
    })

    var progressBarClass = computed(function() {
      if (!props.prediction) return 'bg-secondary'
      var level = props.prediction.prediction.confidenceLevel
      if (level === 'alta') return 'bg-success'
      if (level === 'media') return 'bg-warning'
      return 'bg-danger'
    })

    var recommendationAlertClass = computed(function() {
      if (!props.prediction) return 'alert-secondary'
      return isDog.value ? 'alert-success' : 'alert-info'
    })

    var recommendations = computed(function() {
      if (!props.prediction) return []
      
      var recs = []
      var prediction = props.prediction.prediction

      if (prediction.isDog) {
        if (prediction.confidenceLevel === 'alta') {
          recs.push('✅ Identificación positiva con alta confianza')
          recs.push('🐕 Características típicas caninas detectadas - orejas, pelaje y estructura corporal')
        } else {
          recs.push('⚠️ Posible perro detectado, pero con confianza limitada')
          recs.push('🔍 Se recomienda validación adicional')
        }
      } else {
        recs.push('🐱 Características felinas detectadas')
        recs.push('😸 Esta mascota parece ser un gato - estructura facial y postura típicas')
      }

      recs.push('⚠️ IMPORTANTE: Esta es una herramienta educativa únicamente')
      recs.push('🩺 Para identificación veterinaria profesional, consulte con especialistas')

      return recs
    })

    // Métodos de utilidad
    function getDogProbability() {
      if (!props.prediction?.prediction?.allPredictions) return 0
      var dogPred = props.prediction.prediction.allPredictions.find(
        function(p) { return p.className === 'dog' }
      )
      return dogPred ? dogPred.probability : 0
    }

    function getCatProbability() {
      if (!props.prediction?.prediction?.allPredictions) return 0
      var catPred = props.prediction.prediction.allPredictions.find(
        function(p) { return p.className === 'cat' }
      )
      return catPred ? catPred.probability : 0
    }

    function truncateFilename(filename) {
      if (!filename) return 'N/A'
      if (filename.length <= 20) return filename
      return filename.substring(0, 17) + '...'  
    }

    function formatFileSize(bytes) {
      if (!bytes) return 'N/A'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    function formatUploadTime(timestamp) {
      if (!timestamp) return 'N/A'
      return new Date(timestamp).toLocaleTimeString()
    }

    return {
      showTechnicalDetails,
      validationSubmitted,
      
      // Computadas
      isDog,
      headerClasses,
      resultIcon,
      resultTitle,
      resultSubtitle,
      confidenceBadgeClass,
      progressBarClass,
      recommendationAlertClass,
      recommendations,
      
      // Métodos
      formatConfidence,
      getConfidenceDescription,
      getDogPrediction: getDogProbability,
      getCatProbability,
      truncateFilename,
      formatFileSize,
      formatUploadTime,
      handleValidationSubmitted
    }
  }
}
</script>

<style scoped>
.progress {
  background-color: #e9ecef;
}

.alert ul {
  padding-left: 1.2rem;
}

pre {
  background-color: #f8f9fa;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #dee2e6;
  font-size: 0.75rem;
  max-height: 150px;
  overflow-y: auto;
}

.card-header .badge {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}
</style>