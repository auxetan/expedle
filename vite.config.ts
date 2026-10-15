import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// Génère le service worker avec la liste exacte des fichiers du build à précharger.
function serviceWorker(): Plugin {
  return {
    name: 'meridien-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).map((f) => `./${f}`)
      const source = readFileSync(new URL('./pwa/sw.js', import.meta.url), 'utf8')
        .replace('__PRECACHE__', JSON.stringify(files))
        .replace('__VERSION__', String(Date.now()))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
})
