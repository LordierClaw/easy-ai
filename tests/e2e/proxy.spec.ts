import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import http from 'node:http'
test('Electron Chromium transport uses an explicit proxy and fails when proxy is removed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'easyai-proxy-'))
  const app = await electron.launch({ args: [resolve('out/main/index.js'), '--demo'], env: { ...process.env, EASYAI_DATA_DIR: dir } })
  const requests: string[] = []
  const proxy = http.createServer((req, res) => { requests.push(req.url || ''); res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('via-proxy') })
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve))
  const port = (proxy.address() as { port: number }).port
  try {
    const result = await app.evaluate(async ({ session }, port) => {
      const isolated = session.fromPartition('easyai-transport-test')
        await isolated.setProxy({ mode: 'fixed_servers', proxyRules: `http=127.0.0.1:${port}` })
        const via = await isolated.fetch('http://fixture.easyai.invalid/check', { signal: AbortSignal.timeout(5000) })
        const text = await via.text()
        await isolated.setProxy({ mode: 'direct' }); await isolated.closeAllConnections()
        let directFailed = false
        try { await isolated.fetch('http://fixture.easyai.invalid/check', { signal: AbortSignal.timeout(5000) }) } catch { directFailed = true }
        return { text, directFailed }
    }, port)
    expect(result.text).toBe('via-proxy'); expect(requests).toContain('http://fixture.easyai.invalid/check'); expect(result.directFailed).toBe(true)
  } finally { proxy.closeAllConnections(); proxy.close(); await app.close() }
})
