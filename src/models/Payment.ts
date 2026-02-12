import { Schema, model } from 'mongoose';
import { IPayment } from '../types';

const PaymentSchema = new Schema<IPayment>({
  quote: {
    type: Schema.Types.ObjectId,
    ref: 'Quote',
    required: [true, 'El presupuesto es requerido'],
    unique: true // Un pago por presupuesto
  },
  mercadopagoId: {
    type: String,
    required: [true, 'El ID de MercadoPago es requerido'],
    unique: true,
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'cancelled'],
      message: 'El estado debe ser: pending, approved, rejected o cancelled'
    },
    default: 'pending'
  },
  amount: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0.01, 'El monto debe ser mayor a 0'],
    validate: {
      validator: function(amount: number) {
        return Number.isFinite(amount) && amount > 0;
      },
      message: 'El monto debe ser un número válido mayor a 0'
    }
  },
  paymentMethod: {
    type: String,
    trim: true,
    maxlength: [100, 'El método de pago no puede exceder 100 caracteres']
  },
  qrCode: {
    type: String, // Base64 o URL del QR code
    trim: true
  },
  qrCodeData: {
    type: String, // Data string del QR code
    trim: true
  },
  externalReference: {
    type: String,
    required: [true, 'La referencia externa es requerida'],
    trim: true,
    unique: true
  },
  webhookData: {
    type: Schema.Types.Mixed, // Almacenar la data completa del webhook
    default: null
  },
  paidAt: {
    type: Date,
    validate: {
      validator: function(date: Date) {
        if (!date) return true; // paidAt es opcional
        return date <= new Date(); // No puede ser fecha futura
      },
      message: 'La fecha de pago no puede ser futura'
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices para mejorar rendimiento
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ paidAt: -1 });

// Middleware pre-save para validar que no existe otro pago para el mismo presupuesto
PaymentSchema.pre('save', async function(next) {
  if (!this.isModified('quote') && !this.isNew) {
    return next();
  }

  try {
    const existingPayment = await (this.constructor as any).findOne({
      quote: this.quote,
      _id: { $ne: this._id }
    });

    if (existingPayment) {
      const error = new Error('Ya existe un pago para este presupuesto');
      (error as any).status = 400;
      return next(error);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Middleware pre-save para generar referencia externa automáticamente
PaymentSchema.pre('save', function(next) {
  if (this.isNew && !this.externalReference) {
    this.externalReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Middleware pre-save para establecer paidAt cuando el estado cambia a approved
PaymentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'approved' && !this.paidAt) {
      this.paidAt = new Date();
    } else if (this.status !== 'approved') {
      this.paidAt = null as any;
    }
  }
  next();
});

// Método de instancia para generar referencia externa única
PaymentSchema.methods.generateExternalReference = function(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PAY-${timestamp}-${random}`;
};

// Método estático para buscar pagos por estado
PaymentSchema.statics.findByStatus = function(status: string, options: any = {}) {
  return this.find({
    status,
    ...options
  }).populate('quote').sort({ createdAt: -1 });
};

// Método estático para buscar pagos pendientes antiguos (más de 1 hora)
PaymentSchema.statics.findOldPendingPayments = function(hours: number = 1) {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hours);

  return this.find({
    status: 'pending',
    createdAt: { $lte: cutoffTime }
  });
};

// Método estático para obtener estadísticas de pagos
PaymentSchema.statics.getPaymentStats = function(dateFrom?: Date, dateTo?: Date) {
  const matchStage: any = {};

  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = dateFrom;
    if (dateTo) matchStage.createdAt.$lte = dateTo;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Virtual para verificar si está aprobado
PaymentSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

// Virtual para verificar si está pendiente
PaymentSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

// Virtual para tiempo transcurrido desde la creación (en minutos)
PaymentSchema.virtual('minutesSinceCreated').get(function() {
  const now = new Date();
  const diff = now.getTime() - this.createdAt.getTime();
  return Math.floor(diff / (1000 * 60));
});

// Virtual para formatear el monto
PaymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(this.amount);
});

// Incluir virtuals en JSON
PaymentSchema.set('toJSON', { virtuals: true });
PaymentSchema.set('toObject', { virtuals: true });

// Transformar el output JSON para limpiar datos sensibles si es necesario
PaymentSchema.methods.toJSON = function() {
  const payment = this.toObject({ virtuals: true });

  // En producción, podríamos querer ocultar ciertos campos
  if (process.env.NODE_ENV === 'production') {
    // Ejemplo: ocultar webhookData si contiene información sensible
    // delete payment.webhookData;
  }

  return payment;
};

// Crear el modelo
const Payment = model<IPayment>('Payment', PaymentSchema);

export default Payment;