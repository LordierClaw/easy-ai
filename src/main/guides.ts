import { z } from 'zod'
import matter from 'gray-matter'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises'
import { join, posix } from 'node:path'
import type { GuideBundle, GuideInfo } from '../shared/guide'
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export function safeRelative(path: string): string {
  if (!path || path.includes('\\') || path.includes(':') || path.includes('%') || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..' || /[\x00-\x1f]/.test(p))) throw new Error('Đường dẫn guide không hợp lệ.')
  return path
}
const infoSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), description: z.string(), platform: z.literal('win32-x64'), actions: z.array(z.enum(['install', 'configure', 'repair'])).min(1) })
export const catalogSchema = z.object({ schemaVersion: z.literal(2), revision: z.string().regex(/^[a-f0-9]{40}$/), guides: z.array(z.object({ id: z.string(), entry: z.string(), files: z.array(z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1).max(100) })).min(1).max(50) })
export type Catalog = z.infer<typeof catalogSchema>
export function parseGuide(files: Record<string, string>, entry: string, id: string, revision: string, source: GuideBundle['source']): GuideBundle {
  safeRelative(entry)
  if (posix.basename(entry) !== 'GUIDE.md') throw new Error('Điểm vào phải là GUIDE.md.')
  const root = posix.dirname(entry) + '/'
  for (const path of Object.keys(files)) if (!safeRelative(path).startsWith(root)) throw new Error('File nằm ngoài thư mục guide.')
  if (typeof files[entry] !== 'string') throw new Error('Thiếu GUIDE.md.')
  const info = infoSchema.parse(matter(files[entry]).data)
  if (info.id !== id) throw new Error('ID guide không khớp manifest.')
  return { info: { ...info, entry }, revision, source, files, loadedAt: new Date().toISOString(), digest: digest(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))) }
}
export class Guides {
  private latest = new Map<string, GuideBundle>()
  constructor(private options: { url: string; root: string; cache: string; sample: boolean; fetch: typeof fetch }) {}
  async catalog(): Promise<GuideInfo[]> { await this.refresh(); return [...this.latest.values()].map(b => b.info) }
  async load(id: string): Promise<GuideBundle> { await this.refresh(); const bundle = this.latest.get(id); if (!bundle) throw new Error('Guide không có trong danh mục.'); return structuredClone(bundle) }
  private async refresh() {
    if (this.options.sample) {
      const guides = await localGuides(this.options.root)
      this.latest = new Map(guides.map(b => [b.info.id, b])); return
    }
    const path = join(this.options.cache, 'guides-v2.json')
    try {
      const url = new URL(this.options.url)
      if (url.origin !== 'https://raw.githubusercontent.com') throw new Error('Nguồn guide phải là GitHub raw đã cấu hình.')
      const manifest = catalogSchema.parse(JSON.parse(await this.get(url.href)))
      const [, owner, repo] = url.pathname.split('/')
      const files: Record<string, string> = {}
      for (const guide of manifest.guides) for (const file of guide.files) {
        safeRelative(file.path)
        if (files[file.path] === undefined) files[file.path] = await this.get(`https://raw.githubusercontent.com/${owner}/${repo}/${manifest.revision}/${file.path}`)
      }
      const bundles = validateCatalog(manifest, files, 'github')
      await mkdir(this.options.cache, { recursive: true }); await writeFile(path + '.tmp', JSON.stringify({ manifest, files })); await rename(path + '.tmp', path)
      this.latest = new Map(bundles.map(b => [b.info.id, b]))
    } catch (error) {
      try { const cached = JSON.parse(await readFile(path, 'utf8')); this.latest = new Map(validateCatalog(catalogSchema.parse(cached.manifest), cached.files, 'cache').map(b => [b.info.id, b])) }
      catch { throw error }
    }
  }
  private async get(url: string) {
    const response = await this.options.fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error', cache: 'no-store' })
    if (!response.ok) throw new Error(`Không tải được guide: HTTP ${response.status}`)
    const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1024 * 1024) throw new Error('File guide vượt 1 MB.'); chunks.push(value) } } finally { await reader.cancel().catch(() => {}) }
    return Buffer.concat(chunks).toString('utf8')
  }
}
export function validateCatalog(manifest: Catalog, files: Record<string, string>, source: GuideBundle['source']) {
  if (new Set(manifest.guides.map(g => g.id)).size !== manifest.guides.length) throw new Error('Trùng ID guide.')
  let total = 0
  return manifest.guides.map(g => {
    if (new Set(g.files.map(f => f.path)).size !== g.files.length) throw new Error('Trùng đường dẫn guide.')
    const selected: Record<string, string> = {}
    for (const file of g.files) {
      safeRelative(file.path)
      if (typeof files[file.path] !== 'string' || digest(files[file.path]) !== file.sha256) throw new Error(`Hash không hợp lệ: ${file.path}`)
      total += Buffer.byteLength(files[file.path]); if (total > 20 * 1024 * 1024) throw new Error('Bundle vượt 20 MB.')
      selected[file.path] = files[file.path]
    }
    return parseGuide(selected, g.entry, g.id, manifest.revision, source)
  })
}
export async function localGuides(root: string): Promise<GuideBundle[]> {
  const bundles: GuideBundle[] = []
  for (const dir of await readdir(join(root, 'guides'), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const files: Record<string, string> = {}
    async function walk(relative: string) { for (const file of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = `${relative}/${file.name}`; safeRelative(path)
      if (file.isSymbolicLink()) throw new Error('Guide không được chứa symlink.')
      if (file.isDirectory()) await walk(path); else files[path] = await readFile(join(root, path), 'utf8')
    } }
    await walk(`guides/${dir.name}`)
    const entry = `guides/${dir.name}/GUIDE.md`
    bundles.push(parseGuide(files, entry, matter(files[entry]).data.id, 'sample-v2', 'sample'))
  }
  return bundles
}
