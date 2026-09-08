import { test, expect, _electron as electron } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
test('real Windows installation or enterprise policy handoff inside an explicitly enabled VMware guest', async ({}, testInfo) => {
  test.skip(process.env.EASYAI_REAL_VM !== '1', 'Requires the dedicated VMware guest; never installs tools on the development host.')
  const model = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_ComputerSystem).Model'], { encoding: 'utf8', windowsHide: true })
  expect(model).toMatch(/VMware/i)
  const expected = process.env.EASYAI_VM_EXPECT || 'install'
  expect(['install', 'standard-missing', 'network-blocked']).toContain(expected)
  const app = await electron.launch({ args: [resolve('out/main/index.js'), ...(process.env.EASYAI_VM_SAMPLE === '1' ? ['--sample-content'] : [])],
    env: { ...process.env, EASYAI_DATA_DIR: resolve('.local/vm-real') }, timeout: 30000 })
  const context = app.context(); await context.tracing.start({ screenshots: true, snapshots: true })
  try {
    const page = await app.firstWindow()
    await page.getByLabel('Chọn hướng dẫn').selectOption('setup-codex')
    await page.getByRole('button', { name: /Cài đặt công cụ/ }).click()
    if (expected !== 'install') {
      await expect(page.getByText('Chuẩn bị yêu cầu IT')).toBeVisible({ timeout: 90000 })
      const runs = await page.evaluate(() => window.guide.list())
      expect(runs[0].support?.template).toContain(expected === 'standard-missing' ? 'request-installation' : 'request-network')
      expect(runs[0].completedSteps).toHaveLength(0)
    } else {
      await expect(page.getByRole('button', { name: 'Xác nhận và thực hiện' })).toBeVisible({ timeout: 90000 })
      await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
      console.log('Hoàn tất UAC, phê duyệt phạm vi bổ sung và đăng nhập thủ công theo hướng dẫn trên UI EasyAI.')
      await expect(page.getByText('Công việc đã sẵn sàng')).toBeVisible({ timeout: 30 * 60 * 1000 })
      const runs = await page.evaluate(() => window.guide.list())
      expect(runs[0].checks.length).toBeGreaterThan(0); expect(runs[0].checks.every(c => c.passed)).toBe(true)
      expect(runs[0].status).toBe('ready')
    }
    await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true })
    await writeFile(testInfo.outputPath('runs.json'), JSON.stringify(await page.evaluate(() => window.guide.list()), null, 2))
  } finally {
    const page = context.pages()[0]
    if (page && !page.isClosed()) {
      await page.screenshot({ path: testInfo.outputPath('last-state.png'), fullPage: true }).catch(() => {})
      await page.evaluate(() => window.guide.list()).then(runs => writeFile(testInfo.outputPath('runs.json'), JSON.stringify(runs, null, 2))).catch(() => {})
    }
    await context.tracing.stop({ path: testInfo.outputPath('trace.zip') }); await app.close()
  }
})
