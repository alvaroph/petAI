# 🐕 PetAI - Clasificador Educativo de Mascotas

## Descripción del Proyecto

PetAI es una aplicación web educativa que utiliza inteligencia artificial para clasificar mascotas, específicamente perros y gatos. El proyecto está diseñado como herramienta educativa para estudiantes de informática e ingeniería que aprenden machine learning, computer vision, MLOps y desarrollo web moderno. Incluye un dashboard completo de MLOps con A/B testing, deployment automatizado, métricas avanzadas y **sistema dual de modelos (servidor vs. local TensorFlow Lite)**.

## Estado del Proyecto - FASE 6 COMPLETADA ✅

> 📊 **Ver progreso detallado:** [PROGRESO_PROYECTO.md](./PROGRESO_PROYECTO.md)

### ✅ Implementado en Fase 1:
- **Backend Express.js** con estructura básica
- **Middleware de seguridad** (CORS, Helmet, Rate limiting)
- **Sistema de logging** completo con Winston
- **Estructura de directorios** para gestión de imágenes
- **Frontend Vue 3** con Composition API explícito
- **Bootstrap 5** integrado con diseño responsive
- **Layout base** con header navegacional y footer
- **Paleta de colores temática** (verdes bosque y naranjas mascota)

### ✅ Implementado en Fase 2:
- **Sistema de captura de imágenes** con acceso nativo a cámara
- **Componentes Vue** especializados (CameraCapture, ImagePreview)
- **Composables reutilizables** (useCamera, useImageUpload)
- **Upload de imágenes** con Multer y validación completa
- **Manejo de errores** y permisos de cámara
- **Preferencia por cámara trasera** en dispositivos móviles
- **API endpoints** para subida y gestión de imágenes
- **Flujo completo** de captura → preview → análisis (simulado)
- **Sistema de metadata** JSON para cada imagen

### ✅ Implementado en Fase 3:
- **TensorFlow.js** integrado en frontend y backend
- **Modelo CNN** para clasificación binaria de mascotas (perros/gatos)
- **Arquitectura educativa** con capas convolucionales y densas
- **Preprocesamiento de imágenes** con Sharp y TensorFlow.js
- **API endpoints ML** (/api/images/predict, /api/images/model/info)
- **Composable useMachineLearning** para integración Vue
- **Componente MLPredictionResult** con visualización rica
- **Predicciones en tiempo real** con niveles de confianza
- **Sistema de recomendaciones** basado en resultados ML
- **Logging especializado** para operaciones de machine learning
- **Upload de archivos** además de captura con cámara

### ✅ Implementado en Fase 4:
- **Sistema de validación por usuario** - Feedback directo después de predicción
- **Componente UserValidation.vue** - UX para confirmar/corregir predicciones IA
- **API de validación** (/api/images/validate) con storage organizado
- **Sistema de métricas automático** - Tracking accuracy usuario vs IA
- **Endpoints de métricas** (/api/images/metrics) para análisis de performance
- **Preparación para reentrenamiento** - Scripts para generar datasets mejorados
- **Storage clasificado** - validated/ y training_corrections/ para MLOps

### ✅ Implementado en Fase 5:
- **MLOps Pipeline Completo** - Reentrenamiento automático con scheduler
- **Sistema de Versionado** - Control de versiones del modelo con rollback
- **Métricas Avanzadas** - Precision, Recall, F1-Score, matriz de confusión
- **Triggers Inteligentes** - Reentrenamiento basado en accuracy drop y validaciones
- **Deployment Automático** - Estrategias de deployment con validación
- **Monitoreo Continuo** - Performance tracking y alertas automáticas

### ✅ Implementado en Fase 6:
- **Dashboard MLOps Unificado** - Interfaz completa con 6 tabs funcionales
- **A/B Testing Científico** - Comparación estadística de modelos con significance testing
- **Winner Selection Automático** - Deployment inteligente con múltiples estrategias
- **Suite de Tests Automatizados** - Calidad del modelo con 10+ tests específicos
- **Gestión de Reentrenamiento** - Control completo del scheduler y triggers
- **Métricas en Tiempo Real** - Dashboard con auto-refresh y métricas avanzadas
- **Sistema Dual de Modelos** - Selector entre Backend (servidor) vs Local (TensorFlow Lite)
- **Optimización Edge Computing** - Modelos optimizados y quantizados para inferencia local
- **Interfaz Modernizada 2025** - Header actualizado con diseño moderno y Bootstrap Icons
- **Codificación UTF-8** - Corrección completa de problemas de caracteres

### 🔄 Próximas Fases:
- **Fase 7:** Expansión multiclase y transfer learning
- **Fase 8:** Optimización móvil y PWA features

## Estructura del Proyecto

