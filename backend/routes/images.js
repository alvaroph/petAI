import express from 'express';
import path from 'path';
import logger from '../utils/logger.js';
import { 
  uploadConfig, 
  handleMulterError, 
  validateFileUploaded, 
  addRequestMetadata 
} from '../middleware/upload.js';
import { 
  createMetadataFile, 
  readMetadata, 
  updateMetadata 
} from '../utils/fileManager.js';
import PetClassifier from '../models/PetClassifier.js';
import metricsTracker from '../utils/metricsTracker.js';
import mlopsMonitor from '../utils/mlopsMonitor.js';
import retrainingScheduler from '../services/retrainingScheduler.js';
import modelVersioning from '../utils/modelVersioning.js';
import advancedMetrics from '../utils/advancedMetrics.js';
import abTestingService from '../services/abTestingService.js';
import MLModelTestSuite from '../tests/mlModelTests.js';
import winnerSelectionService from '../services/winnerSelectionService.js';

var router = express.Router();

// Instancia global del clasificador ML
var classifier = new PetClassifier();

// Endpoint para subir imágenes
// POST /api/images/upload
router.post('/upload', 
  // Configurar multer para aceptar un archivo con campo "image"
  uploadConfig.single('image'),
  
  // Manejar errores de multer
  handleMulterError,
  
  // Validar que se subió archivo
  validateFileUploaded,
  
  // Agregar metadata de la request
  addRequestMetadata,
  
  // Controlador principal
  function(req, res) {
    try {
      var file = req.file;
      var metadata = req.uploadMetadata;
      
      logger.systemLog('IMAGES', 'Procesando upload de imagen: ' + file.filename);
      
      // Datos adicionales del body (si los hay)
      var confidence = req.body.confidence ? parseFloat(req.body.confidence) : null;
      var userNotes = req.body.notes || null;
      
      // Crear archivo de metadata
      var imageData = {
        confidence: confidence,
        userIP: metadata.userIP,
        userAgent: metadata.userAgent,
        userNotes: userNotes,
        fileSize: metadata.fileSize,
        originalName: metadata.originalName
      };
      
      var metadataPath = createMetadataFile(file.path, imageData);
      
      if (!metadataPath) {
        logger.error('No se pudo crear archivo de metadata para: ' + file.filename);
        return res.status(500).json({
          error: 'Error interno',
          message: 'No se pudo procesar la imagen completamente'
        });
      }
      
      // Respuesta exitosa
      var response = {
        success: true,
        message: 'Imagen subida exitosamente',
        data: {
          imageId: path.parse(file.filename).name,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          uploadTime: metadata.uploadTime,
          status: 'pending' // Estado inicial para validación
        }
      };
      
      logger.systemLog('IMAGES', 'Upload completado exitosamente: ' + file.filename);
      res.status(201).json(response);
      
    } catch (error) {
      logger.error('Error procesando upload: ' + error.message);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo procesar la imagen'
      });
    }
  }
);

// Endpoint para obtener información de una imagen
// GET /api/images/:imageId
router.get('/:imageId', function(req, res) {
  try {
    var imageId = req.params.imageId;
    
    // Buscar el archivo en los directorios (pending, validated, rejected)
    // Por ahora buscamos solo en pending
    var imagePath = path.join(process.cwd(), 'storage', 'images', 'pending', imageId + '.jpg');
    
    var metadata = readMetadata(imagePath);
    
    if (!metadata) {
      logger.systemLog('IMAGES', 'Imagen no encontrada: ' + imageId);
      return res.status(404).json({
        error: 'Imagen no encontrada',
        message: 'La imagen solicitada no existe o fue movida'
      });
    }
    
    logger.systemLog('IMAGES', 'Información de imagen solicitada: ' + imageId);
    
    res.json({
      success: true,
      data: metadata
    });
    
  } catch (error) {
    logger.error('Error obteniendo información de imagen: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la información de la imagen'
    });
  }
});

// Endpoint para listar imágenes pendientes (para fase de validación expertos)
// GET /api/images/pending
router.get('/pending/list', function(req, res) {
  try {
    // Este endpoint será implementado completamente en la Fase 4
    // Por ahora retornamos estructura básica
    
    logger.systemLog('IMAGES', 'Listado de imágenes pendientes solicitado');
    
    res.json({
      success: true,
      message: 'Endpoint disponible en Fase 4 - Sistema de Validación Expertos',
      data: {
        pending: [],
        total: 0
      }
    });
    
  } catch (error) {
    logger.error('Error listando imágenes pendientes: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la lista de imágenes'
    });
  }
});

