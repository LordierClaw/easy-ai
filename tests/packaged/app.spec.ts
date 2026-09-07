import { test, expect, _electron as electron, chromium, type Browser } from '@playwright/test'
import { spawn, execFile } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve, normalize } from 'node:path'
import { readFileSync } from 'node:fs'
import { extractFile } from '@electron/asar'
test('packaged main/preload/agent code matches the current build', () => {
  const archive = resolve('release/win-unpacked/resources/app.asar')
  for (const file of ['out/main/index.js', 'out/main/agent.js', 'out/preload/index.cjs']) {
    expect(extractFile(archive, normalize(file)).equals(readFileSync(file))).toBe(true)
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
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>(resolve => server.close(() => resolve()))
  // NSIS Portable wraps Electron; its stdout does not forward the Node inspector endpoint.
  const child = spawn(resolve('release/EasyAI-0.1.0-Portable.exe'), ['--demo', `--remote-debugging-port=${port}`], { windowsHide: true, stdio: 'ignore' })
  let browser: Browser | undefined
  try {
    await expect.poll(async () => {
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }); return true } catch { return false }
    }, { timeout: 60000 }).toBe(true)
    const page = browser!.contexts()[0].pages()[0]; await expect(page.getByText('Công cụ sẵn sàng.')).toBeVisible()
    expect(await page.evaluate(() => window.easy.info())).toMatchObject({ version: '0.1.0', demo: true })
    await page.screenshot({ path: testInfo.outputPath('portable.png'), fullPage: true })
  } finally {
    if (browser) {
      const cdp = await browser.newBrowserCDPSession()
      await Promise.race([cdp.send('Browser.close').catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))])
      await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 2000))])
    }
    if (child.pid && child.exitCode === null) await new Promise<void>(resolve => execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve()))
  }
})
