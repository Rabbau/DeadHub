const MODE = import.meta.env.VITE_API_MODE || 'local'

export const ASSETS_API_BASE    = MODE === 'local'
  ? 'https://assets.deadlock-api.com'
  : '/api/assets'

export const ANALYTICS_API_BASE = MODE === 'local'
  ? 'https://api.deadlock-api.com'
  : '/api/analytics'

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
    heroes:       () => `${ASSETS_API_BASE}/v2/heroes?only_active=true`,
    heroDetail:   (id) => `${ASSETS_API_BASE}/v2/heroes/${id}`,
    heroStats:    (id) => `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`,
    abilityDetail:(cls) => `${ASSETS_API_BASE}/v2/items/${cls}`,
    items:        () => `${ASSETS_API_BASE}/v2/items?only_active=true`,
    itemsByHero:  (heroId) => `${ANALYTICS_API_BASE}/v1/analytics/hero/${heroId}/items`,
  }
}

export const ENDPOINTS = getEndpoints()