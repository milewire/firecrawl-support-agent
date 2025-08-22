# scripts/protect-main.ps1
Param(
  [string]$Owner,
  [string]$Repo
)

if (-not $Owner) { $Owner = $env:GITHUB_OWNER }
if (-not $Repo)  { $Repo  = $env:GITHUB_REPO }
if (-not $Owner) { $Owner = "milewire" }
if (-not $Repo)  { $Repo  = "firecrawl-support-agent" }

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) is not installed. Install from https://cli.github.com/ and run 'gh auth login'."
  exit 1
}

gh api -X PUT "repos/$Owner/$Repo/branches/main/protection" `
  -H "Accept: application/vnd.github+json" `
  -f enforce_admins=true `
  -f required_status_checks.strict=true `
  -f required_status_checks.contexts=CI `
  -f required_pull_request_reviews.required_approving_review_count=1 `
  -f required_pull_request_reviews.dismiss_stale_reviews=true

Write-Host "✅ Branch protection applied to ${Owner}/${Repo}: main"
