import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import Payment from '../models/Payment';
import Quote from '../models/Quote';
import { asyncHandler } from '../middleware/error.middleware';
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  errorResponse,
  paginatedResponse
} from '../utils/responses';
import { logger } from '../utils/logger';
import { getMercadoPagoService, CreatePaymentOrderParams } from '../services/mercadopago.service';
import { getStockService } from '../services/stock.service';

/**
 * POST /payments/create
 * Crear orden de pago con MercadoPago
 */
export const createPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { quoteId } = req.body;

    logger.info('Iniciando creación de pago', { quoteId });

    // Buscar el presupuesto
    const quote = await Quote.findById(quoteId)
      .populate('items.product', 'name price stock')
      .populate('createdBy', 'name email');

    if (!quote) {
      notFoundResponse(res, 'Presupuesto no encontrado');
      return;
    }

    if (quote.status !== 'pending') {
      badRequestResponse(res, `El presupuesto no está en estado pending. Estado actual: ${quote.status}`);
      return;
    }

    // Verificar que no existe un pago para este presupuesto
    const existingPayment = await Payment.findOne({ quote: quoteId });

    if (existingPayment) {
      badRequestResponse(res, 'Ya existe un pago para este presupuesto', {
        paymentId: existingPayment._id,
        status: existingPayment.status
      });
      return;
    }

    // Validar stock de todos los productos
    const stockService = getStockService();
    const stockItems = quote.items.map(item => ({
      productId: item.product._id?.toString() || '',
      quantity: item.quantity
    }));

    const stockValidation = await stockService.validateStock(stockItems);

    if (!stockValidation.isValid) {
      badRequestResponse(res, 'Stock insuficiente para uno o más productos', {
        stockErrors: stockValidation.errors
      });
      return;
    }

    // Preparar datos para MercadoPago
    const mercadoPagoService = getMercadoPagoService();
    const paymentOrderParams: CreatePaymentOrderParams = {
      quoteId: quote._id.toString(),
      amount: quote.total,
      description: `Presupuesto ${quote.quoteNumber} - ${quote.items.length} item(s)`,
      externalReference: `QUOTE-${quote.quoteNumber}-${Date.now()}`,
      ...(quote.customer.email && { customerEmail: quote.customer.email }),
      customerName: quote.customer.name
    };

    // Crear orden en MercadoPago
    const mercadoPagoResult = await mercadoPagoService.createPaymentOrder(paymentOrderParams);

    // Crear documento Payment en la base de datos
    const payment = new Payment({
      quote: quoteId,
      mercadopagoId: mercadoPagoResult.preferenceId,
      status: 'pending',
      amount: quote.total,
      qrCode: mercadoPagoResult.qrCodeBase64,
      qrCodeData: mercadoPagoResult.qrCodeData,
      externalReference: paymentOrderParams.externalReference
    });

    await payment.save();

    // Actualizar el presupuesto con el ID del pago
    quote.paymentId = payment._id;
    await quote.save();

    logger.info('Pago creado exitosamente', {
      paymentId: payment._id,
      preferenceId: mercadoPagoResult.preferenceId,
      quoteNumber: quote.quoteNumber,
      amount: quote.total
    });

    // Responder con los datos del pago
    createdResponse(res, {
      paymentId: payment._id,
      preferenceId: mercadoPagoResult.preferenceId,
      qrCode: mercadoPagoResult.qrCodeBase64,
      qrCodeData: mercadoPagoResult.qrCodeData,
      initPoint: mercadoPagoResult.initPoint,
      sandboxInitPoint: mercadoPagoResult.sandboxInitPoint,
      amount: payment.amount,
      externalReference: payment.externalReference,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      quote: {
        id: quote._id,
        number: quote.quoteNumber,
        customer: quote.customer,
        total: quote.total
      }
    }, 'Orden de pago creada exitosamente');

  } catch (error) {
    logger.error('Error creando orden de pago:', error);

    if (error instanceof Error) {
      if (error.message.includes('MercadoPago')) {
        errorResponse(res, 'Error en el servicio de pagos', 502, 'PAYMENT_SERVICE_ERROR', {
          details: error.message
        });
      } else {
        errorResponse(res, 'Error interno del servidor', 500, 'INTERNAL_ERROR');
      }
    } else {
      errorResponse(res, 'Error interno del servidor', 500, 'INTERNAL_ERROR');
    }
  }
});

/**
 * GET /payments/:paymentId/status
 * Obtener estado de un pago
 */
