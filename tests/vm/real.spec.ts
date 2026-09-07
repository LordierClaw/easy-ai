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
  const app = await electron.launch({ args: [resolve('out/main/index.js'), '--sample-content'],
    env: { ...process.env, EASYAI_DATA_DIR: resolve('.local/vm-real') }, timeout: 30000 })
  const context = app.context(); await context.tracing.start({ screenshots: true, snapshots: true })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: /Cài đặt công cụ/ }).click()
    if (expected !== 'install') {
      await expect(page.getByText('Cần đội ngũ IT hỗ trợ')).toBeVisible({ timeout: 90000 })
      const runs = await page.evaluate(() => window.easy.list())
      expect(runs[0].support?.code).toBe(expected === 'standard-missing' ? 'IT-001' : 'NET-001')
      expect(runs[0].progress.some(p => p.title.startsWith('Cài đặt'))).toBe(false)
    } else {
      await expect(page.getByRole('button', { name: 'Xác nhận và thực hiện' })).toBeVisible({ timeout: 90000 })
      await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
      // A human handles UAC and authenticates with the official login windows.
      await expect(page.getByText('Hoàn tất đăng nhập')).toBeVisible({ timeout: 25 * 60 * 1000 })
      await page.getByRole('button', { name: 'Đăng nhập Codex' }).click()
      await page.getByRole('button', { name: 'Mở ChatGPT', exact: false }).click()
      console.log('Hoàn tất đăng nhập trên guest, bấm Tôi đã dùng được ChatGPT và Kiểm tra sau đăng nhập trong EasyAI.')
      await expect(page.getByText('Bộ công cụ của bạn đã sẵn sàng')).toBeVisible({ timeout: 8 * 60 * 1000 })
      const runs = await page.evaluate(() => window.easy.list())
      expect(runs[0].inspection?.components.every(c => c.status === 'ready')).toBe(true)
      expect(runs[0].chatgptConfirmed).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true })
    await writeFile(testInfo.outputPath('runs.json'), JSON.stringify(await page.evaluate(() => window.easy.list()), null, 2))
  } finally { await context.tracing.stop({ path: testInfo.outputPath('trace.zip') }); await app.close() }
})
