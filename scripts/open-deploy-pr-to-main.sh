#!/usr/bin/env bash
set -euo pipefail

# SELF_WORKFLOW: backend | frontend (the workflow that invoked this script)
SELF_WORKFLOW="${SELF_WORKFLOW:-}"
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse HEAD)}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-40}"
WAIT_SECONDS="${WAIT_SECONDS:-30}"

echo "Open deploy PR check (self=${SELF_WORKFLOW}, sha=${DEPLOY_SHA})"

workflow_was_triggered() {
  local workflow_file="$1"
  gh api "/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=30" \
    --jq "[.workflow_runs[] | select(.head_sha==\"${DEPLOY_SHA}\" and .event != \"pull_request\")] | length > 0"
}

workflow_is_successful() {
  local workflow_file="$1"
  gh api "/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=30" \
    --jq "[.workflow_runs[] | select(.head_sha==\"${DEPLOY_SHA}\" and .event != \"pull_request\" and .status==\"completed\" and .conclusion==\"success\")] | length > 0"
}

workflow_is_failed() {
  local workflow_file="$1"
  gh api "/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs?branch=deploy&per_page=30" \
    --jq "[.workflow_runs[] | select(.head_sha==\"${DEPLOY_SHA}\" and .event != \"pull_request\" and .status==\"completed\" and .conclusion != \"success\")] | length > 0"
}

check_workflow() {
  local name="$1"
  local workflow_file="$2"
  local self_label="$3"

  if [ "${SELF_WORKFLOW}" = "${self_label}" ]; then
    echo "${name} deploy completed (this workflow)."
    return 0
  fi

  if [ "$(workflow_was_triggered "${workflow_file}")" != "true" ]; then
    echo "${name} deploy was not triggered for ${DEPLOY_SHA}."
    return 0
  fi

  if [ "$(workflow_is_successful "${workflow_file}")" = "true" ]; then
    echo "${name} deploy completed successfully."
    return 0
  fi

  if [ "$(workflow_is_failed "${workflow_file}")" = "true" ]; then
    echo "${name} deploy failed."
    return 2
  fi

  echo "${name} deploy still running."
  return 1
}

all_required_deploys_done() {
  local backend_status=0
  local frontend_status=0

  check_workflow "Backend" "deploy_khonofy-backend-api.yml" "backend" || backend_status=$?
  if [ "${backend_status}" -eq 2 ]; then
    return 2
  fi

  check_workflow "Frontend" "azure-static-web-apps-polite-smoke-0f9de4610.yml" "frontend" || frontend_status=$?
  if [ "${frontend_status}" -eq 2 ]; then
    return 2
  fi

  if [ "${backend_status}" -eq 1 ] || [ "${frontend_status}" -eq 1 ]; then
    return 1
  fi

  return 0
}

for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  echo "Attempt ${attempt}/${MAX_ATTEMPTS}"
  all_required_deploys_done
  status=$?

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
