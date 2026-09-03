#!/usr/bin/env bash
set -euo pipefail

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Exit 0 to skip a Vercel build when the commit only changes files that do
# not affect the deployed Next.js runtime. Exit 1 when runtime/config files
# changed so Vercel continues with a normal build.
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
