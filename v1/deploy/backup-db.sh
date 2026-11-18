#!/usr/bin/env bash
# Backup comprimido de PostgreSQL desde el contenedor de Docker.
# Ejecutar desde deploy/ (o con --project-directory apuntando aquí).
#
# Variables:
#   BACKUP_DIR=./backups
#   RETENTION_DAYS=14
#   BACKUP_PASSPHRASE=...   (opcional; cifra con AES-256)

set -euo pipefail

cd "$(dirname "$0")"
umask 077

BACKUP_DIR="${BACKUP_DIR:-../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${BACKUP_DIR}/fogon-${stamp}.dump"

echo "[backup] creando ${file}"
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' >"${file}"

if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "[backup] cifrando"
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -pass env:BACKUP_PASSPHRASE \
    -in "${file}" -out "${file}.enc"
  rm -f "${file}"
  file="${file}.enc"
else
  echo "[backup] AVISO: BACKUP_PASSPHRASE no está definido; el backup queda sin cifrar." >&2
fi

sha256sum "${file}" >"${file}.sha256"
echo "[backup] listo: ${file}"

find "${BACKUP_DIR}" -type f \( -name 'fogon-*.dump' -o -name 'fogon-*.dump.enc' -o -name 'fogon-*.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -print -delete

echo "[backup] copia este archivo fuera del VPS (R2/S3/otro host) y prueba la restauración."
