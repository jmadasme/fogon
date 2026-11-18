# Auditoría de seguridad — Fogón v2

- Fecha: 2026-11-10
- Alcance: instancia local `http://localhost:3002` (v2.1.1) y revisión estática del código.
- autorización: pruebas controladas sobre el entorno del propietario.
- No se ejecutó una denegación de servicio destructiva. Los límites se probaron con
  ráfagas acotadas (6–13 solicitudes).

## Resumen ejecutivo

La aplicación resistió los ataques directos probados: IDOR, manipulación de JWT,
acceso cruzado entre locales, CSRF con origen malicioso, path traversal, subida de
archivos falsos, exposición de `.env`, open redirect y XSS reflejado.

El riesgo principal no está en esos controles, sino en la **configuración actual de
desarrollo con claves reales de Flow**:

- `NEXT_PUBLIC_DEMO_MODE` estaba en `true` (ya se cambió a `false`).
- `MFA_ENFORCED=false`.
- `KYC_REQUIRED=false`.
- `EMAIL_VERIFICATION_REQUIRED=false`.
- `COURIER_SECURITY_ENFORCED=false`.
- `TRUST_PROXY` sin definir.
- `PAYMENTS_MODE=production` con claves reales de Flow.

Mientras el servidor sea solo local no hay exposición externa. **No se debe exponer
este servidor de desarrollo por un túnel o dominio público** para recibir webhooks
de Flow: un visitante podría entrar con las cuentas demo, incluida la de admin, y
operar el panel sin MFA.

`scripts/check-env.mjs` ya rechaza esta configuración cuando `NODE_ENV=production`,
pero `next dev` no aplica ese control.

## Hallazgos

### CRÍTICO-01 — Servidor de desarrollo expuesto con cuentas demo y admin sin MFA

Evidencia:

- `/login` mostraba “Cuentas de prueba” con `admin@fogon.cl`, `local@fogon.cl` y
  `cliente@fogon.cl`.
- Fue posible iniciar sesión con `admin@fogon.cl` y llegar a `/admin`
  (“Operación de Santiago”) sin segundo factor.
- `MFA_ENFORCED=false` en `.env`.

Impacto: si se usa un túnel para el webhook de Flow, cualquiera que conozca la URL
puede entrar al panel de administración y a los paneles de locales con las
credenciales demo.

Acción tomada: `NEXT_PUBLIC_DEMO_MODE` se cambió a `false`, por lo que ya no se
muestran los botones demo. Las cuentas siguen existiendo y el MFA sigue desactivado;
no exponer el puerto de desarrollo.

Antes de cualquier túnel o despliegue:

1. `MFA_ENFORCED=true` y configurar MFA para admin y locales.
2. `KYC_REQUIRED=true` y `EMAIL_VERIFICATION_REQUIRED=true`.
3. `COURIER_SECURITY_ENFORCED=true`.
4. `TRUST_PROXY=1` solo detrás de Cloudflare/Nginx con el origen cerrado.
5. No usar `next dev` como servidor público. Usar build/start o el contenedor de
   producción con `scripts/check-env.mjs`.

### ALTO-01 — Claves reales de Flow en un entorno de desarrollo

`PAYMENTS_MODE=production` y las claves de Flow son reales, pero el resto de la
configuración es de desarrollo. Esto permite iniciar cobros reales desde una
instancia sin MFA, sin KYC obligatorio y sin verificación de email.

Impacto: fraude operativo o cobros no deseados si la instancia se expone.

Acción: separar `.env` de desarrollo y producción. Las claves productivas no deben
estar disponibles en un servidor de pruebas accesible por terceros.

### MEDIO-01 — Rate limit en memoria y IP compartida

`lib/rate-limit.ts` usa un `Map` en memoria. En múltiples procesos o réplicas cada
instancia tiene su propio contador. Además, sin `TRUST_PROXY`, `getClientIp()`
devuelve `"local"` para todos, por lo que los límites por IP son un único bucket
compartido.

Impacto: un atacante puede agotar el límite global de login y afectar a todos los
usuarios; en varias réplicas puede multiplicar intentos.

Acción: rate limit respaldado por Redis/PostgreSQL y `TRUST_PROXY=1` con origen
protegido. Mientras tanto, el límite por usuario/email sigue funcionando.

