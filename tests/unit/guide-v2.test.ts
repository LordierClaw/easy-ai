import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile, utimes, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Guides, localGuides, digest, parseGuide, safeRelative, validateCatalog, type Catalog } from '../../src/main/guides'
import { GuideEngine } from '../../src/main/guide-engine'
import { FixtureExecutor, NativeExecutor } from '../../src/main/executor'
import { FixtureRuntime } from '../../src/main/fixture-runtime'
import type { GuideRuntime, RuntimeInput } from '../../src/main/guide-runtime'
import { Hooks } from '../../src/main/hooks'
import { Trace } from '../../src/main/trace'
import { GuideStore } from '../../src/main/guide-store'
import { Notifications } from '../../src/main/notifications'
import type { GuideRun } from '../../src/shared/guide'
import { proxyEnv, proxyFor } from '../../src/shared/proxy'
import { clean } from '../../src/shared/redact'
async function temp() { return mkdtemp(join(tmpdir(), 'easyai-v2-unit-')) }
async function wait(fn: () => boolean) { const until = Date.now() + 8000; while (!fn()) { if (Date.now() > until) throw new Error('State timeout'); await new Promise(r => setTimeout(r, 15)) } }
async function harness(runtime: GuideRuntime = new FixtureRuntime(), scenario = 'success', hooks = new Hooks()) {
  const root = await temp(); const rows = new Map<string, GuideRun>(); const guides = await localGuides(resolve('content'))
  const executor = new FixtureExecutor(scenario); const warnings: string[] = []
  const trace = new Trace(join(root, 'traces'), () => {}, (_id, message) => warnings.push(message))
  const engine = new GuideEngine({ list: () => [], save: r => rows.set(r.id, structuredClone(r)) }, { load: async id => structuredClone(guides.find(g => g.info.id === id)!), catalog: async () => guides.map(g => g.info) }, executor, runtime, trace, () => {}, hooks, true)
  return { engine, executor, rows, trace, root, warnings }
}
describe('guide bundles', () => {
  it('supports nested resources and rejects traversal or missing entry', async () => {
    const [bundle] = await localGuides(resolve('content'))
    for (const path of ['../x', '/x', 'C:/x', 'a\\b', 'a/%2e%2e/b', 'a//b']) expect(() => safeRelative(path)).toThrow()
    expect(() => parseGuide({}, bundle.info.entry, bundle.info.id, 'x', 'sample')).toThrow('GUIDE')
    expect(Object.keys(bundle.files).some(p => p.includes('/templates/'))).toBe(true)
  })
  it('pins hashes, caches valid bundles and fails on corrupted cache', async () => {
    const root = await temp(); const bundles = await localGuides(resolve('content'))
    const files = Object.assign({}, ...bundles.map(b => b.files))
    const manifest: Catalog = { schemaVersion: 2, revision: 'a'.repeat(40), guides: bundles.map(b => ({ id: b.info.id, entry: b.info.entry, files: Object.entries(b.files).map(([path, body]) => ({ path, sha256: digest(body) })) })) }
    let online = true
    const fetcher = async (url: any) => { if (!online) throw new Error('offline'); const path = String(url).split('/' + manifest.revision + '/')[1]; return new Response(JSON.stringify(manifest), { status: 200, headers: {} }) }
    const transport = async (url: any) => String(url).endsWith('/manifest.json') ? fetcher(url) : online ? new Response(files[String(url).split('/' + manifest.revision + '/')[1]]) : Promise.reject(new Error('offline'))
    const guides = new Guides({ url: 'https://raw.githubusercontent.com/owner/docs/main/content/manifest.json', root: '', cache: root, sample: false, fetch: transport as typeof fetch })
    const first = await guides.load('workspace-note'); expect(first.source).toBe('github')
    online = false; expect((await guides.load('workspace-note')).source).toBe('cache')
    files[bundles[0].info.entry] += 'changed'; expect(() => validateCatalog(manifest, files, 'cache')).toThrow('Hash')
    await writeFile(join(root, 'guides-v2.json'), JSON.stringify({ manifest, files }))
    await expect(guides.load('workspace-note')).rejects.toThrow('offline')
    expect(first.revision).toBe('a'.repeat(40))
  })
})
describe('generic execution boundaries', () => {
  it('enforces GUIDE.md before any query and cannot execute before approval', async () => {
    const errors: string[] = []
    const h = await harness({ dispose() {}, async run(i) {
      for (const operation of ['query', 'execute_step']) try { await i.request('tool', { operation, payload: { id: 'x', title: 'x', query: { operation: 'system_info' } } }) } catch (e) { errors.push((e as Error).message) }
    } })
    const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_input')
    expect(errors).toHaveLength(2); expect(h.executor.calls).toEqual([]); await h.engine.shutdown()
  })
  it('reads guide, confirms a plan and independently verifies real executor evidence', async () => {
    const h = await harness(); const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval')
    expect(h.executor.files.size).toBe(0); await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'ready')
    expect(h.engine.get(run.id).checks[0].passed).toBe(true); expect(JSON.stringify(h.executor.calls)).not.toMatch(/git\.exe|node\.exe/)
    expect(h.trace.payloads(run.id).some(e => e.kind === 'verification')).toBe(true); await h.engine.shutdown()
  })
  it('enforces guide-defined IT rules without a software branch in the engine', async () => {
    const h = await harness(new FixtureRuntime(), 'no-admin'); const run = await h.engine.start('setup-codex', 'install'); await wait(() => h.engine.get(run.id).status === 'needs_it')
    expect(h.engine.get(run.id).support?.recipient).toBe('lordierclaw@gmail.com'); expect(h.executor.files.size).toBe(0); await h.engine.shutdown()
  })
  it('rechecks live policy after approval if the account/dependencies changed', async () => {
    const h = await harness(); const run = await h.engine.start('setup-codex', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval')
    const previous = h.executor.query.bind(h.executor)
    h.executor.query = async q => { const r = await previous(q); if (q.operation === 'system_info') return { ...r, admin: false }; if (q.operation === 'find_executable') return { found: false }; return r }
    await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'needs_it'); expect(h.executor.files.size).toBe(0); await h.engine.shutdown()
  })
  it('caps repeated failed mutations at three before requesting assistance', async () => {
    let turns = 0; const fixture = new FixtureRuntime()
    const h = await harness({ dispose() {}, async run(input) {
      if (++turns === 1) return fixture.run(input)
      await input.request('tool', { operation: 'guide_read', payload: { path: 'GUIDE.md' } })
      for (let i = 0; i < 5; i++) await input.request('tool', { operation: 'execute_step', payload: { id: 'write' } }).catch(() => {})
    } }, 'failure')
    const run = await h.engine.start('workspace-note', 'repair'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval'); await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'needs_it')
    expect(h.executor.calls.filter(q => q.operation === 'write_file')).toHaveLength(3); await h.engine.shutdown()
  })
  it('control hook errors fail closed before tools', async () => {
    const h = await harness(new FixtureRuntime(), 'success', new Hooks([{ name: 'test-deny', points: ['before_tool'], control: true, handle() { throw new Error('guard offline') } }]))
    const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'failed')
    expect(h.executor.calls).toEqual([]); expect(h.trace.payloads(run.id).some(e => e.kind === 'hook' && JSON.stringify(e.payload).includes('deny'))).toBe(true); await h.engine.shutdown()
  })
  it('observer errors do not grant permissions or fail the execution', async () => {
    const hooks = new Hooks([{ name: 'observe', points: ['after_tool'], control: false, handle() { throw new Error('logger') } }])
    expect((await hooks.dispatch({ runId: 'x', point: 'after_tool', payload: {} }, () => {})).kind).toBe('allow')
  })
  it('hook confirmation pauses and grants only the matching request once', async () => {
    const h = await harness(new FixtureRuntime(), 'success', new Hooks([{ name: 'confirm-system', points: ['before_tool'], control: true, handle(c) {
      const value = c.payload as any; return value.operation === 'query' ? { kind: 'confirm', reason: 'Review system query' } : { kind: 'allow' }
    } }]))
    const run = await h.engine.start('workspace-note', 'install'); await wait(() => !!h.engine.get(run.id).hookApproval)
    expect(h.executor.calls).toHaveLength(0); await h.engine.approve(run.id)
    await wait(() => !!h.engine.get(run.id).plan)
    expect(h.executor.calls).toHaveLength(1); expect(h.engine.get(run.id).approvedHash).toBeUndefined(); await h.engine.shutdown()
  })
  it('serializes concurrent execution calls and never duplicates an approved step', async () => {
    const fixture = new FixtureRuntime(); let turns = 0
    const h = await harness({ dispose() {}, async run(input) {
      if (++turns === 1) return fixture.run(input)
      await input.request('tool', { operation: 'guide_read', payload: { path: 'GUIDE.md' } })
      await Promise.all([1, 2].map(() => input.request('tool', { operation: 'execute_step', payload: { id: 'write' } })))
    } })
    const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval'); await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'ready')
    expect(h.executor.calls.filter(q => q.operation === 'write_file')).toHaveLength(1); await h.engine.shutdown()
  })
  it('defers login checks until explicit user confirmation', async () => {
    let turns = 0
    const h = await harness({ dispose() {}, async run(input) {
      await input.request('tool', { operation: 'guide_read', payload: { path: 'GUIDE.md' } })
      if (++turns === 1) await input.request('tool', { operation: 'propose_plan', payload: { summary: 'Manual login then check', steps: [], checks: [
        { id: 'login', title: 'Login', userConfirmation: 'Sign in manually' },
        { id: 'verify', title: 'Check login', afterConfirmation: 'login', query: { operation: 'system_info' }, expect: { field: 'admin', operator: 'equals', value: true } }
      ] } })
    } })
    const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval'); await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'awaiting_login')
    expect(h.executor.calls).toHaveLength(0); await h.engine.confirm(run.id, 'login'); expect(h.engine.get(run.id).status).toBe('ready'); expect(h.executor.calls).toHaveLength(1); await h.engine.shutdown()
  })
  it('captures API failures and builds a readable fallback from the guide template', async () => {
    const h = await harness({ dispose() {}, async run(input) { await input.request('before_ai', { messages: [] }); throw new Error('Local API unavailable') } })
    const run = await h.engine.start('setup-codex', 'install'); await wait(() => h.engine.get(run.id).status === 'failed')
    expect(h.engine.get(run.id).support?.body).toContain('AI chưa hoàn tất đánh giá'); expect(h.executor.calls).toHaveLength(0); await h.engine.shutdown()
  })
  it('nonzero native exit cannot be marked ready by a success message', async () => {
    const h = await harness(new FixtureRuntime(), 'failure'); const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval'); await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'failed')
    expect(h.engine.get(run.id).completedSteps).toEqual([]); await h.engine.shutdown()
  })
  it('rejects a changed approved plan', async () => {
    let calls = 0
    const runtime = new FixtureRuntime()
    const h = await harness({ dispose() {}, async run(i) { if (++calls === 2) {
      await i.request('tool', { operation: 'guide_read', payload: { path: 'GUIDE.md' } })
      await i.request('tool', { operation: 'execute_step', payload: { id: 'not-approved' } })
    } else await runtime.run(i) } })
    const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval'); await h.engine.approve(run.id); await wait(() => h.engine.get(run.id).status === 'failed')
    expect(h.executor.files.size).toBe(0); await h.engine.shutdown()
  })
})
describe('trace and notifications', () => {
  it('redacts all captured payloads and limits active trace payload size', async () => {
    const root = await temp(); const warnings: string[] = []; const id = randomUUID()
    const trace = new Trace(root, () => {}, (_id, message) => warnings.push(message), () => {}, 6000)
    trace.start(id); trace.record(id, 'ai.input', 'request', { token: 'abc', text: 'Bearer super-secret-token', value: 'sk-fixture-super-secret-123456789' })
    const serialized = JSON.stringify(trace.payloads(id)); expect(serialized).not.toContain('super-secret'); expect(serialized).not.toContain('"abc"')
    trace.record(id, 'ai.output', 'large', { text: 'x'.repeat(20000) })
    expect(trace.payloads(id).at(-1)?.payload).toMatchObject({ truncated: true }); expect(warnings.length).toBeGreaterThan(0)
    trace.end(id)
  })
  it('removes expired completed trace and its SQLite index', async () => {
    const root = await temp(); const id = randomUUID(); const removed: string[] = []
    const trace = new Trace(root, () => {}, () => {}, id => removed.push(id))
    trace.record(id, 'event', 'old')
    const old = new Date(Date.now() - 15 * 86400000); await utimes(join(root, id, 'events.jsonl'), old, old)
    trace.start(randomUUID()); expect(removed).toContain(id); expect(await readdir(root)).not.toContain(id)
  })
  it('notifies once per state transition and navigates to the same session', () => {
    const notices: any[] = []; const selected: string[] = []
    const service = new Notifications((title, body) => { const handlers: Record<string, Function> = {}; const n = { title, body, handlers, show() {}, on(name: string, fn: Function) { handlers[name] = fn } }; notices.push(n); return n }, id => selected.push(id), () => {})
    const run = { id: randomUUID(), title: 'Guide test', status: 'running' } as GuideRun
    service.update(run); run.status = 'awaiting_input'; service.update(run); service.update(run); expect(notices).toHaveLength(1); notices[0].handlers.click(); expect(selected).toEqual([run.id]); run.status = 'ready'; service.update(run); expect(notices).toHaveLength(2)
  })
})
describe('native isolated file changes and persistence', () => {
  it('applies fixed proxy protocols/bypass and always excludes loopback', () => {
    const info = { enabled: true, server: 'http=proxy:8080;https=secure:8081', bypass: '*.internal;<local>' }
    expect(proxyFor('https://example.com', info)).toBe('http://secure:8081'); expect(proxyFor('https://app.internal', info)).toBeUndefined(); expect(proxyFor('http://localhost:20128', info)).toBeUndefined()
    const env = proxyEnv(info); expect(env.HTTPS_PROXY).toBe('http://secure:8081'); expect(env.NO_PROXY).toContain('127.0.0.1')
    expect(JSON.stringify(clean({ nested: { token: 'secret-value', password: 'with spaces' } }))).not.toContain('secret-value')
  })
  it('edits TOML root fields with backup while preserving unrelated settings', async () => {
    const root = await temp(); const file = join(root, 'settings.toml'); const original = 'provider="old"\n[project]\nname="keep"\n'
    await writeFile(file, original); const native = new NativeExecutor(root, fetch)
    const result: any = await native.mutate({ operation: 'edit_toml', path: file, remove: ['provider'], set: {} }, new AbortController().signal, () => {})
    expect(await readFile(result.backup, 'utf8')).toBe(original); expect(await readFile(file, 'utf8')).toContain('keep'); expect(await readFile(file, 'utf8')).not.toContain('provider')
    await writeFile(file, '[broken'); await expect(native.mutate({ operation: 'edit_toml', path: file, remove: ['provider'], set: {} }, new AbortController().signal, () => {})).rejects.toThrow(); expect(await readFile(file, 'utf8')).toBe('[broken')
  })
  it('backs up exact old content, verifies new content, and rejects credential files', async () => {
    const root = await temp(); const file = join(root, 'settings.txt'); await writeFile(file, 'old')
    const native = new NativeExecutor(root, fetch); const result: any = await native.mutate({ operation: 'write_file', path: file, content: 'new' }, new AbortController().signal, () => {})
    expect(await readFile(result.backup, 'utf8')).toBe('old'); expect(await native.query({ operation: 'read_file', path: file }, new AbortController().signal)).toMatchObject({ content: 'new' })
    await expect(native.query({ operation: 'read_file', path: join(root, '.codex', 'auth.json') }, new AbortController().signal)).rejects.toThrow('xác thực')
  })
  it('restores an active run as interrupted and preserves old history read-only', async () => {
    const h = await harness(); const run = await h.engine.start('workspace-note', 'install'); await wait(() => h.engine.get(run.id).status === 'awaiting_approval'); await h.engine.shutdown()
    const path = join(await temp(), 'runs.sqlite'); const store = await GuideStore.open(path)
    store.save({ ...h.engine.get(run.id), status: 'running', approvedHash: 'test' }); store.close()
    const restored = await GuideStore.open(path); expect(restored.list()[0].status).toBe('interrupted'); expect(restored.list()[0].approvedHash).toBeUndefined(); restored.close()
  })
  it('preserves original v1 data for export while exposing a read-only history entry', async () => {
    const path = join(await temp(), 'legacy.sqlite'); const store = await GuideStore.open(path)
    const legacy = { id: randomUUID(), title: 'Phiên cũ', updatedAt: new Date().toISOString(), messages: [{ id: 'm1', role: 'assistant', text: 'Kết quả cũ' }], components: { historical: 'installed' } }
    store.save(legacy as unknown as GuideRun); store.close()
    const reopened = await GuideStore.open(path)
    expect(reopened.list()[0]).toMatchObject({ legacy: true, messages: legacy.messages })
    expect(reopened.raw(legacy.id)).toEqual(legacy); reopened.close()
  })
  it('blocks new mutations after an installer timeout until its uncertain state is reviewed', async () => {
    const root = await temp(); const native = new NativeExecutor(root, fetch); const signal = new AbortController().signal
    await expect(native.mutate({ operation: 'powershell', script: 'Start-Sleep -Seconds 10', timeout: 1000, installer: true }, signal, () => {})).rejects.toThrow('quá thời gian')
    expect(JSON.parse(await readFile(join(root, 'installer-pending.json'), 'utf8')).state).toBe('awaiting-process-completion')
    await expect(native.mutate({ operation: 'write_file', path: '{workspace}/never.txt', content: 'no' }, signal, () => {})).rejects.toThrow('Installer trước')
  }, 15000)
})
