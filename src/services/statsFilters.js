/**
 * @fileoverview Фильтры статистики (период + диапазон рангов) и их перевод
 * в query-параметры analytics API. Не знает ни про React, ни про fetch.
 */

/** Доступные периоды, дни. */
export const PERIODS = [7, 14, 30, 90];
export const DEFAULT_PERIOD = 30; // так же, как по умолчанию у API

/** Тиры рангов: 1 (Initiate) … 11 (Eternus). Badge = tier * 10 + subtier (1..6). */
export const MIN_TIER = 1;
export const MAX_TIER = 11;

export const DEFAULT_FILTERS = { period: DEFAULT_PERIOD, rankMin: MIN_TIER, rankMax: MAX_TIER };

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
 * @returns {{ period: number, rankMin: number, rankMax: number }}
 */
export function normalizeFilters(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const period = toInt(src.period);
  const a = clamp(Number.isNaN(toInt(src.rankMin)) ? MIN_TIER : toInt(src.rankMin), MIN_TIER, MAX_TIER);
  const b = clamp(Number.isNaN(toInt(src.rankMax)) ? MAX_TIER : toInt(src.rankMax), MIN_TIER, MAX_TIER);
  return {
    period: PERIODS.includes(period) ? period : DEFAULT_PERIOD,
    rankMin: Math.min(a, b),
    rankMax: Math.max(a, b),
  };
}

export function isRankFiltered(filters) {
  return filters.rankMin > MIN_TIER || filters.rankMax < MAX_TIER;
}

export function isDefaultFilters(filters) {
  return filters.period === DEFAULT_PERIOD && !isRankFiltered(filters);
}

/** Стабильная строка для ключей кеша и зависимостей эффектов. */
export function filtersKey(filters) {
  return `${filters.period}d_r${filters.rankMin}-${filters.rankMax}`;
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
 * @param {{ period: number, rankMin: number, rankMax: number }} filters
 * @param {number} [nowMs]
 */
export function toStatsParams(filters, nowMs) {
  const params = { min_unix_timestamp: periodStart(filters.period, nowMs) };
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
