#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[startup] Node version: $(node -v)"
echo "[startup] Working directory: $(pwd)"
echo "[startup] Launching Khonofy backend via node server.js"

exec node server.js
