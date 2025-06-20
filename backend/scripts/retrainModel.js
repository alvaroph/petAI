#!/usr/bin/env node

/**
 * Script de reentrenamiento automático para el modelo PetClassifier
 * Fase 5: MLOps - Reentrenamiento con datos validados por usuarios
 */

import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import PetClassifier from '../models/PetClassifier.js';
import logger from '../utils/logger.js';
import ValidatedDatasetPreparator from './prepareValidatedDataset.js';
import metricsTracker from '../utils/metricsTracker.js';
import modelVersioning from '../utils/modelVersioning.js';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

// Configuración del reentrenamiento
var RETRAIN_CONFIG = {
  epochs: 5,
  batchSize: 16,
  validationSplit: 0.2,
  learningRate: 0.0001, // Learning rate más bajo para fine-tuning
  imageSize: 224,
  minImagesPerClass: 10,
  maxImagesPerClass: 300,
  dataAugmentation: true,
  transferLearning: false // Para reentrenamiento completo
};

// Colores para output
var colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
  logger.mlLog('info', message);
}

function success(message) {
  log('green', `✅ ${message}`);
}

function error(message) {
  log('red', `❌ ${message}`);
  logger.mlLog('error', message);
}

function info(message) {
  log('blue', `ℹ️  ${message}`);
}

function warning(message) {
  log('yellow', `⚠️  ${message}`);
}

/**
 * Cargar y preprocessar imágenes desde directorio
 */
async function loadImagesFromDirectory(directoryPath, className) {
  try {
    if (!await fs.access(directoryPath).then(() => true).catch(() => false)) {
      warning(`Directorio no encontrado: ${directoryPath}`);
      return { images: [], labels: [] };
    }

    var files = await fs.readdir(directoryPath);
    var imageFiles = files.filter(f => f.toLowerCase().endsWith('.jpg'));
    
    if (imageFiles.length === 0) {
      warning(`No se encontraron imágenes en: ${directoryPath}`);
      return { images: [], labels: [] };
    }

    info(`Cargando ${imageFiles.length} imágenes de ${className} desde ${directoryPath}`);
    
    var images = [];
    var labels = [];
    
    for (var file of imageFiles) {
      try {
        var imagePath = path.join(directoryPath, file);
        
        // Procesar imagen con Sharp
        var buffer = await sharp(imagePath)
          .resize(RETRAIN_CONFIG.imageSize, RETRAIN_CONFIG.imageSize)
          .jpeg()
          .toBuffer();
        
        // Convertir a tensor
        var tensor = tf.node.decodeImage(buffer, 3);
        tensor = tf.cast(tensor, 'float32');
        tensor = tf.div(tensor, 255.0); // Normalizar a [0,1]
        
        images.push(tensor);
        
        // Label encoding: [cat, dog]
        if (className === 'cat') {
          labels.push([1, 0]);
        } else if (className === 'dog') {
          labels.push([0, 1]);
        }
        
      } catch (err) {
        warning(`Error procesando imagen ${file}: ${err.message}`);
      }
    }
    
    success(`Cargadas ${images.length} imágenes de ${className}`);
    return { images, labels };
    
  } catch (err) {
    error(`Error cargando imágenes de ${directoryPath}: ${err.message}`);
    return { images: [], labels: [] };
  }
}

/**
 * Crear dataset de entrenamiento desde directorio de reentrenamiento
 */
async function createTrainingDataset(datasetPath) {
  info('Creando dataset de entrenamiento...');
  
  var catData = await loadImagesFromDirectory(path.join(datasetPath, 'cat'), 'cat');
  var dogData = await loadImagesFromDirectory(path.join(datasetPath, 'dog'), 'dog');
  
  // Verificar que tenemos suficientes imágenes
  if (catData.images.length < RETRAIN_CONFIG.minImagesPerClass || 
      dogData.images.length < RETRAIN_CONFIG.minImagesPerClass) {
    throw new Error(`Insuficientes imágenes para reentrenamiento. ` +
      `Mínimo ${RETRAIN_CONFIG.minImagesPerClass} por clase. ` +
      `Disponibles: ${catData.images.length} gatos, ${dogData.images.length} perros`);
  }
  
  // Combinar datos
  var allImages = [...catData.images, ...dogData.images];
  var allLabels = [...catData.labels, ...dogData.labels];
  
  // Convertir a tensors
  var imagesTensor = tf.stack(allImages);
  var labelsTensor = tf.tensor2d(allLabels);
  
  // Limpiar memoria
  allImages.forEach(img => img.dispose());
  
  info(`Dataset creado: ${imagesTensor.shape[0]} imágenes totales`);
  info(`- Gatos: ${catData.images.length}`);
  info(`- Perros: ${dogData.images.length}`);
  
  return {
    images: imagesTensor,
    labels: labelsTensor,
    stats: {
      totalImages: imagesTensor.shape[0],
      catImages: catData.images.length,
      dogImages: dogData.images.length,
      balance: (dogData.images.length / catData.images.length).toFixed(2)
    }
  };
}

