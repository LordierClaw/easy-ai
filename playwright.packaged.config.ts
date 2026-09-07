import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/packaged', workers: 1, timeout: 90000, reporter: [['list'], ['json', { outputFile: 'artifacts/packaged-results.json' }]], outputDir: 'artifacts/packaged' })
