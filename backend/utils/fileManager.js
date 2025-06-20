import fs from 'fs';
import path from 'path';
import logger from './logger.js';

// Definir estructura de directorios según especificaciones
var DIRECTORIES = {
  BASE: 'storage',
  IMAGES: {
    BASE: 'storage/images',
    PENDING: 'storage/images/pending',
    VALIDATED: {
      BASE: 'storage/images/validated',
      DOGS: 'storage/images/validated/dogs',
      CATS: 'storage/images/validated/cats'
    },
    REJECTED: 'storage/images/rejected',
    TRAINING: 'storage/images/training'
  },
  MODELS: 'storage/models',
  BACKUPS: 'storage/backups',
  LOGS: 'logs'
};

// Función para crear directorio si no existe
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.systemLog('FILE_MANAGER', 'Directorio creado: ' + dirPath);
      return true;
    } catch (error) {
      logger.error('Error creando directorio ' + dirPath + ': ' + error.message);
      return false;
    }
  }
  return true;
}

// Función para inicializar toda la estructura de directorios
function initializeDirectoryStructure() {
  logger.systemLog('FILE_MANAGER', 'Inicializando estructura de directorios...');
  
  var success = true;
  
  // Crear directorio base
  success = success && ensureDirectoryExists(DIRECTORIES.BASE);
  
  // Crear directorios de imágenes
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.BASE);
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.PENDING);
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.VALIDATED.BASE);
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.VALIDATED.DOGS);
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.VALIDATED.CATS);
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.REJECTED);
  success = success && ensureDirectoryExists(DIRECTORIES.IMAGES.TRAINING);
  
  // Crear otros directorios
  success = success && ensureDirectoryExists(DIRECTORIES.MODELS);
  success = success && ensureDirectoryExists(DIRECTORIES.BACKUPS);
  success = success && ensureDirectoryExists(DIRECTORIES.LOGS);
  
  if (success) {
    logger.systemLog('FILE_MANAGER', 'Estructura de directorios inicializada correctamente');
  } else {
    logger.error('Error inicializando algunos directorios');
  }
  
  return success;
}

// Función para obtener ruta completa de un directorio
function getDirectoryPath(directoryKey) {
  var keys = directoryKey.split('.');
  var current = DIRECTORIES;
  
  for (var i = 0; i < keys.length; i++) {
    current = current[keys[i]];
    if (!current) {
      return null;
    }
  }
  
  return current;
}

// Función para generar nombre único de archivo con timestamp
function generateUniqueFilename(originalName, extension) {
  var timestamp = Date.now();
  var random = Math.floor(Math.random() * 1000);
  var baseName = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '_');
  return baseName + '_' + timestamp + '_' + random + '.' + extension;
}

// Función para mover archivo entre directorios
function moveFile(sourcePath, targetDirectory, newFileName) {
  try {
    var targetPath = path.join(targetDirectory, newFileName || path.basename(sourcePath));
    
    ensureDirectoryExists(targetDirectory);
    
    fs.renameSync(sourcePath, targetPath);
    logger.systemLog('FILE_MANAGER', 'Archivo movido: ' + sourcePath + ' -> ' + targetPath);
    
    return targetPath;
  } catch (error) {
    logger.error('Error moviendo archivo ' + sourcePath + ': ' + error.message);
    return null;
  }
}

// Función para crear archivo de metadata JSON
function createMetadataFile(imagePath, imageData) {
  try {
    var metadataPath = imagePath.replace(path.extname(imagePath), '.json');
    var metadata = {
      archivo: path.basename(imagePath),
      fecha_subida: new Date().toISOString(),
      porcentaje_ia: imageData.confidence || null,
      ip_usuario: imageData.userIP || null,
      user_agent: imageData.userAgent || null,
      validaciones: [],
      estado: 'pending',
      consenso_final: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    logger.systemLog('FILE_MANAGER', 'Metadata creada: ' + metadataPath);
    
    return metadataPath;
  } catch (error) {
    logger.error('Error creando metadata: ' + error.message);
    return null;
  }
}

// Función para leer metadata de archivo
function readMetadata(imagePath) {
  try {
    var metadataPath = imagePath.replace(path.extname(imagePath), '.json');
    if (fs.existsSync(metadataPath)) {
      var data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    logger.error('Error leyendo metadata: ' + error.message);
    return null;
  }
}

// Función para actualizar metadata
function updateMetadata(imagePath, updates) {
  try {
    var metadata = readMetadata(imagePath);
    if (!metadata) {
      return false;
    }
    
    // Aplicar actualizaciones
    Object.keys(updates).forEach(function(key) {
      metadata[key] = updates[key];
    });
    
    metadata.updated_at = new Date().toISOString();
    
    var metadataPath = imagePath.replace(path.extname(imagePath), '.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    logger.systemLog('FILE_MANAGER', 'Metadata actualizada: ' + metadataPath);
    return true;
  } catch (error) {
    logger.error('Error actualizando metadata: ' + error.message);
    return false;
  }
}

export {
  DIRECTORIES,
  initializeDirectoryStructure,
  ensureDirectoryExists,
  getDirectoryPath,
  generateUniqueFilename,
  moveFile,
  createMetadataFile,
  readMetadata,
  updateMetadata
};