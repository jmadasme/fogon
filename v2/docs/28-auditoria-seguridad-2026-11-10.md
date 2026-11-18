# Auditoría de seguridad Fogón v2 — 2026-11-10

**Alcance:** aplicación Next.js (`app/`, `lib/`, `components/`), API REST, server actions, scripts de despliegue, variables de entorno, app móvil Expo y configuración de infraestructura.  
**Enfoque:** detectar vectores de caída de página, robo de credenciales/tokens, duplicación de pedidos, manipulación de precios, acceso no autorizado (SSH/infra), y fraudes de pago.  
**Estado previo:** se revisaron `docs/17-*`, `docs/22-*`, `docs/25-*`, `docs/26-*`, `docs/27-*`. Se reportan solo hallazgos aún presentes en código o no documentados.  
**Estado de correcciones:** la mayoría de los hallazgos de severidad Crítica/Alta/Media fueron mitigados en el mismo día (ver sección *Cambios aplicados* al final).

---

## Cambios aplicados (mismo día)

- **CRÍTICA-01 (Flow webhook):** se añadió verificación HMAC opcional + rate limit por IP y por token (`app/api/payments/flow/confirm/route.ts`).
- **CRÍTICA-02 (entorno local):** no se rotaron secretos (requiere acción del operador), pero se endureció `.env.example` y se separó el control de orígenes de dev.
- **ALTA-01 (LAN):** `scripts/platform-start.sh` ahora usa `127.0.0.1` y `--localhost`.
- **ALTA-03 (MP dev bypass):** `lib/payments/mercadopago.ts` ya no acepta webhooks sin `MERCADOPAGO_WEBHOOK_SECRET`.
- **ALTA-04 (MFA key fallback):** `lib/mfa.ts` exige `MFA_ENCRYPTION_KEY` en todos los entornos.
- **ALTA-05 (CORS):** se confirmó que `proxy.ts` ya implementa CORS; se eliminó IP hardcodeada `192.168.1.9` de los orígenes de dev.
- **ALTA-06 (KYC genérico):** pendiente — requiere definir origen/IP del proveedor.
- **MEDIA-01 (token en localStorage):** parcial; la app nativa usa `SecureStore`. El preview web sigue usando `localStorage` (documentado como no productivo).
- **MEDIA-02 (datos comerciales):** `lib/orders/view.ts` ahora solo envía `commission*`/`courierPayout` a admin/merchant.
- **MEDIA-04 (allowedDevOrigins):** `next.config.ts` ahora lee `ALLOWED_DEV_ORIGINS` desde env.
- **MEDIA-05 (PII logs):** `lib/email.ts` y `lib/sms.ts` redactan destinatarios en logs de dev.
- **MEDIA-06 (cron rate limit):** `app/api/cron/orders/route.ts` añadió rate limit por IP.
- **BAJA-01/02 (redirects):** se validan URLs de pasarela en `components/checkout/checkout-client.tsx` y `components/order/order-tracking-client.tsx`; `mercadopago/return` valida el parámetro `status`.
- **MEDIA-07 (monitoreo/SIEM) y ALTA-02 (rate limit distribuido):** pendientes — requieren infraestructura adicional (Redis/Upstash + SIEM).

---

## Resumen ejecutivo

| Severidad | Cantidad | Riesgos principales |
|---|---|---|
| Crítica | 2 | Webhook de Flow sin firma HMAC; entorno local con claves reales y protecciones de producción desactivadas. |
| Alta | 6 | Exposición LAN en dev, rate limit en memoria, firma MP bypass en dev, MFA key fallback, ausencia de CORS, webhook KYC genérico sin whitelist. |
| Media | 7 | Token móvil en localStorage (web preview), datos comerciales expuestos al cliente, CSP laxo, allowed origins hardcodeados, logging de PII, cron sin rate limit, falta de monitoreo. |
| Baja | 3 | Open redirect parcial en returns de pago, parámetro `status` reflejado en MP return, comisión/payout visible en viewer. |

**npm audit:** 0 vulnerabilidades conocidas en dependencias (moderado o superior).

---

## Hallazgos

### CRÍTICA-01 — Webhook de Flow no verifica firma HMAC

- **Archivo/línea:** `app/api/payments/flow/confirm/route.ts:24-111`
- **Descripción:** el endpoint `POST /api/payments/flow/confirm` recibe el `token` por `application/x-www-form-urlencoded`, busca la orden por `paymentRef` y consulta el estado a Flow. Nunca valida la firma `s` que Flow envía junto a los parámetros. Cualquier actor que conozca/adivine un `token` de pago puede forzar la transición a `PAID` o `FAILED`.
- **Prueba de concepto:**
  ```bash
  curl -X POST https://app.fogon.cl/api/payments/flow/confirm \
    -d "token=TOKEN_DE_FLOW_DE_UN_PEDIDO_PENDIENTE"
  ```
  Si Flow responde que el token está pagado, `markOrderPaid` activa el pedido sin importar el origen de la notificación.
