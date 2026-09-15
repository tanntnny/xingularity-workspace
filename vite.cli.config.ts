import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'out/cli',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/cli/xWorkspace.ts'),
      external: [/^node:/, 'zod'],
      output: {
        format: 'cjs',
        entryFileNames: 'xWorkspace.js'
      }
    }
  }
})
