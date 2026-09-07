import type { DocumentBundle, Inspection, PolicyDecision, Run, SupportRequest } from './types'
export function evaluatePolicy(i: Inspection, bundle: DocumentBundle): PolicyDecision {
  const missing = i.components.filter(c => (c.id === 'git' || c.id === 'node') && (!c.installed || !c.compatible))
  const rules = bundle.policy.rules
  if (missing.length && !i.admin) {
    const rule = rules.find(r => r.condition === 'missing_dependencies_without_admin')!
    return { kind: 'needs_it', code: rule.id, reason: rule.message, components: missing.map(c => c.id) }
  }
  if (i.network.some(n => n.required && !n.reachable)) {
    const rule = rules.find(r => r.condition === 'openai_unreachable')!
    return { kind: 'needs_it', code: rule.id, reason: rule.message }
  }
  return { kind: 'allow' }
}
export function createSupport(run: Run, code: string, reason: string): SupportRequest {
  const recipient = run.bundle!.policy.recipient
  const body = run.bundle!.bm01
    .replaceAll('{{reason}}', reason).replaceAll('{{time}}', new Date().toISOString())
    .replaceAll('{{runId}}', run.id).replaceAll('{{revision}}', run.bundle!.revision)
    .replaceAll('{{components}}', run.inspection?.components.map(c => `${c.name}: ${c.version || c.status}`).join('\n') || 'Chưa kiểm tra')
    .replaceAll('{{evidence}}', run.inspection?.network.map(n => `${n.name}: ${n.reachable ? 'Kết nối được' : 'Không kết nối được'}; HTTP ${n.status ?? '-'}; ${n.error || ''}`).join('\n') || reason)
    .replaceAll('{{steps}}', run.progress.map(p => `${p.title}: ${p.status}; ${p.detail || ''}`).join('\n'))
  return { recipient, subject: `[BM01] Hỗ trợ thiết lập Codex — ${code}`, body, code }
}
