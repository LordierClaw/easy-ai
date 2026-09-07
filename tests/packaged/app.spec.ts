import { test, expect, _electron as electron } from '@playwright/test'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { extractFile } from '@electron/asar'
test('packaged main/preload/agent code matches the current build', () => {
  const archive = resolve('release/win-unpacked/resources/app.asar')
  for (const file of ['out/main/index.js', 'out/main/agent.js', 'out/preload/index.cjs']) {
    expect(extractFile(archive, file).equals(readFileSync(file))).toBe(true)
  }
})
test('packaged executable starts, loads SQLite/WASM and bundled documents, then completes demo', async ({}, testInfo) => {
  const app = await electron.launch({ executablePath: resolve('release/win-unpacked/EasyAI.exe'), args: ['--demo'], timeout: 60000 })
  try {
    const page = await app.firstWindow()
    await expect(page.getByText('Công cụ sẵn sàng.')).toBeVisible()
    expect(await page.evaluate(() => window.easy.info())).toMatchObject({ version: '0.1.0', demo: true })
    await page.getByRole('button', { name: /Cài đặt công cụ/ }).click()
    await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
    await page.getByRole('button', { name: 'Tôi đã dùng được ChatGPT' }).click()
    await expect(page.getByText('Bộ công cụ của bạn đã sẵn sàng')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('packaged-demo.png'), fullPage: true })
  } finally { await app.close() }
})
test('Portable executable extracts and opens the same application', async ({}, testInfo) => {
  const app = await electron.launch({ executablePath: resolve('release/EasyAI-0.1.0-Portable.exe'), args: ['--demo'], timeout: 60000 })
  try {
    const page = await app.firstWindow(); await expect(page.getByText('Công cụ sẵn sàng.')).toBeVisible()
    expect(await page.evaluate(() => window.easy.info())).toMatchObject({ version: '0.1.0', demo: true })
    await page.screenshot({ path: testInfo.outputPath('portable.png'), fullPage: true })
  } finally { await app.close() }
})
