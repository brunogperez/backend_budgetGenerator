import { Types, startSession, ClientSession } from 'mongoose';
import Product from '../models/Product';
import { logger } from '../utils/logger';
import { StockValidationResult } from '../types';

/**
 * Interfaz para items de stock
 */
export interface StockItem {
  productId: string;
  quantity: number;
}

/**
 * Interfaz para resultado de operaciones de stock
 */
export interface StockOperationResult {
  success: boolean;
  message: string;
  errors?: Array<{
    productId: string;
    productName?: string;
    error: string;
    requested?: number;
    available?: number;
  }>;
  updatedProducts?: Array<{
    productId: string;
    productName: string;
    previousStock: number;
    newStock: number;
  }>;
}

/**
 * Servicio para manejo atómico de stock
 */
class StockService {

  /**
   * Validar stock disponible para una lista de items
   */
  async validateStock(items: StockItem[]): Promise<StockValidationResult> {
    try {
      logger.info('Validando stock para items', { itemsCount: items.length });

      const errors: StockValidationResult['errors'] = [];

      // Obtener todos los productos de una vez
      const productIds = items.map(item => new Types.ObjectId(item.productId));
      const products = await Product.find({
        _id: { $in: productIds },
        isActive: true
      });

      // Crear un mapa para acceso rápido
      const productMap = new Map(
        products.map(product => [product._id.toString(), product])
      );

      // Validar cada item
      for (const item of items) {
        const product = productMap.get(item.productId);

        if (!product) {
          errors.push({
            productId: item.productId,
            productName: 'Producto no encontrado',
            requested: item.quantity,
            available: 0
          });
          continue;
        }

        if (!product.validateStock(item.quantity)) {
          errors.push({
            productId: item.productId,
            productName: product.name,
            requested: item.quantity,
            available: product.stock
          });
        }
      }

      const result = {
        isValid: errors.length === 0,
        errors
      };

      logger.info('Validación de stock completada', {
        isValid: result.isValid,
        errorsCount: errors.length
      });

      return result;

    } catch (error) {
      logger.error('Error validando stock:', error);
      throw new Error('Error validando disponibilidad de stock');
    }
  }

