import { Schema, model } from 'mongoose';
import { IProduct } from '../types';

const ProductSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [200, 'El nombre no puede exceder 200 caracteres']
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
  },
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo'],
    validate: {
      validator: function(price: number) {
        // Validar que tiene máximo 2 decimales
        return Number.isFinite(price) && price >= 0;
      },
      message: 'El precio debe ser un número válido'
    }
  },
  stock: {
    type: Number,
    required: [true, 'El stock es requerido'],
    min: [0, 'El stock no puede ser negativo'],
    validate: {
      validator: function(stock: number) {
        return Number.isInteger(stock) && stock >= 0;
      },
      message: 'El stock debe ser un número entero no negativo'
    }
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    trim: true,
    maxlength: [100, 'La categoría no puede exceder 100 caracteres']
  },
  sku: {
    type: String,
    unique: true,
    sparse: true, // Permite valores null únicos
    trim: true,
    maxlength: [50, 'El SKU no puede exceder 50 caracteres'],
    validate: {
      validator: function(sku: string) {
        if (!sku) return true; // SKU es opcional
        // Validar formato alfanumérico con guiones
        return /^[A-Za-z0-9\-_]+$/.test(sku);
      },
      message: 'El SKU solo puede contener letras, números, guiones y guiones bajos'
    }
  },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(url: string) {
        if (!url) return true; // URL es opcional
        // Validar formato básico de URL
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: 'La URL de la imagen no es válida'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices para mejorar rendimiento de búsquedas
ProductSchema.index({ name: 'text', description: 'text' }); // Búsqueda de texto
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ stock: 1, isActive: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ createdAt: -1 });

// Middleware pre-save para validar SKU único
ProductSchema.pre('save', async function(next) {
  if (!this.isModified('sku') && !this.isNew) {
    return next();
  }

  if (this.sku) {
    try {
      const existingProduct = await (this.constructor as any).findOne({
        sku: this.sku,
        _id: { $ne: this._id }
      });

      if (existingProduct) {
        const error = new Error('Ya existe un producto con este SKU');
        (error as any).status = 400;
        return next(error);
      }
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

// Método de instancia para validar stock disponible
ProductSchema.methods.validateStock = function(quantity: number): boolean {
  return this.stock >= quantity && quantity > 0;
};

// Método de instancia para decrementar stock (operación atómica)
ProductSchema.methods.decrementStock = async function(quantity: number): Promise<void> {
  const result = await (this.constructor as any).findByIdAndUpdate(
    this._id,
    {
      $inc: { stock: -quantity }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!result) {
    throw new Error('Producto no encontrado');
  }

  if (result.stock < 0) {
    // Revertir la operación si el stock resultó negativo
    await (this.constructor as any).findByIdAndUpdate(
      this._id,
      {
        $inc: { stock: quantity }
      }
    );
    throw new Error('Stock insuficiente');
  }

  // Actualizar el objeto actual
  this.stock = result.stock;
};

// Método estático para buscar productos con stock bajo
ProductSchema.statics.findLowStock = function(threshold: number = 10) {
  return this.find({
    stock: { $lte: threshold },
    isActive: true
  }).sort({ stock: 1 });
};

// Método estático para buscar por categoría
ProductSchema.statics.findByCategory = function(category: string, options: any = {}) {
  return this.find({
    category: new RegExp(category, 'i'),
    isActive: true,
    ...options
  });
};

// Virtual para indicar si el stock está bajo
ProductSchema.virtual('isLowStock').get(function() {
  return this.stock <= 10;
});

// Asegurar que los virtuals se incluyan en JSON
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

// Crear el modelo
const Product = model<IProduct>('Product', ProductSchema);

export default Product;