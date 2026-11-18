# Briefing para auditoría externa — Fogón v2

**Fecha:** 2026-11-10  
**Proyecto:** Fogón — plataforma de gestión de pedidos de comida (Next.js + Expo).  
**Repositorio:** `/home/jma/Documents/Proyect/fogon v2`  
**Auditoría previa:** `docs/28-auditoria-seguridad-2026-11-10.md`

---

## Contexto rápido

- **Stack web:** Next.js 16.4.5, React 19, Prisma 6.19.3, PostgreSQL, Zod, Jose (JWT), bcryptjs.
- **Stack mobile:** Expo/React Native (`/mobile`), usa `expo-secure-store` en nativo y `localStorage` en preview web.
- **Pasarelas de pago:** Flow (Chile), Mercado Pago, Transbank, modo mock.
- **Auth:** cookies httpOnly para web, Bearer JWT para mobile, MFA TOTP para admin/local/repartidor.
- **Despliegue:** Docker standalone + Cloudflare Tunnel o Caddy; VPS endurecido con `deploy/provision-vps.sh`.

---

## Estado de seguridad al entregar este briefing

### Correcciones recientes aplicadas

- Webhook de Flow verifica firma HMAC opcional + rate limit por IP/token.
- Webhook de Mercado Pago rechaza notificaciones sin `MERCADOPAGO_WEBHOOK_SECRET`.
- `MFA_ENCRYPTION_KEY` es obligatorio en todos los entornos.
- Script de desarrollo `platform-start.sh` ya no expone Next.js/Expo en LAN.
- CORS funciona vía `proxy.ts`; origen `192.168.1.9` hardcodeado eliminado.
- Datos comerciales (`commissionRate`, `commissionAmount`, `courierPayout`) solo visibles para admin/merchant.
- Logs de dev redactan emails/teléfonos.
- Rate limit en endpoint `/api/cron/orders`.
- Validación de URLs de pasarela antes de redirigir en frontend.
- Validación de parámetro `status` en return de Mercado Pago.

### Lo que aún está pendiente o requiere infraestructura

- Rotación real de secretos en `.env` local (acción del operador).
- Rate limit distribuido (actualmente en memoria; requiere Redis/Upstash).
- Webhook KYC genérico sin whitelist de origen/IP.
- CSP sigue permitiendo `unsafe-inline`.
- Token de mobile en `localStorage` en preview web de Expo.
- Falta SIEM/Sentry/secret manager.

---

## Focos recomendados para la auditoría externa

### 1. IDOR y control de acceso
- ¿Puede un cliente ver/modificar pedidos, direcciones o reviews de otro cliente?
- ¿Puede un repartidor ver ganancias, ubicación o datos de otros repartidores?
- ¿Puede un merchant ver/editar menús, pedidos o analytics de otro merchant?
- ¿Puede un admin/support realizar acciones fuera de su rol?
- Revisar endpoints en `app/api/**` y server actions en `app/actions/**`.

### 2. Lógica de negocio y pagos
- ¿Se puede modificar el total del pedido desde el cliente?
- ¿Se puede forzar un pago en efectivo (`CASH`) aunque esté deshabilitado?
- ¿Se puede duplicar un pedido o un pago enviando requests paralelos?
- ¿Se puede forzar un reembolso admin duplicado?
- ¿Se puede cambiar el precio de un producto desde el cliente?
- Revisar `app/api/orders/route.ts`, `app/api/payments/**`, `app/actions/admin.ts`, `app/actions/menu.ts`.

### 3. Webhooks y notificaciones de pago
- ¿El webhook de Flow acepta notificaciones repetidas o fuera de orden?
- ¿El webhook de Mercado Pago valida correctamente firma, timestamp y `data.id`?
- ¿Se puede reenviar un webhook exitoso para generar doble entrega/pago?
- ¿Qué pasa si un webhook llega después de que el pedido fue cancelado/reembolsado?