// Endpoint para predicción ML - NUEVO EN FASE 3
// POST /api/images/predict
router.post('/predict', 
  uploadConfig.single('image'),
  handleMulterError,
  validateFileUploaded,
  addRequestMetadata,
  
  async function(req, res) {
    try {
      var file = req.file;
      var metadata = req.uploadMetadata;
      
      logger.mlLog('info', 'Iniciando predicción ML para imagen', { 
        filename: file.filename 
      });

      // A/B Testing: Determine which model to use
      var userId = req.headers['x-user-id'] || req.ip || 'anonymous';
      var activeTests = abTestingService.getAllTests().filter(test => test.status === 'running');
      var selectedGroup = null;
      var testId = null;
      
      if (activeTests.length > 0) {
        // Use the first active test
        testId = activeTests[0].testId;
        selectedGroup = abTestingService.assignUserToGroup(userId, testId, {
          userAgent: metadata.userAgent,
          imageSource: req.body.source || 'upload'
        });
        
        logger.mlLog('info', `A/B Test: User ${userId} assigned to group ${selectedGroup}`, {
          testId: testId,
          group: selectedGroup
        });
      }

      // Asegurar que el modelo esté cargado
      if (!classifier.isLoaded) {
        logger.mlLog('info', 'Cargando modelo ML...');
        await classifier.loadModel();
      }

      // Ejecutar predicción (for now using default model, will expand for different models)
      var prediction = await classifier.predict(file.path);
      
      // Record A/B test prediction if active
      if (testId && selectedGroup) {
        abTestingService.recordPrediction(
          testId, 
          userId, 
          selectedGroup, 
          prediction.predictedClass, 
          null, // actualLabel will be set when user validates
          prediction.confidence
        );
      }
      
      // Crear metadata completa con predicción
      var imageData = {
        originalName: metadata.originalName,
        fileSize: metadata.fileSize,
        userIP: metadata.userIP,
        userAgent: metadata.userAgent,
        prediction: prediction,
        processingTime: new Date().toISOString(),
        abTest: testId ? {
          testId: testId,
          group: selectedGroup,
          userId: userId
        } : null
      };
      
      // Guardar metadata
      var metadataPath = createMetadataFile(file.path, imageData);
      
      if (!metadataPath) {
        logger.mlLog('error', 'Error guardando metadata de predicción');
        return res.status(500).json({
          error: 'Error interno',
          message: 'No se pudo guardar el resultado de la predicción'
        });
      }

      // Respuesta con predicción
      var response = {
        success: true,
        message: 'Predicción completada exitosamente',
        data: {
          imageId: path.parse(file.filename).name,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          uploadTime: metadata.uploadTime,
          prediction: {
            predictedClass: prediction.predictedClass,
            confidence: prediction.confidence,
            isDog: prediction.predictedClass === 'dog',
            confidenceLevel: prediction.confidence > 0.8 ? 'alta' : 
                           prediction.confidence > 0.6 ? 'media' : 'baja',
            allPredictions: prediction.predictions
          },
          abTest: testId ? {
            testId: testId,
            group: selectedGroup,
            isPartOfTest: true
          } : null
        }
      };
      
      logger.mlLog('info', 'Predicción ML completada', {
        filename: file.filename,
        predictedClass: prediction.predictedClass,
        confidence: prediction.confidence.toFixed(4)
      });
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.mlLog('error', 'Error en predicción ML', { 
        error: error.message,
        filename: req.file ? req.file.filename : 'unknown'
      });
      
      res.status(500).json({
        error: 'Error en predicción',
        message: 'No se pudo procesar la imagen con el modelo ML'
      });
    }
  }
);

