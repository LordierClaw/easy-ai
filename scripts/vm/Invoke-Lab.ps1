param(
  [Parameter(Mandatory)][string]$Config,
  [Parameter(Mandatory)][ValidateSet('Check','Start','Snapshot','Restore','Tunnel','Run','Collect')][string]$Action,
  [ValidateSet('e2e','live','real')][string]$Suite='e2e'
)
$ErrorActionPreference='Stop'
$lab=Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
$labRoot=[IO.Path]::GetFullPath($lab.labRoot).TrimEnd('\')+'\'
$vmx=[IO.Path]::GetFullPath($lab.vmx)
if (!$vmx.StartsWith($labRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($vmx) -ne '.vmx') { throw 'VMX phải nằm trong labRoot chuyên dụng.' }
if (!(Test-Path -LiteralPath $lab.vmrun) -or !(Test-Path -LiteralPath $vmx)) { throw 'Chưa có vmrun hoặc VMX. Xem docs/vm-lab.md.' }
if ($lab.snapshot -notmatch '^easyai-[a-z0-9-]+$') { throw 'Chỉ thao tác snapshot có tiền tố easyai-.' }
if ($lab.sshUser -notmatch '^[a-zA-Z0-9_-]+$' -or $lab.sshHost -notmatch '^[a-zA-Z0-9.-]+$') { throw 'SSH host/user không hợp lệ.' }
if ($lab.guestRoot -ne 'C:\EasyAI-Lab') { throw 'Guest root của bản đầu là C:\EasyAI-Lab.' }
$destination=$lab.sshUser+'@'+$lab.sshHost
$sshArgs=@('-i',$lab.sshKey,'-o','BatchMode=yes','-o','ConnectTimeout=10')
switch($Action) {
  'Check' { & $lab.vmrun list; & ssh.exe @sshArgs $destination 'whoami'; if($LASTEXITCODE){throw 'SSH chưa sẵn sàng.'} }
  'Start' { & $lab.vmrun -T ws start $vmx nogui; if($LASTEXITCODE){throw 'Không khởi động được VM.'} }
  'Snapshot' { & $lab.vmrun -T ws snapshot $vmx $lab.snapshot; if($LASTEXITCODE){throw 'Không tạo được snapshot.'} }
  'Restore' { & $lab.vmrun -T ws stop $vmx soft; if($LASTEXITCODE){throw 'Không dừng được VM; không khôi phục khi VM còn chạy.'}; & $lab.vmrun -T ws revertToSnapshot $vmx $lab.snapshot; if($LASTEXITCODE){throw 'Không khôi phục được snapshot.'} }
  'Tunnel' {
    # Foreground SSH deliberately stays attached; invoke from a dedicated terminal.
    & ssh.exe @sshArgs -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -N -R 127.0.0.1:20128:127.0.0.1:20128 $destination
  }
  'Run' {
    & ssh.exe @sshArgs $destination ('powershell.exe -NoProfile -Command "Set-Content -LiteralPath C:\EasyAI-Lab\suite.txt -Value '+$Suite+'; schtasks.exe /Run /TN EasyAI-TestRunner"')
    if($LASTEXITCODE){throw 'Không kích hoạt được runner. Guest phải có phiên user đang đăng nhập.'}
    Write-Output 'Đã yêu cầu chạy. Kiểm tra status.json và thu artifact sau khi completed=true.'
  }
  'Collect' {
    $artifactRoot=Join-Path (Get-Location) ('artifacts\vm-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    & scp.exe -i $lab.sshKey -o BatchMode=yes -r ($destination+':C:/EasyAI-Lab/artifacts') $artifactRoot
    if($LASTEXITCODE){throw 'Không lấy được artifacts.'}
    Write-Output $artifactRoot
  }
}
