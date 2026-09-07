import { makeSession } from '../src/agent/session'
import { defineTool } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { redact } from '../src/shared/redact'
const cwd = resolve('.local/probe'); await mkdir(cwd, { recursive: true })
let called = false; let streamed = false
const session = await makeSession(cwd, 'You are a test assistant. Always call the probe tool first. Then reply EASYAI_OK. Do nothing else.', [defineTool({
  name: 'probe', label: 'Read-only probe', description: 'Return a fixed health check value without accessing files or executing commands.', parameters: Type.Object({}),
  async execute() { called = true; return { content: [{ type: 'text', text: 'EASYAI_OK' }], details: {} } }
})])
session.subscribe(e => { if (e.type === 'message_update' && e.assistantMessageEvent.type === 'text_delta') streamed = true })
const timer = setTimeout(() => void session.abort(), 90000)
try {
  if (JSON.stringify(session.getActiveToolNames()) !== JSON.stringify(['probe'])) throw new Error('Unexpected built-in tools enabled')
  await session.prompt('Run the probe tool, then reply EASYAI_OK.')
  const last = session.messages.at(-1)
  if (last?.role === 'assistant' && last.stopReason === 'error') throw new Error(last.errorMessage)
  console.log(JSON.stringify({ toolCall: called, streaming: streamed, model: 'kr/glm-5' }))
  if (!called || !streamed) process.exitCode = 1
} catch (e) { console.error(redact((e as Error).message)); process.exitCode = 1 }
finally { clearTimeout(timer); session.dispose() }
