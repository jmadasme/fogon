# Auditoría multi-modelo — Fogón v2

> Estado: los P0 de este informe se implementaron en
> `docs/27-p0-hardening-v2.md` (v2.2.0).

- Fecha: 2026-11-10
- Repo: `/home/jma/Documents/Proyect/fogon v2`
- Rama: `v2-flow`
- App: `http://localhost:3002`
- Modelos:
  - **Kimi K3.1 Pro (max)** — primera pasada ofensiva.
  - **GPT-5.6 Luna (max)** — segunda pasada lógica/adversarial.
  - Claude Opus 5.5 se intentó usar, pero OpenRouter no tenía créditos disponibles.
- No se modificó código ni `.env` durante las auditorías.
- No se ejecutaron pagos, reembolsos ni sesiones KYC reales.
- Los usuarios/pedidos temporales fueron eliminados; `git status` quedó limpio.

## Resumen ejecutivo

La segunda pasada confirmó la mayoría de los hallazgos de Kimi y agregó fallos de lógica de pagos y KYC que la primera auditoría no había visto.

Lo más grave:

1. **El servidor de desarrollo estaba escuchando en `*:3002` y respondía en la LAN** (`192.168.1.238:3002`), con claves reales de Flow, MFA/KYC/email/courier security desactivados y cuentas demo conocidas. No se demostró exposición a Internet, pero sí a otros equipos de la red local. **Acción tomada: se reinició en `127.0.0.1:3002`; ya no escucha en la LAN.**
2. **`CASH` sigue aceptado por la API** aunque se retiró del checkout. Un pedido creado por API con `paymentProvider: "CASH"` quedó en `PENDING_MERCHANT` sin pago online.
3. **La carrera del PIN permite aceptar un PIN válido después de que la ráfaga ya recibió `429`.** La prueba de Kimi obtuvo `400,400,400,400,429,429,429,200` y el pedido terminó `DELIVERED`.
4. **Flow no tiene idempotencia por pedido.** Dos solicitudes concurrentes pueden crear dos checkouts Webpay/MACH; el último token pisa al anterior y los callbacks solo reconocen el token actual.
5. **La sincronización de pagos no es compare-and-set.** Un callback leído antes de una cancelación puede resucitar el pedido; un fallo leído antes de un pago aprobado puede dejar el pago como `FAILED`.
6. **Un repartidor puede aceptar dos pedidos a la vez.** La comprobación de entregas activas ocurre antes de la transacción y no hay restricción única en PostgreSQL.
7. **Reembolsos de Mercado Pago/Transbank no son atómicos.** Dos envíos concurrentes pueden llamar dos veces al proveedor antes de marcar `REFUNDED`. Flow no tiene reembolso automático en esta versión.
8. **KYC tiene carreras y el webhook Didit no está operativo** porque `DIDIT_WEBHOOK_SECRET` está vacío.
9. **El GPS del repartidor es dato del cliente**, no una prueba de presencia. Con `COURIER_SECURITY_ENFORCED=false` se omiten controles de zona/salto.

## Hallazgos validados

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| N-01 | Alta | `CASH` aceptado por API después de retirarlo del checkout | Validado en vivo: `200`, `PENDING_MERCHANT` |
| N-02 | Alta | Carrera en el bloqueo del PIN de entrega | Validado: PIN válido aceptado tras `429` |
| N-03 | Alta | Múltiples checkouts Flow para el mismo pedido | Validado por código; no se llamó a Flow |
| N-04 | Media | Un repartidor acumula dos entregas activas | Validado en vivo: `200/200` |
| N-05 | Media/Alta condicional | `PATCH /api/orders/[id]` de local no exige MFA | Validado; bypass solo si se activa MFA después de emitir la sesión |
| N-06 | Media | Reembolsos concurrentes sin transición atómica | Validado por código; no se reembolsó |
| N-07 | Baja | Cliente recibe `commissionRate`, `commissionAmount`, `courierPayout` | Validado en vivo |
| LAN-01 | Alta/Crítica de configuración | Servidor `next dev` expuesto en la LAN | Validado y mitigado: ahora solo `127.0.0.1:3002` |

### N-01 — CASH por API

Archivos relevantes:

