import { Type } from 'typebox'
import { defineTool } from '@earendil-works/pi-coding-agent'
import { makeSession } from './session'
import { redact } from '../shared/redact'
const port = process.parentPort!
let session: Awaited<ReturnType<typeof makeSession>> | undefined
let sequence = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
function request(name: string, params: unknown): Promise<unknown> {
  const id = ++sequence
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); port.postMessage({ type: 'tool', id, name, params }) })
}
const parameters = Type.Object({
  operation: Type.Union(['inspect', 'install_component', 'configure_proxy', 'reset_codex_provider', 'reinstall_codex', 'read_config', 'verify', 'ask_user', 'request_support'].map(v => Type.Literal(v))),
  component: Type.Optional(Type.Union(['git', 'node', 'codex', 'chatgpt'].map(v => Type.Literal(v)))),
  message: Type.Optional(Type.String())
})
port.on('message', async event => {
  const m = event.data
  if (m.type === 'result') { const item = pending.get(m.id); pending.delete(m.id); if (m.error) item?.reject(new Error(m.error)); else item?.resolve(m.result); return }
  if (m.type === 'abort') { for (const item of pending.values()) item.reject(new Error('Đã hủy')); pending.clear(); await session?.abort(); return }
  if (m.type !== 'start') return
  try {
    const tool = defineTool({ name: 'easyai', label: 'Công cụ EasyAI', description: 'Thực hiện thao tác đã được duyệt hoặc đọc bằng chứng. Chỉ dùng các operation được liệt kê; không có shell tùy ý.', parameters,
      async execute(_id, params) { const result = await request('easyai', params); return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: {} } } })
    session = await makeSession(m.cwd, m.system, [tool])
    session.subscribe(event => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') port.postMessage({ type: 'delta', text: event.assistantMessageEvent.delta })
    })
    await session.prompt(m.prompt)
    const last = session.messages.at(-1)
    if (last?.role === 'assistant' && (last.stopReason === 'error' || last.stopReason === 'aborted')) throw new Error(last.errorMessage || 'AI đã dừng mà chưa hoàn thành.')
    port.postMessage({ type: 'done' })
  } catch (error) { port.postMessage({ type: 'error', error: redact((error as Error).message) }) }
  finally { session?.dispose(); session = undefined }
})
