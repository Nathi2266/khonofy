#!/usr/bin/env bash
set -euo pipefail

# SELF_WORKFLOW: backend | frontend (the workflow that invoked this script)
SELF_WORKFLOW="${SELF_WORKFLOW:-}"
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse HEAD)}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-40}"
WAIT_SECONDS="${WAIT_SECONDS:-30}"

echo "Open deploy PR check (self=${SELF_WORKFLOW}, sha=${DEPLOY_SHA})"

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
    src/*|index.html|vite.config.js|tailwind.config.js|postcss.config.js|components.json|jsconfig.json|scripts/*|.github/workflows/azure-static-web-apps-polite-smoke-0f9de4610.yml) return 0 ;;
    public/*)
      [ "$1" != "public/app-version.json" ] && return 0
      ;;
  esac
  return 1
}

workflow_latest_status() {
  local workflow_file="$1"
  gh api "/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=30" \
    --jq ".workflow_runs[] | select(.head_sha==\"${DEPLOY_SHA}\" and .event != \"pull_request\") | \"\(.status):\(.conclusion)\"" \
    | head -n 1
}

workflow_was_triggered() {
  local workflow_file="$1"
  [ -n "$(workflow_latest_status "${workflow_file}")" ]
}

check_workflow() {
  local name="$1"
  local workflow_file="$2"
  local self_label="$3"
  local required="$4"

  if [ "${required}" != "true" ]; then
    echo "${name} deploy not required for this release."
    return 0
  fi

  if [ "${SELF_WORKFLOW}" = "${self_label}" ]; then
    echo "${name} deploy completed (this workflow)."
    return 0
  fi

  if ! workflow_was_triggered "${workflow_file}"; then
    echo "${name} deploy has not started for ${DEPLOY_SHA}."
    return 1
  fi

  local status
  status="$(workflow_latest_status "${workflow_file}")"
  local run_status="${status%%:*}"
  local run_conclusion="${status#*:}"

  if [ "${run_status}" = "completed" ] && [ "${run_conclusion}" = "success" ]; then
    echo "${name} deploy completed successfully."
    return 0
  fi

  if [ "${run_status}" = "completed" ] && [ "${run_conclusion}" != "success" ]; then
    echo "${name} deploy failed (${status})."
    return 2
  fi

  echo "${name} deploy still running (${status})."
  return 1
}

all_required_deploys_done() {
  local backend_required="$1"
  local frontend_required="$2"
  local backend_status=0
  local frontend_status=0

  check_workflow "Backend" "deploy_khonofy-backend-api.yml" "backend" "${backend_required}" || backend_status=$?
  if [ "${backend_status}" -eq 2 ]; then
    return 2
  fi

  check_workflow "Frontend" "azure-static-web-apps-polite-smoke-0f9de4610.yml" "frontend" "${frontend_required}" || frontend_status=$?
  if [ "${frontend_status}" -eq 2 ]; then
    return 2
  fi

  if [ "${backend_status}" -eq 1 ] || [ "${frontend_status}" -eq 1 ]; then
    return 1
  fi

  return 0
}

BACKEND_REQUIRED=false
FRONTEND_REQUIRED=false
mapfile -t changed_files < <(gh api "/repos/${GITHUB_REPOSITORY}/commits/${DEPLOY_SHA}" --jq '.files[].filename')
for file in "${changed_files[@]}"; do
  if file_requires_backend "${file}"; then BACKEND_REQUIRED=true; fi
  if file_requires_frontend "${file}"; then FRONTEND_REQUIRED=true; fi
done
echo "Required deploys for ${DEPLOY_SHA}: backend=${BACKEND_REQUIRED}, frontend=${FRONTEND_REQUIRED}"

for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  echo "Attempt ${attempt}/${MAX_ATTEMPTS}"
  status=0
  all_required_deploys_done "${BACKEND_REQUIRED}" "${FRONTEND_REQUIRED}" || status=$?

  if [ "${status}" -eq 0 ]; then
    break
  fi

  if [ "${status}" -eq 2 ]; then
    echo "A required deploy workflow failed. Not opening PR."
    exit 1
  fi

  if [ "${attempt}" -eq "${MAX_ATTEMPTS}" ]; then
    echo "Timed out waiting for deploy workflows to finish."
    exit 1
  fi

  sleep "${WAIT_SECONDS}"
done

AHEAD_BY="$(gh api "/repos/${GITHUB_REPOSITORY}/compare/main...deploy" --jq '.ahead_by')"
if [ "${AHEAD_BY}" -eq 0 ]; then
  echo "deploy is already in sync with main."
  exit 0
fi

APP_VERSION="$(node -p "require('./package.json').version")"
EXISTING_PR="$(gh pr list \
  --repo "${GITHUB_REPOSITORY}" \
  --base main \
  --head deploy \
  --state open \
  --json number \
  --jq '.[0].number // empty')"

if [ -z "${EXISTING_PR}" ]; then
  PR_URL="$(gh pr create \
    --repo "${GITHUB_REPOSITORY}" \
    --base main \
    --head deploy \
    --title "Release ${APP_VERSION} to main" \
    --body "Azure deploy workflows completed on \`deploy\`. Review and merge this PR to promote changes to \`main\`.

Version: \`${APP_VERSION}\`
Deploy SHA: \`${DEPLOY_SHA}\`"
  )"
  echo "Created PR for manual review: ${PR_URL}"
else
  PR_URL="$(gh pr view "${EXISTING_PR}" \
    --repo "${GITHUB_REPOSITORY}" \
    --json url \
    --jq '.url')"
  echo "PR already open for manual review: ${PR_URL}"
fi
