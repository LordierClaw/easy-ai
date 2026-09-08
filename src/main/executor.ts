import { mkdir, readFile, writeFile, copyFile, rename, stat, unlink } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import type { Mutation, Query } from '../shared/guide'
import { powershell, psQuote } from './process'
import { proxyEnv } from '../shared/proxy'
import { clean } from '../shared/redact'
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'
export interface ToolExecutor {
  query(query: Query, signal: AbortSignal): Promise<unknown>
  mutate(change: Mutation, signal: AbortSignal, output: (text: string) => void): Promise<unknown>
}
export class NativeExecutor implements ToolExecutor {
  constructor(private root: string, private fetcher: typeof fetch) {}
  private file(path: string) {
    const result = resolve(path.replaceAll('{workspace}', join(this.root, 'workspace')).replaceAll('{home}', homedir()))
    if (/(^|[\\/])(auth\.json|credentials[^\\/]*|\.ssh|\.aws|\.azure|\.env[^\\/]*|ai-key\.txt)([\\/]|$)/i.test(result)) throw new Error('Không đọc/ghi kho xác thực qua tool file.')
    return result
  }
  private async ps(script: string, signal: AbortSignal) {
    const result = await powershell(script, { signal, timeout: 45000 })
    if (result.code !== 0) throw new Error(result.output || 'Không kiểm tra được Windows.')
    return clean(JSON.parse(result.stdout.trim()))
  }
  async query(query: Query, signal: AbortSignal): Promise<any> {
    switch (query.operation) {
      case 'system_info': return this.ps(`$i=[Security.Principal.WindowsIdentity]::GetCurrent(); $p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction SilentlyContinue; $o=Get-CimInstance Win32_OperatingSystem; $busy=$false; if(Test-Path -LiteralPath ${psQuote(join(this.root, 'installer.lock'))}) { try { $lock=[IO.File]::Open(${psQuote(join(this.root, 'installer.lock'))},'Open','Read','None'); $lock.Dispose() } catch { $busy=$true } }; @{ installationBusy=$busy; installationUncertain=(Test-Path -LiteralPath ${psQuote(join(this.root, 'installer-pending.json'))}); windows=$o.Caption; build=[int]$o.BuildNumber; arch=$o.OSArchitecture; admin=[bool]($i.Groups | Where-Object Value -eq 'S-1-5-32-544'); elevated=([Security.Principal.WindowsPrincipal]::new($i)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); home=${psQuote(homedir())}; workspace=${psQuote(join(this.root, 'workspace'))}; proxy=@{enabled=[bool]$p.ProxyEnable; server=[string]$p.ProxyServer; bypass=[string]$p.ProxyOverride; pac=[string]$p.AutoConfigURL} } | ConvertTo-Json -Depth 4 -Compress`, signal)
      case 'find_executable': return this.ps(`$env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'); $c=Get-Command -Name ${psQuote(query.name)} -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1; $v=if($c){[Diagnostics.FileVersionInfo]::GetVersionInfo($c.Source).ProductVersion}else{''}; @{found=[bool]$c; path=[string]$c.Source; version=[string]$v} | ConvertTo-Json -Compress`, signal)
      case 'find_package': return this.ps(`$p=Get-AppxPackage -Name ${psQuote(query.name)} -ErrorAction SilentlyContinue | Select-Object -First 1; @{found=[bool]$p; version=[string]$p.Version; family=[string]$p.PackageFamilyName} | ConvertTo-Json -Compress`, signal)
      case 'read_registry': {
        if (!/^HK(CU|LM):\\/i.test(query.path) || /password|credential|token|secret|sam\\|security\\/i.test(query.path + query.name)) throw new Error('Đường dẫn registry không được phép.')
        return this.ps(`$v=Get-ItemPropertyValue -LiteralPath ${psQuote(query.path)} -Name ${psQuote(query.name)} -ErrorAction SilentlyContinue; @{value=$v; found=($null -ne $v)} | ConvertTo-Json -Depth 4 -Compress`, signal)
      }
      case 'read_file': {
        const path = this.file(query.path)
        try { const size = (await stat(path)).size; if (size > 1024 * 1024) throw new Error('File vượt 1 MB.'); return clean({ found: true, path, content: await readFile(path, 'utf8') }) }
        catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { found: false, path }; throw e }
      }
      case 'http_probe': {
        const url = new URL(query.url)
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Đích kiểm tra phải là HTTPS hoặc loopback.')
        try { const response = await this.fetcher(url.href, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }); return { reachable: true, status: response.status, url: url.href } }
        catch (e) { if (signal.aborted) throw e; return clean({ reachable: false, url: url.href, error: (e as Error).message }) }
      }
    }
  }
  async mutate(change: Mutation, signal: AbortSignal, output: (text: string) => void): Promise<unknown> {
    if (signal.aborted) throw new Error('Đã hủy')
    await mkdir(join(this.root, 'workspace'), { recursive: true })
    const info = await this.query({ operation: 'system_info' }, signal)
    if (info.installationBusy) throw new Error('Installer từ phiên trước vẫn đang chạy. Chờ hoàn tất rồi kiểm tra lại.')
    if (info.installationUncertain) throw new Error('Installer trước bị gián đoạn hoặc quá thời gian. Cần IT kiểm tra trạng thái thực và xử lý installer-pending.json trong thư mục dữ liệu EasyAI trước khi thay đổi tiếp.')
    if (info.elevated) throw new Error('Mở EasyAI bằng quyền user; chỉ installer cần nâng quyền.')
    if (change.operation === 'write_file' || change.operation === 'download' || change.operation === 'edit_toml') {
      const path = this.file(change.path); await mkdir(dirname(path), { recursive: true })
      let bytes: Buffer
      if (change.operation === 'write_file') bytes = Buffer.from(change.content)
      else if (change.operation === 'edit_toml') {
        if ((await stat(path)).size > 1024 * 1024) throw new Error('TOML vượt 1 MB.')
        const data = parseToml(await readFile(path, 'utf8'))
        for (const key of [...change.remove, ...Object.keys(change.set)]) if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Tên khóa TOML không hợp lệ.')
        for (const key of change.remove) delete data[key]
        for (const [key, value] of Object.entries(change.set)) data[key] = value
        bytes = Buffer.from(stringifyToml(data))
      }
      else {
        const url = new URL(change.url); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Nguồn tải phải dùng HTTPS, không nhúng credential.')
        const response = await this.fetcher(url.href, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) })
        if (!response.ok) throw new Error(`Tải thất bại: HTTP ${response.status}`)
        const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let total = 0
        try { for (;;) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > 512 * 1024 * 1024) throw new Error('File tải vượt 512 MB.'); chunks.push(value); output(`Đã tải ${Math.round(total / 1024)} KB\n`) } } finally { await reader.cancel().catch(() => {}) }
        bytes = Buffer.concat(chunks)
        if (createHash('sha256').update(bytes).digest('hex') !== change.sha256) throw new Error('SHA256 không khớp; không sử dụng file tải.')
      }
      let backup: string | undefined
      try { await stat(path); const folder = join(this.root, 'backups'); await mkdir(folder, { recursive: true }); backup = join(folder, randomUUID() + '.bak'); await copyFile(path, backup) }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
      if (signal.aborted) throw new Error('Đã hủy trước khi ghi file')
      const temporary = path + '.easyai-' + randomUUID(); await writeFile(temporary, bytes); await rename(temporary, path)
      return { code: 0, path, backup, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    }
    if (info.proxy.pac) throw new Error('PAC chưa được hỗ trợ; cần cấu hình proxy cố định do IT cung cấp.')
    const options = { signal, timeout: change.timeout, installer: change.installer, onOutput: output, cwd: join(this.root, 'workspace'), env: { ...process.env, ...proxyEnv(info.proxy) } }
    const body = change.operation === 'process' ? `$ErrorActionPreference='Continue'; & ${psQuote(change.executable)} @(${change.args.map(psQuote).join(',')}); exit $LASTEXITCODE` : change.script
    const script = `$env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'); ${body}`
    if (!change.installer) return powershell(script, options)
    // Exclusive OS handle survives a parent crash while an installer is still executing.
    const guarded = `$guard=[IO.File]::Open(${psQuote(join(this.root, 'installer.lock'))},'OpenOrCreate','ReadWrite','None'); try { ${script} } finally { $guard.Dispose() }`
    const marker = join(this.root, 'installer-pending.json')
    await writeFile(marker, JSON.stringify({ startedAt: new Date().toISOString(), state: 'awaiting-process-completion' }))
    const result = await powershell(guarded, options)
    await unlink(marker)
    return result
  }
}

