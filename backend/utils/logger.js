import winston from 'winston';
import path from 'path';

// Crear directorio de logs si no existe
import fs from 'fs';
var logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Configuración de formatos
var logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(function(info) {
    return info.timestamp + ' [' + info.level.toUpperCase() + '] ' + info.message;
  })
);

// Crear logger
var logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'petai-backend' },
  transports: [
    // Escribir logs de error a archivo
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Escribir todos los logs a archivo
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// En desarrollo, también mostrar logs en consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Función helper para logs de ML/entrenamiento
logger.mlLog = function(message, data) {
  var logMessage = '[ML] ' + message;
  if (data) {
    logMessage += ' - Datos: ' + JSON.stringify(data);
  }
  logger.info(logMessage);
};

// Función helper para logs de validación de expertos
logger.expertLog = function(expertId, action, imageId, result) {
  var logMessage = '[EXPERT] ' + expertId + ' - ' + action;
  if (imageId) logMessage += ' - Imagen: ' + imageId;
  if (result) logMessage += ' - Resultado: ' + result;
  logger.info(logMessage);
};

// Función helper para logs de sistema
logger.systemLog = function(component, message, data) {
  var logMessage = '[SYSTEM:' + component + '] ' + message;
  if (data) {
    logMessage += ' - ' + JSON.stringify(data);
  }
  logger.info(logMessage);
};

export default logger;