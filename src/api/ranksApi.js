import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';

const RANKS_TTL_MS = 24 * 60 * 60 * 1000; // ранги меняются разве что с сезоном

/**
 * Оставляем название, цвет и картинки бейджей по подрангам — остальное (chalk, png/webp-дубли) не нужно.
 * @returns {Array<{ tier: number, name: string, color: string|null, large: string|null, sub: Record<number, string|null> }>}
 */
function slimRanks(list) {
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
