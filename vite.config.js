import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/assets': {
        target: 'https://api.deadlock-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/assets/, ''),
      },
      '/api/analytics': {
        target: 'https://api.deadlock-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/analytics/, ''),
      },
    },
  },
})