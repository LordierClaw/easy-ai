import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { InMemoryCredentialStore, InMemoryModelsStore } from '@earendil-works/pi-ai'
import { AI } from '../main/config'

export async function makeSession(cwd: string, prompt: string, customTools: ToolDefinition[]) {
  const models = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsStore: new InMemoryModelsStore(), modelsPath: null, allowModelNetwork: false, refreshOnCreate: false, signal: AbortSignal.timeout(15000) })
  models.registerProvider('easyai-local', { api: 'openai-completions', baseUrl: AI.baseURL, apiKey: AI.key,
    models: [{ id: AI.model, name: AI.model, reasoning: false, input: ['text'], contextWindow: 64000, maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsReasoningEffort: false } }] })
  await models.setRuntimeApiKey('easyai-local', AI.key, { signal: AbortSignal.timeout(15000) })
  const settings = SettingsManager.inMemory({ retry: { enabled: false }, compaction: { enabled: false } })
  const loader = new DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager: settings,
    noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
    systemPromptOverride: () => prompt, appendSystemPromptOverride: () => [], agentsFilesOverride: () => ({ agentsFiles: [] }) })
  await loader.reload()
  return (await createAgentSession({ cwd, agentDir: cwd, model: models.getModel('easyai-local', AI.model)!,
    modelRuntime: models, thinkingLevel: 'off', settingsManager: settings, resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd), tools: customTools.map(t => t.name), customTools })).session
}
