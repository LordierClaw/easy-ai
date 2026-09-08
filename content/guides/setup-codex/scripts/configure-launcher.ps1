param([Parameter(Mandatory)][string]$Prefix)
$ErrorActionPreference='Stop'
$target=Join-Path $Prefix 'codex.cmd'
if(!(Test-Path -LiteralPath $target)){throw 'Codex CLI chưa được cài tại prefix đã duyệt.'}
$launcher=Join-Path $Prefix 'launch-codex.ps1'
if(Test-Path -LiteralPath $launcher){Copy-Item -LiteralPath $launcher -Destination ($launcher+'.backup-'+[Guid]::NewGuid().ToString())}
$quotedTarget=$target.Replace("'","''")
$body=@'
$p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
if($p.AutoConfigURL){throw 'PAC chưa được hỗ trợ.'}
$env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
$env:ALL_PROXY=$null; $env:all_proxy=$null
$env:HTTP_PROXY=$null; $env:HTTPS_PROXY=$null; $env:http_proxy=$null; $env:https_proxy=$null
if($p.ProxyEnable -and $p.ProxyServer){
  $s=[string]$p.ProxyServer
  if($s.Contains('=')){$h=@($s.Split(';') | Where-Object {$_ -like 'https=*'})[0]; if(!$h){throw 'Thiếu proxy HTTPS.'}; $s=$h.Substring(6)}
  if($s -notmatch '^https?://'){$s='http://'+$s}
  $env:HTTP_PROXY=$s; $env:HTTPS_PROXY=$s
}
$b=([string]$p.ProxyOverride).Replace(';',',').Replace('<local>','localhost,127.0.0.1,::1')
$env:NO_PROXY='localhost,127.0.0.1,::1,'+$b; $env:no_proxy=$env:NO_PROXY
& '__TARGET__' @args
'@
$body=$body.Replace('__TARGET__',$quotedTarget)
[IO.File]::WriteAllText($launcher,$body,[Text.UTF8Encoding]::new($true))
$shortcut=Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex (EasyAI).lnk'
$s=(New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
$s.TargetPath='powershell.exe'
$s.Arguments='-NoProfile -NoExit -File "'+$launcher+'"'
$s.WorkingDirectory=$Prefix
$s.Save()
Write-Output ('Launcher: '+$launcher)
exit 0
