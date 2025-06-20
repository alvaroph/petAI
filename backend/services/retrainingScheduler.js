import cron from 'node-cron';
import logger from '../utils/logger.js';
import mlopsMonitor from '../utils/mlopsMonitor.js';
import { executeRetraining } from '../scripts/retrainModel.js';
import metricsTracker from '../utils/metricsTracker.js';

/**
 * Servicio de Scheduler para Reentrenamiento Automático
 * Fase 5: MLOps - Automatización de pipeline de reentrenamiento
 */
class RetrainingScheduler {
  constructor() {
    this.isRunning = false;
    this.lastCheck = null;
    this.retrainingInProgress = false;
    this.scheduledTask = null;
    this.config = {
      checkInterval: '*/30 * * * *', // Cada 30 minutos
      maxRetrainingsPerDay: 3,
      cooldownHours: 6, // Mínimo 6 horas entre reentrenamientos
      enableAutoRetraining: true
    };
  }

  /**
   * Iniciar el scheduler
   */
  start() {
    if (this.isRunning) {
      logger.systemLog('SCHEDULER', 'Scheduler ya está ejecutándose');
      return;
    }

    logger.systemLog('SCHEDULER', 'Iniciando scheduler de reentrenamiento automático...');
    
    // Programar tarea cron
    this.scheduledTask = cron.schedule(this.config.checkInterval, async () => {
      try {
        await this.checkAndTriggerRetraining();
      } catch (error) {
        logger.error('Error en scheduler de reentrenamiento: ' + error.message);
      }
    }, {
      scheduled: false
    });

    this.scheduledTask.start();
    this.isRunning = true;
    this.lastCheck = new Date();

    logger.systemLog('SCHEDULER', `Scheduler iniciado - Verificando cada ${this.config.checkInterval}`);
  }

  /**
   * Detener el scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.systemLog('SCHEDULER', 'Scheduler no está ejecutándose');
      return;
    }

    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask.destroy();
    }

    this.isRunning = false;
    logger.systemLog('SCHEDULER', 'Scheduler de reentrenamiento detenido');
  }

  /**
   * Verificar triggers y ejecutar reentrenamiento si es necesario
   */
  async checkAndTriggerRetraining() {
    if (this.retrainingInProgress) {
      logger.systemLog('SCHEDULER', 'Reentrenamiento ya en progreso, saltando verificación');
      return;
    }

    if (!this.config.enableAutoRetraining) {
      logger.systemLog('SCHEDULER', 'Reentrenamiento automático deshabilitado');
      return;
    }

    try {
      logger.systemLog('SCHEDULER', '🔍 Verificando triggers de reentrenamiento...');
      
      // 1. Verificar cooldown
      if (!(await this.canRetrain())) {
        return;
      }

      // 2. Evaluar triggers con MLOps Monitor
      var evaluation = await mlopsMonitor.evaluateRetrainingTriggers();
      
      // 3. Log de la evaluación
      logger.systemLog('SCHEDULER', `Triggers encontrados: ${evaluation.triggers.length}`);
      evaluation.triggers.forEach(trigger => {
        logger.systemLog('SCHEDULER', `- ${trigger.type}: ${trigger.reason} (${trigger.priority})`);
      });

      // 4. Decidir si ejecutar reentrenamiento
      if (evaluation.shouldRetrain) {
        logger.systemLog('SCHEDULER', '🚀 Triggers de reentrenamiento activados - Iniciando proceso...');
        await this.executeAutomaticRetraining(evaluation);
      } else {
        logger.systemLog('SCHEDULER', '✅ No se requiere reentrenamiento en este momento');
        
        // Log de recomendaciones
        if (evaluation.recommendations.length > 0) {
          logger.systemLog('SCHEDULER', 'Recomendaciones:');
          evaluation.recommendations.forEach(rec => {
            logger.systemLog('SCHEDULER', `- ${rec}`);
          });
        }
      }

      this.lastCheck = new Date();

    } catch (error) {
      logger.error('Error verificando triggers de reentrenamiento: ' + error.message);
      throw error;
    }
  }

