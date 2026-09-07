export type Action = 'install' | 'configure' | 'repair'
export type RunStatus = 'checking' | 'awaiting_approval' | 'running' | 'awaiting_input' | 'awaiting_login' | 'ready' | 'needs_it' | 'interrupted' | 'failed' | 'cancelled'
export type ComponentId = 'git' | 'node' | 'codex' | 'chatgpt'
export interface ComponentState { id: ComponentId; name: string; installed: boolean; compatible: boolean; version?: string; path?: string; status: 'missing' | 'installed' | 'awaiting_login' | 'ready' | 'needs_it'; detail?: string }
export interface NetworkCheck { name: string; url: string; reachable: boolean; status?: number; error?: string; required: boolean }
export interface ProxyInfo { enabled: boolean; server: string; bypass: string; pac?: string }
export interface Inspection { windows: string; supported: boolean; admin: boolean; elevated: boolean; components: ComponentState[]; proxy: ProxyInfo; network: NetworkCheck[]; checkedAt: string; installationBusy?: boolean; configuration?: { valid: boolean; detail: string } }
export interface PolicyDecision { kind: 'allow' | 'needs_it'; code?: string; reason?: string; components?: ComponentId[] }
export interface WorkflowDefinition { id: string; name: string; description: string; platform: 'win32-x64'; actions: Action[]; dependencies: string[]; sources: string[]; completion: string[]; policies: string[]; repairOperations: string[]; instructions: string }
export interface PolicyRule { id: string; condition: 'missing_dependencies_without_admin' | 'openai_unreachable' | 'store_unavailable' | 'login_required'; effect: 'needs_it' | 'awaiting_login'; message: string }
export interface DocumentBundle { revision: string; digest: string; source: 'github' | 'cache' | 'sample'; loadedAt: string; workflow: WorkflowDefinition; policy: { recipient: string; rules: PolicyRule[]; instructions: string }; bm01: string }
export interface SupportRequest { recipient: string; subject: string; body: string; code: string }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string }
export interface ProgressEntry { id: string; title: string; status: 'running' | 'done' | 'error'; detail?: string; at: string }
export interface Run { id: string; title: string; action: Action; status: RunStatus; createdAt: string; updatedAt: string; messages: ChatMessage[]; progress: ProgressEntry[]; inspection?: Inspection; bundle?: DocumentBundle; support?: SupportRequest; approval?: string[]; approvedComponents?: ComponentId[]; approved: boolean; repairAttempts: number; question?: string; error?: string; demo: boolean; chatgptConfirmed?: boolean; configured?: boolean }
export type RunEvent = { type: 'run'; run: Run } | { type: 'delta'; runId: string; messageId: string; text: string }
export interface AppInfo { version: string; demo: boolean; sample: boolean; documentsConfigured: boolean }
export interface EasyAPI {
  info(): Promise<AppInfo>; list(): Promise<Run[]>; start(action: Action, text?: string): Promise<Run>;
  approve(id: string): Promise<void>; cancel(id: string): Promise<void>; retry(id: string): Promise<void>;
  send(id: string, text: string): Promise<void>; open(id: string, target: 'codex' | 'chatgpt' | 'login'): Promise<void>;
  attach(): Promise<string | null>; export(id: string): Promise<boolean>; copy(text: string): Promise<void>;
  connections(): Promise<NetworkCheck[]>; onEvent(callback: (event: RunEvent) => void): () => void;
  confirmChatGPT(id: string): Promise<void>;
}
declare global { interface Window { easy: EasyAPI } }
