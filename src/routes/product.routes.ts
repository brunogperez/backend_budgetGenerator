import { Router } from 'express';
import * as productController from '../controllers/productController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import {
  createProductValidation,
  updateProductValidation,
  mongoIdValidation,
  productFiltersValidation,
  validate
} from '../middleware/validation.middleware';
import { body, query } from 'express-validator';

const router = Router();

/**
 * GET /products
 * Listar productos con filtros y paginación
 * Público - no requiere autenticación
 */
router.get(
  '/',
  validate(productFiltersValidation),
  productController.getProducts
);

/**
 * GET /products/categories
 * Obtener todas las categorías disponibles
 * Público - no requiere autenticación
 */
router.get('/categories', productController.getCategories);

/**
 * GET /products/search
 * Búsqueda avanzada de productos
 * Público - no requiere autenticación
 */
router.get(
  '/search',
  validate([
    query('q')
      .notEmpty()
      .withMessage('El parámetro de búsqueda "q" es requerido')
      .trim(),
    query('category')
      .optional()
      .trim(),
    query('minPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El precio mínimo debe ser un número no negativo')
      .toFloat(),
    query('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El precio máximo debe ser un número no negativo')
      .toFloat(),
    query('inStock')
      .optional()
      .isBoolean()
      .withMessage('inStock debe ser verdadero o falso')
      .toBoolean()
  ]),
  productController.searchProducts
);

/**
 * GET /products/low-stock
 * Obtener productos con stock bajo
 * Requiere autenticación - solo admin
 */
router.get(
  '/low-stock',
  authMiddleware,
  adminMiddleware,
  validate([
    query('threshold')
      .optional()
      .isInt({ min: 1 })
      .withMessage('El threshold debe ser un número entero positivo')
      .toInt()
  ]),
  productController.getLowStockProducts
);

/**
 * POST /products
 * Crear nuevo producto
 * Requiere autenticación - solo admin
 */
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  validate(createProductValidation),
  productController.createProduct
);

/**
 * GET /products/:id
 * Obtener producto por ID
 * Público - no requiere autenticación
 */
router.get(
  '/:id',
  validate(mongoIdValidation()),
  productController.getProductById
);

/**
 * PUT /products/:id
 * Actualizar producto
 * Requiere autenticación - solo admin
 */
router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  validate(updateProductValidation),
  productController.updateProduct
);

/**
 * DELETE /products/:id
 * Eliminar producto (soft delete)
 * Requiere autenticación - solo admin
 */
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  validate(mongoIdValidation()),
  productController.deleteProduct
);

/**
 * PUT /products/:id/stock
 * Actualizar stock de un producto
 * Requiere autenticación - solo admin
 */
router.put(
  '/:id/stock',
  authMiddleware,
  adminMiddleware,
  validate([
    ...mongoIdValidation(),
    body('stock')
      .isInt({ min: 0 })
      .withMessage('El stock debe ser un número entero no negativo')
      .toInt(),
    body('operation')
      .optional()
      .isIn(['set', 'increment', 'decrement'])
      .withMessage('La operación debe ser set, increment o decrement')
  ]),
  productController.updateStock
);

export default router;