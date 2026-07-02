#!/usr/bin/env bash
# Open (or reuse) a PR from SOURCE_BRANCH into deploy after CI passes.
# Does not merge — a human must approve and merge the PR.
set -euo pipefail

SOURCE_BRANCH="${SOURCE_BRANCH:?SOURCE_BRANCH is required}"
TARGET_BRANCH="${TARGET_BRANCH:-deploy}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

AHEAD_BY="$(gh api "/repos/${REPO}/compare/${TARGET_BRANCH}...${SOURCE_BRANCH}" --jq '.ahead_by')"
if [ "${AHEAD_BY}" -eq 0 ]; then
  echo "pr_opened=false"
  echo "No commits to promote from ${SOURCE_BRANCH} into ${TARGET_BRANCH}."
  exit 0
fi

EXISTING_PR="$(gh pr list \
  --repo "${REPO}" \
  --base "${TARGET_BRANCH}" \
  --head "${SOURCE_BRANCH}" \
  --state open \
  --json number,url \
  --jq '.[0] // empty')"

if [ -z "${EXISTING_PR}" ]; then
  PR_URL="$(gh pr create \
    --repo "${REPO}" \
    --base "${TARGET_BRANCH}" \
    --head "${SOURCE_BRANCH}" \
    --title "Promote ${SOURCE_BRANCH} into ${TARGET_BRANCH}" \
    --body "$(cat <<EOF
Automated promotion PR for \`${SOURCE_BRANCH}\` → \`${TARGET_BRANCH}\`.

CI passed on the feature branch. **Review and merge this PR** to run deploy workflows on \`${TARGET_BRANCH}\`.
EOF
)")"
  PR_NUMBER="$(gh pr list \
    --repo "${REPO}" \
    --base "${TARGET_BRANCH}" \
    --head "${SOURCE_BRANCH}" \
    --state open \
    --json number \
    --jq '.[0].number')"
else
  PR_NUMBER="$(printf '%s' "${EXISTING_PR}" | jq -r '.number')"
  PR_URL="$(printf '%s' "${EXISTING_PR}" | jq -r '.url')"
fi

echo "pr_opened=true"
echo "pr_number=${PR_NUMBER}"
echo "pr_url=${PR_URL}"
echo "Opened PR #${PR_NUMBER}: ${SOURCE_BRANCH} -> ${TARGET_BRANCH} (${PR_URL})"
