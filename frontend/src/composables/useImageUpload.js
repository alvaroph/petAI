import { ref } from 'vue'

// Composable para manejo de upload de imágenes
export function useImageUpload() {
  // Estados reactivos
  var isUploading = ref(false)
  var uploadProgress = ref(0)
  var uploadError = ref(null)
  var uploadResult = ref(null)
  
  // Configuración de upload
  var uploadConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    endpoint: '/api/images/upload'
  }
  
  // Validar archivo antes del upload
  function validateFile(file) {
    // Verificar que es un archivo
    if (!file) {
      return {
        valid: false,
        error: 'No se proporcionó ningún archivo'
      }
    }
    
    // Verificar tamaño
    if (file.size > uploadConfig.maxFileSize) {
      var maxSizeMB = uploadConfig.maxFileSize / (1024 * 1024)
      return {
        valid: false,
        error: 'El archivo es demasiado grande. Máximo permitido: ' + maxSizeMB + 'MB'
      }
    }
    
    // Verificar tipo
    if (!uploadConfig.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Tipo de archivo no permitido. Solo se permiten: JPG, PNG, WEBP'
      }
    }
    
    return {
      valid: true,
      error: null
    }
  }
  
  // Subir imagen al servidor
  function uploadImage(file, additionalData) {
    return new Promise(function(resolve, reject) {
      // Validar archivo primero
      var validation = validateFile(file)
      if (!validation.valid) {
        uploadError.value = validation.error
        reject(new Error(validation.error))
        return
      }
      
      // Resetear estados
      isUploading.value = true
      uploadProgress.value = 0
      uploadError.value = null
      uploadResult.value = null
      
      // Crear FormData
      var formData = new FormData()
      formData.append('image', file)
      
      // Agregar datos adicionales si los hay
      if (additionalData) {
        Object.keys(additionalData).forEach(function(key) {
          formData.append(key, additionalData[key])
        })
      }
      
      // Crear XMLHttpRequest para poder trackear progreso
      var xhr = new XMLHttpRequest()
      
      // Manejar progreso de upload
      xhr.upload.addEventListener('progress', function(event) {
        if (event.lengthComputable) {
          var percentComplete = (event.loaded / event.total) * 100
          uploadProgress.value = Math.round(percentComplete)
          console.log('Progreso upload:', uploadProgress.value + '%')
        }
      })
      
      // Manejar respuesta exitosa
      xhr.addEventListener('load', function() {
        isUploading.value = false
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var response = JSON.parse(xhr.responseText)
            uploadResult.value = response
            console.log('Upload exitoso:', response)
            resolve(response)
          } catch (err) {
            var parseError = 'Error parseando respuesta del servidor'
            uploadError.value = parseError
            reject(new Error(parseError))
          }
        } else {
          // Error HTTP
          try {
            var errorResponse = JSON.parse(xhr.responseText)
            var errorMessage = errorResponse.message || 'Error del servidor'
            uploadError.value = errorMessage
            reject(new Error(errorMessage))
          } catch (err) {
            var genericError = 'Error del servidor (código ' + xhr.status + ')'
            uploadError.value = genericError
            reject(new Error(genericError))
          }
        }
      })
      
      // Manejar errores de red
      xhr.addEventListener('error', function() {
        isUploading.value = false
        var networkError = 'Error de conexión. Verifica tu conexión a internet.'
        uploadError.value = networkError
        reject(new Error(networkError))
      })
      
      // Manejar timeout
      xhr.addEventListener('timeout', function() {
        isUploading.value = false
        var timeoutError = 'El upload tardó demasiado tiempo. Intenta de nuevo.'
        uploadError.value = timeoutError
        reject(new Error(timeoutError))
      })
      
      // Configurar y enviar request
      xhr.open('POST', import.meta.env.VITE_API_URL + uploadConfig.endpoint || 'http://localhost:3001' + uploadConfig.endpoint)
      xhr.timeout = 30000 // 30 segundos timeout
      xhr.send(formData)
    })
  }
  
  // Subir imagen desde Blob (para capturas de cámara)
  function uploadImageFromBlob(blob, filename, additionalData) {
    return new Promise(function(resolve, reject) {
      // Convertir blob a File object
      var file = new File([blob], filename || 'captured_image.jpg', {
        type: blob.type || 'image/jpeg'
      })
      
      // Usar función de upload normal
      uploadImage(file, additionalData)
        .then(function(result) {
          resolve(result)
        })
        .catch(function(error) {
          reject(error)
        })
    })
  }
  
  // Subir múltiples imágenes (para uso futuro)
  function uploadMultipleImages(files, additionalData) {
    return new Promise(function(resolve, reject) {
      var uploadPromises = []
      
      // Crear promesa para cada archivo
      for (var i = 0; i < files.length; i++) {
        var file = files[i]
        uploadPromises.push(uploadImage(file, additionalData))
      }
      
      // Esperar todas las subidas
      Promise.all(uploadPromises)
        .then(function(results) {
          console.log('Todas las imágenes subidas:', results.length)
          resolve(results)
        })
        .catch(function(error) {
          console.error('Error en upload múltiple:', error)
          reject(error)
        })
    })
  }
  
  // Resetear estados
  function resetUploadState() {
    isUploading.value = false
    uploadProgress.value = 0
    uploadError.value = null
    uploadResult.value = null
  }
  
  // Obtener información de imagen subida
  function getImageInfo(imageId) {
    return new Promise(function(resolve, reject) {
      var apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      fetch(apiUrl + '/api/images/' + imageId)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Error obteniendo información de imagen')
          }
          return response.json()
        })
        .then(function(data) {
          resolve(data)
        })
        .catch(function(error) {
          reject(error)
        })
    })
  }
  
  // Utilidad para crear preview de imagen
  function createImagePreview(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader()
      
      reader.onload = function(event) {
        resolve(event.target.result)
      }
      
      reader.onerror = function() {
        reject(new Error('Error leyendo archivo para preview'))
      }
      
      reader.readAsDataURL(file)
    })
  }
  
  // Utilidad para comprimir imagen antes del upload (opcional)
  function compressImage(file, quality) {
    return new Promise(function(resolve, reject) {
      var canvas = document.createElement('canvas')
      var ctx = canvas.getContext('2d')
      var img = new Image()
      
      img.onload = function() {
        // Calcular nuevas dimensiones manteniendo aspect ratio
        var maxWidth = 1280
        var maxHeight = 720
        var ratio = Math.min(maxWidth / img.width, maxHeight / img.height)
        
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        
        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Convertir a blob comprimido
        canvas.toBlob(function(blob) {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Error comprimiendo imagen'))
          }
        }, 'image/jpeg', quality || 0.8)
      }
      
      img.onerror = function() {
        reject(new Error('Error cargando imagen para comprimir'))
      }
      
      // Crear URL de imagen desde archivo
      var reader = new FileReader()
      reader.onload = function(e) {
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }
  
  // Retornar API pública del composable
  return {
    // Estados
    isUploading,
    uploadProgress,
    uploadError,
    uploadResult,
    uploadConfig,
    
    // Métodos principales
    uploadImage,
    uploadImageFromBlob,
    uploadMultipleImages,
    
    // Utilidades
    validateFile,
    resetUploadState,
    getImageInfo,
    createImagePreview,
    compressImage
  }
}