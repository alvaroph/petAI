import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Sistema de Versionado de Modelos para MLOps
 * Fase 5: Gestión de versiones, deployment y rollback
 */
class ModelVersioning {
  constructor() {
    this.baseModelPath = path.join(process.cwd(), 'storage', 'models');
    this.currentModelPath = path.join(this.baseModelPath, 'pet_model');
    this.versionsPath = path.join(this.baseModelPath, 'versions');
    this.versionMetadataFile = path.join(this.baseModelPath, 'version_metadata.json');
    this.ensureDirectoryStructure();
    this.loadVersionMetadata();
  }

  /**
   * Asegurar estructura de directorios
   */
  ensureDirectoryStructure() {
    var directories = [
      this.baseModelPath,
      this.versionsPath,
      this.currentModelPath
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.systemLog('VERSIONING', `Directorio creado: ${dir}`);
      }
    });
  }

  /**
   * Cargar metadata de versiones
   */
  loadVersionMetadata() {
    try {
      if (fs.existsSync(this.versionMetadataFile)) {
        var data = fs.readFileSync(this.versionMetadataFile, 'utf8');
        this.metadata = JSON.parse(data);
      } else {
        // Crear metadata inicial
        this.metadata = {
          currentVersion: '1.0.0',
          versions: {},
          deploymentHistory: [],
          rollbackHistory: [],
          lastUpdate: new Date().toISOString(),
          schemaVersion: '1.0.0'
        };
        this.saveVersionMetadata();
      }
    } catch (error) {
      logger.error('Error cargando metadata de versiones: ' + error.message);
      throw new Error('No se pudo cargar la metadata de versiones');
    }
  }

  /**
   * Guardar metadata de versiones
   */
  saveVersionMetadata() {
    try {
      var jsonData = JSON.stringify(this.metadata, null, 2);
      fs.writeFileSync(this.versionMetadataFile, jsonData, 'utf8');
      logger.systemLog('VERSIONING', 'Metadata de versiones guardada');
    } catch (error) {
      logger.error('Error guardando metadata de versiones: ' + error.message);
      throw new Error('No se pudo guardar la metadata de versiones');
    }
  }

  /**
   * Generar nuevo número de versión basado en tipo de cambio
   */
  generateNextVersion(changeType = 'minor') {
    var currentVersion = this.metadata.currentVersion;
    var [major, minor, patch] = currentVersion.split('.').map(Number);

    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Crear nueva versión del modelo
   */
  async createVersion(versionInfo) {
    try {
      var {
        changeType = 'minor',
        description = 'Nueva versión del modelo',
        trainingMetrics = {},
        retrainingReason = null,
        deploymentStrategy = 'replace'
      } = versionInfo;

      var newVersion = this.generateNextVersion(changeType);
      var versionDir = path.join(this.versionsPath, `v${newVersion}`);

      // Crear directorio de la nueva versión
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
      }

      // Copiar modelo actual a la nueva versión
      await this.copyModelFiles(this.currentModelPath, versionDir);

      // Crear metadata de la versión
      var versionMetadata = {
        version: newVersion,
        createdAt: new Date().toISOString(),
        description: description,
        changeType: changeType,
        trainingMetrics: trainingMetrics,
        retrainingReason: retrainingReason,
        deploymentStrategy: deploymentStrategy,
        size: await this.calculateModelSize(versionDir),
        status: 'created', // created, deployed, archived, rollback
        parentVersion: this.metadata.currentVersion,
        performance: {
          accuracy: trainingMetrics.finalAccuracy || null,
          loss: trainingMetrics.finalLoss || null,
          improvement: trainingMetrics.improvement || null
        }
      };

      // Guardar metadata de la versión
      var versionMetadataPath = path.join(versionDir, 'version_info.json');
      fs.writeFileSync(versionMetadataPath, JSON.stringify(versionMetadata, null, 2));

      // Actualizar metadata global
      this.metadata.versions[newVersion] = versionMetadata;
      this.metadata.lastUpdate = new Date().toISOString();
      this.saveVersionMetadata();

      logger.systemLog('VERSIONING', `Nueva versión creada: ${newVersion}`);
      logger.systemLog('VERSIONING', `Descripción: ${description}`);

      return {
        version: newVersion,
        path: versionDir,
        metadata: versionMetadata
      };

    } catch (error) {
      logger.error('Error creando nueva versión: ' + error.message);
      throw new Error('No se pudo crear la nueva versión del modelo');
    }
  }

  /**
   * Copiar archivos del modelo
   */
  async copyModelFiles(sourcePath, targetPath) {
    try {
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Directorio fuente no existe: ${sourcePath}`);
      }

      var files = fs.readdirSync(sourcePath);
      
      for (var file of files) {
        var sourceFile = path.join(sourcePath, file);
        var targetFile = path.join(targetPath, file);
        
        var stats = fs.statSync(sourceFile);
        
        if (stats.isFile()) {
          fs.copyFileSync(sourceFile, targetFile);
        }
      }

      logger.systemLog('VERSIONING', `Archivos copiados de ${sourcePath} a ${targetPath}`);

    } catch (error) {
      logger.error('Error copiando archivos del modelo: ' + error.message);
      throw error;
    }
  }

  /**
   * Calcular tamaño del modelo
   */
  async calculateModelSize(modelPath) {
    try {
      var totalSize = 0;
      var files = fs.readdirSync(modelPath);
      
      for (var file of files) {
        var filePath = path.join(modelPath, file);
        var stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }

      return {
        bytes: totalSize,
        mb: (totalSize / (1024 * 1024)).toFixed(2),
        files: files.length
      };

    } catch (error) {
      logger.error('Error calculando tamaño del modelo: ' + error.message);
      return { bytes: 0, mb: '0.00', files: 0 };
    }
  }

  /**
   * Desplegar versión específica como modelo actual
   */
  async deployVersion(version, deploymentOptions = {}) {
    try {
      var {
        createBackup = true,
        strategy = 'replace',
        rollbackOnFailure = true
      } = deploymentOptions;

      if (!this.metadata.versions[version]) {
        throw new Error(`Versión ${version} no existe`);
      }

      var versionPath = path.join(this.versionsPath, `v${version}`);
      if (!fs.existsSync(versionPath)) {
        throw new Error(`Directorio de versión no encontrado: ${versionPath}`);
      }

      var deploymentId = `deploy_${Date.now()}`;
      var currentVersion = this.metadata.currentVersion;

      logger.systemLog('VERSIONING', `Iniciando deployment de versión ${version} (ID: ${deploymentId})`);

      // 1. Crear backup del modelo actual si se solicita
      var backupPath = null;
      if (createBackup) {
        backupPath = await this.createBackup(currentVersion, `pre_deploy_${version}`);
      }

      try {
        // 2. Estrategia de deployment
        if (strategy === 'replace') {
          await this.replaceCurrentModel(versionPath);
        } else if (strategy === 'canary') {
          // Para implementar en el futuro
          throw new Error('Estrategia canary no implementada aún');
        }

        // 3. Actualizar metadata
        this.metadata.currentVersion = version;
        this.metadata.versions[version].status = 'deployed';
        this.metadata.versions[version].deployedAt = new Date().toISOString();
        
        // Actualizar estado anterior
        if (this.metadata.versions[currentVersion]) {
          this.metadata.versions[currentVersion].status = 'archived';
        }

        // 4. Registrar deployment
        var deploymentRecord = {
          id: deploymentId,
          version: version,
          previousVersion: currentVersion,
          strategy: strategy,
          deployedAt: new Date().toISOString(),
          backupPath: backupPath,
          success: true
        };

        this.metadata.deploymentHistory.push(deploymentRecord);
        this.metadata.lastUpdate = new Date().toISOString();
        this.saveVersionMetadata();

        logger.systemLog('VERSIONING', `✅ Deployment exitoso: ${version} desplegado como modelo actual`);

        return {
          success: true,
          deploymentId: deploymentId,
          version: version,
          previousVersion: currentVersion,
          backupPath: backupPath
        };

      } catch (deploymentError) {
        logger.error(`Error durante deployment: ${deploymentError.message}`);

        // Rollback automático si está habilitado
        if (rollbackOnFailure && backupPath) {
          logger.systemLog('VERSIONING', '🔄 Iniciando rollback automático...');
          try {
            await this.restoreFromBackup(backupPath);
            logger.systemLog('VERSIONING', '✅ Rollback automático completado');
          } catch (rollbackError) {
            logger.error(`Error en rollback automático: ${rollbackError.message}`);
          }
        }

        // Registrar deployment fallido
        var failedDeploymentRecord = {
          id: deploymentId,
          version: version,
          previousVersion: currentVersion,
          strategy: strategy,
          deployedAt: new Date().toISOString(),
          backupPath: backupPath,
          success: false,
          error: deploymentError.message
        };

        this.metadata.deploymentHistory.push(failedDeploymentRecord);
        this.saveVersionMetadata();

        throw deploymentError;
      }

    } catch (error) {
      logger.error('Error en deployment de versión: ' + error.message);
      throw error;
    }
  }

  /**
   * Reemplazar modelo actual con versión especificada
   */
  async replaceCurrentModel(versionPath) {
    try {
      // Limpiar directorio actual
      if (fs.existsSync(this.currentModelPath)) {
        var currentFiles = fs.readdirSync(this.currentModelPath);
        for (var file of currentFiles) {
          var filePath = path.join(this.currentModelPath, file);
          fs.unlinkSync(filePath);
        }
      }

      // Copiar archivos de la nueva versión
      await this.copyModelFiles(versionPath, this.currentModelPath);

      logger.systemLog('VERSIONING', 'Modelo actual reemplazado exitosamente');

    } catch (error) {
      logger.error('Error reemplazando modelo actual: ' + error.message);
      throw error;
    }
  }

  /**
   * Crear backup del modelo actual
   */
  async createBackup(version, reason = 'manual_backup') {
    try {
      var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      var backupDir = path.join(this.baseModelPath, 'backups', `${version}_${timestamp}_${reason}`);
      
      fs.mkdirSync(backupDir, { recursive: true });
      await this.copyModelFiles(this.currentModelPath, backupDir);

      var backupInfo = {
        version: version,
        reason: reason,
        createdAt: new Date().toISOString(),
        path: backupDir,
        size: await this.calculateModelSize(backupDir)
      };

      // Guardar info del backup
      var backupInfoPath = path.join(backupDir, 'backup_info.json');
      fs.writeFileSync(backupInfoPath, JSON.stringify(backupInfo, null, 2));

      logger.systemLog('VERSIONING', `Backup creado: ${backupDir}`);

      return backupDir;

    } catch (error) {
      logger.error('Error creando backup: ' + error.message);
      throw error;
    }
  }

  /**
   * Restaurar desde backup
   */
  async restoreFromBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup no encontrado: ${backupPath}`);
      }

      await this.replaceCurrentModel(backupPath);

      // Registrar rollback
      var rollbackRecord = {
        id: `rollback_${Date.now()}`,
        backupPath: backupPath,
        restoredAt: new Date().toISOString(),
        reason: 'manual_rollback'
      };

      this.metadata.rollbackHistory.push(rollbackRecord);
      this.saveVersionMetadata();

      logger.systemLog('VERSIONING', `✅ Modelo restaurado desde backup: ${backupPath}`);

      return rollbackRecord;

    } catch (error) {
      logger.error('Error restaurando desde backup: ' + error.message);
      throw error;
    }
  }

  /**
   * Hacer rollback a versión anterior
   */
  async rollbackToPreviousVersion(reason = 'performance_degradation') {
    try {
      var deploymentHistory = this.metadata.deploymentHistory
        .filter(d => d.success)
        .sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt));

      if (deploymentHistory.length < 2) {
        throw new Error('No hay versión anterior disponible para rollback');
      }

      var previousDeployment = deploymentHistory[1];
      var previousVersion = previousDeployment.version;

      logger.systemLog('VERSIONING', `Iniciando rollback a versión anterior: ${previousVersion}`);

      var rollbackResult = await this.deployVersion(previousVersion, {
        createBackup: true,
        strategy: 'replace',
        rollbackOnFailure: false
      });

      // Registrar rollback
      var rollbackRecord = {
        id: `rollback_${Date.now()}`,
        fromVersion: this.metadata.currentVersion,
        toVersion: previousVersion,
        reason: reason,
        rolledBackAt: new Date().toISOString(),
        deploymentId: rollbackResult.deploymentId
      };

      this.metadata.rollbackHistory.push(rollbackRecord);
      this.saveVersionMetadata();

      logger.systemLog('VERSIONING', `✅ Rollback completado: ${previousVersion} restaurado`);

      return rollbackRecord;

    } catch (error) {
      logger.error('Error en rollback: ' + error.message);
      throw error;
    }
  }

  /**
   * Obtener información de todas las versiones
   */
  getVersionsInfo() {
    try {
      var versionsInfo = Object.keys(this.metadata.versions)
        .map(version => ({
          version: version,
          ...this.metadata.versions[version],
          isCurrent: version === this.metadata.currentVersion
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        currentVersion: this.metadata.currentVersion,
        totalVersions: versionsInfo.length,
        versions: versionsInfo,
        deploymentHistory: this.metadata.deploymentHistory.slice(-10), // Últimos 10
        rollbackHistory: this.metadata.rollbackHistory.slice(-5) // Últimos 5
      };

    } catch (error) {
      logger.error('Error obteniendo información de versiones: ' + error.message);
      throw error;
    }
  }

  /**
   * Limpiar versiones antiguas (mantener solo las N más recientes)
   */
  async cleanupOldVersions(keepCount = 5) {
    try {
      var versions = Object.keys(this.metadata.versions)
        .map(v => ({ version: v, ...this.metadata.versions[v] }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (versions.length <= keepCount) {
        logger.systemLog('VERSIONING', `Solo hay ${versions.length} versiones, no se requiere limpieza`);
        return { cleaned: 0, kept: versions.length };
      }

      var toDelete = versions.slice(keepCount);
      var cleanedCount = 0;

      for (var versionInfo of toDelete) {
        // No eliminar la versión actual
        if (versionInfo.version === this.metadata.currentVersion) {
          continue;
        }

        // No eliminar versiones desplegadas recientemente
        if (versionInfo.status === 'deployed') {
          continue;
        }

        try {
          var versionDir = path.join(this.versionsPath, `v${versionInfo.version}`);
          if (fs.existsSync(versionDir)) {
            fs.rmSync(versionDir, { recursive: true });
          }

          delete this.metadata.versions[versionInfo.version];
          cleanedCount++;

          logger.systemLog('VERSIONING', `Versión eliminada: ${versionInfo.version}`);

        } catch (deleteError) {
          logger.error(`Error eliminando versión ${versionInfo.version}: ${deleteError.message}`);
        }
      }

      this.saveVersionMetadata();

      logger.systemLog('VERSIONING', `Limpieza completada: ${cleanedCount} versiones eliminadas, ${versions.length - cleanedCount} mantenidas`);

      return { 
        cleaned: cleanedCount, 
        kept: versions.length - cleanedCount 
      };

    } catch (error) {
      logger.error('Error en limpieza de versiones: ' + error.message);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de versioning
   */
  getVersioningStatistics() {
    try {
      var versions = Object.values(this.metadata.versions);
      var deployments = this.metadata.deploymentHistory;
      var rollbacks = this.metadata.rollbackHistory;

      var stats = {
        totalVersions: versions.length,
        currentVersion: this.metadata.currentVersion,
        versionsByStatus: {
          created: versions.filter(v => v.status === 'created').length,
          deployed: versions.filter(v => v.status === 'deployed').length,
          archived: versions.filter(v => v.status === 'archived').length
        },
        deployments: {
          total: deployments.length,
          successful: deployments.filter(d => d.success).length,
          failed: deployments.filter(d => !d.success).length,
          lastDeployment: deployments.length > 0 ? 
            deployments[deployments.length - 1] : null
        },
        rollbacks: {
          total: rollbacks.length,
          lastRollback: rollbacks.length > 0 ? 
            rollbacks[rollbacks.length - 1] : null
        },
        performance: {
          averageAccuracy: this.calculateAverageAccuracy(versions),
          bestVersion: this.getBestPerformingVersion(versions),
          latestVersion: versions.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt))[0]
        }
      };

      return stats;

    } catch (error) {
      logger.error('Error obteniendo estadísticas de versioning: ' + error.message);
      throw error;
    }
  }

  /**
   * Calcular accuracy promedio de todas las versiones
   */
  calculateAverageAccuracy(versions) {
    var validAccuracies = versions
      .filter(v => v.performance && v.performance.accuracy !== null)
      .map(v => v.performance.accuracy);

    if (validAccuracies.length === 0) return null;

    var sum = validAccuracies.reduce((acc, curr) => acc + curr, 0);
    return (sum / validAccuracies.length).toFixed(4);
  }

  /**
   * Obtener versión con mejor rendimiento
   */
  getBestPerformingVersion(versions) {
    return versions
      .filter(v => v.performance && v.performance.accuracy !== null)
      .sort((a, b) => b.performance.accuracy - a.performance.accuracy)[0] || null;
  }
}

// Exportar instancia singleton
export default new ModelVersioning();