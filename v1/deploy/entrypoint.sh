#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD es obligatorio si no defines DATABASE_URL}"

  if [ "$POSTGRES_PASSWORD" = "change-me" ] || [ "${#POSTGRES_PASSWORD}" -lt 16 ]; then
    echo "POSTGRES_PASSWORD debe ser aleatoria y tener al menos 16 caracteres." >&2
    echo "Genera una con: openssl rand -hex 24" >&2
    exit 1
  fi

  case "$POSTGRES_PASSWORD" in
    *[!A-Za-z0-9._~-]*)
      echo "POSTGRES_PASSWORD contiene caracteres que deben URL-encodearse." >&2
      echo "Usa una contraseña alfanumérica (por ejemplo: openssl rand -hex 24)." >&2
      exit 1
      ;;
  esac

  DATABASE_URL="postgresql://${POSTGRES_USER:-fogon}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-fogon}?schema=public"
  export DATABASE_URL
fi

node scripts/check-env.mjs
exec node server.js
