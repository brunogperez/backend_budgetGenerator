import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest, QuoteFilters, CreateQuoteRequest, IQuoteItem } from '../types';
import Quote from '../models/Quote';
import Product from '../models/Product';
import { asyncHandler } from '../middleware/error.middleware';
import {
  successResponse,
  createdResponse,
  updatedResponse,
  notFoundResponse,
  paginatedResponse,
  badRequestResponse
} from '../utils/responses';
import { logger } from '../utils/logger';

/**
 * GET /quotes
 * Listar presupuestos con filtros y paginación
 */
export const getQuotes = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      customer,
      dateFrom,
      dateTo,
      sort = 'createdAt',
      order = 'desc'
    }: QuoteFilters = req.query;

    // Convertir a números
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    // Construir filtros
    const filters: any = {};

    // Filtro por usuario (sellers solo ven sus presupuestos, admins ven todos)
    if (req.user?.role === 'seller') {
      filters.createdBy = req.user.id;
    }

    if (status) {
      filters.status = status;
    }

    if (customer) {
      filters.$or = [
        { 'customer.name': new RegExp(customer, 'i') },
        { 'customer.email': new RegExp(customer, 'i') }
      ];
    }

    // Filtro por fechas
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    // Configurar ordenamiento
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions: any = { [sort]: sortOrder };

    // Calcular offset
    const skip = (pageNum - 1) * limitNum;

    // Ejecutar consultas en paralelo
    const [quotes, totalQuotes] = await Promise.all([
      Quote.find(filters)
        .populate('createdBy', 'name email')
        .populate('items.product', 'name price category')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Quote.countDocuments(filters)
    ]);

    // Calcular metadatos de paginación
    const totalPages = Math.ceil(totalQuotes / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPreviousPage = pageNum > 1;

    const pagination = {
      page: pageNum,
      limit: limitNum,
      total: totalQuotes,
      totalPages,
      hasNextPage,
      hasPreviousPage
    };

    paginatedResponse(res, quotes, pagination, 'Presupuestos obtenidos exitosamente');

  } catch (error) {
    logger.error('Error obteniendo presupuestos:', error);
    throw error;
  }
});

/**
 * GET /quotes/:id
 * Obtener presupuesto por ID
 */
export const getQuoteById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const filters: any = { _id: id };

    // Sellers solo pueden ver sus propios presupuestos
    if (req.user?.role === 'seller') {
      filters.createdBy = req.user.id;
    }

    const quote = await Quote.findOne(filters)
      .populate('createdBy', 'name email')
      .populate('items.product', 'name price category stock')
      .populate('paymentId');

    if (!quote) {
      notFoundResponse(res, 'Presupuesto no encontrado');
      return;
    }

    successResponse(res, quote, 'Presupuesto obtenido exitosamente');

  } catch (error) {
    logger.error('Error obteniendo presupuesto por ID:', error);
    throw error;
  }
});

/**
 * POST /quotes
 * Crear nuevo presupuesto
 */
