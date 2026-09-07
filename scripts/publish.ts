import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { parseBundle, sha256 } from '../src/main/documents'
const repoIndex = process.argv.indexOf('--repo')
if (repoIndex >= 0) {
  if (!process.argv[repoIndex + 1]) throw new Error('Thiếu đường dẫn repo tài liệu.')
  process.chdir(process.argv[repoIndex + 1])
}
const paths = ['codex.md', 'policy.md', 'bm01.md']
const files = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(`content/${path}`, 'utf8')])) )
parseBundle(files, 'sample-v1', 'sample')
if (process.argv[2] === 'prepare') {
  const revision = process.argv[3] || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Cần commit SHA đầy đủ.')
  // Hash committed bytes, not working tree (including Windows line-ending differences).
  const committed = Object.fromEntries(paths.map(p => [p, execFileSync('git', ['show', `${revision}:content/${p}`], { encoding: 'utf8' })]))
  parseBundle(committed, revision, 'github')
  await writeFile('content/manifest.json', JSON.stringify({ schemaVersion: 1, revision, files: paths.map(path => ({ path, sha256: sha256(committed[path]) })) }, null, 2) + '\n')
  console.log('Đã tạo manifest ghim commit ' + revision + '. Publish commit đó và manifest; không tự push.')
} else console.log('Tài liệu, policy và BM01 hợp lệ.')