- `lib/validation.ts:51`
- `app/api/orders/route.ts:243, 364-383`
- `app/api/payments/create/route.ts:13, 71-83`

El frontend ya no muestra efectivo, pero el servidor sigue aceptándolo. Un cliente autenticado puede crear un pedido operativo sin pago online. El local podría aceptarlo si asume que todo pedido nuevo está prepagado.

### N-02 — Carrera del PIN

Archivos relevantes:

- `app/api/orders/[id]/route.ts:234-283`
- `app/api/orders/[id]/route.ts:344-350`

La lectura del bloqueo, el incremento de intentos y la transición final no son atómicos. La prueba controlada usó un pedido temporal y un PIN conocido; no fue fuerza bruta contra un pedido real. El pedido temporal fue eliminado.

### N-03 — Checkouts Flow duplicados

`/api/payments/create` lee `paymentRef`, llama a Flow y luego sobrescribe el token sin lock ni CAS. `flow.ts` genera otro `commerceOrder` con `Date.now()`. Dos requests concurrentes pueden dejar dos checkouts activos; el webhook solo reconoce el token actualmente almacenado.

No se ejecutó contra Flow para no generar cargos.

### N-04 — Doble entrega activa

La comprobación `activeCount` ocurre antes de la transacción y no existe índice único parcial para `courierId` en estados activos. La prueba con un repartidor temporal y dos pedidos `PENDING_COURIER` obtuvo `200/200` y dos pedidos asignados al mismo repartidor.

### N-05 — MFA de local

`/api/merchant/orders` y `/api/merchant/cover` sí comprueban MFA, pero `PATCH /api/orders/[id]` no. Es un bypass condicional: se vuelve relevante si `MFA_ENFORCED=true` se activa después de emitir sesiones antiguas. La solución es centralizar `requireMerchantMfa()` en todas las APIs de local.

### N-06 — Reembolsos

`adminCancelOrderAction` lee el pedido, acepta `PAID` o `REFUND_PENDING`, llama al proveedor y solo después marca `REFUNDED`. Dos envíos concurrentes pueden llamar dos veces. Aplica a Mercado Pago/Transbank; Flow se gestiona manual desde el panel.

### N-07 — Datos comerciales

`lib/orders/view.ts:100-102` entrega comisión y payout a cualquier viewer autorizado. No expone `paymentRef` ni payloads, pero sí márgenes internos.

## Hallazgos nuevos de la segunda pasada

### S2-PAY-RACE — `markOrderPaid` / `markPaymentFailed` sin CAS

- `lib/payments/sync.ts:34-62, 109-158`.
- `markOrderPaid()` lee el pedido fuera de la transacción y actualiza solo por `id`.
- Un callback atrasado puede resucitar un pedido cancelado como `PENDING_MERCHANT`.
- `markPaymentFailed()` puede degradar un pedido ya pagado a `FAILED` usando un snapshot viejo.
- `canTransition()` no revisa `paymentStatus`; un pedido con pago local `FAILED` podría ser aceptado.

Es un problema de máquina de estados, no solo de Flow. Afecta Webpay, MACH, Mercado Pago y Transbank.

### S2-PAY-IDEM — Idempotencia opcional

- `clientRequestId` es opcional en `createOrderSchema`.
- `/api/payments/create` no exige `Idempotency-Key`.
- La UI manda UUID, pero la API acepta clientes que no lo hagan.
- Un retry de red puede crear dos pedidos y dos checkouts.

### S2-MP-CHARGEBACK — Chargeback ignorado

- `api/payments/webhook/mercadopago` envía `refunded`/`charged_back` a `markPaymentFailed()`.
- `markPaymentFailed()` retorna si el pedido ya está `PAID`, `REFUND_PENDING` o `REFUNDED`.
- Un chargeback puede dejar el pedido como `PAID`, `DELIVERED` y sumar en analytics aunque el dinero haya sido retirado.

Aplica si Mercado Pago está activo; no es el camino actual de Flow.

### S2-KYC-RACE — Webhooks y casos KYC

