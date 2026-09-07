import { app, BrowserWindow, clipboard, dialog, ipcMain, net } from 'electron'
import { join, resolve } from 'node:path'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { AI, GITHUB_MANIFEST_URL } from './config'
import { Documents } from './documents'
import { Store } from './store'
import { DemoPlatform, WindowsPlatform, checkNetwork } from './windows'
import { PiRuntime } from './runtime'
import { Engine } from './engine'
import { clean, redact } from '../shared/redact'
import packageInfo from '../../package.json'
let win: BrowserWindow
let engine: Engine
let store: Store
let closing = false
const liveAIInDemo = process.argv.includes('--demo-live-ai')
const demo = process.argv.includes('--demo') || liveAIInDemo
const sample = demo || process.argv.includes('--sample-content')
app.setName('EasyAI')
app.setPath('userData', !app.isPackaged && process.env.EASYAI_DATA_DIR ? resolve(process.env.EASYAI_DATA_DIR) : join(app.getPath('appData'), 'EasyAI', ...(sample ? [demo ? 'demo' : 'sample'] : [])))
const idSchema = z.string().uuid()
const textSchema = z.string().min(1).max(30000)
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { win?.show(); win?.focus() })
  app.whenReady().then(async () => {
    const root = app.getPath('userData')
    const contentDir = app.isPackaged ? join(process.resourcesPath, 'content') : resolve('content')
    store = await Store.open(join(root, 'easyai.sqlite'))
    const docs = new Documents({ url: GITHUB_MANIFEST_URL, cacheDir: join(root, 'cache'), contentDir, sample, fetch: net.fetch as typeof fetch })
    const platform = demo ? new DemoPlatform(!app.isPackaged ? process.env.EASYAI_SCENARIO || 'success' : 'success') : new WindowsPlatform(root, net.fetch as typeof fetch)
    engine = new Engine(store, docs, platform, new PiRuntime(join(root, 'agent')), event => { if (win && !win.isDestroyed()) win.webContents.send('easy:event', clean(event)) }, demo, liveAIInDemo)
    win = new BrowserWindow({ width: 1240, height: 850, minWidth: 820, minHeight: 650, title: 'EasyAI', backgroundColor: '#f8fafc', autoHideMenuBar: true,
      webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } })
    const handle = (name: string, fn: (...args: any[]) => unknown) => ipcMain.handle(`easy:${name}`, async (event, ...args) => {
      if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Nguồn yêu cầu không hợp lệ.')
      try { return clean(await fn(...args)) } catch (e) { throw new Error(redact((e as Error).message)) }
    })
    handle('info', () => ({ version: packageInfo.version, demo, sample, documentsConfigured: !!GITHUB_MANIFEST_URL }))
    handle('list', () => engine.list())
    handle('start', (action, text) => engine.start(z.enum(['install', 'configure', 'repair']).parse(action), z.string().max(30000).optional().parse(text)))
    handle('approve', id => engine.approve(idSchema.parse(id)))
    handle('cancel', id => engine.cancel(idSchema.parse(id)))
    handle('retry', id => engine.retry(idSchema.parse(id)))
    handle('send', (id, text) => engine.send(idSchema.parse(id), textSchema.parse(text)))
    handle('open', (id, target) => engine.open(idSchema.parse(id), z.enum(['codex', 'chatgpt', 'login']).parse(target)))
    handle('confirm-chatgpt', id => engine.confirmChatGPT(idSchema.parse(id)))
    handle('copy', text => { clipboard.writeText(z.string().max(100000).parse(redact(text))); return true })
    handle('attach', async () => {
      const selection = await dialog.showOpenDialog(win, { title: 'Chọn log văn bản', properties: ['openFile'], filters: [{ name: 'Log / văn bản', extensions: ['txt', 'log', 'md'] }] })
      if (selection.canceled) return null
      const file = selection.filePaths[0]
      if ((await stat(file)).size > 256000) throw new Error('Log tối đa 256 KB. Chọn phần lỗi liên quan.')
      return redact((await readFile(file, 'utf8')).slice(0, 26000))
    })
    handle('export', async id => {
      const run = engine.get(idSchema.parse(id))
      const result = await dialog.showSaveDialog(win, { defaultPath: `EasyAI-${run.id}.json`, filters: [{ name: 'Báo cáo chẩn đoán', extensions: ['json'] }] })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, JSON.stringify(clean({ ...run, bundle: run.bundle ? { revision: run.bundle.revision, digest: run.bundle.digest, source: run.bundle.source } : undefined }), null, 2))
      return true
    })
    handle('connections', async () => demo ? (await platform.inspect()).network : checkNetwork(net.fetch as typeof fetch, [{ name: 'AI nội bộ', url: AI.baseURL + '/models', required: false }]))
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', event => event.preventDefault())
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
    else await win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }).catch(error => { dialog.showErrorBox('EasyAI chưa thể khởi động', redact((error as Error).message)); app.exit(1) })
}
app.on('window-all-closed', () => app.quit())
app.on('before-quit', event => {
  if (closing) return
  event.preventDefault(); closing = true
  void engine?.shutdown().finally(() => { store?.close(); app.quit() })
})
