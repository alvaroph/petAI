<script>
import { ref, computed, onUnmounted } from 'vue'

export default {
  name: 'ImagePreview',
  props: {
    imageData: {
      type: Object,
      required: true,
      validator: function(value) {
        return value && (value.url || value.blob)
      }
    },
    showActions: {
      type: Boolean,
      default: true
    },
    allowRetake: {
      type: Boolean,
      default: true
    },
    allowAnalyze: {
      type: Boolean,
      default: true
    }
  },
  emits: ['retake-image', 'analyze-image', 'image-deleted'],
  setup(props, { emit }) {
    // Estados del componente
    var isFullscreen = ref(false)
    var imageLoaded = ref(false)
    var imageError = ref(false)
    
    // Computed properties
    var imageUrl = computed(function() {
      return props.imageData.url || (props.imageData.blob ? URL.createObjectURL(props.imageData.blob) : null)
    })
    
    var imageSizeFormatted = computed(function() {
      if (!props.imageData.size) return 'Tamaño desconocido'
      
      var bytes = props.imageData.size
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
      return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB'
    })
    
    var captureTimeFormatted = computed(function() {
      if (!props.imageData.timestamp) return 'Hora desconocida'
      
      var date = new Date(props.imageData.timestamp)
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    })
    
    var imageSource = computed(function() {
      return props.imageData.source || 'camera'
    })
    
    var sourceLabel = computed(function() {
      return imageSource.value === 'file-upload' ? 'Archivo subido' : 'Capturada'
    })
    
    var originalFileName = computed(function() {
      if (props.imageData.metadata && props.imageData.metadata.originalName) {
        return props.imageData.metadata.originalName
      }
      return null
    })
    
    // Métodos
    function handleRetake() {
      // Limpiar URL temporal si existe
      if (props.imageData.url && props.imageData.url.startsWith('blob:')) {
        URL.revokeObjectURL(props.imageData.url)
      }
      
      emit('retake-image')
    }
    
    function handleAnalyze() {
      emit('analyze-image', props.imageData)
    }
    
    function toggleFullscreen() {
      isFullscreen.value = !isFullscreen.value
    }
    
    function handleImageLoad() {
      imageLoaded.value = true
      imageError.value = false
    }
    
    function handleImageError() {
      imageLoaded.value = false
      imageError.value = true
      console.error('Error cargando imagen para preview')
    }
    
    function handleKeydown(event) {
      if (isFullscreen.value && event.key === 'Escape') {
        isFullscreen.value = false
      }
    }
    
    // Cleanup
    onUnmounted(function() {
      // Limpiar URL temporal si existe
      if (props.imageData.url && props.imageData.url.startsWith('blob:')) {
        URL.revokeObjectURL(props.imageData.url)
      }
      
      // Remover event listener
      document.removeEventListener('keydown', handleKeydown)
    })
    
    // Agregar event listener para escape en fullscreen
    document.addEventListener('keydown', handleKeydown)
    
    return {
      // Estados
      isFullscreen,
      imageLoaded,
      imageError,
      
      // Computed
      imageUrl,
      imageSizeFormatted,
      captureTimeFormatted,
      imageSource,
      sourceLabel,
      originalFileName,
      
      // Métodos
      handleRetake,
      handleAnalyze,
      toggleFullscreen,
      handleImageLoad,
      handleImageError
    }
  }
}
</script>