// Endpoint para información del modelo ML - NUEVO EN FASE 3
// GET /api/images/model/info
router.get('/model/info', async function(req, res) {
  try {
    // Cargar modelo si no está cargado
    if (!classifier.isLoaded) {
      await classifier.loadModel();
    }
    
    var modelInfo = classifier.getModelInfo();
    
    logger.mlLog('info', 'Información del modelo solicitada');
    
    res.json({
      success: true,
      data: {
        ...modelInfo,
        status: 'active',
        framework: 'TensorFlow.js',
        version: '4.15.0',
        lastLoaded: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.mlLog('error', 'Error obteniendo info del modelo', { 
      error: error.message 
    });
    
    res.status(500).json({
      error: 'Error del modelo',
      message: 'No se pudo obtener información del modelo ML'
    });
  }
});

// Endpoint para validación por usuario - NUEVO EN FASE 4
// POST /api/images/validate
router.post('/validate', async function(req, res) {
  try {
    var { imageId, userValidation, aiPrediction } = req.body;
    
    // Validar datos requeridos
    if (!imageId || !userValidation || !aiPrediction) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requiere imageId, userValidation y aiPrediction'
      });
    }
    
    // Validar que userValidation sea válido
    var validResponses = ['correct', 'incorrect'];
    if (!validResponses.includes(userValidation)) {
      return res.status(400).json({
        error: 'Validación inválida',
        message: 'userValidation debe ser "correct" o "incorrect"'
      });
    }
    
    logger.systemLog('VALIDATION', `Validación de usuario recibida: ${imageId} - ${userValidation}`);
    
    // Encontrar el archivo de imagen
    var imagePath = path.join(process.cwd(), 'storage', 'images', 'pending', imageId + '.jpg');
    
    // Leer metadata existente
    var metadata = readMetadata(imagePath);
    
    if (!metadata) {
      return res.status(404).json({
        error: 'Imagen no encontrada',
        message: 'No se pudo encontrar la imagen para validar'
      });
    }
    
    // Crear datos de validación
    var validationData = {
      ...metadata,
      userValidation: {
        response: userValidation,
        timestamp: new Date().toISOString(),
        aiPrediction: aiPrediction,
        isCorrect: userValidation === 'correct',
        // Determinar la etiqueta real basada en la validación del usuario
        actualClass: userValidation === 'correct' ? 
          aiPrediction.predictedClass : (aiPrediction.predictedClass === 'dog' ? 'cat' : 'dog')
      },
      status: 'user_validated'
    };
    
    // Actualizar metadata con validación
    var updated = updateMetadata(imagePath, validationData);
    
    if (!updated) {
      logger.error(`Error actualizando metadata para validación: ${imageId}`);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudo guardar la validación'
      });
    }
    
    // Mover imagen a directorio de validados
    var fs = await import('fs');
    var destinationDir = userValidation === 'correct' ? 'validated' : 'training_corrections';
    var destinationPath = path.join(process.cwd(), 'storage', 'images', destinationDir, 
      validationData.userValidation.actualClass, imageId + '.jpg');
    
    // Crear directorio si no existe
    var destinationDirPath = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDirPath)) {
      fs.mkdirSync(destinationDirPath, { recursive: true });
    }
    
    // Mover archivo
    try {
      fs.renameSync(imagePath, destinationPath);
      // También mover el metadata
      var metadataOldPath = imagePath.replace('.jpg', '_metadata.json');
      var metadataNewPath = destinationPath.replace('.jpg', '_metadata.json');
      fs.renameSync(metadataOldPath, metadataNewPath);
      
      logger.systemLog('VALIDATION', `Imagen movida a ${destinationDir}/${validationData.userValidation.actualClass}: ${imageId}`);
    } catch (moveError) {
      logger.error(`Error moviendo archivo validado: ${moveError.message}`);
      // No fallar la request si no se puede mover, pero loggear el error
    }
    
    // Respuesta exitosa
    var response = {
      success: true,
      message: 'Validación guardada exitosamente',
      data: {
        imageId: imageId,
        userValidation: userValidation,
        aiWasCorrect: userValidation === 'correct',
        accuracy: metadata.prediction ? 
          (userValidation === 'correct' ? 'increased' : 'decreased') : 'n/a',
        thanksMessage: userValidation === 'correct' ? 
          '¡Gracias! Tu confirmación ayuda a mejorar el modelo.' :
          '¡Gracias! Tu corrección es muy valiosa para entrenar el modelo.'
      }
    };
    
    // Actualizar métricas de accuracy - FASE 4 + 5
    try {
      var metricsUpdateData = {
        userValidation: validationData.userValidation,
        aiPrediction: aiPrediction,
        imageId: imageId
      };
      
      // Actualizar métricas básicas
      var updatedMetrics = metricsTracker.updateMetrics(metricsUpdateData);
      
      // Actualizar métricas avanzadas - NUEVO EN FASE 5
      var advancedMetricsResult = advancedMetrics.processValidation(metricsUpdateData);
      
      // Agregar métricas avanzadas a la respuesta
      response.metrics = {
        basic: {
          totalValidations: updatedMetrics.totalValidations,
          accuracyRate: updatedMetrics.accuracyRate
        },
        advanced: {
          precision: advancedMetricsResult.classMetrics[aiPrediction.predictedClass]?.precision || 0,
          recall: advancedMetricsResult.classMetrics[aiPrediction.predictedClass]?.recall || 0,
          f1Score: advancedMetricsResult.classMetrics[aiPrediction.predictedClass]?.f1Score || 0,
          overallAccuracy: advancedMetricsResult.overallMetrics.accuracy
        }
      };
      
      logger.systemLog('METRICS', `Métricas actualizadas - Accuracy: ${updatedMetrics.accuracyRate.toFixed(2)}%, F1: ${(advancedMetricsResult.overallMetrics.macroAvgF1Score * 100).toFixed(2)}%`);
    } catch (metricsError) {
      logger.error(`Error actualizando métricas: ${metricsError.message}`);
      // No fallar la respuesta por error de métricas
    }

    logger.systemLog('VALIDATION', `Validación completada exitosamente: ${imageId}`);
    res.status(200).json(response);
    
  } catch (error) {
    logger.error('Error en validación por usuario: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo procesar la validación'
    });
  }
});

// Endpoint para métricas de validación - NUEVO EN FASE 4
// GET /api/images/metrics
router.get('/metrics', function(req, res) {
  try {
    var metricsSummary = metricsTracker.getMetricsSummary();
    
    logger.systemLog('METRICS', 'Métricas de validación solicitadas');
    
    res.json({
      success: true,
      data: {
        ...metricsSummary,
        description: 'Métricas de accuracy basadas en validación de usuarios',
        phase: 'Fase 4 - Sistema de Validación por Usuario'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo métricas de validación: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las métricas de validación'
    });
  }
});

// Endpoint para métricas detalladas - NUEVO EN FASE 4
// GET /api/images/metrics/detailed
router.get('/metrics/detailed', function(req, res) {
  try {
    var detailedMetrics = metricsTracker.getDetailedMetrics();
    
    logger.systemLog('METRICS', 'Métricas detalladas solicitadas');
    
    res.json({
      success: true,
      data: detailedMetrics
    });
    
  } catch (error) {
    logger.error('Error obteniendo métricas detalladas: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las métricas detalladas'
    });
  }
});

