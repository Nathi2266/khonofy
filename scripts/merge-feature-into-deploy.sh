#!/usr/bin/env bash
# Open (or reuse) a PR from SOURCE_BRANCH into deploy, resolve version-file
# conflicts when needed, then merge. Version bumps on deploy happen after merge.
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
  echo "merged=false"
  echo "No commits to merge from ${SOURCE_BRANCH} into ${TARGET_BRANCH}."
  exit 0
fi

EXISTING_PR="$(gh pr list \
  --repo "${REPO}" \
  --base "${TARGET_BRANCH}" \
  --head "${SOURCE_BRANCH}" \
  --state open \
  --json number \
  --jq '.[0].number // empty')"

if [ -z "${EXISTING_PR}" ]; then
  gh pr create \
    --repo "${REPO}" \
    --base "${TARGET_BRANCH}" \
    --head "${SOURCE_BRANCH}" \
    --title "Merge ${SOURCE_BRANCH} into ${TARGET_BRANCH}" \
    --body "Automated PR promoting \`${SOURCE_BRANCH}\` into \`${TARGET_BRANCH}\`."

  EXISTING_PR="$(gh pr list \
    --repo "${REPO}" \
    --base "${TARGET_BRANCH}" \
    --head "${SOURCE_BRANCH}" \
    --state open \
    --json number \
    --jq '.[0].number')"
fi

resolve_version_conflicts() {
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git fetch origin "${TARGET_BRANCH}" "${SOURCE_BRANCH}"
  git checkout "${SOURCE_BRANCH}"
  git pull --ff-only origin "${SOURCE_BRANCH}"

  if ! git merge "origin/${TARGET_BRANCH}" -m "Merge ${TARGET_BRANCH} into ${SOURCE_BRANCH} before deploy promotion"; then
    local unresolved=0
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
    mergeable="$(gh pr view "${EXISTING_PR}" --repo "${REPO}" --json mergeable --jq '.mergeable')"
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

MERGEABLE="$(gh pr view "${EXISTING_PR}" --repo "${REPO}" --json mergeable --jq '.mergeable')"
if [ "${MERGEABLE}" = "CONFLICTING" ]; then
  echo "PR #${EXISTING_PR} has conflicts; syncing ${SOURCE_BRANCH} with ${TARGET_BRANCH}."
  resolve_version_conflicts
  if ! wait_for_mergeable_pr; then
    echo "PR #${EXISTING_PR} is still not mergeable after conflict resolution." >&2
    exit 1
  fi
fi

gh pr merge "${EXISTING_PR}" \
  --repo "${REPO}" \
  --merge \
  --delete-branch=false

echo "merged=true"
echo "Merged PR #${EXISTING_PR}: ${SOURCE_BRANCH} -> ${TARGET_BRANCH}"
