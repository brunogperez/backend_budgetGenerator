import { Request, Response } from 'express';
import { AuthRequest, ProductFilters, CreateProductRequest } from '../types';
import Product from '../models/Product';
import { asyncHandler } from '../middleware/error.middleware';
import {
  successResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse
} from '../utils/responses';
import { logger } from '../utils/logger';

/**
 * GET /products
 * Listar productos con filtros y paginación
 */
export const getProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      category,
      search,
      lowStock,
      isActive,
      sort = 'createdAt',
      order = 'desc'
    }: ProductFilters = req.query;

    // Convertir a números
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    // Construir filtros
    const filters: any = {};

    if (category) {
      filters.category = new RegExp(category, 'i');
    }

    if (isActive !== undefined) {
      filters.isActive = isActive;
    } else {
      // Por defecto, solo mostrar productos activos
      filters.isActive = true;
    }

    if (lowStock) {
      filters.stock = { $lte: 10 };
    }

    // Búsqueda de texto en nombre y descripción
    if (search) {
      filters.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { sku: new RegExp(search, 'i') }
      ];
    }

    // Configurar ordenamiento
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions: any = { [sort]: sortOrder };

    // Calcular offset
    const skip = (pageNum - 1) * limitNum;

    // Ejecutar consultas en paralelo
    const [products, totalProducts] = await Promise.all([
      Product.find(filters)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Usar lean() para mejor rendimiento
      Product.countDocuments(filters)
    ]);

    // Calcular metadatos de paginación
    const totalPages = Math.ceil(totalProducts / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPreviousPage = pageNum > 1;

    const pagination = {
      page: pageNum,
      limit: limitNum,
      total: totalProducts,
      totalPages,
      hasNextPage,
      hasPreviousPage
    };

    paginatedResponse(res, products, pagination, 'Productos obtenidos exitosamente');

  } catch (error) {
    logger.error('Error obteniendo productos:', error);
    throw error;
  }
});

/**
 * GET /products/:id
 * Obtener producto por ID
 */
export const getProductById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      notFoundResponse(res, 'Producto no encontrado');
      return;
    }

    successResponse(res, product, 'Producto obtenido exitosamente');

  } catch (error) {
    logger.error('Error obteniendo producto por ID:', error);
    throw error;
  }
});

/**
 * POST /products
 * Crear nuevo producto (solo admin)
 */
export const createProduct = asyncHandler(async (req: Request<{}, {}, CreateProductRequest>, res: Response): Promise<void> => {
  try {
    const productData = req.body;

    // Crear nuevo producto
    const product = new Product(productData);
    await product.save();

    logger.info(`Producto creado: ${product.name} (ID: ${product._id})`);

    createdResponse(res, product, 'Producto creado exitosamente');

  } catch (error) {
    logger.error('Error creando producto:', error);
    throw error;
  }
});

/**
 * PUT /products/:id
 * Actualizar producto (solo admin)
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remover campos que no se pueden actualizar directamente
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!product) {
      notFoundResponse(res, 'Producto no encontrado');
      return;
    }

    logger.info(`Producto actualizado: ${product.name} (ID: ${product._id})`);

    updatedResponse(res, product, 'Producto actualizado exitosamente');

  } catch (error) {
    logger.error('Error actualizando producto:', error);
    throw error;
  }
});

/**
 * DELETE /products/:id
 * Eliminar producto (soft delete - solo admin)
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Soft delete - marcar como inactivo en lugar de eliminar
    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      notFoundResponse(res, 'Producto no encontrado');
      return;
    }

    logger.info(`Producto eliminado (soft delete): ${product.name} (ID: ${product._id})`);

    deletedResponse(res, 'Producto eliminado exitosamente');

  } catch (error) {
    logger.error('Error eliminando producto:', error);
    throw error;
  }
});

/**
 * GET /products/low-stock
 * Obtener productos con stock bajo (solo admin)
 */
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { threshold = 10 } = req.query;
    const stockThreshold = parseInt(threshold as string, 10);

    const products = await Product.find({
      stock: { $lte: stockThreshold },
      isActive: true
    }).sort({ stock: 1 });

    successResponse(
      res,
      products,
      `Productos con stock bajo (≤${stockThreshold}) obtenidos exitosamente`
    );

  } catch (error) {
    logger.error('Error obteniendo productos con stock bajo:', error);
    throw error;
  }
});

/**
 * GET /products/categories
 * Obtener todas las categorías disponibles
 */
export const getCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Product.distinct('category', { isActive: true });

    successResponse(res, categories.sort(), 'Categorías obtenidas exitosamente');

  } catch (error) {
    logger.error('Error obteniendo categorías:', error);
    throw error;
  }
});

/**
 * PUT /products/:id/stock
 * Actualizar stock de un producto (solo admin)
 */
export const updateStock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body;

    if (typeof stock !== 'number' || stock < 0) {
      throw new Error('El stock debe ser un número no negativo');
    }

    let updateQuery: any;

    if (operation === 'increment') {
      updateQuery = { $inc: { stock } };
    } else if (operation === 'decrement') {
      updateQuery = { $inc: { stock: -stock } };
    } else {
      updateQuery = { stock };
    }

    const product = await Product.findByIdAndUpdate(
      id,
      updateQuery,
      {
        new: true,
        runValidators: true
      }
    );

    if (!product) {
      notFoundResponse(res, 'Producto no encontrado');
      return;
    }

    // Verificar que el stock no sea negativo después de la operación
    if (product.stock < 0) {
      // Revertir la operación
      await Product.findByIdAndUpdate(id, { $inc: { stock: stock } });
      throw new Error('La operación resultaría en stock negativo');
    }

    logger.info(`Stock actualizado para ${product.name}: ${product.stock}`);

    updatedResponse(res, {
      productId: product._id,
      name: product.name,
      newStock: product.stock
    }, 'Stock actualizado exitosamente');

  } catch (error) {
    logger.error('Error actualizando stock:', error);
    throw error;
  }
});

/**
 * GET /products/search
 * Búsqueda avanzada de productos
 */
export const searchProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, minPrice, maxPrice, inStock } = req.query;

    if (!q) {
      throw new Error('Parámetro de búsqueda "q" es requerido');
    }

    // Construir filtros de búsqueda
    const filters: any = {
      isActive: true,
      $text: { $search: q as string }
    };

    if (category) {
      filters.category = new RegExp(category as string, 'i');
    }

    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) filters.price.$lte = parseFloat(maxPrice as string);
    }

    if (inStock === 'true') {
      filters.stock = { $gt: 0 };
    }

    const products = await Product.find(filters)
      .sort({ score: { $meta: 'textScore' } })
      .limit(50);

    successResponse(res, products, `${products.length} productos encontrados`);

  } catch (error) {
    logger.error('Error en búsqueda de productos:', error);
    throw error;
  }
});