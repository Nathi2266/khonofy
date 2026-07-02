#!/usr/bin/env bash
# Fail fast if dist looks like a dev checkout instead of a Vite production build.
set -euo pipefail

DIST_DIR="${1:-dist}"
INDEX_FILE="${DIST_DIR}/index.html"

if [ ! -f "${INDEX_FILE}" ]; then
  echo "Missing ${INDEX_FILE}. Run npm run build first."
  exit 1
fi

if grep -q '/src/main.jsx' "${INDEX_FILE}"; then
  echo "Invalid production build: ${INDEX_FILE} still references /src/main.jsx."
  exit 1
fi

if ! grep -q '/assets/' "${INDEX_FILE}"; then
  echo "Invalid production build: ${INDEX_FILE} does not reference bundled /assets/ files."
  exit 1
fi

if [ ! -f "${DIST_DIR}/manifest.json" ]; then
  echo "Missing ${DIST_DIR}/manifest.json."
  exit 1
fi

if [ ! -d "${DIST_DIR}/assets" ]; then
  echo "Missing ${DIST_DIR}/assets directory."
  exit 1
fi

echo "Verified production dist at ${DIST_DIR}."
