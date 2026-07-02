#!/usr/bin/env bash
# Detect whether frontend and/or backend Azure deploy workflows should run.
# Used by bump-version-on-deploy after a merge into deploy.
set -euo pipefail

BASE_SHA="${1:?BASE_SHA is required}"
HEAD_SHA="${2:?HEAD_SHA is required}"
COMMIT_MESSAGE="${3:-}"
GITHUB_OUTPUT="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

if [ "${BASE_SHA}" = "0000000000000000000000000000000000000000" ]; then
  BASE_SHA="$(git rev-parse "${HEAD_SHA}^" 2>/dev/null || echo "${HEAD_SHA}")"
fi

file_requires_backend() {
  case "$1" in
    backend/package.json) return 1 ;;
    backend/*|.github/workflows/deploy_khonofy-backend-api.yml) return 0 ;;
  esac
  return 1
}

file_requires_frontend() {
  case "$1" in
    package.json|package-lock.json) return 1 ;;
    src/*|public/*|index.html|vite.config.js|tailwind.config.js|postcss.config.js|components.json|jsconfig.json|scripts/*|.github/workflows/azure-static-web-apps-polite-smoke-0f9de4610.yml)
      case "$1" in
        public/app-version.json) return 1 ;;
        *) return 0 ;;
      esac
      ;;
  esac
  return 1
}

BACKEND=false
FRONTEND=false

apply_files() {
  local file
  for file in "$@"; do
    [ -z "${file}" ] && continue
    if file_requires_backend "${file}"; then BACKEND=true; fi
    if file_requires_frontend "${file}"; then FRONTEND=true; fi
  done
}

collect_changed_files() {
  git diff --name-only "${BASE_SHA}" "${HEAD_SHA}" 2>/dev/null || true
  git log "${BASE_SHA}..${HEAD_SHA}" --name-only --pretty=format: 2>/dev/null || true
}

mapfile -t changed_files < <(collect_changed_files | sort -u | sed '/^$/d')
apply_files "${changed_files[@]}"

if [ "${BACKEND}" = false ] && [ "${FRONTEND}" = false ]; then
  PR_NUM="$(printf '%s' "${COMMIT_MESSAGE}" | sed -n 's/.*#\([0-9][0-9]*\).*/\1/p' | head -n 1)"
  if [ -n "${PR_NUM}" ]; then
    mapfile -t pr_files < <(gh pr view "${PR_NUM}" --repo "${REPO}" --json files --jq '.files[].path' 2>/dev/null || true)
    apply_files "${pr_files[@]}"
  fi
fi

check_undeployed() {
  local workflow_file="$1"
  local component="$2"
  local last_success

  last_success="$(gh api "/repos/${REPO}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=40" \
    --jq '[.workflow_runs[] | select(.conclusion=="success")][0].head_sha // empty')"

  if [ -z "${last_success}" ] || [ "${last_success}" = "${HEAD_SHA}" ]; then
    return 0
  fi

  mapfile -t undeployed < <(git diff --name-only "${last_success}" "${HEAD_SHA}" 2>/dev/null || true)
  local file
  for file in "${undeployed[@]}"; do
    if [ "${component}" = "backend" ] && [ "${BACKEND}" = false ] && file_requires_backend "${file}"; then
      BACKEND=true
      echo "Backend redeploy needed: ${file} changed since last successful deploy (${last_success})."
      return 0
    fi
    if [ "${component}" = "frontend" ] && [ "${FRONTEND}" = false ] && file_requires_frontend "${file}"; then
      FRONTEND=true
      echo "Frontend redeploy needed: ${file} changed since last successful deploy (${last_success})."
      return 0
    fi
  done
}

if [ "${BACKEND}" = false ]; then
  check_undeployed "deploy_khonofy-backend-api.yml" "backend"
fi
if [ "${FRONTEND}" = false ]; then
  check_undeployed "azure-static-web-apps-polite-smoke-0f9de4610.yml" "frontend"
fi

{
  echo "backend=${BACKEND}"
  echo "frontend=${FRONTEND}"
} >> "${GITHUB_OUTPUT}"

echo "Deploy triggers: backend=${BACKEND}, frontend=${FRONTEND} (${BASE_SHA}..${HEAD_SHA})"
