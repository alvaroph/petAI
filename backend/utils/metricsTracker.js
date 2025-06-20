import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Sistema de tracking de métricas de validación de usuario
 * Fase 4: Validación por usuario
 */
class MetricsTracker {
  constructor() {
    this.metricsFile = path.join(process.cwd(), 'storage', 'metrics', 'validation_metrics.json');
    this.ensureMetricsDirectory();
  }

  /**
   * Asegurar que existe el directorio de métricas
   */
  ensureMetricsDirectory() {
    var metricsDir = path.dirname(this.metricsFile);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
      logger.systemLog('METRICS', 'Directorio de métricas creado: ' + metricsDir);
    }
  }

  /**
   * Cargar métricas existentes o crear archivo inicial
   */
  loadMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        var data = fs.readFileSync(this.metricsFile, 'utf8');
        return JSON.parse(data);
      } else {
        // Crear archivo inicial con estructura base
        var initialMetrics = {
          totalValidations: 0,
          correctPredictions: 0,
          incorrectPredictions: 0,
          accuracyRate: 0,
          classMetrics: {
            dog: {
              totalPredictions: 0,
              correctPredictions: 0,
              incorrectPredictions: 0,
              accuracy: 0
            },
            cat: {
              totalPredictions: 0,
              correctPredictions: 0,
              incorrectPredictions: 0,
              accuracy: 0
            }
          },
          confidenceLevelMetrics: {
            alta: { total: 0, correct: 0, accuracy: 0 },
            media: { total: 0, correct: 0, accuracy: 0 },
            baja: { total: 0, correct: 0, accuracy: 0 }
          },
          dailyStats: {},
          lastUpdated: new Date().toISOString(),
          version: '1.0.0'
        };
        
        this.saveMetrics(initialMetrics);
        return initialMetrics;
      }
    } catch (error) {
      logger.error('Error cargando métricas: ' + error.message);
      throw new Error('No se pudieron cargar las métricas');
    }
  }

  /**
   * Guardar métricas en archivo
   */
  saveMetrics(metrics) {
    try {
      var jsonData = JSON.stringify(metrics, null, 2);
      fs.writeFileSync(this.metricsFile, jsonData, 'utf8');
      logger.systemLog('METRICS', 'Métricas guardadas exitosamente');
    } catch (error) {
      logger.error('Error guardando métricas: ' + error.message);
      throw new Error('No se pudieron guardar las métricas');
    }
  }

  /**
   * Actualizar métricas con nueva validación
   */
  updateMetrics(validationData) {
    try {
      var metrics = this.loadMetrics();
      var { userValidation, aiPrediction } = validationData;
      
      var isCorrect = userValidation.isCorrect;
      var predictedClass = aiPrediction.predictedClass;
      var confidenceLevel = aiPrediction.confidenceLevel;
      var today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Actualizar totales generales
      metrics.totalValidations++;
      if (isCorrect) {
        metrics.correctPredictions++;
      } else {
        metrics.incorrectPredictions++;
      }
      metrics.accuracyRate = (metrics.correctPredictions / metrics.totalValidations) * 100;

      // Actualizar métricas por clase
      if (metrics.classMetrics[predictedClass]) {
        metrics.classMetrics[predictedClass].totalPredictions++;
        if (isCorrect) {
          metrics.classMetrics[predictedClass].correctPredictions++;
        } else {
          metrics.classMetrics[predictedClass].incorrectPredictions++;
        }
        
        var classTotal = metrics.classMetrics[predictedClass].totalPredictions;
        var classCorrect = metrics.classMetrics[predictedClass].correctPredictions;
        metrics.classMetrics[predictedClass].accuracy = (classCorrect / classTotal) * 100;
      }

      // Actualizar métricas por nivel de confianza
      if (metrics.confidenceLevelMetrics[confidenceLevel]) {
        metrics.confidenceLevelMetrics[confidenceLevel].total++;
        if (isCorrect) {
          metrics.confidenceLevelMetrics[confidenceLevel].correct++;
        }
        
        var levelTotal = metrics.confidenceLevelMetrics[confidenceLevel].total;
        var levelCorrect = metrics.confidenceLevelMetrics[confidenceLevel].correct;
        metrics.confidenceLevelMetrics[confidenceLevel].accuracy = (levelCorrect / levelTotal) * 100;
      }

      // Actualizar estadísticas diarias
      if (!metrics.dailyStats[today]) {
        metrics.dailyStats[today] = {
          validations: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0
        };
      }
      
      metrics.dailyStats[today].validations++;
      if (isCorrect) {
        metrics.dailyStats[today].correct++;
      } else {
        metrics.dailyStats[today].incorrect++;
      }
      metrics.dailyStats[today].accuracy = 
        (metrics.dailyStats[today].correct / metrics.dailyStats[today].validations) * 100;

      // Actualizar timestamp
      metrics.lastUpdated = new Date().toISOString();

      // Guardar métricas actualizadas
      this.saveMetrics(metrics);

      logger.systemLog('METRICS', `Métricas actualizadas - Total: ${metrics.totalValidations}, Accuracy: ${metrics.accuracyRate.toFixed(2)}%`);

      return metrics;

    } catch (error) {
      logger.error('Error actualizando métricas: ' + error.message);
      throw new Error('No se pudieron actualizar las métricas');
    }
  }

  /**
   * Obtener resumen de métricas actuales
   */
  getMetricsSummary() {
    try {
      var metrics = this.loadMetrics();
      
      return {
        general: {
          totalValidations: metrics.totalValidations,
          accuracyRate: parseFloat(metrics.accuracyRate.toFixed(2)),
          correctPredictions: metrics.correctPredictions,
          incorrectPredictions: metrics.incorrectPredictions
        },
        byClass: {
          dog: {
            total: metrics.classMetrics.dog.totalPredictions,
            accuracy: parseFloat(metrics.classMetrics.dog.accuracy.toFixed(2))
          },
          cat: {
            total: metrics.classMetrics.cat.totalPredictions,
            accuracy: parseFloat(metrics.classMetrics.cat.accuracy.toFixed(2))
          }
        },
        byConfidence: {
          alta: {
            total: metrics.confidenceLevelMetrics.alta.total,
            accuracy: parseFloat(metrics.confidenceLevelMetrics.alta.accuracy.toFixed(2))
          },
          media: {
            total: metrics.confidenceLevelMetrics.media.total,
            accuracy: parseFloat(metrics.confidenceLevelMetrics.media.accuracy.toFixed(2))
          },
          baja: {
            total: metrics.confidenceLevelMetrics.baja.total,
            accuracy: parseFloat(metrics.confidenceLevelMetrics.baja.accuracy.toFixed(2))
          }
        },
        lastUpdated: metrics.lastUpdated
      };

    } catch (error) {
      logger.error('Error obteniendo resumen de métricas: ' + error.message);
      throw new Error('No se pudo obtener el resumen de métricas');
    }
  }

  /**
   * Obtener métricas detalladas para análisis
   */
  getDetailedMetrics() {
    try {
      return this.loadMetrics();
    } catch (error) {
      logger.error('Error obteniendo métricas detalladas: ' + error.message);
      throw new Error('No se pudieron obtener las métricas detalladas');
    }
  }

  /**
   * Obtener estadísticas de los últimos N días
   */
  getRecentStats(days = 7) {
    try {
      var metrics = this.loadMetrics();
      var recentStats = [];
      var today = new Date();
      
      for (var i = days - 1; i >= 0; i--) {
        var date = new Date(today);
        date.setDate(date.getDate() - i);
        var dateStr = date.toISOString().split('T')[0];
        
        var dayStats = metrics.dailyStats[dateStr] || {
          validations: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0
        };
        
        recentStats.push({
          date: dateStr,
          ...dayStats
        });
      }
      
      return recentStats;
      
    } catch (error) {
      logger.error('Error obteniendo estadísticas recientes: ' + error.message);
      throw new Error('No se pudieron obtener las estadísticas recientes');
    }
  }

  /**
   * Resetear métricas (útil para testing o reinicio)
   */
  resetMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        fs.unlinkSync(this.metricsFile);
        logger.systemLog('METRICS', 'Métricas reseteadas');
      }
      return this.loadMetrics(); // Creará archivo inicial
    } catch (error) {
      logger.error('Error reseteando métricas: ' + error.message);
      throw new Error('No se pudieron resetear las métricas');
    }
  }
}

// Exportar instancia singleton
export default new MetricsTracker();