### MEDIO-02 — Callbacks Flow sin límite de frecuencia

`/api/payments/flow/confirm` y `/api/payments/flow/return` aceptan tokens y llaman a
la API de Flow. Un token aleatorio devolvió `200 OK` sin cambiar el pedido, pero
genera una llamada saliente y ruido de logs. No hay rate limit específico ni
validación estricta de formato de token.

Impacto: abuso de recursos y agotamiento de cuota de API de Flow. No permite marcar
un pedido como pagado sin un token válido de Flow.

Acción: validar longitud/caracteres del token y aplicar un límite por IP/token;
mantener respuesta idempotente.

### BAJO-01 — CSP permite `unsafe-inline`

En producción, `script-src` incluye `'unsafe-inline'`. No se encontró XSS ni
`dangerouslySetInnerHTML`, pero la política es más débil de lo necesario.

Acción: CSP con nonce/hash para los scripts de Next.js.

### BAJO-02 — Mutaciones sin header `Origin`

`proxy.ts` permite peticiones mutantes sin `Origin`. Las cookies son `SameSite=Lax`,
lo que bloquea el envío en POST cross-site del navegador, y el preflight malicioso
devuelve 403. Aun así, exigir `Origin` para mutaciones con cookie es defensa en
profundidad.

### BAJO-03 — Orígenes de desarrollo en `CORS_ORIGINS`

`.env` incluye `localhost:8081/8082/8083` y `192.168.1.9`. En producción deben
eliminarse.

### INFO-01 — `scripts/demo-cookie.mjs`

El script puede firmar una sesión de cualquier usuario con `AUTH_SECRET`. No está
expuesto por HTTP, pero no debería incluirse en una imagen de producción ni quedar
accesible para usuarios del servidor.

## Controles que resistieron

| Prueba | Resultado |
|---|---|
| Leer pedido de otro cliente (IDOR) | `403` |
| Modificar pedido de otro cliente | `409`, sin cambio de estado |
| Local A modifica pedido de Local B | `409`, sin cambio de estado |
| Cliente llama API de local | `403` |
| Cliente abre `/admin` | `307` a `/` |
| JWT con `role=ADMIN` y firma original | `401` |
| JWT `alg=none` | `401` |
| POST con `Origin: https://evil.example` | `403` |
| Preflight CORS malicioso | `403` |
| Rate limit de pedidos | `429` en la solicitud 13 |
| Rate limit de pagos | `429` en la solicitud 9 |
| Rate limit de login | `429` en el intento 6 |
| Webhook Flow con token falso | `200`, sin cambio de estado |
| Replay de pago confirmado | `303`, sin doble efecto |
| Subida de archivo falso | `415` |
| Subida por cliente | `401` |
| Path traversal en `/uploads` | `404` |
| `/.env` y variantes | `404`, sin secretos |
| Open redirect en `next` | Redirige a `/`, no a dominio externo |
| XSS reflejado en búsqueda admin | HTML escapado |
| Cookie de sesión | `HttpOnly`, `SameSite=Lax`; no está en localStorage |
| Secretos en `.next/static` | No aparecen |
| `npm audit` producción | 0 vulnerabilidades |
| `npm audit` completo | 0 vulnerabilidades |

## Recomendaciones priorizadas

### P0 — antes de exponer la app

- No exponer `localhost:3002` con un túnel mientras `MFA_ENFORCED=false`.
- Desactivar cuentas demo o cambiar sus contraseñas antes de un túnel.
- Usar una instancia de staging separada para webhooks de Flow.
- Revisar `scripts/check-env.mjs` y corregir todos sus errores antes de `next start`.

### P1 — hardening

- Rate limit distribuido.
- `TRUST_PROXY=1` con Cloudflare/Nginx y firewall de origen.
- Límite y validación de tokens en callbacks Flow.
- Exigir `Origin` en mutaciones con cookie.
- CSP con nonce/hash.

### P2 — operación

- Sacar `scripts/demo-cookie.mjs` de la imagen de producción.
- Proteger backups y `.env`; rotar `AUTH_SECRET` si se comparte una copia.
- Revisar logs sin tokens ni datos personales.
- Hacer pentest externo antes del lanzamiento.

## Anexo — KYC y Google Authenticator

