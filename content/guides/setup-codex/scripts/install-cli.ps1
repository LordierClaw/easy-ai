param([Parameter(Mandatory)][string]$Prefix)
$ErrorActionPreference='Stop'
$env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
New-Item -ItemType Directory -Force -Path $Prefix | Out-Null
$ErrorActionPreference='Continue'
& npm.cmd install --global --prefix $Prefix '@openai/codex' --registry https://registry.npmjs.org --ignore-scripts --no-audit --no-fund
exit $LASTEXITCODE
