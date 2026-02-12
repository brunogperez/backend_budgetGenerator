import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload, ApiResponse } from '../types';
import User from '../models/User';
import { logger } from '../utils/logger';

/**
 * Middleware para verificar JWT token
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token de acceso requerido',
        error: {
          code: 'MISSING_TOKEN',
          details: 'Proporcione un token válido en el header Authorization'
        }
      });
      return;
    }

    // Extraer el token (remover "Bearer ")
    const token = authHeader.slice(7);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token de acceso inválido',
        error: {
          code: 'INVALID_TOKEN_FORMAT'
        }
      });
      return;
    }

    // Verificar JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET no está configurado');
      res.status(500).json({
        success: false,
        message: 'Error de configuración del servidor',
        error: {
          code: 'SERVER_CONFIGURATION_ERROR'
        }
      });
      return;
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    if (!decoded.id) {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: {
          code: 'INVALID_TOKEN_PAYLOAD'
        }
      });
      return;
    }

    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
        error: {
          code: 'USER_NOT_FOUND',
          details: 'El usuario asociado al token no existe'
        }
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Usuario inactivo',
        error: {
          code: 'USER_INACTIVE',
          details: 'La cuenta de usuario está deshabilitada'
        }
      });
      return;
    }

    // Agregar información del usuario al request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };

    // Continuar con el siguiente middleware
    next();

  } catch (error) {
    logger.error('Error en middleware de autenticación:', error);

    // Manejar diferentes tipos de errores de JWT
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expirado',
        error: {
          code: 'TOKEN_EXPIRED',
          details: 'El token ha expirado, por favor inicie sesión nuevamente'
        }
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: {
          code: 'INVALID_TOKEN',
          details: 'El token proporcionado no es válido'
        }
      });
      return;
    }

    if (error instanceof jwt.NotBeforeError) {
      res.status(401).json({
        success: false,
        message: 'Token no activo aún',
        error: {
          code: 'TOKEN_NOT_ACTIVE'
        }
      });
      return;
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: {
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
};

/**
 * Middleware para verificar rol de administrador
 */
export const adminMiddleware = (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Usuario no autenticado',
      error: {
        code: 'NOT_AUTHENTICATED'
      }
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Acceso denegado',
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        details: 'Se requieren permisos de administrador'
      }
    });
    return;
  }

  next();
};

/**
 * Middleware para verificar que el usuario puede acceder al recurso
 * (admin puede acceder a todo, seller solo a sus propios recursos)
 */
export const resourceOwnershipMiddleware = (resourceUserIdField: string = 'createdBy') => {
  return async (
    req: AuthRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
        error: {
          code: 'NOT_AUTHENTICATED'
        }
      });
      return;
    }

    // Los administradores pueden acceder a cualquier recurso
    if (req.user.role === 'admin') {
      next();
      return;
    }

    try {
      // Para sellers, verificar que el recurso les pertenece
      const resourceId = req.params.id;

      if (!resourceId) {
        res.status(400).json({
          success: false,
          message: 'ID de recurso requerido',
          error: {
            code: 'MISSING_RESOURCE_ID'
          }
        });
        return;
      }

      // Este middleware asume que el siguiente middleware o controlador
      // verificará la propiedad del recurso usando req.user.id
      // Por ahora, simplemente continúa
      next();

    } catch (error) {
      logger.error('Error en middleware de propiedad de recurso:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: {
          code: 'INTERNAL_SERVER_ERROR'
        }
      });
    }
  };
};

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 * Útil para endpoints que pueden funcionar con o sin autenticación
 */
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No hay token, continuar sin usuario
      next();
      return;
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || !token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      };
    }

    next();

  } catch (error) {
    // En middleware opcional, ignorar errores y continuar sin usuario
    next();
  }
};