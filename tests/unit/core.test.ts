import { describe, it, expect, vi } from 'vitest'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseBundle, Documents, sha256 } from '../../src/main/documents'
import { evaluatePolicy } from '../../src/shared/policy'
import { proxyEnv, proxyFor } from '../../src/shared/proxy'
import { clean, redact } from '../../src/shared/redact'
import { DemoPlatform } from '../../src/main/windows'
import { Engine } from '../../src/main/engine'
import { Store } from '../../src/main/store'
import type { Run } from '../../src/shared/types'
async function bundle() { const files = Object.fromEntries(await Promise.all(['codex.md', 'policy.md', 'bm01.md'].map(async p => [p, await readFile(join('content', p), 'utf8')]))); return parseBundle(files, 'test-revision', 'sample') }
async function until(test: () => boolean) { for (let i = 0; i < 200 && !test(); i++) await new Promise(r => setTimeout(r, 10)); expect(test()).toBe(true); await new Promise(r => setTimeout(r, 10)) }
function memoryStore() { const data = new Map<string, Run>(); return { list: () => [...data.values()], save: (r: Run) => data.set(r.id, structuredClone(r)) } }
describe('Doanh nghiệp và quyền thực thi', () => {
  it('blocks all mutations without admin and produces actionable BM01', async () => {
    const platform = new DemoPlatform('no-admin'); const install = vi.spyOn(platform, 'install')
    const engine = new Engine(memoryStore(), { load: bundle }, platform, { run: vi.fn(), dispose() {} }, () => {}, true)
    const r = await engine.start('install')
    await until(() => engine.get(r.id).status === 'needs_it')
    await expect(engine.approve(r.id)).rejects.toThrow()
    expect(install).not.toHaveBeenCalled()
    expect(engine.get(r.id).support?.recipient).toBe('lordierclaw@gmail.com')
    expect(engine.get(r.id).support?.body).toContain('không có quyền quản trị')
    expect(engine.get(r.id).support?.body).not.toContain('{{reason}}')
  })
  it('requires approval, forbids concurrent runs and verifies instead of trusting prose', async () => {
    const platform = new DemoPlatform(); const install = vi.spyOn(platform, 'install')
    const engine = new Engine(memoryStore(), { load: bundle }, platform, { run: vi.fn(), dispose() {} }, () => {}, true)
    const r = await engine.start('install')
    await expect(engine.start('repair')).rejects.toThrow()
    await until(() => engine.get(r.id).status === 'awaiting_approval')
    expect(install).not.toHaveBeenCalled()
    await engine.approve(r.id)
    await until(() => engine.get(r.id).status === 'awaiting_login')
    expect(install).toHaveBeenCalledTimes(4)
    await engine.confirmChatGPT(r.id)
    expect(engine.get(r.id).status).toBe('ready')
  })
  it('does not replace existing dependencies and retains partial success on Store failure', async () => {
    const platform = new DemoPlatform('store'); const install = vi.spyOn(platform, 'install')
    const engine = new Engine(memoryStore(), { load: bundle }, platform, { run: vi.fn(), dispose() {} }, () => {}, true)
    const r = await engine.start('install'); await until(() => engine.get(r.id).status === 'awaiting_approval'); await engine.approve(r.id)
    await until(() => engine.get(r.id).status === 'needs_it')
    expect(install.mock.calls.map(a => a[0])).toEqual(['codex', 'chatgpt'])
    expect(engine.get(r.id).inspection?.components.find(c => c.id === 'codex')?.installed).toBe(true)
    expect(engine.get(r.id).support?.code).toBe('STORE-001')
  })
  it('does not start mutations when docs cannot be loaded', async () => {
    const platform = new DemoPlatform(); const install = vi.spyOn(platform, 'install')
    const engine = new Engine(memoryStore(), { load: async () => { throw new Error('Bad hash') } }, platform, { run: vi.fn(), dispose() {} }, () => {}, true)
    const r = await engine.start('install'); await until(() => engine.get(r.id).status === 'failed'); expect(install).not.toHaveBeenCalled()
  })
  it('network transport failure blocks; a server HTTP 403 does not imply an IP block', async () => {
    const b = await bundle(); const p = new DemoPlatform('network'); const i = await p.inspect()
    expect(evaluatePolicy(i, b).code).toBe('NET-001')
    i.network.forEach(n => { n.reachable = true; n.status = 403 }); expect(evaluatePolicy(i, b).kind).toBe('allow')
  })
  it('keeps the pinned document bundle when retrying', async () => {
    const load = vi.fn(bundle); const engine = new Engine(memoryStore(), { load }, new DemoPlatform('no-admin'), { run: vi.fn(), dispose() {} }, () => {}, true)
    const r = await engine.start('install'); await until(() => engine.get(r.id).status === 'needs_it'); await engine.retry(r.id); await until(() => engine.get(r.id).status === 'needs_it')
    expect(load).toHaveBeenCalledTimes(1)
  })
})
describe('Tài liệu và lưu trữ', () => {
  it('rejects missing mandatory structured rules', async () => {
    const b = await bundle(); const files = { 'codex.md': await readFile('content/codex.md', 'utf8'), 'policy.md': (await readFile('content/policy.md', 'utf8')).replace('missing_dependencies_without_admin', 'login_required'), 'bm01.md': b.bm01 }
    expect(() => parseBundle(files, 'bad', 'sample')).toThrow()
  })
  it('fetches documents only from pinned revision and rejects bad hashes', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'easyai-docs-'))
    const revision = 'a'.repeat(40)
    const files = Object.fromEntries(await Promise.all(['codex.md', 'policy.md', 'bm01.md'].map(async p => [p, await readFile(join('content', p), 'utf8')])) )
    const manifest = { schemaVersion: 1, revision, files: Object.keys(files).map(path => ({ path, sha256: sha256(files[path]) })) }
    const fetcher = vi.fn(async (url: any) => new Response(String(url).endsWith('manifest.json') ? JSON.stringify(manifest) : files[String(url).split('/').at(-1)!]))
    const docs = new Documents({ url: 'https://raw.githubusercontent.com/test/repo/main/content/manifest.json', cacheDir, contentDir: 'content', sample: false, fetch: fetcher as typeof fetch })
    const b = await docs.load(); expect(b.revision).toBe(revision); expect(fetcher.mock.calls.slice(1).every(c => String(c[0]).includes(revision))).toBe(true)
    fetcher.mockImplementation(async () => { throw new Error('offline') }); expect((await docs.load()).source).toBe('cache')
    await writeFile(join(cacheDir, 'documents.json'), JSON.stringify({ manifest, files: { ...files, 'codex.md': 'tampered' } }))
    await expect(docs.load()).rejects.toThrow('offline')
  })
  it('persists valid SQLite and revokes approvals after a restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easyai-db-')); const file = join(dir, 'data.sqlite')
    const store = await Store.open(file)
    const r: Run = { id: 'test', title: 'test', action: 'install', status: 'running', createdAt: '1', updatedAt: '1', messages: [{ id: 'm', role: 'user', text: 'sk-testsecret' }], progress: [], approved: true, repairAttempts: 0, demo: true }
    store.save(r); store.close()
    const reopened = await Store.open(file); expect(reopened.list()[0].status).toBe('interrupted'); expect(reopened.list()[0].approved).toBe(false); expect(reopened.list()[0].messages[0].text).toBe('[REDACTED]'); reopened.close()
    expect((await readFile(file)).subarray(0, 15).toString()).toBe('SQLite format 3')
  })
})
describe('Proxy và dữ liệu nhạy cảm', () => {
  const info = { enabled: true, server: 'http=proxy:8080;https=proxy-secure:8443', bypass: '*.corp.local;<local>' }
  it('handles per-protocol Windows proxy and bypass without proxying localhost', () => {
    expect(proxyFor('https://registry.npmjs.org', info)).toBe('http://proxy-secure:8443')
    expect(proxyFor('https://wiki.corp.local', info)).toBeUndefined()
    expect(proxyFor('http://intranet', info)).toBeUndefined()
    expect(proxyFor('http://localhost:20128/v1', info)).toBeUndefined()
    expect(proxyEnv(info).HTTPS_PROXY).toBe('http://proxy-secure:8443')
  })
  it('redacts API keys, tokens, credentials in proxy URLs and preserves undefined IPC results', () => {
    const value = redact('sk-secretvalue Authorization: Bearer abcdef https://bob:secret@proxy:8080 password=secret access_token=abc')
    expect(value).not.toContain('secretvalue'); expect(value).not.toContain('abcdef'); expect(value).not.toContain('bob:secret'); expect(value).not.toContain('=secret'); expect(clean(undefined)).toBeUndefined()
  })
})
