# Auditoría externa — Resultados finales

**Fecha:** 2026-11-10 · **Metodología:** briefing `docs/29-briefing-auditoria-externa.md` (análisis estático multi-agente + pruebas dinámicas contra servidor local con build actual).  
**Alcance:** 8 focos — IDOR, lógica de negocio/pagos, webhooks, mobile, inyección, DoS, infraestructura, KYC.  
**Base auditada:** incluye todas las correcciones de `docs/28-auditoria-seguridad-2026-11-10.md` (sin commitear aún).

---

## Correcciones aplicadas tras esta auditoría (mismo día)

| Hallazgo | Estado | Cambios |
|---|---|---|
| **ALTA-01** body chunked sin tope | **Resuelto** | `lib/request.ts`: `readBodyBytes` impone tope real por stream (independiente de `Content-Length`); `readJsonBody`/`readFormBody`/`readTextBody` reemplazan `request.json()/formData()/text()` en los 12 handlers con body. |
| **ALTA-02** polling sin rate limit | **Resuelto** | Rate limits en GETs: `/api/orders/[id]` (120/min), `/api/courier` (120/min), `/api/merchant/orders` (60/min), `/api/mobile/me`·`orders`·`addresses` (60/min), `/api/mobile/courier/earnings` (30/min). `events` con `take: 50` en `loadOrder` y `getOrderForViewer`; `take: 50` en addresses. |
| **ALTA-03** MP ignora reembolsos/contracargos | **Resuelto** | `lib/payments/sync.ts`: nueva `markOrderRefundedByProvider` (lock de fila, idempotente, evento `PAYMENT_REFUNDED_BY_PROVIDER` + alerta). Webhook MP enruta `refunded`/`charged_back` a esa función en vez de `markPaymentFailed`. |
| **MEDIA-01** `REFUND_PENDING` huérfano | **Resuelto** | `/api/cron/orders` procesa `REFUND_PENDING` (MP/Transbank vía `refundPayment`; CASH/MOCK manual) con idempotencia por evento `REFUND_EXECUTED`; Flow queda como gestión manual documentada. Comentario de early-return en `admin.ts` actualizado. |
| **MEDIA-02(a)** bucket global `"local"` en webhook Flow | **Mitigado** | `flow/confirm`: las notificaciones con firma HMAC válida no consumen el bucket por IP — un atacante sin firma no puede desplazar las confirmaciones reales de Flow. (La migración a Redis sigue pendiente.) |
| **MEDIA-02(b)** evicción FIFO de buckets activos | **Resuelto** | `lib/rate-limit.ts`: cleanup solo expulsa buckets expirados y, si el mapa sigue lleno, rechaza claves NUEVAS (fail-closed) en vez de borrar buckets de víctimas. |
| **MEDIA-03** KYC genérico sin ts/orden | **Resuelto** | Firma `HMAC("<ts>.<raw>")` con `x-kyc-timestamp` (ventana ±300 s) + guard de orden con `providerEventAt` (portado del flujo Didit). |
| **MEDIA-04** `redirectUrl` móvil sin validar | **Resuelto** | `mobile/src/lib/urls.ts` (whitelist de pasarelas) + validación antes de `Linking.openURL` en checkout móvil; solo http(s). |
| **MEDIA-05** granja de pedidos/cuentas | **Resuelto** | `POST /api/orders`: tope 50 pedidos/día por cuenta y máx. 3 `PENDING_PAYMENT` vivos. |
| **MEDIA-06** `flow/return` sin límite | **Resuelto** | Rate limit por token (10/min) e IP (60/min) en `flow/return` + body con tope real. |
| **MEDIA-07** caddy/cloudflared como root | **Resuelto** | `deploy/docker-compose.yml`: caddy `user: 1000:1000` + `NET_BIND_SERVICE`; cloudflared `user: 65532:65532`. |
| **MEDIA-08** root SSH + fail2ban parcial | **Resuelto (script)** | `provision-vps.sh`: `PermitRootLogin no` + revocación de `/root/.ssh/authorized_keys` tras verificar claves de `deploy`. (Jail fail2ban para HTTP sigue pendiente.) |
| **MEDIA-10** token en `localStorage` (web preview) | **Mitigado** | `mobile/src/lib/auth.tsx`: `sessionStorage` (no persiste entre sesiones del navegador). |
| **BAJA-1** `orderId` en MP return | **Resuelto** | Validación `/^[A-Za-z0-9_-]{6,64}$/`; `../admin` → `/orders`. **Probado.** |
| **BAJA-2** ventana firma MP ±1 h | **Resuelto** | Reducida a ±600 s. |
| **BAJA-4** bug de cleanup en rate limit | **Resuelto** | Eliminado el early-return que solo examinaba el primer bucket. |
| **BAJA-5** oracle `clientRequestId` ajeno | **Resuelto** | Respuesta 404 genérica indistinguible de inexistente. |
| **BAJA-6** superficie residual CASH | **Resuelto** | Gate `ALLOW_CASH_ORDERS` (default off) en `POST /api/orders` y `createPayment`. |
| **BAJA-7** repartidor ve desglose comercial | **Resuelto** | `serializeOrder`: subtotal/envío/servicio/descuento solo para admin/merchant/customer; courier ve total, propina y payout. |
| **BAJA-8** `findMany` sin `take` | **Resuelto** | `take: 200` en earnings y listas del cron (addresses ya tenía `take: 50`). |
| **BAJA-9** CI sin `permissions` | **Resuelto** | `permissions: contents: read` en `.github/workflows/security.yml`. |
| **BAJA-10** `cloudflared:latest` | **Documentado** | Comentario en compose pidiendo fijar versión/digest antes de producción. |

