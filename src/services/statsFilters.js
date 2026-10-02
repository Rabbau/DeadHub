/**
 * @fileoverview Фильтры статистики (период + диапазон рангов) и их перевод
 * в query-параметры analytics API. Не знает ни про React, ни про fetch.
 *
 * Период — это либо число дней (7/14/30/90), либо 'patch': «с последнего обновления».
 * Для 'patch' время обновления хранится прямо в фильтрах (`since`, unix-секунды), поэтому
 * ключ кеша и запрос к API однозначно определяются самим объектом фильтров.
 */
import { isFreshPatch } from './patchService.js';

/** Доступные периоды, дни. */
export const PERIODS = [7, 14, 30, 90];
export const DEFAULT_PERIOD = 30; // так же, как по умолчанию у API
export const PATCH_PERIOD = 'patch';

/** Тиры рангов: 1 (Initiate) … 11 (Eternus). Badge = tier * 10 + subtier (1..6). */
export const MIN_TIER = 1;
export const MAX_TIER = 11;

export const DEFAULT_FILTERS = { period: DEFAULT_PERIOD, rankMin: MIN_TIER, rankMax: MAX_TIER };

/**
 * Готовые диапазоны рангов. Тиров 11 — делим 4 + 4 + 2 + 1: низкие (Initiate–Sentinel), средние
 * (Mystic–Oracle), высокие (Phantom–Ascendant) и отдельно Eternus: там матчей меньше всего,
 * и цифры «шумят» сильнее всего. Один выбор вместо двух списков — и один запрос вместо двух.
 */
export const RANK_PRESETS = [
  { id: 'all', min: MIN_TIER, max: MAX_TIER },
  { id: 'low', min: 1, max: 4 },
  { id: 'mid', min: 5, max: 8 },
  { id: 'high', min: 9, max: 10 },
  { id: 'eternus', min: 11, max: 11 },
];

/** Какой готовый диапазон рангов выбран сейчас (его id) или null, если диапазон свой. */
export function activeRankPreset(filters) {
  const preset = RANK_PRESETS.find((p) => p.min === filters.rankMin && p.max === filters.rankMax);
  return preset ? preset.id : null;
}

const DAY_S = 24 * 60 * 60;

/** Целое число или NaN. */
function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Приводит произвольный объект (например, из localStorage) к валидным фильтрам.
 * @param {any} raw
 * @returns {{ period: number|'patch', since?: number, rankMin: number, rankMax: number }}
 */
export function normalizeFilters(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const a = clamp(Number.isNaN(toInt(src.rankMin)) ? MIN_TIER : toInt(src.rankMin), MIN_TIER, MAX_TIER);
  const b = clamp(Number.isNaN(toInt(src.rankMax)) ? MAX_TIER : toInt(src.rankMax), MIN_TIER, MAX_TIER);
  const rank = { rankMin: Math.min(a, b), rankMax: Math.max(a, b) };

  // «С патча» без времени обновления смысла не имеет — тогда возвращаемся к периоду по умолчанию
  const since = toInt(src.since);
  if (src.period === PATCH_PERIOD && since > 0) {
    return { period: PATCH_PERIOD, since, ...rank };
  }

  const period = toInt(src.period);
  return { period: PERIODS.includes(period) ? period : DEFAULT_PERIOD, ...rank };
}

export function isRankFiltered(filters) {
  return filters.rankMin > MIN_TIER || filters.rankMax < MAX_TIER;
}

/**
 * Фильтры по умолчанию. Пока последнее обновление свежее, окно «30 дней» наполовину состоит из
 * данных до патча (другие герои, предметы, карта), поэтому по умолчанию берём «с патча».
 * @param {{ at: number }|null} patch
 * @param {number} [nowMs]
 */
export function defaultFiltersFor(patch, nowMs = Date.now()) {
  if (isFreshPatch(patch, nowMs)) {
    return { period: PATCH_PERIOD, since: patch.at, rankMin: MIN_TIER, rankMax: MAX_TIER };
  }
  return DEFAULT_FILTERS;
}

/** Совпадают ли фильтры с теми, что действуют по умолчанию (для кнопки «Сброс»). */
export function isDefaultFilters(filters, defaults = DEFAULT_FILTERS) {
  return filtersKey(filters) === filtersKey(defaults);
}

/** Стабильная строка для ключей кеша и зависимостей эффектов. */
export function filtersKey(filters) {
  const period = filters.period === PATCH_PERIOD ? `p${filters.since}` : `${filters.period}d`;
  return `${period}_r${filters.rankMin}-${filters.rankMax}`;
}

/**
 * Начало периода в unix-секундах, округлённое до суток (UTC).
 * Без округления URL менялся бы каждую секунду, и ни кеш браузера, ни CDN не срабатывали бы.
 * @param {number} days
 * @param {number} [nowMs]
 */
export function periodStart(days, nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / DAY_S) * DAY_S - days * DAY_S;
}

/**
 * Query-параметры analytics API для текущих фильтров.
 * Диапазон «все ранги» параметров не добавляет — так в выборку попадают и матчи без бейджа.
 * @param {{ period: number|'patch', since?: number, rankMin: number, rankMax: number }} filters
 * @param {number} [nowMs]
 */
export function toStatsParams(filters, nowMs) {
  // Время обновления одинаково у всех посетителей, поэтому округлять его до суток не нужно:
  // запросы всё равно совпадают и кешируются
  const since = filters.period === PATCH_PERIOD ? filters.since : periodStart(filters.period, nowMs);
  const params = { min_unix_timestamp: since };
  if (isRankFiltered(filters)) {
    params.min_average_badge = filters.rankMin * 10 + 1;
    params.max_average_badge = filters.rankMax * 10 + 6;
  }
  return params;
}

/** Собирает query-строку, пропуская пустые значения. */
export function toQueryString(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  return qs.toString();
}
