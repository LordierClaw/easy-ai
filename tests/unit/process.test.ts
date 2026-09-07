import { describe, it, expect } from 'vitest'
import { powershell, command } from '../../src/main/process'
describe.skipIf(process.platform !== 'win32')('Native Windows process boundary', () => {
  it('keeps machine-readable stdout independent of stderr/progress', async () => {
    const r = await powershell("[Console]::Error.WriteLine('diagnostic'); Write-Progress -Activity 'test' -Status 'loading'; @{ ok=$true; label='Tiếng Việt' } | ConvertTo-Json -Compress")
    expect(r.code).toBe(0); expect(JSON.parse(r.stdout)).toEqual({ ok: true, label: 'Tiếng Việt' }); expect(r.stderr).toContain('diagnostic')
  })
  it('preserves native exit codes and does not treat stderr alone as failure', async () => {
    const r = await command(process.execPath, ['-e', 'process.stderr.write("status on stderr");process.exit(7)'])
    expect(r.code).toBe(7); expect(r.stderr).toBe('status on stderr'); expect(r.stdout).toBe('')
  })
  it('cancels a process owned by the executor', async () => {
    const abort = new AbortController(); const promise = command(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: abort.signal })
    setTimeout(() => abort.abort(), 100)
    await expect(promise).rejects.toThrow('bị dừng')
  })
  it('redacts a secret emitted across separate output chunks', async () => {
    const r = await command(process.execPath, ['-e', 'process.stdout.write("sk-part");setTimeout(()=>process.stdout.write("two-secret\\n"),80)'])
    expect(r.output).toBe('[REDACTED]\n'); expect(r.stdout).not.toContain('two-secret')
  })
})