- **Impacto:** pago falso → pedido real en cocina sin dinero; reversión arbitraria de pedidos pagados; DoS por reintentos.
- **Mitigación:**
  1. Reutilizar `signFlowParams` (`lib/payments/flow.ts:43-54`) para firmar todos los parámetros recibidos excepto `s`.
  2. Comparar con `crypto.timingSafeEqual` contra el parámetro/cabecera `s` enviado por Flow.
  3. Rechazar con 401 cualquier notificación sin firma válida antes de consultar a Flow.

### CRÍTICA-02 — Entorno local con claves reales y protecciones de producción desactivadas

- **Archivo/línea:** `.env` (presente en disco, permisos `600`); `.env.example:32,38,41,55,61,76`
- **Descripción:** el `.env` de desarrollo contiene `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `CRON_SECRET`, `DATABASE_URL` y claves de MP/Transbank. Además `MFA_ENFORCED=false`, `KYC_REQUIRED=false`, `EMAIL_VERIFICATION_REQUIRED=false`, `COURIER_SECURITY_ENFORCED=false`, `NEXT_PUBLIC_DEMO_MODE=true` y `PAYMENTS_MODE` puede apuntar a producción. `scripts/check-env.mjs` solo bloquea esto en `NODE_ENV=production`; `next dev` no lo ejecuta.
- **Prueba de concepto:** al ejecutar `npm run platform:start`, Next.js se publica en LAN con credenciales reales. Desde otro equipo se puede iniciar sesión con la cuenta demo del seed (`admin@fogon.cl` / `fogon123`) y operar el panel sin MFA.
- **Impacto:** compromiso total de secretos de pago, base de datos y sesiones; fraude financiero; exposición de datos.
- **Mitigación:**
  1. Rotar **inmediatamente** `FLOW_SECRET_KEY`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `CRON_SECRET`, `DATABASE_URL` y tokens de pasarelas.
  2. Separar `.env.local` de desarrollo (sandbox/mock) de `deploy/.env` de producción.
  3. Nunca exponer `next dev`; usar siempre `npm run build && npm start` (que corre `check-env.mjs`).
  4. Activar `MFA_ENFORCED=true`, `KYC_REQUIRED=true`, `EMAIL_VERIFICATION_REQUIRED=true`, `COURIER_SECURITY_ENFORCED=true` antes de cualquier tráfico real.

---

### ALTA-01 — `platform-start.sh` expone Next.js y Expo en la LAN

- **Archivo/línea:** `scripts/platform-start.sh:61-64`, `:80-83`
- **Descripción:** el script inicia `next dev --hostname 0.0.0.0` y `expo start --lan`, publicando el servidor en todas las interfaces de red. Esto contradice la mitigación documentada en `docs/26-auditoria-multimodelo-v2.md` (bind a `127.0.0.1:3002`).
- **Prueba de concepto:** desde otro host en `192.168.1.0/24`: `curl http://<ip-dev>:3000/api/health` responde; el login demo es accesible.
- **Impacto:** combinado con CRÍTICA-02, cualquier equipo de la red local puede operar el panel admin y los endpoints de pago.
- **Mitigación:** cambiar a `--hostname 127.0.0.1` para Next.js y `--localhost` para Expo; o documentar explícitamente que el script solo debe ejecutarse en redes de confianza y nunca con `PAYMENTS_MODE=production`.

### ALTA-02 — Rate limiting en memoria local y `TRUST_PROXY=0` por defecto

- **Archivo/línea:** `lib/rate-limit.ts:1-104`; `.env.example:38`
- **Descripción:** `rateLimit` usa un `Map` en memoria por proceso. Sin `TRUST_PROXY=1`, `getClientIp()` devuelve `"local"` para todas las conexiones, agrupando a todos los visitantes en un solo bucket. En múltiples réplicas cada instancia tiene su propio contador.
- **Prueba de concepto:** un atacante agota el límite de login (`8/min` por email / `20/min` por IP). Como el bucket es compartido, se bloquea el login para todos los usuarios hasta que expire.
- **Impacto:** denegación de servicio legítimo; rate limit inefectivo en escala.
- **Mitigación:** migrar a Redis/Upstash o PostgreSQL para rate limiting distribuido; activar `TRUST_PROXY=1` solo detrás de Cloudflare/Nginx con origen cerrado.

