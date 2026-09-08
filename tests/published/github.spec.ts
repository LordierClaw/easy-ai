import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
test('published v2 catalog and pinned guide files load through Electron and survive offline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'easyai-published-'))
  const app = await electron.launch({ args: [resolve('out/main/index.js')], env: { ...process.env, EASYAI_DATA_DIR: root } })
  try {
    const page = await app.firstWindow(); await expect(page.getByLabel('Chọn hướng dẫn')).toBeVisible()
    await expect(page.getByLabel('Chọn hướng dẫn').locator('option')).toHaveCount(2, { timeout: 90000 })
    await page.evaluate(() => window.guide.start('workspace-note', 'configure', 'Chỉ tải guide, chưa duyệt thay đổi.'))
    await expect.poll(async () => (await page.evaluate(() => window.guide.list()))[0]?.bundle?.source, { timeout: 90000 }).toBe('github')
    const first = (await page.evaluate(() => window.guide.list()))[0]
    expect(first.bundle?.revision).toMatch(/^[a-f0-9]{40}$/)
    await page.evaluate(id => window.guide.cancel(id), first.id)
    await expect.poll(async () => (await page.evaluate(() => window.guide.list()))[0]?.status).toMatch(/cancelled|interrupted/)
    await app.evaluate(async ({ session }) => { await session.defaultSession.clearCache(); session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://raw.githubusercontent.com/*'] }, (_d, cb) => cb({ cancel: true })) })
    await page.evaluate(() => window.guide.start('workspace-note', 'configure', 'Chỉ tải cache.'))
    await expect.poll(async () => (await page.evaluate(() => window.guide.list()))[0]?.bundle?.source).toBe('cache')
    const cached = (await page.evaluate(() => window.guide.list()))[0]
    expect(cached.bundle?.revision).toBe(first.bundle?.revision); expect(cached.bundle?.digest).toBe(first.bundle?.digest)
    expect(cached.completedSteps).toHaveLength(0); await page.evaluate(id => window.guide.cancel(id), cached.id)
  } finally { await app.close() }
})
