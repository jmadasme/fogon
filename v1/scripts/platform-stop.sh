#!/usr/bin/env bash
# Detiene Next.js, Expo y PostgreSQL local.
# Uso: ./scripts/platform-stop.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
NEXT_PORT="${NEXT_PORT:-3000}"
EXPO_MOBILE_PORT="${EXPO_MOBILE_PORT:-8082}"
EXPO_WEB_PORT="${EXPO_WEB_PORT:-8081}"
EXTRA_EXPO_PORTS="${EXTRA_EXPO_PORTS:-8083}"

cd "$ROOT"

stop_pid() {
  local pid="$1"
  [[ -n "$pid" ]] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then return 0; fi

  # setsid crea un grupo de procesos; así también se detienen los hijos.
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 15); do
    if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
    sleep 1
  done
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
}

stop_pidfile() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  if [[ -n "$pid" ]]; then
    echo "[fogon] Deteniendo $(basename "$file" .pid) (PID $pid)..."
    stop_pid "$pid"
  fi
  rm -f "$file"
}

pid_on_port() {
  ss -ltnp "sport = :$1" 2>/dev/null |
    sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' |
    head -1
}

stop_port_if_project() {
  local port="$1"
  local pid cwd
  pid="$(pid_on_port "$port" || true)"
  [[ -n "$pid" ]] || return 0
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  if [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/mobile" ]]; then
    echo "[fogon] Deteniendo proceso del proyecto en puerto $port (PID $pid)..."
    stop_pid "$pid"
  else
    echo "[fogon] AVISO: puerto $port ocupado por otro proceso (PID $pid, cwd ${cwd:-?}); no lo toco." >&2
  fi
}

stop_pidfile "$RUN_DIR/expo-mobile.pid"
stop_pidfile "$RUN_DIR/expo-web.pid"
stop_pidfile "$RUN_DIR/next.pid"

stop_port_if_project "$EXPO_MOBILE_PORT"
stop_port_if_project "$EXPO_WEB_PORT"
for port in $EXTRA_EXPO_PORTS; do
  stop_port_if_project "$port"
done
stop_port_if_project "$NEXT_PORT"

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE '[:.]5433$'; then
  echo "[fogon] Deteniendo PostgreSQL local..."
  npm run db:local:stop || true
else
  echo "[fogon] PostgreSQL ya está detenido."
fi

rmdir "$RUN_DIR" 2>/dev/null || true
echo "[fogon] Plataforma detenida."
