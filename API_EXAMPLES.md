# 🔗 Ejemplos de Uso de la API - Sistema de Presupuestos

Esta documentación contiene ejemplos prácticos de cómo usar la API del sistema de presupuestos con integración MercadoPago.

## 📋 Índice

1. [Autenticación](#autenticación)
2. [Gestión de Productos](#gestión-de-productos)
3. [Gestión de Presupuestos](#gestión-de-presupuestos)
4. [Procesamiento de Pagos](#procesamiento-de-pagos)
5. [Consulta de Estadísticas](#consulta-de-estadísticas)
6. [Casos de Uso Avanzados](#casos-de-uso-avanzados)

## 🔐 Autenticación

### Registrar Usuario Administrador

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@miempresa.com",
    "password": "MiPassword123!",
    "name": "Administrador Principal",
    "role": "admin"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "id": "65a1b2c3d4e5f6789012345",
      "email": "admin@miempresa.com",
      "name": "Administrador Principal",
      "role": "admin",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Registrar Usuario Vendedor

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendedor@miempresa.com",
    "password": "VendedorPass123!",
    "name": "Juan Vendedor",
    "role": "seller"
  }'
```

### Iniciar Sesión

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@miempresa.com",
    "password": "MiPassword123!"
  }'
```

### Obtener Información del Usuario Actual

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Cambiar Contraseña

```bash
curl -X PUT http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "currentPassword": "MiPassword123!",
    "newPassword": "NuevaPassword456!"
  }'
```

## 📦 Gestión de Productos

### Crear Productos

```bash
# Laptop HP
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "name": "Laptop HP Pavilion 15-eh1xxx",
    "description": "Laptop HP Ryzen 5, 8GB RAM, 256GB SSD",
    "price": 85000,
    "stock": 15,
    "category": "Notebooks",
    "sku": "HP-PAV-15-001",
    "imageUrl": "https://example.com/hp-laptop.jpg"
  }'

# Monitor Dell
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "name": "Monitor Dell 24 Pulgadas",
    "description": "Monitor Dell FHD, 75Hz, IPS",
    "price": 45000,
    "stock": 25,
    "category": "Monitores",
    "sku": "DELL-MON-24-001"
  }'

# Mouse Logitech
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "name": "Mouse Logitech MX Master 3",
    "description": "Mouse ergonómico inalámbrico",
    "price": 12000,
    "stock": 50,
    "category": "Periféricos",
    "sku": "LOG-MX3-001"
  }'
```

### Listar Productos con Filtros

```bash
# Todos los productos (paginado)
curl -X GET "http://localhost:3000/api/products?page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"

# Filtrar por categoría
curl -X GET "http://localhost:3000/api/products?category=Notebooks&page=1&limit=5" \
  -H "Authorization: Bearer TU_TOKEN"

# Buscar por nombre
curl -X GET "http://localhost:3000/api/products?search=HP&page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"

# Ordenar por precio
curl -X GET "http://localhost:3000/api/products?sortBy=price&sortOrder=desc&page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"
```

### Obtener Categorías Disponibles

```bash
curl -X GET http://localhost:3000/api/products/categories \
  -H "Authorization: Bearer TU_TOKEN"
```

### Productos con Stock Bajo

```bash
curl -X GET http://localhost:3000/api/products/low-stock \
  -H "Authorization: Bearer TU_TOKEN"
```

### Actualizar Producto

```bash
curl -X PUT http://localhost:3000/api/products/ID_DEL_PRODUCTO \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "price": 80000,
    "stock": 20,
    "description": "Laptop HP Ryzen 5, 8GB RAM, 256GB SSD - OFERTA"
  }'
```

## 📋 Gestión de Presupuestos

### Crear Presupuesto Simple

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "customer": {
      "name": "María González",
      "email": "maria@email.com",
      "phone": "+54 9 11 1234-5678"
    },
    "items": [{
      "productId": "ID_LAPTOP_HP",
      "quantity": 1
    }],
    "tax": 21,
    "notes": "Presupuesto para cliente nuevo"
  }'
```

### Crear Presupuesto con Múltiples Productos

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "customer": {
      "name": "Carlos Rodríguez",
      "email": "carlos@empresa.com",
      "phone": "+54 9 11 8765-4321"
    },
    "items": [
      {
        "productId": "ID_LAPTOP_HP",
        "quantity": 2
      },
      {
        "productId": "ID_MONITOR_DELL",
        "quantity": 2
      },
      {
        "productId": "ID_MOUSE_LOGITECH",
        "quantity": 2
      }
    ],
    "discount": 15,
    "tax": 21,
    "notes": "Presupuesto para oficina completa - Cliente corporativo"
  }'
```

### Listar Presupuestos con Filtros

```bash
# Todos los presupuestos
curl -X GET "http://localhost:3000/api/quotes?page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"

# Filtrar por estado
curl -X GET "http://localhost:3000/api/quotes?status=pending&page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"

# Filtrar por rango de fechas
curl -X GET "http://localhost:3000/api/quotes?dateFrom=2024-01-01&dateTo=2024-12-31&page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"

# Buscar por cliente
curl -X GET "http://localhost:3000/api/quotes?customerSearch=María&page=1&limit=10" \
  -H "Authorization: Bearer TU_TOKEN"
```

### Obtener Presupuesto Específico

```bash
curl -X GET http://localhost:3000/api/quotes/ID_DEL_PRESUPUESTO \
  -H "Authorization: Bearer TU_TOKEN"
```

### Presupuestos por Cliente

```bash
curl -X GET http://localhost:3000/api/quotes/customer/maria@email.com \
  -H "Authorization: Bearer TU_TOKEN"
```

### Cancelar Presupuesto

```bash
curl -X PUT http://localhost:3000/api/quotes/ID_DEL_PRESUPUESTO/cancel \
  -H "Authorization: Bearer TU_TOKEN"
```

## 💳 Procesamiento de Pagos

### Crear Orden de Pago

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "quoteId": "ID_DEL_PRESUPUESTO"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Orden de pago creada exitosamente",
  "data": {
    "paymentId": "65a1b2c3d4e5f6789012346",
    "preferenceId": "1234567890-abc123-def456-789ghi",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrCodeData": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890-abc123-def456-789ghi",
    "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890-abc123-def456-789ghi",
    "amount": 105600,
    "expiresAt": "2024-01-16T15:30:00.000Z"
  }
}
```

### Consultar Estado del Pago

```bash
curl -X GET http://localhost:3000/api/payments/ID_DEL_PAGO/status \
  -H "Authorization: Bearer TU_TOKEN"
```

**Respuesta ejemplo:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "65a1b2c3d4e5f6789012346",
      "status": "approved",
      "amount": 105600,
      "paymentMethod": "credit_card",
      "paidAt": "2024-01-15T14:25:30.000Z"
    },
    "quote": {
      "_id": "65a1b2c3d4e5f6789012345",
      "quoteNumber": "Q-2024-001",
      "status": "paid",
      "customer": {
        "name": "María González",
        "email": "maria@email.com"
      },
      "total": 105600
    }
  }
}
```

### Listar Pagos (Solo Admin)

```bash
# Todos los pagos
curl -X GET "http://localhost:3000/api/payments?page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Filtrar por estado
curl -X GET "http://localhost:3000/api/payments?status=approved&page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Filtrar por rango de fechas
curl -X GET "http://localhost:3000/api/payments?dateFrom=2024-01-01&dateTo=2024-01-31&page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Cancelar Pago Pendiente

```bash
curl -X POST http://localhost:3000/api/payments/ID_DEL_PAGO/cancel \
  -H "Authorization: Bearer TU_TOKEN"
```

## 📊 Consulta de Estadísticas

### Estadísticas de Presupuestos

```bash
curl -X GET http://localhost:3000/api/quotes/stats \
  -H "Authorization: Bearer TU_TOKEN"
```

**Respuesta ejemplo:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "pending": 45,
    "paid": 85,
    "cancelled": 15,
    "expired": 5,
    "totalValue": 15750000,
    "averageValue": 105000,
    "conversionRate": 56.67,
    "topProducts": [
      {
        "_id": "Notebooks",
        "count": 65,
        "totalValue": 8500000
      }
    ]
  }
}
```

### Estadísticas de Pagos (Solo Admin)

```bash
# Estadísticas generales
curl -X GET http://localhost:3000/api/payments/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Estadísticas por rango de fechas
curl -X GET "http://localhost:3000/api/payments/stats?dateFrom=2024-01-01&dateTo=2024-01-31" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Respuesta ejemplo:**
```json
{
  "success": true,
  "data": {
    "totalPayments": 85,
    "totalAmount": 13450000,
    "averageAmount": 158235,
    "approvedPayments": 80,
    "rejectedPayments": 3,
    "pendingPayments": 2,
    "approvalRate": 94.12,
    "paymentMethods": [
      {
        "_id": "credit_card",
        "count": 65,
        "amount": 10250000
      },
      {
        "_id": "debit_card",
        "count": 15,
        "amount": 3200000
      }
    ]
  }
}
```

## 🚀 Casos de Uso Avanzados

### Flujo Completo: Producto → Presupuesto → Pago

```bash
# 1. Crear producto
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Tablet Samsung Galaxy",
    "description": "Tablet 10 pulgadas, 64GB",
    "price": 65000,
    "stock": 30,
    "category": "Tablets",
    "sku": "SAM-TAB-001"
  }')

PRODUCT_ID=$(echo $PRODUCT_RESPONSE | jq -r '.data._id')

# 2. Crear presupuesto
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customer\": {
      \"name\": \"Ana Martínez\",
      \"email\": \"ana@email.com\",
      \"phone\": \"+54 9 11 5555-0000\"
    },
    \"items\": [{
      \"productId\": \"$PRODUCT_ID\",
      \"quantity\": 1
    }],
    \"tax\": 21,
    \"notes\": \"Cliente frecuente\"
  }")

