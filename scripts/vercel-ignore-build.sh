#!/usr/bin/env bash
set -euo pipefail

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Exit 0 to skip a Vercel build when the commit only changes files that do
# not affect the deployed Next.js runtime. Exit 1 when runtime/config files
# changed so Vercel continues with a normal build.
#
# Vercel Git clones may be shallow and omit VERCEL_GIT_PREVIOUS_SHA. When
# either comparison commit is unavailable, fail open to a normal build rather
# than emitting a fatal git object error or risking an incorrect skipped build.
if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null || ! git cat-file -e "${HEAD_SHA}^{commit}" 2>/dev/null; then
  echo "Comparison commit unavailable in shallow clone; continuing Vercel build."
  exit 1
fi

if git diff --quiet "$BASE" "$HEAD_SHA" -- . \
  ':(exclude).github/**' \
  ':(exclude)supabase/migrations/**' \
  ':(exclude)README.md' \
  ':(exclude)LAUNCH_RUNBOOK.md' \
  ':(exclude)VALIDATION.md' \
  ':(exclude)CANONICAL_STATUS.json'; then
  echo "No runtime changes detected; skipping Vercel build."
  exit 0
fi

echo "Runtime changes detected; continuing Vercel build."
exit 1
