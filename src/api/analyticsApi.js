import { httpGet } from './httpClient.js';
import { ANALYTICS_API_BASE } from './config.js';

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

export async function fetchHeroItemStats(heroId, minMatches = 100) {
  const url = `${ANALYTICS_API_BASE}/v1/analytics/item-stats?hero_ids=${heroId}&min_matches=${minMatches}`;
  const data = await httpGet(url, { cacheKey: `hero_item_stats_${heroId}_${minMatches}` });
  return (Array.isArray(data) ? data : []).map(normalizeItemStat).sort((a, b) => b.matches - a.matches);
}

export async function fetchHeroItemPermutations(heroId, minMatches = 50, limit = 5) {
  const url = `${ANALYTICS_API_BASE}/v1/analytics/item-permutation-stats?hero_ids=${heroId}&min_matches=${minMatches}`;
  const data = await httpGet(url, { cacheKey: `hero_item_perm_${heroId}_${minMatches}` });
  return (Array.isArray(data) ? data : [])
    .map(normalizePermutation)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, limit);
}

export async function fetchItemGlobalStats(itemId, minMatches = 20) {
  const url = `${ANALYTICS_API_BASE}/v1/analytics/item-stats?item_ids=${itemId}&min_matches=${minMatches}`;
  const data = await httpGet(url, { cacheKey: `item_global_stats_${itemId}` });
  const raw = Array.isArray(data) ? data[0] : null;
  return raw ? normalizeItemStat(raw) : null;
}

export async function fetchHeroesUsingItem(itemId, heroIds, minMatches = 20) {
  const results = await Promise.all(
    heroIds.map(async (heroId) => {
      try {
        const url = `${ANALYTICS_API_BASE}/v1/analytics/item-stats?hero_ids=${heroId}&item_ids=${itemId}&min_matches=${minMatches}`;
        const data = await httpGet(url, { cacheKey: `item_${itemId}_hero_${heroId}` });
        const raw = Array.isArray(data) ? data[0] : null;
        if (!raw || (raw.matches ?? 0) < minMatches) return null;
        return { heroId, ...normalizeItemStat(raw) };
      } catch {
        return null;
      }
    }),
  );

  return results.filter(Boolean).sort((a, b) => b.matches - a.matches);
}
