import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
test('real Pi utility process + local AI + Electron UI, simulated Windows mutations', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'easyai-live-'))
  const app = await electron.launch({ args: [resolve('out/main/index.js'), '--demo-live-ai'], env: { ...process.env, EASYAI_DATA_DIR: dir }, timeout: 30000 })
  const context = app.context(); await context.tracing.start({ screenshots: true, snapshots: true })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: /Cài đặt công cụ/ }).click()
    await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
    await expect(page.getByText('Hoàn tất đăng nhập')).toBeVisible({ timeout: 150000 })
    await page.getByRole('button', { name: 'Tôi đã dùng được ChatGPT' }).click()
    await expect(page.getByText('Bộ công cụ của bạn đã sẵn sàng')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect.poll(() => app.evaluate(({ app }) => app.getAppMetrics().some(p => p.name === 'EasyAI Agent'))).toBe(false)
    await page.screenshot({ path: testInfo.outputPath('live-agent-ready.png'), fullPage: true })
  } finally { await context.tracing.stop({ path: testInfo.outputPath('trace.zip') }); await app.close() }
})
test('cancelling real AI leaves no idle agent process and the UI can start another session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'easyai-cancel-ai-'))
  const app = await electron.launch({ args: [resolve('out/main/index.js'), '--demo-live-ai'], env: { ...process.env, EASYAI_DATA_DIR: dir } })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: /Cài đặt công cụ/ }).click()
    await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
    await page.getByRole('button', { name: 'Dừng tác vụ' }).click()
    await expect(page.locator('.run-title')).toContainText('Bị gián đoạn')
    await expect.poll(() => app.evaluate(({ app }) => app.getAppMetrics().some(p => p.name === 'EasyAI Agent'))).toBe(false)
    await page.getByRole('button', { name: 'Cuộc trò chuyện mới' }).click()
    await expect(page.getByText('Công cụ sẵn sàng.')).toBeVisible()
  } finally { await app.close() }
})