// Endpoint de estadísticas básicas
// GET /api/images/stats
router.get('/stats/summary', function(req, res) {
  try {
    // Estadísticas básicas (a implementar completamente en fases posteriores)
    
    logger.systemLog('IMAGES', 'Estadísticas solicitadas');
    
    res.json({
      success: true,
      data: {
        totalPending: 0,
        totalValidated: 0,
        totalRejected: 0,
        totalToday: 0,
        mlModelStatus: classifier.isLoaded ? 'loaded' : 'not_loaded',
        message: 'Estadísticas completas disponibles en fases posteriores'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo estadísticas: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las estadísticas'
    });
  }
});

// ====================================
// FASE 5: MLOPS ENDPOINTS
// ====================================

// Endpoint para evaluar triggers de reentrenamiento
// GET /api/images/mlops/triggers
router.get('/mlops/triggers', async function(req, res) {
  try {
    logger.systemLog('MLOPS', 'Evaluando triggers de reentrenamiento...');
    
    var evaluation = await mlopsMonitor.evaluateRetrainingTriggers();
    
    res.json({
      success: true,
      data: {
        shouldRetrain: evaluation.shouldRetrain,
        triggers: evaluation.triggers,
        metrics: evaluation.metrics,
        recommendations: evaluation.recommendations,
        nextCheckIn: evaluation.nextCheckIn
      },
      meta: {
        evaluatedAt: new Date().toISOString(),
        phase: 'Fase 5 - MLOps y Reentrenamiento'
      }
    });
    
  } catch (error) {
    logger.error('Error evaluando triggers MLOps: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron evaluar los triggers de reentrenamiento'
    });
  }
});

// Endpoint para obtener estado del scheduler
// GET /api/images/mlops/scheduler/status
router.get('/mlops/scheduler/status', function(req, res) {
  try {
    var status = retrainingScheduler.getStatus();
    
    res.json({
      success: true,
      data: status,
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - MLOps y Reentrenamiento'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo estado del scheduler: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener el estado del scheduler'
    });
  }
});

// Endpoint para iniciar/detener scheduler
// POST /api/images/mlops/scheduler/control
router.post('/mlops/scheduler/control', function(req, res) {
  try {
    var { action } = req.body;
    
    if (!action || !['start', 'stop'].includes(action)) {
      return res.status(400).json({
        error: 'Acción inválida',
        message: 'La acción debe ser "start" o "stop"'
      });
    }
    
    if (action === 'start') {
      retrainingScheduler.start();
      logger.systemLog('MLOPS', 'Scheduler iniciado via API');
    } else {
      retrainingScheduler.stop();
      logger.systemLog('MLOPS', 'Scheduler detenido via API');
    }
    
    var status = retrainingScheduler.getStatus();
    
    res.json({
      success: true,
      message: `Scheduler ${action === 'start' ? 'iniciado' : 'detenido'} exitosamente`,
      data: status
    });
    
  } catch (error) {
    logger.error('Error controlando scheduler: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo controlar el scheduler'
    });
  }
});

// Endpoint para ejecutar reentrenamiento manual
// POST /api/images/mlops/retrain
router.post('/mlops/retrain', async function(req, res) {
  try {
    logger.systemLog('MLOPS', 'Iniciando reentrenamiento manual via API...');
    
    var options = req.body.options || {};
    
    // Ejecutar reentrenamiento manual
    var result = await retrainingScheduler.triggerManualRetraining(options);
    
    res.json({
      success: true,
      message: 'Reentrenamiento manual completado',
      data: {
        retrainingSuccessful: result.success,
        newAccuracy: result.metrics.accuracy,
        improvement: result.metrics.improvement,
        version: result.version,
        completedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error en reentrenamiento manual: ' + error.message);
    
    // Diferentes códigos de error según el tipo
    var statusCode = 500;
    if (error.message.includes('ya hay un reentrenamiento')) {
      statusCode = 409; // Conflict
    } else if (error.message.includes('Insuficientes imágenes')) {
      statusCode = 422; // Unprocessable Entity
    }
    
    res.status(statusCode).json({
      error: 'Error en reentrenamiento',
      message: error.message
    });
  }
});

// Endpoint para obtener estadísticas de reentrenamientos
// GET /api/images/mlops/statistics
router.get('/mlops/statistics', async function(req, res) {
  try {
    var stats = await retrainingScheduler.getStatistics();
    var monitoringStatus = mlopsMonitor.getMonitoringStatus();
    
    res.json({
      success: true,
      data: {
        retrainingStats: stats,
        monitoring: {
          totalTriggers: monitoringStatus.totalTriggers,
          lastCheck: monitoringStatus.lastCheck,
          status: monitoringStatus.status,
          recentTriggers: monitoringStatus.recentTriggers.slice(0, 5) // Últimos 5
        }
      },
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - MLOps y Reentrenamiento'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo estadísticas MLOps: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las estadísticas de MLOps'
    });
  }
});

// Endpoint para obtener configuración MLOps
// GET /api/images/mlops/config
router.get('/mlops/config', function(req, res) {
  try {
    var schedulerStatus = retrainingScheduler.getStatus();
    var monitoringStatus = mlopsMonitor.getMonitoringStatus();
    
    res.json({
      success: true,
      data: {
        scheduler: schedulerStatus.config,
        monitoring: monitoringStatus.config,
        status: {
          schedulerRunning: schedulerStatus.isRunning,
          retrainingInProgress: schedulerStatus.retrainingInProgress,
          lastCheck: schedulerStatus.lastCheck
        }
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo configuración MLOps: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la configuración de MLOps'
    });
  }
});

// Endpoint para actualizar configuración del scheduler
// PUT /api/images/mlops/scheduler/config
router.put('/mlops/scheduler/config', function(req, res) {
  try {
    var newConfig = req.body;
    
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        error: 'Configuración inválida',
        message: 'Debe proporcionar un objeto de configuración válido'
      });
    }
    
    var updatedConfig = retrainingScheduler.updateConfig(newConfig);
    
    logger.systemLog('MLOPS', 'Configuración del scheduler actualizada via API');
    
    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: updatedConfig
    });
    
  } catch (error) {
    logger.error('Error actualizando configuración del scheduler: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo actualizar la configuración'
    });
  }
});

