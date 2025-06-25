<script>
import { ref } from 'vue'
import CameraCapture from '../components/CameraCapture.vue'
import ImagePreview from '../components/ImagePreview.vue'
import MLPredictionResult from '../components/MLPredictionResult.vue'
import FileUpload from '../components/FileUpload.vue'
import ModelSelector from '../components/ModelSelector.vue'
import { useImageUpload } from '../composables/useImageUpload.js'
import { useMachineLearning } from '../composables/useMachineLearning.js'

export default {
  name: 'HomeView',
  components: {
    CameraCapture,
    ImagePreview,
    MLPredictionResult,
    FileUpload,
    ModelSelector
  },
  setup() {
    // Estados del flujo de captura/análisis
    var currentStep = ref('intro') // intro, capture, upload, preview, analyzing, result
    var capturedImage = ref(null)
    var analysisResult = ref(null)
    var error = ref(null)

    // Usar composables
    var {
      isUploading,
      uploadProgress,
      uploadError,
      uploadImageFromBlob,
      resetUploadState
    } = useImageUpload()

    var {
      isProcessing,
      predictImage,
      resetPrediction,
      setSelectedModel
    } = useMachineLearning()

    // Manejador para selección de modelo
    function handleModelSelected(modelType) {
      setSelectedModel(modelType)
      console.log(`🔄 Modelo seleccionado: ${modelType}`)
    }

    // Iniciar captura de imagen
    function startCapture() {
      currentStep.value = 'capture'
      error.value = null
      capturedImage.value = null
      analysisResult.value = null
      resetUploadState()
      resetPrediction()
    }

    // Iniciar upload de archivo
    function startFileUpload() {
      currentStep.value = 'upload'
      error.value = null
      capturedImage.value = null
      analysisResult.value = null
      resetUploadState()
      resetPrediction()
    }

    // Manejar imagen capturada o archivo subido
    function handleImageCaptured(imageData) {
      capturedImage.value = imageData
      currentStep.value = 'preview'
      console.log('Imagen capturada:', imageData)
    }

    // Manejar archivo seleccionado
    function handleFileSelected(imageData) {
      capturedImage.value = imageData
      currentStep.value = 'preview'
      console.log('Archivo seleccionado:', imageData)
    }

    // Manejar error de upload de archivo
    function handleFileUploadError(errorMessage) {
      error.value = {
        title: 'Error de Archivo',
        message: errorMessage,
        code: 'FILE_UPLOAD_ERROR'
      }
      console.error('Error de archivo:', errorMessage)
    }

    // Manejar error de captura
    function handleCaptureError(captureError) {
      error.value = {
        title: 'Error de Cámara',
        message: captureError.message,
        code: captureError.code
      }
      console.error('Error de captura:', captureError)
    }

    // Retomar captura (volver a cámara)
    function handleRetakeImage() {
      // Limpiar imagen anterior
      if (capturedImage.value && capturedImage.value.url) {
        URL.revokeObjectURL(capturedImage.value.url)
      }

      capturedImage.value = null
      currentStep.value = 'capture'
    }

    // Analizar imagen con ML real - FASE 3
    async function handleAnalyzeImage(imageData) {
      currentStep.value = 'analyzing'
      error.value = null
      analysisResult.value = null
      resetPrediction()

      try {
        console.log('Iniciando análisis ML real...')

        // Usar ML real con TensorFlow.js
        // Usar file si está disponible (upload), sino usar blob (cámara)
        var imageToAnalyze = imageData.file || imageData.blob
        var prediction = await predictImage(imageToAnalyze)

        // Guardar resultado
        analysisResult.value = prediction
        currentStep.value = 'result'

        console.log('✅ Análisis ML completado:', prediction)

      } catch (err) {
        console.error('❌ Error en análisis ML:', err)

        error.value = {
          title: 'Error de Análisis ML',
          message: 'No se pudo completar el análisis con inteligencia artificial: ' + err.message,
          code: 'ML_ANALYSIS_FAILED'
        }

        // En lugar de ir directamente a intro, mantener en preview para poder reintentar
        currentStep.value = 'preview'
      }
    }

    // Volver al inicio
    function goToHome() {
      // Limpiar recursos
      if (capturedImage.value && capturedImage.value.url) {
        URL.revokeObjectURL(capturedImage.value.url)
      }

      currentStep.value = 'intro'
      capturedImage.value = null
      analysisResult.value = null
      error.value = null
      resetUploadState()
      resetPrediction()
    }

    // Enviar para validación experta (placeholder para Fase 4)
    function sendForExpertValidation() {
      if (!capturedImage.value) return

      console.log('Enviando imagen para validación experta...')

      // Usar composable de upload
      uploadImageFromBlob(
        capturedImage.value.blob,
        'captured_for_validation.jpg',
        {
          confidence: analysisResult.value ? analysisResult.value.prediction.confidence : null,
          notes: 'Enviado para validación experta desde análisis ML'
        }
      )
        .then(function(response) {
          console.log('Imagen enviada para validación:', response)
          // Mostrar mensaje de éxito
          alert('Imagen enviada exitosamente para validación experta. ¡Gracias por contribuir!')
        })
        .catch(function(err) {
          console.error('Error enviando para validación:', err)
          alert('Error enviando imagen. Intenta de nuevo.')
        })
    }

    return {
      // Estados
      currentStep,
      capturedImage,
      analysisResult,
      error,
      isUploading,
      uploadProgress,
      uploadError,
      isProcessing,

      // Métodos
      startCapture,
      startFileUpload,
      handleImageCaptured,
      handleFileSelected,
      handleFileUploadError,
      handleCaptureError,
      handleRetakeImage,
      handleAnalyzeImage,
      goToHome,
      sendForExpertValidation,
      handleModelSelected
    }
  }
}
</script>

