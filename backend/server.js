import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import { initializeDirectoryStructure } from './utils/fileManager.js';
import retrainingScheduler from './services/retrainingScheduler.js';

var app = express();
var PORT = process.env.PORT || 3001;

// Configuración de rate limiting
var limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de seguridad
app.use(helmet());
app.use(limiter);

// Configuración CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://rovellonai.com'] 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Parseo de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar headers UTF-8 para todas las respuestas
app.use((req, res, next) => {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  next();
});

// Logging de todas las requests
app.use(function(req, res, next) {
  logger.info('Request: ' + req.method + ' ' + req.path + ' from ' + req.ip);
  next();
});

// Health check endpoint
app.get('/api/health', function(req, res) {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rutas principales
import imagesRouter from './routes/images.js';
app.use('/api/images', imagesRouter);

// Rutas para siguientes fases
// app.use('/api/validation', require('./routes/validation.js'));
// app.use('/api/admin', require('./routes/admin.js'));

// Manejo de errores 404
app.use(function(req, res) {
  logger.warn('404 - Ruta no encontrada: ' + req.path);
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores generales
app.use(function(err, req, res, next) {
  logger.error('Error en servidor: ' + err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Inicializar estructura de directorios
initializeDirectoryStructure();

// Iniciar servidor
app.listen(PORT, function() {
  logger.info('Servidor PetAI iniciado en puerto ' + PORT);
  logger.info('Entorno: ' + (process.env.NODE_ENV || 'development'));
  
  // Iniciar scheduler de reentrenamiento (Fase 5: MLOps)
  setTimeout(function() {
    try {
      retrainingScheduler.start();
      logger.systemLog('MLOPS', '🤖 Sistema de reentrenamiento automático iniciado');
    } catch (error) {
      logger.error('Error iniciando scheduler de reentrenamiento: ' + error.message);
    }
  }, 5000); // Esperar 5 segundos para que el servidor esté completamente inicializado
});

export default app;