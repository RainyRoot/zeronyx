/**
 * Standalone Vite config for Docker/web builds.
 * Used by `npm run build:docker` — produces a static React bundle
 * that is served by the FastAPI backend inside the Docker container.
 *
 * This mirrors the renderer section of electron.vite.config.ts so the
 * output is identical to the Electron renderer build.
 */

import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  build: {
    outDir: resolve(__dirname, '../out/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            resolve(__dirname, 'index.html'),
            resolve(__dirname, 'src/**/*.{ts,tsx}'),
          ],
          theme: {
            extend: {
              colors: {
                brand: {
                  red: '#ef4444',
                  dark: '#0f0f11',
                  surface: '#1a1a1f',
                  border: '#2a2a32',
                },
              },
            },
          },
        }),
        autoprefixer(),
      ],
    },
  },
})