export class FixtureExecutor implements ToolExecutor {
  readonly calls: (Query | Mutation)[] = []
  readonly files = new Map<string, string>()
  constructor(private scenario = 'success') {}
  async query(q: Query): Promise<any> {
    this.calls.push(q)
    switch (q.operation) {
      case 'system_info': return { windows: 'Windows fixture', build: 19045, admin: this.scenario !== 'no-admin', elevated: false, workspace: 'C:\\EasyAI-Fixture', home: 'C:\\Users\\fixture', proxy: { enabled: false, server: '', bypass: '' } }
      case 'find_executable': return { found: this.scenario !== 'no-admin', path: 'C:\\fixture\\' + q.name, version: '99.0' }
      case 'find_package': return { found: this.scenario !== 'store', version: '99.0', family: q.name }
      case 'read_file': return { found: this.files.has(q.path), content: this.files.get(q.path) }
      case 'read_registry': return { found: true, value: 'fixture' }
      case 'http_probe': return { reachable: this.scenario !== 'network', status: 200 }
    }
  }
  async mutate(change: Mutation, signal: AbortSignal, output: (s: string) => void) {
    this.calls.push(change); output('Thực hiện trên fixture; không thay đổi máy.\n')
    await new Promise(r => setTimeout(r, 150)); if (signal.aborted) throw new Error('Đã hủy')
    if (this.scenario === 'failure') return { code: 1, stderr: 'Fixture failure' }
    if (change.operation === 'write_file') this.files.set(change.path, change.content)
    if (change.operation === 'edit_toml') { const data = parseToml(this.files.get(change.path) || ''); for (const key of change.remove) delete data[key]; Object.assign(data, change.set); this.files.set(change.path, stringifyToml(data)) }
    return { code: 0, stdout: 'EASYAI_OK', backup: 'fixture-backup' }
  }
}
