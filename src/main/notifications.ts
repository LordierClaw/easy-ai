import type { GuideRun } from '../shared/guide'
export interface Notice { on(event: 'click' | 'failed' | 'show', handler: (...args: any[]) => void): unknown; show(): void }
const titles: Partial<Record<GuideRun['status'], string>> = { ready: 'EasyAI đã hoàn tất', failed: 'EasyAI chưa hoàn tất', needs_it: 'Cần IT hỗ trợ', awaiting_approval: 'Cần xác nhận phạm vi', awaiting_input: 'EasyAI cần bạn phản hồi', awaiting_login: 'Cần hoàn tất bước thủ công', interrupted: 'Phiên EasyAI bị gián đoạn' }
export class Notifications {
  private states = new Map<string, string>()
  private pending = new Set<Notice>()
  constructor(private create: (title: string, body: string) => Notice | undefined, private select: (id: string) => void, private record: (id: string, event: string) => void) {}
  update(run: GuideRun) {
    if (this.states.get(run.id) === run.status) return
    this.states.set(run.id, run.status)
    const title = titles[run.status]; if (!title) return
    try {
      const notification = this.create(title, `${run.title}. Mở EasyAI để xem chi tiết.`)
      if (!notification) { this.record(run.id, 'Windows notification không được hỗ trợ.'); return }
      this.pending.add(notification)
      this.record(run.id, `Đã yêu cầu Windows notification: ${run.status}`)
      let acknowledged = false
      const timer = setTimeout(() => {
        if (!acknowledged) this.record(run.id, 'Windows chưa xác nhận hiển thị notification. Kiểm tra đăng ký ứng dụng/chính sách notification; chỉ báo trong ứng dụng vẫn còn.')
        this.pending.delete(notification)
      }, 10000)
      timer.unref?.()
      notification.on('click', () => this.select(run.id))
      notification.on('show', () => { acknowledged = true; this.record(run.id, 'Windows đã nhận notification; Focus Assist có thể ẩn toast.') })
      notification.on('failed', (_event, error) => { acknowledged = true; this.record(run.id, `Windows notification thất bại: ${String(error)}`) })
      notification.show()
    } catch (e) { this.record(run.id, `Không phát được notification: ${(e as Error).message}`) }
  }
}
