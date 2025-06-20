import multer from 'multer';
import path from 'path';
import logger from '../utils/logger.js';
import { DIRECTORIES, ensureDirectoryExists, generateUniqueFilename } from '../utils/fileManager.js';

// Configuración de almacenamiento
var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    try {
      // Asegurar que el directorio existe
      var uploadPath = DIRECTORIES.IMAGES.PENDING;
      ensureDirectoryExists(uploadPath);
      
      logger.systemLog('UPLOAD', 'Subiendo archivo a: ' + uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      logger.error('Error configurando destino de upload: ' + error.message);
      cb(error, null);
    }
  },
  
  filename: function(req, file, cb) {
    try {
      // Generar nombre único con timestamp
      var extension = path.extname(file.originalname).toLowerCase();
      var uniqueName = generateUniqueFilename(file.originalname, extension.substring(1));
      
      logger.systemLog('UPLOAD', 'Generando nombre único: ' + uniqueName);
      cb(null, uniqueName);
    } catch (error) {
      logger.error('Error generando nombre de archivo: ' + error.message);
      cb(error, null);
    }
  }
});

// Función para validar tipos de archivo
function fileFilter(req, file, cb) {
  // Tipos de archivo permitidos
  var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  var allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  
  var fileExtension = path.extname(file.originalname).toLowerCase();
  var mimeType = file.mimetype;
  
  logger.systemLog('UPLOAD', 'Validando archivo: ' + file.originalname + ' - Tipo: ' + mimeType);
  
  // Verificar tipo MIME y extensión
  if (allowedTypes.includes(mimeType) && allowedExtensions.includes(fileExtension)) {
    logger.systemLog('UPLOAD', 'Archivo válido: ' + file.originalname);
    cb(null, true);
  } else {
    var errorMsg = 'Tipo de archivo no permitido. Solo se permiten: ' + allowedExtensions.join(', ');
    logger.systemLog('UPLOAD', 'Archivo rechazado: ' + errorMsg);
    cb(new Error(errorMsg), false);
  }
}

// Configuración de multer
var uploadConfig = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
    files: 1 // Solo un archivo por vez
  }
});

// Middleware para manejar errores de multer
function handleMulterError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    logger.error('Error de Multer: ' + error.message);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'Archivo demasiado grande',
          message: 'El archivo no puede ser mayor a 10MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Demasiados archivos',
          message: 'Solo se permite subir un archivo por vez'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Campo de archivo inesperado',
          message: 'El campo del archivo debe llamarse "image"'
        });
      default:
        return res.status(400).json({
          error: 'Error de upload',
          message: error.message
        });
    }
  } else if (error) {
    logger.error('Error de validación de archivo: ' + error.message);
    return res.status(400).json({
      error: 'Archivo no válido',
      message: error.message
    });
  }
  
  next();
}

// Middleware para validar que se subió un archivo
function validateFileUploaded(req, res, next) {
  if (!req.file) {
    logger.systemLog('UPLOAD', 'No se subió ningún archivo');
    return res.status(400).json({
      error: 'No se encontró archivo',
      message: 'Debes subir una imagen para analizar'
    });
  }
  
  logger.systemLog('UPLOAD', 'Archivo subido exitosamente: ' + req.file.filename);
  next();
}

// Middleware para agregar metadata de la request
function addRequestMetadata(req, res, next) {
  // Agregar información útil al objeto request
  req.uploadMetadata = {
    userIP: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    uploadTime: new Date().toISOString(),
    fileSize: req.file ? req.file.size : 0,
    originalName: req.file ? req.file.originalname : null
  };
  
  logger.systemLog('UPLOAD', 'Metadata agregada:', req.uploadMetadata);
  next();
}

// Exportar configuración y middlewares
export {
  uploadConfig,
  handleMulterError,
  validateFileUploaded,
  addRequestMetadata
};