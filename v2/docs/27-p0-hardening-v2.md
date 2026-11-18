# P0 hardening — Fogón v2.2

Fecha: 2026-11-10
Base: `v2-flow`

Este bloque corrige los hallazgos P0 de la auditoría multi-modelo
(`docs/26-auditoria-multimodelo-v2.md`).

## Cambios

### 1. Efectivo cerrado en el backend

- `createOrderSchema` ya no acepta `CASH`.
- `/api/payments/create` tampoco acepta `CASH`.
- El efectivo histórico sigue visible para pedidos antiguos, pero no puede
  seleccionarse en una compra nueva.

### 2. Idempotencia mínima de pedidos

- `clientRequestId` ahora es obligatorio en `/api/orders`.
- La UI web y la app móvil ya lo generaban; ahora el servidor no acepta clientes
  que lo omitan.

### 3. Un solo intento de pago remoto por pedido

- Nueva columna `Order.paymentLockAt`.
- `/api/payments/create` adquiere un lock atómico antes de llamar a Flow,
  Mercado Pago o Transbank.
- Si otro request está creando el pago, responde `409`.
- El lock expira a los 2 minutos si el proceso muere.
- El lock se libera en `finally`.

Esto evita dos checkouts simultáneos para el mismo pedido. No reemplaza todavía
una tabla `PaymentAttempt` que preserve tokens históricos; eso queda como P1.

### 4. PIN de entrega atómico

- `DELIVERED` de un repartidor usa una transacción con
  `SELECT ... FOR UPDATE` sobre `Order`.
- La verificación del PIN, el incremento del intento, el bloqueo de 15 minutos y
  la transición a `DELIVERED` ocurren bajo el mismo lock.
- Un PIN válido ya no puede colarse después de cinco fallos concurrentes.

### 5. Una entrega activa por repartidor

- Índice único parcial en PostgreSQL:

```sql
CREATE UNIQUE INDEX "Order_active_courier_assignment"
ON "Order" ("courierId")
WHERE "courierId" IS NOT NULL
  AND "status" IN ('COURIER_ASSIGNED', 'PICKED_UP');
```

- El endpoint traduce la violación `P2002` a `409`.
- La comprobación previa se mantiene como mensaje de negocio; la base es la
  garantía final.

### 6. Sincronización de pagos con lock

- `markOrderPaid()` y `markPaymentFailed()` bloquean la fila del pedido con
  `FOR UPDATE`.
- Un callback atrasado ya no puede resucitar un pedido cancelado.
- Un fallo atrasado ya no puede degradar un pago aprobado.
- `markOrderPaid()` conserva el comportamiento de pago tardío:
  deja `REFUND_PENDING` si el pedido ya estaba cancelado/expirado.

### 7. MFA en APIs de pedidos

- `GET` y `PATCH /api/orders/[id]` rechazan a MERCHANT/ADMIN/SUPPORT con
  `MFA_ENFORCED=true` y MFA no configurado.
- No afecta a clientes ni repartidores.

### 8. Reembolso con reclamo atómico

- El admin ya no llama al proveedor dos veces por doble envío.
- Se hace `PAID → REFUND_PENDING` de forma condicional antes de llamar a la
  pasarela.
- Si la pasarela falla, se revierte a `PAID`.
- Un `REFUND_PENDING` existente no inicia otro reembolso.

## Migración

Archivo:

```text
prisma/migrations/20261110190000_p0_hardening/migration.sql
```

Aplica:

```bash
npx prisma migrate deploy
```

En local ya se aplicó con `prisma db execute` y se regeneró el cliente.

## Pruebas de regresión

Script:

```bash
npm run security:regression
```

Resultado actual:

```json
{
  "ok": true,
  "results": [
    { "test": "cash_rejected", "status": 400 },
    { "test": "client_request_id_required", "status": 400 },
    { "test": "one_active_delivery", "statuses": [409, 200], "assignedCount": 1 },
    {
      "test": "pin_lock",
      "wrongStatuses": [400, 400, 400, 400, 429],
      "correctStatus": 429,
      "status": "PICKED_UP",
      "attempts": 5,
      "locked": true
    }
  ]
}
```

También se probó manualmente el lock de pago con dos requests concurrentes:
uno respondió `409` y el otro `200`; se creó un solo checkout Flow y
`paymentLockAt` volvió a `null`.

## Pendiente P1

- `PaymentAttempt` con historial de tokens y conciliación por intento.
- Chargebacks de Mercado Pago como estado propio.
- KYC con lock/unicidad y webhook Didit con secreto.
- Rate limit distribuido y `TRUST_PROXY`.
- GPS como señal antifraude, no autorización.
- Sesiones admin más cortas + step-up MFA.
- Límites de body en túnel/proxy.
- DTOs por rol para comisión/payout.
