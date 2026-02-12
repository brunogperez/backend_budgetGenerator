# 🧪 Guía de Testing - Sistema de Presupuestos con MercadoPago

## 📋 Resumen

Esta guía te ayudará a probar la integración completa con MercadoPago, desde la configuración inicial hasta el flujo completo de pagos.

## 🚀 Configuración Inicial

### 1. Instalación y Setup

```bash
# 1. Clonar e instalar dependencias
cd backend
npm install

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Editar .env con credenciales de TEST
MERCADOPAGO_ACCESS_TOKEN=TEST-4389086729399925-110910-5e2e02e1b5fc04e9aef67e86ba5a0abe-1265043745
MERCADOPAGO_PUBLIC_KEY=TEST-0b9ba0fd-1234-4567-8910-abcdef123456
MONGODB_URI=mongodb://localhost:27017/presupuestos-test
JWT_SECRET=super-secreto-para-testing
```

### 2. Configurar MongoDB

```bash
# Opción A: MongoDB local
mongod

# Opción B: MongoDB Atlas (recomendado)
# Crear cluster gratuito en https://www.mongodb.com/atlas
# Copiar URI de conexión al .env
```

### 3. Configurar Webhook (para testing completo)

```bash
# Instalar ngrok para exponer localhost
npm install -g ngrok

# En otra terminal, exponer puerto 3000
ngrok http 3000

# Copiar URL de ngrok al .env
MERCADOPAGO_WEBHOOK_URL=https://abc123.ngrok.io/api/payments/webhook
```

## 🛠️ Testing del Backend

### 1. Verificar que el servidor inicia correctamente

```bash
npm run dev
```

**Respuesta esperada:**
```
🚀 Servidor iniciado en puerto 3000
📍 URL: http://localhost:3000
🌍 Entorno: development
📋 Health check: http://localhost:3000/health
MongoDB conectado exitosamente: cluster.mongodb.net
MercadoPago configurado exitosamente
```

### 2. Health Check

```bash
curl http://localhost:3000/health
```

**Respuesta esperada:**
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

## 🔐 Testing de Autenticación

### 1. Registrar Usuario Admin

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Password123",
    "name": "Test Admin",
    "role": "admin"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "id": "...",
      "email": "admin@test.com",
      "name": "Test Admin",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Password123"
  }'
```

**💾 Guardar el token devuelto para usar en siguientes requests**

## 🛍️ Testing de Productos

### 1. Crear Producto

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "name": "Laptop HP Test",
    "description": "Laptop para testing de pagos",
    "price": 150000,
    "stock": 10,
    "category": "Electrónicos",
    "sku": "HP-TEST-001"
  }'
```

**💾 Guardar el ID del producto devuelto**

### 2. Listar Productos

```bash
curl -X GET "http://localhost:3000/api/products?page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### 3. Verificar Stock Bajo

```bash
curl -X GET http://localhost:3000/api/products/low-stock \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 📋 Testing de Presupuestos

### 1. Crear Presupuesto

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "customer": {
      "name": "Cliente Test",
      "email": "cliente@test.com",
      "phone": "+54 9 11 1234-5678"
    },
    "items": [{
      "productId": "ID_DEL_PRODUCTO_CREADO",
      "quantity": 2
    }],
    "discount": 10,
    "tax": 21,
    "notes": "Presupuesto de prueba"
  }'
```

**Verificaciones:**
- ✅ Que se genera `quoteNumber` automáticamente
- ✅ Que se calculan correctamente los totales
- ✅ Que se valida el stock disponible

**💾 Guardar el ID del presupuesto**

### 2. Listar Presupuestos

```bash
curl -X GET "http://localhost:3000/api/quotes?page=1&status=pending" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### 3. Obtener Presupuesto por ID

```bash
curl -X GET http://localhost:3000/api/quotes/ID_DEL_PRESUPUESTO \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 💳 Testing de Pagos con MercadoPago

### 1. Crear Orden de Pago

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "quoteId": "ID_DEL_PRESUPUESTO"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Orden de pago creada exitosamente",
  "data": {
    "paymentId": "...",
    "preferenceId": "MP-PREFERENCE-ID",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAA...",
    "qrCodeData": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
    "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
    "amount": 327600,
    "expiresAt": "2024-01-16T10:30:00.000Z"
  }
}
```

**Verificaciones importantes:**
- ✅ `preferenceId` empieza con un ID válido de MP
- ✅ `qrCode` es una imagen base64 válida
- ✅ `initPoint` es una URL de MercadoPago válida
- ✅ `amount` coincide con el total del presupuesto

### 2. Verificar QR Code

Puedes verificar el QR code de varias formas:

**Opción A: Guardar imagen**
```bash
# Extraer base64 del QR y convertir a imagen
echo "DATA_BASE64_DEL_QR" | base64 -d > qr_test.png
```

**Opción B: Abrir init_point en navegador**
```bash
# Copiar la URL initPoint y abrirla en el navegador
# Deberías ver la página de pago de MercadoPago
```

### 3. Consultar Estado del Pago

