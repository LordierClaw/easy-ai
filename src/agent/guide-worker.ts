import { Type } from 'typebox'
import { defineTool } from '@earendil-works/pi-coding-agent'
import { makeSession } from './session'
import { clean, redact } from '../shared/redact'
const port = process.parentPort!
let session: Awaited<ReturnType<typeof makeSession>> | undefined
let sequence = 0
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
function request(name: string, payload: unknown, toolCallId?: string): Promise<any> {
  const id = ++sequence
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); port.postMessage({ type: 'request', id, name, payload: clean(payload), toolCallId }) })
}
const parameters = Type.Object({ operation: Type.Union(['guide_read', 'query', 'propose_plan', 'execute_step', 'verify', 'ask_user', 'request_support', 'finish'].map(v => Type.Literal(v))), payload: Type.Any() })
port.on('message', async event => {
  const m = event.data
  if (m.type === 'result') { const item = pending.get(m.id); pending.delete(m.id); if (m.error) item?.reject(new Error(m.error)); else item?.resolve(m.result); return }
  if (m.type === 'abort') { for (const p of pending.values()) p.reject(new Error('Đã hủy')); pending.clear(); await session?.abort(); return }
  if (m.type !== 'start') return
  let after = Promise.resolve()
  try {
    const tool = defineTool({ name: 'easyai', label: 'EasyAI', description: 'Read the guide first. Query facts, propose an exact plan, execute approved steps, verify evidence, or request user/IT help. Tool contract is in the system prompt.', parameters,
      async execute(id, params) { await after; const result = await request('tool', params, id); return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: {} } } })
    session = await makeSession(m.cwd, m.system, [tool])
    session.agent.onPayload = async payload => { await after; await request('before_ai', payload); return undefined }
    session.subscribe(event => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') port.postMessage({ type: 'delta', text: event.assistantMessageEvent.delta })
      else if (event.type === 'message_end' && event.message.role === 'assistant') { after = after.then(() => request('after_ai', event.message)); void after.catch(() => {}) }
      else if (['agent_start', 'agent_end', 'turn_start', 'turn_end', 'tool_execution_start', 'tool_execution_end'].includes(event.type)) port.postMessage({ type: 'event', kind: event.type, payload: clean(event) })
    })
    await session.prompt(m.prompt); await after
    const last = session.messages.at(-1)
    if (last?.role === 'assistant' && ['error', 'aborted'].includes(last.stopReason)) throw new Error(last.errorMessage || 'AI dừng trước khi hoàn tất.')
    port.postMessage({ type: 'done' })
  } catch (e) { port.postMessage({ type: 'error', error: redact((e as Error).message) }) }
  finally { session?.dispose(); session = undefined }
})
