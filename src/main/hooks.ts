export type HookPoint = 'before_ai' | 'after_ai' | 'before_tool' | 'after_tool' | 'state_change'
export type HookDecision = { kind: 'allow' | 'deny' | 'confirm'; reason?: string }
export interface HookContext { runId: string; point: HookPoint; payload: unknown }
export interface Hook { name: string; points: HookPoint[]; control: boolean; handle(context: HookContext): HookDecision | void | Promise<HookDecision | void> }
export class Hooks {
  constructor(private hooks: Hook[] = []) {}
  async dispatch(context: HookContext, record: (name: string, decision: HookDecision) => void): Promise<HookDecision> {
    let result: HookDecision = { kind: 'allow' }
    for (const hook of this.hooks.filter(h => h.points.includes(context.point))) {
      let decision: HookDecision
      try { decision = await hook.handle(context) || { kind: 'allow' } }
      catch (e) { decision = { kind: hook.control ? 'deny' : 'allow', reason: `Hook ${hook.name}: ${(e as Error).message}` } }
      record(hook.name, decision)
      if (hook.control && decision.kind === 'deny') result = decision
      else if (hook.control && decision.kind === 'confirm' && result.kind === 'allow') result = decision
    }
    return result
  }
}
