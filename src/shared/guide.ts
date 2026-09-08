import { z } from 'zod'

export const querySchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('system_info') }),
  z.object({ operation: z.literal('find_executable'), name: z.string().regex(/^[\w.-]+$/) }),
  z.object({ operation: z.literal('read_file'), path: z.string().min(1) }),
  z.object({ operation: z.literal('read_registry'), path: z.string().min(1), name: z.string().min(1) }),
  z.object({ operation: z.literal('http_probe'), url: z.string().url() }),
  z.object({ operation: z.literal('find_package'), name: z.string().regex(/^[\w.*-]+$/) })
])
export type Query = z.infer<typeof querySchema>
export const mutationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('write_file'), path: z.string().min(1), content: z.string().max(1000000) }),
  z.object({ operation: z.literal('edit_toml'), path: z.string().min(1), remove: z.array(z.string().regex(/^[\w-]+$/)).max(100).default([]), set: z.record(z.string().regex(/^[\w-]+$/), z.union([z.string(), z.number(), z.boolean()])).default({}) }),
  z.object({ operation: z.literal('download'), url: z.string().url(), path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ operation: z.literal('powershell'), script: z.string().min(1).max(32000), timeout: z.number().int().min(1000).max(1200000).default(60000), installer: z.boolean().default(false) }),
  z.object({ operation: z.literal('process'), executable: z.string().min(1), args: z.array(z.string()).max(50), timeout: z.number().int().min(1000).max(1200000).default(60000), installer: z.boolean().default(false) })
])
export type Mutation = z.infer<typeof mutationSchema>
export const predicateSchema = z.object({ field: z.string().max(200), operator: z.enum(['equals', 'not_equals', 'exists', 'contains', 'gte', 'version_lt']), value: z.union([z.string(), z.number(), z.boolean()]).optional() })
export type Predicate = z.infer<typeof predicateSchema>
export const checkSchema = z.object({ id: z.string().min(1), title: z.string().min(1), query: z.union([querySchema, mutationSchema]).optional(), expect: predicateSchema.optional(), userConfirmation: z.string().optional(), afterConfirmation: z.string().optional() }).refine(c => c.userConfirmation ? !c.query : !!c.query && !!c.expect, 'A check must have an executable predicate or a user confirmation')
export const planSchema = z.object({ summary: z.string().min(1), steps: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), change: mutationSchema })).max(30), checks: z.array(checkSchema).min(1).max(30) }).refine(p => new Set([...p.steps, ...p.checks].map(s => s.id)).size === p.steps.length + p.checks.length, 'Duplicate step/check IDs')
export type ExecutionPlan = z.infer<typeof planSchema>
export type GuideAction = 'install' | 'configure' | 'repair'
export type GuideStatus = 'reading' | 'running' | 'awaiting_approval' | 'awaiting_input' | 'awaiting_login' | 'needs_it' | 'ready' | 'failed' | 'interrupted' | 'cancelled'
export interface GuideInfo { id: string; name: string; description: string; platform: string; actions: GuideAction[]; entry: string }
export interface GuideBundle { info: GuideInfo; revision: string; digest: string; source: 'github' | 'cache' | 'sample'; files: Record<string, string>; loadedAt: string }
export interface Activity { id: string; title: string; state: 'running' | 'done' | 'error'; startedAt: string; endedAt?: string; detail?: string; toolCallId?: string }
export interface Evidence { id: string; query: Query | Mutation; result: unknown; at: string; generation: number }
export interface GuideSupport { template: string; recipient: string; subject: string; body: string; instructions: string[]; evidence: string; reason: string }
export interface GuideRun { schemaVersion: 2; id: string; guideId: string; title: string; action: GuideAction; status: GuideStatus; createdAt: string; updatedAt: string; bundle?: GuideBundle; messages: { id: string; role: 'user' | 'assistant'; text: string }[]; activities: Activity[]; evidence: Evidence[]; plan?: ExecutionPlan; approvedHash?: string; completedSteps: string[]; checks: { id: string; title: string; passed: boolean; detail: string }[]; confirmations: string[]; question?: string; support?: GuideSupport; error?: string; guideRead: boolean; generation: number; repairRounds: number; parentId?: string; demo: boolean; legacy?: boolean; traceWarning?: string; hookApproval?: { key: string; reason: string; payload: unknown }; hookGrants?: string[] }
export interface TraceEvent { sequence: number; runId: string; turnId?: string; requestId?: string; toolCallId?: string; at: string; kind: string; summary: string; payload?: unknown; payloadFile?: string }
export type AgentEvent = { type: 'run'; run: GuideRun } | { type: 'text'; runId: string; messageId: string; text: string } | { type: 'select'; runId: string }
export interface GuideAPI {
  info(): Promise<{ version: string; demo: boolean; sample: boolean }>;
  catalog(): Promise<GuideInfo[]>; list(): Promise<GuideRun[]>;
  start(guideId: string, action: GuideAction, text?: string, parentId?: string): Promise<GuideRun>;
  approve(id: string): Promise<void>; send(id: string, text: string): Promise<void>; cancel(id: string): Promise<void>; retry(id: string): Promise<void>;
  confirm(id: string, checkId: string): Promise<void>; trace(id: string): Promise<TraceEvent[]>;
  export(id: string): Promise<boolean>; saveSupport(id: string, support: GuideSupport): Promise<void>; exportSupport(id: string): Promise<boolean>;
  copy(text: string): Promise<void>; attach(): Promise<string | null>;
  connections(): Promise<{ name: string; reachable: boolean; detail: string }[]>;
  onEvent(callback: (event: AgentEvent) => void): () => void;
}
declare global { interface Window { guide: GuideAPI } }

export function matches(value: unknown, predicate: Predicate): boolean {
  let item: any = value
  for (const part of predicate.field.split('.').filter(Boolean)) {
    if (['__proto__', 'constructor', 'prototype'].includes(part)) return false
    item = item && typeof item === 'object' ? item[part] : undefined
  }
  switch (predicate.operator) {
    case 'exists': return item !== undefined && item !== null && item !== ''
    case 'equals': return item === predicate.value
    case 'not_equals': return item !== undefined && item !== predicate.value
    case 'contains': return typeof item === 'string' && typeof predicate.value === 'string' && item.includes(predicate.value)
    case 'gte': return typeof item === 'number' && typeof predicate.value === 'number' && item >= predicate.value
    case 'version_lt': {
      if (typeof item !== 'string' || typeof predicate.value !== 'string') return false
      const a = item.match(/\d+(?:\.\d+)*/)?.[0].split('.').map(Number); const b = predicate.value.match(/\d+(?:\.\d+)*/)?.[0].split('.').map(Number)
      if (!a || !b) return false
      for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0) }
      return false
    }
  }
}
