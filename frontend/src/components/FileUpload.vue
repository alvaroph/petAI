<template>
  <div class="file-upload-container">
    <!-- Drag & Drop Zone -->
    <div 
      class="drop-zone"
      :class="{ 
        'drag-over': isDragOver,
        'has-error': error,
        'processing': isProcessing
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"  
      @dragleave="handleDragLeave">
      
      <!-- Contenido del drop zone -->
      <div class="drop-zone-content">
        <div v-if="!isProcessing" class="upload-icon mb-3">
          <i class="bi bi-cloud-upload text-primary" style="font-size: 3rem;"></i>
        </div>
        
        <div v-if="isProcessing" class="processing-icon mb-3">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Procesando...</span>
          </div>
        </div>

        <h5 class="mb-2">
          {{ isProcessing ? 'Procesando imagen...' : 'Sube una imagen de tu mascota' }}
        </h5>
        
        <p class="text-muted mb-3" v-if="!isProcessing">
          Arrastra una imagen aquí o haz clic para seleccionar
        </p>

        <!-- Botón de selección de archivo -->
        <div v-if="!isProcessing" class="upload-actions">
          <button 
            type="button" 
            class="btn btn-primary btn-lg"
            @click="openFileSelector">
            <i class="bi bi-folder2-open me-2"></i>
            Seleccionar Archivo
          </button>
        </div>

        <!-- Input de archivo oculto -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="d-none"
          @change="handleFileSelect">

        <!-- Información de tipos soportados -->
        <div v-if="!isProcessing" class="supported-formats mt-3">
          <small class="text-muted">
            <i class="bi bi-info-circle me-1"></i>
            Formatos soportados: JPG, PNG, WEBP (máx. 10MB)
          </small>
        </div>
      </div>
    </div>

    <!-- Mensaje de error -->
    <div v-if="error" class="alert alert-danger mt-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>Error:</strong> {{ error }}
    </div>

    <!-- Preview rápido -->
    <div v-if="previewUrl && !error" class="preview-container mt-3">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0">
            <i class="bi bi-image me-1"></i>
            Vista Previa
          </h6>
          <button 
            type="button" 
            class="btn btn-outline-secondary btn-sm"
            @click="clearPreview">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="card-body text-center">
          <img 
            :src="previewUrl" 
            alt="Preview" 
            class="img-preview">
          <div class="mt-2">
            <small class="text-muted">
              {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onUnmounted } from 'vue'

