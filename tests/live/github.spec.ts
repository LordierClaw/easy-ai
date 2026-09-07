import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('published GitHub documents load through Electron and remain available offline', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'easyai-github-'))
  const app = await electron.launch({ args: [resolve('out/main/index.js')], env: { ...process.env, EASYAI_DATA_DIR: dir } })
  try {
    const page = await app.firstWindow()
    await page.evaluate(() => window.easy.start('install', 'Kiểm tra tài liệu; chưa xác nhận thay đổi máy.'))
    await expect.poll(async () => (await page.evaluate(() => window.easy.list()))[0]?.bundle?.source, { timeout: 90000 }).toBe('github')
    const online = (await page.evaluate(() => window.easy.list()))[0]
    expect(online.bundle?.revision).toMatch(/^[a-f0-9]{40}$/)
    await page.evaluate(id => window.easy.cancel(id), online.id)
    await expect.poll(async () => (await page.evaluate(() => window.easy.list()))[0]?.status, { timeout: 30000 }).toMatch(/^(interrupted|cancelled)$/)
    await app.evaluate(({ session }) => session.defaultSession.enableNetworkEmulation({ offline: true }))
    await page.evaluate(() => window.easy.start('install', 'Kiểm tra cache; chưa xác nhận thay đổi máy.'))
    await expect.poll(async () => (await page.evaluate(() => window.easy.list()))[0]?.bundle?.source, { timeout: 90000 }).toBe('cache')
    const cached = (await page.evaluate(() => window.easy.list()))[0]
    expect(cached.bundle?.revision).toBe(online.bundle?.revision)
    expect(cached.bundle?.digest).toBe(online.bundle?.digest)
    await page.evaluate(id => window.easy.cancel(id), cached.id)
  } finally { await app.close() }
})
