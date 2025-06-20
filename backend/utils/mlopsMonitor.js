import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import metricsTracker from './metricsTracker.js';

/**
 * Sistema de Monitoreo MLOps para Fase 5
 * Monitorea métricas y triggers automáticos para reentrenamiento
 */
class MLOpsMonitor {
  constructor() {
    this.configFile = path.join(process.cwd(), 'storage', 'mlops', 'monitor_config.json');
    this.triggersFile = path.join(process.cwd(), 'storage', 'mlops', 'trigger_history.json');
    this.ensureMLOpsDirectory();
    this.loadConfig();
  }

  /**
   * Asegurar que existe el directorio MLOps
   */
  ensureMLOpsDirectory() {
    var mlopsDir = path.dirname(this.configFile);
    if (!fs.existsSync(mlopsDir)) {
      fs.mkdirSync(mlopsDir, { recursive: true });
      logger.systemLog('MLOPS', 'Directorio MLOps creado: ' + mlopsDir);
    }
  }

  /**
   * Cargar configuración de monitoreo
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        var data = fs.readFileSync(this.configFile, 'utf8');
        this.config = JSON.parse(data);
      } else {
        // Configuración por defecto
        this.config = {
          retrainingTriggers: {
            minValidationsRequired: 20,        // Mínimo 20 validaciones
            minAccuracyDrop: 5,               // 5% drop en accuracy
            maxDaysSinceLastTraining: 7,       // 7 días máximo sin reentrenar
            minValidationsPerClass: 5,         // 5 validaciones por clase mínimo
            confidenceLevelThreshold: 60       // Bajo 60% accuracy en algún nivel
          },
          modelVersioning: {
            maxStoredVersions: 5,              // Máximo 5 versiones guardadas
            autoBackup: true,                  // Backup automático antes de reemplazar
            testingPeriod: 24,                 // 24 horas de testing A/B
            rollbackThreshold: 3               // 3% degradación para rollback
          },
          monitoring: {
            checkIntervalMinutes: 30,          // Check cada 30 minutos
            alertThresholds: {
              accuracyDrop: 10,                // Alerta si accuracy baja 10%
              lowConfidenceRate: 30,           // Alerta si >30% predicciones baja confianza
              validationBacklog: 50            // Alerta si >50 validaciones pendientes
            }
          },
          lastUpdated: new Date().toISOString(),
          version: '1.0.0'
        };
        this.saveConfig();
      }
    } catch (error) {
      logger.error('Error cargando configuración MLOps: ' + error.message);
      throw new Error('No se pudo cargar la configuración de MLOps');
    }
  }

  /**
   * Guardar configuración
   */
  saveConfig() {
    try {
      var jsonData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configFile, jsonData, 'utf8');
      logger.systemLog('MLOPS', 'Configuración MLOps guardada');
    } catch (error) {
      logger.error('Error guardando configuración MLOps: ' + error.message);
      throw new Error('No se pudo guardar la configuración');
    }
  }

  /**
   * Cargar historial de triggers
   */
  loadTriggerHistory() {
    try {
      if (fs.existsSync(this.triggersFile)) {
        var data = fs.readFileSync(this.triggersFile, 'utf8');
        return JSON.parse(data);
      } else {
        return {
          triggers: [],
          lastCheck: null,
          totalTriggers: 0,
          version: '1.0.0'
        };
      }
    } catch (error) {
      logger.error('Error cargando historial de triggers: ' + error.message);
      return { triggers: [], lastCheck: null, totalTriggers: 0 };
    }
  }

  /**
   * Guardar trigger en historial
   */
  saveTrigger(triggerData) {
    try {
      var history = this.loadTriggerHistory();
      
      history.triggers.push({
        ...triggerData,
        timestamp: new Date().toISOString(),
        id: `trigger_${Date.now()}`
      });
      
      history.totalTriggers = history.triggers.length;
      history.lastCheck = new Date().toISOString();
      
      // Mantener solo últimos 100 triggers
      if (history.triggers.length > 100) {
        history.triggers = history.triggers.slice(-100);
      }
      
      fs.writeFileSync(this.triggersFile, JSON.stringify(history, null, 2));
      logger.systemLog('MLOPS', `Trigger guardado: ${triggerData.type} - ${triggerData.reason}`);
      
    } catch (error) {
      logger.error('Error guardando trigger: ' + error.message);
    }
  }

  /**
   * Evaluar si se debe disparar reentrenamiento
   */
  async evaluateRetrainingTriggers() {
    try {
      logger.systemLog('MLOPS', 'Evaluando triggers de reentrenamiento...');
      
      var metrics = await metricsTracker.getMetricsSummary();
      var detailedMetrics = await metricsTracker.getDetailedMetrics();
      var triggers = [];
      
      // 1. Verificar número mínimo de validaciones
      if (metrics.general.totalValidations >= this.config.retrainingTriggers.minValidationsRequired) {
        var validationsPerClass = Math.min(metrics.byClass.dog.total, metrics.byClass.cat.total);
        
        if (validationsPerClass >= this.config.retrainingTriggers.minValidationsPerClass) {
          triggers.push({
            type: 'MIN_VALIDATIONS_REACHED',
            reason: `Se alcanzó el mínimo de validaciones: ${metrics.general.totalValidations} total, ${validationsPerClass} por clase`,
            priority: 'medium',
            data: {
              totalValidations: metrics.general.totalValidations,
              validationsPerClass: validationsPerClass
            }
          });
        }
      }
      
      // 2. Verificar drop en accuracy
      var currentAccuracy = metrics.general.accuracyRate;
      var baselineAccuracy = await this.getBaselineAccuracy();
      
      if (baselineAccuracy && (baselineAccuracy - currentAccuracy) >= this.config.retrainingTriggers.minAccuracyDrop) {
        triggers.push({
          type: 'ACCURACY_DROP',
          reason: `Accuracy bajó ${(baselineAccuracy - currentAccuracy).toFixed(2)}% (de ${baselineAccuracy}% a ${currentAccuracy}%)`,
          priority: 'high',
          data: {
            currentAccuracy: currentAccuracy,
            baselineAccuracy: baselineAccuracy,
            drop: baselineAccuracy - currentAccuracy
          }
        });
      }
      
      // 3. Verificar accuracy por nivel de confianza
      for (var level of ['alta', 'media', 'baja']) {
        var levelAccuracy = metrics.byConfidence[level].accuracy;
        var levelTotal = metrics.byConfidence[level].total;
        
        if (levelTotal >= 10 && levelAccuracy < this.config.retrainingTriggers.confidenceLevelThreshold) {
          triggers.push({
            type: 'LOW_CONFIDENCE_ACCURACY',
            reason: `Accuracy en nivel ${level}: ${levelAccuracy.toFixed(2)}% (${levelTotal} muestras)`,
            priority: 'medium',
            data: {
              confidenceLevel: level,
              accuracy: levelAccuracy,
              sampleCount: levelTotal
            }
          });
        }
      }
      
      // 4. Verificar tiempo desde último entrenamiento
      var daysSinceLastTraining = await this.getDaysSinceLastTraining();
      if (daysSinceLastTraining >= this.config.retrainingTriggers.maxDaysSinceLastTraining) {
        triggers.push({
          type: 'TIME_BASED',
          reason: `Han pasado ${daysSinceLastTraining} días desde el último entrenamiento`,
          priority: 'low',
          data: {
            daysSinceLastTraining: daysSinceLastTraining
          }
        });
      }
      
      // Guardar triggers encontrados
      for (var trigger of triggers) {
        this.saveTrigger(trigger);
      }
      
      // Determinar si se debe ejecutar reentrenamiento
      var shouldRetrain = this.shouldTriggerRetraining(triggers);
      
      var result = {
        shouldRetrain: shouldRetrain,
        triggers: triggers,
        metrics: metrics,
        recommendations: this.generateRecommendations(triggers, metrics),
        nextCheckIn: this.config.monitoring.checkIntervalMinutes
      };
      
      logger.systemLog('MLOPS', `Evaluación completada - Triggers: ${triggers.length}, Reentrenar: ${shouldRetrain}`);
      
      return result;
      
    } catch (error) {
      logger.error('Error evaluando triggers de reentrenamiento: ' + error.message);
      throw error;
    }
  }

  /**
   * Determinar si se debe disparar reentrenamiento basado en triggers
   */
  shouldTriggerRetraining(triggers) {
    // Reentrenar si hay triggers de alta prioridad
    var highPriorityTriggers = triggers.filter(t => t.priority === 'high');
    if (highPriorityTriggers.length > 0) {
      return true;
    }
    
    // Reentrenar si hay múltiples triggers de prioridad media
    var mediumPriorityTriggers = triggers.filter(t => t.priority === 'medium');
    if (mediumPriorityTriggers.length >= 2) {
      return true;
    }
    
    // Reentrenar si hay triggers de validaciones suficientes + tiempo
    var hasValidations = triggers.some(t => t.type === 'MIN_VALIDATIONS_REACHED');
    var hasTime = triggers.some(t => t.type === 'TIME_BASED');
    
    if (hasValidations && hasTime) {
      return true;
    }
    
    return false;
  }

  /**
   * Obtener accuracy baseline (del modelo actual)
   */
  async getBaselineAccuracy() {
    try {
      var modelMetricsPath = path.join(process.cwd(), 'storage', 'models', 'pet_model', 'training_metrics.json');
      
      if (fs.existsSync(modelMetricsPath)) {
        var data = fs.readFileSync(modelMetricsPath, 'utf8');
        var modelMetrics = JSON.parse(data);
        return (modelMetrics.finalAccuracy * 100).toFixed(2); // Convertir a porcentaje
      }
      
      return null;
    } catch (error) {
      logger.error('Error obteniendo accuracy baseline: ' + error.message);
      return null;
    }
  }

  /**
   * Calcular días desde último entrenamiento
   */
  async getDaysSinceLastTraining() {
    try {
      var modelMetricsPath = path.join(process.cwd(), 'storage', 'models', 'pet_model', 'training_metrics.json');
      
      if (fs.existsSync(modelMetricsPath)) {
        var data = fs.readFileSync(modelMetricsPath, 'utf8');
        var modelMetrics = JSON.parse(data);
        
        var lastTraining = new Date(modelMetrics.trainedAt);
        var now = new Date();
        var diffTime = Math.abs(now - lastTraining);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
      }
      
      return 999; // Si no hay modelo, hace mucho tiempo
    } catch (error) {
      logger.error('Error calculando días desde último entrenamiento: ' + error.message);
      return 0;
    }
  }

  /**
   * Generar recomendaciones basadas en triggers y métricas
   */
  generateRecommendations(triggers, metrics) {
    var recommendations = [];
    
    if (triggers.length === 0) {
      recommendations.push('✅ Sistema funcionando correctamente, no se requiere reentrenamiento');
    }
    
    triggers.forEach(function(trigger) {
      switch (trigger.type) {
        case 'ACCURACY_DROP':
          recommendations.push('🔴 Accuracy ha bajado significativamente - Reentrenamiento urgente recomendado');
          break;
        case 'MIN_VALIDATIONS_REACHED':
          recommendations.push('🟡 Suficientes validaciones disponibles - Considerar reentrenamiento para mejora');
          break;
        case 'LOW_CONFIDENCE_ACCURACY':
          recommendations.push(`🟠 Baja accuracy en nivel ${trigger.data.confidenceLevel} - Revisar datos de entrenamiento`);
          break;
        case 'TIME_BASED':
          recommendations.push('⏰ Reentrenamiento programado por tiempo - Mantener modelo actualizado');
          break;
      }
    });
    
    // Recomendaciones basadas en métricas
    if (metrics.general.totalValidations < 10) {
      recommendations.push('📊 Pocas validaciones disponibles - Promover uso para obtener más feedback');
    }
    
    if (Math.abs(metrics.byClass.dog.total - metrics.byClass.cat.total) > 10) {
      recommendations.push('⚖️ Dataset desbalanceado - Aplicar técnicas de balancing en próximo entrenamiento');
    }
    
    return recommendations;
  }

  /**
   * Obtener estado actual del monitoreo
   */
  getMonitoringStatus() {
    try {
      var history = this.loadTriggerHistory();
      var recentTriggers = history.triggers.slice(-10); // Últimos 10 triggers
      
      return {
        config: this.config,
        recentTriggers: recentTriggers,
        totalTriggers: history.totalTriggers,
        lastCheck: history.lastCheck,
        nextCheckIn: this.config.monitoring.checkIntervalMinutes,
        status: recentTriggers.length > 0 ? 'active' : 'monitoring'
      };
    } catch (error) {
      logger.error('Error obteniendo estado de monitoreo: ' + error.message);
      throw error;
    }
  }

  /**
   * Actualizar configuración de monitoreo
   */
  updateConfig(newConfig) {
    try {
      this.config = {
        ...this.config,
        ...newConfig,
        lastUpdated: new Date().toISOString()
      };
      
      this.saveConfig();
      logger.systemLog('MLOPS', 'Configuración de monitoreo actualizada');
      
      return this.config;
    } catch (error) {
      logger.error('Error actualizando configuración: ' + error.message);
      throw error;
    }
  }
}

// Exportar instancia singleton
export default new MLOpsMonitor();