// ====================================
// FASE 5: ADVANCED METRICS ENDPOINTS
// ====================================

// Endpoint para métricas avanzadas
// GET /api/images/metrics/advanced
router.get('/metrics/advanced', function(req, res) {
  try {
    var advancedMetricsSummary = advancedMetrics.getMetricsSummary();
    
    logger.systemLog('ADVANCED_METRICS', 'Métricas avanzadas solicitadas');
    
    res.json({
      success: true,
      data: advancedMetricsSummary,
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - Advanced ML Metrics'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo métricas avanzadas: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las métricas avanzadas'
    });
  }
});

// Endpoint para reporte detallado de métricas
// GET /api/images/metrics/report
router.get('/metrics/report', function(req, res) {
  try {
    var detailedReport = advancedMetrics.generateDetailedReport();
    
    logger.systemLog('ADVANCED_METRICS', 'Reporte detallado de métricas solicitado');
    
    res.json({
      success: true,
      data: detailedReport,
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - Advanced ML Metrics'
      }
    });
    
  } catch (error) {
    logger.error('Error generando reporte detallado: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo generar el reporte detallado'
    });
  }
});

// Endpoint para matriz de confusión
// GET /api/images/metrics/confusion-matrix
router.get('/metrics/confusion-matrix', function(req, res) {
  try {
    var confusionMatrix = advancedMetrics.getConfusionMatrixForVisualization();
    
    logger.systemLog('ADVANCED_METRICS', 'Matriz de confusión solicitada');
    
    res.json({
      success: true,
      data: confusionMatrix,
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - Confusion Matrix'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo matriz de confusión: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la matriz de confusión'
    });
  }
});

// Endpoint para resetear métricas avanzadas
// POST /api/images/metrics/advanced/reset
router.post('/metrics/advanced/reset', function(req, res) {
  try {
    var resetResult = advancedMetrics.resetMetrics();
    
    logger.systemLog('ADVANCED_METRICS', 'Métricas avanzadas reseteadas via API');
    
    res.json({
      success: true,
      message: 'Métricas avanzadas reseteadas exitosamente',
      data: resetResult
    });
    
  } catch (error) {
    logger.error('Error reseteando métricas avanzadas: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron resetear las métricas avanzadas'
    });
  }
});

// ====================================
// FASE 5: MODEL VERSIONING ENDPOINTS
// ====================================

// Endpoint para obtener información de todas las versiones
// GET /api/images/versions
router.get('/versions', function(req, res) {
  try {
    var versionsInfo = modelVersioning.getVersionsInfo();
    
    res.json({
      success: true,
      data: versionsInfo,
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - Model Versioning'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo información de versiones: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la información de versiones'
    });
  }
});

// Endpoint para crear nueva versión manualmente
// POST /api/images/versions
router.post('/versions', async function(req, res) {
  try {
    var versionInfo = req.body;
    
    if (!versionInfo.description) {
      return res.status(400).json({
        error: 'Información incompleta',
        message: 'La descripción es requerida para crear una versión'
      });
    }
    
    var result = await modelVersioning.createVersion(versionInfo);
    
    logger.systemLog('VERSIONING', `Nueva versión creada manualmente via API: ${result.version}`);
    
    res.status(201).json({
      success: true,
      message: 'Nueva versión creada exitosamente',
      data: result
    });
    
  } catch (error) {
    logger.error('Error creando nueva versión: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear la nueva versión'
    });
  }
});

// Endpoint para desplegar versión específica
// POST /api/images/versions/:version/deploy
router.post('/versions/:version/deploy', async function(req, res) {
  try {
    var version = req.params.version;
    var deploymentOptions = req.body.options || {};
    
    var result = await modelVersioning.deployVersion(version, deploymentOptions);
    
    logger.systemLog('VERSIONING', `Versión ${version} desplegada via API`);
    
    res.json({
      success: true,
      message: `Versión ${version} desplegada exitosamente`,
      data: result
    });
    
  } catch (error) {
    logger.error('Error desplegando versión: ' + error.message);
    
    var statusCode = 500;
    if (error.message.includes('no existe')) {
      statusCode = 404;
    } else if (error.message.includes('no encontrado')) {
      statusCode = 404;
    }
    
    res.status(statusCode).json({
      error: 'Error en deployment',
      message: error.message
    });
  }
});

// Endpoint para hacer rollback a versión anterior
// POST /api/images/versions/rollback
router.post('/versions/rollback', async function(req, res) {
  try {
    var { reason = 'manual_rollback' } = req.body;
    
    var result = await modelVersioning.rollbackToPreviousVersion(reason);
    
    logger.systemLog('VERSIONING', 'Rollback ejecutado via API');
    
    res.json({
      success: true,
      message: 'Rollback ejecutado exitosamente',
      data: result
    });
    
  } catch (error) {
    logger.error('Error en rollback: ' + error.message);
    res.status(500).json({
      error: 'Error en rollback',
      message: error.message
    });
  }
});