export const createQuote = asyncHandler(async (req: AuthRequest & { body: CreateQuoteRequest }, res: Response): Promise<void> => {
  try {
    const { customer, items, discount = 0, tax = 0, notes } = req.body;

    if (!req.user) {
      badRequestResponse(res, 'Usuario no autenticado');
      return;
    }

    // Validar que los productos existen y tienen stock suficiente
    const productIds = items.map((item: any) => item.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true
    });

    if (products.length !== productIds.length) {
      badRequestResponse(res, 'Uno o más productos no fueron encontrados o están inactivos');
      return;
    }

    // Validar stock y crear items con snapshot de productos
    const quoteItems: IQuoteItem[] = [];
    const stockErrors: string[] = [];

    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.productId);

      if (!product) {
        stockErrors.push(`Producto ${item.productId} no encontrado`);
        continue;
      }

      if (!product.validateStock(item.quantity)) {
        stockErrors.push(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`);
        continue;
      }

      // Crear item con snapshot del producto
      quoteItems.push({
        product: product._id,
        productSnapshot: {
          name: product.name,
          price: product.price
        },
        quantity: item.quantity,
        subtotal: product.price * item.quantity
      });
    }

    if (stockErrors.length > 0) {
      badRequestResponse(res, 'Errores de validación de stock', stockErrors);
      return;
    }

    // Crear el presupuesto
    const quote = new Quote({
      customer,
      items: quoteItems,
      discount,
      tax,
      notes,
      createdBy: req.user.id
    });

    // Los cálculos se hacen automáticamente en el pre-save hook
    await quote.save();

    // Poblar la respuesta
    await quote.populate('createdBy', 'name email');
    await quote.populate('items.product', 'name price category');

    logger.info(`Presupuesto creado: ${quote.quoteNumber} por usuario ${req.user.email}`);

    createdResponse(res, quote, 'Presupuesto creado exitosamente');

  } catch (error) {
    logger.error('Error creando presupuesto:', error);
    throw error;
  }
});

/**
 * PUT /quotes/:id/cancel
 * Cancelar presupuesto
 */
export const cancelQuote = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const filters: any = { _id: id };

    // Sellers solo pueden cancelar sus propios presupuestos
    if (req.user?.role === 'seller') {
      filters.createdBy = req.user.id;
    }

    const quote = await Quote.findOne(filters);

    if (!quote) {
      notFoundResponse(res, 'Presupuesto no encontrado');
      return;
    }

    if (quote.status !== 'pending') {
      badRequestResponse(res, `No se puede cancelar un presupuesto en estado ${quote.status}`);
      return;
    }

    // Actualizar estado
    quote.status = 'cancelled';
    await quote.save();

    logger.info(`Presupuesto cancelado: ${quote.quoteNumber}`);

    updatedResponse(res, quote, 'Presupuesto cancelado exitosamente');

  } catch (error) {
    logger.error('Error cancelando presupuesto:', error);
    throw error;
  }
});

/**
 * GET /quotes/customer/:email
 * Obtener presupuestos por email del cliente
 */
export const getQuotesByCustomerEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.params;

    const quotes = await Quote.find({
      'customer.email': email
    })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(50);

    successResponse(res, quotes, `${quotes.length} presupuestos encontrados para ${email}`);

  } catch (error) {
    logger.error('Error obteniendo presupuestos por email de cliente:', error);
    throw error;
  }
});

/**
 * GET /quotes/stats
 * Obtener estadísticas de presupuestos (solo admin)
 */
export const getQuoteStats = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo } = req.query;

    // Construir filtro de fechas
    const dateFilter: any = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom as string);
    if (dateTo) dateFilter.$lte = new Date(dateTo as string);

    const matchStage: any = Object.keys(dateFilter).length > 0
      ? { createdAt: dateFilter }
      : {};

    // Agregar filtro por usuario si es seller
    if (req.user?.role === 'seller') {
      (matchStage as any).createdBy = new Types.ObjectId(req.user.id);
    }

    const stats = await Quote.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' },
          avgAmount: { $avg: '$total' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calcular totales generales
    const totalStats = await Quote.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalQuotes: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] } },
          avgQuoteValue: { $avg: '$total' }
        }
      }
    ]);

    const response = {
      byStatus: stats,
      totals: totalStats[0] || {
        totalQuotes: 0,
        totalRevenue: 0,
        avgQuoteValue: 0
      }
    };

    successResponse(res, response, 'Estadísticas obtenidas exitosamente');

  } catch (error) {
    logger.error('Error obteniendo estadísticas de presupuestos:', error);
    throw error;
  }
});

/**
 * POST /quotes/expire-old
 * Tarea para expirar presupuestos antiguos (solo admin, usado por cron)
 */
export const expireOldQuotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Quote.updateMany(
      {
        status: 'pending',
        expiresAt: { $lte: new Date() }
      },
      {
        status: 'expired'
      }
    );

    logger.info(`${result.modifiedCount} presupuestos expirados automáticamente`);

    successResponse(res, {
      expiredCount: result.modifiedCount
    }, `${result.modifiedCount} presupuestos expirados`);

  } catch (error) {
    logger.error('Error expirando presupuestos antiguos:', error);
    throw error;
  }
});

/**
 * GET /quotes/expiring
 * Obtener presupuestos próximos a expirar (solo admin)
 */
export const getExpiringQuotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { days = 1 } = req.query;
    const daysAhead = parseInt(days as string, 10);

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysAhead);

    const quotes = await Quote.find({
      status: 'pending',
      expiresAt: { $lte: expirationDate }
    })
    .populate('createdBy', 'name email')
    .populate('items.product', 'name')
    .sort({ expiresAt: 1 });

    successResponse(
      res,
      quotes,
      `${quotes.length} presupuestos expiran en los próximos ${daysAhead} día(s)`
    );

  } catch (error) {
    logger.error('Error obteniendo presupuestos próximos a expirar:', error);
    throw error;
  }
});