export default {
  name: 'FileUpload',
  
  emits: ['file-selected', 'upload-error'],

  setup(props, { emit }) {
    // Estado reactivo
    var isDragOver = ref(false)
    var isProcessing = ref(false)
    var error = ref(null)
    var selectedFile = ref(null)
    var previewUrl = ref(null)
    var fileInput = ref(null)

    // Configuración
    var maxFileSize = 10 * 1024 * 1024 // 10MB
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    // Validar archivo
    function validateFile(file) {
      error.value = null

      // Verificar que es un archivo
      if (!file) {
        error.value = 'No se seleccionó ningún archivo'
        return false
      }

      // Verificar tipo
      if (!allowedTypes.includes(file.type)) {
        error.value = 'Tipo de archivo no soportado. Use JPG, PNG o WEBP'
        return false
      }

      // Verificar tamaño
      if (file.size > maxFileSize) {
        error.value = 'El archivo es demasiado grande. Máximo 10MB permitido'
        return false
      }

      return true
    }

    // Procesar archivo seleccionado
    function processFile(file) {
      if (!validateFile(file)) {
        emit('upload-error', error.value)
        return
      }

      isProcessing.value = true
      selectedFile.value = file

      // Crear URL de preview
      if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
      }
      previewUrl.value = URL.createObjectURL(file)

      // Crear imagen blob compatible con el sistema existente
      var reader = new FileReader()
      
      reader.onload = function(e) {
        // Convertir a blob
        fetch(e.target.result)
          .then(function(res) { return res.blob() })
          .then(function(blob) {
            // Crear objeto compatible con CameraCapture
            var imageData = {
              blob: blob,
              url: previewUrl.value,
              file: file,
              source: 'file-upload',
              timestamp: new Date().toISOString(),
              metadata: {
                originalName: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
              }
            }

            isProcessing.value = false
            emit('file-selected', imageData)
            console.log('✅ Archivo procesado exitosamente:', file.name)
          })
          .catch(function(err) {
            isProcessing.value = false
            error.value = 'Error procesando el archivo: ' + err.message
            emit('upload-error', error.value)
            console.error('❌ Error procesando archivo:', err)
          })
      }

      reader.onerror = function() {
        isProcessing.value = false
        error.value = 'Error leyendo el archivo'
        emit('upload-error', error.value)
      }

      reader.readAsDataURL(file)
    }

    // Handlers de drag & drop
    function handleDragOver(e) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    function handleDragEnter(e) {
      e.preventDefault()
      isDragOver.value = true
    }

    function handleDragLeave(e) {
      e.preventDefault()
      // Solo quitar el estado si realmente salimos del drop zone
      if (!e.currentTarget.contains(e.relatedTarget)) {
        isDragOver.value = false
      }
    }

    function handleDrop(e) {
      e.preventDefault()
      isDragOver.value = false
      
      var files = e.dataTransfer.files
      if (files.length > 0) {
        processFile(files[0])
      }
    }

    // Handler de selección de archivo
    function handleFileSelect(e) {
      var files = e.target.files
      if (files.length > 0) {
        processFile(files[0])
      }
    }

    // Abrir selector de archivos
    function openFileSelector() {
      if (fileInput.value) {
        fileInput.value.click()
      }
    }

    // Limpiar preview
    function clearPreview() {
      if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
        previewUrl.value = null
      }
      selectedFile.value = null
      error.value = null
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }

    // Formatear tamaño de archivo
    function formatFileSize(bytes) {
      if (!bytes) return '0 B'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    // Limpiar recursos al destruir componente
    onUnmounted(function() {
      if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
      }
    })

    return {
      // Estado
      isDragOver,
      isProcessing,
      error,
      selectedFile,
      previewUrl,
      fileInput,

      // Métodos
      handleDragOver,
      handleDragEnter,
      handleDragLeave,
      handleDrop,
      handleFileSelect,
      openFileSelector,
      clearPreview,
      formatFileSize
    }
  }
}
</script>

<style scoped>
.drop-zone {
  border: 3px dashed #dee2e6;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  background-color: #f8f9fa;
  transition: all 0.3s ease;
  cursor: pointer;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone:hover {
  border-color: #0d6efd;
  background-color: #e7f3ff;
}

.drop-zone.drag-over {
  border-color: #0d6efd;
  background-color: #e7f3ff;
  border-style: solid;
  transform: scale(1.02);
}

.drop-zone.has-error {
  border-color: #dc3545;
  background-color: #f8d7da;
}

.drop-zone.processing {
  border-color: #6c757d;
  background-color: #e9ecef;
  cursor: not-allowed;
}

.drop-zone-content {
  width: 100%;
}

.upload-icon i {
  opacity: 0.7;
}

.drop-zone:hover .upload-icon i {
  opacity: 1;
  transform: scale(1.1);
  transition: all 0.3s ease;
}

.supported-formats {
  padding: 0.75rem;
  background-color: rgba(13, 110, 253, 0.1);
  border-radius: 6px;
}

.preview-container {
  max-width: 400px;
  margin: 0 auto;
}

.img-preview {
  max-width: 100%;
  max-height: 200px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.upload-actions .btn {
  transition: all 0.3s ease;
}

.upload-actions .btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
}

.processing-icon {
  opacity: 0.7;
}

/* Animación para el spinner */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.drop-zone.processing h5 {
  animation: pulse 2s ease-in-out infinite;
}
</style>