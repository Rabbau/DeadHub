const MODE = import.meta.env.VITE_API_MODE || 'vercel'

// Оба хоста теперь через api.deadlock-api.com — assets заблокирован
export const ASSETS_API_BASE    = '/api/analytics'
export const ANALYTICS_API_BASE = '/api/analytics'

export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1'
export const API_MODE = MODE

export function getEndpoints() {
  if (MODE === 'backend') {
    return {
      heroes:       () => `${BACKEND_BASE}/heroes`,
      heroDetail:   (id) => `${BACKEND_BASE}/heroes/${id}`,
      items:        () => `${BACKEND_BASE}/items`,
      itemsByHero:  (heroId) => `${BACKEND_BASE}/items/hero/${heroId}`,
    }
  }
  return {
    heroes:       () => `${ANALYTICS_API_BASE}/v1/heroes`,
    heroDetail:   (id) => `${ANALYTICS_API_BASE}/v1/heroes/${id}`,
    heroStats:    (id) => `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`,
    abilityDetail:(cls) => `${ANALYTICS_API_BASE}/v1/items/${cls}`,
    items:        () => `${ANALYTICS_API_BASE}/v1/items`,
    itemsByHero:  (heroId) => `${ANALYTICS_API_BASE}/v1/analytics/hero/${heroId}/items`,
  }
}

export const ENDPOINTS = getEndpoints()