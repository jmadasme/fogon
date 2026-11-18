#!/usr/bin/env bash
# Script específico del entorno local de desarrollo. En producción usa un PostgreSQL administrado.
set -euo pipefail

ROOT="$HOME/.local/share/fogon-pg-bin"
DATA="$HOME/.local/share/fogon-pg"
BIN="$ROOT/usr/lib/postgresql/18/bin"
export LD_LIBRARY_PATH="$ROOT/usr/lib/x86_64-linux-gnu"

if [ ! -x "$BIN/pg_ctl" ] || [ ! -d "$DATA" ]; then
  echo "PostgreSQL local no está instalado en $ROOT / $DATA" >&2
  exit 1
fi

case "${1:-start}" in
  start)
    install -d -m 700 /tmp/opencode/pg-sockets
    if "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      echo "PostgreSQL ya está corriendo en el puerto 5433."
    else
      "$BIN/pg_ctl" -D "$DATA" -l /tmp/opencode/postgres.log \
        -o "-p 5433 -k /tmp/opencode/pg-sockets" start
      echo "PostgreSQL iniciado en 127.0.0.1:5433 (TLS)."
    fi
    ;;
  stop)
    "$BIN/pg_ctl" -D "$DATA" stop
    ;;
  status)
    "$BIN/pg_ctl" -D "$DATA" status
    ;;
  *)
    echo "Uso: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