  /**
   * Verificar si se puede ejecutar reentrenamiento (cooldown, límites diarios)
   */
  async canRetrain() {
    try {
      // 1. Verificar límite diario
      var todaysRetrainings = await this.getTodaysRetrainingCount();
      if (todaysRetrainings >= this.config.maxRetrainingsPerDay) {
        logger.systemLog('SCHEDULER', `Límite diario alcanzado: ${todaysRetrainings}/${this.config.maxRetrainingsPerDay} reentrenamientos`);
        return false;
      }

      // 2. Verificar cooldown
      var lastRetraining = await this.getLastRetrainingTime();
      if (lastRetraining) {
        var hoursSinceLastRetraining = (Date.now() - lastRetraining.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRetraining < this.config.cooldownHours) {
          logger.systemLog('SCHEDULER', `Cooldown activo: ${this.config.cooldownHours - hoursSinceLastRetraining.toFixed(1)} horas restantes`);
          return false;
        }
      }

      return true;

    } catch (error) {
      logger.error('Error verificando si se puede reentrenar: ' + error.message);
      return false;
    }
  }

  /**
   * Obtener número de reentrenamientos hoy
   */
  async getTodaysRetrainingCount() {
    try {
      var history = mlopsMonitor.loadTriggerHistory();
      var today = new Date().toISOString().split('T')[0];
      
      var todaysRetrainings = history.triggers.filter(trigger => {
        var triggerDate = new Date(trigger.timestamp).toISOString().split('T')[0];
        return triggerDate === today && trigger.type === 'RETRAINING_EXECUTED';
      });

      return todaysRetrainings.length;

    } catch (error) {
      logger.error('Error obteniendo reentrenamientos de hoy: ' + error.message);
      return 0;
    }
  }

  /**
   * Obtener timestamp del último reentrenamiento
   */
  async getLastRetrainingTime() {
    try {
      var history = mlopsMonitor.loadTriggerHistory();
      
      var retrainingTriggers = history.triggers
        .filter(trigger => trigger.type === 'RETRAINING_EXECUTED')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (retrainingTriggers.length > 0) {
        return new Date(retrainingTriggers[0].timestamp);
      }

      return null;

    } catch (error) {
      logger.error('Error obteniendo último reentrenamiento: ' + error.message);
      return null;
    }
  }

  /**
   * Ejecutar reentrenamiento automático
   */
  async executeAutomaticRetraining(evaluation) {
    this.retrainingInProgress = true;
    var retrainingId = `auto_${Date.now()}`;

    try {
      logger.systemLog('SCHEDULER', `🔄 Iniciando reentrenamiento automático (ID: ${retrainingId})`);
      
      // 1. Registrar inicio del reentrenamiento
      mlopsMonitor.saveTrigger({
        type: 'RETRAINING_STARTED',
        reason: `Reentrenamiento automático iniciado por: ${evaluation.triggers.map(t => t.type).join(', ')}`,
        priority: 'high',
        data: {
          retrainingId: retrainingId,
          triggeredBy: evaluation.triggers,
          metricsSnapshot: evaluation.metrics
        }
      });

      // 2. Ejecutar reentrenamiento
      var retrainingResult = await executeRetraining({
        epochs: 5,
        batchSize: 16,
        learningRate: 0.0001,
        dataAugmentation: true
      });

      // 3. Evaluar resultado
      if (retrainingResult.success) {
        logger.systemLog('SCHEDULER', `✅ Reentrenamiento automático completado exitosamente`);
        logger.systemLog('SCHEDULER', `📈 Nueva accuracy: ${(retrainingResult.metrics.accuracy * 100).toFixed(2)}%`);
        
        if (retrainingResult.metrics.improvement > 0) {
          logger.systemLog('SCHEDULER', `🎉 Mejora detectada: +${(retrainingResult.metrics.improvement * 100).toFixed(2)}%`);
        }

        // Registrar éxito
        mlopsMonitor.saveTrigger({
          type: 'RETRAINING_EXECUTED',
          reason: `Reentrenamiento completado exitosamente - Accuracy: ${(retrainingResult.metrics.accuracy * 100).toFixed(2)}%`,
          priority: 'high',
          data: {
            retrainingId: retrainingId,
            finalAccuracy: retrainingResult.metrics.accuracy,
            improvement: retrainingResult.metrics.improvement,
            version: retrainingResult.version,
            success: true
          }
        });

      } else {
        logger.systemLog('SCHEDULER', `⚠️  Reentrenamiento completado pero no desplegado`);
        
        // Registrar no despliegue
        mlopsMonitor.saveTrigger({
          type: 'RETRAINING_NOT_DEPLOYED',
          reason: `Reentrenamiento no desplegado por bajo rendimiento`,
          priority: 'medium',
          data: {
            retrainingId: retrainingId,
            finalAccuracy: retrainingResult.metrics.accuracy,
            improvement: retrainingResult.metrics.improvement,
            success: false
          }
        });
      }

      // 4. Actualizar métricas del sistema
      await this.updateSystemMetrics(retrainingResult);

      return retrainingResult;

    } catch (error) {
      logger.error(`Error en reentrenamiento automático: ${error.message}`);
      
      // Registrar error
      mlopsMonitor.saveTrigger({
        type: 'RETRAINING_FAILED',
        reason: `Error durante reentrenamiento: ${error.message}`,
        priority: 'high',
        data: {
          retrainingId: retrainingId,
          error: error.message,
          success: false
        }
      });

      throw error;

    } finally {
      this.retrainingInProgress = false;
    }
  }