**Pendientes que requieren decisiones/infraestructura externa:** MEDIA-09 (certificate pinning + Play Integrity/App Attest — desarrollo nativo), BAJA-3 (documentación de firma Flow), BAJA-11 (whitelist de deeplinks — mitigable al añadir rutas con side-effects), BAJA-12 (TLS en DB si se separa de host), rotación real de secretos del `.env`, Redis/Upstash para rate limit distribuido, SIEM/Sentry.

Validación: `tsc --noEmit`, `lint` y `build` pasan; pruebas dinámicas de regresión ejecutadas (ver §Pruebas dinámicas).

---

## Resumen ejecutivo

| Severidad | Hallazgos | Resumen |
|---|---|---|
| Crítica | 0 | — |
| Alta | 3 | Body chunked sin tope (OOM); polling autenticado sin rate limit; MP ignora reembolsos/contracargos sobre pedidos PAID |
| Media | 10 | Ver listado consolidado |
| Baja | 8 | Ver listado consolidado |

**Controles verificados que funcionan (sin hallazgos):**
- **IDOR/acceso (FOCO 1):** los 26 endpoints de `app/api/**` y las 24 server actions de `app/actions/**` validan ownership server-side. Sin IDOR explotable. Separación ADMIN/SUPPORT efectiva.
- **Lógica de negocio (FOCO 2):** total/precios/tarifas siempre recalculados desde DB; CASH fuera de los enums (sin bypass); idempotencia real de pedidos (`clientRequestId` único) y pagos (`paymentLockAt`, `FOR UPDATE`, claim atómico de reembolso); tip acotado 0–10000; montos verificados contra las 3 pasarelas (Transbank incluso revierte en mismatch).
- **Inyección (FOCO 5):** SQLi limpio (solo `Prisma.sql` parametrizado); XSS limpio (sin sinks, CSSOM no ejecuta); SSRF limpio (bases fijas); uploads con magic bytes/ownership/nombre server-side; `safeHttpUrl`/`isTrustedPaymentRedirectUrl` sin bypass (userinfo, subdominios, puertos, `data:`/`javascript:` bloqueados).
- **Pruebas dinámicas:** 12/12 pasan (ver §Pruebas dinámicas).

---

## Hallazgos consolidados (deduplicados)

### ALTA-01 — Límite de body eludible con `Transfer-Encoding: chunked`

- **Archivos:** `lib/request.ts:2-6`; consumidores en `app/api/**` (incl. `/api/mobile/auth/login` sin autenticar). Perfil tunnel sin proxy que compense (`deploy/docker-compose.yml:121-134`).
- **Descripción:** `exceedsBodyLimit` depende solo de `Content-Length`. Una petición chunked sin esa cabecera evita el 413 y `request.json()/formData()` bufferiza sin tope. Cloudflare deja pasar ~100 MB por request.
- **PoC:** `head -c 300000000 /dev/zero | tr '\0' 'a' | curl -s -X POST http://host/api/mobile/auth/login -H 'Transfer-Encoding: chunked' --data-binary @-` ×10-20 → OOM del contenedor único; `restart: unless-stopped` permite repetirlo indefinidamente.
- **Impacto:** caída total de plataforma (pedidos/cocina/reparto) con recursos triviales y sin autenticar.
- **Mitigación:** límite real por stream (leer hasta maxBytes+1 y abortar con 413, independiente de cabeceras) + `request_body max_size` equivalente en el perfil tunnel. No rompe webhooks: es más estricto que lo actual.