// Endpoint para obtener estadísticas de versioning
// GET /api/images/versions/statistics
router.get('/versions/statistics', function(req, res) {
  try {
    var stats = modelVersioning.getVersioningStatistics();
    
    res.json({
      success: true,
      data: stats,
      meta: {
        retrievedAt: new Date().toISOString(),
        phase: 'Fase 5 - Model Versioning'
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo estadísticas de versioning: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las estadísticas de versioning'
    });
  }
});

// Endpoint para limpiar versiones antiguas
// DELETE /api/images/versions/cleanup
router.delete('/versions/cleanup', async function(req, res) {
  try {
    var { keepCount = 5 } = req.body;
    
    var result = await modelVersioning.cleanupOldVersions(keepCount);
    
    logger.systemLog('VERSIONING', `Limpieza de versiones ejecutada via API: ${result.cleaned} eliminadas`);
    
    res.json({
      success: true,
      message: `Limpieza completada: ${result.cleaned} versiones eliminadas, ${result.kept} mantenidas`,
      data: result
    });
    
  } catch (error) {
    logger.error('Error en limpieza de versiones: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo ejecutar la limpieza de versiones'
    });
  }
});

// Endpoint para crear backup manual
// POST /api/images/versions/backup
router.post('/versions/backup', async function(req, res) {
  try {
    var { reason = 'manual_backup' } = req.body;
    var versionsInfo = modelVersioning.getVersionsInfo();
    var currentVersion = versionsInfo.currentVersion;
    
    var backupPath = await modelVersioning.createBackup(currentVersion, reason);
    
    logger.systemLog('VERSIONING', 'Backup manual creado via API');
    
    res.json({
      success: true,
      message: 'Backup creado exitosamente',
      data: {
        version: currentVersion,
        backupPath: backupPath,
        reason: reason,
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error creando backup: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear el backup'
    });
  }
});

// =============================================================================
// A/B TESTING ENDPOINTS - NUEVO EN FASE 6
// =============================================================================

// Endpoint para crear un nuevo test A/B
// POST /api/images/ab-tests
router.post('/ab-tests', async function(req, res) {
  try {
    var { 
      name, 
      description, 
      modelA, 
      modelB, 
      splitPercentage, 
      minSampleSize, 
      maxDuration,
      stratified 
    } = req.body;

    // Validar datos requeridos
    if (!name || !modelA || !modelB) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requieren name, modelA y modelB'
      });
    }

    var testConfig = {
      name,
      description,
      modelA,
      modelB,
      splitPercentage,
      minSampleSize,
      maxDuration,
      stratified
    };

    var testId = abTestingService.createTest(testConfig);

    logger.systemLog('AB_TESTING', `Nuevo test A/B creado: ${testId}`);

    res.status(201).json({
      success: true,
      message: 'Test A/B creado exitosamente',
      data: {
        testId: testId,
        config: testConfig,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error creando test A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear el test A/B'
    });
  }
});

// Endpoint para listar todos los tests A/B
// GET /api/images/ab-tests
router.get('/ab-tests', function(req, res) {
  try {
    var tests = abTestingService.getAllTests();

    res.json({
      success: true,
      data: {
        tests: tests,
        activeTests: tests.filter(t => t.status === 'running').length,
        completedTests: tests.filter(t => t.status === 'completed').length,
        totalTests: tests.length
      }
    });

  } catch (error) {
    logger.error('Error obteniendo tests A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los tests A/B'
    });
  }
});

// Endpoint para obtener resultados de un test específico
// GET /api/images/ab-tests/:testId
router.get('/ab-tests/:testId', function(req, res) {
  try {
    var testId = req.params.testId;
    var results = abTestingService.getTestResults(testId);

    if (!results) {
      return res.status(404).json({
        error: 'Test no encontrado',
        message: `No se encontró el test con ID: ${testId}`
      });
    }

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error('Error obteniendo resultados del test: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los resultados del test'
    });
  }
});

// Endpoint para detener un test A/B
// POST /api/images/ab-tests/:testId/stop
router.post('/ab-tests/:testId/stop', function(req, res) {
  try {
    var testId = req.params.testId;
    var stopped = abTestingService.stopTest(testId);

    if (!stopped) {
      return res.status(404).json({
        error: 'Test no encontrado o ya finalizado',
        message: `No se pudo detener el test con ID: ${testId}`
      });
    }

    logger.systemLog('AB_TESTING', `Test A/B detenido manualmente: ${testId}`);

    res.json({
      success: true,
      message: 'Test A/B detenido exitosamente',
      data: {
        testId: testId,
        stoppedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error deteniendo test A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo detener el test A/B'
    });
  }
});

// Endpoint para eliminar un test A/B
// DELETE /api/images/ab-tests/:testId
router.delete('/ab-tests/:testId', function(req, res) {
  try {
    var testId = req.params.testId;
    var deleted = abTestingService.deleteTest(testId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Test no encontrado',
        message: `No se encontró el test con ID: ${testId}`
      });
    }

    logger.systemLog('AB_TESTING', `Test A/B eliminado: ${testId}`);

    res.json({
      success: true,
      message: 'Test A/B eliminado exitosamente',
      data: {
        testId: testId,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error eliminando test A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo eliminar el test A/B'
    });
  }
});

