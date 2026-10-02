import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Шрифты не вшиваются в CSS строками base64: он блокирует отрисовку страницы, и вшитые файлы раздули бы его на
    // 25 КБ. Отдельным файлом шрифт кешируется навсегда, а скачивается только если нужен (unicode-range)
    assetsInlineLimit: (file) => (/\.(?:woff2?|ttf|otf|eot)$/i.test(file) ? false : undefined),
  },
  // Тесты проверяют чистую логику (src/services, locales, статические файлы) — браузер для них не нужен
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.deadlock-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})