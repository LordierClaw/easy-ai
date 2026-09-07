import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { powershell, psQuote } from './process'
import { proxyEnv } from '../shared/proxy'
import { redact } from '../shared/redact'
import { CodexConfiguration } from './configuration'
import type { ComponentId, ComponentState, Inspection, NetworkCheck } from '../shared/types'

export interface Platform {
  inspect(signal?: AbortSignal): Promise<Inspection>
  install(id: ComponentId, inspection: Inspection, signal: AbortSignal): Promise<string>
  configure(inspection: Inspection, signal: AbortSignal): Promise<string>
  readConfig(): Promise<string>
  resetProvider(): Promise<string>
  reinstallCodex(inspection: Inspection, signal: AbortSignal): Promise<string>
  verify(inspection: Inspection, signal: AbortSignal): Promise<Inspection>
  open(target: 'codex' | 'chatgpt' | 'login', inspection: Inspection): Promise<void>
}
export const targets = [
  { name: 'ChatGPT', url: 'https://chatgpt.com', required: true },
  { name: 'OpenAI API', url: 'https://api.openai.com', required: true },
  { name: 'Đăng nhập OpenAI', url: 'https://auth.openai.com', required: true },
  { name: 'GitHub', url: 'https://raw.githubusercontent.com', required: false },
  { name: 'npm', url: 'https://registry.npmjs.org', required: false },
  { name: 'Microsoft Store', url: 'https://apps.microsoft.com', required: false }
]
export async function checkNetwork(fetcher: typeof fetch, extra: typeof targets = [], signal?: AbortSignal): Promise<NetworkCheck[]> {
  return Promise.all([...targets, ...extra].map(async t => {
    try {
      const r = await fetcher(t.url, { method: 'HEAD', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) })
      // HTTP errors prove transport reachability, not authentication or application readiness.
      return { ...t, reachable: true, status: r.status }
    } catch (e) { return { ...t, reachable: false, error: redact((e as Error).message) } }
  }))
}
export class WindowsPlatform implements Platform {
  constructor(private root: string, private fetcher: typeof fetch) {}
  private get codexPrefix() { return join(this.root, 'tools', 'codex') }
  private get config() { return new CodexConfiguration(homedir(), join(this.root, 'backups')) }
  async inspect(signal?: AbortSignal): Promise<Inspection> {
    const script = `
      $env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
      $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
      $principal = [Security.Principal.WindowsPrincipal]::new($identity)
      $admin = [bool]($identity.Groups | Where-Object { $_.Value -eq 'S-1-5-32-544' })
      $p = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction SilentlyContinue
      function Find-Tool($name) { $c = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { return $c.Source }; return '' }
      $git = Find-Tool 'git.exe'; $node = Find-Tool 'node.exe'
      $codex = ${psQuote(join(this.codexPrefix, 'codex.cmd'))}; if (!(Test-Path -LiteralPath $codex)) { $codex = Find-Tool 'codex.cmd'; if (!$codex) { $codex = Find-Tool 'codex.exe' } }
      function Get-Version($tool) { if(!$tool){return ''}; $ErrorActionPreference='Continue'; try { $text=(& $tool --version 2>$null | Out-String).Trim(); if($LASTEXITCODE -ne 0){return ''}; return $text } catch { return '' } }
      $gver = Get-Version $git; $nver = Get-Version $node; $cver = Get-Version $codex
      $chat = Get-AppxPackage -Name '*ChatGPT*' -ErrorAction SilentlyContinue | Select-Object -First 1
      $os = Get-CimInstance Win32_OperatingSystem
      $busy=$false; if(Test-Path -LiteralPath ${psQuote(join(this.root, 'installer.lock'))}) { try { $guard=[IO.File]::Open(${psQuote(join(this.root, 'installer.lock'))},'Open','Read','None'); $guard.Dispose() } catch { $busy=$true } }
      @{ windows=$os.Caption; build=[int]$os.BuildNumber; arch=$os.OSArchitecture; admin=$admin;
        installationBusy=$busy;
        elevated=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);
        git=$git; node=$node; codex=$codex; gver=$gver; nver=$nver; cver=$cver;
        chatVersion=[string]$chat.Version; chatPackage=[string]$chat.PackageFamilyName;
        proxy=@{ enabled=[bool]$p.ProxyEnable; server=[string]$p.ProxyServer; bypass=[string]$p.ProxyOverride; pac=[string]$p.AutoConfigURL }
      } | ConvertTo-Json -Compress
    `
    const [result, network] = await Promise.all([powershell(script, { signal, timeout: 45000 }), checkNetwork(this.fetcher, [], signal)])
    if (result.code !== 0) throw new Error(`Không kiểm tra được Windows: ${result.output}`)
    const v = JSON.parse(result.stdout.trim())
    const component = (id: ComponentId, name: string, version: string, path: string, min: number): ComponentState => {
      const major = Number(version.match(/\d+/)?.[0] || 0)
      const compatible = !!version && major >= min && (id !== 'git' || major > 2 || Number(version.match(/\d+\.(\d+)/)?.[1] || 0) >= 40)
      return { id, name, version, path, installed: !!version, compatible, status: version ? 'installed' : 'missing' }
    }
    return { windows: v.windows, supported: process.platform === 'win32' && process.arch === 'x64' && v.build >= 19045,
      admin: v.admin, elevated: v.elevated, installationBusy: v.installationBusy, proxy: v.proxy, checkedAt: new Date().toISOString(), network,
      components: [component('git', 'Git', v.gver, v.git, 2), component('node', 'Node.js', v.nver, v.node, 22),
        component('codex', 'Codex CLI', v.cver, v.codex, 0), component('chatgpt', 'ChatGPT Desktop', v.chatVersion, v.chatPackage, 0)] }
  }
  private env(i: Inspection) {
    const env = { ...process.env, ...proxyEnv(i.proxy) }
    // Explicit tool paths avoid relying on a stale PATH after an installer finishes.
    const paths = i.components.filter(c => c.path && c.id !== 'chatgpt').map(c => dirname(c.path!))
    env.PATH = [...paths, process.env.PATH || '', 'C:\\Program Files\\nodejs', 'C:\\Program Files\\Git\\cmd'].join(';')
    return env
  }
  async install(id: ComponentId, i: Inspection, signal: AbortSignal): Promise<string> {
    if ((id === 'git' || id === 'node') && !i.admin) throw new Error('IT-001: Không được cài dependency khi tài khoản không có quyền admin.')
    const existing = i.components.find(c => c.id === id)!
    if (existing.compatible) return `${existing.name} đã phù hợp; không cài lại.`
    let script: string
    if (id === 'codex') {
      if (!i.components.find(c => c.id === 'node')?.compatible) throw new Error('Node.js chưa phù hợp.')
      await mkdir(this.codexPrefix, { recursive: true })
      // npm checks package tarball integrity from the HTTPS registry metadata.
      script = `& npm.cmd install --prefix ${psQuote(this.codexPrefix)} --global @openai/codex --registry https://registry.npmjs.org --ignore-scripts --no-audit --no-fund; exit $LASTEXITCODE`
    } else {
      const packageId = { git: 'Git.Git', node: 'OpenJS.NodeJS.LTS', chatgpt: '9NT1R1C2HH7J' }[id]
      const proxy = proxyEnv(i.proxy).HTTPS_PROXY
      const proxyArgument = proxy ? `--proxy ${psQuote(proxy)}` : '--no-proxy'
      // winget verifies installer hashes; do not use --ignore-security-hash.
      script = `$w = Get-Command winget.exe -ErrorAction SilentlyContinue; if (!$w) { throw 'Windows App Installer/winget chưa khả dụng. Cần IT hỗ trợ.' }; & $w.Source install --id ${psQuote(packageId)} --exact --source ${id === 'chatgpt' ? 'msstore' : 'winget'} --accept-package-agreements --accept-source-agreements --silent --disable-interactivity ${proxyArgument}; exit $LASTEXITCODE`
    }
    await mkdir(this.root, { recursive: true })
    // The PowerShell process holds this OS lock even if the Electron parent crashes.
    const guardedScript = `$guard=[IO.File]::Open(${psQuote(join(this.root, 'installer.lock'))},'OpenOrCreate','ReadWrite','None'); try { ${script} } finally { $guard.Dispose() }`
    const r = await powershell(guardedScript, { env: this.env(i), signal, timeout: 20 * 60 * 1000, installer: true })
    if (r.code !== 0) throw new Error(`${id === 'chatgpt' ? 'STORE-001: ' : ''}Không cài được ${existing.name} (exit ${r.code}). ${r.output}`)
    return `${existing.name}: installer kết thúc. Sẽ kiểm chứng lại.\n${r.output}`
  }
  async configure(i: Inspection, signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw new Error('Đã hủy')
    const codex = i.components.find(c => c.id === 'codex')?.path
    if (!codex) throw new Error('Codex CLI chưa được cài.')
    const launcher = join(this.root, 'launch-codex.ps1')
    await mkdir(this.root, { recursive: true })
    let backup = ''
    if (existsSync(launcher)) { backup = `${launcher}.${Date.now()}.bak`; await copyFile(launcher, backup) }
    // Re-read Windows proxy on every launch. Never writes global environment or existing Codex auth/config.
    const script = `$ErrorActionPreference='Stop'
$p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction SilentlyContinue
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:NO_PROXY='localhost,127.0.0.1,::1'
if ($p.ProxyEnable -and $p.ProxyServer) {
  $map=@{}; foreach($part in ([string]$p.ProxyServer -split ';')) { if($part -match '^([^=]+)=(.+)$') {$map[$matches[1]]=$matches[2]} else {$map['http']=$part; $map['https']=$part} }
  foreach($scheme in @('http','https')) { if($map[$scheme]) { $value=$map[$scheme]; if($value -notmatch '^https?://') {$value='http://'+$value}; [Environment]::SetEnvironmentVariable($scheme.ToUpper()+'_PROXY',$value,'Process') } }
  $extra=(([string]$p.ProxyOverride -split ';' | Where-Object {$_ -and $_ -ne '<local>'}) -replace '^\\*\\.','.') -join ','
  if($extra) {$env:NO_PROXY+=','+$extra}
}
${i.components.filter(c => ['git', 'node'].includes(c.id) && c.path).map(c => `$env:PATH=${psQuote(dirname(c.path!) + ';')}+$env:PATH`).join('\n')}
& ${psQuote(codex)} @args
`
    await writeFile(launcher, '\ufeff' + script, 'utf8')
    await writeFile(join(this.root, 'launch-codex.sha256'), createHash('sha256').update('\ufeff' + script).digest('hex'), 'utf8')
    // Start menu shortcut launches the managed environment without changing user/global PATH.
    const shortcut = join(process.env.APPDATA || this.root, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Codex (EasyAI).lnk')
    const shortcutResult = await powershell(`$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${psQuote(shortcut)}); $s.TargetPath='powershell.exe'; $s.Arguments=${psQuote(`-NoProfile -NoExit -ExecutionPolicy RemoteSigned -File "${launcher}"`)}; $s.WorkingDirectory=${psQuote(homedir())}; $s.Save()`, { signal })
    if (shortcutResult.code !== 0) throw new Error(`Đã tạo launcher nhưng chưa tạo được shortcut: ${shortcutResult.output}`)
    return `Đã cấu hình launcher Codex theo proxy Windows và tạo shortcut Codex (EasyAI). ${backup ? `Bản sao lưu: ${backup}` : 'Không thay đổi cấu hình Codex hiện có.'}`
  }
  async readConfig(): Promise<string> {
    return this.config.read()
  }
  async resetProvider() { return this.config.resetProvider() }
  async reinstallCodex(i: Inspection, signal: AbortSignal) {
    return this.install('codex', { ...i, components: i.components.map(c => c.id === 'codex' ? { ...c, compatible: false } : c) }, signal)
  }
  async verify(_i: Inspection, signal: AbortSignal): Promise<Inspection> {
    const i = await this.inspect(signal)
    const launcher = join(this.root, 'launch-codex.ps1')
    let validLauncher = false
    if (existsSync(launcher)) {
      const source = await readFile(launcher, 'utf8')
      const expectedHash = await readFile(join(this.root, 'launch-codex.sha256'), 'utf8').catch(() => '')
      const codexPath = i.components.find(c => c.id === 'codex')?.path
      const parsed = await powershell(`$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile(${psQuote(launcher)},[ref]$tokens,[ref]$errors); if($errors.Count){exit 1}else{exit 0}`, { signal })
      validLauncher = expectedHash === createHash('sha256').update(source).digest('hex') && parsed.code === 0 && !!codexPath && source.includes(`& ${psQuote(codexPath)} @args`) && source.includes('Get-ItemProperty') && source.includes('ProxyServer') && source.includes("$env:NO_PROXY='localhost,127.0.0.1,::1'")
    }
    i.configuration = { valid: validLauncher, detail: validLauncher ? 'Launcher tồn tại, đúng cú pháp và trỏ tới Codex đã kiểm tra.' : 'Launcher thiếu, sai cú pháp hoặc không còn trỏ đúng Codex. Cần cấu hình lại.' }
    for (const c of i.components) {
      if (c.compatible && ['git', 'node'].includes(c.id)) c.status = 'ready'
      if (c.id === 'chatgpt' && c.installed) c.status = 'awaiting_login'
      if (c.id === 'codex' && c.installed) {
        const auth = await powershell(`$ErrorActionPreference='Continue'; & ${psQuote(c.path!)} login status 2>&1 | ForEach-Object { $_.ToString() }; exit $LASTEXITCODE`, { env: this.env(i), signal })
        if (auth.code !== 0 || !/chatgpt/i.test(auth.output)) { c.status = 'awaiting_login'; c.detail = 'Cần đăng nhập ChatGPT bằng nút Đăng nhập Codex.'; continue }
        const work = join(this.root, 'verification'); await mkdir(work, { recursive: true })
        const last = join(work, `result-${Date.now()}.txt`)
        const result = await powershell(`& ${psQuote(c.path!)} exec --skip-git-repo-check --sandbox read-only --ephemeral --output-last-message ${psQuote(last)} ${psQuote('Do not use tools or read files. Reply exactly EASYAI_OK.')}; exit $LASTEXITCODE`, { env: this.env(i), cwd: work, signal, timeout: 120000 })
        const answer = result.code === 0 && existsSync(last) ? (await readFile(last, 'utf8')).trim() : ''
        c.status = answer === 'EASYAI_OK' ? 'ready' : 'installed'
        c.detail = answer === 'EASYAI_OK' ? 'Đã đăng nhập ChatGPT và chạy yêu cầu thử thành công.' : `Yêu cầu thử chưa đạt: ${result.output.slice(-3000)}`
      }
    }
    return i
  }
  async open(target: 'codex' | 'chatgpt' | 'login', i: Inspection): Promise<void> {
    if (target === 'chatgpt') {
      const family = i.components.find(c => c.id === 'chatgpt')?.path
      if (!family) throw new Error('ChatGPT Desktop chưa được cài.')
      const r = await powershell(`$a=Get-StartApps | Where-Object {$_.AppID -like ${psQuote(family + '*')}} | Select-Object -First 1; if(!$a){throw 'Không tìm được ứng dụng ChatGPT'}; Start-Process explorer.exe -ArgumentList ('shell:AppsFolder\\'+$a.AppID) -WindowStyle Hidden`)
      if (r.code !== 0) throw new Error(r.output)
    } else {
      const launcher = join(this.root, 'launch-codex.ps1')
      if (!existsSync(launcher)) throw new Error('Chưa cấu hình launcher. Chọn Cấu hình công cụ trước.')
      // Explicit user action opens an interactive login/tool window.
      const args = `-NoProfile -NoExit -ExecutionPolicy RemoteSigned -File "${launcher}"${target === 'login' ? ' login --device-auth' : ''}`
      const r = await powershell(`Start-Process powershell.exe -ArgumentList ${psQuote(args)}`)
      if (r.code !== 0) throw new Error(r.output)
    }
  }
}

export class DemoPlatform implements Platform {
  private installed = new Set<ComponentId>()
  private configured = false
  constructor(private scenario = 'success') { if (['ready', 'repair', 'network', 'store', 'login'].includes(scenario)) { this.installed.add('git'); this.installed.add('node') } }
  async inspect(): Promise<Inspection> {
    return { windows: 'Windows 11 Pro (mô phỏng)', supported: true, admin: this.scenario !== 'no-admin', elevated: false,
      checkedAt: new Date().toISOString(), proxy: { enabled: true, server: 'proxy.example:8080', bypass: '<local>;localhost' },
      components: (['git', 'node', 'codex', 'chatgpt'] as const).map(id => ({ id, name: { git: 'Git', node: 'Node.js', codex: 'Codex CLI', chatgpt: 'ChatGPT Desktop' }[id], installed: this.installed.has(id), compatible: this.installed.has(id), status: this.installed.has(id) ? 'installed' : 'missing', version: this.installed.has(id) ? { git: '2.50.0', node: 'v22.18.0', codex: '0.143.0', chatgpt: '1.0.0' }[id] : undefined })),
      network: targets.map(t => ({ ...t, reachable: !(this.scenario === 'network' && t.required), status: this.scenario === 'network' && t.required ? undefined : 200, error: this.scenario === 'network' && t.required ? 'CONNECT timed out (mô phỏng)' : undefined })) }
  }
  async install(id: ComponentId, _i: Inspection, signal: AbortSignal) { await new Promise(r => setTimeout(r, 200)); if (signal.aborted) throw new Error('Đã hủy'); if (this.scenario === 'store' && id === 'chatgpt') throw new Error('STORE-001: Microsoft Store bị chặn (mô phỏng).'); this.installed.add(id); return `${id}: hoàn tất mô phỏng, không thay đổi máy.` }
  async configure() { this.configured = true; return 'Đã mô phỏng cấu hình và sao lưu launcher.' }
  async readConfig() { return '# Cấu hình mô phỏng, không đọc file thật' }
  async resetProvider() { return 'Đã mô phỏng sửa lựa chọn provider và tạo bản sao lưu.' }
  async reinstallCodex(i: Inspection, signal: AbortSignal) { return this.install('codex', i, signal) }
  async verify() { const i = await this.inspect(); i.configuration = { valid: this.configured, detail: 'Mô phỏng kiểm tra launcher.' }; i.components.forEach(c => { if (c.installed) c.status = ['codex', 'chatgpt'].includes(c.id) && this.scenario === 'login' ? 'awaiting_login' : 'ready' }); return i }
  async open() {}
}
