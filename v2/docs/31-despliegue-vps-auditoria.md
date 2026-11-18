# Runbook: despliegue a VPS + auditoría en producción

**Fecha:** 2026-11-11 · **Estrategia:** desplegar primero con **Cloudflare Tunnel** (sin puertos abiertos) y **pagos en sandbox**, auditar contra el dominio real, y solo entonces abrir al público con pagos de producción.

Referencias: `docs/21-despliegue-vps-cloudflare.md` (runbook base), `docs/30-auditoria-externa-resultados.md` (estado de seguridad del código).

---

## 0. Preparación local (antes de tocar el VPS)

1. **Commit de todo el trabajo de seguridad** (43+ archivos sin commitear):
   ```bash
   git add -A && git commit -m "security: correcciones P0-P2 de auditorías 28 y 30"
   ```
2. **Valida una última vez:** `npx tsc --noEmit && npm run lint && npm run build`.
3. **Genera los secretos de producción NUEVOS** (no reutilizar los del `.env` local — ya circularon por LAN):
   ```bash
   openssl rand -base64 48   # AUTH_SECRET
   openssl rand -base64 48   # CRON_SECRET
   openssl rand -base64 48   # MFA_ENCRYPTION_KEY
   openssl rand -base64 48   # DIDIT_WEBHOOK_SECRET (si usas Didit)
   openssl rand -hex 24      # POSTGRES_PASSWORD
   ```
   Guárdalos en un gestor de contraseñas; irán directo a `deploy/.env` en el VPS.

## 1. Provisión del VPS

```bash
scp -P 22 deploy/provision-vps.sh root@IP:/root/
ssh root@IP 'EDGE_MODE=tunnel bash /root/provision-vps.sh'
```

El script (versión endurecida): crea usuario `deploy`, **deshabilita root por completo** (`PermitRootLogin no` + claves de root revocadas), instala Docker/UFW/fail2ban, y no abre 80/443 (tunnel).

Verifica antes de cerrar: `ssh deploy@IP 'sudo ufw status && sudo fail2ban-client status sshd'`.

## 2. Copiar el proyecto

```bash
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude backups --exclude deploy/.env --exclude deploy/certs \
  --exclude .env --exclude .env.local --exclude .env.*.local \
  --exclude .run --exclude prisma/dev.db \
  ./ deploy@IP:/opt/fogon/

# Verificar que ningún .env de dev llegó:
ssh deploy@IP 'ls -la /opt/fogon/.env* 2>/dev/null || echo "limpio"'
```

## 3. Configurar `deploy/.env` (en el VPS)

```bash
ssh deploy@IP
cd /opt/fogon/deploy
cp .env.production.example .env && chmod 600 .env
```

Mínimo para el arranque (check-env bloquea si falta):
- `DOMAIN`, `NEXT_PUBLIC_APP_URL`, `CORS_ORIGINS` → `https://tudominio.cl`
- `CLOUDFLARE_TUNNEL_TOKEN` (Cloudflare → Networking → Tunnels)
- Secretos nuevos del paso 0: `AUTH_SECRET`, `CRON_SECRET`, `MFA_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`
- `MFA_ENFORCED=true`, `KYC_REQUIRED=true` (con `KYC_PROVIDER=didit` + credenciales, o `mock` solo durante la auditoría), `EMAIL_VERIFICATION_REQUIRED=true`, `COURIER_SECURITY_ENFORCED=true`
- Pagos: **`PAYMENTS_MODE=sandbox`** + credenciales sandbox de Flow/MP + **`MERCADOPAGO_WEBHOOK_SECRET` configurado** (sin él, el webhook MP rechaza todo)
- `NEXT_PUBLIC_DEMO_MODE=false`

En Cloudflare: DNS proxied (naranja) + SSL/TLS **Full (strict)** + (opcional durante la auditoría) **Cloudflare Access** delante de `/admin` para que solo tú entras.

## 4. Arrancar

```bash
cd /opt/fogon/deploy
docker compose build
docker compose --profile tunnel up -d
docker compose ps
curl -fsS https://tudominio.cl/api/health
```

