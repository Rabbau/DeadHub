import { httpGet } from './httpClient.js';
import { API_BASE } from './config.js';
import { slimActiveMatches, slimBroadcasts } from '../services/liveService.js';

// Данные «прямо сейчас»: в localStorage их не кладём (через две минуты они устарели бы, а матчей в ответе на
// сотни килобайт). Повторные запросы в пределах минуты отвечает кеш браузера и CDN Vercel (vercel.json).

/**
 * Идущие матчи из вкладки «Смотреть» игры (не больше двухсот), см. slimActiveMatches.
 * @returns {Promise<ReturnType<typeof slimActiveMatches>>}
 */
export function fetchActiveMatches() {
  return httpGet(`${API_BASE}/v1/matches/active`, { cache: false, transform: slimActiveMatches });
}

/**
 * Адреса трансляций идущих матчей, см. slimBroadcasts.
 * @returns {Promise<ReturnType<typeof slimBroadcasts>>}
 */
export function fetchBroadcastUrls() {
  return httpGet(`${API_BASE}/v1/matches/live/urls`, { cache: false, transform: slimBroadcasts });
}
