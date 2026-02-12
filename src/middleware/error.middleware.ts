import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Interface para errores personalizados
 */
interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  code?: string | number;
  errors?: any[];
}

/**
 * Middleware global de manejo de errores
 * Debe ser el último middleware en la aplicación
 */
export const errorHandler: ErrorRequestHandler = (
  error: CustomError,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  let statusCode = error.status || error.statusCode || 500;
  let message = error.message || 'Error interno del servidor';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let details: any = null;

  // Log del error completo
  logger.error('Error capturado:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Manejar diferentes tipos de errores

  // Errores de Mongoose - Validación
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Error de validación de datos';
    errorCode = 'VALIDATION_ERROR';
    details = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  }

  // Errores de Mongoose - Documento no encontrado
  else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'ID inválido';
    errorCode = 'INVALID_ID';
    details = {
      field: (error as any).path,
      value: (error as any).value
    };
  }

  // Errores de Mongoose - Clave duplicada
  else if (error.code === 11000) {
    statusCode = 400;
    message = 'Recurso duplicado';
    errorCode = 'DUPLICATE_RESOURCE';

    // Extraer el campo duplicado
    const field = Object.keys((error as any).keyValue || {})[0];
    const value = field ? (error as any).keyValue?.[field] : undefined;

    details = {
      field,
      value,
      message: `Ya existe un registro con ${field}: ${value}`
    };
  }

  // Errores de JWT
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
    errorCode = 'INVALID_TOKEN';
  }

  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Errores de sintaxis JSON
  else if (error.name === 'SyntaxError' && 'body' in error) {
    statusCode = 400;
    message = 'JSON inválido en el cuerpo de la petición';
    errorCode = 'INVALID_JSON';
  }

  // Error de límite de tamaño de archivo
  else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'El archivo excede el tamaño máximo permitido';
    errorCode = 'FILE_TOO_LARGE';
  }

  // Errores personalizados de la aplicación
  else if (error.status || error.statusCode) {
    statusCode = error.status || error.statusCode || 500;
    errorCode = error.code?.toString() || 'APPLICATION_ERROR';
    // Mantener el mensaje original para errores personalizados
  }

  // Errores de conexión a base de datos
  else if (error.name === 'MongooseServerSelectionError') {
    statusCode = 503;
    message = 'Error de conexión a la base de datos';
    errorCode = 'DATABASE_CONNECTION_ERROR';
  }

  // No exponer información sensible en producción
  if (process.env.NODE_ENV === 'production') {
    // En producción, ocultar detalles de errores internos
    if (statusCode === 500) {
      message = 'Error interno del servidor';
      details = null;
    }
    // No incluir stack trace en producción
  } else {
    // En desarrollo, incluir más información
    if (statusCode === 500) {
      details = {
        stack: error.stack,
        name: error.name
      };
    }
  }

  // Responder con el error
  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: errorCode,
      ...(details && { details })
    }
  });
};

/**
 * Middleware para manejar rutas no encontradas (404)
 */
export const notFoundHandler = (
  req: Request,
  res: Response<ApiResponse>
): void => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.url}`,
    error: {
      code: 'ROUTE_NOT_FOUND',
      details: {
        method: req.method,
        path: req.url
      }
    }
  });
};

/**
 * Función helper para crear errores personalizados
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): CustomError => {
  const error: CustomError = new Error(message);
  error.status = statusCode;
  if (code !== undefined) {
    error.code = code;
  }

  if (details) {
    error.errors = [details];
  }

  return error;
};

/**
 * Wrapper para funciones async que automatiza el manejo de errores
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};