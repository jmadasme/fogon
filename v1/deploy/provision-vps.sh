#!/usr/bin/env bash
# Provisión idempotente de un VPS Ubuntu 24.04/26.04 para Fogón.
# Ejecutar como root por SSH, después de copiar la clave pública del usuario.
#
#   ssh root@IP 'bash -s' < deploy/provision-vps.sh
#
# Variables opcionales:
#   DEPLOY_USER=deploy
#   SSH_PORT=22
#   APP_DIR=/opt/fogon
#   EDGE_MODE=public|tunnel

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ejecuta este script como root." >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "No se pudo detectar la distribución." >&2
  exit 1
fi

. /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "Este script está pensado para Ubuntu. Detectado: ${ID:-desconocido}." >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
if [[ -z "${SSH_PORT:-}" && -n "${SSH_CONNECTION:-}" ]]; then
  SSH_PORT="$(awk '{print $4}' <<<"${SSH_CONNECTION}")"
fi
SSH_PORT="${SSH_PORT:-22}"
APP_DIR="${APP_DIR:-/opt/fogon}"
# "public" abre 80/443 solo a Cloudflare; "tunnel" no abre puertos web.
EDGE_MODE="${EDGE_MODE:-public}"
case "${EDGE_MODE}" in
  public|tunnel) ;;
  *) echo "EDGE_MODE debe ser 'public' o 'tunnel'." >&2; exit 1 ;;
esac
CF_V4_URL="https://www.cloudflare.com/ips-v4"
CF_V6_URL="https://www.cloudflare.com/ips-v6"

log() { printf '\n[fogon] %s\n' "$*"; }
fail() { printf '\n[fogon] ERROR: %s\n' "$*" >&2; exit 1; }

log "Actualizando paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release ufw fail2ban unattended-upgrades \
  openssl rsync jq adduser

log "Configurando zona horaria"
timedatectl set-timezone America/Santiago || true

log "Creando usuario de despliegue ${DEPLOY_USER}"
if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG sudo "${DEPLOY_USER}"

install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
if [[ -s /root/.ssh/authorized_keys ]]; then
  install -m 600 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" \
    /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi
if [[ ! -s "/home/${DEPLOY_USER}/.ssh/authorized_keys" ]]; then
  fail "No hay claves SSH para ${DEPLOY_USER}. Copia tu clave pública antes de continuar para no perder acceso."
fi

log "Endureciendo SSH"
cat >/etc/ssh/sshd_config.d/99-fogon.conf <<'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 4
LoginGraceTime 20
EOF
sshd -t
systemctl reload ssh

log "Instalando Docker desde el repositorio oficial"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable
EOF
apt-get update
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker "${DEPLOY_USER}"

log "Configurando rotación de logs de Docker"
install -d -m 755 /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl enable --now docker
systemctl restart docker

log "Configurando fail2ban"
cat >/etc/fail2ban/jail.d/fogon.local <<'EOF'
[DEFAULT]
backend = systemd
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban

log "Activando actualizaciones automáticas de seguridad"
dpkg-reconfigure -f noninteractive unattended-upgrades || true

log "Configurando firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# El puerto SSH debe seguir accesible antes de habilitar UFW.
ufw limit "${SSH_PORT}/tcp" comment 'ssh'
ufw --force enable

if [[ "${EDGE_MODE}" == "public" ]]; then
  CF_V4="$(curl -fsS "${CF_V4_URL}")" || fail "No se pudieron obtener los rangos IPv4 de Cloudflare."
  CF_V6="$(curl -fsS "${CF_V6_URL}")" || fail "No se pudieron obtener los rangos IPv6 de Cloudflare."

  for range in ${CF_V4}; do
    ufw allow proto tcp from "${range}" to any port 80,443 comment 'cloudflare'
  done
  for range in ${CF_V6}; do
    ufw allow proto tcp from "${range}" to any port 80,443 comment 'cloudflare'
  done
elif [[ "${EDGE_MODE}" == "tunnel" ]]; then
  log "Modo tunnel: no se abren 80/443; cloudflared sale hacia Cloudflare."
else
  fail "EDGE_MODE debe ser 'public' o 'tunnel'."
fi

ufw status verbose

log "Preparando ${APP_DIR}"
install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${APP_DIR}"
install -d -m 750 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${APP_DIR}/backups"

log "Listo. Siguientes pasos:"
cat <<EOF

1. Copia el proyecto:
   rsync -az --delete --exclude node_modules --exclude .next --exclude .git \\
     --exclude backups --exclude deploy/.env --exclude deploy/certs \\
     ./ ${DEPLOY_USER}@<IP>:/opt/fogon/

2. En el VPS:
   cd /opt/fogon/deploy
   cp .env.production.example .env
   chmod 600 .env
   # completa secretos, dominio, Didit, Resend y pagos
   docker compose build
   # Cloudflare Tunnel (recomendado):
   docker compose --profile tunnel up -d
   # o Caddy con IP pública:
   # docker compose --profile edge up -d

3. Verifica:
   curl -fsS https://<dominio>/api/health
   docker compose ps

4. Cloudflare: Full (strict), WAF, rate limits, Access en /admin.
   Ver docs/21-despliegue-vps-cloudflare.md

Nota: el usuario ${DEPLOY_USER} queda en el grupo docker (equivalente a root
para efectos prácticos). Cierra y vuelve a entrar por SSH para aplicar el grupo.
No compartas esa cuenta.
EOF
