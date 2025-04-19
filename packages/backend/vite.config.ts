// vite.config.ts
import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [cloudflare({
    persistState: {
      path: '../../.wrangler/state',
    }
  })],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'src/index.ts'
    },
    target: 'esnext',
    minify: false
  }
})
