import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { initializeMercadoPago } from './config/mercadopago';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Importar rutas
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import quoteRoutes from './routes/quote.routes';
import paymentRoutes from './routes/payment.routes';

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();

// Configuración del puerto
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Desactivar COEP para compatibilidad
}));

// CORS - Configurar según el entorno
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL?.split(',') || []
    : [
        'http://localhost:3000',
        'http://localhost:19006',
        'exp://localhost:19000',
        'http://localhost:8081',
        // Para emulador Android
        'http://10.0.2.2:3000',
        'http://10.0.2.2:19006',
        'http://10.0.2.2:8081',
        // Para dispositivos físicos o red local
        'http://192.168.1.39:3000',
        'http://192.168.1.39:8081',
        'http://192.168.1.39:19006'
      ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Límite de requests por ventana
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intente nuevamente más tarde',
    error: {
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por ventana
  message: {
    success: false,
    message: 'Demasiados intentos de login, intente nuevamente en 15 minutos',
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    }
  },
  skipSuccessfulRequests: true, // No contar requests exitosos
});

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requests en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor funcionando correctamente',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/payments', paymentRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API de Generador de Presupuestos',
    data: {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// Middleware de manejo de errores (debe ir al final)
app.use(notFoundHandler);
app.use(errorHandler);

// Función para iniciar el servidor
const startServer = async (): Promise<void> => {
  try {
    // Conectar a MongoDB
    await connectDB();

    // Inicializar MercadoPago
    await initializeMercadoPago();

    // Iniciar servidor
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
    logger.info(`📍 URL: http://0.0.0.0:${PORT}`);
    logger.info(`🔗 Localhost: http://localhost:${PORT}`);
    logger.info(`📱 Android Emulator: http://10.0.2.2:${PORT}`);
    logger.info(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📋 Health check: http://localhost:${PORT}/health`);
  });

    // Manejo de señales para cierre graceful
    const gracefulShutdown = (signal: string) => {
      logger.info(`📯 Recibida señal ${signal}, cerrando servidor gracefully...`);

      server.close((err) => {
        if (err) {
          logger.error('Error cerrando servidor:', err);
          process.exit(1);
        }

        logger.info('✅ Servidor cerrado exitosamente');
        process.exit(0);
      });

      // Forzar cierre después de 30 segundos
      setTimeout(() => {
        logger.error('❌ Forzando cierre del servidor');
        process.exit(1);
      }, 30000);
    };

    // Event listeners para señales
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejo de errores no capturados
    process.on('uncaughtException', (error) => {
      logger.error('Excepción no capturada:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promesa rechazada no manejada:', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Error iniciando servidor:', error);
    process.exit(1);
  }
};

// Iniciar el servidor
if (require.main === module) {
  startServer();
}

export { app, startServer };