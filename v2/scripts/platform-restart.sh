#!/usr/bin/env bash
# Reinicia la plataforma local completa.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT/scripts/platform-stop.sh"
"$ROOT/scripts/platform-start.sh"
