#!/usr/bin/env bash
set -euo pipefail

# No source .env: puede contener valores con espacios, '<', '>' o comillas.
if [ -f .env ]; then
  DATABASE_URL="${DATABASE_URL:-$(sed -n 's/^DATABASE_URL=//p' .env | tail -1)}"
  DATABASE_URL="${DATABASE_URL%\"}"
  DATABASE_URL="${DATABASE_URL#\"}"
  export DATABASE_URL
fi

: "${DATABASE_URL:?DATABASE_URL no está definido}"
umask 077

PG_BIN="${PG_BIN:-$HOME/.local/share/fogon-pg-bin/usr/lib/postgresql/18/bin}"
if [ -x "$PG_BIN/pg_dump" ]; then
  export LD_LIBRARY_PATH="$HOME/.local/share/fogon-pg-bin/usr/lib/x86_64-linux-gnu"
  PG_DUMP="$PG_BIN/pg_dump"
else
  PG_DUMP="$(command -v pg_dump)"
fi

PG_URL="${DATABASE_URL/&schema=public/}"
PG_URL="${PG_URL/?schema=public&/?}"
PG_URL="${PG_URL/?schema=public/}"

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="backups/fogon-${STAMP}.dump"

"$PG_DUMP" "$PG_URL" --format=custom --no-owner --no-acl --file="$FILE"
chmod 600 "$FILE"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -pass env:BACKUP_PASSPHRASE -in "$FILE" -out "${FILE}.enc"
  rm -f "$FILE"
  FILE="${FILE}.enc"
else
  echo "AVISO: BACKUP_PASSPHRASE no está definido; el backup queda sin cifrar." >&2
fi

sha256sum "$FILE" > "${FILE}.sha256"
chmod 600 "${FILE}.sha256"
echo "Backup creado: $FILE"
echo "Checksum: ${FILE}.sha256"
