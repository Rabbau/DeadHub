const MODE = import.meta.env.VITE_API_MODE || 'vercel'

export const ASSETS_API_BASE = '/api';
export const ANALYTICS_API_BASE = '/api';

export const API_MODE = import.meta.env.VITE_API_MODE || 'direct';
export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';

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
    heroes:       () => `${ANALYTICS_API_BASE}/v1/assets/heroes`,
    heroDetail:   (id) => `${ANALYTICS_API_BASE}/v1/assets/heroes/${id}`,
    heroStats:    (id) => `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`,
    heroWinrates: () => `${ANALYTICS_API_BASE}/v1/players/hero-stats`,
    items:        () => `${ANALYTICS_API_BASE}/v1/assets/items`,
    itemsByHero:  (heroId) => `${ANALYTICS_API_BASE}/v1/assets/items/by-hero-id/${heroId}`,
  }
}

export const ENDPOINTS = getEndpoints()