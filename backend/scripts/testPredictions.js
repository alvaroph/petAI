#!/usr/bin/env node

/**
 * Script para probar predicciones del modelo de clasificación de mascotas
 * Crea imágenes de prueba y verifica las predicciones entre perros y gatos
 */

import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PetClassifier from '../models/PetClassifier.js';
import sharp from 'sharp';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

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
}

function success(message) {
  log('green', `✅ ${message}`);
}

function error(message) {
  log('red', `❌ ${message}`);
}

function info(message) {
  log('blue', `ℹ️  ${message}`);
}

function warning(message) {
  log('yellow', `⚠️  ${message}`);
}

/**
 * Crea una imagen sintética para testing
 */
async function createTestImage(type, filename) {
  var imageSize = 224;
  var channels = 3;
  
  info(`Creando imagen de prueba: ${filename} (tipo: ${type})`);
  
  // Crear tensor base
  var imageTensor;
  
  if (type === 'dog') {
    // Imagen con tonos dorados/marrones (simulando perro)
    imageTensor = tf.randomUniform([imageSize, imageSize, channels], 0, 1);
    var dogTint = tf.tensor([0.8, 0.6, 0.4]);
    imageTensor = imageTensor.add(dogTint);
  } else {
    // Imagen con tonos grises/blancos (simulando gato)
    imageTensor = tf.randomUniform([imageSize, imageSize, channels], 0, 1);
    var catTint = tf.tensor([0.6, 0.6, 0.6]);
    imageTensor = imageTensor.add(catTint);
  }
  
  // Clipear valores entre 0 y 1, convertir a 0-255
  imageTensor = tf.clipByValue(imageTensor, 0, 1);
  imageTensor = tf.mul(imageTensor, 255);
  imageTensor = tf.cast(imageTensor, 'int32');
  
  // Convertir a buffer
  var imageData = await imageTensor.data();
  var buffer = Buffer.from(imageData);
  
  // Usar Sharp para crear JPEG
  var jpegBuffer = await sharp(buffer, {
    raw: {
      width: imageSize,
      height: imageSize,
      channels: channels
    }
  })
  .jpeg({ quality: 90 })
  .toBuffer();
  
  // Guardar archivo
  var testImagesDir = path.join(__dirname, '..', 'storage', 'images', 'test');
  await fs.mkdir(testImagesDir, { recursive: true });
  
  var imagePath = path.join(testImagesDir, filename);
  await fs.writeFile(imagePath, jpegBuffer);
  
  // Limpiar memoria
  imageTensor.dispose();
  
  success(`Imagen creada: ${imagePath}`);
  return imagePath;
}

/**
 * Prueba una predicción individual
 */
async function testSinglePrediction(classifier, imagePath, expectedType) {
  try {
    info(`Probando predicción para: ${path.basename(imagePath)}`);
    
    var prediction = await classifier.predict(imagePath);
    
    var predictedClass = prediction.predictedClass;
    var confidence = prediction.confidence;
    var isCorrect = (expectedType === 'dog' && predictedClass === 'dog') ||
                   (expectedType === 'cat' && predictedClass === 'cat');
    
    if (isCorrect) {
      success(`✓ Predicción correcta: ${predictedClass} (${(confidence * 100).toFixed(1)}%)`);
    } else {
      warning(`✗ Predicción incorrecta: esperado ${expectedType}, obtuvo ${predictedClass} (${(confidence * 100).toFixed(1)}%)`);
    }
    
    info(`  Detalles:`);
    info(`    Clase predicha: ${predictedClass}`);
    info(`    Confianza: ${(confidence * 100).toFixed(2)}%`);
    info(`    Nivel: ${prediction.predictions.find(p => p.className === predictedClass) ? 
          (confidence > 0.8 ? 'alta' : confidence > 0.6 ? 'media' : 'baja') : 'error'}`);
    
    return {
      imagePath,
      expectedType,
      predictedClass,
      confidence,
      isCorrect,
      prediction
    };
    
  } catch (err) {
    error(`Error en predicción para ${imagePath}: ${err.message}`);
    return {
      imagePath,
      expectedType,
      error: err.message,
      isCorrect: false
    };
  }
}

/**
 * Ejecuta batería completa de tests
 */
