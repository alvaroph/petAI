import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Script para preparar dataset de reentrenamiento con imágenes validadas por usuarios
 * Fase 4 -> Fase 5: Preparación para MLOps
 */

class ValidatedDatasetPreparator {
  constructor() {
    this.storageDir = path.join(process.cwd(), 'storage', 'images');
    this.validatedDir = path.join(this.storageDir, 'validated');
    this.correctionsDir = path.join(this.storageDir, 'training_corrections');
    this.trainingDir = path.join(this.storageDir, 'training');
    this.retrainingDatasetDir = path.join(this.storageDir, 'retraining_dataset');
  }

  /**
   * Contar imágenes validadas disponibles
   */
  countValidatedImages() {
    var counts = {
      validated: { dog: 0, cat: 0 },
      corrections: { dog: 0, cat: 0 },
      total: 0
    };

    try {
      // Contar en directorio validado (predicciones correctas)
      var validatedDogDir = path.join(this.validatedDir, 'dog');
      var validatedCatDir = path.join(this.validatedDir, 'cat');
      
      if (fs.existsSync(validatedDogDir)) {
        counts.validated.dog = fs.readdirSync(validatedDogDir)
          .filter(f => f.endsWith('.jpg')).length;
      }
      
      if (fs.existsSync(validatedCatDir)) {
        counts.validated.cat = fs.readdirSync(validatedCatDir)
          .filter(f => f.endsWith('.jpg')).length;
      }

      // Contar en directorio de correcciones (predicciones incorrectas)
      var correctionsDogDir = path.join(this.correctionsDir, 'dog');
      var correctionsCatDir = path.join(this.correctionsDir, 'cat');
      
      if (fs.existsSync(correctionsDogDir)) {
        counts.corrections.dog = fs.readdirSync(correctionsDogDir)
          .filter(f => f.endsWith('.jpg')).length;
      }
      
      if (fs.existsSync(correctionsCatDir)) {
        counts.corrections.cat = fs.readdirSync(correctionsCatDir)
          .filter(f => f.endsWith('.jpg')).length;
      }

      counts.total = counts.validated.dog + counts.validated.cat + 
                    counts.corrections.dog + counts.corrections.cat;

      return counts;

    } catch (error) {
      logger.error('Error contando imágenes validadas: ' + error.message);
      throw error;
    }
  }

  /**
   * Preparar dataset combinado para reentrenamiento
   */
  async prepareRetrainingDataset(options = {}) {
    var {
      includeOriginalTraining = true,
      minValidatedPerClass = 10,
      maxImagesPerClass = 500
    } = options;

    try {
      logger.systemLog('DATASET', 'Iniciando preparación de dataset de reentrenamiento...');

      var counts = this.countValidatedImages();
      
      // Verificar que hay suficientes imágenes validadas
      var totalValidatedDogs = counts.validated.dog + counts.corrections.dog;
      var totalValidatedCats = counts.validated.cat + counts.corrections.cat;
      
      if (totalValidatedDogs < minValidatedPerClass || totalValidatedCats < minValidatedPerClass) {
        throw new Error(`Insuficientes imágenes validadas. Mínimo ${minValidatedPerClass} por clase. ` +
          `Disponibles: ${totalValidatedDogs} perros, ${totalValidatedCats} gatos`);
      }

      // Crear directorio de reentrenamiento
      if (fs.existsSync(this.retrainingDatasetDir)) {
        fs.rmSync(this.retrainingDatasetDir, { recursive: true });
      }
      fs.mkdirSync(this.retrainingDatasetDir, { recursive: true });
      fs.mkdirSync(path.join(this.retrainingDatasetDir, 'dog'), { recursive: true });
      fs.mkdirSync(path.join(this.retrainingDatasetDir, 'cat'), { recursive: true });

      var datasetInfo = {
        created: new Date().toISOString(),
        includeOriginalTraining: includeOriginalTraining,
        minValidatedPerClass: minValidatedPerClass,
        maxImagesPerClass: maxImagesPerClass,
        sources: {
          originalTraining: { dog: 0, cat: 0 },
          userValidated: { dog: 0, cat: 0 },
          userCorrected: { dog: 0, cat: 0 }
        },
        totalImages: { dog: 0, cat: 0 }
      };

      // Copiar imágenes del training original si se especifica
      if (includeOriginalTraining) {
        await this.copyOriginalTrainingImages(datasetInfo, maxImagesPerClass);
      }

      // Copiar imágenes validadas por usuarios
      await this.copyValidatedImages(datasetInfo, maxImagesPerClass);

      // Guardar información del dataset
      var datasetInfoPath = path.join(this.retrainingDatasetDir, 'dataset_info.json');
      fs.writeFileSync(datasetInfoPath, JSON.stringify(datasetInfo, null, 2));

      logger.systemLog('DATASET', `Dataset de reentrenamiento preparado - Dogs: ${datasetInfo.totalImages.dog}, Cats: ${datasetInfo.totalImages.cat}`);

      return {
        success: true,
        datasetPath: this.retrainingDatasetDir,
        datasetInfo: datasetInfo,
        summary: {
          totalImages: datasetInfo.totalImages.dog + datasetInfo.totalImages.cat,
          dogImages: datasetInfo.totalImages.dog,
          catImages: datasetInfo.totalImages.cat,
          balanceRatio: (datasetInfo.totalImages.dog / datasetInfo.totalImages.cat).toFixed(2)
        }
      };

    } catch (error) {
      logger.error('Error preparando dataset de reentrenamiento: ' + error.message);
      throw error;
    }
  }

