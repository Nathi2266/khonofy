#!/usr/bin/env bash
# Open (or reuse) a PR from SOURCE_BRANCH into deploy. Does not merge — a human
# approves and merges the PR; deploy-branch workflows run after merge.
set -euo pipefail

SOURCE_BRANCH="${SOURCE_BRANCH:?SOURCE_BRANCH is required}"
TARGET_BRANCH="${TARGET_BRANCH:-deploy}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

VERSION_FILES=(
  package.json
  package-lock.json
  backend/package.json
  public/app-version.json
)

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
  gh pr create \
    --repo "${REPO}" \
    --base "${TARGET_BRANCH}" \
    --head "${SOURCE_BRANCH}" \
    --title "Merge ${SOURCE_BRANCH} into ${TARGET_BRANCH}" \
    --body "Automated PR promoting \`${SOURCE_BRANCH}\` into \`${TARGET_BRANCH}\`.

CI passed on the latest push. Review and merge this PR when ready — deploy workflows run after merge to \`${TARGET_BRANCH}\`."

  EXISTING_PR="$(gh pr list \
    --repo "${REPO}" \
    --base "${TARGET_BRANCH}" \
    --head "${SOURCE_BRANCH}" \
    --state open \
    --json number,url \
    --jq '.[0]')"
fi

PR_NUMBER="$(printf '%s' "${EXISTING_PR}" | jq -r '.number')"
PR_URL="$(printf '%s' "${EXISTING_PR}" | jq -r '.url')"

resolve_version_conflicts() {
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git fetch origin "${TARGET_BRANCH}" "${SOURCE_BRANCH}"
  git checkout "${SOURCE_BRANCH}"
  git pull --ff-only origin "${SOURCE_BRANCH}"

  if ! git merge "origin/${TARGET_BRANCH}" -m "Merge ${TARGET_BRANCH} into ${SOURCE_BRANCH} before deploy promotion"; then
    for file in "${VERSION_FILES[@]}"; do
      if git ls-files -u -- "${file}" | grep -q .; then
        git checkout --theirs -- "${file}"
        git add -- "${file}"
      fi
    done

    if git ls-files -u | grep -q .; then
      echo "Merge conflicts remain outside version files:" >&2
      git diff --name-only --diff-filter=U >&2
      git merge --abort
      return 1
    fi

    git commit --no-edit
  fi

  git push origin "${SOURCE_BRANCH}"
}

wait_for_mergeable_pr() {
  local attempts=0
  while [ "${attempts}" -lt 12 ]; do
    local mergeable
    mergeable="$(gh pr view "${PR_NUMBER}" --repo "${REPO}" --json mergeable --jq '.mergeable')"
    if [ "${mergeable}" = "MERGEABLE" ]; then
      return 0
    fi
    if [ "${mergeable}" = "CONFLICTING" ]; then
      return 1
    fi
    attempts=$((attempts + 1))
    sleep 5
  done
  return 1
}

MERGEABLE="$(gh pr view "${PR_NUMBER}" --repo "${REPO}" --json mergeable --jq '.mergeable')"
if [ "${MERGEABLE}" = "CONFLICTING" ]; then
  echo "PR #${PR_NUMBER} has conflicts; syncing ${SOURCE_BRANCH} with ${TARGET_BRANCH}."
  resolve_version_conflicts
  if ! wait_for_mergeable_pr; then
    echo "PR #${PR_NUMBER} is still not mergeable after conflict resolution." >&2
    exit 1
  fi
fi

echo "pr_opened=true"
echo "pr_number=${PR_NUMBER}"
echo "pr_url=${PR_URL}"
echo "Opened PR #${PR_NUMBER} for review: ${PR_URL}"
