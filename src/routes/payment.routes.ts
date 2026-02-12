import { Router } from 'express';
import * as paymentController from '../controllers/paymentController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import {
  createPaymentValidation,
  mongoIdValidation,
  paginationValidation,
  validate
} from '../middleware/validation.middleware';
import { query } from 'express-validator';

const router = Router();

/**
 * POST /payments/create
 * Crear orden de pago
 * Requiere autenticación
 */
router.post(
  '/create',
  authMiddleware,
  validate(createPaymentValidation),
  paymentController.createPayment
);

/**
 * POST /payments/webhook
 * Webhook para recibir notificaciones de MercadoPago
 * NO requiere autenticación (viene de MercadoPago)
 */
router.post('/webhook', paymentController.processWebhook);

/**
 * GET /payments/:paymentId/status
 * Obtener estado de un pago
 * Requiere autenticación
 */
router.get(
  '/:paymentId/status',
  authMiddleware,
  validate(mongoIdValidation('paymentId')),
  paymentController.getPaymentStatus
);

/**
 * GET /payments
 * Listar pagos con filtros
 * Requiere autenticación - solo admin
 */
router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  validate([
    ...paginationValidation,
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'cancelled'])
      .withMessage('El estado debe ser pending, approved, rejected o cancelled'),
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
  paymentController.getPayments
);

/**
 * GET /payments/stats
 * Obtener estadísticas de pagos
 * Requiere autenticación - solo admin
 */
router.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
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
  paymentController.getPaymentStats
);

/**
 * POST /payments/:paymentId/cancel
 * Cancelar un pago pendiente
 * Requiere autenticación
 */
router.post(
  '/:paymentId/cancel',
  authMiddleware,
  validate(mongoIdValidation('paymentId')),
  paymentController.cancelPayment
);

export default router;