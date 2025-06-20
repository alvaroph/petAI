#!/usr/bin/env node

/**
 * Script de entrenamiento simplificado para el modelo PetClassifier
 * Versión optimizada para usar menos memoria
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

// Configuración más conservadora
var TRAINING_CONFIG = {
  epochs: 5,
  batchSize: 16,
  validationSplit: 0.2,
  learningRate: 0.001,
  imageSize: 224, // Mantener tamaño original del modelo
  maxImagesPerClass: 200 // Menos imágenes
};

// Rutas de datos
var DATA_PATHS = {
  cats: path.join(__dirname, '../storage/images/training/cats'),
  dogs: path.join(__dirname, '../storage/images/training/dogs')
};

console.log('🧠 PetAI Simplified Training');
console.log(`📊 Dataset: ${TRAINING_CONFIG.maxImagesPerClass} imágenes por clase`);
console.log(`🖼️  Tamaño: ${TRAINING_CONFIG.imageSize}x${TRAINING_CONFIG.imageSize}`);
console.log(`📚 Épocas: ${TRAINING_CONFIG.epochs}`);

/**
 * Obtiene lista de archivos de imagen
 */
async function getImageFiles(dirPath, maxFiles) {
  try {
    var files = await fs.readdir(dirPath);
    var imageFiles = files
      .filter(file => file.toLowerCase().endsWith('.jpg'))
      .slice(0, maxFiles)
      .map(file => path.join(dirPath, file));
    
    return imageFiles;
  } catch (err) {
    console.error(`Error leyendo directorio ${dirPath}: ${err.message}`);
    return [];
  }
}

/**
 * Procesa imágenes en lotes pequeños
 */
async function processImageBatch(imagePaths, label) {
  var images = [];
  var labels = [];
  
  console.log(`📦 Procesando lote de ${imagePaths.length} imágenes de ${label}s...`);
  
  for (var i = 0; i < imagePaths.length; i++) {
    try {
      var imagePath = imagePaths[i];
      
      // Procesar imagen con Sharp
      var buffer = await sharp(imagePath)
        .resize(TRAINING_CONFIG.imageSize, TRAINING_CONFIG.imageSize)
        .jpeg({ quality: 80 })
        .toBuffer();
      
      // Convertir a tensor y normalizar
      var imageTensor = tf.node.decodeImage(buffer, 3);
      imageTensor = imageTensor.div(255.0);
      
      images.push(imageTensor);
      labels.push(label === 'dog' ? [0, 1] : [1, 0]); // [cat, dog]
      
      if ((i + 1) % 50 === 0) {
        console.log(`   Procesadas ${i + 1}/${imagePaths.length}`);
      }
      
    } catch (err) {
      console.warn(`⚠️  Error procesando ${imagePaths[i]}: ${err.message}`);
    }
  }
  
  console.log(`✅ ${images.length} imágenes de ${label}s procesadas`);
  return { images, labels };
}

async function main() {
  try {
    console.log('\n1️⃣  Obteniendo archivos de imagen...');
    
    var catFiles = await getImageFiles(DATA_PATHS.cats, TRAINING_CONFIG.maxImagesPerClass);
    var dogFiles = await getImageFiles(DATA_PATHS.dogs, TRAINING_CONFIG.maxImagesPerClass);
    
    console.log(`   📁 Gatos: ${catFiles.length} archivos`);
    console.log(`   📁 Perros: ${dogFiles.length} archivos`);
    
    console.log('\n2️⃣  Inicializando modelo...');
    var classifier = new PetClassifier();
    await classifier.loadModel();
    
    console.log('\n3️⃣  Procesando imágenes...');
    var catData = await processImageBatch(catFiles, 'cat');
    var dogData = await processImageBatch(dogFiles, 'dog');
    
    console.log('\n4️⃣  Preparando dataset...');
    var allImages = catData.images.concat(dogData.images);
    var allLabels = catData.labels.concat(dogData.labels);
    
    var imagesTensor = tf.stack(allImages);
    var labelsTensor = tf.tensor2d(allLabels);
    
    // Limpiar arrays individuales
    allImages.forEach(img => img.dispose());
    
    console.log(`   📊 Dataset final: ${imagesTensor.shape[0]} imágenes`);
    
    console.log('\n5️⃣  Configurando entrenamiento...');
    classifier.model.compile({
      optimizer: tf.train.adam(TRAINING_CONFIG.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log('\n6️⃣  Entrenando modelo...');
    var history = await classifier.model.fit(imagesTensor, labelsTensor, {
      epochs: TRAINING_CONFIG.epochs,
      batchSize: TRAINING_CONFIG.batchSize,
      validationSplit: TRAINING_CONFIG.validationSplit,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`   Época ${epoch + 1}/${TRAINING_CONFIG.epochs}: Loss=${logs.loss.toFixed(4)}, Acc=${(logs.acc * 100).toFixed(1)}%`);
        }
      }
    });
    
    console.log('\n7️⃣  Guardando modelo...');
    await classifier.saveModel();
    
    console.log('\n8️⃣  Guardando métricas...');
    var finalLoss = history.history.loss[history.history.loss.length - 1];
    var finalAcc = history.history.acc[history.history.acc.length - 1];
    
    var metrics = {
      trainingConfig: TRAINING_CONFIG,
      finalLoss: finalLoss,
      finalAccuracy: finalAcc,
      trainedAt: new Date().toISOString(),
      modelVersion: '1.2.0',
      datasetType: 'real_images_simplified'
    };
    
    var metricsPath = path.join(classifier.modelPath, 'training_metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    
    // Limpiar memoria
    imagesTensor.dispose();
    labelsTensor.dispose();
    
    console.log('\n🎉 ¡Entrenamiento completado!');
    console.log(`   📈 Precisión final: ${(finalAcc * 100).toFixed(1)}%`);
    console.log(`   📉 Loss final: ${finalLoss.toFixed(4)}`);
    console.log(`   💾 Modelo guardado en: ${classifier.modelPath}`);
    
    if (finalAcc > 0.75) {
      console.log('✅ Resultado satisfactorio (>75% precisión)');
    } else {
      console.log('⚠️  Resultado moderado - considera más entrenamiento');
    }
    
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();