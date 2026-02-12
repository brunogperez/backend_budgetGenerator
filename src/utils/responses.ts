import { Response } from 'express';
import { ApiResponse } from '../types';

/**
 * Respuesta exitosa estándar
 */
export const successResponse = <T = any>(
  res: Response,
  data?: T,
  message: string = 'Operación exitosa',
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data })
  };

  res.status(statusCode).json(response);
};

/**
 * Respuesta de error estándar
 */
export const errorResponse = (
  res: Response,
  message: string = 'Error interno del servidor',
  statusCode: number = 500,
  errorCode?: string,
  details?: any
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code: errorCode || 'INTERNAL_ERROR',
      ...(details && { details })
    }
  };

  res.status(statusCode).json(response);
};

/**
 * Respuesta de creación exitosa
 */
export const createdResponse = <T = any>(
  res: Response,
  data: T,
  message: string = 'Recurso creado exitosamente'
): void => {
  successResponse(res, data, message, 201);
};

/**
 * Respuesta de actualización exitosa
 */
export const updatedResponse = <T = any>(
  res: Response,
  data?: T,
  message: string = 'Recurso actualizado exitosamente'
): void => {
  successResponse(res, data, message, 200);
};

/**
 * Respuesta de eliminación exitosa
 */
export const deletedResponse = (
  res: Response,
  message: string = 'Recurso eliminado exitosamente'
): void => {
  successResponse(res, null, message, 200);
};

/**
 * Respuesta de recurso no encontrado
 */
export const notFoundResponse = (
  res: Response,
  message: string = 'Recurso no encontrado'
): void => {
  errorResponse(res, message, 404, 'RESOURCE_NOT_FOUND');
};

/**
 * Respuesta de acceso no autorizado
 */
export const unauthorizedResponse = (
  res: Response,
  message: string = 'No autorizado'
): void => {
  errorResponse(res, message, 401, 'UNAUTHORIZED');
};

/**
 * Respuesta de acceso prohibido
 */
export const forbiddenResponse = (
  res: Response,
  message: string = 'Acceso prohibido'
): void => {
  errorResponse(res, message, 403, 'FORBIDDEN');
};

/**
 * Respuesta de datos inválidos
 */
export const badRequestResponse = (
  res: Response,
  message: string = 'Datos de entrada inválidos',
  details?: any
): void => {
  errorResponse(res, message, 400, 'BAD_REQUEST', details);
};

/**
 * Respuesta de conflicto (recurso duplicado)
 */
export const conflictResponse = (
  res: Response,
  message: string = 'Recurso duplicado',
  details?: any
): void => {
  errorResponse(res, message, 409, 'CONFLICT', details);
};

/**
 * Respuesta de servicio no disponible
 */
export const serviceUnavailableResponse = (
  res: Response,
  message: string = 'Servicio no disponible temporalmente'
): void => {
  errorResponse(res, message, 503, 'SERVICE_UNAVAILABLE');
};

/**
 * Respuesta paginada
 */
export const paginatedResponse = <T = any>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  },
  message: string = 'Datos obtenidos exitosamente'
): void => {
  const response: ApiResponse = {
    success: true,
    message,
    data: {
      items: data,
      pagination
    }
  };

  res.status(200).json(response);
};