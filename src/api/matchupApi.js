import { httpGet } from './httpClient.js';
import { ANALYTICS_API_BASE } from './config.js';
import { DEFAULT_FILTERS, filtersKey, toQueryString, toStatsParams } from '../services/statsFilters.js';

const MATCHUP_TTL_MS = 30 * 60 * 1000;

// Серверный порог минимальный: достаточность выборки оцениваем на клиенте по matches_played,
// иначе при узких фильтрах (высокие ранги, 7 дней) ответ был бы пустым.
const SERVER_MIN_MATCHES = 5;

/**
 * Полный ответ ~570 КБ (1406 пар × 20 полей). В кеш кладём только [герой, соперник, победы, матчи].
 * @returns {Array<[number, number, number, number]>}
 */
function slimCounters(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => [r.hero_id, r.enemy_hero_id, r.wins, r.matches_played]);
}

/** Синергия — по неупорядоченным парам героев одной команды: [герой A, герой B, победы, матчи]. */
function slimSynergy(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => [r.hero_id1, r.hero_id2, r.wins, r.matches_played]);
}

/**
 * Винрейт героя против каждого героя во вражеской команде — вся матрица одним запросом.
 * @param {typeof DEFAULT_FILTERS} [filters]
 */
export function fetchCounterStats(filters = DEFAULT_FILTERS) {
  const query = toQueryString({ ...toStatsParams(filters), min_matches: SERVER_MIN_MATCHES });
  return httpGet(`${ANALYTICS_API_BASE}/v1/analytics/hero-counter-stats?${query}`, {
    cacheKey: `matchups_counters_${filtersKey(filters)}`,
    ttl: MATCHUP_TTL_MS,
    transform: slimCounters,
  });
}

/**
 * Винрейт пар героев, играющих в одной команде — вся матрица одним запросом.
 * @param {typeof DEFAULT_FILTERS} [filters]
 */
export function fetchSynergyStats(filters = DEFAULT_FILTERS) {
  const query = toQueryString({ ...toStatsParams(filters), min_matches: SERVER_MIN_MATCHES });
  return httpGet(`${ANALYTICS_API_BASE}/v1/analytics/hero-synergy-stats?${query}`, {
    cacheKey: `matchups_synergy_${filtersKey(filters)}`,
    ttl: MATCHUP_TTL_MS,
    transform: slimSynergy,
  });
}