<template>
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-lg-8">

        <!-- Selector de Modelo - Siempre visible -->
        <ModelSelector @model-selected="handleModelSelected" />

        <!-- ESTADO: Introducción -->
        <div v-if="currentStep === 'intro'">
          <!-- Hero Section -->
          <div class="text-center mb-5 hero-section">
            <h1 class="display-4 fw-bold mb-4">
              🐕 ¡Identifica Mascotas con IA!
            </h1>
            <p class="lead mb-4" style="color: var(--text-secondary); font-size: 1.25rem;">
              Usa tu cámara para capturar una imagen de una mascota y descubre si es un perro o gato
              con nuestra inteligencia artificial educativa.
            </p>
            <div class="alert alert-info" role="alert">
              <i class="bi bi-lightbulb-fill me-2"></i>
              <strong>Proyecto Educativo:</strong> Aprende sobre machine learning mientras clasificas mascotas
            </div>
          </div>

          <!-- Opciones de entrada -->
          <div class="row mb-4">
            <!-- Captura con cámara -->
            <div class="col-md-6 mb-3">
              <div class="card shadow border-0 h-100 option-card">
                <div class="card-header bg-success text-white">
                  <h5 class="card-title mb-0">
                    <i class="bi bi-camera-fill me-2"></i>
                    Usar Cámara
                  </h5>
                </div>
                <div class="card-body p-4 text-center d-flex flex-column justify-content-between">
                  <div>
                    <div class="mb-3">
                      <i class="bi bi-camera feature-icon" style="color: var(--secondary);"></i>
                    </div>
                    <h6 class="mb-3 fw-semibold">Captura en tiempo real</h6>
                    <p class="text-muted mb-4">
                      Toma una foto directamente de tu mascota para análisis inmediato
                    </p>
                  </div>
                  <button @click="startCapture" class="btn btn-success btn-lg w-100">
                    <i class="bi bi-camera-fill me-2"></i>
                    Iniciar Cámara
                  </button>
                </div>
              </div>
            </div>

            <!-- Upload de archivo -->
            <div class="col-md-6 mb-3">
              <div class="card shadow border-0 h-100 option-card">
                <div class="card-header bg-primary text-white">
                  <h5 class="card-title mb-0">
                    <i class="bi bi-upload me-2"></i>
                    Subir Archivo
                  </h5>
                </div>
                <div class="card-body p-4 text-center d-flex flex-column justify-content-between">
                  <div>
                    <div class="mb-3">
                      <i class="bi bi-folder2-open feature-icon" style="color: var(--primary);"></i>
                    </div>
                    <h6 class="mb-3 fw-semibold">Selecciona imagen</h6>
                    <p class="text-muted mb-4">
                      Sube una foto de tu mascota desde tu dispositivo (JPG, PNG, WEBP)
                    </p>
                  </div>
                  <button @click="startFileUpload" class="btn btn-primary btn-lg w-100">
                    <i class="bi bi-upload me-2"></i>
                    Subir Imagen
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Información adicional -->
          <div class="row">
            <div class="col-md-6 mb-3">
              <div class="card h-100 border-warning">
                <div class="card-body">
                  <h5 class="card-title text-warning">
                    <i class="bi bi-shield-check-fill me-2"></i>
                    Privacidad
                  </h5>
                  <p class="card-text">
                    El análisis se realiza de forma segura.
                    Tu privacidad y la de tus mascotas está protegida.
                  </p>
                </div>
              </div>
            </div>
            <div class="col-md-6 mb-3">
              <div class="card h-100 border-primary">
                <div class="card-body">
                  <h5 class="card-title text-primary">
                    <i class="bi bi-people-fill me-2"></i>
                    Validación Experta
                  </h5>
                  <p class="card-text">
                    Puedes enviar imágenes para validación por expertos veterinarios
                    y contribuir a mejorar el modelo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- MLOps Dashboard Access -->
          <div class="row mb-4">
            <div class="col-12">
              <div class="card mlops-access-card">
                <div class="card-body text-center">
                  <h5 class="card-title" style="color: var(--primary); font-weight: 600;">
                    <i class="bi bi-gear-fill me-2"></i>
                    Dashboard MLOps
                  </h5>
                  <p class="card-text" style="color: var(--text-secondary);">
                    Accede al panel completo de MLOps: reentrenamiento, A/B testing, métricas y deployment
                  </p>
                  <router-link to="/mlops" class="btn btn-primary">
                    <i class="bi bi-gear-fill me-2"></i>
                    Abrir Dashboard MLOps
                  </router-link>
                </div>
              </div>
            </div>
          </div>

          <!-- Pasos del proceso -->
          <div class="mt-5">
            <h3 class="text-center mb-5 fw-semibold" style="color: var(--text-primary);">¿Cómo funciona?</h3>
            <div class="row text-center">
              <div class="col-md-4 mb-4">
                <div class="process-step">
                  <div class="step-circle text-white mb-3" style="background: linear-gradient(135deg, var(--secondary) 0%, var(--secondary-hover) 100%);">1</div>
                  <h5 class="fw-semibold mb-2">Captura</h5>
                  <p class="text-muted">Toma una foto clara de tu mascota</p>
                </div>
              </div>
              <div class="col-md-4 mb-4">
                <div class="process-step">
                  <div class="step-circle text-white mb-3" style="background: linear-gradient(135deg, var(--warning) 0%, var(--yellow-600) 100%);">2</div>
                  <h5 class="fw-semibold mb-2">Análisis</h5>
                  <p class="text-muted">La IA analiza la imagen con deep learning</p>
                </div>
              </div>
              <div class="col-md-4 mb-4">
                <div class="process-step">
                  <div class="step-circle text-white mb-3" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);">3</div>
                  <h5 class="fw-semibold mb-2">Resultado</h5>
                  <p class="text-muted">Descubre si es perro o gato con confianza</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ESTADO: Captura de cámara -->
        <div v-if="currentStep === 'capture'">
          <div class="text-center mb-4">
            <h2 class="h3">📸 Captura de Imagen</h2>
            <p class="text-muted">Posiciona tu mascota en el centro y asegúrate de que esté bien iluminada</p>
          </div>

          <CameraCapture
            @image-captured="handleImageCaptured"
            @capture-error="handleCaptureError"
          />

          <div class="text-center mt-4">
            <button @click="goToHome" class="btn btn-outline-secondary">
              <i class="bi bi-arrow-left me-1"></i>
              Volver al inicio
            </button>
          </div>
        </div>

        <!-- ESTADO: Upload de archivo -->
        <div v-if="currentStep === 'upload'">
          <div class="text-center mb-4">
            <h2 class="h3">📁 Seleccionar Imagen</h2>
            <p class="text-muted">Arrastra una imagen de tu mascota o haz clic para seleccionar desde tu dispositivo</p>
          </div>

          <FileUpload
            @file-selected="handleFileSelected"
            @upload-error="handleFileUploadError"
          />

          <div class="text-center mt-4">
            <button @click="goToHome" class="btn btn-outline-secondary">
              <i class="bi bi-arrow-left me-1"></i>
              Volver al inicio
            </button>
          </div>
        </div>

        <!-- ESTADO: Preview de imagen -->
        <div v-if="currentStep === 'preview'">
          <div class="text-center mb-4">
            <h2 class="h3">🖼️ Imagen Capturada</h2>
            <p class="text-muted">Revisa la imagen y procede al análisis</p>
          </div>

          <ImagePreview
            :image-data="capturedImage"
            @retake-image="handleRetakeImage"
            @analyze-image="handleAnalyzeImage"
          />
        </div>

        <!-- ESTADO: Analizando con ML real -->
        <div v-if="currentStep === 'analyzing'">
          <div class="text-center analyzing-animation">
            <div class="mb-4">
              <div class="spinner-border mb-3" style="width: 4rem; height: 4rem; color: var(--primary);" role="status">
                <span class="visually-hidden">Analizando...</span>
              </div>
            </div>
            <h3 class="mb-3 fw-semibold" style="color: var(--primary);">🧠 Análisis con Inteligencia Artificial</h3>
            <p class="text-muted mb-4 fs-5">
              TensorFlow.js está procesando tu imagen con redes neuronales convolucionales
            </p>
            <div class="progress mb-4" style="height: 12px;">
              <div class="progress-bar progress-bar-striped progress-bar-animated"
                   role="progressbar" style="width: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);" 
                   aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
              </div>
            </div>
            <div class="row text-center mt-4">
              <div class="col-md-4">
                <i class="bi bi-cpu tech-icons text-success"></i>
                <div class="small text-muted mt-2 fw-medium">Preprocesamiento</div>
              </div>
              <div class="col-md-4">
                <i class="bi bi-diagram-3 tech-icons text-warning"></i>
                <div class="small text-muted mt-2 fw-medium">Red Neuronal</div>
              </div>
              <div class="col-md-4">
                <i class="bi bi-check-circle tech-icons text-info"></i>
                <div class="small text-muted mt-2 fw-medium">Clasificación</div>
              </div>
            </div>
            <small class="text-muted mt-3 d-block">El análisis ML puede tardar hasta 30 segundos...</small>
          </div>
        </div>

        <!-- ESTADO: Resultado con componente ML -->
        <div v-if="currentStep === 'result' && analysisResult">
          <div class="text-center mb-4">
            <h2 class="h3">🎯 Resultado del Análisis ML</h2>
            <p class="text-muted">Resultado obtenido con TensorFlow.js y redes neuronales</p>
          </div>

          <!-- Componente de resultado ML -->
          <MLPredictionResult
            :prediction="analysisResult"
            @new-analysis="goToHome"
          />

          <!-- Imagen analizada pequeña -->
          <div v-if="capturedImage" class="text-center mb-4">
            <div class="card">
              <div class="card-header">
                <h6 class="mb-0">
                  <i class="bi bi-image me-1"></i>
                  Imagen Analizada
                </h6>
              </div>
              <div class="card-body text-center">
                <img :src="capturedImage.url"
                     alt="Imagen analizada"
                     class="img-thumbnail"
                     style="max-height: 200px;">
              </div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="text-center">
            <div class="d-flex justify-content-center gap-3 flex-wrap">
              <button @click="goToHome" class="btn btn-success btn-lg">
                <i class="bi bi-arrow-counterclockwise me-2"></i>
                Analizar otra mascota
              </button>

              <button @click="sendForExpertValidation"
                      class="btn btn-outline-primary"
                      :disabled="isUploading">
                <span v-if="isUploading">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Enviando...
                </span>
                <span v-else>
                  <i class="bi bi-people me-2"></i>
                  Validación Experta
                </span>
              </button>
            </div>

            <div class="mt-3">
              <small class="text-muted">
                La validación experta ayuda a mejorar la precisión del modelo ML
              </small>
            </div>
          </div>
        </div>

        <!-- ESTADO: Error general -->
        <div v-if="error" class="alert alert-danger">
          <h5 class="alert-heading">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            {{ error.title }}
          </h5>
          <p class="mb-3">{{ error.message }}</p>
          <div class="d-flex gap-2">
            <button @click="goToHome" class="btn btn-outline-danger btn-sm">
              Volver al inicio
            </button>
            <button v-if="error.code === 'CAPTURE_FAILED'"
                    @click="handleRetakeImage"
                    class="btn btn-danger btn-sm">
              Intentar de nuevo
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.step-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 auto;
  box-shadow: var(--shadow-md);
}