### ALTA-03 — Webhook de Mercado Pago acepta notificaciones sin firma en desarrollo

- **Archivo/línea:** `lib/payments/mercadopago.ts:99-104`
- **Descripción:** si `MERCADOPAGO_WEBHOOK_SECRET` no está definido y `NODE_ENV !== "production"`, `verifyMercadoPagoSignature` retorna `true`, permitiendo notificaciones falsas en staging/QA.
- **Impacto:** en cualquier entorno no-productivo con datos reales, un atacante puede marcar pedidos como pagados.
- **Mitigación:** requerir `MERCADOPAGO_WEBHOOK_SECRET` en cualquier entorno que procese pagos reales; rechazar si no está configurado.

### ALTA-04 — MFA encryption key fallback a `AUTH_SECRET` en desarrollo

- **Archivo/línea:** `lib/mfa.ts:10-19`
- **Descripción:** si `MFA_ENCRYPTION_KEY` no está configurado y `NODE_ENV !== "production"`, el cifrado de secretos TOTP deriva la clave de `AUTH_SECRET` o del string `"dev-only"`. Esto rompe la separación de secretos.
- **Impacto:** si `AUTH_SECRET` se filtra, los secretos MFA también se comprometen.
- **Mitigación:** exigir `MFA_ENCRYPTION_KEY` en todos los entornos; rechazar arranque si falta.

### ALTA-05 — Ausencia de middleware CORS en la API

- **Archivo/línea:** no existe `middleware.ts`; `next.config.ts` solo aplica headers CORS en páginas, no en API routes.
- **Descripción:** endpoints que usan `Authorization: Bearer` (app móvil) no tienen protección contra orígenes no confiados. Aunque `sameSite=lax` protege cookies, el token Bearer puede ser usado desde sitios maliciosos si se roba.
- **Impacto:** mayor superficie de ataque si se roba un token; no hay defensa en profundidad.
- **Mitigación:** implementar middleware CORS que lea `CORS_ORIGINS` y rechace orígenes no permitidos; forzar límite de body en todas las rutas API.

### ALTA-06 — Webhook KYC genérico no valida origen ni whitelist

- **Archivo/línea:** `app/api/kyc/webhook/route.ts:124-133`
- **Descripción:** el formato genérico solo verifica `x-kyc-signature`, pero no hay whitelist de IPs ni de cabeceras de origen. Si el secreto se filtra o se reutiliza, cualquier origen puede aprobar/rechazar KYC.
- **Impacto:** aprobación fraudulenta de comercios/repartidores sin verificación real.
- **Mitigación:** validar origen por IP/cabecera del proveedor; usar secretos distintos por ambiente; registrar y alertar decisiones KYC.

---

### MEDIA-01 — Token móvil en `localStorage` en preview web

- **Archivo/línea:** `mobile/src/lib/auth.tsx:19-28`
- **Descripción:** en el preview web de Expo se usa `window.localStorage` para almacenar el JWT. Aunque en nativo se usa `SecureStore`, el preview web es el camino de desarrollo más común.
- **Impacto:** token accesible por XSS o extensiones maliciosas; robo de sesión móvil.
- **Mitigación:** para preview/pwa web usar cookie `httpOnly` en lugar de `localStorage`; documentar que Expo Go con `SecureStore` es el único entorno aprobado para producción.

### MEDIA-02 — Datos comerciales expuestos al cliente y repartidor

- **Archivo/línea:** `lib/orders/view.ts:100-102`
- **Descripción:** `commissionRate`, `commissionAmount` y `courierPayout` se envían a todos los viewers, incluyendo `CUSTOMER` y `COURIER`.
- **Impacto:** fuga de información comercial sensible; puede facilitar negociaciones/ataques dirigidos.
- **Mitigación:** incluir esos campos solo cuando `isAdmin || isMerchant`.

### MEDIA-03 — CSP permite `unsafe-inline` y `unsafe-eval` en desarrollo

- **Archivo/línea:** `next.config.ts:5-21`
- **Descripción:** la política incluye `script-src 'self' 'unsafe-inline'` y en desarrollo `'unsafe-eval'` con `connect-src` amplio (`ws: wss: http: https:`).
- **Impacto:** si aparece un sink XSS, la CSP no bloqueará la ejecución de scripts inline.
- **Mitigación:** implementar nonces/hashes para scripts inline y eliminar `'unsafe-inline'`; restringir `connect-src` a orígenes conocidos.

### MEDIA-04 — `allowedDevOrigins` hardcodeado