### 4. App móvil (Expo)
- ¿El token JWT se almacena de forma segura en todos los casos?
- ¿Hay certificate pinning o App Attest/Play Integrity?
- ¿Los deeplinks son validados antes de actuar?
- ¿La app valida certificados y no acepta conexiones inseguras?
- Revisar `/mobile/src/lib/auth.tsx`, `/mobile/src/lib/api.ts`, `app.json`.

### 5. Inyección y manipulación de datos
- ¿Hay SQL injection en `$queryRaw` o raw queries?
- ¿Hay XSS en `dangerouslySetInnerHTML`, `innerHTML`, parámetros reflejados?
- ¿Hay SSRF en callbacks de pago o KYC?
- ¿Hay path traversal en subida de imágenes (`/api/merchant/cover`) o assets?
- ¿Se validan tipos MIME y magic bytes de archivos?

### 6. Denegación de servicio
- ¿Se puede saturar la API con payloads grandes?
- ¿El rate limit en memoria es efectivo en múltiples réplicas?
- ¿Hay endpoints costosos sin paginación ni límites?
- ¿Se puede generar muchos pedidos/cuentas sin control?

### 7. Infraestructura y secretos
- ¿Hay secretos hardcodeados en código, Docker, scripts o logs?
- ¿Los contenedores corren como root?
- ¿La DB usa TLS y autenticación fuerte?
- ¿Cloudflare/VPS está configurado correctamente (origen cerrado, solo túnel)?
- ¿Hay claves SSH privadas, certificados o `.env` en el repositorio?

### 8. KYC y verificación de identidad
- ¿El webhook KYC genérico valida origen/firma?
- ¿Se puede aprobar/rechazar un caso KYC sin autorización?
- ¿Se puede saltar KYC creando cuentas con roles especiales?

---

## Preguntas de prueba sugeridas

Hazle estas pruebas a la plataforma y observa el comportamiento:

1. Como cliente A, intenta `GET /api/orders/<id-del-cliente-B>`.
2. Como repartidor, intenta aceptar dos pedidos simultáneamente.
3. Envía `POST /api/payments/flow/confirm` con un token aleatorio y luego con un token válido muchas veces.
4. Envía `POST /api/payments/webhook/mercadopago` sin cabecera `x-signature`.
5. Intenta crear un pedido con `paymentProvider: "CASH"` si está deshabilitado.
6. Modifica el payload del carrito para cambiar precios o cantidades.
7. Crea múltiples pedidos con el mismo `clientRequestId`.
8. Como merchant, intenta actualizar el precio de un plato de otro merchant.
9. Intenta acceder a `/api/cron/orders` sin `Authorization: Bearer <CRON_SECRET>`.
10. Revisa si `window.localStorage` en Expo web preview contiene el token JWT.

---

## Documentación de referencia

- `docs/28-auditoria-seguridad-2026-11-10.md` — auditoría previa y estado de correcciones.
- `docs/05-arquitectura-tecnica.md` — arquitectura general.
- `docs/18-produccion-cloudflare-postgres.md` — despliegue productivo.
- `docs/20-kyc-didit.md` — flujo KYC.
- `docs/24-flow-v2.md` — flujo de pagos Flow.
- `SECURITY.md` — política de seguridad del proyecto.
- `README.md` — setup y comandos.

---

## Notas para el auditor

- No confíes en que `docs/**` esté actualizado; verifica contra el código.
- Este proyecto usa una versión reciente de Next.js con cambios respecto a versiones anteriores.
- La app móvil usa Expo Router y dependencias específicas del SDK; revisa `mobile/package.json` antes de auditar nativo.
- `npm audit` reporta 0 vulnerabilidades conocidas (moderado+).
- El entorno local (`next dev`) no ejecuta `scripts/check-env.mjs`; las protecciones de producción se validan solo en `npm start` o Docker.

---

## Contacto / entrega esperada

Se espera un informe con:
1. Hallazgos ordenados por severidad (Crítica/Alta/Media/Baja).
2. Archivo y línea aproximada de cada vulnerabilidad.
3. Prueba de concepto reproducible.
4. Impacto de negocio.
5. Recomendación de mitigación concreta.
6. Validación de que las recomendaciones no rompan los controles ya existentes.