// Endpoint para obtener configuración de A/B testing
// GET /api/images/ab-tests/config
router.get('/ab-tests/config', function(req, res) {
  try {
    res.json({
      success: true,
      data: abTestingService.config
    });

  } catch (error) {
    logger.error('Error obteniendo configuración A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la configuración'
    });
  }
});

// Endpoint para actualizar configuración de A/B testing
// PUT /api/images/ab-tests/config
router.put('/ab-tests/config', function(req, res) {
  try {
    var newConfig = req.body;
    abTestingService.updateConfig(newConfig);

    logger.systemLog('AB_TESTING', 'Configuración actualizada via API');

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: abTestingService.config
    });

  } catch (error) {
    logger.error('Error actualizando configuración A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo actualizar la configuración'
    });
  }
});

// Endpoint para registrar feedback de usuario en A/B test
// POST /api/images/ab-tests/:testId/feedback
router.post('/ab-tests/:testId/feedback', function(req, res) {
  try {
    var testId = req.params.testId;
    var { userId, actualLabel, aiPrediction, group } = req.body;

    if (!userId || !actualLabel || !aiPrediction || !group) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requieren userId, actualLabel, aiPrediction y group'
      });
    }

    // Update the test with the correct label
    abTestingService.recordPrediction(testId, userId, group, aiPrediction, actualLabel, 0);

    logger.systemLog('AB_TESTING', `Feedback registrado para test ${testId}: ${userId} -> ${actualLabel}`);

    res.json({
      success: true,
      message: 'Feedback registrado exitosamente',
      data: {
        testId: testId,
        userId: userId,
        registeredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error registrando feedback A/B: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo registrar el feedback'
    });
  }
});

// =============================================================================
// MODEL TESTING ENDPOINTS - NUEVO EN FASE 6
// =============================================================================

// Endpoint para ejecutar suite completa de tests
// POST /api/images/tests/run
router.post('/tests/run', async function(req, res) {
  try {
    logger.systemLog('ML_TESTS', 'Starting automated test suite via API');
    
    var testSuite = new MLModelTestSuite();
    var results = await testSuite.runAllTests();
    
    // Save test results
    var resultsPath = path.join(process.cwd(), 'storage', 'test_results.json');
    var outputData = {
      timestamp: new Date().toISOString(),
      summary: results.summary,
      results: results.results,
      recommendations: results.recommendations,
      triggeredBy: 'api'
    };
    
    require('fs').writeFileSync(resultsPath, JSON.stringify(outputData, null, 2));
    
    logger.systemLog('ML_TESTS', `Test suite completed. Score: ${results.summary.score.toFixed(1)}%`);
    
    res.json({
      success: true,
      message: 'Test suite completed successfully',
      data: {
        summary: results.summary,
        results: results.results,
        recommendations: results.recommendations,
        savedTo: resultsPath
      }
    });
    
  } catch (error) {
    logger.error('Error running test suite: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo ejecutar la suite de tests'
    });
  }
});

// Endpoint para ejecutar un test específico
// POST /api/images/tests/run/:testName
router.post('/tests/run/:testName', async function(req, res) {
  try {
    var testName = req.params.testName;
    var testSuite = new MLModelTestSuite();
    
    logger.systemLog('ML_TESTS', `Running specific test: ${testName}`);
    
    var results = await testSuite.runSpecificTest(testName);
    
    res.json({
      success: true,
      message: `Test '${testName}' completed successfully`,
      data: results
    });
    
  } catch (error) {
    logger.error(`Error running test ${req.params.testName}: ` + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: `No se pudo ejecutar el test: ${req.params.testName}`
    });
  }
});

// Endpoint para obtener resultados de tests anteriores
// GET /api/images/tests/results
router.get('/tests/results', function(req, res) {
  try {
    var resultsPath = path.join(process.cwd(), 'storage', 'test_results.json');
    
    if (!require('fs').existsSync(resultsPath)) {
      return res.status(404).json({
        error: 'Resultados no encontrados',
        message: 'No se han ejecutado tests anteriormente'
      });
    }
    
    var results = JSON.parse(require('fs').readFileSync(resultsPath, 'utf8'));
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    logger.error('Error reading test results: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los resultados de tests'
    });
  }
});

// Endpoint para obtener métricas de calidad del modelo
// GET /api/images/tests/quality-metrics
router.get('/tests/quality-metrics', async function(req, res) {
  try {
    var testSuite = new MLModelTestSuite();
    
    // Quick quality assessment
    var qualityTests = [
      'model-loading',
      'prediction-accuracy',
      'prediction-speed'
    ];
    
    var results = [];
    for (var testName of qualityTests) {
      try {
        var result = await testSuite.runSpecificTest(testName);
        results.push(result);
      } catch (error) {
        logger.warn(`Quality test ${testName} failed: ${error.message}`);
      }
    }
    
    // Calculate overall quality score
    var allTestResults = results.flatMap(r => r.results);
    var passed = allTestResults.filter(r => r.status === 'passed').length;
    var total = allTestResults.length;
    var qualityScore = total > 0 ? (passed / total) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        qualityScore: qualityScore,
        tests: results,
        timestamp: new Date().toISOString(),
        recommendation: qualityScore >= 80 ? 
          'Model quality is good' : 
          'Model quality needs improvement'
      }
    });
    
  } catch (error) {
    logger.error('Error getting quality metrics: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las métricas de calidad'
    });
  }
});

