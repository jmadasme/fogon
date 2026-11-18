# Fogón — plataforma de pedidos y reparto local

> Documento maestro del proyecto. Nombre de trabajo **provisional**: *Fogón*.
> Fecha de inicio: **07/11/2026**. Mercado base: **Chile / Santiago**.
> Referencia competitiva principal: **Rappi** (el brief la menciona como “Rapid”).
>
> **Guía rápida de estado y operación:** `docs/23-estado-y-operacion.md`.

---

## 1. Qué estamos construyendo

Una plataforma de tres lados para pedir comida local y entregarla:

1. **Cocinerías y restaurantes** se inscriben, cargan su menú, precios, horarios y disponibilidad; reciben pedidos y deciden si entregan con **reparto propio** o con un **repartidor freelance** de la red.
2. **Clientes** descubren locales, arman su pedido, pagan y siguen la entrega en tiempo real.
3. **Repartidores** se conectan por turnos, reciben ofertas, aceptan, entregan y cobran; pueden trabajar para la plataforma o para un local.
4. **Administración** verifica locales y repartidores, resuelve disputas, controla tarifas, zonas y finanzas.

La estética y la densidad de información se inspiran en **Binance**: fondo oscuro, tipografía nítida, acento amarillo, dashboards operativos, cero decoración innecesaria. No se copian marca, logo ni assets de Binance.

---

## 2. Estado del proyecto

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Carpeta, brief, investigación de Rappi, análisis competitivo | **Completado** |
| 1 | Modelo de negocio, arquitectura, diseño y roadmap | **Completado** |
| 2 | MVP funcional web/PWA (cliente, local, repartidor, admin) | **Completado y verificado** |
| 3 | Pagos reales, verificación, app nativa, operación piloto | **App nativa lista en Expo Go**; pagos reales y tiendas posteriores |
| 4 | Lanzamiento comercial, growth, segunda ciudad | Posterior |

---

## 3. Mapa de documentos

| Archivo | Contenido |
|---|---|
| `docs/00-solicitud-original.md` | Transcripción literal del brief y elementos clave |
| `docs/00-resumen-ejecutivo.md` | Lectura de 3 minutos: oportunidad, tesis, propuesta y plan |
| `docs/01-brief-maestro.md` | Brief completo: actores, flujos, alcance, requisitos, métricas y supuestos |
| `docs/02-investigacion-rappi.md` | Cómo funciona Rappi: cliente, local, repartidor, cobros, logística y regulación |
| `docs/03-analisis-competitivo.md` | Rappi vs PedidosYa vs Uber Eats vs Justo vs Flama Hub vs canal propio |
| `docs/04-propuesta-de-valor-y-modelo.md` | Posicionamiento, planes, comisiones, unit economics y go-to-market |
| `docs/05-arquitectura-tecnica.md` | Stack, módulos, modelo de datos, máquina de estados, dispatch, pagos y seguridad |
| `docs/06-diseno-binance.md` | Sistema de diseño, tokens, pantallas y UX por rol |
| `docs/07-roadmap-3-dias.md` | Plan realista de 3 días, demo, definition of done y qué queda fuera |
| `docs/08-cumplimiento-chile.md` | Ley 21.431, Ley 21.719, SII, consumo, inocuidad y pagos |
| `docs/09-manifiesto.md` | Principios de marca y producto |
| `docs/10-decisiones-de-arranque.md` | Defaults recomendados y decisiones que faltan |
| `docs/11-mvp-tecnico.md` | Runbook del MVP: instalación, demo, pagos, límites y checklist |
| `docs/12-qa-e2e.md` | QA end-to-end: cocina nueva, pedido, reparto, entrega, cancelación y hallazgos |
| `docs/13-guia-de-pruebas.md` | Guía completa de prueba por rol, pagos, seguridad y criterios de salida |
| `docs/14-app-movil.md` | App Expo/React Native para clientes y repartidores: runbook y decisiones |
| `docs/15-qa-dispositivos.md` | QA nocturna en dispositivos reales: dos rondas y matriz de seguridad |
| `docs/16-resumen-nocturno.md` | Resumen de cierre: estado, pruebas, datos y pendientes de producción |
| `docs/17-auditoria-seguridad.md` | Auditoría profunda, threat model 2026, hallazgos, correcciones y checklist de producción |
| `docs/18-produccion-cloudflare-postgres.md` | Despliegue con Cloudflare, PostgreSQL TLS, MFA, email/teléfono, KYC y retención de PII |
| `docs/19-pentest-externo.md` | Alcance y reglas para contratar un pentest externo antes del lanzamiento |
| `docs/20-kyc-didit.md` | KYC real con Didit: free tier, workflow, API, webhook y pasos |
| `docs/21-despliegue-vps-cloudflare.md` | Runbook de VPS, Docker, Caddy, Cloudflare, backups y lanzamiento |
| `docs/22-auditoria-seguridad-2.md` | Segunda auditoría: hallazgos, correcciones y riesgos residuales antes de producción |
| `docs/23-estado-y-operacion.md` | Guía única: estado, inicio/parada, KYC, seguridad, pagos y pendientes |
| `SECURITY.md` | Política de divulgación responsable y prácticas de seguridad |
| `research/datos-clave.md` | Cifras verificadas y citas rápidas |
| `research/fuentes.md` | Fuentes, fechas y nivel de confianza |

