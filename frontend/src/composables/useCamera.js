import { ref, reactive } from 'vue'

// Composable para manejo de cámara con JavaScript ES5 compatible
export function useCamera() {
  // Estados reactivos
  var isSupported = ref(false)
  var isPermissionGranted = ref(false)
  var isStreamActive = ref(false)
  var isLoading = ref(false)
  var error = ref(null)
  var stream = ref(null)
  
  // Configuración de cámara
  var cameraConfig = reactive({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'environment' // Preferir cámara trasera en móviles
    },
    audio: false
  })
  
  // Verificar soporte del navegador
  function checkSupport() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      isSupported.value = true
      return true
    } else {
      isSupported.value = false
      error.value = {
        code: 'NOT_SUPPORTED',
        message: 'Tu navegador no soporta acceso a cámara. Usa un navegador moderno como Chrome, Firefox o Safari.'
      }
      return false
    }
  }
  
  // Solicitar permisos de cámara
  function requestPermission() {
    return new Promise(function(resolve, reject) {
      if (!checkSupport()) {
        reject(error.value)
        return
      }
      
      isLoading.value = true
      error.value = null
      
      navigator.mediaDevices.getUserMedia(cameraConfig)
        .then(function(mediaStream) {
          isPermissionGranted.value = true
          isStreamActive.value = true
          stream.value = mediaStream
          isLoading.value = false
          
          console.log('Permisos de cámara concedidos')
          resolve(mediaStream)
        })
        .catch(function(err) {
          isLoading.value = false
          isPermissionGranted.value = false
          
          // Manejar diferentes tipos de errores
          var errorInfo = handleCameraError(err)
          error.value = errorInfo
          
          console.error('Error accediendo a cámara:', err)
          reject(errorInfo)
        })
    })
  }
  
  // Manejar errores específicos de cámara
  function handleCameraError(err) {
    switch (err.name) {
      case 'NotAllowedError':
        return {
          code: 'PERMISSION_DENIED',
          message: 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara e intenta de nuevo.',
          userAction: 'Habilita los permisos de cámara en la configuración de tu navegador'
        }
      
      case 'NotFoundError':
        return {
          code: 'NO_CAMERA',
          message: 'No se encontró ninguna cámara en tu dispositivo.',
          userAction: 'Conecta una cámara a tu dispositivo'
        }
      
      case 'NotReadableError':
        return {
          code: 'CAMERA_BUSY',
          message: 'La cámara está siendo usada por otra aplicación.',
          userAction: 'Cierra otras aplicaciones que puedan estar usando la cámara'
        }
      
      case 'OverconstrainedError':
        return {
          code: 'CAMERA_CONSTRAINTS',
          message: 'La cámara no soporta la configuración solicitada.',
          userAction: 'Intenta con una resolución menor'
        }
      
      case 'SecurityError':
        return {
          code: 'SECURITY_ERROR',
          message: 'Error de seguridad accediendo a la cámara.',
          userAction: 'Asegúrate de estar usando HTTPS'
        }
      
      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: 'Error desconocido: ' + err.message,
          userAction: 'Recarga la página e intenta de nuevo'
        }
    }
  }
  
  // Capturar imagen del stream de video
  function captureImage(videoElement) {
    return new Promise(function(resolve, reject) {
      try {
        if (!videoElement || !isStreamActive.value) {
          reject(new Error('Video no disponible para captura'))
          return
        }
        
        // Crear canvas para capturar frame
        var canvas = document.createElement('canvas')
        var context = canvas.getContext('2d')
        
        // Configurar dimensiones del canvas
        canvas.width = videoElement.videoWidth
        canvas.height = videoElement.videoHeight
        
        // Dibujar frame actual del video en canvas
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        
        // Convertir canvas a blob (imagen)
        canvas.toBlob(function(blob) {
          if (blob) {
            console.log('Imagen capturada exitosamente:', blob.size, 'bytes')
            resolve(blob)
          } else {
            reject(new Error('No se pudo generar la imagen'))
          }
        }, 'image/jpeg', 0.95) // Calidad 95%
        
      } catch (err) {
        console.error('Error capturando imagen:', err)
        reject(err)
      }
    })
  }
  
  // Detener stream de cámara
  function stopCamera() {
    if (stream.value) {
      stream.value.getTracks().forEach(function(track) {
        track.stop()
      })
      stream.value = null
      isStreamActive.value = false
      console.log('Cámara detenida')
    }
  }
  
  // Cambiar entre cámara frontal y trasera (si disponible)
  function switchCamera() {
    return new Promise(function(resolve, reject) {
      // Cambiar configuración de facingMode
      var currentMode = cameraConfig.video.facingMode
      cameraConfig.video.facingMode = currentMode === 'environment' ? 'user' : 'environment'
      
      // Detener cámara actual
      stopCamera()
      
      // Solicitar nueva cámara
      requestPermission()
        .then(function(newStream) {
          console.log('Cámara cambiada a:', cameraConfig.video.facingMode)
          resolve(newStream)
        })
        .catch(function(err) {
          // Si falla, volver a configuración anterior
          cameraConfig.video.facingMode = currentMode
          reject(err)
        })
    })
  }
  
  // Obtener información de dispositivos de cámara disponibles
  function getAvailableCameras() {
    return new Promise(function(resolve, reject) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        reject(new Error('Enumeración de dispositivos no soportada'))
        return
      }
      
      navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
          var cameras = devices.filter(function(device) {
            return device.kind === 'videoinput'
          })
          
          console.log('Cámaras disponibles:', cameras.length)
          resolve(cameras)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  }
  
  // Limpiar recursos al desmontar componente
  function cleanup() {
    stopCamera()
    error.value = null
    isPermissionGranted.value = false
    isStreamActive.value = false
  }
  
  // Inicializar verificación de soporte
  checkSupport()
  
  // Retornar API pública del composable
  return {
    // Estados
    isSupported,
    isPermissionGranted,
    isStreamActive,
    isLoading,
    error,
    stream,
    cameraConfig,
    
    // Métodos
    requestPermission,
    captureImage,
    stopCamera,
    switchCamera,
    getAvailableCameras,
    cleanup
  }
}