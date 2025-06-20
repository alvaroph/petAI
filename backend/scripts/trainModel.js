#!/usr/bin/env node

/**
 * Script de entrenamiento para el modelo PetClassifier
 * Entrena el modelo con un dataset sintético para demostración
 */

import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PetClassifier from '../models/PetClassifier.js';
import logger from '../utils/logger.js';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

// Configuración del entrenamiento
var TRAINING_CONFIG = {
  epochs: 10,
  batchSize: 16,
  validationSplit: 0.2,
  learningRate: 0.001,
  imageSize: 224,
  numSamples: 200, // Muestras sintéticas por clase
  augmentation: true
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
 * Genera datos sintéticos para entrenamiento
 * Simula características de imágenes de mascotas
 */
function generateSyntheticData(numSamples, imageSize) {
  info(`Generando ${numSamples * 2} muestras sintéticas...`);
  
  var images = [];
  var labels = [];
  
  // Generar muestras para "dog"
  for (var i = 0; i < numSamples; i++) {
    // Simular imagen de perro con colores tierra/marrones
    var image = tf.randomNormal([imageSize, imageSize, 3]);
    
    // Añadir características "dog-like" (simplificado para demo)
    var brownTint = tf.tensor([0.6, 0.4, 0.2]); // Tinte marrón canino
    image = image.add(brownTint);
    image = tf.clipByValue(image, 0, 1);
    
    images.push(image);
    labels.push([0, 1]); // [cat, dog]
  }
  
  // Generar muestras para "cat"
  for (var i = 0; i < numSamples; i++) {
    // Simular imagen de gato con colores grises/claros
    var image = tf.randomNormal([imageSize, imageSize, 3]);
    
    // Añadir características "cat-like"
    var grayTint = tf.tensor([0.5, 0.5, 0.4]); // Tinte gris felino
    image = image.add(grayTint);
    image = tf.clipByValue(image, 0, 1);
    
    images.push(image);
    labels.push([1, 0]); // [cat, dog]
  }
  
  // Concatenar todos los tensors
  var imagesTensor = tf.stack(images);
  var labelsTensor = tf.tensor2d(labels);
  
  // Limpiar memoria
  images.forEach(img => img.dispose());
  
  success(`Dataset sintético generado: ${imagesTensor.shape}`);
  return { images: imagesTensor, labels: labelsTensor };
}

/**
 * Aplica data augmentation a las imágenes
 * Versión simplificada compatible con TensorFlow.js Node
 */
function applyDataAugmentation(images) {
  info('Aplicando data augmentation...');
  
  return tf.tidy(() => {
    // Flip horizontal aleatorio (50% de probabilidad)
    var shouldFlip = tf.randomUniform([images.shape[0], 1, 1, 1], 0, 1);
    var mask = tf.greater(shouldFlip, 0.5);
    var flipped = tf.where(mask, tf.reverse(images, [2]), images);
    
    // Variaciones de brillo
    var brightness = tf.randomUniform([images.shape[0], 1, 1, 1], -0.1, 0.1);
    var brightened = tf.add(flipped, brightness);
    brightened = tf.clipByValue(brightened, 0, 1);
    
    // Variaciones de contraste
    var contrast = tf.randomUniform([images.shape[0], 1, 1, 1], 0.8, 1.2);
    var contrasted = tf.mul(brightened, contrast);
    contrasted = tf.clipByValue(contrasted, 0, 1);
    
    return contrasted;
  });
}

/**
 * Entrena el modelo con callbacks personalizados
 */
async function trainModel(classifier, trainData, validationData) {
  success('Iniciando entrenamiento del modelo...');
  
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
      if (logs.acc > 0.95) {
        warning('Precisión muy alta alcanzada, posible overfitting');
      }
    },
    
    onTrainBegin: async () => {
      info('🚀 Entrenamiento iniciado');
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
  
  info(`📊 Resultados de evaluación:`);
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
    modelVersion: '1.0.0'
  };
  
  var metricsPath = path.join(modelPath, 'training_metrics.json');
  await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  
  success(`Métricas guardadas en: ${metricsPath}`);
}

/**
 * Función principal de entrenamiento
 */
async function main() {
  console.log(`${colors.bold}${colors.blue}🧠 PetAI Model Training Pipeline${colors.reset}\n`);
  
  try {
    // 1. Inicializar clasificador
    info('Inicializando clasificador...');
    var classifier = new PetClassifier();
    await classifier.loadModel(); // Esto creará el modelo básico
    
    // 2. Generar datos de entrenamiento
    var trainData = generateSyntheticData(
      TRAINING_CONFIG.numSamples, 
      TRAINING_CONFIG.imageSize
    );
    
    // 3. Aplicar data augmentation si está habilitado
    if (TRAINING_CONFIG.augmentation) {
      var augmentedImages = applyDataAugmentation(trainData.images);
      trainData.images.dispose();
      trainData.images = augmentedImages;
    }
    
    // 4. Crear datos de test (10% del total)
    var testSize = Math.floor(trainData.images.shape[0] * 0.1);
    var testImages = trainData.images.slice([0, 0, 0, 0], [testSize, -1, -1, -1]);
    var testLabels = trainData.labels.slice([0, 0], [testSize, -1]);
    
    var testData = { images: testImages, labels: testLabels };
    
    // 5. Entrenar modelo
    var history = await trainModel(classifier, trainData, null);
    
    // 6. Evaluar modelo
    var evaluation = await evaluateModel(classifier, testData);
    
    // 7. Guardar modelo entrenado
    info('Guardando modelo entrenado...');
    await classifier.saveModel();
    
    // 8. Guardar métricas
    await saveTrainingMetrics(history, evaluation, classifier.modelPath);
    
    // 9. Limpiar memoria
    trainData.images.dispose();
    trainData.labels.dispose();
    testData.images.dispose();
    testData.labels.dispose();
    
    // 10. Resumen final
    console.log(`\n${colors.bold}📋 Resumen del Entrenamiento${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(50)}${colors.reset}`);
    success(`Modelo entrenado exitosamente`);
    info(`Épocas: ${TRAINING_CONFIG.epochs}`);
    info(`Tamaño de batch: ${TRAINING_CONFIG.batchSize}`);
    info(`Muestras de entrenamiento: ${TRAINING_CONFIG.numSamples * 2}`);
    info(`Precisión final: ${(evaluation.accuracy * 100).toFixed(2)}%`);
    info(`Loss final: ${evaluation.loss.toFixed(4)}`);
    info(`Modelo guardado en: ${classifier.modelPath}`);
    
    if (evaluation.accuracy > 0.8) {
      success(`🎉 ¡Entrenamiento exitoso! Precisión > 80%`);
    } else {
      warning(`⚠️  Precisión baja (${(evaluation.accuracy * 100).toFixed(2)}%). Considera ajustar hiperparámetros.`);
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