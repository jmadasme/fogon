#!/usr/bin/env bash
# Inicia PostgreSQL local, Next.js y (opcionalmente) Expo.
# Uso:
#   ./scripts/platform-start.sh
#   START_MOBILE=0 ./scripts/platform-start.sh   # sin Expo
#   START_WEB=0 ./scripts/platform-start.sh      # sin Expo web

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
LOG_DIR="$RUN_DIR/logs"
NEXT_PORT="${NEXT_PORT:-3000}"
EXPO_MOBILE_PORT="${EXPO_MOBILE_PORT:-8082}"
EXPO_WEB_PORT="${EXPO_WEB_PORT:-8081}"
START_MOBILE="${START_MOBILE:-1}"
START_WEB="${START_WEB:-1}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

port_in_use() {
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1$"
}

lan_ip() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

wait_for_http() {
  local url="$1"
  local tries="${2:-30}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS -m 2 "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

wait_for_port() {
  local port="$1"
  local tries="${2:-20}"
  for _ in $(seq 1 "$tries"); do
    if port_in_use "$port"; then return 0; fi
    sleep 1
  done
  return 1
}

cd "$ROOT"

echo "[fogon] PostgreSQL local..."
npm run db:local:start
if ! wait_for_port 5433 20; then
  echo "[fogon] ERROR: PostgreSQL no respondió en 5433." >&2
  exit 1
fi

if port_in_use "$NEXT_PORT"; then
  echo "[fogon] Next ya está escuchando en $NEXT_PORT."
else
  echo "[fogon] Iniciando Next en 127.0.0.1:$NEXT_PORT..."
  setsid ./node_modules/.bin/next dev --hostname 127.0.0.1 --port "$NEXT_PORT" \
    >"$LOG_DIR/next.log" 2>&1 &
  echo "$!" >"$RUN_DIR/next.pid"
fi

if ! wait_for_http "http://127.0.0.1:$NEXT_PORT/api/health" 40; then
  echo "[fogon] ERROR: Next no respondió. Revisa $LOG_DIR/next.log" >&2
  tail -30 "$LOG_DIR/next.log" >&2 || true
  exit 1
fi

if [[ "$START_MOBILE" == "1" ]]; then
  if port_in_use "$EXPO_MOBILE_PORT"; then
    echo "[fogon] Expo móvil ya está escuchando en $EXPO_MOBILE_PORT."
  else
    echo "[fogon] Iniciando Expo móvil (Expo Go) en $EXPO_MOBILE_PORT..."
    (
      cd "$ROOT/mobile"
      setsid ./node_modules/.bin/expo start --go --localhost --port "$EXPO_MOBILE_PORT" \
        >"$LOG_DIR/expo-mobile.log" 2>&1 &
      echo "$!" >"$RUN_DIR/expo-mobile.pid"
    )
    wait_for_port "$EXPO_MOBILE_PORT" 30 || echo "[fogon] AVISO: Expo móvil aún no responde; revisa el log." >&2
  fi
fi

if [[ "$START_WEB" == "1" ]]; then
  if port_in_use "$EXPO_WEB_PORT"; then
    echo "[fogon] Expo web ya está escuchando en $EXPO_WEB_PORT."
  else
    echo "[fogon] Iniciando Expo web en $EXPO_WEB_PORT..."
    (
      cd "$ROOT/mobile"
      setsid ./node_modules/.bin/expo start --web --port "$EXPO_WEB_PORT" \
        >"$LOG_DIR/expo-web.log" 2>&1 &
      echo "$!" >"$RUN_DIR/expo-web.pid"
    )
    wait_for_port "$EXPO_WEB_PORT" 30 || echo "[fogon] AVISO: Expo web aún no responde; revisa el log." >&2
  fi
fi

IP="$(lan_ip)"
echo
echo "[fogon] Plataforma iniciada."
echo "  Web/API:   http://127.0.0.1:$NEXT_PORT"
echo "  Expo Go:   exp://127.0.0.1:$EXPO_MOBILE_PORT"
echo "  Expo web:  http://127.0.0.1:$EXPO_WEB_PORT"
echo "  Logs:      $LOG_DIR"
echo "  Detener:   ./scripts/platform-stop.sh"