```
petai/
├── frontend/                 # Aplicación Vue 3
│   ├── src/
│   │   ├── App.vue          # Componente principal con Composition API
│   │   ├── main.js          # Bootstrap + configuración inicial
│   │   ├── views/           # Vistas principales
│   │   │   ├── HomeView.vue     # Vista principal con captura y análisis
│   │   │   └── MLOpsView.vue    # Vista del dashboard MLOps unificado
│   │   ├── components/      # Componentes reutilizables
│   │   │   ├── FileUpload.vue        # Upload de archivos
│   │   │   ├── MLPredictionResult.vue # Resultados ML
│   │   │   ├── MLOpsDashboard.vue     # Dashboard completo MLOps
│   │   │   └── UserValidation.vue     # Validación por usuario
│   │   ├── composables/     # Composables Vue 3
│   │   │   ├── useMachineLearning.js  # ML y predicciones
│   │   │   ├── useCamera.js           # Captura de cámara
│   │   │   ├── useImageUpload.js      # Upload de imágenes
│   │   │   └── useMLOps.js            # Gestión completa MLOps
│   │   └── router/          # Configuración de rutas
│   └── package.json         # Bootstrap 5, Pinia, Vue Router, TensorFlow.js
│
├── backend/                  # Servidor Express.js
│   ├── server.js            # Servidor principal con middleware y scheduler
│   ├── models/              # Modelos de Machine Learning
│   │   └── PetClassifier.js     # Clasificador CNN con TensorFlow.js
│   ├── routes/
│   │   └── images.js        # API endpoints (60+ endponts MLOps)
│   ├── services/            # Servicios MLOps
│   │   ├── retrainingScheduler.js   # Scheduler automático
│   │   ├── abTestingService.js      # A/B testing estadístico
│   │   └── winnerSelectionService.js # Deployment automático
│   ├── utils/
│   │   ├── logger.js        # Sistema de logging con Winston
│   │   ├── fileManager.js   # Gestión de archivos e imágenes
│   │   ├── modelVersioning.js       # Versionado de modelos
│   │   ├── advancedMetrics.js       # Métricas avanzadas (Precision/Recall/F1)
│   │   └── mlopsMonitor.js          # Monitoreo MLOps
│   ├── scripts/             # Scripts de automatización
│   │   ├── retrainModel.js          # Pipeline de reentrenamiento
│   │   └── runModelTests.js         # Ejecutor de tests
│   ├── tests/               # Tests automatizados
│   │   └── mlModelTests.js          # Suite completa de tests ML
│   ├── storage/             # Directorios de almacenamiento
│   │   ├── images/          # Imágenes organizadas por estado
│   │   ├── models/          # Modelos ML guardados y versionados
│   │   └── backups/         # Respaldos automáticos
│   └── logs/                # Archivos de log
│
└── README.md                # Este archivo
```

## Tecnologías Utilizadas

### Frontend:
- **Vue 3** con Composition API (sin `<script setup>`)
- **TensorFlow.js** para inferencia ML en el navegador
- **Pinia** para gestión de estado
- **Vue Router 4** para navegación
- **Bootstrap 5** para diseño responsive
- **Bootstrap Icons** y **Font Awesome** para iconografía
- **Vite** como build tool

### Backend:
- **Node.js** con **Express.js**
- **TensorFlow.js Node** para ML en servidor
- **Sharp** para procesamiento de imágenes
- **Winston** para logging estructurado (con logs ML especializados)
- **Helmet** para seguridad HTTP
- **CORS** configurado para desarrollo y producción
- **Express Rate Limit** para prevenir abuso
- **Multer** para upload de archivos
- **ES6 Modules** (type: "module")
- **Cron** para scheduling automático

### MLOps Stack:
- **Automated Retraining** con trigger-based scheduling
- **Model Versioning** con rollback automático
- **A/B Testing** con statistical significance
- **Advanced Metrics** (Precision, Recall, F1-Score)
- **Deployment Strategies** (Replace, Canary, Blue-Green)
- **Quality Assurance** con suite de tests automatizados

## Instalación y Configuración

### Prerrequisitos:
- Node.js 18+ 
- npm 9+

### Backend:
```bash
cd backend
npm install
npm run dev    # Servidor en puerto 3001

# Comandos adicionales:
npm run convert-tflite  # Generar modelos optimizados para frontend
npm run run-tests       # Ejecutar tests de calidad del modelo
```

### Frontend:
```bash
cd frontend
npm install
npm run dev    # Aplicación en puerto 5173
```

### Acceso al Dashboard MLOps:
Una vez iniciado el proyecto, accede a:
- **Aplicación principal:** http://localhost:5173
- **Dashboard MLOps:** http://localhost:5173/mlops
- **API Health Check:** http://localhost:3001/api/health