export const getPaymentStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    logger.info('Consultando estado de pago', { paymentId });

    const payment = await Payment.findById(paymentId)
      .populate({
        path: 'quote',
        select: 'quoteNumber status total customer expiresAt',
        populate: {
          path: 'createdBy',
          select: 'name email'
        }
      });

    if (!payment) {
      notFoundResponse(res, 'Pago no encontrado');
      return;
    }

    // Si el pago está pendiente, consultar estado actual en MercadoPago
    if (payment.status === 'pending' && payment.mercadopagoId) {
      try {
        const mercadoPagoService = getMercadoPagoService();

        // Intentar obtener el estado del pago desde MercadoPago
        // Nota: Para preferencias, no hay un estado directo, pero podemos verificar
        logger.info('Consultando estado en MercadoPago', {
          preferenceId: payment.mercadopagoId
        });

        // En una implementación real, aquí podrías consultar payments asociados a la preferencia

      } catch (mpError) {
        logger.warn('Error consultando MercadoPago, usando estado local', mpError);
      }
    }

    successResponse(res, {
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      mercadopagoId: payment.mercadopagoId,
      externalReference: payment.externalReference,
      qrCode: payment.qrCode,
      qrCodeData: payment.qrCodeData,
      quote: payment.quote,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      isExpired: payment.quote &&
        typeof payment.quote === 'object' && 'expiresAt' in payment.quote &&
        typeof payment.quote === 'object' && 'expiresAt' in payment.quote &&
        new Date() > new Date((payment.quote as any).expiresAt) &&
        payment.status === 'pending'
    }, 'Estado del pago obtenido exitosamente');

  } catch (error) {
    logger.error('Error obteniendo estado del pago:', error);
    throw error;
  }
});

/**
 * POST /payments/webhook
 * Webhook para recibir notificaciones de MercadoPago
 */
export const processWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-signature'] as string;

    logger.info('Webhook recibido de MercadoPago', {
      action: webhookData.action,
      type: webhookData.type,
      dataId: webhookData.data?.id,
      hasSignature: !!signature
    });

    // Procesar webhook usando el servicio de MercadoPago
    const mercadoPagoService = getMercadoPagoService();
    const processedData = await mercadoPagoService.processWebhook(webhookData, signature);

    if (!processedData.isValid) {
      logger.warn('Webhook con firma inválida rechazado');
      res.status(200).json({ received: false, reason: 'Invalid signature' });
      return;
    }

    // Solo procesar webhooks de tipo payment
    if (processedData.topic === 'payment') {
      await handlePaymentWebhook(processedData);
    } else {
      logger.info('Webhook no procesado (tipo no soportado)', {
        topic: processedData.topic
      });
    }

    // Siempre responder 200 OK para que MercadoPago no reintente
    res.status(200).json({
      received: true,
      processed: processedData.topic === 'payment',
      paymentId: processedData.paymentId
    });

  } catch (error) {
    logger.error('Error procesando webhook:', error);
    // Aún así responder 200 OK para evitar reintentos innecesarios
    res.status(200).json({
      received: true,
      processed: false,
      error: 'Processing error'
    });
  }
});

/**
 * Manejar webhook de pago específicamente
 */
async function handlePaymentWebhook(webhookData: any): Promise<void> {
  try {
    const { paymentId, status, externalReference } = webhookData;

    logger.info('Procesando webhook de pago', {
      paymentId,
      status,
      externalReference
    });

    // Buscar el pago por externalReference si está disponible
    let payment;
    if (externalReference) {
      payment = await Payment.findOne({ externalReference });
    }

    // Si no se encuentra por externalReference, buscar por mercadopagoId relacionado
    if (!payment) {
      // En este caso, necesitaríamos una forma de mapear el payment ID a nuestra base de datos
      logger.warn('No se pudo encontrar el pago asociado al webhook', {
        paymentId,
        externalReference
      });
      return;
    }

    const previousStatus = payment.status;

    // Actualizar estado del pago según la respuesta de MercadoPago
    switch (status) {
      case 'approved':
        payment.status = 'approved';
        payment.paidAt = new Date();

        // Actualizar estado del presupuesto
        const quote = await Quote.findById(payment.quote);
        if (quote) {
          quote.status = 'paid';
          await quote.save();

          // Decrementar stock de forma atómica
          const stockService = getStockService();
          const stockItems = quote.items.map(item => ({
            productId: item.product.toString(),
            quantity: item.quantity
          }));

          const stockResult = await stockService.decrementStock(stockItems);

          if (!stockResult.success) {
            logger.error('Error decrementando stock después del pago', {
              paymentId: payment._id,
              quoteId: quote._id,
              errors: stockResult.errors
            });
            // En este caso, podrías enviar notificaciones al administrador
          } else {
            logger.info('Stock decrementado exitosamente', {
              paymentId: payment._id,
              quoteId: quote._id,
              productsUpdated: stockResult.updatedProducts?.length
            });
          }
        }
        break;

      case 'rejected':
        payment.status = 'rejected';

        // Actualizar presupuesto si es necesario
        const rejectedQuote = await Quote.findById(payment.quote);
        if (rejectedQuote && rejectedQuote.status === 'pending') {
          // Mantener como pending para permitir otro intento de pago
        }
        break;

      case 'cancelled':
        payment.status = 'cancelled';
        break;

      default:
        logger.info('Estado de pago no reconocido', { status });
        return;
    }

    // Guardar estado actualizado del pago
    payment.webhookData = webhookData;
    await payment.save();

    logger.info('Pago actualizado por webhook', {
      paymentId: payment._id,
      previousStatus,
      newStatus: payment.status,
      paidAt: payment.paidAt
    });

  } catch (error) {
    logger.error('Error manejando webhook de pago:', error);
    throw error;
  }
}

