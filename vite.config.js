import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/DeadHub/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api/assets': {
        target: 'https://assets.deadlock-api.com',
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