.display-4 {
  background: linear-gradient(135deg, var(--primary) 0%, var(--blue-500) 50%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.option-card {
  cursor: pointer;
  min-height: 320px;
  border: 2px solid var(--border);
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.option-card:hover {
  border-color: var(--primary);
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--bg-primary) 100%);
}

.card-header.bg-success {
  background: linear-gradient(135deg, var(--secondary) 0%, var(--secondary-hover) 100%) !important;
  border: none;
  color: white;
}

.card-header.bg-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%) !important;
  border: none;
  color: white;
}

.card-header.bg-info {
  background: linear-gradient(135deg, var(--info) 0%, var(--blue-600) 100%) !important;
  border: none;
  color: white;
}

.hero-section {
  padding: 3rem 0;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--primary-light) 100%);
  border-radius: 16px;
  margin-bottom: 2rem;
}

.feature-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  opacity: 0.8;
  transition: all 0.3s ease;
}

.option-card:hover .feature-icon {
  opacity: 1;
  transform: scale(1.1);
}

.process-step {
  padding: 2rem 1rem;
  border-radius: 12px;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
}

.process-step:hover {
  background: var(--primary-light);
  transform: translateY(-4px);
}

.mlops-access-card {
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--secondary-light) 100%);
  border: 2px solid var(--primary);
}

.analyzing-animation {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--primary-light) 100%);
  border-radius: 16px;
  padding: 3rem;
}

.tech-icons {
  color: var(--text-muted);
  font-size: 2.5rem;
  transition: all 0.3s ease;
}

.tech-icons.text-success { color: var(--secondary) !important; }
.tech-icons.text-warning { color: var(--warning) !important; }
.tech-icons.text-info { color: var(--info) !important; }
</style>