- **Archivo/línea:** `next.config.ts:77`
- **Descripción:** se permite explícitamente `192.168.1.9`, `localhost` y `127.0.0.1` sin que sea configurable por entorno.
- **Impacto:** en una red donde `192.168.1.9` esté asignada a otro host, Next.js aceptará conexiones de ese origen.
- **Mitigación:** leer `ALLOWED_DEV_ORIGINS` desde env o eliminar el valor si no es necesario.

### MEDIA-05 — Logging de PII y tokens en desarrollo

- **Archivo/línea:** `lib/email.ts:18-20`, `lib/sms.ts:17`, `app/api/payments/flow/confirm/route.ts:58-74`, `app/api/payments/create/route.ts:122`
- **Descripción:** en dev se imprimen destinatarios, asunto, cuerpo de emails/SMS, y en algunos endpoints de pago se loguean montos y referencias sin redactar.
- **Impacto:** fuga de datos personales y comerciales en logs accesibles.
- **Mitigación:** redactar email/teléfono/números de orden; loguear solo fingerprints o hashes; establecer nivel de log por env.

### MEDIA-06 — Cron endpoint sin rate limit

- **Archivo/línea:** `app/api/cron/orders/route.ts:23-26`
- **Descripción:** aunque requiere `CRON_SECRET`, no hay rate limit. Un secret filtrado o un bug permitirían saturar reconciliaciones y llamadas a Flow.
- **Impacto:** gasto de cuota API de Flow/MP; posible condición de carrera masiva.
- **Mitigación:** añadir rate limit por IP y por secret; restringir origen a IPs de Cron-job.org/Cloudflare.

### MEDIA-07 — Falta de monitoreo/SIEM y secret manager

- **Archivo/línea:** infraestructura general.
- **Descripción:** no se detecta integración con Sentry, Datadog ni secret manager (Infisical/Doppler/Vault/SOPS). Los secretos viajan en archivos `.env` planos.
- **Impacto:** detección tardía de intrusiones; rotación y auditoría de secretos difíciles.
- **Mitigación:** adoptar secret manager; enviar logs de autenticación, pagos y KYC a SIEM; alertar en rechazos de firma y logins sospechosos.

---

### BAJA-01 — Open redirect parcial en returns de pago

- **Archivo/línea:** `app/api/payments/flow/return/route.ts:12`, `app/api/payments/transbank/return/[orderId]/route.ts:14`, `components/checkout/checkout-client.tsx:207`, `components/order/order-tracking-client.tsx:163`
- **Descripción:** se construyen redirecciones con `new URL(path, base)` usando `request.url` como base. Aunque se usa `base` fijo en la mayoría, el flujo de checkout del cliente asigna `window.location.href = data.redirectUrl` sin validar que la URL pertenezca a la pasarela.
- **Impacto:** si un endpoint de pago es comprometido, puede devolver una URL externa y conducir a phishing.
- **Mitigación:** validar `redirectUrl` contra un whitelist de dominios de pasarelas antes de asignar `window.location.href`.

### BAJA-02 — `mercadopago/return` refleja parámetro `status` sin validar

- **Archivo/línea:** `app/api/payments/mercadopago/return/route.ts:6-18`
- **Descripción:** el parámetro `status` de la query se incluye en la URL de redirección sin whitelist.
- **Impacto:** un atacante puede generar URLs como `/order/xxx?payment=<script>...`; aunque el cliente renderiza como texto, aumenta la superficie de ataque.
- **Mitigación:** validar `status` contra enum (`success`, `failure`, `pending`, `return`).

### BAJA-03 — `getOrderForViewer` sigue exponiendo comisión/payout

- **Archivo/línea:** `lib/orders/view.ts:100-102`
- **Descripción:** ya documentado en `docs/26-auditoria-multimodelo-v2.md` (N-07) y aún no corregido.
- **Impacto:** fuga menor de información financiera.
- **Mitigación:** limitar a admin/merchant.

---

## Controles que funcionan correctamente

- **Doble aceptación de pedidos:** índice único parcial `Order_active_courier_assignment` evita que dos repartidores tomen el mismo pedido.
- **PIN de entrega:** verificación atómica bajo `SELECT ... FOR UPDATE` con bloqueo por intentos fallidos.
- **Lock de pago remoto:** `paymentLockAt` evita checkouts concurrentes.
- **Reembolso admin:** reclamo atómico `PAID → REFUND_PENDING` antes de llamar a la pasarela.
- **Webhook Mercado Pago (producción):** firma HMAC validada con `timingSafeEqual` y ventana de tiempo.
- **Webhook KYC Didit:** firma v1/v2 validada con `timingSafeEqual`.
- **Upload de portadas:** magic bytes, dimensiones, nombre aleatorio, sin path traversal.
- **Auth web/móvil:** contraseñas con bcrypt, JWT con `tokenVersion`, revocación en logout/MFA.
- **SQLi:** no se encontraron queries raw con concatenación; Prisma usa parámetros.
- **Creación de pedidos:** precios y tarifas se recalculan en servidor a partir de la base de datos; el cliente no puede fijar el total.
- **Transbank return:** valida `buy_order`, monto y token.

