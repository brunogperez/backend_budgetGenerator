import { Router } from 'express';
import * as quoteController from '../controllers/quoteController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import {
  createQuoteValidation,
  mongoIdValidation,
  quoteFiltersValidation,
  validate
} from '../middleware/validation.middleware';
import { query, param } from 'express-validator';

const router = Router();

/**
 * GET /quotes
 * Listar presupuestos con filtros y paginación
 * Requiere autenticación
 */
router.get(
  '/',
  authMiddleware,
  validate(quoteFiltersValidation),
  quoteController.getQuotes
);

/**
 * POST /quotes
 * Crear nuevo presupuesto
 * Requiere autenticación
 */
router.post(
  '/',
  authMiddleware,
  validate(createQuoteValidation),
  quoteController.createQuote
);

/**
 * GET /quotes/stats
 * Obtener estadísticas de presupuestos
 * Requiere autenticación
 */
router.get(
  '/stats',
  authMiddleware,
  validate([
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('dateFrom debe ser una fecha válida en formato ISO8601')
      .toDate(),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('dateTo debe ser una fecha válida en formato ISO8601')
      .toDate()
  ]),
  quoteController.getQuoteStats
);

/**
 * GET /quotes/expiring
 * Obtener presupuestos próximos a expirar
 * Requiere autenticación - solo admin
 */
router.get(
  '/expiring',
  authMiddleware,
  adminMiddleware,
  validate([
    query('days')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Los días deben ser un número entero positivo')
      .toInt()
  ]),
  quoteController.getExpiringQuotes
);

/**
 * POST /quotes/expire-old
 * Expirar presupuestos antiguos (tarea de mantenimiento)
 * Requiere autenticación - solo admin
 */
router.post(
  '/expire-old',
  authMiddleware,
  adminMiddleware,
  quoteController.expireOldQuotes
);

/**
 * GET /quotes/customer/:email
 * Obtener presupuestos por email del cliente
 * Requiere autenticación
 */
router.get(
  '/customer/:email',
  authMiddleware,
  validate([
    param('email')
      .isEmail()
      .withMessage('Debe proporcionar un email válido')
      .normalizeEmail()
  ]),
  quoteController.getQuotesByCustomerEmail
);

/**
 * GET /quotes/:id
 * Obtener presupuesto por ID
 * Requiere autenticación
 */
router.get(
  '/:id',
  authMiddleware,
  validate(mongoIdValidation()),
  quoteController.getQuoteById
);

/**
 * PUT /quotes/:id/cancel
 * Cancelar presupuesto
 * Requiere autenticación
 */
router.put(
  '/:id/cancel',
  authMiddleware,
  validate(mongoIdValidation()),
  quoteController.cancelQuote
);

export default router;