import { Request, Response, NextFunction } from 'express';
import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import { ApiResponse } from '../types';

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      error: {
        code: 'VALIDATION_ERROR',
        details: errors.array()
      }
    });
    return;
  }

  next();
};

/**
 * Validaciones para autenticación
 */
export const loginValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail()
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

export const registerValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una letra minúscula, una mayúscula y un número'),
  body('name')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'seller'])
    .withMessage('El rol debe ser admin o seller')
];

/**
 * Validaciones para productos
 */
export const createProductValidation: ValidationChain[] = [
  body('name')
    .notEmpty()
    .withMessage('El nombre del producto es requerido')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre debe tener entre 2 y 200 caracteres'),
  body('description')
    .notEmpty()
    .withMessage('La descripción es requerida')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('El precio debe ser un número mayor a 0')
    .toFloat(),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('El stock debe ser un número entero no negativo')
    .toInt(),
  body('category')
    .notEmpty()
    .withMessage('La categoría es requerida')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La categoría debe tener entre 2 y 100 caracteres'),
  body('sku')
    .optional()
    .trim()
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage('El SKU solo puede contener letras, números, guiones y guiones bajos')
    .isLength({ max: 50 })
    .withMessage('El SKU no puede exceder 50 caracteres'),
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('La URL de la imagen no es válida')
];

export const updateProductValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('ID de producto inválido'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('El nombre no puede estar vacío')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre debe tener entre 2 y 200 caracteres'),
  body('description')
    .optional()
    .notEmpty()
    .withMessage('La descripción no puede estar vacía')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  body('price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('El precio debe ser un número mayor a 0')
    .toFloat(),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El stock debe ser un número entero no negativo')
    .toInt(),
  body('category')
    .optional()
    .notEmpty()
    .withMessage('La categoría no puede estar vacía')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La categoría debe tener entre 2 y 100 caracteres'),
  body('sku')
    .optional()
    .trim()
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage('El SKU solo puede contener letras, números, guiones y guiones bajos')
    .isLength({ max: 50 })
    .withMessage('El SKU no puede exceder 50 caracteres'),
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('La URL de la imagen no es válida'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser verdadero o falso')
    .toBoolean()
];

/**
 * Validaciones para presupuestos
 */
export const createQuoteValidation: ValidationChain[] = [
  // Validar estructura anidada de customer
  body('customer')
    .isObject()
    .withMessage('Los datos del cliente son requeridos'),
  body('customer.name')
    .notEmpty()
    .withMessage('El nombre del cliente es requerido')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre debe tener entre 2 y 200 caracteres'),
  body('customer.email')
    .optional()
    .isEmail()
    .withMessage('El email del cliente no es válido')
    .normalizeEmail(),
  body('customer.phone')
    .optional()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El formato del teléfono no es válido'),

  // Validar items
  body('items')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos un item'),
  body('items.*.productId')
    .isMongoId()
    .withMessage('ID de producto inválido'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero mayor a 0')
    .toInt(),

  // Rechazar campos de items que se calculan automáticamente
  body('items.*.product')
    .not()
    .exists()
    .withMessage('items.product se calcula automáticamente, usar solo productId'),
  body('items.*.productSnapshot')
    .not()
    .exists()
    .withMessage('items.productSnapshot se genera automáticamente'),
  body('items.*.subtotal')
    .not()
    .exists()
    .withMessage('items.subtotal se calcula automáticamente'),

  // Validar campos opcionales
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento debe ser entre 0 y 100')
    .toFloat(),
  body('tax')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El impuesto debe ser entre 0 y 100')
    .toFloat(),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden exceder 1000 caracteres'),

  // IMPORTANTE: Rechazar campos que deben ser autogenerados
  body(['expiresAt', 'quoteNumber', '_id', 'createdAt', 'updatedAt'])
    .not()
    .exists()
    .withMessage('Este campo se genera automáticamente, no debe enviarse')
];

/**
 * Validaciones para parámetros de ID
 */
export const mongoIdValidation = (paramName: string = 'id'): ValidationChain[] => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} debe ser un ID válido de MongoDB`)
];

/**
 * Validaciones para query parameters de paginación
 */
export const paginationValidation: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100')
    .toInt(),
  query('sort')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('El campo de ordenamiento no puede estar vacío'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('El orden debe ser asc o desc')
];

/**
 * Validaciones para filtros de productos
 */
export const productFiltersValidation: ValidationChain[] = [
  ...paginationValidation,
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('La categoría no puede estar vacía'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('El término de búsqueda no puede estar vacío'),
  query('lowStock')
    .optional()
    .isBoolean()
    .withMessage('lowStock debe ser verdadero o falso')
    .toBoolean(),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser verdadero o falso')
    .toBoolean()
];

/**
 * Validaciones para filtros de presupuestos
 */
export const quoteFiltersValidation: ValidationChain[] = [
  ...paginationValidation,
  query('status')
    .optional()
    .isIn(['pending', 'paid', 'cancelled', 'expired'])
    .withMessage('El estado debe ser pending, paid, cancelled o expired'),
  query('customer')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('El nombre del cliente no puede estar vacío'),
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
];

/**
 * Validación para creación de pago
 */
export const createPaymentValidation: ValidationChain[] = [
  body('quoteId')
    .isMongoId()
    .withMessage('El ID del presupuesto debe ser válido')
];

/**
 * Función helper para combinar validaciones con manejo de errores
 */
export const validate = (validations: ValidationChain[]) => {
  return [...validations, handleValidationErrors];
};