  /**
   * Copiar imágenes del training original
   */
  async copyOriginalTrainingImages(datasetInfo, maxImagesPerClass) {
    var originalTrainingDir = path.join(this.trainingDir);
    
    if (!fs.existsSync(originalTrainingDir)) {
      logger.systemLog('DATASET', 'No se encontró directorio de training original, saltando...');
      return;
    }

    var classes = ['dog', 'cat'];
    
    for (var className of classes) {
      var sourceDir = path.join(originalTrainingDir, className);
      var targetDir = path.join(this.retrainingDatasetDir, className);
      
      if (fs.existsSync(sourceDir)) {
        var files = fs.readdirSync(sourceDir)
          .filter(f => f.endsWith('.jpg'))
          .slice(0, Math.floor(maxImagesPerClass * 0.7)); // 70% del máximo para training original
        
        for (var file of files) {
          var sourcePath = path.join(sourceDir, file);
          var targetPath = path.join(targetDir, `original_${file}`);
          fs.copyFileSync(sourcePath, targetPath);
        }
        
        datasetInfo.sources.originalTraining[className] = files.length;
        datasetInfo.totalImages[className] += files.length;
        
        logger.systemLog('DATASET', `Copiadas ${files.length} imágenes originales de ${className}`);
      }
    }
  }

