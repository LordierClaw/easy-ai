import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', testMatch: ['guide.spec.ts', 'proxy.spec.ts'], workers: 1, fullyParallel: false, timeout: 60000,
  reporter: [['list'], ['json', { outputFile: 'artifacts/e2e-results.json' }], ['html', { open: 'never', outputFolder: 'artifacts/playwright-report' }]],
  outputDir: 'artifacts/e2e', use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' } })
