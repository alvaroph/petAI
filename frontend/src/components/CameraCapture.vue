<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useCamera } from '../composables/useCamera.js'

export default {
  name: 'CameraCapture',
  emits: ['image-captured', 'capture-error'],
  setup(props, { emit }) {
    // Referencias del DOM
    var videoRef = ref(null)
    
    // Usar composable de cámara
    var {
      isSupported,
      isPermissionGranted,
      isStreamActive,
      isLoading,
      error,
      stream,
      cameraConfig,
      requestPermission,
      captureImage,
      stopCamera,
      switchCamera,
      getAvailableCameras,
      cleanup
    } = useCamera()
    
    // Estados del componente
    var showVideo = ref(false)
    var availableCameras = ref([])
    var hasMultipleCameras = ref(false)
    
    // Inicializar cámara
    async function initCamera() {
      try {
        console.log('🔄 Inicializando cámara...')
        
        if (!isSupported.value) {
          throw new Error('Cámara no soportada en este navegador')
        }
        
        const mediaStream = await requestPermission()
        console.log('✅ Permisos obtenidos, stream:', mediaStream)
        
        // Asignar stream al elemento video
        if (videoRef.value && mediaStream) {
          console.log('🎥 Asignando stream al video element:', videoRef.value)
          videoRef.value.srcObject = mediaStream
          showVideo.value = true
          console.log('✅ Video stream asignado, showVideo:', showVideo.value)
          
          // Esperar a que el video esté listo y forzar reproducción
          videoRef.value.onloadedmetadata = () => {
            console.log('📱 Video metadata loaded, starting playback')
            videoRef.value.play().then(() => {
              console.log('▶️ Video playback started successfully')
            }).catch((playError) => {
              console.error('❌ Video play error:', playError)
            })
          }
          
          // También intentar reproducir inmediatamente
          videoRef.value.play().catch((err) => {
            console.warn('⚠️ Immediate play failed (normal):', err.message)
          })
        } else {
          console.error('❌ No videoRef or mediaStream:', { videoRef: !!videoRef.value, mediaStream: !!mediaStream })
        }
        
        // Obtener información de cámaras disponibles
        try {
          const cameras = await getAvailableCameras()
          availableCameras.value = cameras
          hasMultipleCameras.value = cameras.length > 1
          console.log('🎥 Cámaras disponibles:', cameras.length)
        } catch (err) {
          console.warn('⚠️ No se pudieron obtener cámaras disponibles:', err)
        }
        
      } catch (err) {
        console.error('❌ Error inicializando cámara:', err)
        error.value = err
        emit('capture-error', {
          code: err.code || 'CAMERA_INIT_ERROR',
          message: err.message || 'Error inicializando cámara'
        })
      }
    }
    
    // Capturar imagen
    function handleCapture() {
      if (!videoRef.value || !isStreamActive.value) {
        var captureError = {
          code: 'NO_VIDEO',
          message: 'Video no disponible para captura'
        }
        emit('capture-error', captureError)
        return
      }
      
      captureImage(videoRef.value)
        .then(function(imageBlob) {
          // Crear URL temporal para preview
          var imageUrl = URL.createObjectURL(imageBlob)
          
          // Emitir evento con imagen capturada
          emit('image-captured', {
            blob: imageBlob,
            url: imageUrl,
            timestamp: new Date().toISOString(),
            size: imageBlob.size,
            type: imageBlob.type
          })
          
          console.log('Imagen capturada exitosamente')
        })
        .catch(function(err) {
          console.error('Error capturando imagen:', err)
          emit('capture-error', {
            code: 'CAPTURE_FAILED',
            message: 'No se pudo capturar la imagen: ' + err.message
          })
        })
    }
    
    // Cambiar cámara
    function handleSwitchCamera() {
      if (!hasMultipleCameras.value) {
        return
      }
      
      switchCamera()
        .then(function(newStream) {
          if (videoRef.value) {
            videoRef.value.srcObject = newStream
          }
          console.log('Cámara cambiada exitosamente')
        })
        .catch(function(err) {
          console.error('Error cambiando cámara:', err)
          emit('capture-error', {
            code: 'SWITCH_FAILED',
            message: 'No se pudo cambiar de cámara: ' + err.message
          })
        })
    }
    
    // Detener cámara
    function handleStopCamera() {
      stopCamera()
      showVideo.value = false
    }
    
    // Reintentar acceso a cámara
    function retryCamera() {
      error.value = null
      initCamera()
    }
    
    // Lifecycle hooks
    onMounted(function() {
      console.log('🔄 CameraCapture mounted, videoRef:', videoRef.value)
      // Auto-inicializar si está soportado
      if (isSupported.value) {
        // Pequeño delay para asegurar que el DOM esté completamente renderizado
        setTimeout(() => {
          console.log('⏰ Delayed init, videoRef now:', videoRef.value)
          initCamera()
        }, 100)
      }
    })
    
    onUnmounted(function() {
      cleanup()
    })
    
    return {
      // Referencias
      videoRef,
      
      // Estados de cámara
      isSupported,
      isPermissionGranted,
      isStreamActive,
      isLoading,
      error,
      showVideo,
      hasMultipleCameras,
      availableCameras,
      cameraConfig,
      
      // Métodos
      initCamera,
      handleCapture,
      handleSwitchCamera,
      handleStopCamera,
      retryCamera
    }
  }
}
</script>

