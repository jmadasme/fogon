#!/usr/bin/env bash
# Muestra el estado de los servicios locales de Fogón.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXT_PORT="${NEXT_PORT:-3000}"
EXPO_MOBILE_PORT="${EXPO_MOBILE_PORT:-8082}"
EXPO_WEB_PORT="${EXPO_WEB_PORT:-8081}"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

port_open() {
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1$"
}

status_line() {
  local name="$1"
  local port="$2"
  local url="$3"
  if port_open "$port"; then
    printf '  %-14s ACTIVO   %s\n' "$name" "$url"
  else
    printf '  %-14s DETENIDO %s\n' "$name" "$url"
  fi
}

echo "[fogon] Estado de la plataforma"
status_line "PostgreSQL" 5433 "127.0.0.1:5433"
status_line "Next/API" "$NEXT_PORT" "http://${LAN_IP:-127.0.0.1}:$NEXT_PORT"
status_line "Expo móvil" "$EXPO_MOBILE_PORT" "exp://${LAN_IP:-127.0.0.1}:$EXPO_MOBILE_PORT"
status_line "Expo web" "$EXPO_WEB_PORT" "http://${LAN_IP:-127.0.0.1}:$EXPO_WEB_PORT"

if port_open "$NEXT_PORT"; then
  printf '\n  Health Next: '
  curl -sS -m 3 "http://127.0.0.1:$NEXT_PORT/api/health" || echo "sin respuesta"
  echo
fi

if [[ -d "$ROOT/.run/logs" ]]; then
  echo "  Logs: $ROOT/.run/logs"
fi
echo
