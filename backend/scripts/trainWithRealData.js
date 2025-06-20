#!/usr/bin/env node

/**
 * Script de entrenamiento para el modelo PetClassifier con dataset real
 * Usa las imágenes reales de perros y gatos para entrenar el modelo
 */

import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PetClassifier from '../models/PetClassifier.js';
import logger from '../utils/logger.js';
import sharp from 'sharp';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

// Configuración del entrenamiento
var TRAINING_CONFIG = {
  epochs: 8,
  batchSize: 32,
  validationSplit: 0.2,
  learningRate: 0.0001,
  imageSize: 224,
  maxImagesPerClass: 500, // Limite para no sobrecargar la memoria
  augmentation: true
};

// Rutas de datos
var DATA_PATHS = {
  cats: path.join(__dirname, '../storage/images/training/cats'),
  dogs: path.join(__dirname, '../storage/images/training/dogs')
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
 * Carga y procesa imágenes reales
 */
async function loadRealImages(imagePaths, label, maxImages) {
  info(`Cargando ${maxImages} imágenes de ${label}s...`);
  
  var images = [];
  var labels = [];
  var processed = 0;
  
  // Tomar solo las primeras maxImages para evitar problemas de memoria
  var selectedPaths = imagePaths.slice(0, maxImages);
  
  for (var imagePath of selectedPaths) {
    try {
      // Procesar imagen con Sharp
      var buffer = await sharp(imagePath)
        .resize(TRAINING_CONFIG.imageSize, TRAINING_CONFIG.imageSize)
        .jpeg()
        .toBuffer();
      
      // Convertir a tensor
      var imageTensor = tf.node.decodeImage(buffer, 3);
      imageTensor = imageTensor.div(255.0); // Normalizar
      
      images.push(imageTensor);
      labels.push(label === 'dog' ? [0, 1] : [1, 0]); // [cat, dog]
      
      processed++;
      
      if (processed % 100 === 0) {
        info(`Procesadas ${processed}/${selectedPaths.length} imágenes de ${label}s`);
      }
      
    } catch (err) {
      warning(`Error procesando imagen ${imagePath}: ${err.message}`);
    }
  }
  
  success(`${processed} imágenes de ${label}s cargadas correctamente`);
  return { images, labels };
}

/**
 * Obtiene lista de archivos de imagen
 */
async function getImageFiles(dirPath) {
  try {
    var files = await fs.readdir(dirPath);
    var imageFiles = files
      .filter(file => file.toLowerCase().endsWith('.jpg'))
      .map(file => path.join(dirPath, file));
    
    return imageFiles;
  } catch (err) {
    error(`Error leyendo directorio ${dirPath}: ${err.message}`);
    return [];
  }
}

/**
 * Aplica data augmentation a las imágenes
 */
function applyDataAugmentation(images) {
  info('Aplicando data augmentation...');
  
  return tf.tidy(() => {
    // Flip horizontal aleatorio (50% de probabilidad)
    var shouldFlip = tf.randomUniform([images.shape[0], 1, 1, 1], 0, 1);
    var mask = tf.greater(shouldFlip, 0.5);
    var flipped = tf.where(mask, tf.reverse(images, [2]), images);
    
    // Variaciones de brillo
    var brightness = tf.randomUniform([images.shape[0], 1, 1, 1], -0.2, 0.2);
    var brightened = tf.add(flipped, brightness);
    brightened = tf.clipByValue(brightened, 0, 1);
    
    // Variaciones de contraste
    var contrast = tf.randomUniform([images.shape[0], 1, 1, 1], 0.7, 1.3);
    var contrasted = tf.mul(brightened, contrast);
    contrasted = tf.clipByValue(contrasted, 0, 1);
    
    return contrasted;
  });
}

/**
 * Entrena el modelo con callbacks personalizados
 */
async function trainModel(classifier, trainData, validationData) {
  success('Iniciando entrenamiento del modelo con datos reales...');
  
  // Configurar el modelo para entrenamiento
  classifier.model.compile({
    optimizer: tf.train.adam(TRAINING_CONFIG.learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  // Callbacks para monitoring
  var callbacks = {
    onEpochEnd: async (epoch, logs) => {
      info(`Época ${epoch + 1}/${TRAINING_CONFIG.epochs}:`);
      info(`  - Loss: ${logs.loss.toFixed(4)}`);
      info(`  - Accuracy: ${(logs.acc * 100).toFixed(2)}%`);
      
      if (logs.val_loss) {
        info(`  - Val Loss: ${logs.val_loss.toFixed(4)}`);
        info(`  - Val Accuracy: ${(logs.val_acc * 100).toFixed(2)}%`);
      }
      
      // Early stopping simple
      if (logs.acc > 0.99) {
        warning('Precisión muy alta alcanzada, posible overfitting');
      }
    },
    
    onTrainBegin: async () => {
      info('🚀 Entrenamiento iniciado con datos reales');
    },
    
    onTrainEnd: async () => {
      success('🎯 Entrenamiento completado');
    }
  };
  
  // Ejecutar entrenamiento
  var history = await classifier.model.fit(
    trainData.images,
    trainData.labels,
    {
      epochs: TRAINING_CONFIG.epochs,
      batchSize: TRAINING_CONFIG.batchSize,
      validationSplit: TRAINING_CONFIG.validationSplit,
      callbacks: callbacks,
      verbose: 0 // Usamos nuestros callbacks personalizados
    }
  );
  
  return history;
}

/**
 * Evalúa el modelo entrenado
 */
async function evaluateModel(classifier, testData) {
  info('Evaluando modelo entrenado...');
  
  var evaluation = classifier.model.evaluate(testData.images, testData.labels);
  var [loss, accuracy] = await Promise.all([evaluation[0].data(), evaluation[1].data()]);
  
  info(`📊 Resultados de evaluación:`)
  info(`   Loss: ${loss[0].toFixed(4)}`);
  info(`   Accuracy: ${(accuracy[0] * 100).toFixed(2)}%`);
  
  // Limpiar memoria
  evaluation.forEach(tensor => tensor.dispose());
  
  return { loss: loss[0], accuracy: accuracy[0] };
}

/**
 * Guarda métricas de entrenamiento
 */
async function saveTrainingMetrics(history, evaluation, modelPath) {
  var metrics = {
    trainingConfig: TRAINING_CONFIG,
    finalLoss: evaluation.loss,
    finalAccuracy: evaluation.accuracy,
    trainingHistory: {
      loss: history.history.loss,
      accuracy: history.history.acc,
      valLoss: history.history.val_loss || [],
      valAccuracy: history.history.val_acc || []
    },
    trainedAt: new Date().toISOString(),
    modelVersion: '1.1.0',
    datasetType: 'real_images',
    datasetSize: {
      cats: 'hasta ' + TRAINING_CONFIG.maxImagesPerClass,
      dogs: 'hasta ' + TRAINING_CONFIG.maxImagesPerClass
    }
  };
  
  var metricsPath = path.join(modelPath, 'training_metrics.json');
  await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  
  success(`Métricas guardadas en: ${metricsPath}`);
}

/**
 * Función principal de entrenamiento
 */
async function main() {
  console.log(`${colors.bold}${colors.blue}🧠 PetAI Real Dataset Training Pipeline${colors.reset}\n`);
  
  try {
    // 1. Verificar que existen los directorios de datos
    info('Verificando directorios de datos...');
    
    var catFiles = await getImageFiles(DATA_PATHS.cats);
    var dogFiles = await getImageFiles(DATA_PATHS.dogs);
    
    if (catFiles.length === 0) {
      throw new Error('No se encontraron imágenes de gatos en: ' + DATA_PATHS.cats);
    }
    
    if (dogFiles.length === 0) {
      throw new Error('No se encontraron imágenes de perros en: ' + DATA_PATHS.dogs);
    }
    
    info(`Encontradas ${catFiles.length} imágenes de gatos`);
    info(`Encontradas ${dogFiles.length} imágenes de perros`);
    
    // 2. Inicializar clasificador
    info('Inicializando clasificador...');
    var classifier = new PetClassifier();
    await classifier.loadModel(); // Esto creará el modelo básico
    
    // 3. Cargar imágenes reales
    var catData = await loadRealImages(catFiles, 'cat', TRAINING_CONFIG.maxImagesPerClass);
    var dogData = await loadRealImages(dogFiles, 'dog', TRAINING_CONFIG.maxImagesPerClass);
    
    // 4. Combinar datos
    var allImages = catData.images.concat(dogData.images);
    var allLabels = catData.labels.concat(dogData.labels);
    
    info(`Dataset final: ${allImages.length} imágenes`);
    
    // 5. Convertir a tensors
    var imagesTensor = tf.stack(allImages);
    var labelsTensor = tf.tensor2d(allLabels);
    
    // Limpiar arrays individuales
    allImages.forEach(img => img.dispose());
    
    // 6. Aplicar data augmentation si está habilitado
    if (TRAINING_CONFIG.augmentation) {
      var augmentedImages = applyDataAugmentation(imagesTensor);
      imagesTensor.dispose();
      imagesTensor = augmentedImages;
    }
    
    // 7. Crear datos de test (15% del total)
    var testSize = Math.floor(imagesTensor.shape[0] * 0.15);
    var testImages = imagesTensor.slice([0, 0, 0, 0], [testSize, -1, -1, -1]);
    var testLabels = labelsTensor.slice([0, 0], [testSize, -1]);
    
    var trainImages = imagesTensor.slice([testSize, 0, 0, 0], [-1, -1, -1, -1]);
    var trainLabels = labelsTensor.slice([testSize, 0], [-1, -1]);
    
    var trainData = { images: trainImages, labels: trainLabels };
    var testData = { images: testImages, labels: testLabels };
    
    info(`Entrenamiento: ${trainImages.shape[0]} imágenes`);
    info(`Prueba: ${testImages.shape[0]} imágenes`);
    
    // 8. Entrenar modelo
    var history = await trainModel(classifier, trainData, null);
    
    // 9. Evaluar modelo
    var evaluation = await evaluateModel(classifier, testData);
    
    // 10. Guardar modelo entrenado
    info('Guardando modelo entrenado...');
    await classifier.saveModel();
    
    // 11. Guardar métricas
    await saveTrainingMetrics(history, evaluation, classifier.modelPath);
    
    // 12. Limpiar memoria
    imagesTensor.dispose();
    labelsTensor.dispose();
    trainData.images.dispose();
    trainData.labels.dispose();
    testData.images.dispose();
    testData.labels.dispose();
    
    // 13. Resumen final
    console.log(`\n${colors.bold}📋 Resumen del Entrenamiento con Datos Reales${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(60)}${colors.reset}`);
    success(`Modelo entrenado exitosamente con dataset real`);
    info(`Épocas: ${TRAINING_CONFIG.epochs}`);
    info(`Tamaño de batch: ${TRAINING_CONFIG.batchSize}`);
    info(`Imágenes procesadas: ${allImages.length}`);
    info(`Precisión final: ${(evaluation.accuracy * 100).toFixed(2)}%`);
    info(`Loss final: ${evaluation.loss.toFixed(4)}`);
    info(`Modelo guardado en: ${classifier.modelPath}`);
    
    if (evaluation.accuracy > 0.85) {
      success(`🎉 ¡Entrenamiento exitoso! Precisión > 85%`);
    } else {
      warning(`⚠️  Precisión moderada (${(evaluation.accuracy * 100).toFixed(2)}%). Considera ajustar hiperparámetros.`);
    }
    
  } catch (err) {
    error(`Error durante el entrenamiento: ${err.message}`);
    error(err.stack);
    process.exit(1);
  }
}

// Manejar señales del sistema
process.on('SIGINT', () => {
  warning('Entrenamiento interrumpido por usuario');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Ejecutar entrenamiento
main().catch(err => {
  error(`Error principal: ${err.message}`);
  process.exit(1);
});