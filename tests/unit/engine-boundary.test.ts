import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { Engine } from '../../src/main/engine'
import { parseBundle } from '../../src/main/documents'
import { DemoPlatform } from '../../src/main/windows'
import type { RuntimeAdapter } from '../../src/main/runtime'
import type { Run } from '../../src/shared/types'
async function documents() { const files = Object.fromEntries(await Promise.all(['codex.md', 'policy.md', 'bm01.md'].map(async p => [p, await readFile('content/' + p, 'utf8')]))); return parseBundle(files, 'test', 'sample') }
const wait = async (predicate: () => boolean) => { for (let n = 0; n < 300 && !predicate(); n++) await new Promise(r => setTimeout(r, 10)); expect(predicate()).toBe(true); await new Promise(r => setTimeout(r, 10)) }
function create(platform: DemoPlatform, behavior: RuntimeAdapter['run']) {
  const map = new Map<string, Run>()
  return new Engine({ list: () => [...map.values()], save: r => map.set(r.id, structuredClone(r)) }, { load: documents }, platform, { run: behavior, dispose() {} }, () => {}, true, true)
}
describe('Agent execution boundary', () => {
  it('revalidates a changed admin/dependency state after approval before invoking installation', async () => {
    const platform = new DemoPlatform('ready'); const base = platform.inspect.bind(platform); let count = 0
    vi.spyOn(platform, 'inspect').mockImplementation(async () => { const i = await base(); if (++count >= 2) { i.admin = false; i.components[0].installed = false; i.components[0].compatible = false }; return i })
    const install = vi.spyOn(platform, 'install')
    const engine = create(platform, async (_s, _p, _t, tool) => { await tool({ operation: 'install_component', component: 'codex' }) })
    const r = await engine.start('install'); await wait(() => engine.get(r.id).status === 'awaiting_approval'); await engine.approve(r.id)
    await wait(() => engine.get(r.id).status === 'needs_it'); expect(install).not.toHaveBeenCalled(); expect(engine.get(r.id).support?.code).toBe('IT-001')
  })
  it('requests a new approval when a new component falls outside the approved change scope', async () => {
    const platform = new DemoPlatform('ready'); const base = platform.inspect.bind(platform); let count = 0
    vi.spyOn(platform, 'inspect').mockImplementation(async () => { const i = await base(); if (++count >= 2) { i.components[0].installed = false; i.components[0].compatible = false }; return i })
    const install = vi.spyOn(platform, 'install')
    const engine = create(platform, async (_s, _p, _t, tool) => { await tool({ operation: 'install_component', component: 'git' }) })
    const r = await engine.start('install'); await wait(() => engine.get(r.id).status === 'awaiting_approval'); await engine.approve(r.id)
    await wait(() => engine.get(r.id).status === 'awaiting_approval'); expect(engine.get(r.id).approved).toBe(false); expect(install).not.toHaveBeenCalled()
    expect(engine.get(r.id).approval?.at(-1)).toContain('Phạm vi bổ sung')
  })
  it('serializes parallel tool requests and caps repair changes at three', async () => {
    const platform = new DemoPlatform('ready'); let concurrent = 0; let peak = 0
    const configure = vi.spyOn(platform, 'configure').mockImplementation(async () => { peak = Math.max(peak, ++concurrent); await new Promise(r => setTimeout(r, 20)); concurrent--; return 'configured' })
    const engine = create(platform, async (_s, _p, _t, tool) => { await Promise.allSettled(Array.from({ length: 4 }, () => tool({ operation: 'configure_proxy' }))) })
    const r = await engine.start('repair'); await wait(() => engine.get(r.id).status === 'awaiting_approval'); await engine.approve(r.id)
    await wait(() => engine.get(r.id).status === 'needs_it'); expect(peak).toBe(1); expect(configure).toHaveBeenCalledTimes(3); expect(engine.get(r.id).support?.code).toBe('REPAIR-LIMIT')
  })
  it('does not enable config repair from an install session or after an IT handoff', async () => {
    const platform = new DemoPlatform('ready'); const reset = vi.spyOn(platform, 'resetProvider'); const configure = vi.spyOn(platform, 'configure')
    const engine = create(platform, async (_s, _p, _t, tool) => {
      await expect(tool({ operation: 'reset_codex_provider' })).rejects.toThrow('phạm vi')
      await tool({ operation: 'request_support', message: 'IT cần kiểm tra' })
      await expect(tool({ operation: 'configure_proxy' })).rejects.toThrow('đã dừng')
    })
    const r = await engine.start('install'); await wait(() => engine.get(r.id).status === 'awaiting_approval'); await engine.approve(r.id)
    await wait(() => engine.get(r.id).status === 'needs_it'); expect(reset).not.toHaveBeenCalled(); expect(configure).not.toHaveBeenCalled()
  })
})