### ALTA-02 — Polling autenticado sin rate limit con queries pesadas

- **Archivos:** `app/api/orders/[id]/route.ts:205-224` (GET sin límite; `loadOrder` incluye `events` sin `take`); `app/api/courier/route.ts:7-27`; `app/api/merchant/orders/route.ts`; `app/api/mobile/{me,orders,addresses}/route.ts`.
- **Descripción:** los GETs que la app sondea cada 5 s no tienen rate limit. Una cuenta customer gratuita permite cientos de joins concurrentes (order+items+events+reviews+store+courier) sin tope; `events`/`reviews` crecen ilimitado por pedido.
- **PoC:** 200 `curl -H "Authorization: Bearer $TOKEN" .../api/orders/<orderIdPropio> &` → saturación del pool de Postgres en el VPS único.
- **Impacto:** degradación/caída autenticada para todos los usuarios.
- **Mitigación:** `rateLimit("order-view:"+session.id, 120, 60_000)` y equivalente en los demás GETs (la app legítima sondea 12/min); `take: 50` en `events`; considerar ETag/caché 5 s.

### ALTA-03 — Webhook de Mercado Pago ignora reembolsos y contracargos sobre pedidos PAID

- **Archivos:** `app/api/payments/webhook/mercadopago/route.ts:77-84` → `lib/payments/sync.ts:123-136`.
- **Descripción:** `refunded`/`charged_back` caen en `markPaymentFailed()`, que hace early-return si `paymentStatus ∈ {PAID, REFUND_PENDING, REFUNDED}` — sin evento, sin log, sin cambio. Un contracargo en MP deja el pedido en `PAID` indefinidamente; nada lo reconcilia después (única referencia en el repo).
- **PoC:** pagar en sandbox MP → reembolsar/contracargar desde el panel MP → webhook con firma válida → `GET /api/orders/<id>` sigue `paymentStatus: "PAID"` y la cocina continúa.
- **Impacto:** entrega de comida por dinero ya recuperado por el cliente; contabilidad interna nunca refleja el contracargo.
- **Mitigación:** en la rama `refunded`/`charged_back` con `paymentStatus === "PAID"`: transición a `REFUND_PENDING`/`REFUNDED` + `orderEvent` `PAYMENT_REFUNDED_BY_PROVIDER` + alerta admin. No usar `markPaymentFailed` para semántica de reversa.

---

### MEDIA-01 — `REFUND_PENDING` huérfano: se marca sin ejecutar reembolso y bloquea el reembolso posterior

- **Archivos:** `app/actions/admin.ts:193-195, 215-227`; `app/api/cron/orders/route.ts:169-184`; `app/api/orders/[id]/route.ts:479`.
- **Descripción:** 3 caminos ponen `REFUND_PENDING` sin llamar nunca a `refundPayment()` (cancel admin de PAID, cron 5-min, cancelación courier/admin). Luego la acción admin `refund` hace early-return sobre `REFUND_PENDING` ("se reconcila") sin reconciliador: el dinero queda cobrado y el reembolso es imposible desde el panel.
- **Impacto:** retención indebida de dinero (riesgo SERNAC + contracargos forzados que caen en ALTA-03); carga operativa manual.
- **Mitigación:** cola/procesador de `REFUND_PENDING` que ejecute `refundPayment` + `markOrderRefunded`, con campo `refundRef` para idempotencia; o permitir que la acción `refund` dispare `refundPayment` si no hay refund previo registrado.

### MEDIA-02 — Rate limit en memoria: dos mecanismos de bypass

- **Archivos:** `lib/rate-limit.ts:8, 17-25, 97-99`.
- **Descripción (a — bucket global):** sin `TRUST_PROXY=1`, `getClientIp()` devuelve `"local"` para todos → límites "por IP" (`mobile-login-ip` 30/min, `flow-confirm` 30/min) son **globales del endpoint**: 30 peticiones basura agotan el bucket y las notificaciones reales de Flow reciben 429 (o el login se bloquea para todos).
- **Descripción (b — evicción FIFO):** al superar 20 000 claves se expulsa a los buckets más antiguos **aunque estén activos**. Con ~350 IPs rotando (claves `mobile-login:${ip}:${email}`), un atacante evicta continuamente el bucket de la víctima y resetea su contador → fuerza bruta sostenida pese al rate limit.
- **Mitigación inmediata:** (a) para el webhook Flow, verificar firma HMAC **antes** del rate limit por IP o limitar solo por token; (b) evictar solo buckets expirados y, si hay exceso, rechazar claves nuevas (fail-closed). **Definitiva:** Redis/Upstash (pendiente conocido) resuelve ambos.

