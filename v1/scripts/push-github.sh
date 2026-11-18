#!/usr/bin/env bash
set -uo pipefail

GH="/tmp/opencode/ghcli/gh_2.103.3_linux_amd64/bin/gh"
STATUS="/tmp/opencode/github-push-status.json"
REPO="wanderc137/fogon"
LOG="/tmp/opencode/github-push.log"

write_status() {
  local ok="$1"
  local message="$2"
  local url="${3:-}"
  printf '{"ok":%s,"repo":"%s","url":"%s","message":"%s","at":"%s"}\n' \
    "$ok" "$REPO" "$url" "$message" "$(date -Iseconds)" > "$STATUS"
}

echo "Esperando autenticación de GitHub…" >> "$LOG"

for _ in $(seq 1 240); do
  if "$GH" auth status >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

if ! "$GH" auth status >/dev/null 2>&1; then
  echo "Timeout esperando autenticación." >> "$LOG"
  write_status false "Timeout esperando autenticación"
  exit 1
fi

LOGIN="$("$GH" api user --jq .login 2>/dev/null || true)"
if [ "$LOGIN" != "wanderc137" ]; then
  echo "La cuenta autenticada es '$LOGIN', no 'wanderc137'." >> "$LOG"
  write_status false "Cuenta autenticada distinta de wanderc137: $LOGIN"
  exit 1
fi

"$GH" auth setup-git >> "$LOG" 2>&1 || true

cd /home/jma/Documents/Proyect/fogon || exit 1

if "$GH" repo view "$REPO" >/dev/null 2>&1; then
  git remote remove origin >/dev/null 2>&1 || true
  git remote add origin "https://github.com/$REPO.git"
  git push -u origin main >> "$LOG" 2>&1
else
  "$GH" repo create "$REPO" --private --source=. --remote=origin --push >> "$LOG" 2>&1
fi

if [ $? -eq 0 ]; then
  URL="$("$GH" repo view "$REPO" --json url --jq .url 2>/dev/null || echo "https://github.com/$REPO")"
  echo "Push completado: $URL" >> "$LOG"
  write_status true "Push completado" "$URL"
else
  echo "Falló el push." >> "$LOG"
  write_status false "Falló el push"
  exit 1
fi
