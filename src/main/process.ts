import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { redact } from '../shared/redact'
export interface CommandResult { code: number; output: string; stdout: string; stderr: string }
export function command(exe: string, args: string[], options: { env?: NodeJS.ProcessEnv; cwd?: string; signal?: AbortSignal; timeout?: number; installer?: boolean; onOutput?: (text: string) => void } = {}): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error('Đã hủy tác vụ.'))
    const child = spawn(exe, args, { shell: false, windowsHide: true, cwd: options.cwd, env: options.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; let stdout = ''; let stderr = ''; let stopped = false
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') }
    const lineBuffers = { stdout: '', stderr: '' }
    const collect = (buffer: Buffer, stream: 'stdout' | 'stderr') => {
      const text = decoders[stream].write(buffer)
      output = (output + text).slice(-64000)
      if (stream === 'stdout') stdout = (stdout + text).slice(-64000); else stderr = (stderr + text).slice(-64000)
      lineBuffers[stream] = (lineBuffers[stream] + text).slice(-64000)
      const end = lineBuffers[stream].lastIndexOf('\n')
      if (end >= 0) { options.onOutput?.(redact(lineBuffers[stream].slice(0, end + 1))); lineBuffers[stream] = lineBuffers[stream].slice(end + 1) }
    }
    child.stdout.on('data', buffer => collect(buffer, 'stdout')); child.stderr.on('data', buffer => collect(buffer, 'stderr'))
    const kill = () => {
      stopped = true
      if (child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => child.kill())
    }
    // Installers may own external services; finish the current installer before stopping.
    const abort = () => { if (!options.installer) kill() }
    options.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(kill, options.timeout ?? 60000)
    const cleanup = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort) }
    child.on('error', e => { cleanup(); reject(new Error(redact(e.message))) })
    child.on('close', code => { cleanup(); if (stopped) reject(new Error('Tác vụ bị dừng hoặc quá thời gian; cần kiểm tra lại hiện trạng.')); else resolve({ code: code ?? -1, output: redact(output), stdout: redact(stdout + decoders.stdout.end()), stderr: redact(stderr + decoders.stderr.end()) }) })
  })
}
export const psQuote = (s: string) => `'${s.replaceAll("'", "''")}'`
export function powershell(script: string, options: Parameters<typeof command>[2] = {}) {
  const source = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); $ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ${script}`
  return command('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')], options)
}