  /**
   * Actualizar métricas del sistema después del reentrenamiento
   */
  async updateSystemMetrics(retrainingResult) {
    try {
      // Por ahora, solo log de las métricas
      // En el futuro podríamos actualizar una base de datos de métricas
      logger.systemLog('SCHEDULER', `📊 Métricas del sistema actualizadas:`);
      logger.systemLog('SCHEDULER', `- Accuracy: ${(retrainingResult.metrics.accuracy * 100).toFixed(2)}%`);
      logger.systemLog('SCHEDULER', `- Versión: ${retrainingResult.version}`);
      
      if (retrainingResult.metrics.improvement !== null) {
        logger.systemLog('SCHEDULER', `- Mejora: ${(retrainingResult.metrics.improvement * 100).toFixed(2)}%`);
      }

    } catch (error) {
      logger.error('Error actualizando métricas del sistema: ' + error.message);
    }
  }

  /**
   * Ejecutar reentrenamiento manual (para API)
   */
  async triggerManualRetraining(options = {}) {
    if (this.retrainingInProgress) {
      throw new Error('Ya hay un reentrenamiento en progreso');
    }

    logger.systemLog('SCHEDULER', '🔧 Iniciando reentrenamiento manual...');
    
    try {
      var result = await this.executeAutomaticRetraining({
        triggers: [{
          type: 'MANUAL_TRIGGER',
          reason: 'Reentrenamiento iniciado manualmente',
          priority: 'high'
        }],
        metrics: await metricsTracker.getMetricsSummary()
      });

      return result;

    } catch (error) {
      logger.error('Error en reentrenamiento manual: ' + error.message);
      throw error;
    }
  }

  /**
   * Obtener estado del scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      retrainingInProgress: this.retrainingInProgress,
      lastCheck: this.lastCheck,
      config: this.config,
      nextCheck: this.scheduledTask ? this.scheduledTask.getStatus() : null
    };
  }

  /**
   * Actualizar configuración del scheduler
   */
  updateConfig(newConfig) {
    var oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    logger.systemLog('SCHEDULER', 'Configuración del scheduler actualizada');
    logger.systemLog('SCHEDULER', `Cambios: ${JSON.stringify({ old: oldConfig, new: this.config })}`);
    
    // Reiniciar scheduler si cambió el intervalo
    if (newConfig.checkInterval && newConfig.checkInterval !== oldConfig.checkInterval) {
      if (this.isRunning) {
        logger.systemLog('SCHEDULER', 'Reiniciando scheduler con nuevo intervalo...');
        this.stop();
        this.start();
      }
    }

    return this.config;
  }

  /**
   * Obtener estadísticas de reentrenamientos
   */
  async getStatistics() {
    try {
      var history = mlopsMonitor.loadTriggerHistory();
      var retrainingTriggers = history.triggers.filter(t => 
        t.type === 'RETRAINING_EXECUTED' || 
        t.type === 'RETRAINING_FAILED' || 
        t.type === 'RETRAINING_NOT_DEPLOYED'
      );

      var stats = {
        totalRetrainings: retrainingTriggers.length,
        successful: retrainingTriggers.filter(t => t.type === 'RETRAINING_EXECUTED').length,
        failed: retrainingTriggers.filter(t => t.type === 'RETRAINING_FAILED').length,
        notDeployed: retrainingTriggers.filter(t => t.type === 'RETRAINING_NOT_DEPLOYED').length,
        lastRetraining: retrainingTriggers.length > 0 ? 
          retrainingTriggers[retrainingTriggers.length - 1].timestamp : null,
        todaysRetrainings: await this.getTodaysRetrainingCount()
      };

      return stats;

    } catch (error) {
      logger.error('Error obteniendo estadísticas: ' + error.message);
      return null;
    }
  }
}

// Exportar instancia singleton
export default new RetrainingScheduler();