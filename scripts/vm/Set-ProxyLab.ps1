param([Parameter(Mandatory)][string]$ProxyHost,[int]$ProxyPort=8080,[switch]$RestrictEgress,[switch]$Restore)
$ErrorActionPreference='Stop'
if ((Get-CimInstance Win32_ComputerSystem).Model -notmatch 'VMware') {throw 'Chỉ chạy trong VMware guest của lab.'}
if ($ProxyHost -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {throw 'ProxyHost phải là IPv4 host-only.'}
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$backup='C:\EasyAI-Lab\proxy-backup.json'
if($Restore) {
  $saved=Get-Content -LiteralPath $backup -Raw | ConvertFrom-Json
  Set-ItemProperty -LiteralPath $key -Name ProxyEnable -Value ([int]$saved.ProxyEnable)
  Set-ItemProperty -LiteralPath $key -Name ProxyServer -Value ([string]$saved.ProxyServer)
  Set-ItemProperty -LiteralPath $key -Name ProxyOverride -Value ([string]$saved.ProxyOverride)
  foreach($p in $saved.Profiles) {Set-NetFirewallProfile -Name $p.Name -DefaultOutboundAction $p.DefaultOutboundAction}
  Get-NetFirewallRule -DisplayName 'EasyAI-Lab-*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  foreach($rule in $saved.OutboundRules) {Set-NetFirewallRule -Name $rule -Enabled True}
  Write-Output 'Đã khôi phục cấu hình lab.'; exit
}
if(Test-Path -LiteralPath $backup){throw 'Đã có backup. Restore hoặc khôi phục snapshot trước khi đặt lại.'}
$current=Get-ItemProperty -LiteralPath $key
$rules=@(Get-NetFirewallRule -Direction Outbound -Enabled True -Action Allow | Select-Object -ExpandProperty Name)
@{ProxyEnable=$current.ProxyEnable; ProxyServer=$current.ProxyServer; ProxyOverride=$current.ProxyOverride; Profiles=@(Get-NetFirewallProfile | Select-Object Name,DefaultOutboundAction); OutboundRules=$rules} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $backup
Set-ItemProperty -LiteralPath $key -Name ProxyEnable -Value 1
Set-ItemProperty -LiteralPath $key -Name ProxyServer -Value ($ProxyHost+':'+$ProxyPort)
Set-ItemProperty -LiteralPath $key -Name ProxyOverride -Value 'localhost;127.0.0.1;<local>'
if($RestrictEgress) {
  # Run elevated under the test user's identity so HKCU belongs to that user.
  $rules | ForEach-Object {Set-NetFirewallRule -Name $_ -Enabled False}
  New-NetFirewallRule -DisplayName 'EasyAI-Lab-Proxy' -Direction Outbound -Action Allow -Protocol TCP -RemoteAddress $ProxyHost -RemotePort $ProxyPort | Out-Null
  New-NetFirewallRule -DisplayName 'EasyAI-Lab-Loopback' -Direction Outbound -Action Allow -RemoteAddress '127.0.0.1','::1' | Out-Null
  # SSH replies use the established inbound connection; DNS is only for proxy testing if explicitly needed.
  Set-NetFirewallProfile -Profile Domain,Private,Public -DefaultOutboundAction Block
}
Write-Output 'Proxy Windows đã đặt. Mở lại EasyAI. Kiểm chứng Internet trực tiếp thất bại và proxy có log CONNECT.'
