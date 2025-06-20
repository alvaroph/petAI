import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from '../utils/logger.js';

/**
 * Clasificador de Mascotas usando TensorFlow.js
 * Modelo educativo para identificación de perros y gatos
 */
class PetClassifier {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.modelPath = path.join(process.cwd(), 'storage', 'models', 'pet_model');
        this.imageSize = 224; // Tamaño estándar para modelos de visión
        this.classes = ['cat', 'dog'];
    }

    /**
     * Carga el modelo desde disco o crea uno básico si no existe
     */
    async loadModel() {
        try {
            // Intentar cargar modelo existente
            if (await this.modelExists()) {
                logger.mlLog('info', 'Cargando modelo existente desde disco');
                this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
                this.isLoaded = true;
                logger.mlLog('info', 'Modelo cargado exitosamente');
            } else {
                // Crear modelo básico para clasificación de mascotas
                logger.mlLog('info', 'Creando modelo básico para clasificación de mascotas');
                await this.createBasicModel();
            }
        } catch (error) {
            logger.mlLog('error', 'Error cargando modelo', { error: error.message });
            // Crear modelo básico como fallback
            await this.createBasicModel();
        }
    }

    /**
     * Verifica si existe un modelo guardado
     */
    async modelExists() {
        try {
            await fs.access(path.join(this.modelPath, 'model.json'));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Crea un modelo básico CNN para clasificación binaria
     * Arquitectura simple pero efectiva para fines educativos
     */
    async createBasicModel() {
        logger.mlLog('info', 'Construyendo arquitectura de red neuronal convolucional');
        
        this.model = tf.sequential({
            layers: [
                // Primera capa convolucional
                tf.layers.conv2d({
                    inputShape: [this.imageSize, this.imageSize, 3],
                    filters: 32,
                    kernelSize: 3,
                    activation: 'relu',
                    name: 'conv1'
                }),
                tf.layers.maxPooling2d({ poolSize: 2, name: 'pool1' }),
                
                // Segunda capa convolucional
                tf.layers.conv2d({
                    filters: 64,
                    kernelSize: 3,
                    activation: 'relu',
                    name: 'conv2'
                }),
                tf.layers.maxPooling2d({ poolSize: 2, name: 'pool2' }),
                
                // Tercera capa convolucional
                tf.layers.conv2d({
                    filters: 128,
                    kernelSize: 3,
                    activation: 'relu',
                    name: 'conv3'
                }),
                tf.layers.maxPooling2d({ poolSize: 2, name: 'pool3' }),
                
                // Aplanar para capas densas
                tf.layers.flatten({ name: 'flatten' }),
                
                // Capa densa con dropout para evitar overfitting
                tf.layers.dense({
                    units: 128,
                    activation: 'relu',
                    name: 'dense1'
                }),
                tf.layers.dropout({ rate: 0.5, name: 'dropout1' }),
                
                // Capa de salida para clasificación binaria
                tf.layers.dense({
                    units: 2,
                    activation: 'softmax',
                    name: 'output'
                })
            ]
        });

        // Compilar modelo con optimizador Adam
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        this.isLoaded = true;
        logger.mlLog('info', 'Modelo básico creado y compilado', {
            totalParams: this.model.countParams(),
            layers: this.model.layers.length
        });

        // Guardar modelo básico
        await this.saveModel();
    }

    /**
     * Preprocesa una imagen para el modelo
     */
    async preprocessImage(imagePath) {
        try {
            // Usar Sharp para redimensionar y normalizar
            const imageBuffer = await sharp(imagePath)
                .resize(this.imageSize, this.imageSize)
                .removeAlpha()
                .toFormat('jpeg')
                .toBuffer();

            // Convertir a tensor de TensorFlow
            const tensor = tf.node.decodeImage(imageBuffer, 3);
            
            // Normalizar valores de píxeles (0-255 → 0-1)
            const normalized = tensor.div(255.0);
            
            // Expandir dimensiones para batch
            const batched = normalized.expandDims(0);
            
            // Limpiar memoria
            tensor.dispose();
            normalized.dispose();

            return batched;
        } catch (error) {
            logger.mlLog('error', 'Error preprocesando imagen', { 
                imagePath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Realiza predicción sobre una imagen
     */
    async predict(imagePath) {
        if (!this.isLoaded) {
            throw new Error('Modelo no cargado. Ejecutar loadModel() primero.');
        }

        try {
            logger.mlLog('info', 'Iniciando predicción', { imagePath });
            
            // Preprocesar imagen
            const preprocessedImage = await this.preprocessImage(imagePath);
            
            // Ejecutar predicción
            const prediction = this.model.predict(preprocessedImage);
            
            // Extraer probabilidades
            const probabilities = await prediction.data();
            
            // Limpiar memoria
            preprocessedImage.dispose();
            prediction.dispose();

            // Formatear resultado
            const result = {
                predictions: [
                    {
                        className: this.classes[0],
                        probability: probabilities[0]
                    },
                    {
                        className: this.classes[1], 
                        probability: probabilities[1]
                    }
                ],
                predictedClass: probabilities[1] > probabilities[0] ? this.classes[1] : this.classes[0],
                confidence: Math.max(...probabilities),
                timestamp: new Date().toISOString()
            };

            logger.mlLog('info', 'Predicción completada', {
                imagePath,
                predictedClass: result.predictedClass,
                confidence: result.confidence.toFixed(4)
            });

            return result;

        } catch (error) {
            logger.mlLog('error', 'Error en predicción', {
                imagePath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Guarda el modelo en disco
     */
    async saveModel() {
        try {
            // Crear directorio si no existe
            await fs.mkdir(this.modelPath, { recursive: true });
            
            // Guardar modelo
            await this.model.save(`file://${this.modelPath}`);
            
            logger.mlLog('info', 'Modelo guardado exitosamente', { 
                path: this.modelPath 
            });
        } catch (error) {
            logger.mlLog('error', 'Error guardando modelo', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Obtiene información del modelo actual
     */
    getModelInfo() {
        if (!this.isLoaded) {
            return { error: 'Modelo no cargado' };
        }

        return {
            isLoaded: this.isLoaded,
            totalParams: this.model.countParams(),
            layers: this.model.layers.length,
            inputShape: [this.imageSize, this.imageSize, 3],
            outputClasses: this.classes,
            modelPath: this.modelPath
        };
    }

    /**
     * Libera recursos del modelo
     */
    dispose() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
            this.isLoaded = false;
            logger.mlLog('info', 'Recursos del modelo liberados');
        }
    }
}

export default PetClassifier;