/**
 * GET /payments
 * Listar pagos con filtros (solo admin)
 */
export const getPayments = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = req.query;

    // Construir filtros
    const filters: any = {};

    if (status) {
      filters.status = status;
    }

    // Filtro por fechas
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo as string);
    }

    // Calcular offset
    const skip = (Number(page) - 1) * Number(limit);

    // Ejecutar consultas en paralelo
    const [payments, totalPayments] = await Promise.all([
      Payment.find(filters)
        .populate({
          path: 'quote',
          select: 'quoteNumber customer total status expiresAt',
          populate: {
            path: 'createdBy',
            select: 'name email'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(filters)
    ]);

    // Calcular metadatos de paginación
    const totalPages = Math.ceil(totalPayments / Number(limit));

    paginatedResponse(res, payments, {
      page: Number(page),
      limit: Number(limit),
      total: totalPayments,
      totalPages,
      hasNextPage: Number(page) < totalPages,
      hasPreviousPage: Number(page) > 1
    }, 'Pagos obtenidos exitosamente');

  } catch (error) {
    logger.error('Error obteniendo pagos:', error);
    throw error;
  }
});

/**
 * GET /payments/stats
 * Obtener estadísticas de pagos (solo admin)
 */
export const getPaymentStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo } = req.query;

    // Construir filtro de fechas
    const dateFilter: any = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom as string);
    if (dateTo) dateFilter.$lte = new Date(dateTo as string);

    const matchStage = Object.keys(dateFilter).length > 0
      ? { createdAt: dateFilter }
      : {};

    const [statusStats, generalStats] = await Promise.all([
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0]
              }
            },
            avgPaymentAmount: { $avg: '$amount' },
            pendingAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
              }
            }
          }
        }
      ])
    ]);

    successResponse(res, {
      byStatus: statusStats,
      general: generalStats[0] || {
        totalPayments: 0,
        totalRevenue: 0,
        avgPaymentAmount: 0,
        pendingAmount: 0
      }
    }, 'Estadísticas de pagos obtenidas exitosamente');

  } catch (error) {
    logger.error('Error obteniendo estadísticas de pagos:', error);
    throw error;
  }
});

/**
 * POST /payments/:paymentId/cancel
 * Cancelar un pago pendiente
 */
export const cancelPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId).populate('quote');

    if (!payment) {
      notFoundResponse(res, 'Pago no encontrado');
      return;
    }

    if (payment.status !== 'pending') {
      badRequestResponse(res, `No se puede cancelar un pago en estado ${payment.status}`);
      return;
    }

    // Actualizar estado del pago
    payment.status = 'cancelled';
    await payment.save();

    // Actualizar estado del presupuesto si es necesario
    if (payment.quote) {
      const quote = await Quote.findById(payment.quote._id);
      if (quote && quote.status === 'pending') {
        // El presupuesto vuelve a estar disponible para generar otro pago
        quote.paymentId = null as any;
        await quote.save();
      }
    }

    logger.info('Pago cancelado exitosamente', {
      paymentId: payment._id,
      quoteId: payment.quote?._id
    });

    successResponse(res, {
      paymentId: payment._id,
      status: payment.status
    }, 'Pago cancelado exitosamente');

  } catch (error) {
    logger.error('Error cancelando pago:', error);
    throw error;
  }
});