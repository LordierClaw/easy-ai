param([string]$NodePath=(Get-Command node.exe -ErrorAction Stop).Source)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stage=[IO.Path]::GetFullPath((Join-Path $root ('artifacts\lab-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))))
if(!$stage.StartsWith($root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Stage phải nằm trong workspace.'}
if(!(Test-Path -LiteralPath (Join-Path $root 'out\main\index.js'))){throw 'Chạy npm run build trước.'}
New-Item -ItemType Directory -Path $stage -Force | Out-Null
# Explicit inclusion avoids copying .local credentials, VMs, or unrelated workspace files.
foreach($name in @('out','content','tests','scripts','node_modules','package.json','package-lock.json','playwright.config.ts','playwright.live.config.ts','playwright.vm.config.ts')) {
  Copy-Item -LiteralPath (Join-Path $root $name) -Destination $stage -Recurse
}
$runtime=Join-Path $stage 'runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $runtime 'node.exe')
Write-Output ('Bundle directory: '+$stage)
Write-Output 'Copy contents to C:\EasyAI-Lab in the guest. No global Node/Git installation is needed for the harness.'