<template>
  <div class="camera-capture">
    <!-- Debug info -->
    <div class="debug-info mb-2" style="font-size: 0.8rem; color: #666;">
      Debug: isSupported={{isSupported}}, isLoading={{isLoading}}, error={{!!error}}, showVideo={{showVideo}}, isStreamActive={{isStreamActive}}
    </div>
    
    <!-- Estado: Cámara no soportada -->
    <div v-if="!isSupported" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>Cámara no soportada</strong>
      <p class="mb-0 mt-2">Tu navegador no soporta acceso a cámara. Usa un navegador moderno como Chrome, Firefox o Safari.</p>
    </div>
    
    <!-- Estado: Cargando permisos -->
    <div v-else-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-success mb-3" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
      <h5 class="text-muted">Solicitando acceso a cámara...</h5>
      <p class="text-muted">Por favor, permite el acceso cuando se solicite</p>
    </div>
    
    <!-- Estado: Error de cámara -->
    <div v-else-if="error" class="alert alert-warning">
      <i class="bi bi-camera-video-off-fill me-2"></i>
      <strong>{{ error.code }}</strong>
      <p class="mb-2 mt-2">{{ error.message }}</p>
      <p v-if="error.userAction" class="mb-3 small text-muted">
        <strong>Solución:</strong> {{ error.userAction }}
      </p>
      <button @click="retryCamera" class="btn btn-outline-warning btn-sm">
        <i class="bi bi-arrow-clockwise me-1"></i>
        Intentar de nuevo
      </button>
    </div>
    
    <!-- Estado: Cámara activa - SIMPLIFICADO -->
    <div v-else-if="showVideo" class="camera-active">
      <!-- Debug info para video -->
      <div class="debug-info mb-2" style="font-size: 0.8rem; color: #666;">
        Video Debug: hasVideoRef={{!!videoRef}}, videoSrcObject={{!!(videoRef && videoRef.srcObject)}}
      </div>
      
      <!-- Video feed -->
      <div class="video-container position-relative">
        <video
          ref="videoRef"
          autoplay
          playsinline
          muted
          webkit-playsinline
          controls="false"
          class="video-feed"
          style="background-color: #000; min-height: 200px;"
        ></video>
        
        <!-- Overlay con guías -->
        <div class="camera-overlay">
          <div class="capture-guide">
            <div class="guide-corners"></div>
            <p class="guide-text">Centra la mascota aquí</p>
          </div>
        </div>
        
        <!-- Controles de cámara -->
        <div class="camera-controls">
          <!-- Botón cambiar cámara -->
          <button
            v-if="hasMultipleCameras"
            @click="handleSwitchCamera"
            class="btn btn-outline-light btn-sm"
            title="Cambiar cámara"
          >
            <i class="bi bi-arrow-repeat"></i>
          </button>
          
          <!-- Información de cámara -->
          <div class="camera-info">
            <small class="text-light">
              {{ cameraConfig.video.facingMode === 'environment' ? 'Cámara trasera' : 'Cámara frontal' }}
            </small>
          </div>
        </div>
      </div>
      
      <!-- Botones de acción -->
      <div class="action-buttons text-center mt-3">
        <div class="d-flex justify-content-center gap-3">
          <button @click="handleStopCamera" class="btn btn-outline-secondary">
            <i class="bi bi-x-circle me-1"></i>
            Cerrar
          </button>
          
          <button @click="handleCapture" class="btn btn-success btn-lg capture-btn">
            <i class="bi bi-camera-fill me-2"></i>
            Capturar
          </button>
        </div>
        
        <div class="mt-2">
          <small class="text-muted">
            Asegúrate de que la mascota esté bien iluminada y enfocada
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.camera-capture {
  max-width: 600px;
  margin: 0 auto;
}

.video-container {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.video-feed {
  width: 100%;
  height: auto;
  display: block;
  background-color: #000;
}

.camera-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.capture-guide {
  position: relative;
  width: 280px;
  height: 280px;
  border: 2px dashed rgba(255,255,255,0.8);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guide-corners::before,
.guide-corners::after {
  content: '';
  position: absolute;
  width: 30px;
  height: 30px;
  border: 3px solid #FF8F00;
}

.guide-corners::before {
  top: -3px;
  left: -3px;
  border-right: none;
  border-bottom: none;
}

.guide-corners::after {
  bottom: -3px;
  right: -3px;
  border-left: none;
  border-top: none;
}

.guide-text {
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
  font-weight: 600;
  margin: 0;
  background: rgba(0,0,0,0.5);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.camera-controls {
  position: absolute;
  top: 15px;
  right: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}

.camera-info {
  background: rgba(0,0,0,0.6);
  padding: 4px 8px;
  border-radius: 12px;
}

.capture-btn {
  min-width: 140px;
  padding: 12px 24px;
  font-weight: 600;
  border-radius: 50px;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
}

.capture-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(46, 125, 50, 0.4);
}

.action-buttons {
  margin-top: 20px;
}

/* Responsive */
@media (max-width: 768px) {
  .camera-capture {
    padding: 0 10px;
  }
  
  .capture-guide {
    width: 200px;
    height: 200px;
  }
  
  .guide-text {
    font-size: 0.8rem;
    padding: 6px 12px;
  }
  
  .capture-btn {
    min-width: 120px;
    padding: 10px 20px;
  }
}

/* Animaciones */
.video-feed {
  transition: all 0.3s ease;
}

.btn {
  transition: all 0.3s ease;
}

.alert {
  border-radius: 12px;
}

.spinner-border {
  width: 3rem;
  height: 3rem;
}
</style>