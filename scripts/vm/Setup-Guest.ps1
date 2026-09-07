param([Parameter(Mandatory)][string]$TestUser,[Parameter(Mandatory)][string]$HostOnlySubnet)
$ErrorActionPreference='Stop'
if ((Get-CimInstance Win32_ComputerSystem).Model -notmatch 'VMware') { throw 'Script này chỉ chạy bên trong VMware guest.' }
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
if (!([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Setup lab cần chạy bằng admin trong guest.' }
$user=Get-LocalUser -Name $TestUser
if ($HostOnlySubnet -notmatch '^\d{1,3}(\.\d{1,3}){3}/\d{1,2}$') {throw 'Cần subnet host-only IPv4 dạng CIDR.'}
$root='C:\EasyAI-Lab'
New-Item -ItemType Directory -Path $root -Force | Out-Null
& icacls.exe $root /grant ($TestUser+':(OI)(CI)M') | Out-Null
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
Set-Service sshd -StartupType Automatic
Start-Service sshd
# Limit the existing OpenSSH firewall rule rather than leaving its default Any scope.
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue | Set-NetFirewallRule -RemoteAddress $HostOnlySubnet
$principal=New-ScheduledTaskPrincipal -UserId $user.SID.Value -LogonType Interactive -RunLevel Limited
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File C:\EasyAI-Lab\scripts\vm\Run-Guest.ps1' -WorkingDirectory $root
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 90) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'EasyAI-TestRunner' -Action $action -Principal $principal -Settings $settings -Force | Out-Null
Write-Output 'Runner đã được đăng ký. Cài public key theo docs/vm-lab.md rồi đăng nhập desktop bằng test user. Không bật auto-login.'
