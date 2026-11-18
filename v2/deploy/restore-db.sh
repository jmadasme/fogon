#!/usr/bin/env bash
# Restaura un backup .dump o .dump.enc en la base de datos de Docker.
# DESTRUCTIVO: reemplaza el contenido actual de la base.
#
# Uso:
#   CONFIRM_RESTORE=YES ./restore-db.sh backups/fogon-....dump
#   BACKUP_PASSPHRASE=... CONFIRM_RESTORE=YES ./restore-db.sh backups/fogon-....dump.enc

set -euo pipefail

cd "$(dirname "$0")"
umask 077

if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Negado. Define CONFIRM_RESTORE=YES para confirmar que reemplazarás la base." >&2
  exit 1
fi

file="${1:-}"
[[ -n "${file}" && -f "${file}" ]] || {
  echo "Uso: CONFIRM_RESTORE=YES $0 <archivo.dump|archivo.dump.enc>" >&2
  exit 1
}

tmp=""

if [[ "${file}" == *.enc ]]; then
  [[ -n "${BACKUP_PASSPHRASE:-}" ]] || {
    echo "El backup está cifrado: define BACKUP_PASSPHRASE." >&2
    exit 1
  }
  tmp="$(mktemp)"
  trap 'rm -f "${tmp}"' EXIT
  openssl enc -d -aes-256-cbc -pbkdf2 \
    -pass env:BACKUP_PASSPHRASE \
    -in "${file}" -out "${tmp}"
  file="${tmp}"
fi

echo "[restore] restaurando ${file}"
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' <"${file}"

echo "[restore] completado. Verifica /api/health y un pedido de prueba."
