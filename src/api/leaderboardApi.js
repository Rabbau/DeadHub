import { httpGet } from './httpClient.js';
import { API_BASE } from './config.js';

export const LEADERBOARD_REGIONS = ['Europe', 'Asia', 'NAmerica', 'SAmerica', 'Oceania'];

const LEADERBOARD_TTL_MS = 30 * 60 * 1000; // Valve обновляет таблицу раз в час

/**
 * В сыром ответе у одного ника бывает до тысяч possible_account_ids (~500 КБ на регион).
 * Оставляем количество кандидатов и id только если аккаунт определён однозначно.
 * @returns {Array<{ rank: number, name: string, id: number|null, candidates: number, heroes: number[] }>}
 */
function slimLeaderboard(data) {
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  return entries
    .map((e) => {
      const ids = Array.isArray(e.possible_account_ids) ? e.possible_account_ids : [];
      return {
        rank: e.rank,
        name: e.account_name || '—',
        id: ids.length === 1 ? ids[0] : null,
        candidates: ids.length,
        heroes: Array.isArray(e.top_hero_ids) ? e.top_hero_ids.slice(0, 3) : [],
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

/**
 * Лидерборд региона — общий или по конкретному герою.
 * @param {'Europe'|'Asia'|'NAmerica'|'SAmerica'|'Oceania'} region
 * @param {number|null} [heroId]
 */
export function fetchLeaderboard(region, heroId = null) {
  const path = heroId ? `${region}/${heroId}` : region;
  return httpGet(`${API_BASE}/v1/leaderboard/${path}`, {
    cacheKey: `leaderboard_${region}_${heroId || 'all'}`,
    ttl: LEADERBOARD_TTL_MS,
    transform: slimLeaderboard,
  });
}
