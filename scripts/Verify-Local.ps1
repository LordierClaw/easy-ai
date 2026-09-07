$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root
New-Item -ItemType Directory -Path 'artifacts' -Force | Out-Null
& npm.cmd run docs:validate
if($LASTEXITCODE){throw 'Tài liệu chưa hợp lệ.'}
& npm.cmd run build
if($LASTEXITCODE){throw 'Build/typecheck không đạt.'}
& npx.cmd vitest run --reporter=json --outputFile=artifacts/unit-results.json
if($LASTEXITCODE){throw 'Unit/integration test không đạt.'}
& npx.cmd playwright test
if($LASTEXITCODE){throw 'E2E không đạt.'}
& npx.cmd playwright test --config playwright.live.config.ts
if($LASTEXITCODE){throw 'AI live test không đạt.'}
& npx.cmd tsx scripts/create-icon.ts
if($LASTEXITCODE){throw 'Không tạo được icon.'}
& npx.cmd electron-builder --win nsis portable --x64 *> artifacts/packaging.log
if($LASTEXITCODE){throw 'Đóng gói không đạt. Xem artifacts/packaging.log.'}
& npx.cmd playwright test --config playwright.packaged.config.ts
if($LASTEXITCODE){throw 'Packaged smoke test không đạt.'}
& npm.cmd audit --omit=dev
if($LASTEXITCODE){throw 'Dependency audit cần xử lý.'}
Write-Output 'Các gate local đã đạt. Nghiệm thu GitHub/VM/user login vẫn là các gate riêng theo docs/acceptance.md.'