### KYC de repartidores y locales

Verificado:

- `KYC_PROVIDER=didit`, con API key y workflow configurados.
- La API key de Didit respondió `404 Not found` ante una sesión inexistente, lo
  que confirma que la credencial es válida (no devolvió `401`).
- Un repartidor nuevo y un local nuevo pueden entrar a `/kyc` y ven el botón
  **Iniciar verificación** y el aviso de redirección a Didit.
- El registro de repartidor crea `verificationStatus=PENDING`; el de local crea
  `merchant.status=PENDING` y `store.status=PENDING`. Ninguno puede operar hasta
  que un administrador los verifique.

Pendientes críticos:

- `DIDIT_WEBHOOK_SECRET` está vacío. El endpoint `/api/kyc/webhook` devuelve
  `401 Firma inválida` para cualquier evento de Didit. El KYC puede actualizarse
  por polling en `/kyc/return`, pero si el usuario no vuelve, el caso queda
  pendiente.
- `KYC_REQUIRED=false`. En este entorno `isKycApproved()` devuelve `true`, por lo
  que un administrador puede marcar `VERIFIED` a un local o repartidor sin un KYC
  aprobado. En producción debe estar en `true`.
- La API key de Didit comienza con `sk_test_`, es decir, es de pruebas. Para
  verificar identidades reales se necesita la clave live.
- `NEXT_PUBLIC_APP_URL` apunta a `localhost`. Para KYC real, el callback debe ser
  una URL pública HTTPS (`DIDIT_CALLBACK_URL` o `NEXT_PUBLIC_APP_URL`).

### Google Authenticator / TOTP

Verificado de extremo a extremo con un usuario administrador temporal:

1. Login sin MFA.
2. `/settings/security` → **Configurar MFA**.
3. Se generó el secreto TOTP y el QR compatible con Google Authenticator.
4. Se ingresó un código de 6 dígitos generado con `otplib`; MFA quedó activo.
5. Se mostraron los códigos de recuperación.
6. Se cerró sesión y se volvió a entrar: la app redirigió a `/mfa`.
7. Se ingresó un segundo código TOTP y se llegó nuevamente a `/admin`.

Resultado: **el flujo TOTP funciona**. Limitaciones:

- `MFA_ENFORCED=false`: el MFA es opcional en este entorno.
- El MFA está disponible para ADMIN, SUPPORT y MERCHANT. No está disponible para
  CUSTOMER ni COURIER.
- Si se activa `MFA_ENFORCED=true`, los administradores y locales deben configurar
  la app autenticadora antes de operar.

## Anexo — App móvil (Expo)

Revisión de código y typecheck, no pentest en dispositivo físico:

- KYC y MFA **no están implementados nativamente** en la app. La cuenta del
  repartidor abre la web: `WEB_URL/kyc` y `WEB_URL/settings/security`.
- El token de la app nativa se guarda en **SecureStore** (Keychain/Keystore).
  En el preview web se usa `localStorage`; para una PWA real conviene cookie
  `HttpOnly` o un backend-for-frontend.
- `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_WEB_URL` exigen HTTPS en builds de
  producción.
- `app.json` tiene `NSAllowsArbitraryLoads=false`, `usesCleartextTraffic=false` y
  `allowBackup=false`.
- El login móvil rechaza ADMIN/MERCHANT y cuentas con MFA activo; esas cuentas
  deben usar la web.
- `npm run typecheck` pasa. El `expo lint` existente no analiza `src` por
  configuración del proyecto; no es un fallo de esta revisión.
- Si `EXPO_PUBLIC_WEB_URL` queda en `localhost`, los enlaces de KYC/seguridad
  desde el teléfono no funcionarán. Debe ser el dominio público.
- Si se publica el preview web como PWA, el token en `localStorage` es el punto
  más débil; no se encontró XSS en la auditoría web, pero se recomienda migrar a
  cookie HttpOnly.

## Nota

No se robaron credenciales reales ni se exfiltraron tokens. Las pruebas usaron
cuentas demo y usuarios temporales eliminados al finalizar. No se modificó ningún
pedido real ni se ejecutó una saturación destructiva. No se creó una sesión real de
Didit para no consumir una verificación; se validaron credenciales y flujo de
entrada.
