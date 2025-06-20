import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import metricsTracker from './metricsTracker.js';

/**
 * Sistema de Métricas Avanzadas para ML
 * Fase 5: Precision, Recall, F1-Score, Confusion Matrix, y Análisis de Errores
 */
class AdvancedMetrics {
  constructor() {
    this.metricsFile = path.join(process.cwd(), 'storage', 'metrics', 'advanced_metrics.json');
    this.confusionMatrixFile = path.join(process.cwd(), 'storage', 'metrics', 'confusion_matrix.json');
    this.errorAnalysisFile = path.join(process.cwd(), 'storage', 'metrics', 'error_analysis.json');
    this.ensureMetricsDirectory();
    this.loadAdvancedMetrics();
  }

  /**
   * Asegurar que existe el directorio de métricas
   */
  ensureMetricsDirectory() {
    var metricsDir = path.dirname(this.metricsFile);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
      logger.systemLog('ADVANCED_METRICS', 'Directorio de métricas avanzadas creado: ' + metricsDir);
    }
  }

  /**
   * Cargar métricas avanzadas existentes
   */
  loadAdvancedMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        var data = fs.readFileSync(this.metricsFile, 'utf8');
        this.metrics = JSON.parse(data);
      } else {
        this.metrics = this.createInitialMetrics();
        this.saveAdvancedMetrics();
      }
    } catch (error) {
      logger.error('Error cargando métricas avanzadas: ' + error.message);
      this.metrics = this.createInitialMetrics();
    }
  }

  /**
   * Crear estructura inicial de métricas
   */
  createInitialMetrics() {
    return {
      confusionMatrix: {
        truePositives: { cat: 0, dog: 0 },
        falsePositives: { cat: 0, dog: 0 },
        trueNegatives: { cat: 0, dog: 0 },
        falseNegatives: { cat: 0, dog: 0 }
      },
      classMetrics: {
        cat: {
          precision: 0,
          recall: 0,
          f1Score: 0,
          specificity: 0,
          accuracy: 0,
          support: 0
        },
        dog: {
          precision: 0,
          recall: 0,
          f1Score: 0,
          specificity: 0,
          accuracy: 0,
          support: 0
        }
      },
      overallMetrics: {
        macroAvgPrecision: 0,
        macroAvgRecall: 0,
        macroAvgF1Score: 0,
        weightedAvgPrecision: 0,
        weightedAvgRecall: 0,
        weightedAvgF1Score: 0,
        accuracy: 0,
        totalSamples: 0
      },
      errorAnalysis: {
        highConfidenceErrors: [],
        commonMisclassifications: {},
        errorPatterns: {}
      },
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Guardar métricas avanzadas
   */
  saveAdvancedMetrics() {
    try {
      var jsonData = JSON.stringify(this.metrics, null, 2);
      fs.writeFileSync(this.metricsFile, jsonData, 'utf8');
      logger.systemLog('ADVANCED_METRICS', 'Métricas avanzadas guardadas exitosamente');
    } catch (error) {
      logger.error('Error guardando métricas avanzadas: ' + error.message);
      throw new Error('No se pudieron guardar las métricas avanzadas');
    }
  }

  /**
   * Procesar nueva validación y actualizar métricas
   */
  processValidation(validationData) {
    try {
      var { userValidation, aiPrediction } = validationData;
      var predicted = aiPrediction.predictedClass;
      var actual = userValidation.isCorrect ? predicted : userValidation.correctedClass;
      var confidence = aiPrediction.confidence;

      // Actualizar matriz de confusión
      this.updateConfusionMatrix(predicted, actual);

      // Si es error de alta confianza, guardarlo para análisis
      if (!userValidation.isCorrect && confidence > 0.8) {
        this.recordHighConfidenceError(validationData);
      }

      // Actualizar patrones de error
      this.updateErrorPatterns(predicted, actual, confidence);

      // Recalcular todas las métricas
      this.calculateClassMetrics();
      this.calculateOverallMetrics();

      this.metrics.lastUpdated = new Date().toISOString();
      this.saveAdvancedMetrics();

      logger.systemLog('ADVANCED_METRICS', 
        `Métricas actualizadas - Predicted: ${predicted}, Actual: ${actual}, Correct: ${userValidation.isCorrect}`);

      return this.getMetricsSummary();

    } catch (error) {
      logger.error('Error procesando validación para métricas avanzadas: ' + error.message);
      throw error;
    }
  }

  /**
   * Actualizar matriz de confusión
   */
  updateConfusionMatrix(predicted, actual) {
    var classes = ['cat', 'dog'];
    
    // Para cada clase, determinar TP, FP, TN, FN
    for (var className of classes) {
      if (predicted === className && actual === className) {
        // True Positive
        this.metrics.confusionMatrix.truePositives[className]++;
      } else if (predicted === className && actual !== className) {
        // False Positive
        this.metrics.confusionMatrix.falsePositives[className]++;
      } else if (predicted !== className && actual !== className) {
        // True Negative
        this.metrics.confusionMatrix.trueNegatives[className]++;
      } else if (predicted !== className && actual === className) {
        // False Negative
        this.metrics.confusionMatrix.falseNegatives[className]++;
      }
    }
  }

  /**
   * Registrar error de alta confianza para análisis
   */
  recordHighConfidenceError(validationData) {
    var errorRecord = {
      timestamp: new Date().toISOString(),
      predicted: validationData.aiPrediction.predictedClass,
      actual: validationData.userValidation.correctedClass,
      confidence: validationData.aiPrediction.confidence,
      confidenceLevel: validationData.aiPrediction.confidenceLevel,
      imageId: validationData.imageId || 'unknown'
    };

    this.metrics.errorAnalysis.highConfidenceErrors.push(errorRecord);

    // Mantener solo los últimos 100 errores
    if (this.metrics.errorAnalysis.highConfidenceErrors.length > 100) {
      this.metrics.errorAnalysis.highConfidenceErrors = 
        this.metrics.errorAnalysis.highConfidenceErrors.slice(-100);
    }
  }

  /**
   * Actualizar patrones de error
   */
  updateErrorPatterns(predicted, actual, confidence) {
    if (predicted !== actual) {
      var errorKey = `${predicted}_as_${actual}`;
      
      if (!this.metrics.errorAnalysis.commonMisclassifications[errorKey]) {
        this.metrics.errorAnalysis.commonMisclassifications[errorKey] = {
          count: 0,
          totalConfidence: 0,
          averageConfidence: 0
        };
      }

      var errorPattern = this.metrics.errorAnalysis.commonMisclassifications[errorKey];
      errorPattern.count++;
      errorPattern.totalConfidence += confidence;
      errorPattern.averageConfidence = errorPattern.totalConfidence / errorPattern.count;
    }
  }

  /**
   * Calcular métricas por clase (Precision, Recall, F1-Score, etc.)
   */
  calculateClassMetrics() {
    var classes = ['cat', 'dog'];
    
    for (var className of classes) {
      var tp = this.metrics.confusionMatrix.truePositives[className];
      var fp = this.metrics.confusionMatrix.falsePositives[className];
      var tn = this.metrics.confusionMatrix.trueNegatives[className];
      var fn = this.metrics.confusionMatrix.falseNegatives[className];

      var classMetrics = this.metrics.classMetrics[className];

      // Precision = TP / (TP + FP)
      classMetrics.precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;

      // Recall (Sensitivity) = TP / (TP + FN)
      classMetrics.recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;

      // F1-Score = 2 * (Precision * Recall) / (Precision + Recall)
      classMetrics.f1Score = (classMetrics.precision + classMetrics.recall) > 0 
        ? 2 * (classMetrics.precision * classMetrics.recall) / (classMetrics.precision + classMetrics.recall)
        : 0;

      // Specificity = TN / (TN + FP)
      classMetrics.specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;

      // Accuracy for this class = (TP + TN) / (TP + TN + FP + FN)
      classMetrics.accuracy = (tp + tn + fp + fn) > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;

      // Support (number of actual instances)
      classMetrics.support = tp + fn;
    }
  }

  /**
   * Calcular métricas globales
   */
  calculateOverallMetrics() {
    var classes = ['cat', 'dog'];
    var totalSupport = 0;
    var weightedPrecision = 0;
    var weightedRecall = 0;
    var weightedF1Score = 0;

    // Calcular promedios macro y weighted
    var macroPrecision = 0;
    var macroRecall = 0;
    var macroF1Score = 0;

    for (var className of classes) {
      var classMetrics = this.metrics.classMetrics[className];
      var support = classMetrics.support;

      // Macro averages (simple average)
      macroPrecision += classMetrics.precision;
      macroRecall += classMetrics.recall;
      macroF1Score += classMetrics.f1Score;

      // Weighted averages (weighted by support)
      weightedPrecision += classMetrics.precision * support;
      weightedRecall += classMetrics.recall * support;
      weightedF1Score += classMetrics.f1Score * support;

      totalSupport += support;
    }

    // Finalizar promedios
    this.metrics.overallMetrics.macroAvgPrecision = macroPrecision / classes.length;
    this.metrics.overallMetrics.macroAvgRecall = macroRecall / classes.length;
    this.metrics.overallMetrics.macroAvgF1Score = macroF1Score / classes.length;

    if (totalSupport > 0) {
      this.metrics.overallMetrics.weightedAvgPrecision = weightedPrecision / totalSupport;
      this.metrics.overallMetrics.weightedAvgRecall = weightedRecall / totalSupport;
      this.metrics.overallMetrics.weightedAvgF1Score = weightedF1Score / totalSupport;
    }

    // Accuracy global
    var totalTP = 0;
    var totalSamples = 0;

    for (var className of classes) {
      totalTP += this.metrics.confusionMatrix.truePositives[className];
    }

    totalSamples = totalSupport;
    this.metrics.overallMetrics.accuracy = totalSamples > 0 ? totalTP / totalSamples : 0;
    this.metrics.overallMetrics.totalSamples = totalSamples;
  }

  /**
   * Obtener resumen de métricas avanzadas
   */
  getMetricsSummary() {
    return {
      classMetrics: this.formatClassMetrics(),
      overallMetrics: this.formatOverallMetrics(),
      confusionMatrix: this.formatConfusionMatrix(),
      errorAnalysis: this.getErrorAnalysisSummary(),
      lastUpdated: this.metrics.lastUpdated
    };
  }

  /**
   * Formatear métricas por clase para presentación
   */
  formatClassMetrics() {
    var formatted = {};
    
    for (var className of ['cat', 'dog']) {
      var classMetrics = this.metrics.classMetrics[className];
      formatted[className] = {
        precision: parseFloat(classMetrics.precision.toFixed(4)),
        recall: parseFloat(classMetrics.recall.toFixed(4)),
        f1Score: parseFloat(classMetrics.f1Score.toFixed(4)),
        specificity: parseFloat(classMetrics.specificity.toFixed(4)),
        accuracy: parseFloat(classMetrics.accuracy.toFixed(4)),
        support: classMetrics.support
      };
    }
    
    return formatted;
  }

  /**
   * Formatear métricas globales para presentación
   */
  formatOverallMetrics() {
    var overall = this.metrics.overallMetrics;
    
    return {
      accuracy: parseFloat(overall.accuracy.toFixed(4)),
      macroAvg: {
        precision: parseFloat(overall.macroAvgPrecision.toFixed(4)),
        recall: parseFloat(overall.macroAvgRecall.toFixed(4)),
        f1Score: parseFloat(overall.macroAvgF1Score.toFixed(4))
      },
      weightedAvg: {
        precision: parseFloat(overall.weightedAvgPrecision.toFixed(4)),
        recall: parseFloat(overall.weightedAvgRecall.toFixed(4)),
        f1Score: parseFloat(overall.weightedAvgF1Score.toFixed(4))
      },
      totalSamples: overall.totalSamples
    };
  }

  /**
   * Formatear matriz de confusión para presentación
   */
  formatConfusionMatrix() {
    var cm = this.metrics.confusionMatrix;
    
    return {
      matrix: {
        cat: {
          cat: cm.truePositives.cat,
          dog: cm.falseNegatives.cat
        },
        dog: {
          cat: cm.falsePositives.cat,
          dog: cm.truePositives.dog
        }
      },
      raw: {
        truePositives: cm.truePositives,
        falsePositives: cm.falsePositives,
        trueNegatives: cm.trueNegatives,
        falseNegatives: cm.falseNegatives
      }
    };
  }

  /**
   * Obtener resumen de análisis de errores
   */
  getErrorAnalysisSummary() {
    var analysis = this.metrics.errorAnalysis;
    
    // Top 5 errores más comunes
    var topMisclassifications = Object.entries(analysis.commonMisclassifications)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, data]) => ({
        type: key,
        count: data.count,
        averageConfidence: parseFloat(data.averageConfidence.toFixed(4))
      }));

    return {
      highConfidenceErrorsCount: analysis.highConfidenceErrors.length,
      recentHighConfidenceErrors: analysis.highConfidenceErrors.slice(-5),
      topMisclassifications: topMisclassifications,
      totalErrorTypes: Object.keys(analysis.commonMisclassifications).length
    };
  }

  /**
   * Generar reporte detallado de métricas
   */
  generateDetailedReport() {
    try {
      var summary = this.getMetricsSummary();
      var basicMetrics = metricsTracker.getMetricsSummary();

      var report = {
        title: 'Reporte Detallado de Métricas ML',
        generatedAt: new Date().toISOString(),
        
        // Métricas básicas vs avanzadas
        comparison: {
          basicAccuracy: basicMetrics.general.accuracyRate / 100,
          advancedAccuracy: summary.overallMetrics.accuracy,
          difference: summary.overallMetrics.accuracy - (basicMetrics.general.accuracyRate / 100)
        },

        // Métricas por clase
        classPerformance: summary.classMetrics,

        // Métricas globales
        overallPerformance: summary.overallMetrics,

        // Matriz de confusión
        confusionMatrix: summary.confusionMatrix,

        // Análisis de errores
        errorAnalysis: summary.errorAnalysis,

        // Recomendaciones
        recommendations: this.generateRecommendations(summary)
      };

      return report;

    } catch (error) {
      logger.error('Error generando reporte detallado: ' + error.message);
      throw error;
    }
  }

  /**
   * Generar recomendaciones basadas en métricas
   */
  generateRecommendations(summary) {
    var recommendations = [];

    // Analizar precision vs recall por clase
    for (var className of ['cat', 'dog']) {
      var classMetrics = summary.classMetrics[className];
      
      if (classMetrics.precision < 0.8) {
        recommendations.push({
          type: 'precision',
          class: className,
          message: `Baja precision para ${className} (${(classMetrics.precision * 100).toFixed(1)}%). Considerar más datos de entrenamiento o ajustar umbral de confianza.`
        });
      }

      if (classMetrics.recall < 0.8) {
        recommendations.push({
          type: 'recall',
          class: className,
          message: `Bajo recall para ${className} (${(classMetrics.recall * 100).toFixed(1)}%). El modelo está perdiendo muchos casos reales de esta clase.`
        });
      }

      if (classMetrics.support < 20) {
        recommendations.push({
          type: 'data',
          class: className,
          message: `Pocos datos de validación para ${className} (${classMetrics.support} muestras). Necesita más validaciones de usuarios.`
        });
      }
    }

    // Analizar errores comunes
    if (summary.errorAnalysis.topMisclassifications.length > 0) {
      var topError = summary.errorAnalysis.topMisclassifications[0];
      recommendations.push({
        type: 'error_pattern',
        message: `Error más común: ${topError.type} (${topError.count} veces, ${(topError.averageConfidence * 100).toFixed(1)}% confianza promedio). Revisar características específicas.`
      });
    }

    // Analizar balance de clases
    var catSupport = summary.classMetrics.cat.support;
    var dogSupport = summary.classMetrics.dog.support;
    
    if (catSupport > 0 && dogSupport > 0) {
      var ratio = Math.max(catSupport, dogSupport) / Math.min(catSupport, dogSupport);
      if (ratio > 2) {
        recommendations.push({
          type: 'class_imbalance',
          message: `Dataset desbalanceado: ratio ${ratio.toFixed(1)}:1. Considerar técnicas de balancing o ajustar métricas.`
        });
      }
    }

    return recommendations;
  }

  /**
   * Resetear métricas avanzadas
   */
  resetMetrics() {
    try {
      this.metrics = this.createInitialMetrics();
      this.saveAdvancedMetrics();
      logger.systemLog('ADVANCED_METRICS', 'Métricas avanzadas reseteadas');
      return this.metrics;
    } catch (error) {
      logger.error('Error reseteando métricas avanzadas: ' + error.message);
      throw error;
    }
  }

  /**
   * Obtener matriz de confusión en formato visualizable
   */
  getConfusionMatrixForVisualization() {
    var cm = this.metrics.confusionMatrix;
    
    // Formato estándar para matriz de confusión
    return {
      labels: ['cat', 'dog'],
      matrix: [
        [cm.truePositives.cat, cm.falseNegatives.cat],     // Actual cat
        [cm.falsePositives.cat, cm.truePositives.dog]      // Actual dog
      ],
      totals: {
        predicted: {
          cat: cm.truePositives.cat + cm.falsePositives.cat,
          dog: cm.truePositives.dog + cm.falsePositives.dog
        },
        actual: {
          cat: cm.truePositives.cat + cm.falseNegatives.cat,
          dog: cm.truePositives.dog + cm.falseNegatives.dog
        }
      }
    };
  }
}

// Exportar instancia singleton
export default new AdvancedMetrics();