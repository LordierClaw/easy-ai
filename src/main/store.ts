import initSqlJs, { type Database } from 'sql.js'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Run } from '../shared/types'
import { clean } from '../shared/redact'
const require = createRequire(import.meta.url)
export class Store {
  private constructor(private db: Database, private file: string) {}
  static async open(file: string): Promise<Store> {
    const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
    mkdirSync(dirname(file), { recursive: true })
    const db = new SQL.Database(existsSync(file) ? readFileSync(file) : undefined)
    db.run('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, updated TEXT NOT NULL, body TEXT NOT NULL)')
    const store = new Store(db, file)
    for (const run of store.list()) {
      if (['running', 'checking', 'awaiting_approval', 'awaiting_input'].includes(run.status)) {
        run.status = 'interrupted'; run.approved = false
        run.error = 'Phiên trước bị gián đoạn. Kiểm tra lại hiện trạng trước khi tiếp tục.'
        run.progress = run.progress.map(p => p.status === 'running' ? { ...p, status: 'error', detail: 'Bị gián đoạn; chưa xác nhận tác vụ đã hoàn tất.' } : p)
        store.save(run)
      }
    }
    return store
  }
  list(): Run[] {
    const stmt = this.db.prepare('SELECT body FROM runs ORDER BY updated DESC LIMIT 100')
    const runs: Run[] = []
    try { while (stmt.step()) runs.push(JSON.parse(stmt.getAsObject().body as string)) } finally { stmt.free() }
    return runs
  }
  save(run: Run): void {
    this.db.run('INSERT OR REPLACE INTO runs(id,updated,body) VALUES (?,?,?)', [run.id, run.updatedAt, JSON.stringify(clean(run))])
    writeFileSync(this.file + '.tmp', this.db.export()); renameSync(this.file + '.tmp', this.file)
  }
  close(): void { this.db.close() }
}
