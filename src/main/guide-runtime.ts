import { utilityProcess, type UtilityProcess } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { clean, redact } from '../shared/redact'
export interface RuntimeInput {
  system: string; prompt: string; signal: AbortSignal; text(delta: string): void;
  event(kind: string, payload: unknown): void;
  request(name: string, payload: unknown, toolCallId?: string): Promise<unknown>;
}
export interface GuideRuntime { run(input: RuntimeInput): Promise<void>; dispose(): void }
export class GuidePiRuntime implements GuideRuntime {
  private worker?: UtilityProcess
  constructor(private root: string) {}
  async run(input: RuntimeInput) {
    await mkdir(this.root, { recursive: true })
    return new Promise<void>((resolve, reject) => {
      const env: NodeJS.ProcessEnv = { ...process.env, NO_PROXY: 'localhost,127.0.0.1,::1', no_proxy: 'localhost,127.0.0.1,::1' }
      for (const name of Object.keys(env)) if (/^(OPENAI_|ANTHROPIC_|PI_|https?_proxy$|all_proxy$)/i.test(name)) delete env[name]
      const worker = utilityProcess.fork(join(import.meta.dirname, 'agent.js'), [], { cwd: this.root, env, stdio: 'pipe', serviceName: 'EasyAI Agent' }); this.worker = worker
      worker.stdout?.resume(); worker.stderr?.resume()
      let settled = false; let count = 0
      const finish = (error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timer); input.signal.removeEventListener('abort', abort)
        worker.kill(); if (this.worker === worker) this.worker = undefined
        error ? reject(error) : resolve()
      }
      const abort = () => { worker.postMessage({ type: 'abort' }); finish(new Error('Đã hủy phiên AI.')) }
      const timer = setTimeout(() => finish(new Error('Phiên AI vượt 30 phút.')), 1800000)
      input.signal.addEventListener('abort', abort, { once: true })
      worker.on('message', async m => {
        if (settled) return
        if (m.type === 'delta') input.text(String(m.text))
        else if (m.type === 'event') input.event(m.kind, clean(m.payload))
        else if (m.type === 'done') finish()
        else if (m.type === 'error') finish(new Error(redact(m.error)))
        else if (m.type === 'request') {
          try {
            if (++count > 150) throw new Error('Vượt giới hạn 150 tương tác AI trong một lượt.')
            const result = await input.request(m.name, clean(m.payload), m.toolCallId)
            if (!settled) worker.postMessage({ type: 'result', id: m.id, result: clean(result) })
          } catch (e) { if (!settled) worker.postMessage({ type: 'result', id: m.id, error: redact((e as Error).message) }) }
        }
      })
      worker.once('exit', code => { if (!settled) finish(new Error(`Pi dừng bất thường (${code}).`)) })
      worker.once('spawn', () => { if (settled) worker.kill(); else if (input.signal.aborted) abort(); else worker.postMessage({ type: 'start', system: input.system, prompt: input.prompt, cwd: this.root }) })
    })
  }
  dispose() { this.worker?.kill(); this.worker = undefined }
}