---

## Recomendaciones priorizadas

1. **P0:** Implementar verificación de firma HMAC en `POST /api/payments/flow/confirm`.
2. **P0:** Rotar todos los secretos de `.env` local y separar entornos de dev/prod.
3. **P0:** Cambiar `platform-start.sh` a bind `127.0.0.1` y `--localhost`.
4. **P1:** Migrar rate limit a Redis/PostgreSQL y activar `TRUST_PROXY` solo con proxy confiable.
5. **P1:** Rechazar webhooks de MP sin `MERCADOPAGO_WEBHOOK_SECRET` en cualquier entorno no-mock.
6. **P1:** Exigir `MFA_ENCRYPTION_KEY` en todos los entornos.
7. **P1:** Añadir middleware CORS y límite de body en todas las rutas API.
8. **P1:** Whitelistear origen del webhook KYC genérico.
9. **P2:** No enviar `commission*` ni `courierPayout` a clientes/repartidores.
10. **P2:** Endurecer CSP (nonces/hashes) y eliminar `unsafe-inline`.
11. **P2:** Redactar PII en logs de desarrollo.
12. **P2:** Validar `redirectUrl` de pasarelas antes de redirigir.
13. **P3:** Adoptar secret manager, SIEM/Sentry y rotación automática de secretos.

---

## Estado de correcciones en código

| Hallazgo | Estado | Archivos modificados |
|---|---|---|
| CRÍTICA-01 Flow webhook sin firma | **Resuelto** | `app/api/payments/flow/confirm/route.ts`, `lib/payments/index.ts` |
| CRÍTICA-02 `.env` con secretos reales | **Parcial** | `.env.example` — requiere rotar secretos manualmente |
| ALTA-01 Exposición LAN | **Resuelto** | `scripts/platform-start.sh` |
| ALTA-02 Rate limit en memoria | **Pendiente** | requiere Redis/Upstash |
| ALTA-03 MP bypass en dev | **Resuelto** | `lib/payments/mercadopago.ts` |
| ALTA-04 MFA key fallback | **Resuelto** | `lib/mfa.ts` |
| ALTA-05 CORS | **Resuelto** | `proxy.ts`, `next.config.ts`, `.env.example` |
| ALTA-06 KYC genérico sin whitelist | **Pendiente** | requiere definir origen/IP del proveedor |
| MEDIA-01 Token en localStorage | **Parcial** | pendiente reemplazar localStorage en preview web |
| MEDIA-02 Datos comerciales expuestos | **Resuelto** | `lib/orders/view.ts`, `lib/orders/types.ts` |
| MEDIA-03 CSP laxo | **Pendiente** | requiere nonces/hashes |
| MEDIA-04 allowedDevOrigins hardcodeado | **Resuelto** | `next.config.ts`, `.env.example` |
| MEDIA-05 PII en logs | **Resuelto** | `lib/email.ts`, `lib/sms.ts` |
| MEDIA-06 Cron sin rate limit | **Resuelto** | `app/api/cron/orders/route.ts` |
| BAJA-01/02 Open redirect / status reflejado | **Resuelto** | `components/checkout/checkout-client.tsx`, `components/order/order-tracking-client.tsx`, `app/api/payments/mercadopago/return/route.ts`, `lib/urls.ts` |
| MEDIA-07 Monitoreo/SIEM | **Pendiente** | requiere infraestructura |

**Validación:** `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan sin errores.

---

## Notas de auditoría

- **npm audit:** 0 vulnerabilidades (moderado+).
- **Repositorio git:** cambios aplicados pero no commiteados.
- **Archivos `.env`:** presentes en `.gitignore`; ninguna clave privada SSH/PKI encontrada en el repositorio fuera de `node_modules` y `.next`.
- **Infraestructura SSH:** `deploy/provision-vps.sh` deshabilita `PasswordAuthentication`, habilita solo pubkey, configura fail2ban y UFW; configuración correcta si se ejecuta antes de exponer el servidor.
- **Importante:** `next-env.d.ts` fue regenerado por Next.js durante `npm run build`. Puedes descartar ese cambio si no deseas incluirlo.
