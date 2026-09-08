import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
test.beforeAll(async () => {
  const response = await fetch('http://127.0.0.1:20128/v1/models', { signal: AbortSignal.timeout(5000) })
  expect(response.ok, 'API local phải hoạt động trước khi chạy live test').toBe(true)
})
test('real Pi reads GUIDE first and performs only the approved fixture workflow', async ({}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'easyai-guide-live-'))
  const app = await electron.launch({ args: [resolve('out/main/index.js'), '--demo-live-ai'], env: { ...process.env, EASYAI_DATA_DIR: root } })
  const context = app.context(); await context.tracing.start({ screenshots: true, snapshots: true })
  try {
    const page = await app.firstWindow(); await page.getByLabel('Chọn hướng dẫn').selectOption('workspace-note')
    await page.getByRole('button', { name: 'Cài đặt công cụ' }).click()
    await expect(page.getByRole('button', { name: 'Xác nhận và thực hiện' })).toBeVisible({ timeout: 90000 })
    await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
    await expect(page.getByText('Công việc đã sẵn sàng')).toBeVisible({ timeout: 90000 })
    const run = (await page.evaluate(() => window.guide.list()))[0]
    const trace = await page.evaluate(id => window.guide.trace(id), run.id)
    expect(trace.filter(e => e.kind === 'ai.input').length).toBeGreaterThan(2)
    expect(trace.filter(e => e.kind === 'ai.output').length).toBeGreaterThan(2)
    expect(trace.some(e => e.kind === 'pi.tool_execution_start')).toBe(true)
    const queries = trace.filter(e => e.kind === 'tool.input').map(e => e.payload)
    expect(JSON.stringify(queries)).not.toMatch(/git\.exe|node\.exe/)
    await page.screenshot({ path: info.outputPath('live-ready.png') })
  } finally { await context.tracing.stop({ path: info.outputPath('trace.zip') }); await app.close() }
})
