import { readFile, writeFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, join, posix } from 'node:path'
import { localGuides, validateCatalog, digest, type Catalog } from '../src/main/guides'
import { policySchema } from '../src/main/guide-engine'
import matter from 'gray-matter'
const repoIndex = process.argv.indexOf('--repo')
const repo = repoIndex >= 0 ? resolve(process.argv[repoIndex + 1]) : process.cwd()
let root = repo
try { await access(join(root, 'guides')) } catch { root = join(repo, 'content') }
const bundles = await localGuides(root)
for (const bundle of bundles) {
  const folder = posix.dirname(bundle.info.entry)
  const policyText = bundle.files[folder + '/policy.json']
  if (policyText) {
    const policy = policySchema.parse(JSON.parse(policyText))
    for (const rule of policy.rules) {
      if (rule.all.some(c => !policy.probes[c.probe])) throw new Error('Policy tham chiếu probe không có: ' + rule.id)
      const template = bundle.files[folder + '/' + rule.template]; if (!template) throw new Error('Thiếu template: ' + rule.template)
      const metadata = matter(template).data
      if (!metadata.recipient || !metadata.subject) throw new Error('Template thiếu người nhận/tiêu đề.')
    }
  }
}
if (process.argv[2] === 'prepare') {
  const revision = process.argv[3] && process.argv[3] !== '--repo' ? process.argv[3] : execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Cần full commit SHA.')
  const prefix = root === repo ? '' : 'content/'
  const files: Record<string, string> = {}
  const manifest: Catalog = { schemaVersion: 2, revision, guides: bundles.map(b => ({ id: b.info.id, entry: prefix + b.info.entry, files: Object.keys(b.files).sort().map(path => {
    const full = prefix + path; const body = execFileSync('git', ['-C', repo, 'show', `${revision}:${full}`], { encoding: 'utf8' }); files[full] = body
    return { path: full, sha256: digest(body) }
  }) })) }
  validateCatalog(manifest, files, 'github')
  // Keep v1's manifest unchanged; v2 uses a separate pointer for older clients.
  const manifestPath = join(repo, 'content', 'guides-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log('Manifest v2 ghim revision ' + revision)
} else console.log(`${bundles.length} guide hợp lệ; GUIDE.md, policy và templates đã kiểm tra.`)
