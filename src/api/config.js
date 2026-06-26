/**
 * @fileoverview API конфигурация.
 *
 * На Vercel (MVP): все запросы идут через /api/* → Serverless Function → Deadlock API
 * На Python-бэкенде: меняем VITE_API_MODE=backend и VITE_BACKEND_URL,
 *   тогда ASSETS_BASE и ANALYTICS_BASE заменяются на один BACKEND_BASE
 *
 * Чтобы перейти на бэкенд:
 * 1. .env: VITE_API_MODE=backend, VITE_BACKEND_URL=https://your-api.com/api/v1
 * 2. FastAPI реализует /heroes, /heroes/:id, /items, /items/hero/:id
 * 3. Файл api/[...path].js можно удалить
 */

const MODE = import.meta.env.VITE_API_MODE || 'vercel'

// Vercel proxy prefix — запросы через наш Serverless Function
export const ASSETS_API_BASE    = '/api/assets'
export const ANALYTICS_API_BASE = '/api/analytics'

// Python backend base (используется при MODE === 'backend')
export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1'

export const API_MODE = MODE

/**
 * Возвращает базовый URL в зависимости от режима.
 * При переходе на бэкенд эндпоинты берутся из одного BACKEND_BASE.
 */
export function getEndpoints() {
  if (MODE === 'backend') {
    return {
      heroes:      () => `${BACKEND_BASE}/heroes`,
      heroDetail:  (id) => `${BACKEND_BASE}/heroes/${id}`,
      items:       () => `${BACKEND_BASE}/items`,
      itemsByHero: (heroId) => `${BACKEND_BASE}/items/hero/${heroId}`,
    }
  }

  // Vercel proxy mode (MVP)
  return {
    heroes:      () => `${ASSETS_API_BASE}/v2/heroes?only_active=true`,
    heroDetail:  (id) => `${ASSETS_API_BASE}/v2/heroes/${id}`,
    heroStats:   (id) => `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`,
    abilityDetail:(cls) => `${ASSETS_API_BASE}/v2/items/${cls}`,
    items:       () => `${ASSETS_API_BASE}/v2/items?only_active=true`,
    itemsByHero: (heroId) => `${ANALYTICS_API_BASE}/v1/analytics/hero/${heroId}/items`,
  }
}

export const ENDPOINTS = getEndpoints()
