import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  loginValidation,
  registerValidation,
  validate
} from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

/**
 * POST /auth/register
 * Registrar nuevo usuario
 */
router.post(
  '/register',
  validate(registerValidation),
  authController.register
);

/**
 * POST /auth/login
 * Iniciar sesión
 */
router.post(
  '/login',
  validate(loginValidation),
  authController.login
);

/**
 * GET /auth/me
 * Obtener información del usuario autenticado
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * PUT /auth/me
 * Actualizar información del usuario autenticado
 */
router.put(
  '/me',
  authMiddleware,
  validate([
    body('name')
      .optional()
      .notEmpty()
      .withMessage('El nombre no puede estar vacío')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Debe proporcionar un email válido')
      .normalizeEmail()
  ]),
  authController.updateMe
);

/**
 * PUT /auth/change-password
 * Cambiar contraseña del usuario autenticado
 */
router.put(
  '/change-password',
  authMiddleware,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('La contraseña actual es requerida'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('La nueva contraseña debe contener al menos una letra minúscula, una mayúscula y un número')
  ]),
  authController.changePassword
);

/**
 * POST /auth/refresh-token
 * Refrescar token JWT
 */
router.post('/refresh-token', authMiddleware, authController.refreshToken);

export default router;