  /**
   * Copiar imágenes validadas por usuarios
   */
  async copyValidatedImages(datasetInfo, maxImagesPerClass) {
    var classes = ['dog', 'cat'];
    
    for (var className of classes) {
      var currentCount = datasetInfo.totalImages[className];
      var remainingSlots = maxImagesPerClass - currentCount;
      
      if (remainingSlots <= 0) continue;
      
      // Copiar de validados (predicciones correctas)
      var validatedSourceDir = path.join(this.validatedDir, className);
      if (fs.existsSync(validatedSourceDir)) {
        var validatedFiles = fs.readdirSync(validatedSourceDir)
          .filter(f => f.endsWith('.jpg'))
          .slice(0, Math.floor(remainingSlots * 0.5));
        
        for (var file of validatedFiles) {
          var sourcePath = path.join(validatedSourceDir, file);
          var targetPath = path.join(this.retrainingDatasetDir, className, `validated_${file}`);
          fs.copyFileSync(sourcePath, targetPath);
        }
        
        datasetInfo.sources.userValidated[className] = validatedFiles.length;
        datasetInfo.totalImages[className] += validatedFiles.length;
        remainingSlots -= validatedFiles.length;
        
        logger.systemLog('DATASET', `Copiadas ${validatedFiles.length} imágenes validadas de ${className}`);
      }
      
      // Copiar de correcciones (predicciones incorrectas pero etiquetadas correctamente)
      if (remainingSlots > 0) {
        var correctionsSourceDir = path.join(this.correctionsDir, className);
        if (fs.existsSync(correctionsSourceDir)) {
          var correctionFiles = fs.readdirSync(correctionsSourceDir)
            .filter(f => f.endsWith('.jpg'))
            .slice(0, remainingSlots);
          
          for (var file of correctionFiles) {
            var sourcePath = path.join(correctionsSourceDir, file);
            var targetPath = path.join(this.retrainingDatasetDir, className, `corrected_${file}`);
            fs.copyFileSync(sourcePath, targetPath);
          }
          
          datasetInfo.sources.userCorrected[className] = correctionFiles.length;
          datasetInfo.totalImages[className] += correctionFiles.length;
          
          logger.systemLog('DATASET', `Copiadas ${correctionFiles.length} imágenes corregidas de ${className}`);
        }
      }
    }
  }

  /**
   * Generar reporte del dataset preparado
   */
  generateDatasetReport() {
    try {
      var datasetInfoPath = path.join(this.retrainingDatasetDir, 'dataset_info.json');
      
      if (!fs.existsSync(datasetInfoPath)) {
        throw new Error('No se encontró información del dataset preparado');
      }
      
      var datasetInfo = JSON.parse(fs.readFileSync(datasetInfoPath, 'utf8'));
      
      var report = {
        title: 'Reporte de Dataset de Reentrenamiento',
        created: datasetInfo.created,
        summary: {
          totalImages: datasetInfo.totalImages.dog + datasetInfo.totalImages.cat,
          classes: {
            dog: datasetInfo.totalImages.dog,
            cat: datasetInfo.totalImages.cat
          },
          balance: {
            ratio: (datasetInfo.totalImages.dog / datasetInfo.totalImages.cat).toFixed(2),
            status: Math.abs(datasetInfo.totalImages.dog - datasetInfo.totalImages.cat) < 50 ? 'Balanceado' : 'Desbalanceado'
          }
        },
        sources: datasetInfo.sources,
        recommendations: []
      };
      
      // Generar recomendaciones
      if (report.summary.totalImages < 200) {
        report.recommendations.push('Dataset pequeño: Considerar data augmentation durante entrenamiento');
      }
      
      if (report.balance.status === 'Desbalanceado') {
        report.recommendations.push('Dataset desbalanceado: Aplicar class weights durante entrenamiento');
      }
      
      if (datasetInfo.sources.userValidated.dog + datasetInfo.sources.userValidated.cat > 50) {
        report.recommendations.push('Buen volumen de validaciones de usuario: Esperado aumento en accuracy');
      }
      
      return report;
      
    } catch (error) {
      logger.error('Error generando reporte del dataset: ' + error.message);
      throw error;
    }
  }
}

// Función principal para usar desde línea de comandos
async function main() {
  try {
    var preparator = new ValidatedDatasetPreparator();
    
    // Contar imágenes disponibles
    var counts = preparator.countValidatedImages();
    console.log('Imágenes validadas disponibles:', counts);
    
    if (counts.total < 20) {
      console.log('⚠️  Pocas imágenes validadas disponibles. Se recomienda al menos 20 para reentrenamiento.');
      return;
    }
    
    // Preparar dataset
    var result = await preparator.prepareRetrainingDataset({
      includeOriginalTraining: true,
      minValidatedPerClass: 5,
      maxImagesPerClass: 300
    });
    
    console.log('✅ Dataset preparado exitosamente:', result.summary);
    
    // Generar reporte
    var report = preparator.generateDatasetReport();
    console.log('\n📊 Reporte del Dataset:');
    console.log(JSON.stringify(report, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ValidatedDatasetPreparator;