### MEDIA-03 — Webhook KYC genérico sin timestamp ni control de orden: replay invierte decisiones

- **Archivos:** `app/api/kyc/webhook/route.ts:76-80, 123-155` (la rama Didit sí tiene ts ±300 s y guard de orden en `lib/kyc.ts:127-135`).
- **Descripción:** la rama genérica firma solo el raw body, sin timestamp y sin guard de orden. Una notificación capturada puede reenviarse indefinidamente; un `REJECTED` viejo puede pisar un `APPROVED` nuevo (o viceversa: reactivar un merchant rechazado).
- **Mitigación:** incluir `ts` en el manifiesto firmado (±300 s como Didit), registrar `providerEventAt` y aplicar el guard de orden de `applyDiditDecision` a la rama genérica. Complementario con la whitelist de origen aún pendiente.

### MEDIA-04 — `redirectUrl` sin validar en la app móvil (`Linking.openURL`)

- **Archivos:** `mobile/src/app/(customer)/checkout.tsx:166-169`. El fix web existe (`components/checkout/checkout-client.tsx` + `lib/urls.ts`), pero el móvil abre cualquier `data.redirectUrl` sin filtro.
- **Descripción:** `Linking.openURL` acepta cualquier esquema (`https://` arbitrario, `intent://`, deeplinks de otras apps). Una respuesta manipulada (MITM, pasarela comprometida, mock) abre phishing en el paso de mayor confianza.
- **Mitigación:** portar la whitelist de hosts de `lib/urls.ts` a `mobile/src/lib/urls.ts` y validar antes de `Linking.openURL`; rechazar esquemas no http(s). Consistente con el fix web.

### MEDIA-05 — Creación masiva de pedidos y cuentas sin tope agregado

- **Archivos:** `app/api/orders/route.ts:30, 61`; `app/actions/auth.ts:49-58`.
- **Descripción:** 12 pedidos/min **por cuenta** sin tope diario ni máx. `PENDING_PAYMENT` vivos; registro 20/h por IP con rotación; `clientRequestId` opcional desde el móvil. N cuentas × 12/min = granja de pedidos falsos que satura la API de Flow/MP (riesgo de suspensión del comercio) y encola pedidos en cocinas reales.
- **Mitigación:** tope diario por cuenta (p. ej. 50/día), máx. 3 `PENDING_PAYMENT` vivos, exigir email verificado antes del primer pedido, requerir `clientRequestId` desde el móvil.

### MEDIA-06 — `flow/return` sin rate limit ni firma, dispara llamadas a Flow por request

- **Archivos:** `app/api/payments/flow/return/route.ts:15-95`; exención CORS en `proxy.ts:49-52`.
- **Descripción:** con un token de Flow propio (pedido pendiente), un loop infinito ejecuta `findFirst` + llamada HTTP a Flow + posibles escrituras por request, sin límite.
- **Mitigación:** rate limit por IP y por token (como ya se hizo en `confirm`); el retorno legítimo del navegador es 1-2 requests.

### MEDIA-07 — Contenedores `caddy` y `cloudflared` corren como root

- **Archivos:** `deploy/docker-compose.yml:96-119, 121-134` (sin `user:`; `app`/`migrate`/postgres son non-root, correctos).
- **Impacto:** exploit en Caddy (parser TLS/HTTP) o cloudflared = root en el host (acceso a `pgdata`, backups).
- **Mitigación:** caddy → `user: 1000:1000` + `cap_add: [NET_BIND_SERVICE]`; cloudflared → `user: 65532:65532`; ajustar permisos de volúmenes.

### MEDIA-08 — SSH: root por clave sigue habilitado; fail2ban solo protege SSH

- **Archivos:** `deploy/provision-vps.sh:76` (`PermitRootLogin prohibit-password`), `:65-69` (copia claves de root a deploy sin revocar las de root), `:112-122` (jail único `[sshd]`).
- **Descripción:** `prohibit-password` mantiene login root por clave (UID 0) como vía permanente; fail2ban no cubre el abuso HTTP (ALTA-01/02, MEDIA-02) — la única defensa HTTP es el rate limit en memoria.
- **Mitigación:** tras validar `deploy`: `PermitRootLogin no` (o `AllowUsers deploy`) y vaciar `/root/.ssh/authorized_keys`; jail fail2ban para Caddy/logs de app o export de 429s.