Las migraciones corren solas (servicio `migrate`, `prisma migrate deploy` — sin seed demo).

## 5. Crear el primer ADMIN

```bash
docker compose run --rm --entrypoint sh migrate \
  -c "./node_modules/.bin/prisma generate && node scripts/create-admin.mjs admin@tudominio.cl"
```

Imprime la contraseña una sola vez. Al primer login, `MFA_ENFORCED=true` exige configurar TOTP — hazlo en ese momento.

## 6. Programar el cron operativo

En el VPS (`crontab -e` como `deploy`), cada minuto:

```cron
* * * * * cd /opt/fogon/deploy && docker compose exec -T app node -e 'fetch("http://127.0.0.1:3000/api/cron/orders",{headers:{Authorization:"Bearer "+process.env.CRON_SECRET}}).then(r=>r.text()).then(t=>console.log(new Date().toISOString(),t.slice(0,200))).catch(e=>console.error(e.message))' >> /opt/fogon/backups/cron.log 2>&1
```

Sin esto: pedidos que no expiran, pedidos sin respuesta que no se cancelan, y `REFUND_PENDING` huérfanos.

## 7. Backups automáticos

```cron
15 4 * * * cd /opt/fogon/deploy && BACKUP_PASSPHRASE='tu-frase' ./backup-db.sh >> /opt/fogon/backups/backup.log 2>&1
```

Probar una restauración en frío ANTES de abrir: `CONFIRM_RESTORE=YES ./restore-db.sh ../backups/fogon-....dump`.

---

## 8. Auditoría en el VPS (el plan)

Contra `https://tudominio.cl`, con la app en sandbox:

### 8.1 Suite automática

```bash
# Desde tu máquina local:
REGRESSION_BASE=https://tudominio.cl npm run security:regression
node scripts/smoke.mjs   # ajustar BASE al dominio
```

### 8.2 Verificaciones manuales clave (con TRUST_PROXY=1 activo)

| # | Prueba | Esperado |
|---|---|---|
| 1 | `curl -I https://tudominio.cl` | Headers de seguridad presentes (CSP, HSTS, X-Frame-Options) |
| 2 | Body chunked 50 MB vía dominio | 413 rápido (Cloudflare puede cortar antes: verificar igual) |
| 3 | Rate limit con IP real: 130 GETs a `/api/orders/<id>` con token | 429 tras 120 — ahora los buckets son por IP real |
| 4 | Webhook MP con firma inválida | 401 |
| 5 | `/api/cron/orders` sin Authorization desde fuera | 401 |
| 6 | CORS preflight con `Origin: https://evil.com` | 403 |
| 7 | Pago sandbox end-to-end: crear pedido → pagar → webhook confirma → reembolsar desde admin → cron lo procesa | Estados correctos en `/admin/orders` |
| 8 | Login admin sin MFA la primera vez | Redirige a setup TOTP (no entra directo) |
| 9 | `docker compose logs app \| grep -i alerta` | Sin `PAYMENT_REFUNDED_BY_PROVIDER` inesperados |
| 10 | Escaneo externo del VPS: `nmap IP -p-` | Solo SSH abierto (tunnel no publica nada) |

### 8.3 Al pasar todo

1. `PAYMENTS_MODE=production` + credenciales reales de Flow (`FLOW_ENVIRONMENT=production`) / Transbank production.
2. Pago real pequeño end-to-end + reembolso real.
3. Quitar Cloudflare Access de `/admin` (si lo activaste) o dejarlo como defensa extra.
4. Anunciar el dominio.

---

## Regresión conocida a vigilar post-apertura

- Rate limit sigue en memoria (VPS único): correcto para una réplica; migrar a Redis/Upstash al escalar.
- `MERCADOPAGO_WEBHOOK_SECRET` en sandbox debe ser el que MP genera para el entorno de pruebas.
- Rotar `CRON_SECRET` si el log del cron quedó legible por otros usuarios (`chmod 600`).
