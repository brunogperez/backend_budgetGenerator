import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'El formato del email no es válido'
    }
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // Por defecto no incluir en las consultas
  },
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'seller'],
      message: 'El rol debe ser admin o seller'
    },
    default: 'seller'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true, // Agrega createdAt y updatedAt automáticamente
  versionKey: false // Remueve el campo __v
});

// Índices para mejorar rendimiento
UserSchema.index({ role: 1, isActive: 1 });

// Middleware pre-save para hashear la contraseña
UserSchema.pre('save', async function(next) {
  // Solo hashear si la contraseña fue modificada
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generar salt y hashear la contraseña
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Middleware pre-save para validar email único
UserSchema.pre('save', async function(next) {
  if (!this.isModified('email') && !this.isNew) {
    return next();
  }

  try {
    const existingUser = await (this.constructor as any).findOne({
      email: this.email,
      _id: { $ne: this._id }
    });

    if (existingUser) {
      const error = new Error('Ya existe un usuario con este email');
      (error as any).status = 400;
      return next(error);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Método de instancia para comparar contraseñas
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Método estático para encontrar usuario por email con contraseña
UserSchema.statics.findByEmailWithPassword = function(email: string) {
  return this.findOne({ email, isActive: true }).select('+password');
};

// Transformar el output JSON para remover campos sensibles
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Crear el modelo
const User = model<IUser>('User', UserSchema);

export default User;