  /**
   * Decrementar stock de productos de forma atómica
   */
  async decrementStock(items: StockItem[]): Promise<StockOperationResult> {
    const session: ClientSession = await startSession();

    try {
      logger.info('Iniciando decremento de stock atómico', {
        itemsCount: items.length,
        items: items.map(item => ({ productId: item.productId, quantity: item.quantity }))
      });

      let result: StockOperationResult;

      await session.withTransaction(async () => {
        // Primero validar que todos los productos existan y tengan stock
        const validation = await this.validateStock(items);

        if (!validation.isValid) {
          result = {
            success: false,
            message: 'Stock insuficiente para uno o más productos',
            errors: validation.errors.map(err => ({
              productId: err.productId,
              productName: err.productName,
              error: `Stock insuficiente. Solicitado: ${err.requested}, Disponible: ${err.available}`,
              requested: err.requested,
              available: err.available
            }))
          };
          throw new Error('Validación de stock fallida');
        }

        // Obtener productos con stock actual (con session para consistencia)
        const productIds = items.map(item => new Types.ObjectId(item.productId));
        const products = await Product.find({
          _id: { $in: productIds },
          isActive: true
        }).session(session);

        const productMap = new Map(
          products.map(product => [product._id.toString(), product])
        );

        const updatedProducts: StockOperationResult['updatedProducts'] = [];
        const errors: StockOperationResult['errors'] = [];

        // Decrementar stock de cada producto
        for (const item of items) {
          const product = productMap.get(item.productId);

          if (!product) {
            errors.push({
              productId: item.productId,
              error: 'Producto no encontrado'
            });
            continue;
          }

          // Verificar stock nuevamente dentro de la transacción
          if (product.stock < item.quantity) {
            errors.push({
              productId: item.productId,
              productName: product.name,
              error: 'Stock insuficiente',
              requested: item.quantity,
              available: product.stock
            });
            continue;
          }

          const previousStock = product.stock;

          // Actualizar stock usando findByIdAndUpdate para operación atómica
          const updatedProduct = await Product.findByIdAndUpdate(
            product._id,
            { $inc: { stock: -item.quantity } },
            {
              new: true,
              session,
              runValidators: true
            }
          );

          if (!updatedProduct) {
            errors.push({
              productId: item.productId,
              productName: product.name,
              error: 'Error actualizando producto'
            });
            continue;
          }

          // Verificar que el stock no sea negativo después de la actualización
          if (updatedProduct.stock < 0) {
            throw new Error(`Stock negativo resultante para ${product.name}`);
          }

          updatedProducts.push({
            productId: item.productId,
            productName: product.name,
            previousStock,
            newStock: updatedProduct.stock
          });

          logger.info('Stock decrementado', {
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
            previousStock,
            newStock: updatedProduct.stock
          });
        }

        if (errors.length > 0) {
          result = {
            success: false,
            message: 'Error decrementando stock de algunos productos',
            errors
          };
          throw new Error('Error en decremento de stock');
        }

        result = {
          success: true,
          message: 'Stock decrementado exitosamente',
          updatedProducts
        };
      });

      logger.info('Decremento de stock completado exitosamente', {
        productsUpdated: result!.updatedProducts?.length || 0
      });

      return result!;

    } catch (error) {
      logger.error('Error decrementando stock:', error);

      return {
        success: false,
        message: 'Error en la transacción de stock',
        errors: [{
          productId: 'general',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }]
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Incrementar stock de productos (por ejemplo, al cancelar un pedido)
   */
  async incrementStock(items: StockItem[]): Promise<StockOperationResult> {
    const session: ClientSession = await startSession();

    try {
      logger.info('Iniciando incremento de stock atómico', {
        itemsCount: items.length
      });

      let result: StockOperationResult;

      await session.withTransaction(async () => {
        const productIds = items.map(item => new Types.ObjectId(item.productId));
        const products = await Product.find({
          _id: { $in: productIds },
          isActive: true
        }).session(session);

        const productMap = new Map(
          products.map(product => [product._id.toString(), product])
        );

        const updatedProducts: StockOperationResult['updatedProducts'] = [];
        const errors: StockOperationResult['errors'] = [];

        // Incrementar stock de cada producto
        for (const item of items) {
          const product = productMap.get(item.productId);

          if (!product) {
            errors.push({
              productId: item.productId,
              error: 'Producto no encontrado'
            });
            continue;
          }

          const previousStock = product.stock;

          // Actualizar stock usando findByIdAndUpdate
          const updatedProduct = await Product.findByIdAndUpdate(
            product._id,
            { $inc: { stock: item.quantity } },
            {
              new: true,
              session,
              runValidators: true
            }
          );

          if (!updatedProduct) {
            errors.push({
              productId: item.productId,
              productName: product.name,
              error: 'Error actualizando producto'
            });
            continue;
          }

          updatedProducts.push({
            productId: item.productId,
            productName: product.name,
            previousStock,
            newStock: updatedProduct.stock
          });

          logger.info('Stock incrementado', {
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
            previousStock,
            newStock: updatedProduct.stock
          });
        }

        if (errors.length > 0) {
          result = {
            success: false,
            message: 'Error incrementando stock de algunos productos',
            errors
          };
          throw new Error('Error en incremento de stock');
        }

        result = {
          success: true,
          message: 'Stock incrementado exitosamente',
          updatedProducts
        };
      });

      logger.info('Incremento de stock completado exitosamente');
      return result!;

    } catch (error) {
      logger.error('Error incrementando stock:', error);

      return {
        success: false,
        message: 'Error en la transacción de stock',
        errors: [{
          productId: 'general',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }]
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Reservar stock temporalmente (para presupuestos)
   */
  async reserveStock(items: StockItem[], reservationId: string, expirationMinutes: number = 30): Promise<StockOperationResult> {
    try {
      logger.info('Reservando stock temporalmente', {
        reservationId,
        expirationMinutes,
        itemsCount: items.length
      });

      // Por ahora, solo validamos stock sin crear reservas reales
      // En una implementación más avanzada, podrías crear un modelo de Reservation
      const validation = await this.validateStock(items);

      if (!validation.isValid) {
        return {
          success: false,
          message: 'Stock insuficiente para reserva',
          errors: validation.errors.map(err => ({
            productId: err.productId,
            productName: err.productName,
            error: `Stock insuficiente. Solicitado: ${err.requested}, Disponible: ${err.available}`,
            requested: err.requested,
            available: err.available
          }))
        };
      }

      logger.info('Stock reservado conceptualmente', { reservationId });

      return {
        success: true,
        message: 'Stock validado y disponible para reserva'
      };

    } catch (error) {
      logger.error('Error reservando stock:', error);
      throw new Error('Error en la reserva de stock');
    }
  }

  /**
   * Liberar stock reservado (al cancelar un presupuesto)
   */
  async releaseStock(reservationId: string): Promise<StockOperationResult> {
    try {
      logger.info('Liberando stock reservado', { reservationId });

      // En una implementación más avanzada, buscarías y eliminarías las reservas
      // Por ahora, solo logueamos la operación

      return {
        success: true,
        message: 'Stock liberado exitosamente'
      };

    } catch (error) {
      logger.error('Error liberando stock:', error);
      throw new Error('Error liberando stock reservado');
    }
  }

  /**
   * Obtener productos con stock bajo
   */
  async getLowStockProducts(threshold: number = 10): Promise<any[]> {
    try {
      logger.info('Obteniendo productos con stock bajo', { threshold });

      const lowStockProducts = await Product.find({
        stock: { $lte: threshold },
        isActive: true
      }).select('name stock category sku').sort({ stock: 1 });

      logger.info('Productos con stock bajo obtenidos', {
        count: lowStockProducts.length
      });

      return lowStockProducts;

    } catch (error) {
      logger.error('Error obteniendo productos con stock bajo:', error);
      throw new Error('Error consultando stock bajo');
    }
  }

  /**
   * Obtener estadísticas de stock
   */
  async getStockStatistics(): Promise<any> {
    try {
      logger.info('Calculando estadísticas de stock');

      const stats = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalStock: { $sum: '$stock' },
            averageStock: { $avg: '$stock' },
            lowStockCount: {
              $sum: { $cond: [{ $lte: ['$stock', 10] }, 1, 0] }
            },
            outOfStockCount: {
              $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalProducts: 0,
        totalStock: 0,
        averageStock: 0,
        lowStockCount: 0,
        outOfStockCount: 0
      };

      logger.info('Estadísticas de stock calculadas', result);
      return result;

    } catch (error) {
      logger.error('Error calculando estadísticas de stock:', error);
      throw new Error('Error calculando estadísticas');
    }
  }
}

// Crear instancia singleton
let stockService: StockService;

/**
 * Obtener instancia del servicio de stock
 */
export const getStockService = (): StockService => {
  if (!stockService) {
    stockService = new StockService();
  }
  return stockService;
};

export default StockService;