```bash
curl -X GET http://localhost:3000/api/payments/ID_DEL_PAGO/status \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 🎯 Testing del Flujo Completo con Pagos

### Simulación de Pago Aprobado

Para testing, puedes simular un webhook de MercadoPago:

```bash
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "payment.updated",
    "api_version": "v1",
    "data": {
      "id": "123456789"
    },
    "date_created": "2024-01-15T10:30:00.000Z",
    "id": 12345,
    "live_mode": false,
    "type": "payment",
    "user_id": "123456"
  }'
```

**⚠️ Nota:** Para testing completo del webhook, necesitas:
1. Configurar ngrok
2. Actualizar la URL del webhook en tu cuenta de MercadoPago
3. Realizar un pago real con tarjetas de TEST

### Testing con Tarjetas de Prueba

1. **Usar el init_point para abrir la página de pago**
2. **Usar estas tarjetas de prueba:**

| Tarjeta | Número | CVV | Fecha | Resultado |
|---------|--------|-----|-------|-----------|
| Visa | 4509 9535 6623 3704 | 123 | 11/25 | ✅ Aprobado |
| Mastercard | 5031 7557 3453 0604 | 123 | 11/25 | ✅ Aprobado |
| Visa | 4774 0518 4064 5612 | 123 | 11/25 | ❌ Rechazado |

### Verificar Actualización de Stock

Después de un pago aprobado:

```bash
# 1. Verificar que el pago está aprobado
curl -X GET http://localhost:3000/api/payments/ID_DEL_PAGO/status \
  -H "Authorization: Bearer TU_TOKEN_AQUI"

# 2. Verificar que el presupuesto está pagado
curl -X GET http://localhost:3000/api/quotes/ID_DEL_PRESUPUESTO \
  -H "Authorization: Bearer TU_TOKEN_AQUI"

# 3. Verificar que el stock se decrementó
curl -X GET http://localhost:3000/api/products/ID_DEL_PRODUCTO \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 📊 Testing de Estadísticas

### Estadísticas de Pagos

```bash
curl -X GET "http://localhost:3000/api/payments/stats?dateFrom=2024-01-01&dateTo=2024-12-31" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### Estadísticas de Presupuestos

```bash
curl -X GET http://localhost:3000/api/quotes/stats \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 🚨 Testing de Casos de Error

### 1. Stock Insuficiente

```bash
# 1. Crear producto con stock limitado
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "name": "Producto Stock Limitado",
    "description": "Solo 1 en stock",
    "price": 100,
    "stock": 1,
    "category": "Test"
  }'

# 2. Intentar crear presupuesto con cantidad > stock
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "customer": {"name": "Test"},
    "items": [{"productId": "ID_DEL_PRODUCTO", "quantity": 5}]
  }'
```

**Respuesta esperada:** Error 400 con mensaje de stock insuficiente

### 2. Presupuesto Ya Pagado

```bash
# Intentar crear pago para presupuesto ya pagado
curl -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{"quoteId": "ID_DE_PRESUPUESTO_YA_PAGADO"}'
```

### 3. Credenciales MercadoPago Inválidas

```bash
# Temporalmente cambiar el token en .env a algo inválido
MERCADOPAGO_ACCESS_TOKEN=INVALID-TOKEN

# Reiniciar servidor y intentar crear pago
npm run dev
```

## 📝 Checklist de Testing

### Testing Básico ✅
- [ ] Servidor inicia sin errores
- [ ] Health check responde correctamente
- [ ] Registro de usuario funciona
- [ ] Login funciona y devuelve JWT
- [ ] CRUD de productos funciona
- [ ] CRUD de presupuestos funciona
- [ ] Cálculos de totales son correctos

### Testing de MercadoPago ✅
- [ ] Configuración de MP se carga correctamente
- [ ] Creación de orden de pago funciona
- [ ] QR code se genera correctamente
- [ ] init_point abre página de MP
- [ ] Webhook se procesa correctamente
- [ ] Estados de pago se actualizan

### Testing de Stock ✅
- [ ] Validación de stock antes de crear pago
- [ ] Decremento atómico después de pago aprobado
- [ ] Rollback en caso de error
- [ ] Productos con stock bajo se identifican

### Testing de Errores ✅
- [ ] Stock insuficiente maneja correctamente
- [ ] Presupuesto ya pagado maneja correctamente
- [ ] Credenciales MP inválidas manejan correctamente
- [ ] Webhooks duplicados no afectan stock
- [ ] Tokens JWT expirados manejan correctamente

## 🔧 Troubleshooting

### Error: "Cannot connect to MongoDB"
```bash
# Verificar que MongoDB esté corriendo
mongod --version
```

### Error: "MERCADOPAGO_ACCESS_TOKEN no configurado"
```bash
# Verificar variables de entorno
cat .env | grep MERCADOPAGO
```

### Error: "Webhook signature invalid"
```bash
# Verificar que ngrok esté expuesto y la URL sea correcta
ngrok http 3000
```

### Error: "Stock insuficiente después del webhook"
```bash
# Posible webhook duplicado, verificar logs
tail -f logs/combined.log | grep webhook
```

## 📈 Métricas a Verificar

- **Tiempo de respuesta** de creación de pago < 2s
- **Tasa de éxito** de creación de preferencias > 99%
- **Tiempo de procesamiento** de webhooks < 500ms
- **Integridad** del stock (sin inconsistencias)

---

**¡Testing completo realizado!** 🎉 Tu integración con MercadoPago está lista para producción.