### MEDIA-09 — Sin certificate pinning ni App Attest/Play Integrity en la app móvil

- **Archivos:** `mobile/package.json` (sin dependencias al efecto), `mobile/src/lib/api.ts:24`.
- **Descripción:** la app confía en las CAs del dispositivo → una CA instalada intercepta TLS y captura el JWT Bearer de 7 días y credenciales; sin atestación para bloquear clientes modificados (GPS simulado de repartidores, bots de pedidos).
- **Mitigación:** pinning con pin de backup (rotación Cloudflare), Play Integrity/App Attest en login y endpoints courier, reducir vida del JWT móvil (7d → 1-2h) con refresh rotativo en SecureStore.

### MEDIA-10 — Residual: token en `localStorage` en preview web de Expo

- **Archivos:** `mobile/src/lib/auth.tsx:19, 28` (documentado como "Parcial" en doc 28; sigue presente). Agravante: `mobile/package.json` define `web`/`export:web` — si se publica esa exportación, el token quedaría en `localStorage` en producción.
- **Mitigación:** para preview/pwa web usar cookie httpOnly; no publicar la export web con el cliente localStorage.

---

### BAJA (consolidadas)

1. **`orderId` sin validar en MP return** — `app/api/payments/mercadopago/return/route.ts:12, 24-26`: `orderId=../admin` normaliza a `/admin` (mismo origin). Validar formato + `encodeURIComponent`.
2. **Ventana de firma MP ±3600 s** — `lib/payments/mercadopago.ts:121`: replay de notificación firmada hasta 1 h. Reducir a ±300–600 s; opcional dedupe por `x-request-id`.
3. **Firma HMAC de Flow opcional (omitir `s` la salta)** — `app/api/payments/flow/confirm/route.ts:68-82`: la seguridad real reside en la consulta server-side a Flow + token conocido + monto/commerceOrder. Documentar la fuente de verdad; hacer `s` obligatoria si Flow la envía en algún flujo. **Nota:** verificado en pruebas dinámicas — firma inválida → 401, válida → 200.
4. **Fallo de cierre temprano en cleanup de buckets** — `lib/rate-limit.ts:14` (`return` dentro del primer bucle hace que solo se examine el primer bucket cuando el mapa está al tope).
5. **Oracle de `clientRequestId` ajeno** — `app/api/orders/route.ts:61-79`: 409 distingue "ID existe de otro usuario" (fuga mínima). Unificar respuesta.
6. **Superficie residual CASH (código muerto)** — `app/api/orders/route.ts:364-383`, `lib/payments/index.ts:30-32`: rama CASH completa inalcanzable hoy (fuera de enums) pero viva; una refactorización podría reactivarla. Gate con `ALLOW_CASH_ORDERS` (default off) + test de regresión.
7. **Repartidor ve desglose comercial del pedido** — `lib/orders/view.ts:95-100`: el gating `showFinancials` cubre `commission*`/`courierPayout` pero no `subtotal/serviceFee/total` del cliente. Limitar para COURIER a `tip`+`courierPayout`+dirección+ítems.
8. **`findMany` sin `take` en endpoints secundarios** — `app/api/mobile/courier/earnings` (30 días sin tope), `app/api/cron/orders:56-67`, `app/api/mobile/addresses` (crece 1 dirección por pedido). Añadir `take` + paginación.
9. **CI sin `permissions` y acciones sin pin SHA** — `.github/workflows/security.yml`: añadir `permissions: contents: read`, pin por SHA, dependabot para actions.
10. **`cloudflared:latest` sin fijar** — `deploy/docker-compose.yml:123`: fijar versión/digest.
11. **Deeplinks sin whitelist explícita** — `mobile/app.json` scheme `fogon` enrutado automático; hoy bajo riesgo (solo lectura vía API con check de viewer), whitelist de rutas como defensa ante futuras side-effects.
12. **DB interna Docker sin TLS** — `deploy/entrypoint.sh:21`: aceptable en red `internal: true`; documentar requisito y TLS obligatorio si se separa la DB.

---

## Pruebas dinámicas

### Ronda 1 (auditoría, 12/12 pasan)

