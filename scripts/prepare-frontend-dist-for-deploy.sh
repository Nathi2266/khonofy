#!/usr/bin/env bash
# Replace dist with the CI build and refresh version metadata from deploy branch.
set -euo pipefail

ARTIFACT_DIR="${1:-frontend-dist}"

echo "Stripping stale dist output..."
rm -rf dist
mkdir -p dist

echo "Copying CI frontend build from ${ARTIFACT_DIR}..."
cp -a "${ARTIFACT_DIR}/." dist/

if [ -f public/app-version.json ]; then
  echo "Refreshing app-version.json in dist..."
  cp public/app-version.json dist/app-version.json
fi

if [ -f public/staticwebapp.config.json ] && [ ! -f dist/staticwebapp.config.json ]; then
  echo "Copying staticwebapp.config.json into dist..."
  cp public/staticwebapp.config.json dist/staticwebapp.config.json
fi

echo "Prepared dist for deploy ($(find dist -type f | wc -l) files, $(du -sh dist | cut -f1))."
