import { httpGet } from './httpClient.js';
import { API_BASE } from './config.js';
import { toQueryString } from '../services/statsFilters.js';

const PROFILE_TTL_MS = 60 * 60 * 1000;
const FRESH_TTL_MS = 5 * 60 * 1000; // история и ранг меняются после каждого матча

/** Профиль Steam из ответов steam / steam-search. */
function slimProfile(raw) {
  return {
    id: raw.account_id,
    name: raw.personaname || `#${raw.account_id}`,
    avatar: raw.avatarmedium || raw.avatar || null,
    country: raw.countrycode || null,
    profileUrl: raw.profileurl || null,
    matches30d: raw.matches_played_last_30d ?? 0,
  };
}

/**
 * Поиск по нику, Account ID или SteamID64 (API понимает все три формата).
 * Кеш отключён: запросы разные на каждый ввод.
 * @returns {Promise<ReturnType<typeof slimProfile>[]>}
 */
export function searchPlayers(query, limit = 20) {
  const qs = toQueryString({ search_query: query, limit });
  return httpGet(`${API_BASE}/v1/players/steam-search?${qs}`, {
    cache: false,
    transform: (rows) => (Array.isArray(rows) ? rows.map(slimProfile) : []),
  }).catch((error) => {
    // Пустой результат API отдаёт как 404 «No Steam profiles found» — это не сбой
    if (error.status === 404) return [];
    throw error;
  });
}

/** @returns {Promise<ReturnType<typeof slimProfile>|null>} */
export function fetchSteamProfile(accountId) {
  return httpGet(`${API_BASE}/v1/players/steam?account_ids=${accountId}`, {
    cacheKey: `player_steam_${accountId}`,
    ttl: PROFILE_TTL_MS,
    transform: (rows) => (Array.isArray(rows) && rows[0] ? slimProfile(rows[0]) : null),
  });
}

/**
 * Текущий ранг игрока: badge = tier * 10 + subtier. null — если рейтинговых матчей нет.
 * @returns {Promise<{ badge: number, tier: number, subtier: number }|null>}
 */
export function fetchPlayerRank(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/rank`, {
    cacheKey: `player_rank_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: (raw) => (raw && raw.badge ? { badge: raw.badge, tier: raw.rank, subtier: raw.subrank } : null),
  });
}

/**
 * История матчей, новые сверху. Победа — когда победила команда игрока (match_result === player_team);
 * так же считает ranked_delta (проверено: знак дельты совпал во всех рейтинговых матчах выборки).
 * @returns {Promise<Array<{ id: number, heroId: number, at: number, duration: number, kills: number, deaths: number, assists: number, win: boolean, mode: number, delta: number|null, badge: number|null, abandoned: boolean }>>}
 */
export function fetchMatchHistory(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/match-history`, {
    cacheKey: `player_history_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: (rows) =>
      (Array.isArray(rows) ? rows : [])
        .map((m) => ({
          id: m.match_id,
          heroId: m.hero_id,
          at: m.start_time,
          duration: m.match_duration_s ?? 0,
          kills: m.player_kills ?? 0,
          deaths: m.player_deaths ?? 0,
          assists: m.player_assists ?? 0,
          win: m.match_result === m.player_team,
          mode: m.match_mode,
          delta: m.ranked_delta ?? null,
          badge: m.ranked_display_badge ?? null,
          abandoned: (m.abandoned_time_s ?? 0) > 0,
        }))
        .sort((a, b) => b.at - a.at),
  });
}

/**
 * Статистика игрока по героям (за всё время).
 * @returns {Promise<Array<{ heroId: number, matches: number, wins: number, kills: number, deaths: number, assists: number, accuracy: number, lastPlayed: number }>>}
 */
export function fetchPlayerHeroStats(accountId) {
  return httpGet(`${API_BASE}/v1/players/hero-stats?account_ids=${accountId}`, {
    cacheKey: `player_heroes_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: (rows) =>
      (Array.isArray(rows) ? rows : []).map((r) => ({
        heroId: r.hero_id,
        matches: r.matches_played ?? 0,
        wins: r.wins ?? 0,
        kills: r.kills ?? 0,
        deaths: r.deaths ?? 0,
        assists: r.assists ?? 0,
        accuracy: r.accuracy ?? 0,
        lastPlayed: r.last_played ?? 0,
      })),
  });
}