QUOTE_ID=$(echo $QUOTE_RESPONSE | jq -r '.data._id')

# 3. Crear orden de pago
PAYMENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"quoteId\": \"$QUOTE_ID\"
  }")

echo "QR Code para el pago:"
echo $PAYMENT_RESPONSE | jq -r '.data.qrCode' | base64 -d > qr_pago.png
echo "Archivo qr_pago.png creado"

# 4. Consultar estado del pago
PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.data.paymentId')
curl -X GET http://localhost:3000/api/payments/$PAYMENT_ID/status \
  -H "Authorization: Bearer $TOKEN"
```

### Simulación de Webhook (Para Testing)

```bash
# Simular webhook de pago aprobado
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "payment.updated",
    "api_version": "v1",
    "data": {
      "id": "123456789"
    },
    "date_created": "2024-01-15T14:30:00.000Z",
    "id": 12345,
    "live_mode": false,
    "type": "payment",
    "user_id": "123456"
  }'
```

### Monitoreo de Stock en Tiempo Real

```bash
# Script para monitorear productos con stock bajo
while true; do
  LOW_STOCK=$(curl -s -X GET http://localhost:3000/api/products/low-stock \
    -H "Authorization: Bearer $TOKEN")

  PRODUCT_COUNT=$(echo $LOW_STOCK | jq '.data | length')

  if [ $PRODUCT_COUNT -gt 0 ]; then
    echo "⚠️  ALERTA: $PRODUCT_COUNT productos con stock bajo"
    echo $LOW_STOCK | jq '.data[] | "- \(.name): \(.stock) unidades"'
  else
    echo "✅ Stock OK"
  fi

  sleep 300 # Verificar cada 5 minutos
