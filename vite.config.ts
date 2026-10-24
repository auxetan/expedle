import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync } from 'node:fs'
import { configDefaults } from 'vitest/config'
import { defineConfig, type Plugin } from 'vite'

// Génère le service worker avec la liste exacte des fichiers du build à précharger.
function serviceWorker(): Plugin {
  return {
    name: 'expedle-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      // les icônes de public/ ne passent pas par le bundle : on les ajoute pour le hors-ligne
      const icons = readdirSync(new URL('./public/icons', import.meta.url)).map((f) => `./icons/${f}`)
      // les drapeaux de Flagle (quelque 70 fichiers), les sons et les cartes de Frontières (plusieurs Mo chacune)
      // se mettent en cache à mesure qu'on les rencontre
      const lazy = ['.svg', '.mp3', '.gz']
      const files = [...Object.keys(bundle).filter((f) => !lazy.some((ext) => f.endsWith(ext))).map((f) => `./${f}`), ...icons]
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
  // les copies de travail rangées dans .claude/worktrees ont leurs propres tests : on ne les lance pas deux fois
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
