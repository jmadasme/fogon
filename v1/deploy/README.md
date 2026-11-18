# Despliegue de Fogón

Runbook completo: [`docs/21-despliegue-vps-cloudflare.md`](../docs/21-despliegue-vps-cloudflare.md).

## Arranque rápido

```bash
cd deploy
cp .env.production.example .env
chmod 600 .env
# completa secretos, dominio, Didit, Resend y credenciales de pago

docker compose build
# Tunnel (recomendado, sin abrir puertos):
docker compose --profile tunnel up -d
# o Caddy con IP pública:
# docker compose --profile edge up -d
docker compose ps
curl -fsS https://TU_DOMINIO/api/health
```

## Requisitos

- Docker Engine + Compose plugin.
- DNS proxied (naranja) y SSL/TLS **Full (strict)**.
- **Tunnel:** `CLOUDFLARE_TUNNEL_TOKEN`; no requiere abrir puertos ni certificado.
- **Edge:** certificado de origen de Cloudflare en `deploy/certs/origin.pem` y
  `origin.key`; firewall permitiendo `80/443` solo desde rangos de Cloudflare.

## Comandos útiles

```bash
docker compose logs -f app
docker compose logs -f cloudflared   # perfil tunnel
docker compose logs -f caddy         # perfil edge
docker compose exec app sh
docker compose run --rm migrate
BACKUP_PASSPHRASE='...' ./backup-db.sh
CONFIRM_RESTORE=YES ./restore-db.sh ../backups/fogon-....dump
```

No ejecutes `prisma db push` ni el seed demo en producción. Las migraciones se
aplican con `prisma migrate deploy` en el servicio `migrate`.
