import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { redact } from '../shared/redact'
export interface RuntimeAdapter {
  run(system: string, prompt: string, onText: (text: string) => void, onTool: (params: unknown) => Promise<unknown>, signal: AbortSignal): Promise<void>
  dispose(): void
}
export class PiRuntime implements RuntimeAdapter {
  private worker?: UtilityProcess
  constructor(private cwd: string) {}
  async run(system: string, prompt: string, onText: (text: string) => void, onTool: (params: unknown) => Promise<unknown>, signal: AbortSignal): Promise<void> {
    await mkdir(this.cwd, { recursive: true })
    return new Promise((resolve, reject) => {
      // Do not inherit user-specified model credentials, Pi config or proxy for the loopback endpoint.
      const env: NodeJS.ProcessEnv = { ...process.env, NO_PROXY: 'localhost,127.0.0.1,::1', no_proxy: 'localhost,127.0.0.1,::1' }
      for (const k of Object.keys(env)) if (/^(ANTHROPIC_|OPENAI_|PI_|HTTP_PROXY$|HTTPS_PROXY$|http_proxy$|https_proxy$)/.test(k)) delete env[k]
      const worker = utilityProcess.fork(join(import.meta.dirname, 'agent.js'), [], { cwd: this.cwd, env, stdio: 'pipe', serviceName: 'EasyAI Agent' })
      this.worker = worker
      worker.stdout?.resume(); worker.stderr?.resume()
      let settled = false; let calls = 0
      const finish = (error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort)
        worker.kill(); if (this.worker === worker) this.worker = undefined
        error ? reject(error) : resolve()
      }
      const abort = () => { worker.postMessage({ type: 'abort' }); finish(new Error('Đã hủy tác vụ.')) }
      const timer = setTimeout(() => finish(new Error('AI quá thời gian. Kiểm tra lại trước khi tiếp tục.')), 30 * 60 * 1000)
      signal.addEventListener('abort', abort, { once: true })
      worker.on('message', async m => {
        if (settled) return
        if (m.type === 'delta') onText(m.text)
        else if (m.type === 'done') finish()
        else if (m.type === 'error') finish(new Error(m.error))
        else if (m.type === 'tool') {
          try {
            if (++calls > 24) { finish(new Error('Đã đạt giới hạn thao tác trong phiên AI. Cần kiểm tra lại.')); return }
            if (m.name !== 'easyai') throw new Error('Tool không được hỗ trợ')
            const result = await onTool(m.params)
            if (!settled) worker.postMessage({ type: 'result', id: m.id, result })
          } catch (error) { if (!settled) worker.postMessage({ type: 'result', id: m.id, error: redact((error as Error).message) }) }
        }
      })
      worker.once('exit', code => { if (!settled) finish(new Error(`Agent dừng bất thường (${code}).`)) })
      worker.once('spawn', () => { if (settled) { worker.kill(); return }; if (signal.aborted) abort(); else worker.postMessage({ type: 'start', cwd: this.cwd, system, prompt }) })
    })
  }
  dispose() { this.worker?.kill(); this.worker = undefined }
}