// Endpoint para verificar la configuración de tests
// GET /api/images/tests/config
router.get('/tests/config', function(req, res) {
  try {
    var testSuite = new MLModelTestSuite();
    
    res.json({
      success: true,
      data: {
        config: testSuite.testConfig,
        availableTests: [
          'model-loading',
          'prediction-accuracy', 
          'prediction-speed',
          'input-validation',
          'confidence-scores',
          'memory-usage',
          'concurrent-predictions'
        ],
        testImagesAvailable: testSuite.getTestImages().length
      }
    });
    
  } catch (error) {
    logger.error('Error getting test config: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la configuración de tests'
    });
  }
});

// =============================================================================
// WINNER SELECTION & DEPLOYMENT ENDPOINTS - NUEVO EN FASE 6
// =============================================================================

// Endpoint para evaluar si un test está listo para deployment
// GET /api/images/winner-selection/:testId/evaluate
router.get('/winner-selection/:testId/evaluate', async function(req, res) {
  try {
    var testId = req.params.testId;
    var evaluation = await winnerSelectionService.evaluateTestForWinnerSelection(testId);
    
    res.json({
      success: true,
      data: evaluation
    });
    
  } catch (error) {
    logger.error('Error evaluating test for winner selection: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo evaluar el test para deployment'
    });
  }
});

// Endpoint para deployment automático del ganador
// POST /api/images/winner-selection/:testId/auto-deploy
router.post('/winner-selection/:testId/auto-deploy', async function(req, res) {
  try {
    var testId = req.params.testId;
    var result = await winnerSelectionService.autoDeployWinner(testId);
    
    if (result.deployed) {
      logger.systemLog('WINNER_SELECTION', `Auto-deployment successful for test ${testId}`);
    } else {
      logger.systemLog('WINNER_SELECTION', `Auto-deployment failed for test ${testId}: ${result.reason}`);
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Error in auto-deployment: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo ejecutar el deployment automático'
    });
  }
});

// Endpoint para deployment manual del ganador
// POST /api/images/winner-selection/:testId/manual-deploy
router.post('/winner-selection/:testId/manual-deploy', async function(req, res) {
  try {
    var testId = req.params.testId;
    var { forceOverride = false } = req.body;
    
    var result = await winnerSelectionService.manualDeployWinner(testId, forceOverride);
    
    logger.systemLog('WINNER_SELECTION', `Manual deployment for test ${testId}: ${result.deployed ? 'success' : 'failed'}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Error in manual deployment: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo ejecutar el deployment manual'
    });
  }
});

// Endpoint para obtener historial de deployments
// GET /api/images/winner-selection/deployment-history
router.get('/winner-selection/deployment-history', function(req, res) {
  try {
    var history = winnerSelectionService.getDeploymentHistory();
    var stats = winnerSelectionService.getDeploymentStats();
    
    res.json({
      success: true,
      data: {
        history: history,
        stats: stats
      }
    });
    
  } catch (error) {
    logger.error('Error getting deployment history: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener el historial de deployments'
    });
  }
});

// Endpoint para obtener estadísticas de deployment
// GET /api/images/winner-selection/stats
router.get('/winner-selection/stats', function(req, res) {
  try {
    var stats = winnerSelectionService.getDeploymentStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error getting deployment stats: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las estadísticas de deployment'
    });
  }
});

// Endpoint para obtener configuración de winner selection
// GET /api/images/winner-selection/config
router.get('/winner-selection/config', function(req, res) {
  try {
    res.json({
      success: true,
      data: winnerSelectionService.config
    });
    
  } catch (error) {
    logger.error('Error getting winner selection config: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la configuración'
    });
  }
});

// Endpoint para actualizar configuración de winner selection
// PUT /api/images/winner-selection/config
router.put('/winner-selection/config', function(req, res) {
  try {
    var newConfig = req.body;
    winnerSelectionService.updateConfig(newConfig);
    
    logger.systemLog('WINNER_SELECTION', 'Configuration updated via API');
    
    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: winnerSelectionService.config
    });
    
  } catch (error) {
    logger.error('Error updating winner selection config: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo actualizar la configuración'
    });
  }
});

// Endpoint para promover deployment canary
// POST /api/images/winner-selection/:testId/promote-canary
router.post('/winner-selection/:testId/promote-canary', async function(req, res) {
  try {
    var testId = req.params.testId;
    var result = await winnerSelectionService.simulateCanaryPromotion(testId);
    
    logger.systemLog('WINNER_SELECTION', `Canary promotion for test ${testId}: ${result.promoted ? 'success' : 'failed'}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Error promoting canary deployment: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo promover el deployment canary'
    });
  }
});

// Endpoint para rollback de deployment
// POST /api/images/winner-selection/rollback
router.post('/winner-selection/rollback', async function(req, res) {
  try {
    var { version, reason = 'manual_rollback' } = req.body;
    
    if (!version) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requiere el campo version'
      });
    }
    
    var result = await winnerSelectionService.rollbackDeployment(version);
    
    logger.systemLog('WINNER_SELECTION', `Manual rollback to version ${version}: ${result.success ? 'success' : 'failed'}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Error in rollback: ' + error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo ejecutar el rollback'
    });
  }
});

export default router;