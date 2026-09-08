import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/vm', workers: 1, timeout: 35 * 60 * 1000,
  reporter: [['list'], ['json', { outputFile: 'artifacts/vm-results.json' }], ['html', { open: 'never', outputFolder: 'artifacts/vm-report' }]], outputDir: 'artifacts/vm' })
