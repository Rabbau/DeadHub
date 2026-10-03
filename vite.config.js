import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Шрифты не вшиваются в CSS строками base64 (Vite делает так со всеми файлами меньше 4 КБ): CSS блокирует отрисовку
    // страницы, и вшитый шрифт скачивался бы всегда. Отдельным файлом он кешируется навсегда, а скачивается только если
    // нужен (unicode-range). Сейчас самый маленький файл чуть больше 4 КБ, но новый набор знаков мог бы оказаться меньше
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