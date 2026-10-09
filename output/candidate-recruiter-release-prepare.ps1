$ErrorActionPreference = 'Stop'
$sourceRoot = 'C:/Users/Admin/Documents/SapienWorx/.codex/worktrees/main-local'
$releaseRoot = 'C:/Users/Admin/.codex/worktrees/admin-recruitment-release/SapienWorx'
$paths = @(& git -C $sourceRoot -c core.quotepath=false diff --name-only --diff-filter=AM)
$paths += @(& git -C $sourceRoot -c core.quotepath=false ls-files --others --exclude-standard)
$selected = @($paths | Where-Object {
  $_ -notmatch '^output/' -and
  $_ -notmatch '^backend/(cmd/admin-recovery|internal/admin)/' -and
  $_ -notmatch '^backend/internal/auth/(service|password_reset|login_eligibility_test|session_access)\.go$' -and
  $_ -notmatch '^backend/internal/platform/config/' -and
  $_ -notmatch '^backend/internal/platform/httpserver/(admin_|auth_handlers|messaging_handlers|session_middleware)' -and
  $_ -notmatch '^frontend/(app/swx-command-centre/|components/admin/|lib/admin|playwright\.admin-access|next-env\.d\.ts$|tsconfig\.json$)' -and
  $_ -notmatch '^frontend/tests/e2e/(admin-|start-web\.mjs$)' -and
  $_ -notmatch '^docs/admin-' -and
  $_ -notmatch '^database/migrations/0000(26|27|28|29|30|31|32|33)_' -and
  ($_ -match '^(backend/|frontend/|database/|deploy/compose\.test\.yml$|\.gitattributes$)')
} | Sort-Object -Unique)
foreach ($file in $selected) {
  $dest = Join-Path $releaseRoot $file
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($dest))
  Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $dest
}
Write-Output "Copied $($selected.Count) candidate/recruiter/parser files. Existing Admin work and CI compatibility fixes retained. Original checkout/index unchanged."
$selected
