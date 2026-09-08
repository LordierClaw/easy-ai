import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
let app: ElectronApplication
async function launch(scenario = 'success') {
  const root = await mkdtemp(join(tmpdir(), 'easyai-v2-ui-'))
  app = await electron.launch({ args: [resolve('out/main/index.js'), '--demo'], env: { ...process.env, EASYAI_DATA_DIR: root, EASYAI_SCENARIO: scenario } })
  const page = await app.firstWindow(); await expect(page.getByLabel('Chọn hướng dẫn')).toBeVisible(); return page
}
test.afterEach(async () => { await app?.close() })
test('guide-first flow, exact approval, live activity and verified result', async ({}, info) => {
  const page = await launch(); await page.getByLabel('Chọn hướng dẫn').selectOption('workspace-note')
  await page.screenshot({ path: info.outputPath('welcome.png') })
  await page.getByRole('button', { name: 'Cài đặt công cụ' }).click()
  await expect(page.getByRole('button', { name: 'Xác nhận và thực hiện' })).toBeVisible()
  const before = (await page.evaluate(() => window.guide.list()))[0]
  expect(before.activities[1].title).toBe('Đọc GUIDE.md'); expect(before.completedSteps).toEqual([])
  expect(JSON.stringify(before.evidence)).not.toMatch(/git\.exe|node\.exe/)
  await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click()
  await expect(page.getByText('Công việc đã sẵn sàng')).toBeVisible()
  await page.screenshot({ path: info.outputPath('ready.png') })
  await page.getByRole('button', { name: 'Trace', exact: true }).click()
  await expect(page.locator('.g-trace code').filter({ hasText: /^ai.input$/ }).first()).toBeVisible()
  const run = (await page.evaluate(() => window.guide.list()))[0]
  const events = await page.evaluate(id => window.guide.trace(id), run.id)
  expect(events.some(e => e.kind === 'ai.output')).toBe(true); expect(events.some(e => e.kind === 'verification')).toBe(true)
  expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
})
test('IT template has separate editable email fields and evidence', async ({}, info) => {
  const page = await launch('no-admin'); await page.getByLabel('Chọn hướng dẫn').selectOption('setup-codex')
  await page.getByRole('button', { name: 'Cài đặt công cụ' }).click()
  await expect(page.getByText('Chuẩn bị yêu cầu IT')).toBeVisible()
  await expect(page.getByLabel('Người nhận', { exact: true })).toHaveValue('lordierclaw@gmail.com')
  await expect(page.getByLabel('Nội dung email')).not.toHaveValue(/"stdout"|"stderr"/)
  await page.getByLabel('Tiêu đề email').fill('Nhờ IT hỗ trợ cài công cụ')
  await page.getByRole('button', { name: 'Sao chép tiêu đề', exact: true }).click()
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText()); expect(clip).toBe('Nhờ IT hỗ trợ cài công cụ')
  const run = (await page.evaluate(() => window.guide.list()))[0]; expect(run.completedSteps).toHaveLength(0)
  await page.screenshot({ path: info.outputPath('support.png') })
})
test('network barrier selects the network form without asserting an IP block', async () => {
  const page = await launch('network'); await page.getByLabel('Chọn hướng dẫn').selectOption('setup-codex'); await page.getByRole('button', { name: 'Cài đặt công cụ' }).click()
  await expect(page.getByLabel('Tiêu đề email')).toHaveValue(/kết nối/)
  await expect(page.getByLabel('Nội dung email')).toHaveValue(/Chưa đủ bằng chứng/)
})
test('user can answer a question and resume the guide', async () => {
  const page = await launch('question'); await page.getByLabel('Chọn hướng dẫn').selectOption('workspace-note'); await page.getByRole('button', { name: 'Cài đặt công cụ' }).click()
  await expect(page.getByText('Bạn muốn tiếp tục với thư mục mặc định không?')).toBeVisible()
  await page.getByLabel('Nhập yêu cầu').fill('tiếp tục'); await page.getByLabel('Gửi yêu cầu').click()
  await expect(page.getByRole('button', { name: 'Xác nhận và thực hiện' })).toBeVisible()
})
test('cancelling approval never executes a mutation', async () => {
  const page = await launch(); await page.getByLabel('Chọn hướng dẫn').selectOption('workspace-note'); await page.getByRole('button', { name: 'Cài đặt công cụ' }).click()
  await page.getByRole('button', { name: 'Để sau' }).click(); await expect(page.locator('.g-status')).toContainText('Đã hủy')
  expect((await page.evaluate(() => window.guide.list()))[0].completedSteps).toHaveLength(0)
})
test('native export contains redacted input/output and attachments', async () => {
  const page = await launch(); await page.getByLabel('Chọn hướng dẫn').selectOption('workspace-note')
  await page.getByLabel('Nhập yêu cầu').fill('Tạo ghi chú. Token: sk-fixture-super-secret-123456789')
  await page.getByLabel('Gửi yêu cầu').click(); await page.getByRole('button', { name: 'Xác nhận và thực hiện' }).click(); await expect(page.getByText('Công việc đã sẵn sàng')).toBeVisible()
  const target = join(await mkdtemp(join(tmpdir(), 'easyai-export-')), 'diagnostics.json')
  await app.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }) }, target)
  await page.getByRole('button', { name: 'Chẩn đoán', exact: true }).click()
  await expect.poll(async () => { try { return await readFile(target, 'utf8') } catch { return '' } }).toContain('ai.output')
  expect(await readFile(target, 'utf8')).not.toContain('sk-fixture-super-secret-123456789')
})