---

## 4. Supuestos de trabajo

Estos supuestos permiten avanzar sin bloquear. Si alguno cambia, se ajusta el documento, no el código.

- **Mercado:** Chile, Santiago completo (34 comunas en selector y cobertura).
- **Moneda:** CLP. **Idioma:** español de Chile.
- **Referencia:** Rappi. No existe una app de delivery relevante llamada “Rapid” en Chile; se interpreta como Rappi. Si “Rapid” es otra empresa, corregir.
- **Nombre:** *Fogón* confirmado como nombre de trabajo.
- **Modelo:** marketplace con logística híbrida (reparto propio del local + red freelance).
- **MVP:** web responsive + PWA instalable, preparado para clientes reales. Apps nativas iOS/Android en fase 2 con Expo/React Native.
- **Pagos:** Mercado Pago + Transbank Webpay Plus + efectivo. Por defecto en modo demo; sandbox/producción según credenciales.
- **Mapas:** Leaflet + Esri World Dark Gray. Google Maps/Mapbox si la operación lo exige.
- **Alcance:** MVP funcional end-to-end; el lanzamiento comercial requiere operación, cumplimiento y credenciales productivas.

---

## 5. Decisiones tomadas

| Decisión | Resultado |
|---|---|
| Marca | **Fogón** |
| Mercado | **Santiago completo** (34 comunas) |
| Alcance | **MVP para clientes reales**, no solo demo |
| Pagos | **Mercado Pago + Transbank + efectivo** |
| Canal | **Web/PWA primero**; apps nativas después |
| Comisión | Cocina 12%, Híbrido 17%, Full 22% + IVA |
| Logística | Híbrida: reparto propio + red freelance |
| Repartidores | Independientes, con verificación y seguro pendiente |
| Estética | Binance-like: oscuro, denso, amarillo, serio |

---

## 6. Principio rector

> **Competimos por confianza y margen del local, no por imitar a Rappi.**
>
> Comisión justa y transparente, reparto híbrido, datos del cliente para el local y una operación que se siente seria desde el primer clic.

---

## 7. Estado del MVP

**Implementado y funcionando:**

- Home, búsqueda, filtro por comuna y cocina.
- Menú, modificadores, carrito y checkout.
- Pago demo, Mercado Pago, Transbank Webpay y efectivo.
- Tracking con mapa, timeline, PIN y calificación.
- Panel del local con tablero de pedidos en vivo y menú CRUD.
- **Portada del local editable desde el panel:** el dueño sube su propia imagen (JPG/PNG/WEBP/GIF, máximo 5 MB) y se actualiza en la app y la web.
- Panel del repartidor con conexión, ofertas, entregas y ganancias.
- Admin con métricas, pedidos, verificación de locales/repartidores y reembolsos.
- 34 locales seed, 170 platos, 10 repartidores y 16 pedidos de ejemplo.
- Build y lint pasan; smoke tests de los 4 roles y registros pasan.
- **QA nocturna doble con dispositivos reales:** dos rondas end-to-end completas (cliente, local, repartidor y admin) usando el Huawei Y9 como app nativa y la app móvil web como segunda superficie; pedidos `FOG-4LHZBK` y `FOG-2HPUSQ`. Además, una tercera ronda con **dos teléfonos nativos** (Samsung A10 repartidor + Huawei Y9 cliente), pedido `FOG-X4982B`. Ver `docs/15-qa-dispositivos.md`.
- **Seguridad endurecida:** revocación de sesión por `tokenVersion`, rate limiting, idempotencia de pedidos, PIN de entrega, límite de distancia para aceptar, headers de seguridad y filtrado de privacidad. Matriz de pruebas en `docs/15-qa-dispositivos.md`.
- **Auditoría de seguridad profunda:** se corrigieron carreras de aceptación, fuerza bruta de PIN, fuga de direcciones, CORS abierto, validación de pagos, reembolsos y configuración insegura. Informe completo y checklist de producción en `docs/17-auditoria-seguridad.md`.
- **Producción endurecida:** PostgreSQL con TLS/migraciones, MFA TOTP para admin/soporte/local, verificación de email/teléfono, KYC con proveedor/liveness y revisión admin, retención/anonymización de PII y guía Cloudflare. Ver `docs/18-produccion-cloudflare-postgres.md`.
- **Segunda auditoría nocturna:** se cerraron IDOR en el retorno KYC, exceso de permisos de soporte, bypass de MFA móvil, replay de webhooks KYC, spoofing de IP para rate limit, credenciales de pago de prueba en producción, fuga de referencias de pago y carreras de reseñas. Ver `docs/22-auditoria-seguridad-2.md`.
- **Dependencias:** `npm audit` sin vulnerabilidades conocidas (overrides `deepmerge-ts@^8`, `minimatch@^11`).
- **App móvil endurecida:** HTTPS obligatorio en producción, token en SecureStore `THIS_DEVICE_ONLY`, `allowBackup=false`, `usesCleartextTraffic=false`, ATS estricto, timeout de API y `eas.json`. `npm audit` móvil en 0. Ver `docs/17-auditoria-seguridad.md` sección 10.
- **Datos de prueba limpios:** quedan el seed base, los pedidos QA (`FOG-4LHZBK`, `FOG-2HPUSQ`, `FOG-X4982B`) y las cuentas demo; el resto se eliminó con `scripts/cleanup-test-data.mjs`.

