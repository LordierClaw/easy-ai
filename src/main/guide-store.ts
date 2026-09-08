import initSqlJs, { type Database } from 'sql.js'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import type { GuideRun, TraceEvent } from '../shared/guide'
import { clean } from '../shared/redact'
const require = createRequire(import.meta.url)
export class GuideStore {
  private constructor(private db: Database, private path: string) {}
  static async open(path: string) {
    const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
    mkdirSync(dirname(path), { recursive: true })
    const db = new SQL.Database(existsSync(path) ? readFileSync(path) : undefined)
    db.run('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, updated TEXT NOT NULL, body TEXT NOT NULL)')
    db.run('CREATE TABLE IF NOT EXISTS trace_index (run_id TEXT, sequence INTEGER, at TEXT, kind TEXT, summary TEXT, PRIMARY KEY(run_id,sequence))')
    const store = new GuideStore(db, path)
    for (const run of store.list()) if (!run.legacy && ['running', 'reading'].includes(run.status)) {
      run.status = 'interrupted'; run.approvedHash = undefined; run.error = 'Phiên bị gián đoạn. AI sẽ kiểm tra hiện trạng trước khi tiếp tục.'
      for (const a of run.activities) if (a.state === 'running') { a.state = 'error'; a.endedAt = new Date().toISOString(); a.detail = 'Bị gián đoạn' }
      store.save(run)
    }
    return store
  }
  private flush() { writeFileSync(this.path + '.tmp', this.db.export()); renameSync(this.path + '.tmp', this.path) }
  list(): GuideRun[] {
    const result = this.db.exec('SELECT body FROM runs ORDER BY updated DESC LIMIT 100')
    return (result[0]?.values || []).map(([body]) => {
      const run = JSON.parse(String(body))
      if (run.schemaVersion === 2) return run
      return { schemaVersion: 2, id: run.id, title: run.title, guideId: 'setup-codex', action: run.action, status: 'interrupted', createdAt: run.createdAt, updatedAt: run.updatedAt, messages: run.messages || [], activities: [], evidence: [], completedSteps: [], checks: [], confirmations: [], guideRead: false, generation: 0, repairRounds: 0, demo: run.demo, legacy: true } satisfies GuideRun
    })
  }
  raw(id: string): unknown { const statement = this.db.prepare('SELECT body FROM runs WHERE id=?'); try { statement.bind([id]); return statement.step() ? JSON.parse(String(statement.getAsObject().body)) : undefined } finally { statement.free() } }
  save(run: GuideRun) { this.db.run('INSERT OR REPLACE INTO runs(id,updated,body) VALUES(?,?,?)', [run.id, run.updatedAt, JSON.stringify(clean(run))]); this.flush() }
  index(event: TraceEvent) { this.db.run('INSERT OR REPLACE INTO trace_index VALUES(?,?,?,?,?)', [event.runId, event.sequence, event.at, event.kind, event.summary]); this.flush() }
  removeTraceIndex(id: string) { this.db.run('DELETE FROM trace_index WHERE run_id=?', [id]); this.flush() }
  close() { this.db.close() }
}
