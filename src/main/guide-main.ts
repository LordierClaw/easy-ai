import { app, BrowserWindow, clipboard, dialog, ipcMain, net, Notification } from 'electron'
import { join, resolve } from 'node:path'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { AI, GITHUB_MANIFEST_URL } from './config'
import { Guides } from './guides'
import { GuideStore } from './guide-store'
import { Trace } from './trace'
import { NativeExecutor, FixtureExecutor } from './executor'
import { GuideEngine } from './guide-engine'
import { GuidePiRuntime } from './guide-runtime'
import { FixtureRuntime } from './fixture-runtime'
import { Notifications } from './notifications'
import { clean, redact } from '../shared/redact'
import type { AgentEvent } from '../shared/guide'
import packageInfo from '../../package.json'
let win: BrowserWindow | undefined; let engine: GuideEngine | undefined; let store: GuideStore | undefined; let closing = false
const liveDemo = process.argv.includes('--demo-live-ai'); const demo = process.argv.includes('--demo') || liveDemo; const sample = demo || process.argv.includes('--sample-content')
app.setName('EasyAI'); app.setAppUserModelId('vn.easyai.desktop')
app.setPath('userData', !app.isPackaged && process.env.EASYAI_DATA_DIR ? resolve(process.env.EASYAI_DATA_DIR) : join(app.getPath('appData'), 'EasyAI', ...(sample ? [demo ? 'demo' : 'sample'] : [])))
const id = z.string().uuid(); const text = z.string().max(100000)
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { win?.show(); win?.focus() })
  app.whenReady().then(async () => {
    const root = app.getPath('userData'); const contentRoot = app.isPackaged ? join(process.resourcesPath, 'content') : resolve('content')
    store = await GuideStore.open(join(root, 'easyai.sqlite'))
    const trace = new Trace(join(root, 'traces'), e => store!.index(e), (id, message) => engine?.warning(id, message), id => store!.removeTraceIndex(id))
    const guides = new Guides({ url: GITHUB_MANIFEST_URL, root: contentRoot, cache: join(root, 'cache'), sample, fetch: net.fetch as typeof fetch })
    const select = (id: string) => { win?.show(); win?.restore(); win?.focus(); win?.webContents.send('guide:event', { type: 'select', runId: id } satisfies AgentEvent) }
    const notifications = new Notifications((title, body) => Notification.isSupported() ? new Notification({ title, body }) : undefined, select, (id, message) => trace.record(id, 'notification', message))
    const scenario = !app.isPackaged ? process.env.EASYAI_SCENARIO || 'success' : 'success'
    engine = new GuideEngine(store, guides, demo ? new FixtureExecutor(scenario) : new NativeExecutor(root, net.fetch as typeof fetch), demo && !liveDemo ? new FixtureRuntime(scenario) : new GuidePiRuntime(join(root, 'agent')), trace, event => { if (event.type === 'run') notifications.update(event.run); if (win && !win.isDestroyed()) win.webContents.send('guide:event', clean(event)) }, undefined, demo)
    win = new BrowserWindow({ width: 1280, height: 880, minWidth: 840, minHeight: 650, backgroundColor: '#f4f5f7', title: 'EasyAI', autoHideMenuBar: true, webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } })
    const handle = (name: string, fn: (...args: any[]) => unknown) => ipcMain.handle(`guide:${name}`, async (event, ...args) => {
      if (event.sender !== win!.webContents || event.senderFrame !== win!.webContents.mainFrame) throw new Error('Nguồn IPC không hợp lệ.')
      try { return clean(await fn(...args)) } catch (e) { throw new Error(redact((e as Error).message)) }
    })
    handle('info', () => ({ version: packageInfo.version, demo, sample }))
    handle('catalog', () => guides.catalog()); handle('list', () => engine!.list())
    handle('start', (guide, action, message, parent) => engine!.start(z.string().regex(/^[a-z0-9-]+$/).parse(guide), z.enum(['install', 'configure', 'repair']).parse(action), text.optional().parse(message), id.optional().parse(parent)))
    handle('approve', value => engine!.approve(id.parse(value))); handle('send', (value, message) => engine!.send(id.parse(value), text.min(1).parse(message)))
    handle('cancel', value => engine!.cancel(id.parse(value))); handle('retry', value => engine!.retry(id.parse(value))); handle('confirm', (value, check) => engine!.confirm(id.parse(value), z.string().parse(check)))
    handle('trace', value => { engine!.get(id.parse(value)); return trace.payloads(value) })
    handle('copy', value => { clipboard.writeText(redact(text.parse(value))) })
    handle('attach', async () => {
      const result = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Văn bản / log', extensions: ['txt', 'md', 'log'] }] })
      if (result.canceled) return null
      if ((await stat(result.filePaths[0])).size > 256000) throw new Error('File log tối đa 256 KB.')
      return redact(await readFile(result.filePaths[0], 'utf8'))
    })
    const supportSchema = z.object({ template: z.string(), recipient: z.string().email(), subject: text.min(1), body: text, instructions: z.array(text).max(20), evidence: z.string().max(1000000), reason: text })
    handle('save-support', (value, draft) => engine!.saveSupport(id.parse(value), supportSchema.parse(draft)))
    handle('export-support', async value => {
      const run = engine!.get(id.parse(value)); if (!run.support) throw new Error('Chưa có bản hỗ trợ.')
      const result = await dialog.showSaveDialog(win!, { defaultPath: `EasyAI-support-${run.id}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] })
      if (result.canceled || !result.filePath) return false
      const s = run.support; await writeFile(result.filePath, redact(`# Hướng dẫn gửi IT\n\n${s.instructions.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nĐến: ${s.recipient}\n\nTiêu đề: ${s.subject}\n\n${s.body}`)); return true
    })
    handle('export', async value => {
      const run = engine!.get(id.parse(value)); const result = await dialog.showSaveDialog(win!, { defaultPath: `EasyAI-diagnostics-${run.id}.json`, filters: [{ name: 'Gói chẩn đoán JSON', extensions: ['json'] }] })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, JSON.stringify(clean({ schemaVersion: 2, appVersion: packageInfo.version, model: AI.model, exportedAt: new Date().toISOString(), run: run.legacy ? store!.raw(run.id) : run, trace: trace.payloads(run.id) }), null, 2)); return true
    })
    handle('connections', async () => {
      const targets = [{ name: 'AI nội bộ', url: AI.baseURL + '/models' }, { name: 'Danh mục GitHub', url: GITHUB_MANIFEST_URL }]
      return Promise.all(targets.map(async t => { try { const r = await net.fetch(t.url, { signal: AbortSignal.timeout(10000) }); return { name: t.name, reachable: r.ok, detail: `HTTP ${r.status}` } } catch (e) { return { name: t.name, reachable: false, detail: redact((e as Error).message) } } }))
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); win.webContents.on('will-navigate', event => event.preventDefault()); win.webContents.session.setPermissionRequestHandler((_wc, _permission, cb) => cb(false))
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL); else await win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }).catch(e => { dialog.showErrorBox('EasyAI chưa thể khởi động', redact(e.message)); app.exit(1) })
}
app.on('window-all-closed', () => app.quit())
app.on('before-quit', event => { if (closing) return; event.preventDefault(); closing = true; void (engine?.shutdown() || Promise.resolve()).finally(() => { store?.close(); app.quit() }) })
