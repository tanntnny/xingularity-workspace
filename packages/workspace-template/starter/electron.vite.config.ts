import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@xingularity/workspace-template/styles/workspace.css': resolve(
          '../styles/workspace.css'
        ),
        '@xingularity/workspace-template': resolve('../src/index.ts')
      }
    },
    plugins: [react()]
  }
})
