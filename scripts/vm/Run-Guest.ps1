$ErrorActionPreference='Stop'
if ((Get-CimInstance Win32_ComputerSystem).Model -notmatch 'VMware') { throw 'Runner này chỉ chạy trong VMware guest.' }
$root='C:\EasyAI-Lab'
Set-Location -LiteralPath $root
New-Item -ItemType Directory -Path (Join-Path $root 'artifacts') -Force | Out-Null
$status=Join-Path $root 'artifacts\status.json'
@{completed=$false; started=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $status
$exitCode=1
try {
  $suite=(Get-Content -LiteralPath (Join-Path $root 'suite.txt') -Raw).Trim()
  if ($suite -notin @('e2e','live','real')) {throw 'Suite không hợp lệ.'}
  $node=Join-Path $root 'runtime\node.exe'
  if (!(Test-Path -LiteralPath $node)) {throw 'Thiếu runtime test riêng; không cài Node global để chạy test.'}
  if($suite -ne 'e2e') { Invoke-WebRequest 'http://127.0.0.1:20128/v1/models' -TimeoutSec 10 | Out-Null }
  $config=if($suite -eq 'e2e'){'playwright.config.ts'}elseif($suite -eq 'live'){'playwright.live.config.ts'}else{'playwright.vm.config.ts'}
  $env:EASYAI_REAL_VM=if($suite -eq 'real'){'1'}else{'0'}
  # Do not add runtime/ to PATH: the application must detect real user-installed Node.
  & $node 'node_modules\@playwright\test\cli.js' test --config $config *> (Join-Path $root 'artifacts\runner.log')
  $exitCode=$LASTEXITCODE
} catch { $_.Exception.Message | Set-Content -LiteralPath (Join-Path $root 'artifacts\runner-error.txt') }
finally { @{completed=$true; exitCode=$exitCode; finished=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $status }
exit $exitCode
