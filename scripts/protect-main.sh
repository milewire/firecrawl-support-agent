#!/usr/bin/env bash
set -euo pipefail
OWNER="${GITHUB_OWNER:-milewire}"
REPO="${GITHUB_REPO:-firecrawl-support-agent}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install: https://cli.github.com/ and run 'gh auth login'." >&2
  exit 1
fi

gh api -X PUT "repos/$OWNER/$REPO/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  -f enforce_admins=true \
  -f required_status_checks.strict=true \
  -F required_status_checks.contexts[]="CI" \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f required_pull_request_reviews.dismiss_stale_reviews=true

echo "✅ Branch protection applied to $OWNER/$REPO: main"
