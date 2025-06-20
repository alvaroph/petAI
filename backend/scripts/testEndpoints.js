#!/usr/bin/env node

/**
 * Script de testing para endpoints del backend PetAI
 * Prueba todas las rutas de la API y verifica su funcionamiento
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

// Configuración
var BASE_URL = 'http://localhost:3002';
var TIMEOUT = 30000; // 30 segundos para operaciones ML

// Colores para output
var colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Helpers
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

// Crear imagen de prueba fake
async function createTestImage() {
  var testImagePath = path.join(__dirname, 'test-image.jpg');
  
  // Crear un "fake" JPEG header básico para testing
  var fakeJpegData = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
    0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xD2, 0xFF, 0xD9
  ]);
  
  await fs.writeFile(testImagePath, fakeJpegData);
  return testImagePath;
}

// Tests individuales
async function testHealthEndpoint() {
  info('Testing health endpoint...');
  
  try {
    var response = await fetch(`${BASE_URL}/api/health`);
    var data = await response.json();
    
    if (response.ok && data.status === 'ok') {
      success('Health endpoint working');
      return true;
    } else {
      error(`Health endpoint failed: ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`Health endpoint error: ${err.message}`);
    return false;
  }
}

async function testModelInfoEndpoint() {
  info('Testing model info endpoint...');
  
  try {
    var response = await fetch(`${BASE_URL}/api/images/model/info`);
    var data = await response.json();
    
    if (response.ok && data.success) {
      success('Model info endpoint working');
      info(`Model status: ${data.data.status}`);
      info(`Total params: ${data.data.totalParams}`);
      info(`Layers: ${data.data.layers}`);
      return true;
    } else {
      error(`Model info failed: ${response.status} - ${data.message || 'Unknown error'}`);
      return false;
    }
  } catch (err) {
    error(`Model info error: ${err.message}`);
    return false;
  }
}

async function testPredictEndpoint() {
  info('Testing predict endpoint...');
  
  try {
    // Crear imagen de prueba
    var testImagePath = await createTestImage();
    var imageBuffer = await fs.readFile(testImagePath);
    
    // Crear FormData para el request
    var formData = new FormData();
    var blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'test-pet.jpg');
    
    var response = await fetch(`${BASE_URL}/api/images/predict`, {
      method: 'POST',
      body: formData,
      timeout: TIMEOUT
    });
    
    var data = await response.json();
    
    if (response.ok && data.success) {
      success('Predict endpoint working');
      info(`Predicted class: ${data.data.prediction.predictedClass}`);
      info(`Confidence: ${(data.data.prediction.confidence * 100).toFixed(1)}%`);
      info(`Confidence level: ${data.data.prediction.confidenceLevel}`);
      info(`Is pet: ${data.data.prediction.isPet}`);
      
      // Limpiar archivo de prueba
      await fs.unlink(testImagePath);
      return true;
    } else {
      error(`Predict failed: ${response.status} - ${data.message || 'Unknown error'}`);
      
      // Limpiar archivo de prueba
      await fs.unlink(testImagePath);
      return false;
    }
  } catch (err) {
    error(`Predict error: ${err.message}`);
    return false;
  }
}

async function testUploadEndpoint() {
  info('Testing upload endpoint...');
  
  try {
    // Crear imagen de prueba
    var testImagePath = await createTestImage();
    var imageBuffer = await fs.readFile(testImagePath);
    
    // Crear FormData para el request
    var formData = new FormData();
    var blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'test-upload.jpg');
    
    var response = await fetch(`${BASE_URL}/api/images/upload`, {
      method: 'POST',
      body: formData
    });
    
    var data = await response.json();
    
    if (response.ok && data.success) {
      success('Upload endpoint working');
      info(`Image ID: ${data.data.imageId}`);
      info(`Status: ${data.data.status}`);
      
      // Limpiar archivo de prueba
      await fs.unlink(testImagePath);
      return true;
    } else {
      error(`Upload failed: ${response.status} - ${data.message || 'Unknown error'}`);
      
      // Limpiar archivo de prueba
      await fs.unlink(testImagePath);
      return false;
    }
  } catch (err) {
    error(`Upload error: ${err.message}`);
    return false;
  }
}

async function testStatsEndpoint() {
  info('Testing stats endpoint...');
  
  try {
    var response = await fetch(`${BASE_URL}/api/images/stats/summary`);
    var data = await response.json();
    
    if (response.ok && data.success) {
      success('Stats endpoint working');
      info(`ML Model Status: ${data.data.mlModelStatus}`);
      return true;
    } else {
      error(`Stats failed: ${response.status} - ${data.message || 'Unknown error'}`);
      return false;
    }
  } catch (err) {
    error(`Stats error: ${err.message}`);
    return false;
  }
}

async function testInvalidEndpoint() {
  info('Testing 404 handling...');
  
  try {
    var response = await fetch(`${BASE_URL}/api/nonexistent`);
    
    if (response.status === 404) {
      success('404 handling working correctly');
      return true;
    } else {
      warning(`Expected 404, got ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`404 test error: ${err.message}`);
    return false;
  }
}

// Función principal de testing
async function runAllTests() {
  console.log(`${colors.bold}${colors.blue}🧪 PetAI Backend Testing Suite${colors.reset}\n`);
  
  var tests = [
    { name: 'Health Check', func: testHealthEndpoint },
    { name: 'Model Info', func: testModelInfoEndpoint },
    { name: 'Image Upload', func: testUploadEndpoint },
    { name: 'ML Prediction', func: testPredictEndpoint },
    { name: 'Stats Summary', func: testStatsEndpoint },
    { name: '404 Handling', func: testInvalidEndpoint }
  ];
  
  var results = [];
  var passed = 0;
  var failed = 0;
  
  for (var test of tests) {
    console.log(`\n${colors.bold}--- ${test.name} ---${colors.reset}`);
    
    try {
      var result = await test.func();
      results.push({ name: test.name, passed: result });
      
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      error(`Test ${test.name} crashed: ${err.message}`);
      results.push({ name: test.name, passed: false });
      failed++;
    }
    
    // Pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Resumen final
  console.log(`\n${colors.bold}📊 Test Results Summary${colors.reset}`);
  console.log(`${colors.bold}${'='.repeat(40)}${colors.reset}`);
  
  results.forEach(result => {
    var status = result.passed ? 
      `${colors.green}✅ PASS${colors.reset}` : 
      `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`${result.name.padEnd(20)} ${status}`);
  });
  
  console.log(`${colors.bold}${'='.repeat(40)}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`${colors.blue}Total:  ${results.length}${colors.reset}`);
  
  if (failed === 0) {
    console.log(`\n${colors.bold}${colors.green}🎉 All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bold}${colors.red}💥 ${failed} test(s) failed${colors.reset}`);
    process.exit(1);
  }
}

// Verificar que el servidor esté corriendo
async function checkServerRunning() {
  try {
    var response = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 });
    return response.ok;
  } catch (err) {
    return false;
  }
}

// Ejecutar tests
async function main() {
  info('Checking if server is running...');
  
  var serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    error('❌ Server is not running on ' + BASE_URL);
    error('Please start the backend server first:');
    console.log(`   cd backend && npm start`);
    process.exit(1);
  }
  
  success('Server is running, starting tests...');
  await runAllTests();
}

// Manejar errores no capturados
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
  error(`Main error: ${err.message}`);
  process.exit(1);
});