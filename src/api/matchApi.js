import { httpGet } from './httpClient.js';
import { API_BASE } from './config.js';
import { slimMatch } from '../services/matchService.js';

// Закончившийся матч не меняется. Ответ весит около мегабайта, в кеш попадает облегчённый вид (десятки КБ):
// неделя в кеше — и повторное открытие матча не стоит запроса к бесплатному API
const MATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Матч целиком: игроки, предметы, душа по времени, убийства, объекты (см. slimMatch).
 * Ошибка с status 404/400 — такого матча нет (или он ещё не попал в базу).
 * @param {number|string} matchId
 */
export function fetchMatch(matchId) {
  return httpGet(`${API_BASE}/v1/matches/${matchId}/metadata`, {
    cacheKey: `match_v1_${matchId}`,
    ttl: MATCH_TTL_MS,
    transform: slimMatch,
  });
}
