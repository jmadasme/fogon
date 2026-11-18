# Fogón v2 — Flow online

Esta versión agrega Flow como pasarela de pago online instantánea para los
pedidos. La versión anterior quedó congelada en la rama `v1` y el tag `v1.0`.

- Rama de trabajo: `v2-flow`
- Versión de la app: `2.2.0`
- Alcance: Webpay y MACH/BCI con botones separados en Fogón, usando el
  checkout hospedado de Flow.
- Fuera de alcance: cupones de efectivo en tiendas (Servipag/Multicaja) y
  reembolsos automáticos.

## Por qué solo Flow online

Flow permite pagar con tarjetas (Webpay) y MACH/BCI en su checkout. El resultado
de la autorización se obtiene en segundos con `payment/getStatus`. El webhook
queda como respaldo para cuando el cliente cierra el navegador antes de volver.

Los cupones de Servipag/Multicaja son pagos diferidos: Flow confirma recién
cuando el cliente paga en la tienda. No cumplen el requisito de confirmación
instantánea y no se ofrecen en esta versión.

## Configuración

```bash
FLOW_ENVIRONMENT="sandbox"        # sandbox | production
FLOW_API_KEY=""
FLOW_SECRET_KEY=""
FLOW_PAYMENT_METHOD=""            # fallback; vacío = todos los contratados
FLOW_PAYMENT_METHOD_WEBPAY="1"    # ID de Webpay Plus en la cuenta
FLOW_PAYMENT_METHOD_MACH="2"     # ID de MACH/BCI en la cuenta
FLOW_TIMEOUT_SECONDS="900"
```

Para producción:

```bash
PAYMENTS_MODE="production"
FLOW_ENVIRONMENT="production"
NEXT_PUBLIC_APP_URL="https://tu-dominio.cl"
```

En la cuenta Flow:

1. Contrata Webpay y MACH/BCI.
2. No contrates ni habilites Servipag/Multicaja para este checkout.
3. Copia `apiKey` y `secretKey` desde **Mis Datos**.
4. Si usas `FLOW_PAYMENT_METHOD`, usa el ID numérico de tu cuenta. `9`
   significa todos los medios contratados.

## Flujo técnico

1. `POST /api/orders` crea el pedido en `PENDING_PAYMENT`.
2. El checkout ofrece dos botones Flow separados: Webpay y MACH/BCI. Cada uno
   envía `flowMethod` y `createFlowPayment()` usa el ID configurado para forzar
   ese medio, evitando que Flow muestre Servipag u otros medios no deseados.
3. `createFlowPayment()` llama a `POST /payment/create` con firma HMAC-SHA256.
4. El cliente es redirigido a `url?token=...`.
5. Flow devuelve al cliente a `/api/payments/flow/return`. Flow puede usar
   `POST` con el token en el formulario, no siempre `GET` con query string.
6. El return acepta `GET` y `POST`, llama a `payment/getStatus` y, si el pago
   está aprobado, ejecuta `markOrderPaid()`. El pedido pasa a
   `PENDING_MERCHANT`. La redirección final usa HTTP 303 para convertir el
   `POST` de Flow en un `GET` normal.
7. Flow también envía un `POST` a `/api/payments/flow/confirm` con el token.
   Ese webhook vuelve a consultar `getStatus` y es idempotente.
8. El cron reconcilia pagos Flow pendientes y evita expirar un pedido que ya
   fue pagado.

> Los callbacks `flow/return` y `flow/confirm` están exentos del filtro CORS
> de `proxy.ts`: Flow los envía desde `https://www.flow.cl` y no son
> peticiones del navegador de Fogón. La autenticidad se valida con
> `payment/getStatus`, no con el header `Origin`.

## Archivos principales

- `lib/payments/flow.ts`: firma, creación, estado y reembolso Flow.
- `lib/payments/index.ts`: enrutamiento del proveedor `FLOW`.
- `app/api/payments/flow/confirm/route.ts`: webhook.
- `app/api/payments/flow/return/route.ts`: retorno del navegador.
- `app/api/payments/create/route.ts`: reintentos y reutilización del checkout.
- `app/api/orders/route.ts`: creación del pedido y persistencia del `raw`.
- `app/api/cron/orders/route.ts`: conciliación y expiración.
- `components/checkout/checkout-client.tsx`: opción Flow.
- `components/order/order-tracking-client.tsx`: estado y etiqueta Flow.

## Pruebas en sandbox

Credenciales de tarjeta:

```text
Número: 4051885600446623
CVV: 123
Vencimiento: cualquiera
RUT banco simulado: 11111111-1
Clave: 123
```

Para MACH/BCI usa los simuladores del sandbox de Flow.

Prueba:

1. Pago aprobado: el pedido debe quedar `PAID` y `PENDING_MERCHANT`.
2. Pago rechazado: debe quedar `FAILED`.
3. Cierre del navegador tras pagar: el webhook o el cron deben conciliar.
4. Reintento desde la página del pedido: debe reutilizar el checkout pendiente.
5. Webhook duplicado: no debe duplicar eventos ni montos.
6. Pago después de expirar: debe quedar `REFUND_PENDING`.

## Limitaciones de esta versión

- Los reembolsos Flow se gestionan desde el panel de Flow. El botón de
  reembolso automático se oculta para pedidos Flow.
- No se ofrecen cupones de efectivo en tiendas.
- La acreditación del dinero en la cuenta bancaria depende del calendario de
  liquidaciones de Flow; la confirmación del pedido sí es inmediata.
- Flow no emite la boleta electrónica al cliente final; Fogón debe seguir
  emitiéndola.

## Operación

- Mantén `CRON_SECRET` configurado y ejecuta `/api/cron/orders` con frecuencia
  (cada 1–5 minutos).
- Si usas Cloudflare, permite el `POST` a `/api/payments/flow/confirm`.
- Monitorea:
  - webhooks con HTTP 500,
  - pedidos `PAID` que no pasaron a `PENDING_MERCHANT`,
  - pedidos `REFUND_PENDING`,
  - diferencias contra las liquidaciones de Flow.
