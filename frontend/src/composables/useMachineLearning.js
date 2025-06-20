import { ref, computed } from 'vue'

/**
 * Composable para integración con sistema de Machine Learning
 * Fase 3: Predicciones ML para identificación de rovellones
 */
export function useMachineLearning() {
  // Estado reactivo
  var isProcessing = ref(false)
  var lastPrediction = ref(null)
  var modelInfo = ref(null)
  var error = ref(null)

  // Estados computados
  var hasValidPrediction = computed(function() {
    return lastPrediction.value !== null && !error.value
  })

  var confidenceLevelColor = computed(function() {
    if (!hasValidPrediction.value) return 'secondary'
    
    var level = lastPrediction.value.prediction.confidenceLevel
    if (level === 'alta') return 'success'
    if (level === 'media') return 'warning' 
    return 'danger'
  })

  var isDogDetected = computed(function() {
    return hasValidPrediction.value && lastPrediction.value.prediction.isDog
  })

  /**
   * Envía imagen para predicción ML
   * @param {File} imageFile - Archivo de imagen
   * @returns {Object} Resultado de la predicción
   */
  async function predictImage(imageFile) {
    isProcessing.value = true
    error.value = null
    lastPrediction.value = null

    try {
      // Crear FormData para envío
      var formData = new FormData()
      
      // Si es un blob de cámara, darle un nombre con extensión
      if (imageFile instanceof Blob && !imageFile.name) {
        var file = new File([imageFile], 'camera-capture.jpg', { type: 'image/jpeg' })
        formData.append('image', file)
      } else {
        formData.append('image', imageFile)
      }

      // Realizar petición al endpoint de predicción
      var response = await fetch('http://localhost:3001/api/images/predict', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error en servidor: ' + response.status)
      }

      var result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Error en predicción')
      }

      // Guardar resultado
      lastPrediction.value = result.data
      
      console.log('✅ Predicción ML completada:', {
        clase: result.data.prediction.predictedClass,
        confianza: result.data.prediction.confidence,
        esDog: result.data.prediction.isDog
      })

      return result.data

    } catch (err) {
      error.value = err.message
      console.error('❌ Error en predicción ML:', err)
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Obtiene información del modelo ML actual
   */
  async function getModelInfo() {
    try {
      var response = await fetch('/api/images/model/info')
      
      if (!response.ok) {
        throw new Error('Error obteniendo info del modelo')
      }

      var result = await response.json()
      
      if (result.success) {
        modelInfo.value = result.data
        return result.data
      }
      
      throw new Error(result.message || 'Error en respuesta del modelo')
      
    } catch (err) {
      console.error('❌ Error obteniendo info del modelo:', err)
      throw err
    }
  }

  /**
   * Convierte nivel de confianza a texto descriptivo
   */
  function getConfidenceDescription(level) {
    var descriptions = {
      'alta': 'El modelo está muy seguro de esta predicción',
      'media': 'El modelo tiene confianza moderada en esta predicción', 
      'baja': 'El modelo tiene poca confianza en esta predicción'
    }
    return descriptions[level] || 'Nivel de confianza desconocido'
  }

  /**
   * Formatea porcentaje de confianza para mostrar
   */
  function formatConfidence(confidence) {
    if (confidence === null || confidence === undefined || isNaN(confidence)) {
      return '0.0%'
    }
    return (confidence * 100).toFixed(1) + '%'
  }

  /**
   * Resetea el estado de predicción
   */
  function resetPrediction() {
    lastPrediction.value = null
    error.value = null
    isProcessing.value = false
  }

  /**
   * Obtiene recomendaciones basadas en la predicción
   */
  function getPredictionRecommendations() {
    if (!hasValidPrediction.value) {
      return []
    }

    var prediction = lastPrediction.value.prediction
    var recommendations = []

    if (prediction.isDog) {
      if (prediction.confidenceLevel === 'alta') {
        recommendations.push('✅ Identificación positiva con alta confianza')
        recommendations.push('🐕 Características típicas caninas detectadas - estructura corporal y pelaje')
      } else {
        recommendations.push('⚠️ Posible perro detectado, pero con confianza limitada')
        recommendations.push('🔍 Se recomienda validación adicional')
      }
    } else {
      recommendations.push('🐱 Características felinas detectadas')
      recommendations.push('😸 Esta mascota parece ser un gato - estructura facial típica')
    }

    // Agregar advertencia educativa siempre
    recommendations.push('⚠️ IMPORTANTE: Esta es una herramienta educativa únicamente')
    recommendations.push('🩺 Para identificación veterinaria profesional, consulte con especialistas')

    return recommendations
  }

  // Exposición de la API del composable
  return {
    // Estado reactivo
    isProcessing,
    lastPrediction,
    modelInfo,
    error,
    
    // Computadas
    hasValidPrediction,
    confidenceLevelColor,
    isDogDetected,
    
    // Métodos
    predictImage,
    getModelInfo,
    getConfidenceDescription,
    formatConfidence,
    resetPrediction,
    getPredictionRecommendations
  }
}