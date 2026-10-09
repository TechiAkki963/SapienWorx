$ErrorActionPreference = 'Stop'
$sourceRoot = 'C:/Users/Admin/Documents/SapienWorx/.codex/worktrees/main-local'
$releaseRoot = 'C:/Users/Admin/.codex/worktrees/admin-recruitment-release/SapienWorx'
$files = [System.Collections.Generic.HashSet[string]]::new()
$groups = @('backend/internal/admin','backend/cmd/admin-recovery','frontend/app/swx-command-centre','frontend/components/admin')
foreach ($group in $groups) {
  Get-ChildItem -LiteralPath "$sourceRoot/$group" -File -Recurse | ForEach-Object {
    [void]$files.Add([IO.Path]::GetRelativePath($sourceRoot,$_.FullName).Replace('\','/'))
  }
}
$explicit = @(
 'backend/internal/auth/service.go','backend/internal/auth/password_reset.go','backend/internal/auth/login_eligibility_test.go','backend/internal/auth/session_access.go',
 'backend/internal/platform/config/config.go','backend/internal/platform/config/config_test.go',
 'backend/internal/platform/httpserver/admin_handlers.go','backend/internal/platform/httpserver/auth_handlers.go','backend/internal/platform/httpserver/messaging_handlers.go',
 'backend/internal/platform/httpserver/admin_account_summary_handler.go','backend/internal/platform/httpserver/admin_dashboard_handler.go',
 'backend/internal/platform/httpserver/admin_lifecycle_handlers.go','backend/internal/platform/httpserver/admin_recruitment_handlers.go',
 'backend/internal/platform/httpserver/admin_scoped_middleware.go','backend/internal/platform/httpserver/admin_scoped_middleware_test.go',
 'backend/internal/platform/httpserver/admin_security_handlers.go','backend/internal/platform/httpserver/admin_security_integration_test.go',
 'backend/internal/platform/httpserver/session_middleware.go','backend/internal/platform/httpserver/session_middleware_test.go',
 'frontend/lib/admin.ts','frontend/lib/admin-access-server.ts','frontend/lib/admin-access.ts','frontend/lib/admin-permission-catalog.json','frontend/lib/admin-recruitment.ts',
 'frontend/playwright.admin-access.config.ts',
 'frontend/tests/e2e/admin-access-preview.spec.ts','frontend/tests/e2e/admin-dashboard.spec.ts','frontend/tests/e2e/admin-governance.spec.ts','frontend/tests/e2e/admin-recruitment.spec.ts','frontend/tests/e2e/admin-security.spec.ts',
 'docs/admin-access-foundation.md','docs/admin-dashboard-foundation.md','docs/admin-governance-foundation.md','docs/admin-completion-roadmap.md','docs/admin-recruitment-review.md','docs/admin-security-activation-runbook.md'
)
foreach ($file in $explicit) { [void]$files.Add($file) }
Get-ChildItem -LiteralPath "$sourceRoot/database/migrations" -File | Where-Object { $_.Name -match '^0000(26|27|28|29|30|31|32|33)_' } | ForEach-Object { [void]$files.Add('database/migrations/'+$_.Name) }
foreach ($file in $files) {
  $dest = Join-Path $releaseRoot $file
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($dest))
  Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $dest
}
function ApplySelectedDiff([string]$file,[int[]]$selected,[bool]$trimMock = $false) {
  $lines = & git -C $sourceRoot diff --no-ext-diff -- $file
  if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect source diff' }
  $parts = [regex]::Split(($lines -join "`n"),'(?m)(?=^@@ )')
  $patch = $parts[0]
  foreach ($index in $selected) {
    $part = $parts[$index]
    if ($trimMock) {
      $part = $part.Replace("+    failCVPreview: false,`n",'')
      $part = [regex]::Replace($part,'(?m)^\+  if \(url.pathname === "/__e2e/(onboarding|cv-failure)"[^\n]*\n(?:^\+[^\n]*\n)*?^\+  \}\n','')
      $part = [regex]::Replace($part,'(?m)^-    return json\(res, 200, \{ id, role \}\);\n\+    return json\(res, 200, \{ id, role,[^\n]*\n','     return json(res, 200, { id, role });'+"`n")
    }
    $patch += $part
  }
  $start = [Diagnostics.ProcessStartInfo]::new('git')
  $start.WorkingDirectory = $releaseRoot
  $start.ArgumentList.Add('apply'); $start.ArgumentList.Add('--recount'); $start.ArgumentList.Add('--whitespace=nowarn'); $start.ArgumentList.Add('-')
  $start.UseShellExecute = $false; $start.RedirectStandardInput = $true
  $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
  $process = [Diagnostics.Process]::Start($start)
  $process.StandardInput.Write($patch.TrimEnd()+"`n"); $process.StandardInput.Close(); $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Unable to isolate $file" }
}
ApplySelectedDiff 'backend/internal/platform/httpserver/server.go' @(2,6)
ApplySelectedDiff 'backend/internal/recruiter/service.go' @(12)
ApplySelectedDiff 'frontend/tests/e2e/mock-api.mjs' @(1,2,3,4,6,7,10,11) $true
Write-Output "Copied $($files.Count) scoped files and isolated three shared-file diffs. Original checkout and index unchanged."
