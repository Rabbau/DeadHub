import { httpGet } from './httpClient.js';
import { ANALYTICS_API_BASE } from './config.js';
import { DEFAULT_FILTERS, filtersKey, toQueryString, toStatsParams } from '../services/statsFilters.js';

const STATS_TTL_MS = 10 * 60 * 1000;

function normalizeItemStat(raw) {
  const matches = raw.matches ?? 0;
  const wins = raw.wins ?? 0;
  return {
    itemId: raw.item_id,
    matches,
    wins,
    losses: raw.losses ?? 0,
    players: raw.players ?? 0,
    winrate: matches > 0 ? wins / matches : 0,
    avgBuyTimeS: raw.avg_buy_time_s ?? null,
  };
}

function normalizePermutation(raw) {
  const matches = raw.matches ?? 0;
  const wins = raw.wins ?? 0;
  return {
    itemIds: raw.item_ids ?? [],
    matches,
    wins,
    losses: raw.losses ?? 0,
    winrate: matches > 0 ? wins / matches : 0,
  };
}

export async function fetchHeroItemStats(heroId, minMatches = 100, filters = DEFAULT_FILTERS) {
  const query = toQueryString({ hero_ids: heroId, min_matches: minMatches, ...toStatsParams(filters) });
  const url = `${ANALYTICS_API_BASE}/v1/analytics/item-stats?${query}`;
  const data = await httpGet(url, {
    cacheKey: `hero_item_stats_${heroId}_${minMatches}_${filtersKey(filters)}`,
    ttl: STATS_TTL_MS,
  });
  return (Array.isArray(data) ? data : []).map(normalizeItemStat).sort((a, b) => b.matches - a.matches);
}

export async function fetchHeroItemPermutations(heroId, minMatches = 50, limit = 5, filters = DEFAULT_FILTERS) {
  const query = toQueryString({ hero_ids: heroId, min_matches: minMatches, ...toStatsParams(filters) });
  const url = `${ANALYTICS_API_BASE}/v1/analytics/item-permutation-stats?${query}`;
  const data = await httpGet(url, {
    cacheKey: `hero_item_perm_${heroId}_${minMatches}_${filtersKey(filters)}`,
    ttl: STATS_TTL_MS,
  });
  return (Array.isArray(data) ? data : [])
    .map(normalizePermutation)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, limit);
}

/*
 * У item-stats нет фильтра по предмету (параметр item_ids API молча игнорирует и отдаёт все предметы),
 * поэтому качаем список целиком и достаём нужный предмет по item_id. Список общий для всех страниц
 * предметов — один запрос на набор фильтров.
 */

/** { [itemId]: { matches, wins, players, avgBuyTimeS } } */
function slimItemStats(rows) {
  const byItem = {};
  (Array.isArray(rows) ? rows : []).forEach((raw) => {
    byItem[raw.item_id] = {
      matches: raw.matches ?? 0,
      wins: raw.wins ?? 0,
      players: raw.players ?? 0,
      avgBuyTimeS: raw.avg_buy_time_s ?? null,
    };
  });
  return byItem;
}

/** { [itemId]: [[heroId, matches, wins], ...] } — из строк, сгруппированных по герою (bucket=hero). */
function slimItemStatsByHero(rows) {
  const byItem = {};
  (Array.isArray(rows) ? rows : []).forEach((raw) => {
    (byItem[raw.item_id] ||= []).push([raw.bucket, raw.matches ?? 0, raw.wins ?? 0]);
  });
  return byItem;
}

export async function fetchItemGlobalStats(itemId, minMatches = 20, filters = DEFAULT_FILTERS) {
  const query = toQueryString({ min_matches: minMatches, ...toStatsParams(filters) });
  const url = `${ANALYTICS_API_BASE}/v1/analytics/item-stats?${query}`;
  const byItem = await httpGet(url, {
    cacheKey: `item_stats_all_${minMatches}_${filtersKey(filters)}`,
    ttl: STATS_TTL_MS,
    transform: slimItemStats,
  });
  const raw = byItem[itemId];
  if (!raw) return null;
  return {
    itemId: Number(itemId),
    ...raw,
    losses: raw.matches - raw.wins,
    winrate: raw.matches > 0 ? raw.wins / raw.matches : 0,
  };
}

/**
 * Статистика предмета в разрезе героев — один запрос (bucket=hero) вместо запроса на каждого героя.
 * При ошибке возвращает пустой список: блок «кто берёт предмет» вторичен.
 */
export async function fetchHeroesUsingItem(itemId, heroIds, minMatches = 20, filters = DEFAULT_FILTERS) {
  try {
    const query = toQueryString({ bucket: 'hero', min_matches: minMatches, ...toStatsParams(filters) });
    const url = `${ANALYTICS_API_BASE}/v1/analytics/item-stats?${query}`;
    const byItem = await httpGet(url, {
      cacheKey: `item_stats_by_hero_${minMatches}_${filtersKey(filters)}`,
      ttl: STATS_TTL_MS,
      transform: slimItemStatsByHero,
    });
    const allowed = new Set(heroIds);

    return (byItem[itemId] || [])
      .filter(([heroId, matches]) => allowed.has(heroId) && matches >= minMatches)
      .map(([heroId, matches, wins]) => ({
        heroId,
        itemId: Number(itemId),
        matches,
        wins,
        losses: matches - wins,
        winrate: matches > 0 ? wins / matches : 0,
      }))
      .sort((a, b) => b.matches - a.matches);
  } catch {
    return [];
  }
}
