#!/usr/bin/env bash
# Añade los rangos actuales de Cloudflare a UFW (solo modo "edge" con Caddy).
# No elimina reglas antiguas: si Cloudflare retira un rango, puedes quitarlo
# manualmente con:
#   ufw status numbered
#   ufw delete <número>
#
# Ejecutar como root en el VPS.

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ejecuta este script como root." >&2
  exit 1
fi

CF_V4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
CF_V6="$(curl -fsS https://www.cloudflare.com/ips-v6)"

for range in ${CF_V4} ${CF_V6}; do
  ufw allow proto tcp from "${range}" to any port 80,443 comment 'cloudflare'
done

ufw status verbose
