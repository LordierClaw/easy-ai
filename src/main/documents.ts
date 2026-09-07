import { z } from 'zod'
import matter from 'gray-matter'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentBundle } from '../shared/types'

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const fileSchema = z.object({ path: z.enum(['codex.md', 'policy.md', 'bm01.md']), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
export const manifestSchema = z.object({ schemaVersion: z.literal(1), revision: z.string().regex(/^[a-f0-9]{40}$/), files: z.array(fileSchema).length(3) })
const workflowSchema = z.object({
  id: z.literal('codex'), name: z.string(), description: z.string(), platform: z.literal('win32-x64'),
  actions: z.array(z.enum(['install', 'configure', 'repair'])).min(1), dependencies: z.array(z.string()),
  sources: z.array(z.string().url()), completion: z.array(z.enum(['git-compatible', 'node-compatible', 'codex-installed', 'codex-chatgpt-login', 'codex-smoke-test', 'chatgpt-installed', 'chatgpt-user-confirmed'])).length(7), policies: z.array(z.string()),
  repairOperations: z.array(z.enum(['configure_proxy', 'reset_codex_provider', 'reinstall_codex'])).default(['configure_proxy'])
})
const policySchema = z.object({ recipient: z.string().email(), rules: z.array(z.object({
  id: z.string(), condition: z.enum(['missing_dependencies_without_admin', 'openai_unreachable', 'store_unavailable', 'login_required']),
  effect: z.enum(['needs_it', 'awaiting_login']), message: z.string().min(1)
})).length(4) })
export function parseBundle(files: Record<string, string>, revision: string, source: DocumentBundle['source']): DocumentBundle {
  const doc = matter(files['codex.md']); const policyDoc = matter(files['policy.md'])
  const workflow = workflowSchema.parse(doc.data); const policy = policySchema.parse(policyDoc.data)
  if (new Set(workflow.completion).size !== 7) throw new Error('Thiếu tiêu chí hoàn thành bắt buộc của bộ công cụ Codex.')
  const conditions = ['missing_dependencies_without_admin', 'openai_unreachable', 'store_unavailable', 'login_required']
  if (conditions.some(c => !policy.rules.some(r => r.condition === c && r.effect === (c === 'login_required' ? 'awaiting_login' : 'needs_it')))) throw new Error('Quy định thiếu điều kiện chặn bắt buộc.')
  if (policy.rules.some(r => !workflow.policies.includes(r.id))) throw new Error('Workflow chưa tham chiếu đủ quy định.')
  if (!files['bm01.md']?.includes('{{reason}}')) throw new Error('BM01 thiếu trường lý do.')
  return { revision, digest: sha256(JSON.stringify(files)), source, loadedAt: new Date().toISOString(),
    workflow: { ...workflow, instructions: doc.content }, policy: { ...policy, instructions: policyDoc.content }, bm01: files['bm01.md'] }
}
export class Documents {
  constructor(private options: { url: string; contentDir: string; cacheDir: string; sample: boolean; fetch: typeof fetch }) {}
  async load(): Promise<DocumentBundle> {
    if (this.options.sample) {
      const files = Object.fromEntries(await Promise.all(['codex.md', 'policy.md', 'bm01.md'].map(async p => [p, await readFile(join(this.options.contentDir, p), 'utf8')])) )
      return parseBundle(files, 'sample-v1', 'sample')
    }
    const cachePath = join(this.options.cacheDir, 'documents.json')
    try {
      if (!this.options.url) throw new Error('Admin chưa cấu hình URL tài liệu GitHub. Chỉ có thể dùng bản mẫu trong chế độ demo.')
      const url = new URL(this.options.url)
      if (url.origin !== 'https://raw.githubusercontent.com') throw new Error('Tài liệu phải được publish trên raw.githubusercontent.com.')
      const manifest = manifestSchema.parse(JSON.parse(await this.get(url.href)))
      if (new Set(manifest.files.map(f => f.path)).size !== 3) throw new Error('Manifest bị trùng tài liệu.')
      const [, owner, repo] = url.pathname.split('/')
      if (!owner || !repo) throw new Error('URL GitHub không hợp lệ.')
      const files: Record<string, string> = {}
      for (const file of manifest.files) {
        const text = await this.get(`https://raw.githubusercontent.com/${owner}/${repo}/${manifest.revision}/content/${file.path}`)
        if (sha256(text) !== file.sha256) throw new Error(`Hash không khớp: ${file.path}`)
        files[file.path] = text
      }
      const bundle = parseBundle(files, manifest.revision, 'github')
      await mkdir(this.options.cacheDir, { recursive: true })
      await writeFile(cachePath + '.tmp', JSON.stringify({ manifest, files }))
      await rename(cachePath + '.tmp', cachePath)
      return bundle
    } catch (error) {
      try {
        const cache = JSON.parse(await readFile(cachePath, 'utf8'))
        const manifest = manifestSchema.parse(cache.manifest)
        if (new Set(manifest.files.map(f => f.path)).size !== 3 || manifest.files.some(f => sha256(cache.files[f.path]) !== f.sha256)) throw new Error('Cache không hợp lệ')
        return parseBundle(cache.files, manifest.revision, 'cache')
      } catch { throw error }
    }
  }
  private async get(url: string): Promise<string> {
    const response = await this.options.fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' })
    if (!response.ok) throw new Error(`Không tải được tài liệu (HTTP ${response.status}).`)
    const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1024 * 1024) throw new Error('Tài liệu vượt 1 MB.'); chunks.push(value) } }
    finally { await reader.cancel().catch(() => {}) }
    return Buffer.concat(chunks).toString('utf8')
  }
}
