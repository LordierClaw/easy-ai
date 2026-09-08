import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/published', workers: 1, timeout: 120000, reporter: [['list'], ['json', { outputFile: 'artifacts/published-results.json' }]], outputDir: 'artifacts/published' })
