// Сайт всегда ходит на /api: на Vercel это rewrite на api.deadlock-api.com (vercel.json), в dev-режиме — прокси
// Vite (vite.config.js). Переменных окружения для этого не нужно: прежние режимы direct и backend из кода убраны.
export const API_BASE = '/api';
export const ASSETS_API_BASE = API_BASE;
export const ANALYTICS_API_BASE = API_BASE;