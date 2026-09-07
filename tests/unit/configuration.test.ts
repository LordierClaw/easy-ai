import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse } from 'smol-toml'
import { CodexConfiguration, resetProviderOverrides } from '../../src/main/configuration'
describe('Targeted Codex configuration repair', () => {
  it('clears provider-selection overrides while preserving unrelated settings and nested provider definitions', () => {
    const result = parse(resetProviderOverrides('model="invalid"\nmodel_provider="custom"\nprofile="old"\napproval_policy="on-request"\n[model_providers.custom]\nbase_url="http://localhost:20128/v1"\n'))
    expect(result.model).toBeUndefined(); expect(result.model_provider).toBeUndefined(); expect(result.profile).toBeUndefined()
    expect(result.approval_policy).toBe('on-request'); expect((result.model_providers as any).custom.base_url).toBe('http://localhost:20128/v1')
  })
  it('backs up exact original bytes before replacing the config and redacts reads', async () => {
    const home = await mkdtemp(join(tmpdir(), 'easyai-config-')); await mkdir(join(home, '.codex'))
    const original = '# Preserve backup comment\nmodel_provider="old"\napi_key="sk-secret123"\n'
    const config = new CodexConfiguration(home, join(home, 'backups')); await writeFile(config.file, original)
    expect(await config.read()).not.toContain('sk-secret123')
    await config.resetProvider()
    const backups = await readdir(join(home, 'backups')); expect(backups).toHaveLength(1)
    expect(await readFile(join(home, 'backups', backups[0]), 'utf8')).toBe(original)
    expect(parse(await readFile(config.file, 'utf8')).model_provider).toBeUndefined()
  })
  it('leaves malformed TOML unchanged and creates no misleading repair backup', async () => {
    const home = await mkdtemp(join(tmpdir(), 'easyai-bad-config-')); await mkdir(join(home, '.codex'))
    const config = new CodexConfiguration(home, join(home, 'backups')); await writeFile(config.file, 'broken = [')
    await expect(config.resetProvider()).rejects.toThrow('sai cú pháp')
    expect(await readFile(config.file, 'utf8')).toBe('broken = [')
  })
})
