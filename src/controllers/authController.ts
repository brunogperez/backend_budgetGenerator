import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, LoginRequest, RegisterRequest, JWTPayload } from '../types';
import User from '../models/User';
import { asyncHandler } from '../middleware/error.middleware';
import { successResponse, errorResponse, createdResponse, badRequestResponse } from '../utils/responses';
import { logger } from '../utils/logger';

/**
 * Generar JWT token
 */
const generateToken = (payload: JWTPayload): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está configurado');
  }

  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  } as jwt.SignOptions);
};

/**
 * POST /auth/register
 * Registrar nuevo usuario
 */
export const register = asyncHandler(async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  const { email, password, name, role } = req.body;

  try {
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      badRequestResponse(res, 'Ya existe un usuario con este email');
      return;
    }

    // Crear nuevo usuario
    const user = new User({
      email,
      password,
      name,
      role: role || 'seller'
    });

    await user.save();

    // Generar token JWT
    const tokenPayload: JWTPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    logger.info(`Usuario registrado exitosamente: ${email}`);

    // Responder con usuario (sin contraseña) y token
    createdResponse(res, {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      token
    }, 'Usuario registrado exitosamente');

  } catch (error) {
    logger.error('Error registrando usuario:', error);
    throw error;
  }
});

/**
 * POST /auth/login
 * Iniciar sesión
 */
export const login = asyncHandler(async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    // Buscar usuario por email (incluyendo la contraseña)
    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (!user) {
      badRequestResponse(res, 'Credenciales inválidas');
      return;
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn(`Intento de login fallido para: ${email}`, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      badRequestResponse(res, 'Credenciales inválidas');
      return;
    }

    // Generar token JWT
    const tokenPayload: JWTPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    logger.info(`Usuario logueado exitosamente: ${email}`);

    // Responder con usuario (sin contraseña) y token
    successResponse(res, {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      token
    }, 'Login exitoso');

  } catch (error) {
    logger.error('Error en login:', error);
    throw error;
  }
});

/**
 * GET /auth/me
 * Obtener información del usuario autenticado
 */
export const getMe = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      errorResponse(res, 'Usuario no autenticado', 401, 'NOT_AUTHENTICATED');
      return;
    }

    // Buscar usuario completo en la base de datos
    const user = await User.findById(req.user.id);

    if (!user) {
      errorResponse(res, 'Usuario no encontrado', 404, 'USER_NOT_FOUND');
      return;
    }

    successResponse(res, {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 'Información del usuario obtenida exitosamente');

  } catch (error) {
    logger.error('Error obteniendo información del usuario:', error);
    throw error;
  }
});

/**
 * PUT /auth/me
 * Actualizar información del usuario autenticado
 */
export const updateMe = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      errorResponse(res, 'Usuario no autenticado', 401, 'NOT_AUTHENTICATED');
      return;
    }

    const { name, email } = req.body;
    const allowedUpdates = { name, email };

    // Remover campos undefined
    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key as keyof typeof allowedUpdates] === undefined) {
        delete allowedUpdates[key as keyof typeof allowedUpdates];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      allowedUpdates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      errorResponse(res, 'Usuario no encontrado', 404, 'USER_NOT_FOUND');
      return;
    }

    logger.info(`Usuario actualizado: ${user.email}`);

    successResponse(res, {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 'Información actualizada exitosamente');

  } catch (error) {
    logger.error('Error actualizando usuario:', error);
    throw error;
  }
});

/**
 * PUT /auth/change-password
 * Cambiar contraseña del usuario autenticado
 */
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      errorResponse(res, 'Usuario no autenticado', 401, 'NOT_AUTHENTICATED');
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Buscar usuario con contraseña
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      errorResponse(res, 'Usuario no encontrado', 404, 'USER_NOT_FOUND');
      return;
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      badRequestResponse(res, 'Contraseña actual incorrecta');
      return;
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    logger.info(`Contraseña cambiada para usuario: ${user.email}`);

    successResponse(res, null, 'Contraseña actualizada exitosamente');

  } catch (error) {
    logger.error('Error cambiando contraseña:', error);
    throw error;
  }
});

/**
 * POST /auth/refresh-token
 * Refrescar token JWT
 */
export const refreshToken = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      errorResponse(res, 'Usuario no autenticado', 401, 'NOT_AUTHENTICATED');
      return;
    }

    // Verificar que el usuario aún existe y está activo
    const user = await User.findById(req.user.id);

    if (!user || !user.isActive) {
      errorResponse(res, 'Usuario no encontrado o inactivo', 401, 'USER_NOT_FOUND_OR_INACTIVE');
      return;
    }

    // Generar nuevo token
    const tokenPayload: JWTPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    successResponse(res, { token }, 'Token refrescado exitosamente');

  } catch (error) {
    logger.error('Error refrescando token:', error);
    throw error;
  }
});