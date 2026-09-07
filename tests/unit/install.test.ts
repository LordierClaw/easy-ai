import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const mocks = vi.hoisted(() => ({ powershell: vi.fn() }))
vi.mock('../../src/main/process', async importOriginal => ({ ...await importOriginal<typeof import('../../src/main/process')>(), powershell: mocks.powershell }))
import { WindowsPlatform, DemoPlatform } from '../../src/main/windows'
beforeEach(() => mocks.powershell.mockReset().mockResolvedValue({ code: 0, output: 'done', stdout: 'done', stderr: '' }))
describe('Windows installer adapter policy and network', () => {
  it('rejects dependency installs for a non-admin account before spawning a process', async () => {
    const platform = new WindowsPlatform(await mkdtemp(join(tmpdir(), 'easyai-install-')), fetch)
    const inspection = await new DemoPlatform('no-admin').inspect()
    await expect(platform.install('git', inspection, new AbortController().signal)).rejects.toThrow('IT-001')
    expect(mocks.powershell).not.toHaveBeenCalled()
  })
  it('passes Windows proxy explicitly to winget and holds an installer lock', async () => {
    const platform = new WindowsPlatform(await mkdtemp(join(tmpdir(), 'easyai-install-')), fetch)
    const inspection = await new DemoPlatform().inspect()
    await platform.install('git', inspection, new AbortController().signal)
    const [script, options] = mocks.powershell.mock.calls[0]
    expect(script).toContain("--proxy 'http://proxy.example:8080'")
    expect(script).toContain('installer.lock'); expect(script).toContain('finally { $guard.Dispose() }')
    expect(script).not.toContain('ignore-security-hash'); expect(options.installer).toBe(true)
  })
  it('installs Codex into a separate npm prefix and converts failing exit codes to failures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'easyai-npm-')); const platform = new WindowsPlatform(root, fetch)
    const inspection = await new DemoPlatform('ready').inspect()
    mocks.powershell.mockResolvedValue({ code: 1, output: 'network failure', stdout: '', stderr: 'network failure' })
    await expect(platform.install('codex', inspection, new AbortController().signal)).rejects.toThrow('exit 1')
    const [script, options] = mocks.powershell.mock.calls[0]
    expect(script).toContain(join(root, 'tools', 'codex')); expect(script).toContain('--registry https://registry.npmjs.org')
    expect(options.env.HTTPS_PROXY).toBe('http://proxy.example:8080')
  })
})
