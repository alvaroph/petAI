import { ref, computed } from 'vue'
import { useLocalModels } from './useLocalModels.js'

/**
 * Composable para integración con sistema de Machine Learning
 * Incluye modelos backend y locales (TensorFlow Lite style)
 */
export function useMachineLearning() {
  // Estado reactivo
  var isProcessing = ref(false)
  var lastPrediction = ref(null)
  var modelInfo = ref(null)
  var error = ref(null)
  var selectedModel = ref('backend') // 'backend', 'optimized', 'quantized'

  // Integrar modelos locales
  const {
    predictLocal,
    updatePerformanceStats,
    anyModelLoaded
  } = useLocalModels()

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
   * Cambia el modelo seleccionado
   * @param {string} modelType - Tipo de modelo ('backend', 'optimized', 'quantized')
   */
  function setSelectedModel(modelType) {
    selectedModel.value = modelType
    console.log(`🔄 Modelo cambiado a: ${modelType}`)
  }

  /**
   * Envía imagen para predicción ML usando el modelo seleccionado
   * @param {File} imageFile - Archivo de imagen
   * @returns {Object} Resultado de la predicción
   */
  async function predictImage(imageFile) {
    isProcessing.value = true
    error.value = null
    lastPrediction.value = null

    try {
      console.log(`🤖 Iniciando predicción con modelo: ${selectedModel.value}`)
      
      if (!imageFile) {
        throw new Error('No se proporcionó una imagen para analizar')
      }
      
      var result
      
      if (selectedModel.value === 'backend') {
        console.log('📡 Usando modelo backend...')
        result = await predictWithBackend(imageFile)
      } else {
        console.log(`💻 Usando modelo local: ${selectedModel.value}`)
        
        // Verificar que el modelo local esté disponible
        if (!anyModelLoaded.value) {
          throw new Error(`Modelo local ${selectedModel.value} no está cargado. Por favor, usa el modelo backend.`)
        }
        
        result = await predictWithLocal(imageFile)
      }
      
      if (!result || !result.prediction) {
        throw new Error('El modelo no devolvió un resultado válido')
      }
      
      lastPrediction.value = result
      console.log('✅ Predicción completada:', result)
      
      return result
      
    } catch (err) {
      console.error('❌ Error en predicción:', err)
      const errorMessage = err.message || 'Error desconocido en la predicción'
      error.value = errorMessage
      
      // Si el error es de modelo local, sugerir usar backend
      if (selectedModel.value !== 'backend' && errorMessage.includes('no está cargado')) {
        console.log('🔄 Sugiriendo fallback a modelo backend...')
      }
      
      throw new Error(errorMessage)
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Predicción usando backend
   */
  async function predictWithBackend(imageFile) {
    const startTime = performance.now()
    
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

      // Calcular tiempo de ejecución
      const executionTime = performance.now() - startTime
      
      // Añadir información del modelo y rendimiento
      result.data.model_info = {
        type: 'backend',
        location: 'servidor',
        execution_time: executionTime
      }
      
      // Actualizar estadísticas de rendimiento
      updatePerformanceStats('backend', executionTime)
      
      console.log('✅ Predicción ML completada:', {
        clase: result.data.prediction.predictedClass,
        confianza: result.data.prediction.confidence,
        esDog: result.data.prediction.isDog,
        tiempo: `${Math.round(executionTime)}ms`
      })

      return result.data

    } catch (err) {
      console.error('❌ Error en predicción backend:', err)
      throw err
    }
  }

  /**
   * Predicción usando modelos locales
   */
  async function predictWithLocal(imageFile) {
    try {
      const modelType = selectedModel.value // 'optimized' o 'quantized'
      const result = await predictLocal(imageFile, modelType)
      
      // Convertir formato local al formato esperado por el frontend
      const standardizedResult = {
        prediction: {
          predictedClass: result.prediction.class,
          confidence: result.prediction.confidence,
          isDog: result.prediction.class === 'dog',
          confidenceLevel: getConfidenceLevelFromValue(result.prediction.confidence),
          probabilities: result.prediction.probabilities || {
            dog: result.prediction.class === 'dog' ? result.prediction.confidence : 1 - result.prediction.confidence,
            cat: result.prediction.class === 'cat' ? result.prediction.confidence : 1 - result.prediction.confidence
          }
        },
        model_info: result.model_info,
        metadata: result.metadata
      }
      
      console.log('✅ Predicción local completada:', {
        modelo: modelType,
        clase: standardizedResult.prediction.predictedClass,
        confianza: standardizedResult.prediction.confidence,
        esDog: standardizedResult.prediction.isDog,
        tiempo: `${Math.round(result.model_info.execution_time)}ms`
      })
      
      return standardizedResult
      
    } catch (err) {
      console.error('❌ Error en predicción local:', err)
      throw err
    }
  }

  /**
   * Convierte valor de confianza a nivel
   */
  function getConfidenceLevelFromValue(confidence) {
    if (confidence >= 0.8) return 'alta'
    if (confidence >= 0.6) return 'media'
    return 'baja'
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
    selectedModel,
    
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
    getPredictionRecommendations,
    
    // Nuevos métodos para modelos múltiples
    setSelectedModel,
    predictWithBackend,
    predictWithLocal,
    getConfidenceLevelFromValue,
    
    // Integración con modelos locales
    anyModelLoaded
  }
}