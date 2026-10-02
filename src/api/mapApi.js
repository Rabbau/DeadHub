import { httpGet } from './httpClient.js';
import { ANALYTICS_API_BASE, ASSETS_API_BASE } from './config.js';
import { HEAT_PHASES, slimHeat, slimMap } from '../services/mapService.js';
import { DEFAULT_FILTERS, filtersKey, toQueryString, toStatsParams, withNormalMode } from '../services/statsFilters.js';

// Ключи с суффиксом формата меняем, когда меняется облегчённый вид данных. Карта меняется только с обновлением
// игры, а убийства и смерти за период — медленно; ответ тепловой карты тяжёлый (до 2,3 МБ), а API бесплатный
// и с лимитом запросов, поэтому держим данные в кеше долго.
const MAP_TTL_MS = 6 * 60 * 60 * 1000;
const HEAT_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * Карта города: радиус, картинки миникарты, объекты, зиплайны, лагеря и интерактивные сущности.
 * Ответ ~110 КБ приводим к облегчённому виду (см. slimMap) — в кеш уходит только нужное.
 */
export function fetchMap() {
  return httpGet(`${ASSETS_API_BASE}/v1/assets/map`, {
    cacheKey: 'map_v1',
    ttl: MAP_TTL_MS,
    transform: slimMap,
  });
}

/**
 * Убийства и смерти по клеткам карты за выбранный период и ранги, при желании — в одной фазе матча.
 * Полный ответ ~2,3 МБ, поэтому тянем его только когда слой тепловой карты включён.
 * Всегда по обычным матчам: у Street Brawl другая арена, и убийства на ней не легли бы на карту города.
 * @param {typeof DEFAULT_FILTERS} [filters]
 * @param {keyof typeof HEAT_PHASES} [phase]
 */
export function fetchHeat(filters = DEFAULT_FILTERS, phase = 'all') {
  const normal = withNormalMode(filters);
  const range = HEAT_PHASES[phase] ?? HEAT_PHASES.all;
  const query = toQueryString({
    ...toStatsParams(normal),
    min_game_time_s: range.min,
    max_game_time_s: range.max,
  });
  return httpGet(`${ANALYTICS_API_BASE}/v1/analytics/kill-death-stats?${query}`, {
    cacheKey: `heat_v1_${filtersKey(normal)}_${phase}`,
    ttl: HEAT_TTL_MS,
    transform: (rows) => slimHeat(rows),
  });
}