- `lib/kyc.ts:127-169` compara timestamps y actualiza sin lock/CAS; dos eventos concurrentes pueden pisarse.
- La revocación operativa solo ocurre cuando el evento mapea a `REJECTED`.
- El webhook genérico solo actualiza `KycCase`; no revoca `Courier.verificationStatus`, `Merchant.status` ni `Store.status`.
- No existe unicidad `(userId, role)` para impedir casos duplicados.
- `startKyc()` puede crear dos sesiones Didit concurrentes.

Además, `DIDIT_WEBHOOK_SECRET` está vacío: el webhook KYC responde `401 Firma inválida`. El flujo puede actualizarse por polling en `/kyc/return`, pero no hay webhook.

### S2-GPS — GPS controlado por el cliente

- `api/courier/location` acepta lat/lng del cliente y las persiste.
- La aceptación y el retiro usan esas coordenadas.
- `COURIER_SECURITY_ENFORCED=false` omite controles de zona/salto.
- Aun activado, el GPS no es una prueba fuerte de presencia.

### S2-AUTH — Sesiones largas

- Sesión web y bearer móvil duran 7 días.
- No hay step-up MFA reciente para reembolsos, KYC o suspensión de cuentas.
- Una sesión admin robada mantiene privilegios por una ventana amplia.

### S2-BODY — Límite de body evadible

- `exceedsBodyLimit()` devuelve `false` si no hay `Content-Length`.
- `request.json()`/`formData()` puede consumir memoria antes de validar.
- El perfil Caddy limita 8 MB, pero el perfil Tunnel llega directo a Next.

## Validación y correcciones

- Kimi acertó en N-01, N-02, N-03, N-04, N-05, N-06, N-07 y LAN-01.
- N-03 y N-06 están confirmados por flujo de código, pero **no se probó doble cobro/doble reembolso real**.
- N-05 es condicional: con `MFA_ENFORCED=false` actual no hay una política activa que saltarse; el riesgo aparece al activar MFA sin revocar sesiones.
- N-06 no aplica a Flow automático: la app deriva Flow al panel y no ejecuta reembolso.
- LAN-01 no demuestra exposición a Internet, solo a la LAN.
- N-07 es fuga comercial baja; `paymentRef` y payloads están correctamente ocultos.
- No aparecieron SQLi, SSRF, XSS, path traversal, IDOR básico, JWT `alg=none`, exposición de `.env` ni open redirect.

## Checklist priorizado

### P0 — antes de exponer o usar dinero real

1. ~~Detener `next dev` en `*:3002` o bind a `127.0.0.1`~~ Hecho: el proceso actual escucha solo en `127.0.0.1:3002`.
2. Sacar claves reales de Flow del entorno de desarrollo y desactivar/cambiar cuentas demo.
3. `MFA_ENFORCED=true`, `KYC_REQUIRED=true`, `EMAIL_VERIFICATION_REQUIRED=true`, `COURIER_SECURITY_ENFORCED=true`.
4. Usar HTTPS + `npm start` + `scripts/check-env.mjs` para producción.
5. Rechazar `CASH` en `/api/orders` y `/api/payments/create`.
6. Hacer atómicos PIN, cancelación, pago y reembolso.

### P1 — antes de piloto con pagos

1. Modelo `PaymentAttempt` con idempotencia y tokens históricos.
2. CAS/lock en `markOrderPaid()` y `markPaymentFailed()`.
3. Lock/índice único para una entrega activa por repartidor.
4. Autorización/MFA centralizada en APIs de local.
5. Estados explícitos para chargeback/refund.
6. KYC con lock, unicidad y revocación consistente.
7. Rate limit distribuido y `TRUST_PROXY` correcto.
8. Tratar GPS como señal antifraude, no como autorización.

### P2 — hardening

- DTOs por rol (comisión/payout).
- Límites de body en proxy/túnel y streaming.
- Sesiones admin más cortas + step-up MFA.
- CSP con nonce/hash.
- No publicar el preview web móvil con token en `localStorage`.
- Alertas/SIEM para pagos, PIN, KYC y reembolsos.
- Pruebas concurrentes permanentes: PIN, doble aceptación, doble checkout, cancelación vs callback, pago vs fallo, doble reembolso y KYC fuera de orden.

## Nota

No se ejecutaron pagos ni reembolsos reales en estas dos pasadas. Las pruebas usaron pedidos/usuarios temporales y se eliminaron. No se llamó a las APIs de Flow para evitar cargos.
