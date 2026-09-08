import type { GuideRuntime, RuntimeInput } from './guide-runtime'
export class FixtureRuntime implements GuideRuntime {
  constructor(private scenario = 'success') {}
  async run(input: RuntimeInput) {
    const context = JSON.parse(input.prompt)
    const call = (operation: string, payload: unknown) => input.request('tool', { operation, payload }, `fixture-${operation}`)
    await input.request('before_ai', { system: input.system, context })
    input.text('Tôi đang đọc hướng dẫn và xác định bước cần thực hiện. ')
    await call('guide_read', { path: 'GUIDE.md' })
    if (this.scenario === 'question' && !context.history.some((m: any) => m.text.includes('tiếp tục'))) { await call('ask_user', { question: 'Bạn muốn tiếp tục với thư mục mặc định không?' }); return }
    if (!context.approved) {
      await call('query', { id: 'system', title: 'Kiểm tra vùng làm việc theo guide', query: { operation: 'system_info' } })
      await call('propose_plan', { summary: 'Tạo ghi chú trong vùng fixture và kiểm tra nội dung. Không thay đổi máy thật.', steps: [{ id: 'write', title: 'Tạo ghi chú làm việc', change: { operation: 'write_file', path: '{workspace}/welcome.txt', content: 'EASYAI_OK' } }], checks: [{ id: 'content', title: 'Nội dung ghi chú đúng', query: { operation: 'read_file', path: '{workspace}/welcome.txt' }, expect: { field: 'content', operator: 'equals', value: 'EASYAI_OK' } }] })
    } else { await call('execute_step', { id: 'write' }); await call('finish', {}) }
    await input.request('after_ai', { role: 'assistant', content: [{ type: 'text', text: 'Đã xử lý theo kết quả tool.' }], usage: { input: 10, output: 10 }, stopReason: 'stop' })
  }
  dispose() {}
}
