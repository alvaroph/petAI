import { ref, reactive, computed } from 'vue'
import * as tf from '@tensorflow/tfjs'

export function useLocalModels() {
  // Estado reactivo
  const isLoading = ref(false)
  const error = ref(null)
  const modelsLoaded = ref({
    optimized: false,
    quantized: false
  })
  
  // Modelos cargados
  const models = reactive({
    optimized: null,
    quantized: null
  })
  
  // Metadata de los modelos
  const modelsMetadata = ref(null)
  
  // Estadísticas de rendimiento
  const performanceStats = reactive({
    backend: { avgTime: null, lastTime: null },
    optimized: { avgTime: null, lastTime: null },
    quantized: { avgTime: null, lastTime: null }
  })

  // Estado computado
  const anyModelLoaded = computed(() => 
    modelsLoaded.value.optimized || modelsLoaded.value.quantized
  )

  /**
   * Carga los modelos locales
   */
  async function loadLocalModels() {
    try {
      isLoading.value = true
      error.value = null
      
      console.log('🔄 Cargando modelos locales...')
      
      // Cargar metadata primero
      await loadModelsMetadata()
      
      // Cargar modelo optimizado
      try {
        console.log('📦 Cargando modelo optimizado...')
        models.optimized = await tf.loadLayersModel('/models/pet_model_lite/model.json')
        modelsLoaded.value.optimized = true
        console.log('✅ Modelo optimizado cargado')
      } catch (err) {
        console.warn('⚠️ No se pudo cargar modelo optimizado:', err.message)
      }
      
      // Cargar modelo quantizado
      try {
        console.log('📦 Cargando modelo quantizado...')
        models.quantized = await tf.loadLayersModel('/models/pet_model_quantized/model.json')
        modelsLoaded.value.quantized = true
        console.log('✅ Modelo quantizado cargado')
      } catch (err) {
        console.warn('⚠️ No se pudo cargar modelo quantizado:', err.message)
      }
      
      if (!anyModelLoaded.value) {
        throw new Error('No se pudo cargar ningún modelo local')
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ Error cargando modelos locales:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Carga la metadata de los modelos
   */
  async function loadModelsMetadata() {
    try {
      const response = await fetch('/models/models_metadata.json')
      if (response.ok) {
        modelsMetadata.value = await response.json()
        console.log('📋 Metadata de modelos cargada')
      }
    } catch (err) {
      console.warn('⚠️ No se pudo cargar metadata:', err.message)
    }
  }

  /**
   * Predice usando modelo local
   */
  async function predictLocal(imageData, modelType = 'optimized') {
    if (!models[modelType]) {
      throw new Error(`Modelo ${modelType} no está cargado`)
    }

    const startTime = performance.now()
    
    try {
      // Preprocesar imagen
      const tensor = await preprocessImage(imageData)
      
      // Realizar predicción
      const prediction = models[modelType].predict(tensor)
      const probabilities = await prediction.data()
      
      // Procesar resultados
      const result = {
        prediction: {
          class: probabilities[1] > probabilities[0] ? 'dog' : 'cat',
          confidence: Math.max(probabilities[0], probabilities[1]),
          probabilities: {
            cat: probabilities[0],
            dog: probabilities[1]
          }
        },
        model_info: {
          type: modelType,
          location: 'frontend',
          execution_time: performance.now() - startTime
        },
        metadata: modelsMetadata.value?.models?.[`frontend_${modelType}`] || null
      }
      
      // Actualizar estadísticas
      updatePerformanceStats(modelType, result.model_info.execution_time)
      
      // Limpiar tensores
      tensor.dispose()
      prediction.dispose()
      
      return result
      
    } catch (err) {
      throw new Error(`Error en predicción local: ${err.message}`)
    }
  }

  /**
   * Preprocesa la imagen para el modelo
   */
  async function preprocessImage(imageData) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        try {
          // Crear canvas para redimensionar
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          canvas.width = 224
          canvas.height = 224
          
          // Dibujar imagen redimensionada
          ctx.drawImage(img, 0, 0, 224, 224)
          
          // Convertir a tensor
          const tensor = tf.browser.fromPixels(canvas)
            .reshaped([1, 224, 224, 3])
            .cast('float32')
            .div(255.0) // Normalizar [0,1]
          
          resolve(tensor)
        } catch (err) {
          reject(err)
        }
      }
      
      img.onerror = () => reject(new Error('Error cargando imagen'))
      
      // Manejar diferentes tipos de entrada
      if (imageData instanceof File) {
        const reader = new FileReader()
        reader.onload = e => img.src = e.target.result
        reader.readAsDataURL(imageData)
      } else if (imageData instanceof Blob) {
        img.src = URL.createObjectURL(imageData)
      } else if (typeof imageData === 'string') {
        img.src = imageData
      } else {
        reject(new Error('Tipo de imagen no soportado'))
      }
    })
  }

  /**
   * Actualiza estadísticas de rendimiento
   */
  function updatePerformanceStats(modelType, executionTime) {
    const stats = performanceStats[modelType]
    
    stats.lastTime = executionTime
    
    if (stats.avgTime === null) {
      stats.avgTime = executionTime
    } else {
      // Media móvil simple
      stats.avgTime = (stats.avgTime * 0.8) + (executionTime * 0.2)
    }
  }

  /**
   * Compara rendimiento entre modelos
   */
  function getPerformanceComparison() {
    return {
      backend: {
        name: 'Servidor (Completo)',
        avgTime: performanceStats.backend.avgTime,
        lastTime: performanceStats.backend.lastTime,
        relative: 1.0
      },
      optimized: {
        name: 'Local (Optimizado)',
        avgTime: performanceStats.optimized.avgTime,
        lastTime: performanceStats.optimized.lastTime,
        relative: performanceStats.backend.avgTime && performanceStats.optimized.avgTime 
          ? performanceStats.backend.avgTime / performanceStats.optimized.avgTime 
          : null
      },
      quantized: {
        name: 'Local (Quantizado)',
        avgTime: performanceStats.quantized.avgTime,
        lastTime: performanceStats.quantized.lastTime,
        relative: performanceStats.backend.avgTime && performanceStats.quantized.avgTime 
          ? performanceStats.backend.avgTime / performanceStats.quantized.avgTime 
          : null
      }
    }
  }

  /**
   * Obtiene información de los modelos disponibles
   */
  function getAvailableModels() {
    return [
      {
        id: 'backend',
        name: 'Servidor (Completo)',
        available: true, // Siempre disponible
        description: 'Modelo completo ejecutado en servidor',
        pros: ['Máxima precisión', 'Modelo actualizado', 'Sin limitaciones de hardware'],
        cons: ['Requiere conexión', 'Mayor latencia', 'Datos enviados al servidor']
      },
      {
        id: 'optimized',
        name: 'Local (Optimizado)',
        available: modelsLoaded.value.optimized,
        description: 'Modelo optimizado ejecutado en navegador',
        pros: ['Sin conexión requerida', 'Datos privados', 'Baja latencia'],
        cons: ['Menor precisión', 'Consume recursos locales', 'Descarga inicial']
      },
      {
        id: 'quantized',
        name: 'Local (TFLite-style)',
        available: modelsLoaded.value.quantized,
        description: 'Modelo ultra-ligero simulando TensorFlow Lite',
        pros: ['Muy rápido', 'Mínimo uso de memoria', 'Ideal para móviles'],
        cons: ['Precisión reducida', 'Funcionalidad limitada']
      }
    ]
  }

  /**
   * Limpia recursos
   */
  function cleanup() {
    if (models.optimized) {
      models.optimized.dispose()
      models.optimized = null
    }
    if (models.quantized) {
      models.quantized.dispose()
      models.quantized = null
    }
    modelsLoaded.value.optimized = false
    modelsLoaded.value.quantized = false
  }

  return {
    // Estado
    isLoading,
    error,
    modelsLoaded,
    anyModelLoaded,
    modelsMetadata,
    performanceStats,
    
    // Métodos
    loadLocalModels,
    predictLocal,
    getPerformanceComparison,
    getAvailableModels,
    updatePerformanceStats,
    cleanup
  }
}