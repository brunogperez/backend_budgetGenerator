import { Schema, model } from 'mongoose';
import { IQuote, IQuoteItem } from '../types';
import Product from './Product';

// Schema para items del presupuesto
const QuoteItemSchema = new Schema<IQuoteItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es requerido']
  },
  productSnapshot: {
    name: {
      type: String,
      required: [true, 'El nombre del producto en snapshot es requerido']
    },
    price: {
      type: Number,
      required: [true, 'El precio del producto en snapshot es requerido'],
      min: [0, 'El precio no puede ser negativo']
    }
  },
  quantity: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [1, 'La cantidad debe ser al menos 1'],
    validate: {
      validator: function(quantity: number) {
        return Number.isInteger(quantity) && quantity > 0;
      },
      message: 'La cantidad debe ser un número entero positivo'
    }
  },
  subtotal: {
    type: Number,
    required: [true, 'El subtotal es requerido'],
    min: [0, 'El subtotal no puede ser negativo']
  }
}, { _id: false }); // No generar _id para subdocumentos

const QuoteSchema = new Schema<IQuote>({
  quoteNumber: {
    type: String,
    unique: true,
    trim: true
    // NO required - se genera automáticamente
  },
  customer: {
    name: {
      type: String,
      required: [true, 'El nombre del cliente es requerido'],
      trim: true,
      maxlength: [200, 'El nombre no puede exceder 200 caracteres']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email: string) {
          if (!email) return true; // Email es opcional
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'El formato del email no es válido'
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(phone: string) {
          if (!phone) return true; // Teléfono es opcional
          return /^[\+]?[0-9\s\-\(\)]+$/.test(phone);
        },
        message: 'El formato del teléfono no es válido'
      }
    }
  },
  items: {
    type: [QuoteItemSchema],
    required: [true, 'Los items son requeridos'],
    validate: {
      validator: function(items: IQuoteItem[]) {
        return items.length > 0;
      },
      message: 'Debe incluir al menos un item'
    }
  },
  subtotal: {
    type: Number,
    required: [true, 'El subtotal es requerido'],
    min: [0, 'El subtotal no puede ser negativo'],
    default: 0
  },
  tax: {
    type: Number,
    min: [0, 'El impuesto no puede ser negativo'],
    max: [100, 'El impuesto no puede ser mayor a 100%'],
    default: 0
  },
  discount: {
    type: Number,
    min: [0, 'El descuento no puede ser negativo'],
    max: [100, 'El descuento no puede ser mayor a 100%'],
    default: 0
  },
  total: {
    type: Number,
    required: [true, 'El total es requerido'],
    min: [0, 'El total no puede ser negativo'],
    default: 0
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'cancelled', 'expired'],
      message: 'El estado debe ser: pending, paid, cancelled o expired'
    },
    default: 'pending'
  },
  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },
  expiresAt: {
    type: Date,
    index: true,
    validate: {
      validator: function(date: Date) {
        if (!date) return true; // Permitir undefined, se genera automáticamente
        return date > new Date();
      },
      message: 'La fecha de expiración debe ser futura'
    }
    // NO required - se genera automáticamente
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las notas no pueden exceder 1000 caracteres']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario creador es requerido']
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices para mejorar rendimiento
QuoteSchema.index({ status: 1, createdAt: -1 });
QuoteSchema.index({ 'customer.email': 1 });
QuoteSchema.index({ 'customer.name': 'text' });
QuoteSchema.index({ createdBy: 1, status: 1 });
QuoteSchema.index({ expiresAt: 1, status: 1 });

// Pre-validate hook para generar campos automáticos ANTES de la validación
QuoteSchema.pre('validate', function(next) {
  // Generar quoteNumber si es nuevo
  if (this.isNew && !this.quoteNumber) {
    this.quoteNumber = this.generateQuoteNumber();
  }

  // Generar expiresAt si es nuevo y no existe
  if (this.isNew && !this.expiresAt) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 días por defecto
    this.expiresAt = expirationDate;
  }

  next();
});

// Pre-save hook para calcular totales
QuoteSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

// Método de instancia para generar número de presupuesto
QuoteSchema.methods.generateQuoteNumber = function(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');

  return `QT-${year}${month}${day}-${random}`;
};

// Método de instancia para calcular totales
QuoteSchema.methods.calculateTotals = function(): void {
  // Calcular subtotal sumando todos los items
  this.subtotal = this.items.reduce((sum: number, item: IQuoteItem) => {
    // Actualizar subtotal del item
    item.subtotal = item.productSnapshot.price * item.quantity;
    return sum + item.subtotal;
  }, 0);

  // Aplicar descuento
  const discountAmount = (this.subtotal * this.discount) / 100;
  const afterDiscount = this.subtotal - discountAmount;

  // Aplicar impuestos
  const taxAmount = (afterDiscount * this.tax) / 100;

  // Total final
  this.total = afterDiscount + taxAmount;

  // Redondear a 2 decimales
  this.subtotal = Math.round(this.subtotal * 100) / 100;
  this.total = Math.round(this.total * 100) / 100;
};

// Método de instancia para validar stock antes de crear
QuoteSchema.methods.validateStockBeforeCreate = async function(): Promise<boolean> {
  try {
    for (const item of this.items) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Producto ${item.product} no encontrado`);
      }
      if (!product.validateStock(item.quantity)) {
        throw new Error(`Stock insuficiente para producto ${product.name}`);
      }
    }
    return true;
  } catch (error) {
    throw error;
  }
};

// Método estático para buscar presupuestos por cliente
QuoteSchema.statics.findByCustomer = function(customerEmail: string) {
  return this.find({
    'customer.email': customerEmail
  }).sort({ createdAt: -1 });
};

// Método estático para buscar presupuestos próximos a expirar
QuoteSchema.statics.findExpiringQuotes = function(days: number = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return this.find({
    status: 'pending',
    expiresAt: { $lte: date }
  });
};

// Método estático para expirar presupuestos vencidos
QuoteSchema.statics.expireOldQuotes = function() {
  return this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lte: new Date() }
    },
    {
      status: 'expired'
    }
  );
};

// Virtual para verificar si está expirado
QuoteSchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date() && this.status === 'pending';
});

// Virtual para días hasta expiración
QuoteSchema.virtual('daysUntilExpiration').get(function() {
  const now = new Date();
  const diff = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Incluir virtuals en JSON
QuoteSchema.set('toJSON', { virtuals: true });
QuoteSchema.set('toObject', { virtuals: true });

// Crear el modelo
const Quote = model<IQuote>('Quote', QuoteSchema);

export default Quote;