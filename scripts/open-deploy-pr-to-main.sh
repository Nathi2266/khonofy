#!/usr/bin/env bash
set -euo pipefail

DEPLOY_SHA="$(git rev-parse HEAD)"
echo "Checking deploy workflows for ${DEPLOY_SHA}"

workflow_needed() {
  local workflow_file="$1"
  gh api "/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=30" \
    --jq "[.workflow_runs[] | select(.head_sha==\"${DEPLOY_SHA}\" and .event != \"pull_request\")] | length > 0"
}

workflow_succeeded() {
  local workflow_file="$1"
  local status
  status="$(gh api "/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=30" \
    --jq ".workflow_runs[] | select(.head_sha==\"${DEPLOY_SHA}\" and .event != \"pull_request\") | \"\(.status):\(.conclusion)\"" \
    | head -n 1)"

  if [ -z "${status}" ]; then
    echo "false"
    return
  fi

  local run_status="${status%%:*}"
  local run_conclusion="${status#*:}"

  if [ "${run_status}" = "completed" ] && [ "${run_conclusion}" = "success" ]; then
    echo "true"
  else
    echo "pending:${status}"
  fi
}

check_workflow() {
  local name="$1"
  local workflow_file="$2"

  if [ "$(workflow_needed "${workflow_file}")" != "true" ]; then
    echo "${name} deploy was not triggered for ${DEPLOY_SHA}."
    return 0
  fi

  local result
  result="$(workflow_succeeded "${workflow_file}")"
  if [ "${result}" = "true" ]; then
    echo "${name} deploy completed successfully."
    return 0
  fi

  echo "${name} deploy still running or failed (${result})."
  return 1
}

if ! check_workflow "Backend" "deploy_khonofy-backend-api.yml"; then
  echo "Waiting for backend deploy to finish."
  exit 0
fi

if ! check_workflow "Frontend" "azure-static-web-apps-polite-smoke-0f9de4610.yml"; then
  echo "Waiting for frontend deploy to finish."
  exit 0
fi

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
