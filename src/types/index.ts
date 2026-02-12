import { Request } from 'express';
import { Document, Types } from 'mongoose';

// Tipos para el usuario
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'seller';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Tipos para el producto
export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  sku?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  validateStock(quantity: number): boolean;
  decrementStock(quantity: number): Promise<void>;
}

// Tipos para items del presupuesto
export interface IQuoteItem {
  product: Types.ObjectId | IProduct;
  productSnapshot: {
    name: string;
    price: number;
  };
  quantity: number;
  subtotal: number;
}

// Tipos para el presupuesto
export interface IQuote extends Document {
  _id: Types.ObjectId;
  quoteNumber: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: IQuoteItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  paymentId?: Types.ObjectId;
  expiresAt: Date;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  generateQuoteNumber(): string;
  calculateTotals(): void;
  validateStockBeforeCreate(): Promise<boolean>;
}

// Tipos para el pago
export interface IPayment extends Document {
  _id: Types.ObjectId;
  quote: Types.ObjectId;
  mercadopagoId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  amount: number;
  paymentMethod?: string;
  qrCode?: string;
  qrCodeData?: string;
  externalReference: string;
  webhookData?: any;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Extensión del Request de Express para incluir usuario autenticado
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'seller';
  };
}

// Tipos para respuestas estandarizadas de la API
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
}

// Tipos para paginación
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Tipos para filtros de productos
export interface ProductFilters extends PaginationQuery {
  category?: string;
  search?: string;
  lowStock?: string;
  isActive?: string;
}

// Tipos para filtros de presupuestos
export interface QuoteFilters extends PaginationQuery {
  status?: 'pending' | 'paid' | 'cancelled' | 'expired';
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Tipos para creación de presupuesto
export interface CreateQuoteRequest {
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  discount?: number;
  tax?: number;
  notes?: string;
}

// Tipos para creación de producto
export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  sku?: string;
  imageUrl?: string;
}

// Tipos para login
export interface LoginRequest {
  email: string;
  password: string;
}

// Tipos para registro
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'seller';
}

// Tipos para JWT payload
export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'seller';
  iat?: number;
  exp?: number;
}

// Tipos para validación de stock
export interface StockValidationResult {
  isValid: boolean;
  errors: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

// Tipos para MercadoPago
export interface MercadoPagoPreference {
  items: Array<{
    title: string;
    unit_price: number;
    quantity: number;
    currency_id: string;
  }>;
  external_reference: string;
  notification_url?: string;
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
}

export interface MercadoPagoWebhook {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: string;
}

// Enum para estados
export enum QuoteStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum UserRole {
  ADMIN = 'admin',
  SELLER = 'seller'
}