async function runPredictionTests() {
  console.log(`${colors.bold}${colors.blue}🔮 PetAI Prediction Testing Suite${colors.reset}\n`);
  
  try {
    // 1. Inicializar clasificador
    info('Inicializando clasificador...');
    var classifier = new PetClassifier();
    await classifier.loadModel();
    
    success('Modelo cargado exitosamente');
    info(`Parámetros del modelo: ${classifier.model.countParams()}`);
    
    // 2. Crear imágenes de prueba
    info('\nCreando imágenes de prueba...');
    
    var testImages = [];
    
    // Crear múltiples imágenes de cada tipo
    for (var i = 1; i <= 3; i++) {
      testImages.push({
        path: await createTestImage('dog', `dog_test_${i}.jpg`),
        expectedType: 'dog'
      });
      
      testImages.push({
        path: await createTestImage('cat', `cat_test_${i}.jpg`),
        expectedType: 'cat'
      });
    }
    
    // 3. Ejecutar predicciones
    info('\n🧪 Ejecutando predicciones...');
    
    var results = [];
    var correctPredictions = 0;
    var totalPredictions = 0;
    
    for (var testImage of testImages) {
      console.log(`\n${colors.bold}--- Teste ${totalPredictions + 1}/${testImages.length} ---${colors.reset}`);
      
      var result = await testSinglePrediction(
        classifier, 
        testImage.path, 
        testImage.expectedType
      );
      
      results.push(result);
      
      if (result.isCorrect) {
        correctPredictions++;
      }
      totalPredictions++;
      
      // Pausa entre predicciones
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 4. Resumen de resultados
    console.log(`\n${colors.bold}📊 Resumen de Resultados${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(50)}${colors.reset}`);
    
    var accuracy = (correctPredictions / totalPredictions) * 100;
    
    info(`Total de pruebas: ${totalPredictions}`);
    info(`Predicciones correctas: ${correctPredictions}`);
    info(`Predicciones incorrectas: ${totalPredictions - correctPredictions}`);
    info(`Precisión general: ${accuracy.toFixed(1)}%`);
    
    // 5. Análisis detallado
    console.log(`\n${colors.bold}📋 Análisis Detallado${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(50)}${colors.reset}`);
    
    results.forEach((result, index) => {
      var status = result.isCorrect ? 
        `${colors.green}✓ CORRECTO${colors.reset}` : 
        `${colors.red}✗ INCORRECTO${colors.reset}`;
      
      var filename = path.basename(result.imagePath);
      var confidence = result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : 'N/A';
      
      console.log(`${(index + 1).toString().padStart(2)}: ${filename.padEnd(25)} ${status} (${confidence})`);
    });
    
    // 6. Recomendaciones
    console.log(`\n${colors.bold}💡 Recomendaciones${colors.reset}`);
    console.log(`${colors.bold}${'='.repeat(50)}${colors.reset}`);
    
    if (accuracy >= 90) {
      success('🎉 Excelente precisión! El modelo funciona muy bien.');
    } else if (accuracy >= 70) {
      warning('⚠️  Precisión aceptable, pero podría mejorarse con más entrenamiento.');
      info('💡 Considera aumentar el número de épocas o el tamaño del dataset.');
    } else {
      error('❌ Precisión baja. El modelo necesita reentrenamiento.');
      info('💡 Sugerencias:');
      info('   - Aumentar dataset de entrenamiento');
      info('   - Ajustar arquitectura del modelo');
      info('   - Revisar data augmentation');
      info('   - Aumentar épocas de entrenamiento');
    }
    
    // 7. Limpiar archivos de prueba (opcional)
    info('\n🧹 Limpiando archivos de prueba...');
    
    for (var result of results) {
      try {
        await fs.unlink(result.imagePath);
      } catch (err) {
        warning(`No se pudo eliminar ${result.imagePath}: ${err.message}`);
      }
    }
    
    success('Archivos de prueba eliminados');
    
    return {
      totalTests: totalPredictions,
      correctPredictions,
      accuracy,
      results
    };
    
  } catch (err) {
    error(`Error durante las pruebas: ${err.message}`);
    throw err;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    var results = await runPredictionTests();
    
    if (results.accuracy >= 70) {
      process.exit(0);
    } else {
      process.exit(1);
    }
    
  } catch (err) {
    error(`Error principal: ${err.message}`);
    process.exit(1);
  }
}

// Manejar señales
process.on('SIGINT', () => {
  warning('Pruebas interrumpidas por usuario');
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

// Ejecutar
main().catch(err => {
  error(`Error principal: ${err.message}`);
  process.exit(1);
});