done
```

### Reporte Diario de Ventas

```bash
#!/bin/bash
# Script para generar reporte diario

TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d tomorrow +%Y-%m-%d)

echo "📊 REPORTE DIARIO - $TODAY"
echo "================================"

# Estadísticas de pagos del día
PAYMENT_STATS=$(curl -s -X GET "http://localhost:3000/api/payments/stats?dateFrom=${TODAY}T00:00:00.000Z&dateTo=${TOMORROW}T00:00:00.000Z" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Pagos aprobados hoy: $(echo $PAYMENT_STATS | jq '.data.approvedPayments')"
echo "Monto total: $$(echo $PAYMENT_STATS | jq '.data.totalAmount')"
echo "Ticket promedio: $$(echo $PAYMENT_STATS | jq '.data.averageAmount')"

# Presupuestos creados hoy
QUOTES_TODAY=$(curl -s -X GET "http://localhost:3000/api/quotes?dateFrom=${TODAY}T00:00:00.000Z&dateTo=${TOMORROW}T00:00:00.000Z&limit=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Presupuestos creados: $(echo $QUOTES_TODAY | jq '.data.quotes | length')"
```

## 🔍 Testing con cURL

### Script de Testing Completo

```bash
#!/bin/bash
# Script de testing completo de la API

BASE_URL="http://localhost:3000"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="Password123"

echo "🧪 Iniciando tests de la API..."

# 1. Registrar admin
echo "1. Registrando usuario admin..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"name\": \"Admin Test\",
    \"role\": \"admin\"
  }")

if [[ $(echo $REGISTER_RESPONSE | jq -r '.success') == "true" ]]; then
  echo "✅ Usuario registrado exitosamente"
else
  echo "❌ Error registrando usuario: $(echo $REGISTER_RESPONSE | jq -r '.message')"
  exit 1
fi

# 2. Login
echo "2. Iniciando sesión..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [[ $TOKEN != "null" ]]; then
  echo "✅ Login exitoso"
else
  echo "❌ Error en login"
  exit 1
fi

# 3. Crear producto
echo "3. Creando producto de prueba..."
PRODUCT_RESPONSE=$(curl -s -X POST $BASE_URL/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Producto Test",
    "description": "Descripción de prueba",
    "price": 100,
    "stock": 50,
    "category": "Test"
  }')

PRODUCT_ID=$(echo $PRODUCT_RESPONSE | jq -r '.data._id')

if [[ $PRODUCT_ID != "null" ]]; then
  echo "✅ Producto creado: $PRODUCT_ID"
else
  echo "❌ Error creando producto"
  exit 1
fi

# 4. Crear presupuesto
echo "4. Creando presupuesto..."
QUOTE_RESPONSE=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customer\": {
      \"name\": \"Cliente Test\",
      \"email\": \"test@example.com\"
    },
    \"items\": [{
      \"productId\": \"$PRODUCT_ID\",
      \"quantity\": 2
    }],
    \"tax\": 21
  }")

