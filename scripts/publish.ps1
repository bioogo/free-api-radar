# free-api-radar: one-command publish helper to GitHub
# =================================================================
# No pre-installed git required: the script locates git automatically --
#   1) git on PATH (e.g. Git for Windows installed)
#   2) portable MinGit next to the plugin: <plugin-dir>\..\.tools\MinGit\cmd\git.exe
#   3) common install paths (Program Files, etc.)
#
# Usage (pick one):
#
# 1) Repo already exists (recommended: create an EMPTY repo on github.com first):
#    pwsh scripts/publish.ps1 -RepoUrl "https://github.com/<YOUR-NAME>/free-api-radar.git"
#    -- When prompted: username = your GitHub name, password = a PAT
#       (Settings -> Developer settings -> Personal access tokens, scope: repo).
#       Revoke the token after publishing.
#
# 2) GitHub CLI (gh) installed and logged in: auto-create and push:
#    pwsh scripts/publish.ps1 -CreateRepo free-api-radar -Visibility public
#
# 3) Local commit only, no push (dry run):
#    pwsh scripts/publish.ps1 -RepoUrl "..." -SkipPush
#
# What it does: updates the repository field in package.json -> git init ->
# commit everything (data snapshots are .gitignored but force-added with -f so
# git+ installs get the latest snapshot) -> add remote -> push to main.
param(
  [string]$RepoUrl,
  [string]$CreateRepo,
  [ValidateSet("public", "private")]
  [string]$Visibility = "public",
  [switch]$SkipPush,
  [string]$UserName,
  [string]$UserEmail
)
# Native commands (git) print warnings to stderr; never let that stop the script.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 0) locate git
function Find-Git {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $pluginDir = Split-Path -Parent $PSScriptRoot                    # ...\插件
  $siblingTools = Join-Path (Split-Path -Parent $pluginDir) ".tools\MinGit\cmd\git.exe"  # ...\.tools\MinGit\cmd\git.exe (next to the plugin folder)
  $candidates = @(
    $siblingTools,
    (Join-Path $env:TEMP "dsh-tools\MinGit\cmd\git.exe"),
    "$env:ProgramFiles\Git\cmd\git.exe",
    "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  Write-Host "Tried, none found:" -ForegroundColor Yellow
  foreach ($c in $candidates) { Write-Host "  - $c" -ForegroundColor Yellow }
  return $null
}
$git = Find-Git
if (-not $git) {
  throw "git not found. Options: a) install Git for Windows (winget install Git.Git or https://git-scm.com/download/win); b) extract portable MinGit to .tools\MinGit next to the plugin folder."
}
Write-Host "Using git: $git"

# 1) update the repository field in package.json
if ($RepoUrl) {
  $repo = $RepoUrl -replace '\.git$', ''
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.repository={type:'git',url:'$repo'};fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
  Write-Host "package.json repository -> $repo"
}

# 2) git init (idempotent)
if (-not (Test-Path ".git")) {
  & $git init -b main | Out-Null
  Write-Host "git init -b main"
}
& $git config core.autocrlf false   # keep LF inside the repo, avoid CRLF warnings
& $git config commit.gpgsign false  # do not let global GPG signing block the commit

# 3) identity fallback (required for the first commit)
$name = & $git config user.name 2>$null
$email = & $git config user.email 2>$null
if (-not $name) { $name = if ($UserName) { $UserName } else { "free-api-radar" }; & $git config user.name $name }
if (-not $email) { $email = if ($UserEmail) { $UserEmail } else { "free-api-radar@users.noreply.github.com" }; & $git config user.email $email }
if (-not $UserName -and -not $UserEmail) { Write-Host "(No git identity detected; commit author is $name / $email. To use your own identity: git config --global user.name/user.email and re-run, or git commit --amend --reset-author)" }

# 4) commit everything (data snapshots are gitignored; -f forces them in)
& $git add -A -f
if (-not (& $git diff --cached --quiet)) {
  & $git commit -m "feat: free-api-radar -- cross-platform free LLM API radar with daily GitHub Actions refresh"
  Write-Host "Initial commit created"
} else {
  Write-Host "No changes to commit"
}

# 5) push
if ($SkipPush) {
  Write-Host "[SkipPush] Dry run done: local repo and commit are ready, nothing pushed."
  exit 0
}
if ($CreateRepo) {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "gh CLI not found. Install https://cli.github.com/ and run gh auth login, or use -RepoUrl instead."
  }
  gh repo create $CreateRepo --$Visibility --source . --remote origin --push
  Write-Host "Created and pushed: gh repo view $CreateRepo"
} elseif ($RepoUrl) {
  & $git remote remove origin 2>$null
  & $git remote add origin $RepoUrl
  Write-Host "Pushing to $RepoUrl (if prompted: username = GitHub name, password = PAT)"
  & $git push -u origin main
} else {
  throw "Provide -RepoUrl or -CreateRepo (or add -SkipPush for a dry run)."
}

Write-Host ""
Write-Host "Published!"
Write-Host "  Install: dsh plugin add git+$((& $git remote get-url origin))"
Write-Host "  (your dsh also needs pnpm: npm i -g pnpm)"
Write-Host "  GitHub Actions secrets: repo Settings -> Secrets and variables -> Actions; key names match the env: mapping in .github/workflows/refresh.yml"
