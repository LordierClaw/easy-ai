import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
declare const __EASYAI_TEST_KEY__: string
// Fixed internal test configuration. Never import this module from renderer/preload.
export const AI = {
  model: 'kr/glm-5',
  baseURL: 'http://localhost:20128/v1',
  key: typeof __EASYAI_TEST_KEY__ !== 'undefined' ? __EASYAI_TEST_KEY__ : readFileSync(resolve('.local/ai-key.txt'), 'utf8').trim()
} as const
// Published manifest pins immutable document revisions. Demo never executes Windows mutations.
export const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/LordierClaw/easy-ai-docs/main/content/guides-manifest.json'
export const SUPPORT_EMAIL = 'lordierclaw@gmail.com'