QUOTE_ID=$(echo $QUOTE_RESPONSE | jq -r '.data._id')

if [[ $QUOTE_ID != "null" ]]; then
  echo "✅ Presupuesto creado: $QUOTE_ID"
else
  echo "❌ Error creando presupuesto"
  exit 1
fi

# 5. Crear orden de pago
echo "5. Creando orden de pago..."
PAYMENT_RESPONSE=$(curl -s -X POST $BASE_URL/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"quoteId\": \"$QUOTE_ID\"
  }")

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.data.paymentId')

if [[ $PAYMENT_ID != "null" ]]; then
  echo "✅ Orden de pago creada: $PAYMENT_ID"
  echo "QR Code disponible: $(echo $PAYMENT_RESPONSE | jq -r '.data.qrCodeData')"
else
  echo "❌ Error creando orden de pago: $(echo $PAYMENT_RESPONSE | jq -r '.message')"
  exit 1
fi

echo ""
echo "🎉 ¡Todos los tests pasaron exitosamente!"
echo "Token para uso manual: $TOKEN"
```

## 🔧 Configuración de Variables

Para usar estos ejemplos, configura las siguientes variables de entorno:

```bash
# Variables para los scripts
export API_BASE_URL="http://localhost:3000"
export ADMIN_TOKEN="tu_token_jwt_aqui"
export MERCADOPAGO_TEST_ACCESS_TOKEN="TEST-4389086729399925-110910-5e2e02e1b5fc04e9aef67e86ba5a0abe-1265043745"

# Para producción
export API_BASE_URL="https://tu-api.com"
export MERCADOPAGO_PROD_ACCESS_TOKEN="APP-tu-token-de-produccion"
```

---

**¡API lista para usar!** 🎉 Consulta la [documentación técnica](MERCADOPAGO_INTEGRATION.md) y la [guía de testing](TESTING_GUIDE.md) para más detalles.