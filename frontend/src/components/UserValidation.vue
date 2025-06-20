<template>
  <div class="user-validation-container">
    <!-- Encabezado de validación -->
    <div class="validation-header text-center mb-4">
      <h4 class="mb-2">
        <i class="bi bi-person-check-fill text-primary me-2"></i>
        ¿Es correcta la predicción?
      </h4>
      <p class="text-muted small">
        Tu respuesta nos ayuda a mejorar la precisión del modelo de IA
      </p>
    </div>

    <!-- Resumen de la predicción -->
    <div class="prediction-summary mb-4">
      <div class="card border-info">
        <div class="card-body p-3">
          <div class="row align-items-center">
            <div class="col-auto">
              <div class="prediction-icon">
                {{ prediction.isDog ? '🐕' : '🐱' }}
              </div>
            </div>
            <div class="col">
              <h6 class="mb-1">
                La IA detectó: <strong>{{ prediction.isDog ? 'Perro' : 'Gato' }}</strong>
              </h6>
              <div class="confidence-info">
                <small class="text-muted">
                  Confianza: {{ formatConfidence(prediction.confidence) }}
                  <span class="badge" :class="getConfidenceBadgeClass(prediction.confidenceLevel)">
                    {{ prediction.confidenceLevel }}
                  </span>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estado de validación -->
    <div v-if="!isSubmitted && !isSubmitting" class="validation-actions">
      <!-- Pregunta principal -->
      <div class="question-section mb-4">
        <h5 class="text-center mb-3">
          ¿La IA identificó correctamente tu mascota?
        </h5>
        
        <!-- Botones de validación -->
        <div class="validation-buttons d-flex gap-3 justify-content-center">
          <!-- Botón Correcto -->
          <button 
            @click="handleValidation('correct')"
            class="btn btn-success btn-lg validation-btn"
            :disabled="isSubmitting">
            <i class="bi bi-check-circle-fill me-2"></i>
            <div class="btn-content">
              <div class="btn-title">¡Correcto!</div>
              <div class="btn-subtitle">{{ prediction.isDog ? 'Es un perro' : 'Es un gato' }}</div>
            </div>
          </button>

          <!-- Botón Incorrecto -->
          <button 
            @click="handleValidation('incorrect')"
            class="btn btn-danger btn-lg validation-btn"
            :disabled="isSubmitting">
            <i class="bi bi-x-circle-fill me-2"></i>
            <div class="btn-content">
              <div class="btn-title">Incorrecto</div>
              <div class="btn-subtitle">{{ prediction.isDog ? 'Es un gato' : 'Es un perro' }}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- A/B Test Info (if applicable) -->
      <div v-if="abTestInfo" class="ab-test-info mb-3">
        <div class="alert alert-info border-info" role="alert">
          <div class="row align-items-center">
            <div class="col-auto">
              <i class="fas fa-flask text-info fs-5"></i>
            </div>
            <div class="col">
              <small class="text-info mb-1 d-block">
                <strong>Participando en Test A/B</strong>
              </small>
              <div class="small text-muted">
                Test ID: {{ abTestInfo.testId }} | Grupo: {{ abTestInfo.group }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Información adicional -->
      <div class="info-section">
        <div class="alert alert-light border" role="alert">
          <div class="row align-items-center">
            <div class="col-auto">
              <i class="bi bi-info-circle text-primary fs-4"></i>
            </div>
            <div class="col">
              <h6 class="mb-1">¿Por qué es importante tu validación?</h6>
              <ul class="mb-0 small">
                <li>Ayuda a entrenar mejor el modelo de IA</li>
                <li>Mejora la precisión para futuros usuarios</li>
                <li>Contribuye al aprendizaje automático educativo</li>
                <li v-if="abTestInfo">Contribuye a comparar diferentes versiones del modelo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estado enviando -->
    <div v-if="isSubmitting" class="submitting-state text-center py-4">
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Enviando validación...</span>
      </div>
      <h5 class="text-primary">Guardando tu validación...</h5>
      <p class="text-muted">Procesando tu respuesta</p>
    </div>

    <!-- Estado completado -->
    <div v-if="isSubmitted && validationResult" class="submitted-state text-center py-4">
      <div class="success-icon mb-3">
        <i class="bi bi-check-circle-fill text-success fs-1"></i>
      </div>
      
      <h5 class="text-success mb-3">¡Validación enviada!</h5>
      
      <div class="thanks-message mb-4">
        <div class="alert alert-success border-success">
          <strong>{{ validationResult.thanksMessage }}</strong>
        </div>
      </div>

      <!-- Información de impacto -->
      <div class="impact-info">
        <div class="row justify-content-center">
          <div class="col-md-8">
            <div class="card border-success">
              <div class="card-body">
                <h6 class="card-title">
                  <i class="bi bi-graph-up-arrow me-2"></i>
                  Impacto de tu validación
                </h6>
                <div class="row text-center">
                  <div class="col-6">
                    <div class="metric">
                      <div class="metric-value text-success">
                        {{ validationResult.aiWasCorrect ? '+1' : '±0' }}
                      </div>
                      <div class="metric-label small text-muted">
                        Precisión IA
                      </div>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="metric">
                      <div class="metric-value text-primary">+1</div>
                      <div class="metric-label small text-muted">
                        Datos Entrenamiento
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Botón para nueva validación -->
      <div class="mt-4">
        <button @click="$emit('new-analysis')" class="btn btn-primary">
          <i class="bi bi-arrow-repeat me-2"></i>
          Analizar otra mascota
        </button>
      </div>
    </div>

    <!-- Estado de error -->
    <div v-if="error" class="error-state">
      <div class="alert alert-danger" role="alert">
        <h5 class="alert-heading">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Error enviando validación
        </h5>
        <p class="mb-3">{{ error }}</p>
        <div class="d-flex gap-2">
          <button @click="retryValidation" class="btn btn-outline-danger btn-sm">
            <i class="bi bi-arrow-clockwise me-1"></i>
            Reintentar
          </button>
          <button @click="clearError" class="btn btn-danger btn-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'UserValidation',
  
  props: {
    prediction: {
      type: Object,
      required: true
    },
    imageId: {
      type: String,
      required: true
    },
    abTestInfo: {
      type: Object,
      default: null
    }
  },

  emits: ['validation-submitted', 'new-analysis'],

  setup(props, { emit }) {
    // Estado reactivo
    var isSubmitting = ref(false)
    var isSubmitted = ref(false)
    var validationResult = ref(null)
    var error = ref(null)
    var lastValidationAttempt = ref(null)

    // Formatear porcentaje de confianza
    function formatConfidence(confidence) {
      return (confidence * 100).toFixed(1) + '%'
    }

    // Obtener clase CSS para badge de confianza
    function getConfidenceBadgeClass(level) {
      if (level === 'alta') return 'bg-success'
      if (level === 'media') return 'bg-warning text-dark'
      return 'bg-danger'
    }

    // Manejar validación del usuario
    async function handleValidation(userResponse) {
      if (isSubmitting.value || isSubmitted.value) return

      isSubmitting.value = true
      error.value = null
      lastValidationAttempt.value = userResponse

      try {
        console.log('Enviando validación:', {
          imageId: props.imageId,
          userValidation: userResponse,
          aiPrediction: props.prediction
        })

        var response = await fetch('http://localhost:3001/api/images/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageId: props.imageId,
            userValidation: userResponse,
            aiPrediction: props.prediction
          })
        })

        if (!response.ok) {
          throw new Error('Error del servidor: ' + response.status)
        }

        var result = await response.json()

        if (!result.success) {
          throw new Error(result.message || 'Error procesando validación')
        }

        // Guardar resultado y marcar como completado
        validationResult.value = result.data
        isSubmitted.value = true

        console.log('✅ Validación enviada exitosamente:', result.data)

        // Record A/B test feedback if applicable
        if (props.abTestInfo) {
          try {
            var actualLabel = userResponse === 'correct' ? 
              props.prediction.predictedClass : 
              (props.prediction.predictedClass === 'dog' ? 'cat' : 'dog')
            
            await fetch(`http://localhost:3001/api/images/ab-tests/${props.abTestInfo.testId}/feedback`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId: props.abTestInfo.userId || 'anonymous',
                actualLabel: actualLabel,
                aiPrediction: props.prediction.predictedClass,
                group: props.abTestInfo.group
              })
            })
            
            console.log('✅ A/B test feedback recorded')
          } catch (abError) {
            console.warn('⚠️ Failed to record A/B test feedback:', abError)
            // Don't fail the whole validation for A/B test issues
          }
        }

        // Emitir evento para componente padre
        emit('validation-submitted', {
          userResponse: userResponse,
          result: result.data,
          prediction: props.prediction,
          abTestInfo: props.abTestInfo
        })

      } catch (err) {
        console.error('❌ Error enviando validación:', err)
        error.value = err.message
      } finally {
        isSubmitting.value = false
      }
    }

    // Reintentar validación
    function retryValidation() {
      if (lastValidationAttempt.value) {
        error.value = null
        handleValidation(lastValidationAttempt.value)
      }
    }

    // Limpiar error
    function clearError() {
      error.value = null
      lastValidationAttempt.value = null
    }

    return {
      // Estado
      isSubmitting,
      isSubmitted,
      validationResult,
      error,
      
      // Métodos
      formatConfidence,
      getConfidenceBadgeClass,
      handleValidation,
      retryValidation,
      clearError
    }
  }
}
</script>

<style scoped>
.user-validation-container {
  max-width: 600px;
  margin: 0 auto;
}

.prediction-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.validation-buttons {
  flex-wrap: wrap;
}

.validation-btn {
  min-width: 180px;
  padding: 1rem;
  border-radius: 12px;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.validation-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

.validation-btn.btn-success:hover {
  border-color: #198754;
}

.validation-btn.btn-danger:hover {
  border-color: #dc3545;
}

.btn-content {
  text-align: center;
}

.btn-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.btn-subtitle {
  font-size: 0.85rem;
  opacity: 0.9;
}

.success-icon i {
  animation: checkmark 0.6s ease-in-out;
}

@keyframes checkmark {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.metric-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.confidence-info .badge {
  font-size: 0.7rem;
  margin-left: 0.5rem;
}

.question-section {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  padding: 2rem;
  border: 1px solid #dee2e6;
}

.info-section .alert {
  background: rgba(13, 110, 253, 0.05);
}

.impact-info .metric {
  padding: 0.5rem;
}

/* Responsive */
@media (max-width: 576px) {
  .validation-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .validation-btn {
    width: 100%;
    max-width: 280px;
  }
  
  .question-section {
    padding: 1.5rem;
  }
}
</style>