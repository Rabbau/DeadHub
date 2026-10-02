import { httpGet } from './httpClient.js';
import { API_BASE, ASSETS_API_BASE } from './config.js';
import { slimDistribution } from '../services/rankDistributionService.js';

const RANKS_TTL_MS = 24 * 60 * 60 * 1000; // ранги меняются разве что с сезоном
const DISTRIBUTION_TTL_MS = 6 * 60 * 60 * 1000; // состав игроков по рангам меняется медленно

/**
 * Оставляем название, цвет и картинки бейджей по подрангам — остальное (chalk, png/webp-дубли) не нужно.
 * @returns {Array<{ tier: number, name: string, color: string|null, large: string|null, sub: Record<number, string|null> }>}
 */
export function slimRanks(list) {
  return (Array.isArray(list) ? list : []).map((rank) => ({
    tier: rank.tier,
    name: rank.name,
    color: rank.color ?? null,
    large: rank.images?.large_webp ?? rank.images?.large ?? null,
    sub: Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((n) => [n, rank.images?.[`small_subrank${n}_webp`] ?? rank.images?.[`small_subrank${n}`] ?? null]),
    ),
  }));
}

/** Ранги с локализованными названиями (Initiate → Послушник и т.д.). */
export function fetchRanks(language = 'english') {
  return httpGet(`${ASSETS_API_BASE}/v1/assets/ranks?language=${language}`, {
    cacheKey: `ranks_${language}`,
    ttl: RANKS_TTL_MS,
    transform: slimRanks,
  });
}

/**
 * Сколько игроков на каждом ранге: по тирам и подрангам (ответ — около 3 КБ).
 * @returns {Promise<ReturnType<typeof slimDistribution>>}
 */
export function fetchRankDistribution() {
  return httpGet(`${API_BASE}/v1/players/rank/distribution`, {
    cacheKey: 'rank_distribution_v1',
    ttl: DISTRIBUTION_TTL_MS,
    transform: slimDistribution,
  });
}
