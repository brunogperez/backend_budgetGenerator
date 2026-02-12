# 📋 Generador de Presupuestos - Backend

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![MercadoPago](https://img.shields.io/badge/MercadoPago-00B1EA?style=for-the-badge&logo=mercadopago&logoColor=white)](https://www.mercadopago.com/)

> Sistema backend robusto para la gestión completa de presupuestos empresariales con integración de pagos en tiempo real mediante MercadoPago.

## ✨ Características Principales

- 🔐 **Autenticación y Autorización** - Sistema JWT con roles diferenciados (admin/seller)
- 📦 **Gestión de Productos** - CRUD completo con control de inventario y stock
- 📋 **Sistema de Presupuestos** - Generación automática con cálculos dinámicos
- 💳 **Integración MercadoPago** - Procesamiento de pagos, webhooks y códigos QR
- 🛡️ **Seguridad Avanzada** - Helmet, CORS, rate limiting y validaciones
- 📊 **Logging y Monitoreo** - Sistema estructurado con Winston
- 🚀 **API RESTful** - Documentación completa y respuestas estandarizadas

## 🛠️ Stack Tecnológico

| Categoría | Tecnología | Versión | Descripción |
|-----------|------------|---------|-------------|
| **Runtime** | Node.js | v18+ | Entorno de ejecución JavaScript |
| **Framework** | Express.js | ^4.18.2 | Framework web minimalista |
| **Lenguaje** | TypeScript | ^5.3.3 | Superset tipado de JavaScript |
| **Base de datos** | MongoDB | - | Base de datos NoSQL |
| **ODM** | Mongoose | ^8.0.3 | Modelado de objetos MongoDB |
| **Autenticación** | JWT | ^9.0.2 | JSON Web Tokens |
| **Validación** | express-validator | ^7.0.1 | Middleware de validación |
| **Logging** | Winston | ^3.11.0 | Logger para aplicaciones |
| **Seguridad** | Helmet | ^7.1.0 | Middleware de seguridad |
| **Pagos** | MercadoPago | ^2.0.9 | SDK oficial de MercadoPago |
| **Desarrollo** | Nodemon + ts-node | - | Herramientas de desarrollo |

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # Configuración de MongoDB
│   │   └── mercadopago.ts       # Configuración de MercadoPago
│   ├── controllers/
│   │   ├── authController.ts     # Controlador de autenticación
│   │   ├── productController.ts  # Controlador de productos
│   │   ├── quoteController.ts    # Controlador de presupuestos
│   │   └── paymentController.ts  # Controlador de pagos con MercadoPago
│   ├── middleware/
│   │   ├── auth.middleware.ts    # Middleware de autenticación
│   │   ├── validation.middleware.ts # Middleware de validación
│   │   └── error.middleware.ts   # Middleware de manejo de errores
│   ├── models/
│   │   ├── User.ts              # Modelo de usuario
│   │   ├── Product.ts           # Modelo de producto
│   │   ├── Quote.ts             # Modelo de presupuesto
│   │   └── Payment.ts           # Modelo de pago
│   ├── routes/
│   │   ├── auth.routes.ts       # Rutas de autenticación
│   │   ├── product.routes.ts    # Rutas de productos
│   │   ├── quote.routes.ts      # Rutas de presupuestos
│   │   └── payment.routes.ts    # Rutas de pagos con webhooks
│   ├── services/
│   │   ├── mercadopago.service.ts # Servicio MercadoPago
│   │   └── stock.service.ts     # Gestión de stock atómica
│   ├── types/
│   │   └── index.ts             # Tipos TypeScript
│   ├── utils/
│   │   ├── logger.ts            # Configuración de logging
│   │   └── responses.ts         # Respuestas estandarizadas
│   └── server.ts                # Servidor principal
├── logs/                        # Archivos de log
├── .env.example                 # Ejemplo de variables de entorno
├── .gitignore                   # Archivos a ignorar por Git
├── package.json                 # Dependencias y scripts
├── tsconfig.json                # Configuración de TypeScript
└── README.md                    # Este archivo
```

## 🔧 Instalación y Configuración

### 1. Clonar el repositorio y navegar a la carpeta

```bash
cd backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:

```bash
# Variables principales a configurar
MONGODB_URI=mongodb://localhost:27017/presupuestos
JWT_SECRET=tu-secreto-jwt-super-seguro
MERCADOPAGO_ACCESS_TOKEN=TEST-tu-token-aqui
MERCADOPAGO_PUBLIC_KEY=TEST-tu-clave-aqui
```

### 4. Configurar MongoDB

**Opción A: MongoDB Local**
```bash
# Instalar MongoDB localmente
# macOS: brew install mongodb-community
# Windows: Descargar desde https://www.mongodb.com/download-center/community
# Linux: sudo apt install mongodb

# Iniciar MongoDB
mongod
```

**Opción B: MongoDB Atlas (Recomendado)**
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear un cluster gratuito
3. Obtener la URI de conexión
4. Actualizar `MONGODB_URI` en el archivo `.env`

### 5. Iniciar el servidor

**Desarrollo:**
```bash
npm run dev
```

**Producción:**
```bash
npm run build
npm start
```

## 🔧 Inicio Rápido

### Prerrequisitos

- [![Node.js](https://img.shields.io/badge/Node.js-v18+-green)](https://nodejs.org/) Node.js v18 o superior
- [![MongoDB](https://img.shields.io/badge/MongoDB-latest-green)](https://www.mongodb.com/) MongoDB local o MongoDB Atlas
- [![MercadoPago](https://img.shields.io/badge/MercadoPago-Developer_Account-blue)](https://developers.mercadopago.com/) Cuenta de desarrollador MercadoPago

### Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd generadorDePresupuestos/backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 4. Iniciar en modo desarrollo
npm run dev
```

## 📚 Documentación de la API

### Base URL
```
http://localhost:3000/api
```

### Endpoints Disponibles

### 🔐 Autenticación
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Registrar nuevo usuario | ❌ |
| `POST` | `/auth/login` | Iniciar sesión | ❌ |
| `GET` | `/auth/me` | Información del usuario | ✅ |
| `PUT` | `/auth/me` | Actualizar información | ✅ |
| `PUT` | `/auth/change-password` | Cambiar contraseña | ✅ |

### 📦 Productos
| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| `GET` | `/products` | Listar productos | ✅ | - |
| `GET` | `/products/:id` | Obtener producto | ✅ | - |
| `POST` | `/products` | Crear producto | ✅ | admin |
| `PUT` | `/products/:id` | Actualizar producto | ✅ | admin |
| `DELETE` | `/products/:id` | Eliminar producto | ✅ | admin |
| `GET` | `/products/categories` | Obtener categorías | ✅ | - |
| `GET` | `/products/low-stock` | Stock bajo | ✅ | admin |

### 📋 Presupuestos
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `GET` | `/quotes` | Listar presupuestos | ✅ |
| `POST` | `/quotes` | Crear presupuesto | ✅ |
| `GET` | `/quotes/:id` | Obtener presupuesto | ✅ |
| `PUT` | `/quotes/:id/cancel` | Cancelar presupuesto | ✅ |
| `GET` | `/quotes/stats` | Estadísticas | ✅ |
| `GET` | `/quotes/customer/:email` | Por cliente | ✅ |

### 💳 Pagos
| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| `POST` | `/payments/create` | Crear orden | ✅ | - |
| `GET` | `/payments/:id/status` | Estado del pago | ✅ | - |
| `POST` | `/payments/webhook` | Webhook MP | ❌ | - |
| `POST` | `/payments/:id/cancel` | Cancelar pago | ✅ | - |
| `GET` | `/payments` | Listar pagos | ✅ | admin |
| `GET` | `/payments/stats` | Estadísticas | ✅ | admin |

### Ejemplo de Uso

#### 1. Registrar usuario administrador
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123",
    "name": "Administrador",
    "role": "admin"
  }'
```

#### 2. Iniciar sesión
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123"
  }'
```

#### 3. Crear producto (usar token del login)
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -d '{
    "name": "Laptop HP",
    "description": "Laptop HP Pavilion 15",
    "price": 45000,
    "stock": 10,
    "category": "Electrónicos",
    "sku": "HP-PAV-15"
  }'
```

#### 4. Crear presupuesto
```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -d '{
    "customer": {
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+54 9 11 1234-5678"
    },
    "items": [{
      "productId": "PRODUCT_ID_AQUI",
      "quantity": 2
    }],
    "discount": 10,
    "tax": 21,
    "notes": "Cliente frecuente"
  }'
```

#### 5. Crear orden de pago con MercadoPago
```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -d '{
    "quoteId": "QUOTE_ID_DEL_PASO_4"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Orden de pago creada exitosamente",
  "data": {
    "paymentId": "...",
    "preferenceId": "MP_PREFERENCE_ID",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "qrCodeData": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
    "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
    "amount": 98280,
    "expiresAt": "2024-01-16T10:30:00.000Z"
  }
}
```

## 🔒 Autenticación y Autorización

### Roles de Usuario

- **admin**: Acceso completo a todas las funcionalidades
- **seller**: Puede gestionar productos y presupuestos

### Uso del Token JWT

Incluir el token en el header de autorización:
```
Authorization: Bearer <tu_jwt_token>
```

## 🚦 Scripts Disponibles

```bash
# Desarrollo con recarga automática
npm run dev

# Compilar TypeScript
npm run build

# Ejecutar en producción
npm start

# Verificar sintaxis y tipos
npm run lint

# Ejecutar tests (cuando estén implementados)
npm test
```

## 📊 Health Check

Verificar que el servidor esté funcionando:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Servidor funcionando correctamente",
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 120,
    "environment": "development",
    "version": "1.0.0"
  }
}
```

## 🗃️ Modelos de Datos

### Usuario (User)
```typescript
{
  email: string (único)
  password: string (hasheado)
  name: string
  role: 'admin' | 'seller'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Producto (Product)
```typescript
{
  name: string
  description: string
  price: number
  stock: number
  category: string
  sku?: string (único)
  imageUrl?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Presupuesto (Quote)
```typescript
{
  quoteNumber: string (autogenerado)
  customer: {
    name: string
    email?: string
    phone?: string
  }
  items: [{
    product: ObjectId
    productSnapshot: { name, price }
    quantity: number
    subtotal: number
  }]
  subtotal: number
  tax: number
  discount: number
  total: number
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  paymentId?: ObjectId
  expiresAt: Date
  notes?: string
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

### Pago (Payment)
```typescript
{
  quote: ObjectId
  mercadopagoId: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  amount: number
  paymentMethod?: string
  qrCode?: string
  qrCodeData?: string
  externalReference: string
  webhookData?: any
  paidAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

## ⚠️ Consideraciones de Seguridad

1. **Variables de entorno**: Nunca commitear archivos `.env`
2. **JWT Secret**: Usar un secreto robusto en producción (mínimo 32 caracteres)
3. **HTTPS**: Usar HTTPS en producción
4. **Rate Limiting**: Configurado para prevenir ataques de fuerza bruta
5. **Validación**: Todas las entradas son validadas y sanitizadas
6. **Logs**: No loggear información sensible

## 💳 Integración MercadoPago

### 🎯 Estado de Implementación
| Característica | Estado | Descripción |
|----------------|--------|-------------|
| SDK v2.0 | ✅ | Configurado para TEST y PROD |
| QR Codes | ✅ | Generación dinámica en base64 |
| Webhooks | ✅ | Procesamiento con validación |
| Stock Atómico | ✅ | Transacciones MongoDB |
| Estados Auto | ✅ | pending → approved → decremented |

### ⚙️ Configuración Rápida

1. **Credenciales de desarrollo** → [MercadoPago Developers](https://developers.mercadopago.com/)
2. **Variables de entorno**:
   ```bash
   MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx
   MERCADOPAGO_PUBLIC_KEY=TEST-xxxx
   MERCADOPAGO_WEBHOOK_URL=https://tu-ngrok.ngrok.io/api/payments/webhook
   ```

3. **Testing local**:
   ```bash
   npx ngrok http 3000  # Exponer servidor local
   ```

### 🔄 Flujo de Pago

```mermaid
graph LR
    A[Cliente] -->|POST /payments/create| B[Backend]
    B -->|Valida Stock| C[MercadoPago API]
    C -->|Preferencia + QR| B
    B -->|QR Code| A
    A -->|Escanea QR| D[MercadoPago]
    D -->|Webhook| B
    B -->|Actualiza Stock| E[MongoDB]
```

### 📚 Documentación Adicional
- [📖 Integración Completa](./MERCADOPAGO_INTEGRATION.md)
- [🧪 Guía de Testing](./TESTING_GUIDE.md)
- [🔧 Ejemplos de API](./API_EXAMPLES.md)

## 🐛 Troubleshooting

### Error de conexión a MongoDB
```
Error: MongooseServerSelectionError
```
**Solución**: Verificar que MongoDB esté ejecutándose y la URI sea correcta.

### Error de JWT
```
Error: JsonWebTokenError: invalid signature
```
**Solución**: Verificar que `JWT_SECRET` esté configurado correctamente.

### Error de CORS
```
Access to XMLHttpRequest has been blocked by CORS policy
```
**Solución**: Agregar la URL del frontend a `FRONTEND_URL` en `.env`.

### Error de MercadoPago
```
MERCADOPAGO_ACCESS_TOKEN no está configurado
```
**Solución**: Verificar credenciales en `.env` - deben empezar con `TEST-` o `APP-`.

### Error de Webhook
```
Webhook signature invalid
```
**Solución**: Verificar que ngrok esté corriendo y la URL webhook sea pública.

## 📝 Logs

Los logs se almacenan en la carpeta `logs/`:
- `error.log` - Solo errores
- `combined.log` - Todos los logs

## 🚀 Despliegue en Producción

### 📋 Checklist de Producción

- [ ] **Entorno configurado** con variables seguras
- [ ] **Base de datos** MongoDB Atlas configurada
- [ ] **Credenciales MP** de producción (APP-xxx)
- [ ] **Webhook público** configurado
- [ ] **SSL/HTTPS** habilitado
- [ ] **Logs** configurados
- [ ] **Monitoreo** implementado

### 🔐 Variables de Producción

```bash
# Entorno
NODE_ENV=production

# Base de datos
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/presupuestos-prod

# Seguridad
JWT_SECRET=secreto-super-seguro-de-produccion-32-chars-minimo

# MercadoPago Producción
MERCADOPAGO_ACCESS_TOKEN=APP-tu-token-de-produccion
MERCADOPAGO_PUBLIC_KEY=APP-tu-clave-publica-de-produccion
MERCADOPAGO_WEBHOOK_URL=https://tu-dominio.com/api/payments/webhook
```

### 📦 Comandos de Despliegue

```bash
# Construir aplicación
npm run build

# Verificar build
npm run lint

# Iniciar en producción
npm start
```

### 🐳 Docker (Opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork del proyecto
2. Crear feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Add: nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**Bruno** - Desarrollo completo del sistema backend

## 📞 Soporte

Para soporte o consultas:
- 📧 Email: [contacto]
- 📚 Documentación: Ver archivos MD del proyecto
- 🐛 Issues: Reportar en el repositorio

---

<div align="center">

**🎉 Sistema backend completo y funcional**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)]()
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)]()
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)]()

</div>#   b a c k e n d _ b u d g e t G e n e r a t o r  
 