**Pendiente para producción:** VPS y dominio reales, credenciales de pago reales, KYC live, boleta electrónica, seguros, notificaciones, monitoreo externo y revisión legal. El paquete de despliegue (Docker, Caddy, Cloudflare, backups) está en `deploy/` y `docs/21-despliegue-vps-cloudflare.md`; aún no se ejecutó contra un VPS.

**Despliegue:** build standalone, migraciones automáticas, PostgreSQL interno, perfiles `tunnel` (recomendado) y `edge` con Caddy, preflight de producción, backups cifrados y runbook de Cloudflare.

---

## 8. Cómo ejecutar

### Inicio y parada de toda la plataforma

```bash
./scripts/platform-start.sh     # PostgreSQL + Next + Expo móvil/web
./scripts/platform-stop.sh      # detiene todo
./scripts/platform-status.sh    # muestra puertos, health y URLs
./scripts/platform-restart.sh   # stop + start
```

También están como scripts npm:

```bash
npm run platform:start
npm run platform:stop
npm run platform:status
npm run platform:restart
```

Para iniciar solo web/API y PostgreSQL:

```bash
START_MOBILE=0 START_WEB=0 ./scripts/platform-start.sh
```

Los logs quedan en `.run/logs/` y los PID en `.run/`. La IP LAN se detecta
automáticamente para las URLs de Expo.

### Arranque manual

```bash
cd /home/jma/Documents/Proyect/fogon
npm install
cp .env.example .env
# Genera secretos reales antes de iniciar:
# openssl rand -base64 48   → AUTH_SECRET
# openssl rand -base64 48   → CRON_SECRET
# PostgreSQL con TLS (ver docs/18)
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abrir <http://localhost:3000>.

### Cuentas demo

Contraseña: **`fogon123`**

| Rol | Email | URL |
|---|---|---|
| Cliente | `cliente@fogon.cl` | `/` |
| Local | `local@fogon.cl` | `/merchant` |
| Repartidor | `repartidor@fogon.cl` | `/courier` |
| Admin | `admin@fogon.cl` | `/admin` |

> Desactivar `NEXT_PUBLIC_DEMO_MODE` y cambiar estas cuentas antes de abrir al público.

### Comandos útiles

```bash
npm run build        # build de producción
npm run lint         # lint
npm run db:reset     # borra y recarga datos demo
node scripts/smoke.mjs           # smoke test de los 4 roles
node scripts/smoke-register.mjs  # smoke test de registros
```

---

## 9. App móvil

La app Expo/React Native para **clientes y repartidores** está en `mobile/`.

```bash
cd mobile
npm install
npx expo start
```

- Escanear el QR con Expo Go.
- El servidor debe correr con `npm run dev -- --hostname 0.0.0.0`.
- La app detecta la IP del servidor desde Metro.
- Runbook completo: `docs/14-app-movil.md`.

---

## 10. Próximo paso

1. Revisar el MVP web en `http://localhost:3000` con las cuentas demo.
2. Probar la app móvil en Expo Go con un teléfono real.
3. Validar la estética y los flujos con 3–5 cocinerías reales.
4. Migrar a PostgreSQL y configurar pagos sandbox.
5. Cerrar el piloto: 10 locales, 20 repartidores, 1 comuna.
6. Build de tiendas con EAS, expansión y marketing.