## Características Educativas

### JavaScript ES5 Compatible:
- Uso de `var` en lugar de `let/const` cuando es didáctico
- Funciones tradicionales en lugar de arrow functions
- Composition API explícito sin `<script setup>`
- Comentarios abundantes explicando decisiones técnicas

### Arquitectura Didáctica:
- Separación clara de responsabilidades
- Patrones simples sin sobre-ingeniería
- Código legible y bien documentado
- Progresión incremental en complejidad

## Paleta de Colores Temática

```css
/* Colores principales */
--pet-primary: #2E7D32      /* Verde bosque */
--pet-primary-dark: #1B5E20  /* Verde más oscuro */
--pet-secondary: #FF8F00     /* Naranja mascota */
--pet-secondary-dark: #E65100 /* Naranja oscuro */

/* Colores de estado */
--pet-success: #4CAF50       /* Verde para alta confianza */
--pet-warning: #FF9800       /* Naranja para confianza media */
--pet-error: #F44336         /* Rojo para baja confianza */
```

## API Endpoints (Fases 1-6)

```
# Sistema básico
GET  /api/health              # Health check del sistema
POST /api/images/upload       # Subir imagen para análisis o validación
GET  /api/images/:imageId     # Obtener información de imagen específica
GET  /api/images/pending/list # Listar imágenes pendientes de validación
GET  /api/images/stats/summary # Estadísticas básicas del sistema

# Machine Learning - FASE 3
POST /api/images/predict      # Predecir imagen con modelo ML
GET  /api/images/model/info   # Información del modelo cargado

# Validación por Usuario - FASE 4
POST /api/images/validate     # Validar predicción con feedback de usuario
GET  /api/images/metrics      # Métricas de accuracy usuario vs IA
GET  /api/images/metrics/detailed # Métricas detalladas para análisis

# MLOps y Reentrenamiento - FASE 5
GET  /api/images/mlops/triggers           # Evaluar triggers de reentrenamiento
GET  /api/images/mlops/scheduler/status   # Estado del scheduler automático
POST /api/images/mlops/scheduler/control  # Iniciar/detener scheduler
POST /api/images/mlops/retrain           # Reentrenamiento manual
GET  /api/images/mlops/statistics        # Estadísticas MLOps
GET  /api/images/metrics/advanced         # Precision, Recall, F1-Score
GET  /api/images/metrics/confusion-matrix # Matriz de confusión
GET  /api/images/versions                # Lista de versiones del modelo
POST /api/images/versions/:version/deploy # Desplegar versión específica
POST /api/images/versions/rollback      # Rollback automático

# A/B Testing y Deployment - FASE 6
POST /api/images/ab-tests                    # Crear test A/B con configuración
GET  /api/images/ab-tests                    # Listar tests con métricas estadísticas
GET  /api/images/ab-tests/:testId            # Resultados detallados con significance
POST /api/images/ab-tests/:testId/stop       # Detener test manualmente
GET  /api/images/winner-selection/:testId/evaluate      # Evaluar test para deployment
POST /api/images/winner-selection/:testId/auto-deploy   # Deployment automático
GET  /api/images/winner-selection/deployment-history    # Historial de deployments
POST /api/images/tests/run                              # Ejecutar suite de tests
GET  /api/images/tests/quality-metrics                  # Métricas de calidad del modelo
```

## Logs del Sistema

El sistema genera logs estructurados en:
- `logs/error.log` - Solo errores
- `logs/combined.log` - Todos los logs
- Consola en desarrollo

Tipos de logs especializados:
- `logger.mlLog()` - Logs de machine learning
- `logger.expertLog()` - Logs de validación de expertos  
- `logger.systemLog()` - Logs de sistema por componente

## Estructura de Directorios de Almacenamiento

```
storage/
├── images/
│   ├── pending/              # Imágenes esperando validación
│   ├── validated/
│   │   ├── dogs/             # Confirmados como perros
│   │   └── cats/             # Confirmados como gatos
│   ├── rejected/             # Rechazados por calidad o dudas
│   └── training/             # Dataset preparado para reentrenamiento
├── models/                   # Versiones del modelo ML
│   ├── current/              # Modelo en producción
│   ├── v1.0/                 # Versión 1.0
│   ├── v1.1/                 # Versión 1.1
│   └── candidates/           # Modelos candidatos A/B testing
└── backups/                  # Respaldos automáticos
    ├── daily/                # Respaldos diarios
    └── pre-deployment/       # Respaldos pre-deployment
```

## 🤖 Sistema Dual de Modelos (Nuevo en 2025)

El proyecto implementa un **sistema educativo único** que permite comparar diferentes estrategias de deployment de modelos ML:

### **📊 Opciones de Inferencia:**