| # | Prueba | Resultado |
|---|---|---|
| 1 | GET pedido ajeno como cliente | 403 (vía `getOrderForViewer`; DB local sin pedidos ajenos — cobertura estática completa) |
| 2 | Repartidor ve pedido no asignado | 403 |
| 3 | Flow confirm token aleatorio ×35 | 30×200 → 5×429 (rate limit activo) |
| 4 | Flow confirm firma HMAC inválida | **401 Unauthorized** |
| 5 | Flow confirm firma HMAC válida (token inexistente) | **200 OK** (no rompe notificaciones legítimas) |
| 6 | Webhook MP sin `x-signature` | 401 "Firma inválida." |
| 7 | Pedido con `paymentProvider: "CASH"` | 400 (fuera del enum) |
| 8 | Cantidad -5 / 99999 | 400 (validación Zod min 1 / max 20) |
| 9 | Inyección `price`/`total`/`unitPrice` en item | Ignorada — total recalculado desde DB |
| 10 | Item de otro local en el carrito | 400 |
| 11 | `clientRequestId` duplicado | 200 `idempotente:true`, mismo orderId, sin nuevo pago |
| 12 | Cron sin/inválido Authorization; CORS preflight y POST desde origen maligno | 401 / 401 / 403 / 403 |

### Ronda 2 (regresión tras correcciones, 8/8 pasan)

| # | Prueba | Resultado |
|---|---|---|
| R1 | **Body chunked de 50 MB → `/api/mobile/auth/login`** | **413 en 0.39 s** — el stream se corta al superar 8 KB; sin bufferizar el payload (ALTA-01 cerrada) |
| R2 | Body chunked 50 MB → `/api/orders` sin sesión | 401 — el check de sesión precede a la lectura del body |
| R3 | Login JSON normal | 200 — sin regresión del flujo legítimo |
| R4 | `flow/confirm` formData con firma válida (`readFormBody`) | 200 OK |
| R5 | `flow/confirm` firma inválida | 401 |
| R6 | Webhook MP sin firma | 401 |
| R7 | `flow/return` mismo token ×12 | 10×200 → 429 (rate limit por token activo — MEDIA-06 cerrada) |
| R8 | `GET /api/orders/[id]` ×125 con una cuenta | 120×200 → 5×429 (rate limit 120/min activo — ALTA-02 cerrada) |

### Ronda 3 (regresión tras segunda tanda de correcciones, 6/6 pasan)

| # | Prueba | Resultado |
|---|---|---|
| T1 | Login normal | 200 — el rate limit fail-closed no rompe el flujo legítimo |
| T2 | `POST /api/orders` (llega hasta validación de negocio) | 400 "Elige Tamaño…" — los counts de los topes agregados corren sin error |
| T3 | MP return `orderId=../admin` | 307 → `/orders` (path traversal interno cerrado — BAJA-1) |
| T4 | MP return `orderId` válido | 307 → `/order/<id>?payment=success` (sin regresión) |
| T5 | KYC genérico sin `x-kyc-timestamp` (secret no configurado) | 503 — fail-closed: sin secret no procesa nada |
| T6 | KYC genérico con ts y firma inválida (secret no configurado) | 503 — misma protección |

---

## Prioridades de remediación

**P0 (caída de plataforma / dinero):**
1. ALTA-01 chunked body → límite real por stream + tunnel.
2. ALTA-02 polling sin rate limit → límites en GETs + `take` en `events`.
3. ALTA-03 + MEDIA-01 → manejar `refunded`/`charged_back` y procesador de `REFUND_PENDING`.

**P1 (bypass de controles / fraude):**
4. MEDIA-02 rate limit (fail-closed en evicción; firma antes del límite en webhook).
5. MEDIA-03 KYC replay (ts + orden).
6. MEDIA-04 redirectUrl móvil.
7. MEDIA-08 SSH root off + fail2ban HTTP.

**P2:**
8. MEDIA-05 topes agregados; MEDIA-06 flow/return; MEDIA-07 contenedores non-root; MEDIA-09 pinning/attest; MEDIA-10 localStorage.

**P3:** todas las BAJA.

---

## Notas finales

- `npm audit`: 0 vulnerabilidades (moderado+).
- Sin claves SSH/certificados/`.env` en el repo ni historial git (verificado).
- El subagente de IDOR verificó los 26 endpoints y 24 server actions uno a uno: sin omisiones de ownership.
- Hallazgos de la doc 28 re-verificados: sin bypass en los fixes (firma Flow, MP secret, gating financiero, redirects web, rate limit cron).
- `next-env.d.ts` fue regenerado por Next.js durante el build (descartable).
