import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface MongooseConnection {
  isConnected?: number;
}

const connection: MongooseConnection = {};

const connectDB = async (): Promise<void> => {
  try {
    // Si ya hay una conexión activa, no crear nueva
    if (connection.isConnected) {
      logger.info('MongoDB ya está conectado');
      return;
    }

    // Verificar que existe la URI de conexión
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }

    // Configuración de conexión optimizada
    const options = {
      maxPoolSize: 10, // Máximo 10 conexiones en el pool
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
      socketTimeoutMS: 45000, // Timeout del socket 45 segundos
      bufferCommands: false, // Deshabilitar mongoose buffering
    };

    // Conectar a MongoDB
    const db = await mongoose.connect(mongoUri, options);

    connection.isConnected = db.connections[0]?.readyState || 0;

    logger.info(`MongoDB conectado exitosamente: ${db.connection.host}`);

    // Event listeners para la conexión
    mongoose.connection.on('error', (error) => {
      logger.error('Error en conexión MongoDB:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB desconectado');
      connection.isConnected = 0;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconectado');
      connection.isConnected = 1;
    });

  } catch (error) {
    logger.error('Error conectando a MongoDB:', error);
    // Salir del proceso si no se puede conectar
    process.exit(1);
  }
};

// Función para cerrar la conexión gracefully
const disconnectDB = async (): Promise<void> => {
  try {
    if (connection.isConnected) {
      await mongoose.disconnect();
      connection.isConnected = 0;
      logger.info('MongoDB desconectado exitosamente');
    }
  } catch (error) {
    logger.error('Error desconectando de MongoDB:', error);
  }
};

// Manejo de señales para cerrar conexión
const handleExit = async (signal: string): Promise<void> => {
  logger.info(`Recibida señal ${signal}, cerrando servidor...`);
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

export { connectDB, disconnectDB };