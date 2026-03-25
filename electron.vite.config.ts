import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'frontend'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'frontend/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'frontend/src')
      }
    },
    plugins: [react()],
    css: {
      postcss: {
        plugins: [
          tailwindcss({
            content: [
              resolve(__dirname, 'frontend/index.html'),
              resolve(__dirname, 'frontend/src/**/*.{ts,tsx}')
            ],
            theme: {
              extend: {
                colors: {
                  brand: {
                    red: '#ef4444',
                    dark: '#0f0f11',
                    surface: '#1a1a1f',
                    border: '#2a2a32'
                  }
                }
              }
            }
          }),
          autoprefixer()
        ]
      }
    }
  }
})
