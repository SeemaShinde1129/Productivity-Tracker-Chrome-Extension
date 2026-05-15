import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.extension.json',
          dest: '.',
          rename: 'manifest.json',
        },
        { src: 'src/background/**/*', dest: '.' },
        { src: 'src/utils/**/*', dest: '.' },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        dashboard: resolve(projectRoot, 'dashboard.html'),
        popup: resolve(projectRoot, 'popup.html'),
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
});