/**
 * Aplicar data augmentation mejorado
 */
function applyDataAugmentation(images) {
  info('Aplicando data augmentation...');
  
  return tf.tidy(() => {
    // Flip horizontal aleatorio
    var shouldFlip = tf.randomUniform([images.shape[0], 1, 1, 1], 0, 1);
    var mask = tf.greater(shouldFlip, 0.5);
    var flipped = tf.where(mask, tf.reverse(images, [2]), images);
    
    // Variaciones de brillo (-10% a +10%)
    var brightness = tf.randomUniform([images.shape[0], 1, 1, 1], -0.1, 0.1);
    var brightened = tf.add(flipped, brightness);
    brightened = tf.clipByValue(brightened, 0, 1);
    
    // Variaciones de contraste (80% a 120%)
    var contrast = tf.randomUniform([images.shape[0], 1, 1, 1], 0.8, 1.2);
    var contrasted = tf.mul(brightened, contrast);
    contrasted = tf.clipByValue(contrasted, 0, 1);
    
    // Rotación ligera (esto es simplificado, en producción usar tf.image.rot90)
    // Por ahora solo aplicamos las transformaciones anteriores
    
    return contrasted;
  });
}

/**
 * Entrenar modelo con callbacks de monitoreo
 */
async function retrainModel(classifier, trainData, validationData, previousAccuracy) {
  success('Iniciando reentrenamiento del modelo...');
  
  // Configurar optimizer con learning rate más bajo para fine-tuning
  classifier.model.compile({
    optimizer: tf.train.adam(RETRAIN_CONFIG.learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  var bestAccuracy = 0;
  var bestEpoch = 0;
  
  // Callbacks para monitoring
  var callbacks = {
    onEpochEnd: async (epoch, logs) => {
      info(`Época ${epoch + 1}/${RETRAIN_CONFIG.epochs}:`);
      info(`  - Loss: ${logs.loss.toFixed(4)}`);
      info(`  - Accuracy: ${(logs.acc * 100).toFixed(2)}%`);
      
      if (logs.val_loss) {
        info(`  - Val Loss: ${logs.val_loss.toFixed(4)}`);
        info(`  - Val Accuracy: ${(logs.val_acc * 100).toFixed(2)}%`);
        
        // Tracking del mejor modelo
        if (logs.val_acc > bestAccuracy) {
          bestAccuracy = logs.val_acc;
          bestEpoch = epoch;
        }
      }
      
      // Comparar con accuracy previa
      if (previousAccuracy && logs.acc > previousAccuracy * 1.05) {
        success(`¡Mejora detectada! Accuracy subió de ${(previousAccuracy * 100).toFixed(2)}% a ${(logs.acc * 100).toFixed(2)}%`);
      }
      
      // Early stopping si accuracy es muy alta
      if (logs.acc > 0.98) {
        warning('Accuracy muy alta - Posible overfitting');
      }
    },
    
    onTrainBegin: async () => {
      info('🚀 Reentrenamiento iniciado');
      if (previousAccuracy) {
        info(`📊 Accuracy previa del modelo: ${(previousAccuracy * 100).toFixed(2)}%`);
      }
    },
    
    onTrainEnd: async () => {
      success('🎯 Reentrenamiento completado');
      info(`📈 Mejor accuracy de validación: ${(bestAccuracy * 100).toFixed(2)}% (época ${bestEpoch + 1})`);
    }
  };
  
  // Ejecutar entrenamiento
  var history = await classifier.model.fit(
    trainData.images,
    trainData.labels,
    {
      epochs: RETRAIN_CONFIG.epochs,
      batchSize: RETRAIN_CONFIG.batchSize,
      validationSplit: RETRAIN_CONFIG.validationSplit,
      callbacks: callbacks,
      verbose: 0
    }
  );
  
  return { history, bestAccuracy, bestEpoch };
}

/**
 * Evaluar modelo reentrenado vs anterior
 */
async function evaluateModelImprovement(classifier, testData, previousAccuracy) {
  info('Evaluando mejoras del modelo reentrenado...');
  
  var evaluation = classifier.model.evaluate(testData.images, testData.labels);
  var [loss, accuracy] = await Promise.all([evaluation[0].data(), evaluation[1].data()]);
  
  var newAccuracy = accuracy[0];
  var newLoss = loss[0];
  
  info(`📊 Resultados del modelo reentrenado:`);
  info(`   Loss: ${newLoss.toFixed(4)}`);
  info(`   Accuracy: ${(newAccuracy * 100).toFixed(2)}%`);
  
  if (previousAccuracy) {
    var improvement = newAccuracy - previousAccuracy;
    var improvementPercent = (improvement * 100);
    
    info(`📈 Comparación con modelo anterior:`);
    info(`   Accuracy anterior: ${(previousAccuracy * 100).toFixed(2)}%`);
    info(`   Accuracy nueva: ${(newAccuracy * 100).toFixed(2)}%`);
    info(`   Mejora: ${improvementPercent >= 0 ? '+' : ''}${improvementPercent.toFixed(2)} puntos porcentuales`);
    
    if (improvement > 0.02) { // 2% de mejora
      success(`🎉 ¡Mejora significativa detectada! (+${improvementPercent.toFixed(2)}%)`);
    } else if (improvement > 0) {
      info(`✅ Ligera mejora detectada (+${improvementPercent.toFixed(2)}%)`);
    } else {
      warning(`⚠️  No hay mejora o hay degradación (${improvementPercent.toFixed(2)}%)`);
    }
  }
  
  // Limpiar memoria
  evaluation.forEach(tensor => tensor.dispose());
  
  return { 
    loss: newLoss, 
    accuracy: newAccuracy, 
    improvement: previousAccuracy ? newAccuracy - previousAccuracy : null
  };
}

/**
 * Crear backup del modelo anterior
 */
async function backupPreviousModel(classifier, version) {
  try {
    var backupDir = path.join(process.cwd(), 'storage', 'models', 'backups', `pet_model_v${version}`);
    
    // Crear directorio de backup
    await fs.mkdir(backupDir, { recursive: true });
    
    // Copiar archivos del modelo actual
    var currentModelDir = classifier.modelPath;
    var files = await fs.readdir(currentModelDir);
    
    for (var file of files) {
      var sourcePath = path.join(currentModelDir, file);
      var targetPath = path.join(backupDir, file);
      await fs.copyFile(sourcePath, targetPath);
    }
    
    success(`Backup del modelo v${version} creado en: ${backupDir}`);
    return backupDir;
    
  } catch (error) {
    error(`Error creando backup: ${error.message}`);
    throw error;
  }
}

/**
 * Guardar métricas de reentrenamiento
 */
async function saveRetrainingMetrics(history, evaluation, modelPath, trainingStats, version) {
  var metrics = {
    modelVersion: version,
    retrainedAt: new Date().toISOString(),
    retrainingConfig: RETRAIN_CONFIG,
    finalLoss: evaluation.loss,
    finalAccuracy: evaluation.accuracy,
    improvement: evaluation.improvement,
    trainingStats: trainingStats,
    trainingHistory: {
      loss: history.history.loss,
      accuracy: history.history.acc,
      valLoss: history.history.val_loss || [],
      valAccuracy: history.history.val_acc || []
    },
    bestEpoch: history.bestEpoch,
    bestAccuracy: history.bestAccuracy
  };
  
  var metricsPath = path.join(modelPath, 'training_metrics.json');
  await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  
  success(`Métricas de reentrenamiento guardadas en: ${metricsPath}`);
  return metrics;
}

/**
 * Función principal de reentrenamiento
 */
async function main() {
  console.log(`${colors.bold}${colors.blue}🔄 PetAI Model Retraining Pipeline${colors.reset}\n`);
  
  try {
    // 1. Preparar dataset de reentrenamiento
    info('Preparando dataset de reentrenamiento...');
    var preparator = new ValidatedDatasetPreparator();
    var datasetResult = await preparator.prepareRetrainingDataset({
      includeOriginalTraining: true,
      minValidatedPerClass: RETRAIN_CONFIG.minImagesPerClass,
      maxImagesPerClass: RETRAIN_CONFIG.maxImagesPerClass
    });
    
    info(`Dataset preparado: ${datasetResult.summary.totalImages} imágenes`);
    
    // 2. Cargar modelo actual
    info('Cargando modelo actual...');
    var classifier = new PetClassifier();
    await classifier.loadModel();
    
    // Obtener accuracy del modelo anterior
    var previousAccuracy = null;
    try {
      var previousMetricsPath = path.join(classifier.modelPath, 'training_metrics.json');
      if (await fs.access(previousMetricsPath).then(() => true).catch(() => false)) {
        var previousMetrics = JSON.parse(await fs.readFile(previousMetricsPath, 'utf8'));
        previousAccuracy = previousMetrics.finalAccuracy;
      }
    } catch (err) {
      warning('No se pudo cargar accuracy del modelo anterior');
    }
    
    // 3. Crear dataset de entrenamiento
    var trainData = await createTrainingDataset(datasetResult.datasetPath);
    
    // 4. Aplicar data augmentation si está habilitado
    if (RETRAIN_CONFIG.dataAugmentation) {
      var augmentedImages = applyDataAugmentation(trainData.images);
      trainData.images.dispose();
      trainData.images = augmentedImages;
    }
    
    // 5. Crear datos de test (10% del total)
    var testSize = Math.floor(trainData.images.shape[0] * 0.1);
    var testImages = trainData.images.slice([0, 0, 0, 0], [testSize, -1, -1, -1]);
    var testLabels = trainData.labels.slice([0, 0], [testSize, -1]);
    var testData = { images: testImages, labels: testLabels };
    
    // 6. Crear versión del modelo actual antes del reentrenamiento
    var versionsInfo = modelVersioning.getVersionsInfo();
    var currentVersion = versionsInfo.currentVersion;
    
    info(`Modelo actual: v${currentVersion}`);
    
    // Crear backup automático
    await backupPreviousModel(classifier, currentVersion);
    
    // 7. Entrenar modelo
    var trainingResult = await retrainModel(classifier, trainData, null, previousAccuracy);
    
    // 8. Evaluar modelo
    var evaluation = await evaluateModelImprovement(classifier, testData, previousAccuracy);
    
    // 9. Decidir si mantener el nuevo modelo
    var shouldDeploy = evaluation.improvement === null || evaluation.improvement > -0.05; // No degradar más de 5%
    var newVersion = null;
    
    if (shouldDeploy) {
      // 10. Guardar modelo reentrenado temporalmente
      info('Guardando modelo reentrenado...');
      await classifier.saveModel();
      
      // 11. Crear nueva versión en el sistema de versionado
      var changeType = evaluation.improvement > 0.05 ? 'minor' : 'patch';
      var versionInfo = {
        changeType: changeType,
        description: `Reentrenamiento automático - Accuracy: ${(evaluation.accuracy * 100).toFixed(2)}%`,
        trainingMetrics: {
          finalAccuracy: evaluation.accuracy,
          finalLoss: evaluation.loss,
          improvement: evaluation.improvement,
          trainingStats: trainData.stats
        },
        retrainingReason: 'Automatic retraining based on user validations',
        deploymentStrategy: 'replace'
      };
      
      var versionResult = await modelVersioning.createVersion(versionInfo);
      newVersion = versionResult.version;
      
      // 12. Desplegar nueva versión
      var deploymentResult = await modelVersioning.deployVersion(newVersion, {
        createBackup: true,
        strategy: 'replace',
        rollbackOnFailure: true
      });
      
      // 13. Guardar métricas con nueva versión
      await saveRetrainingMetrics(
        trainingResult, 
        evaluation, 
        classifier.modelPath, 
        trainData.stats,
        newVersion
      );
      
      success(`🎉 Modelo reentrenado y desplegado con versión ${newVersion}`);
      success(`📦 Deployment ID: ${deploymentResult.deploymentId}`);
    } else {
      warning(`⚠️  Modelo reentrenado tiene peor rendimiento. Manteniendo modelo anterior.`);
      newVersion = currentVersion; // Mantener versión actual
    }
    
    // 14. Limpiar memoria
    trainData.images.dispose();
    trainData.labels.dispose();
    testData.images.dispose();
    testData.labels.dispose();
    
    // 15. Resumen final
    console.log(`\n${colors.bold}📋 Resumen del Reentrenamiento${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(50)}${colors.reset}`);
    
    if (shouldDeploy) {
      success(`Reentrenamiento exitoso`);
    } else {
      warning(`Reentrenamiento completado pero no desplegado`);
    }
    
    info(`Épocas: ${RETRAIN_CONFIG.epochs}`);
    info(`Imágenes de entrenamiento: ${trainData.stats.totalImages}`);
    info(`Balance del dataset: ${trainData.stats.balance} (dog/cat ratio)`);
    info(`Precisión final: ${(evaluation.accuracy * 100).toFixed(2)}%`);
    info(`Loss final: ${evaluation.loss.toFixed(4)}`);
    
    if (evaluation.improvement !== null) {
      var improvementPercent = (evaluation.improvement * 100);
      if (improvementPercent > 0) {
        success(`Mejora: +${improvementPercent.toFixed(2)} puntos porcentuales`);
      } else {
        warning(`Cambio: ${improvementPercent.toFixed(2)} puntos porcentuales`);
      }
    }
    
    return {
      success: shouldDeploy,
      metrics: evaluation,
      version: newVersion,
      previousVersion: currentVersion,
      deployed: shouldDeploy
    };
    
  } catch (err) {
    error(`Error durante el reentrenamiento: ${err.message}`);
    error(err.stack);
    process.exit(1);
  }
}

// Función para uso programático
export async function executeRetraining(options = {}) {
  // Merger opciones con config por defecto
  Object.assign(RETRAIN_CONFIG, options);
  return await main();
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    error(`Error principal: ${err.message}`);
    process.exit(1);
  });
}