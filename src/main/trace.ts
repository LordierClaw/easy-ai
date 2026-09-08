import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clean, redact } from '../shared/redact'
import type { TraceEvent } from '../shared/guide'
export class Trace {
  private sequences = new Map<string, number>()
  private active = new Set<string>()
  private failed = new Set<string>()
  constructor(private root: string, private index: (e: TraceEvent) => void, private warning: (id: string, message: string) => void, private removeIndex: (id: string) => void = () => {}, private maxBytes = 200 * 1024 * 1024, private days = 14) { mkdirSync(root, { recursive: true }) }
  private folder(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Trace session ID không hợp lệ'); return join(this.root, id) }
  start(id: string) { this.active.add(id); this.prune() }
  end(id: string) { this.active.delete(id); this.prune() }
  record(runId: string, kind: string, summary: string, payload?: unknown, ids: Partial<Pick<TraceEvent, 'turnId' | 'requestId' | 'toolCallId'>> = {}) {
    try {
      const dir = this.folder(runId); mkdirSync(dir, { recursive: true })
      const sequence = (this.sequences.get(runId) ?? this.list(runId).at(-1)?.sequence ?? 0) + 1; this.sequences.set(runId, sequence)
      const event: TraceEvent = { sequence, runId, ...ids, at: new Date().toISOString(), kind, summary: redact(summary) }
      if (payload !== undefined) {
        const serialized = JSON.stringify(clean(payload))
        if (this.usedBytes() + Buffer.byteLength(serialized) + 2048 > this.maxBytes) {
          event.payload = { truncated: true, reason: 'storage_budget', originalCharacters: serialized.length }
          this.warning(runId, 'Trace đã đạt giới hạn dung lượng; payload tiếp theo được lược bỏ.')
        } else if (serialized.length > 2 * 1024 * 1024) {
          event.payload = { truncated: true, originalCharacters: serialized.length, preview: serialized.slice(0, 32000) }
          this.warning(runId, 'Một payload trace vượt 2 MB và đã được rút gọn.')
        } else { event.payloadFile = `${sequence}.json`; writeFileSync(join(dir, event.payloadFile), serialized) }
      }
      const line = JSON.stringify(event) + '\n'
      if (this.usedBytes() + Buffer.byteLength(line) > this.maxBytes) { this.warning(runId, 'Trace hết dung lượng; một số sự kiện không được lưu.'); return }
      appendFileSync(join(dir, 'events.jsonl'), line); this.index(event)
      this.prune()
    } catch (e) {
      if (!this.failed.has(runId)) { this.failed.add(runId); this.warning(runId, `Không ghi được trace: ${redact((e as Error).message)}`) }
    }
  }
  list(id: string): TraceEvent[] {
    const file = join(this.folder(id), 'events.jsonl')
    if (!existsSync(file)) return []
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
  }
  payloads(id: string): TraceEvent[] { return this.list(id).map(e => {
    if (!e.payloadFile || !/^\d+\.json$/.test(e.payloadFile)) return e
    try { return { ...e, payload: JSON.parse(readFileSync(join(this.folder(id), e.payloadFile), 'utf8')) } } catch { return { ...e, payload: { missing: true } } }
  }) }
  private usedBytes() { return readdirSync(this.root, { withFileTypes: true }).filter(d => d.isDirectory() && /^[a-f0-9-]{36}$/.test(d.name)).reduce((n, d) => n + readdirSync(this.folder(d.name)).reduce((m, f) => m + statSync(join(this.folder(d.name), f)).size, 0), 0) }
  private prune() {
    const dirs = readdirSync(this.root, { withFileTypes: true }).filter(d => d.isDirectory() && /^[a-f0-9-]{36}$/.test(d.name)).map(d => {
      const dir = this.folder(d.name); const files = readdirSync(dir).map(f => statSync(join(dir, f)))
      return { id: d.name, size: files.reduce((n, f) => n + f.size, 0), updated: Math.max(0, ...files.map(f => f.mtimeMs)) }
    }).sort((a, b) => a.updated - b.updated)
    let total = dirs.reduce((n, d) => n + d.size, 0)
    for (const dir of dirs) if (!this.active.has(dir.id) && (total > this.maxBytes || Date.now() - dir.updated > this.days * 86400000)) {
      rmSync(this.folder(dir.id), { recursive: true }); this.removeIndex(dir.id); total -= dir.size
    }
    if (total > this.maxBytes) for (const id of this.active) this.warning(id, 'Trace phiên đang chạy vượt ngân sách lưu trữ; sẽ dọn khi phiên kết thúc.')
  }
}
