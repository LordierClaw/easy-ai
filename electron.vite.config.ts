import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
const testKey = readFileSync(resolve('.local/ai-key.txt'), 'utf8').trim()
export default defineConfig({
  main: { define: { __EASYAI_TEST_KEY__: JSON.stringify(testKey) }, plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: { index: resolve('src/main/index.ts'), agent: resolve('src/agent/worker.ts') } } } },
  preload: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } } } },
  renderer: { plugins: [react()] }
})
