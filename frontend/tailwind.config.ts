import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
  },
  plugins: []
}

export default config
