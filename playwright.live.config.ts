import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/live', testMatch: ['guide.spec.ts'], workers: 1, timeout: 180000,
  reporter: [['list'], ['json', { outputFile: 'artifacts/live-results.json' }], ['html', { open: 'never', outputFolder: 'artifacts/live-report' }]], outputDir: 'artifacts/live' })