#### 🌐 **Modelo Backend (Servidor)**
- **Ubicación**: Ejecutado en servidor Node.js
- **Tamaño**: 42.61 MB (11M parámetros)
- **Precisión**: ~85% (máxima disponible)
- **Velocidad**: Media (requiere red)
- **Casos de uso**: Máxima precisión, datos sensibles, procesamiento batch

#### 💻 **Modelo Optimizado (Local)**
- **Ubicación**: TensorFlow.js en navegador
- **Tamaño**: 0.05 MB (14K parámetros)
- **Precisión**: ~80% (optimizado)
- **Velocidad**: Rápida (sin latencia de red)
- **Casos de uso**: Tiempo real, privacidad, conexiones limitadas

#### 📱 **Modelo Quantizado (TFLite-style)**
- **Ubicación**: TensorFlow.js quantizado
- **Tamaño**: 0.01 MB (4K parámetros)
- **Precisión**: ~75% (ultra-ligero)
- **Velocidad**: Muy rápida (ideal móviles)
- **Casos de uso**: Edge computing, IoT, dispositivos con recursos limitados

### **🎯 Valor Educativo:**
- **Comparación en tiempo real** de rendimiento entre modelos
- **Trade-offs** entre tamaño, velocidad y precisión
- **Estrategias de deployment** para diferentes escenarios
- **Edge computing vs cloud computing** en ML production

### **🛠️ Uso del Selector:**
1. **Selecciona el tipo de modelo** en la interfaz principal
2. **Captura o sube una imagen** de mascota
3. **Compara resultados** y tiempos de ejecución
4. **Analiza métricas** de rendimiento en tiempo real

## Dashboard MLOps

El proyecto incluye un dashboard completo de MLOps accesible en `/mlops` con:

### 📊 Tab Overview
- Estado general del sistema ML en tiempo real
- Health check del modelo con indicadores de color
- Métricas clave y actividad reciente
- Resumen ejecutivo con estadísticas

### 🔄 Tab Retraining
- Control del scheduler automático (start/stop/status)
- Visualización de triggers con semáforos
- Reentrenamiento manual con progress tracking
- Configuración de umbrales y parámetros

### 🧪 Tab A/B Testing
- Gestión de tests A/B con significance testing
- Estadísticas de performance comparativa
- Monitoreo de confidence intervals
- Creación y gestión de experimentos

### 📈 Tab Metrics
- Precision, Recall, F1-Score en tiempo real
- Score de calidad del modelo
- Matriz de confusión visualizable
- Análisis de falsos positivos/negativos

### 🚀 Tab Deployment
- Historial completo de deployments
- Información de versiones y mejoras
- Rollback automático y manual
- Estrategias de deployment (Replace, Canary, Blue-Green)

### 📋 Tab Versions
- Gestión de versiones del modelo
- Comparación entre versiones
- Deployment de versiones específicas
- Limpieza automática de versiones antiguas

## Contribución

Este es un proyecto educativo. Las contribuciones deben mantener:
1. **Simplicidad didáctica** por encima de optimización avanzada
2. **Comentarios abundantes** explicando el "por qué"
3. **JavaScript ES5 compatible** donde sea apropiado
4. **Composition API explícito** en Vue 3

## Licencia

MIT - Proyecto Educativo

---

## MLOps Features Destacadas

### 🤖 **Reentrenamiento Automático**
- Scheduler que evalúa triggers cada 30 minutos
- Basado en accuracy drop, validaciones de usuario y tiempo
- Pipeline completo con backup automático

### 🧪 **A/B Testing Científico**
- Statistical significance testing (z-test, p-values)
- Traffic splitting estratificado
- Auto-conclusión basada en criterios estadísticos

### 📊 **Métricas Avanzadas**
- Precision, Recall, F1-Score por clase
- Matriz de confusión completa
- Análisis automático de errores
- Métricas macro y weighted average

### 🚀 **Deployment Inteligente**
- Winner selection automático
- Múltiples estrategias de deployment
- Rollback automático en caso de degradación
- Validación de mejoras antes de deployment

### 🔬 **Quality Assurance**
- Suite de 10+ tests automatizados
- Tests de loading, accuracy, speed, validation, memory
- Score de calidad en tiempo real
- Integración con CI/CD pipeline

---

**⚠️ Aviso Importante:** Este proyecto es solo para fines educativos. La clasificación de mascotas puede tener variaciones y este software no debe usarse como única fuente para determinar la raza o características específicas de una mascota. Siempre consulte con veterinarios profesionales para diagnósticos y cuidados específicos.

**🎓 Valor Educativo:** Este proyecto demuestra conceptos avanzados de ML Engineering que son directamente aplicables en entornos profesionales, incluyendo MLOps, automated retraining, A/B testing científico, y deployment strategies.