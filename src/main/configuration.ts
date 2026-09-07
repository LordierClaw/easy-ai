import { parse, stringify } from 'smol-toml'
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { redact } from '../shared/redact'

// This repair changes only provider-selection overrides, never auth or executable hooks.
export function resetProviderOverrides(text: string): string {
  const config = parse(text)
  for (const key of ['model', 'model_provider', 'profile', 'openai_base_url', 'chatgpt_base_url']) delete config[key]
  return stringify(config)
}
export class CodexConfiguration {
  constructor(private home: string, private backupRoot: string) {}
  get file() { return join(this.home, '.codex', 'config.toml') }
  async read(): Promise<string> {
    try { const text = await readFile(this.file, 'utf8'); if (text.length > 100000) throw new Error('Config quá lớn để chẩn đoán tự động.'); return redact(text) }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'Chưa có config.toml; Codex dùng cấu hình mặc định.'; throw e }
  }
  async resetProvider(): Promise<string> {
    let old: string
    try { old = await readFile(this.file, 'utf8') } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'Không có config.toml cần sửa.'; throw e }
    if (old.length > 100000) throw new Error('Config quá lớn để sửa tự động.')
    let next: string
    try { next = resetProviderOverrides(old) } catch { throw new Error('config.toml sai cú pháp. Chưa thay đổi file; cần IT sửa cấu trúc để tránh mất thiết lập khác.') }
    const before = parse(old); const after = parse(next)
    if (JSON.stringify(before) === JSON.stringify(after)) return 'Lựa chọn provider đang dùng mặc định; không cần thay đổi.'
    const stamp = randomUUID()
    await mkdir(this.backupRoot, { recursive: true })
    const backup = join(this.backupRoot, `codex-config-${stamp}.toml`)
    await copyFile(this.file, backup)
    const temp = this.file + '.' + stamp + '.tmp'
    await writeFile(temp, next, 'utf8'); await rename(temp, this.file)
    return `Đã bỏ các lựa chọn model/provider/profile và URL ghi đè ở cấp gốc để Codex dùng đăng nhập ChatGPT mặc định. Các thiết lập khác được giữ; định dạng/comment TOML có thể thay đổi. Sao lưu: ${backup}`
  }
}
