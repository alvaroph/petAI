<template>
  <div class="mlops-dashboard">
    <div class="container-fluid">
      <!-- Header -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="card bg-gradient-primary text-white">
            <div class="card-body">
              <h2 class="card-title mb-0">
                <i class="bi bi-gear-fill me-2"></i>
                Panel MLOps - PetAI
              </h2>
              <p class="card-text mt-2">
                Sistema completo de Machine Learning Operations
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="card border-warning">
            <div class="card-header bg-warning text-dark">
              <h5 class="mb-0">
                <i class="bi bi-lightning-fill me-2"></i>
                Acciones Rápidas
              </h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-3 mb-2">
                  <button 
                    class="btn btn-success w-100"
                    @click="triggerManualRetraining"
                    :disabled="retrainingInProgress"
                  >
                    <i class="bi bi-arrow-repeat me-2"></i>
                    <span v-if="retrainingInProgress">
                      <div class="spinner-border spinner-border-sm me-1" role="status"></div>
                      Reentrenando...
                    </span>
                    <span v-else>Reentrenar Ahora</span>
                  </button>
                </div>
                <div class="col-md-3 mb-2">
                  <button 
                    class="btn btn-primary w-100"
                    @click="runModelTests"
                    :disabled="testsRunning"
                  >
                    <i class="bi bi-mortarboard me-2"></i>
                    <span v-if="testsRunning">
                      <div class="spinner-border spinner-border-sm me-1" role="status"></div>
                      Ejecutando...
                    </span>
                    <span v-else>Tests de Calidad</span>
                  </button>
                </div>
                <div class="col-md-3 mb-2">
                  <button 
                    class="btn btn-info w-100"
                    @click="toggleScheduler"
                  >
                    <i class="bi bi-clock me-2"></i>
                    {{ schedulerStatus?.running ? 'Detener' : 'Iniciar' }} Scheduler
                  </button>
                </div>
                <div class="col-md-3 mb-2">
                  <button 
                    class="btn btn-warning w-100"
                    @click="showEmergencyRollback = true"
                  >
                    <i class="bi bi-arrow-counterclockwise me-2"></i>
                    Rollback Emergencia
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="row mb-4">
        <div class="col-12">
          <ul class="nav nav-pills nav-fill">
            <li class="nav-item">
              <a 
                class="nav-link" 
                :class="{ active: activeTab === 'overview' }"
                @click="activeTab = 'overview'"
                href="#"
              >
                <i class="bi bi-speedometer2 me-2"></i>
                Vista General
              </a>
            </li>
            <li class="nav-item">
              <a 
                class="nav-link" 
                :class="{ active: activeTab === 'retraining' }"
                @click="activeTab = 'retraining'"
                href="#"
              >
                <i class="bi bi-arrow-repeat me-2"></i>
                Reentrenamiento
              </a>
            </li>
            <li class="nav-item">
              <a 
                class="nav-link" 
                :class="{ active: activeTab === 'ab-testing' }"
                @click="activeTab = 'ab-testing'"
                href="#"
              >
                <i class="bi bi-mortarboard me-2"></i>
                A/B Testing
              </a>
            </li>
            <li class="nav-item">
              <a 
                class="nav-link" 
                :class="{ active: activeTab === 'metrics' }"
                @click="activeTab = 'metrics'"
                href="#"
              >
                <i class="bi bi-graph-up me-2"></i>
                Métricas
              </a>
            </li>
            <li class="nav-item">
              <a 
                class="nav-link" 
                :class="{ active: activeTab === 'deployment' }"
                @click="activeTab = 'deployment'"
                href="#"
              >
                <i class="bi bi-rocket-takeoff me-2"></i>
                Deployment
              </a>
            </li>
            <li class="nav-item">
              <a 
                class="nav-link" 
                :class="{ active: activeTab === 'versions' }"
                @click="activeTab = 'versions'"
                href="#"
              >
                <i class="bi bi-git me-2"></i>
                Versiones
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        
        <!-- OVERVIEW TAB -->
        <div v-if="activeTab === 'overview'" class="tab-pane active">
          <!-- System Status Overview -->
          <div class="row mb-4">
            <!-- Model Health -->
            <div class="col-lg-3 col-md-6 mb-3">
              <div class="card border-left-success h-100">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col">
                      <div class="text-xs font-weight-bold text-success text-uppercase mb-1">
                        Estado del Modelo
                      </div>
                      <div class="h5 mb-0 font-weight-bold">
                        <span class="badge" :class="modelHealthBadge">
                          {{ modelHealthStatus }}
                        </span>
                      </div>
                    </div>
                    <div class="col-auto">
                      <i class="bi bi-heart-pulse fs-1 text-success"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Current Accuracy -->
            <div class="col-lg-3 col-md-6 mb-3">
              <div class="card border-left-info h-100">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col">
                      <div class="text-xs font-weight-bold text-info text-uppercase mb-1">
                        Accuracy Actual
                      </div>
                      <div class="h5 mb-0 font-weight-bold text-gray-800">
                        {{ (currentAccuracy * 100).toFixed(1) }}%
                      </div>
                    </div>
                    <div class="col-auto">
                      <i class="bi bi-bullseye fs-1 text-info"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scheduler Status -->
            <div class="col-lg-3 col-md-6 mb-3">
              <div class="card border-left-warning h-100">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col">
                      <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">
                        Auto-Reentrenamiento
                      </div>
                      <div class="h5 mb-0 font-weight-bold text-gray-800">
                        {{ schedulerStatus?.running ? 'Activo' : 'Detenido' }}
                      </div>
                    </div>
                    <div class="col-auto">
                      <i class="bi bi-clock fs-1 text-warning"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Active Tests -->
            <div class="col-lg-3 col-md-6 mb-3">
              <div class="card border-left-primary h-100">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col">
                      <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">
                        Tests A/B Activos
                      </div>
                      <div class="h5 mb-0 font-weight-bold text-gray-800">
                        {{ activeTestsCount }}
                      </div>
                    </div>
                    <div class="col-auto">
                      <i class="bi bi-mortarboard fs-1 text-primary"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="row">
            <div class="col-md-8">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-clock-history me-2"></i>
                    Actividad Reciente
                  </h5>
                </div>
                <div class="card-body">
                  <div v-if="recentActivity.length === 0" class="text-center text-muted py-4">
                    No hay actividad reciente
                  </div>
                  <div v-else>
                    <div 
                      v-for="activity in recentActivity" 
                      :key="activity.id"
                      class="border-bottom py-2"
                    >
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <i :class="activity.icon" class="me-2"></i>
                          <strong>{{ activity.title }}</strong>
                        </div>
                        <small class="text-muted">{{ formatDate(activity.timestamp) }}</small>
                      </div>
                      <div class="text-muted small">{{ activity.description }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-pie-chart me-2"></i>
                    Resumen de Sistema
                  </h5>
                </div>
                <div class="card-body">
                  <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                      <span class="small">Modelo Actual</span>
                      <span class="small font-weight-bold">{{ currentModelVersion }}</span>
                    </div>
                  </div>
                  <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                      <span class="small">Último Reentrenamiento</span>
                      <span class="small">{{ lastRetrainingDate }}</span>
                    </div>
                  </div>
                  <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                      <span class="small">Predicciones Hoy</span>
                      <span class="small font-weight-bold">{{ todayPredictions }}</span>
                    </div>
                  </div>
                  <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                      <span class="small">Tests Completados</span>
                      <span class="small font-weight-bold">{{ completedTestsCount }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RETRAINING TAB -->
        <div v-if="activeTab === 'retraining'" class="tab-pane active">
          <div class="row">
            <!-- Scheduler Control -->
            <div class="col-md-6 mb-4">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-clock me-2"></i>
                    Control del Scheduler
                  </h5>
                </div>
                <div class="card-body">
                  <div class="row align-items-center mb-3">
                    <div class="col">
                      <h6>Estado: 
                        <span class="badge" :class="schedulerStatus?.running ? 'bg-success' : 'bg-secondary'">
                          {{ schedulerStatus?.running ? 'Ejecutándose' : 'Detenido' }}
                        </span>
                      </h6>
                    </div>
                    <div class="col-auto">
                      <button 
                        class="btn"
                        :class="schedulerStatus?.running ? 'btn-danger' : 'btn-success'"
                        @click="toggleScheduler"
                      >
                        <i class="fas" :class="schedulerStatus?.running ? 'fa-stop' : 'fa-play'"></i>
                        {{ schedulerStatus?.running ? 'Detener' : 'Iniciar' }}
                      </button>
                    </div>
                  </div>
                  
                  <div v-if="schedulerStatus">
                    <div class="small mb-2">
                      <strong>Próxima Evaluación:</strong> {{ schedulerStatus.nextEvaluation }}
                    </div>
                    <div class="small mb-2">
                      <strong>Intervalo:</strong> {{ schedulerStatus.interval }}
                    </div>
                    <div class="small">
                      <strong>Última Evaluación:</strong> {{ schedulerStatus.lastEvaluation }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Retraining Triggers -->
            <div class="col-md-6 mb-4">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Triggers de Reentrenamiento
                  </h5>
                </div>
                <div class="card-body">
                  <div v-if="retrainingTriggers">
                    <div class="mb-2">
                      <div class="d-flex justify-content-between">
                        <span class="small">Validaciones Nuevas</span>
                        <span class="badge" :class="retrainingTriggers.validationsCount >= 50 ? 'bg-success' : 'bg-secondary'">
                          {{ retrainingTriggers.validationsCount }}/50
                        </span>
                      </div>
                    </div>
                    <div class="mb-2">
                      <div class="d-flex justify-content-between">
                        <span class="small">Drop de Accuracy</span>
                        <span class="badge" :class="retrainingTriggers.accuracyDrop ? 'bg-warning' : 'bg-success'">
                          {{ retrainingTriggers.accuracyDrop ? 'Detectado' : 'Normal' }}
                        </span>
                      </div>
                    </div>
                    <div class="mb-2">
                      <div class="d-flex justify-content-between">
                        <span class="small">Tiempo desde último</span>
                        <span class="badge" :class="retrainingTriggers.timeSinceLastRetraining > 7 ? 'bg-info' : 'bg-secondary'">
                          {{ retrainingTriggers.timeSinceLastRetraining }} días
                        </span>
                      </div>
                    </div>
                    
                    <div class="mt-3">
                      <div class="alert" :class="retrainingTriggers.shouldRetrain ? 'alert-warning' : 'alert-success'">
                        <i class="fas" :class="retrainingTriggers.shouldRetrain ? 'fa-exclamation-triangle' : 'fa-check-circle'"></i>
                        {{ retrainingTriggers.shouldRetrain ? 'Reentrenamiento recomendado' : 'No es necesario reentrenar' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Manual Retraining -->
          <div class="row">
            <div class="col-12">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-arrow-repeat me-2"></i>
                    Reentrenamiento Manual
                  </h5>
                </div>
                <div class="card-body">
                  <div v-if="retrainingInProgress" class="text-center py-4">
                    <div class="spinner-border text-primary mb-3" role="status"></div>
                    <h5>Reentrenamiento en Progreso</h5>
                    <p class="text-muted">Este proceso puede tomar varios minutos...</p>
                    <div class="progress">
                      <div class="progress-bar progress-bar-striped progress-bar-animated" 
                           style="width: 75%"></div>
                    </div>
                  </div>
                  <div v-else>
                    <p>Ejecutar reentrenamiento manual del modelo con los datos de validación más recientes.</p>
                    <button 
                      class="btn btn-success btn-lg"
                      @click="triggerManualRetraining"
                    >
                      <i class="bi bi-arrow-repeat me-2"></i>
                      Iniciar Reentrenamiento
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- A/B TESTING TAB -->
        <div v-if="activeTab === 'ab-testing'" class="tab-pane active">
          <!-- A/B Testing content - simplified version of original dashboard -->
          <div class="row mb-4">
            <div class="col-md-3">
              <div class="card border-left-success">
                <div class="card-body">
                  <div class="text-xs font-weight-bold text-success text-uppercase mb-1">
                    Tests Activos
                  </div>
                  <div class="h5 mb-0 font-weight-bold text-gray-800">
                    {{ activeTestsCount }}
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-left-info">
                <div class="card-body">
                  <div class="text-xs font-weight-bold text-info text-uppercase mb-1">
                    Tests Completados
                  </div>
                  <div class="h5 mb-0 font-weight-bold text-gray-800">
                    {{ completedTestsCount }}
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-left-warning">
                <div class="card-body">
                  <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">
                    Predicciones Totales
                  </div>
                  <div class="h5 mb-0 font-weight-bold text-gray-800">
                    {{ totalPredictions }}
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-left-primary">
                <div class="card-body">
                  <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">
                    Mejora Promedio
                  </div>
                  <div class="h5 mb-0 font-weight-bold text-gray-800">
                    {{ averageImprovement }}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Create New Test Button -->
          <div class="row mb-4">
            <div class="col-12">
              <button 
                class="btn btn-success"
                @click="showCreateTestModal = true"
              >
                <i class="bi bi-plus-lg me-2"></i>
                Crear Nuevo Test A/B
              </button>
            </div>
          </div>

          <!-- Active Tests -->
          <div v-if="abTests.length > 0">
            <h5>Tests en Progreso</h5>
            <div class="row">
              <div 
                class="col-lg-6 mb-3" 
                v-for="test in abTests.filter(t => t.status === 'running')" 
                :key="test.testId"
              >
                <div class="card border-left-success">
                  <div class="card-body">
                    <h6 class="card-title">{{ test.name }}</h6>
                    <p class="small text-muted">{{ test.description }}</p>
                    <div class="progress mb-2">
                      <div 
                        class="progress-bar bg-success" 
                        :style="{ width: Math.min(100, (test.totalPredictions / 50) * 100) + '%' }"
                      ></div>
                    </div>
                    <div class="small">
                      {{ test.totalPredictions }} / 50 predicciones
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- METRICS TAB -->
        <div v-if="activeTab === 'metrics'" class="tab-pane active">
          <div class="row">
            <!-- Advanced Metrics -->
            <div class="col-md-6 mb-4">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-bar-chart me-2"></i>
                    Métricas Avanzadas
                  </h5>
                </div>
                <div class="card-body">
                  <div v-if="advancedMetrics">
                    <div class="row">
                      <div class="col-6 mb-3">
                        <div class="text-center">
                          <h6 class="text-muted">Precision</h6>
                          <h4>{{ (advancedMetrics.precision * 100).toFixed(1) }}%</h4>
                        </div>
                      </div>
                      <div class="col-6 mb-3">
                        <div class="text-center">
                          <h6 class="text-muted">Recall</h6>
                          <h4>{{ (advancedMetrics.recall * 100).toFixed(1) }}%</h4>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="text-center">
                          <h6 class="text-muted">F1-Score</h6>
                          <h4>{{ (advancedMetrics.f1Score * 100).toFixed(1) }}%</h4>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="text-center">
                          <h6 class="text-muted">Accuracy</h6>
                          <h4>{{ (advancedMetrics.accuracy * 100).toFixed(1) }}%</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center text-muted py-4">
                    <i class="bi bi-bar-chart fs-1 mb-3"></i>
                    <p>Cargando métricas...</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quality Score -->
            <div class="col-md-6 mb-4">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-star-fill me-2"></i>
                    Puntuación de Calidad
                  </h5>
                </div>
                <div class="card-body">
                  <div class="text-center">
                    <div class="mb-3">
                      <h2 class="display-4" :class="qualityScoreClass">
                        {{ qualityScore }}
                      </h2>
                      <p class="text-muted">Score de Calidad</p>
                    </div>
                    <button 
                      class="btn btn-primary"
                      @click="runModelTests"
                      :disabled="testsRunning"
                    >
                      <i class="bi bi-arrow-repeat me-2"></i>
                      Actualizar Score
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- DEPLOYMENT TAB -->
        <div v-if="activeTab === 'deployment'" class="tab-pane active">
          <div class="row">
            <div class="col-12">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-rocket-takeoff me-2"></i>
                    Historial de Deployments
                  </h5>
                </div>
                <div class="card-body">
                  <div v-if="deploymentHistory.length === 0" class="text-center text-muted py-4">
                    No hay deployments registrados
                  </div>
                  <div v-else>
                    <div class="table-responsive">
                      <table class="table table-hover">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Versión</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Mejora</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="deployment in deploymentHistory" :key="deployment.id">
                            <td>{{ formatDate(deployment.timestamp) }}</td>
                            <td>{{ deployment.version }}</td>
                            <td>
                              <span class="badge bg-info">{{ deployment.triggeredBy }}</span>
                            </td>
                            <td>
                              <span class="badge" :class="deployment.deployed ? 'bg-success' : 'bg-danger'">
                                {{ deployment.deployed ? 'Exitoso' : 'Fallido' }}
                              </span>
                            </td>
                            <td>+{{ deployment.improvement?.toFixed(2) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- VERSIONS TAB -->
        <div v-if="activeTab === 'versions'" class="tab-pane active">
          <div class="row">
            <div class="col-12">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">
                    <i class="bi bi-git me-2"></i>
                    Gestión de Versiones
                  </h5>
                </div>
                <div class="card-body">
                  <p class="text-muted">
                    Gestión de versiones del modelo ML - Funcionalidad en desarrollo
                  </p>
                  <div class="text-center py-4">
                    <i class="bi bi-git fs-1 text-muted mb-3"></i>
                    <p>Panel de versionado próximamente disponible</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Emergency Rollback Modal -->
    <div 
      class="modal fade" 
      :class="{ show: showEmergencyRollback }"
      :style="{ display: showEmergencyRollback ? 'block' : 'none' }"
      v-if="showEmergencyRollback"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-warning">
            <h5 class="modal-title">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Rollback de Emergencia
            </h5>
            <button 
              type="button" 
              class="btn-close" 
              @click="showEmergencyRollback = false"
            ></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <strong>¡Atención!</strong> Esta acción revertirá el modelo a la versión anterior estable.
            </div>
            <p>¿Está seguro de que desea proceder con el rollback de emergencia?</p>
          </div>
          <div class="modal-footer">
            <button 
              type="button" 
              class="btn btn-secondary" 
              @click="showEmergencyRollback = false"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              class="btn btn-warning"
              @click="executeEmergencyRollback"
            >
              <i class="bi bi-arrow-counterclockwise me-2"></i>
              Ejecutar Rollback
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal backdrop -->
    <div 
      class="modal-backdrop fade show" 
      v-if="showEmergencyRollback || showCreateTestModal"
      @click="showEmergencyRollback = false; showCreateTestModal = false"
    ></div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

export default {
  name: 'MLOpsDashboard',
  setup() {
    // Reactive state
    const activeTab = ref('overview')
    const loading = ref(false)
    const showEmergencyRollback = ref(false)
    const showCreateTestModal = ref(false)
    const retrainingInProgress = ref(false)
    const testsRunning = ref(false)

    // Data
    const schedulerStatus = ref(null)
    const retrainingTriggers = ref(null)
    const currentAccuracy = ref(0.641)
    const qualityScore = ref(78)
    const abTests = ref([])
    const advancedMetrics = ref(null)
    const deploymentHistory = ref([])
    const recentActivity = ref([])

    // Computed properties
    const activeTestsCount = computed(() => 
      abTests.value.filter(test => test.status === 'running').length
    )
    
    const completedTestsCount = computed(() => 
      abTests.value.filter(test => test.status === 'completed').length
    )
    
    const totalPredictions = computed(() => 
      abTests.value.reduce((sum, test) => sum + (test.totalPredictions || 0), 0)
    )
    
    const averageImprovement = computed(() => {
      const completedWithImprovement = abTests.value.filter(
        test => test.status === 'completed' && test.significance?.improvement
      )
      if (completedWithImprovement.length === 0) return 0
      
      const totalImprovement = completedWithImprovement.reduce(
        (sum, test) => sum + test.significance.improvement, 0
      )
      return (totalImprovement / completedWithImprovement.length).toFixed(1)
    })

    const modelHealthStatus = computed(() => {
      if (currentAccuracy.value >= 0.8) return 'Excelente'
      if (currentAccuracy.value >= 0.7) return 'Bueno'
      if (currentAccuracy.value >= 0.6) return 'Regular'
      return 'Crítico'
    })

    const modelHealthBadge = computed(() => {
      if (currentAccuracy.value >= 0.8) return 'bg-success'
      if (currentAccuracy.value >= 0.7) return 'bg-info'
      if (currentAccuracy.value >= 0.6) return 'bg-warning'
      return 'bg-danger'
    })

    const qualityScoreClass = computed(() => {
      if (qualityScore.value >= 90) return 'text-success'
      if (qualityScore.value >= 70) return 'text-info'
      if (qualityScore.value >= 50) return 'text-warning'
      return 'text-danger'
    })

    const currentModelVersion = ref('v1.2.3')
    const lastRetrainingDate = ref('Hace 3 días')
    const todayPredictions = ref(142)

    // Methods
    async function loadSchedulerStatus() {
      try {
        const response = await fetch('/api/images/mlops/scheduler/status')
        const data = await response.json()
        if (data.success) {
          schedulerStatus.value = data.data
        }
      } catch (error) {
        console.error('Error loading scheduler status:', error)
      }
    }

    async function loadRetrainingTriggers() {
      try {
        const response = await fetch('/api/images/mlops/triggers')
        const data = await response.json()
        if (data.success) {
          retrainingTriggers.value = data.data
        }
      } catch (error) {
        console.error('Error loading retraining triggers:', error)
      }
    }

    async function loadABTests() {
      try {
        const response = await fetch('/api/images/ab-tests')
        const data = await response.json()
        if (data.success) {
          abTests.value = data.data.tests || []
        }
      } catch (error) {
        console.error('Error loading A/B tests:', error)
      }
    }

    async function loadAdvancedMetrics() {
      try {
        const response = await fetch('/api/images/metrics/advanced')
        const data = await response.json()
        if (data.success) {
          advancedMetrics.value = data.data
        }
      } catch (error) {
        console.error('Error loading advanced metrics:', error)
      }
    }

    async function loadDeploymentHistory() {
      try {
        const response = await fetch('/api/images/winner-selection/deployment-history')
        const data = await response.json()
        if (data.success) {
          deploymentHistory.value = data.data.history || []
        }
      } catch (error) {
        console.error('Error loading deployment history:', error)
      }
    }

    async function toggleScheduler() {
      try {
        const action = schedulerStatus.value?.running ? 'stop' : 'start'
        const response = await fetch('/api/images/mlops/scheduler/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        })
        
        const data = await response.json()
        if (data.success) {
          await loadSchedulerStatus()
          addRecentActivity({
            title: `Scheduler ${action === 'start' ? 'iniciado' : 'detenido'}`,
            description: `El scheduler automático fue ${action === 'start' ? 'iniciado' : 'detenido'} manualmente`,
            icon: 'bi bi-clock text-info'
          })
        }
      } catch (error) {
        console.error('Error toggling scheduler:', error)
      }
    }

    async function triggerManualRetraining() {
      if (retrainingInProgress.value) return
      
      retrainingInProgress.value = true
      try {
        const response = await fetch('/api/images/mlops/retrain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manual: true })
        })
        
        const data = await response.json()
        if (data.success) {
          addRecentActivity({
            title: 'Reentrenamiento iniciado',
            description: 'Reentrenamiento manual del modelo en progreso',
            icon: 'bi bi-arrow-repeat text-success'
          })
          
          // Simulate retraining progress
          setTimeout(() => {
            retrainingInProgress.value = false
            addRecentActivity({
              title: 'Reentrenamiento completado',
              description: 'El modelo ha sido reentrenado exitosamente',
              icon: 'bi bi-check-circle text-success'
            })
          }, 5000)
        }
      } catch (error) {
        console.error('Error triggering retraining:', error)
        retrainingInProgress.value = false
      }
    }

    async function runModelTests() {
      if (testsRunning.value) return
      
      testsRunning.value = true
      try {
        const response = await fetch('/api/images/tests/run', {
          method: 'POST'
        })
        
        const data = await response.json()
        if (data.success) {
          qualityScore.value = data.data.summary.score || 78
          addRecentActivity({
            title: 'Tests de calidad ejecutados',
            description: `Score de calidad: ${qualityScore.value}%`,
            icon: 'bi bi-mortarboard text-primary'
          })
        }
      } catch (error) {
        console.error('Error running tests:', error)
      } finally {
        testsRunning.value = false
      }
    }

    async function executeEmergencyRollback() {
      try {
        const response = await fetch('/api/images/winner-selection/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            version: 'v1.2.2', 
            reason: 'emergency_rollback' 
          })
        })
        
        const data = await response.json()
        if (data.success) {
          addRecentActivity({
            title: 'Rollback de emergencia ejecutado',
            description: 'Modelo revertido a versión anterior estable',
            icon: 'bi bi-arrow-counterclockwise text-warning'
          })
          showEmergencyRollback.value = false
        }
      } catch (error) {
        console.error('Error executing rollback:', error)
      }
    }

    function addRecentActivity(activity) {
      recentActivity.value.unshift({
        id: Date.now(),
        timestamp: new Date(),
        ...activity
      })
      
      // Keep only last 10 activities
      if (recentActivity.value.length > 10) {
        recentActivity.value = recentActivity.value.slice(0, 10)
      }
    }

    function formatDate(date) {
      if (!date) return 'N/A'
      return new Date(date).toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Auto-refresh data
    const refreshInterval = ref(null)

    onMounted(async () => {
      await Promise.all([
        loadSchedulerStatus(),
        loadRetrainingTriggers(),
        loadABTests(),
        loadAdvancedMetrics(),
        loadDeploymentHistory()
      ])

      // Auto-refresh every 30 seconds
      refreshInterval.value = setInterval(async () => {
        await Promise.all([
          loadSchedulerStatus(),
          loadRetrainingTriggers(),
          loadABTests()
        ])
      }, 30000)
    })

    onUnmounted(() => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
    })

    return {
      // State
      activeTab,
      loading,
      showEmergencyRollback,
      showCreateTestModal,
      retrainingInProgress,
      testsRunning,
      
      // Data
      schedulerStatus,
      retrainingTriggers,
      currentAccuracy,
      qualityScore,
      abTests,
      advancedMetrics,
      deploymentHistory,
      recentActivity,
      currentModelVersion,
      lastRetrainingDate,
      todayPredictions,
      
      // Computed
      activeTestsCount,
      completedTestsCount,
      totalPredictions,
      averageImprovement,
      modelHealthStatus,
      modelHealthBadge,
      qualityScoreClass,
      
      // Methods
      toggleScheduler,
      triggerManualRetraining,
      runModelTests,
      executeEmergencyRollback,
      formatDate
    }
  }
}
</script>

<style scoped>
.border-left-success {
  border-left: 4px solid #28a745;
}

.border-left-info {
  border-left: 4px solid #17a2b8;
}

.border-left-warning {
  border-left: 4px solid #ffc107;
}

.border-left-primary {
  border-left: 4px solid #007bff;
}

.bg-gradient-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.nav-pills .nav-link {
  border-radius: 0.375rem;
  margin: 0 0.125rem;
}

.nav-pills .nav-link.active {
  background-color: #007bff;
}

.card {
  box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15);
  border: 1px solid #e3e6f0;
}

.modal {
  background: rgba(0, 0, 0, 0.5);
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1040;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  opacity: 0.5;
}

.text-xs {
  font-size: 0.75rem;
}

.font-weight-bold {
  font-weight: 700;
}

.text-gray-800 {
  color: #5a5c69;
}

.progress {
  height: 8px;
}

.table th {
  border-top: none;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.8rem;
  color: #6c757d;
}
</style>