<template>
  <div class="image-preview">
    <!-- Preview normal -->
    <div v-if="!isFullscreen" class="preview-container">
      <!-- Imagen -->
      <div class="image-wrapper">
        <!-- Loading state -->
        <div v-if="!imageLoaded && !imageError" class="image-loading">
          <div class="spinner-border text-success" role="status">
            <span class="visually-hidden">Cargando imagen...</span>
          </div>
        </div>
        
        <!-- Error state -->
        <div v-if="imageError" class="image-error alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          <strong>Error cargando imagen</strong>
          <p class="mb-0 mt-1">No se pudo cargar la imagen capturada</p>
        </div>
        
        <!-- Imagen principal -->
        <img
          v-if="imageUrl && !imageError"
          :src="imageUrl"
          @load="handleImageLoad"
          @error="handleImageError"
          @click="toggleFullscreen"
          alt="Imagen capturada de mascota"
          class="preview-image"
          :class="{ 'loaded': imageLoaded }"
        />
        
        <!-- Botón fullscreen overlay -->
        <button
          v-if="imageLoaded"
          @click="toggleFullscreen"
          class="fullscreen-btn"
          title="Ver en pantalla completa"
        >
          <i class="bi bi-arrows-fullscreen"></i>
        </button>
      </div>
      
      <!-- Información de la imagen -->
      <div class="image-info mt-3">
        <div class="row g-2">
          <div class="col-6">
            <div class="info-item">
              <i :class="imageSource === 'file-upload' ? 'bi bi-upload' : 'bi bi-camera'" class="text-muted me-1"></i>
              <small class="text-muted">{{ sourceLabel }}: {{ captureTimeFormatted }}</small>
            </div>
          </div>
          <div class="col-6">
            <div class="info-item">
              <i class="bi bi-file-earmark text-muted me-1"></i>
              <small class="text-muted">Tamaño: {{ imageSizeFormatted }}</small>
            </div>
          </div>
          <div v-if="originalFileName" class="col-12 mt-1">
            <div class="info-item">
              <i class="bi bi-file-text text-muted me-1"></i>
              <small class="text-muted">Archivo: {{ originalFileName }}</small>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Acciones -->
      <div v-if="showActions" class="action-buttons mt-4">
        <div class="d-flex justify-content-center gap-3">
          <button
            v-if="allowRetake"
            @click="handleRetake"
            class="btn btn-outline-secondary"
          >
            <i :class="imageSource === 'file-upload' ? 'bi bi-upload' : 'bi bi-arrow-counterclockwise'" class="me-1"></i>
            {{ imageSource === 'file-upload' ? 'Subir otra' : 'Tomar otra' }}
          </button>
          
          <button
            v-if="allowAnalyze"
            @click="handleAnalyze"
            class="btn btn-success btn-lg analyze-btn"
            :disabled="!imageLoaded"
          >
            <i class="bi bi-search me-2"></i>
            Analizar Mascota
          </button>
        </div>
        
        <div class="mt-3 text-center">
          <small class="text-muted">
            La imagen se analizará localmente en tu dispositivo
          </small>
        </div>
      </div>
    </div>
    
    <!-- Modal fullscreen -->
    <div v-if="isFullscreen" class="fullscreen-modal" @click="toggleFullscreen">
      <div class="fullscreen-content" @click.stop>
        <button @click="toggleFullscreen" class="close-fullscreen">
          <i class="bi bi-x-lg"></i>
        </button>
        
        <img
          v-if="imageUrl"
          :src="imageUrl"
          alt="Imagen capturada de mascota - Vista completa"
          class="fullscreen-image"
        />
        
        <div class="fullscreen-info">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <small class="text-light">
                <i class="bi bi-clock me-1"></i>{{ captureTimeFormatted }}
              </small>
            </div>
            <div>
              <small class="text-light">
                <i class="bi bi-file-earmark me-1"></i>{{ imageSizeFormatted }}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-preview {
  max-width: 500px;
  margin: 0 auto;
}

.preview-container {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.image-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  width: 100%;
  height: auto;
  max-height: 400px;
  object-fit: contain;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.preview-image.loaded {
  opacity: 1;
}

.image-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.image-error {
  margin: 20px;
  text-align: center;
}

.fullscreen-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.7);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.image-wrapper:hover .fullscreen-btn {
  opacity: 1;
}

.fullscreen-btn:hover {
  background: rgba(0,0,0,0.9);
}

.info-item {
  display: flex;
  align-items: center;
}

.analyze-btn {
  min-width: 160px;
  padding: 12px 24px;
  font-weight: 600;
  border-radius: 50px;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
}

.analyze-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(46, 125, 50, 0.4);
}

.analyze-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal fullscreen */
.fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.95);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.fullscreen-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  cursor: default;
}

.fullscreen-image {
  width: 100%;
  height: auto;
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
}

.close-fullscreen {
  position: absolute;
  top: -50px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 10px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.close-fullscreen:hover {
  background: rgba(255,255,255,0.2);
}

.fullscreen-info {
  position: absolute;
  bottom: -50px;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  padding: 10px 15px;
  border-radius: 6px;
}

/* Responsive */
@media (max-width: 768px) {
  .preview-container {
    padding: 15px;
    margin: 10px;
  }
  
  .analyze-btn {
    min-width: 140px;
    padding: 10px 20px;
  }
  
  .d-flex.gap-3 {
    gap: 1rem !important;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .fullscreen-content {
    max-width: 95vw;
    max-height: 95vh;
  }
  
  .close-fullscreen {
    top: -40px;
    font-size: 1.3rem;
  }
  
  .fullscreen-info {
    bottom: -40px;
    padding: 8px 12px;
  }
}

/* Animaciones */
.btn {
  transition: all 0.3s ease;
}

.fullscreen-modal {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>