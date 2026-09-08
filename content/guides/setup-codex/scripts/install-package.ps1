param([Parameter(Mandatory)][string]$PackageId,[ValidateSet('winget','msstore')][string]$Source='winget')
$ErrorActionPreference='Stop'
$env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
$proxy=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
if($proxy.AutoConfigURL){throw 'PAC chưa được hỗ trợ. Cần IT cung cấp proxy cố định.'}
$arguments=@('install','--id',$PackageId,'--exact','--source',$Source,'--accept-package-agreements','--accept-source-agreements','--silent','--disable-interactivity')
if($proxy.ProxyEnable -and $proxy.ProxyServer){
  $server=[string]$proxy.ProxyServer
  if($server.Contains('=')){ $https=@($server.Split(';') | Where-Object {$_ -like 'https=*'})[0]; if(!$https){throw 'Thiếu proxy HTTPS.'}; $server=$https.Substring(6) }
  if($server -notmatch '^https?://'){$server='http://'+$server}
  $arguments+=@('--proxy',$server)
}else{$arguments+='--no-proxy'}
$ErrorActionPreference='Continue'
& winget.exe @arguments
exit $LASTEXITCODE
