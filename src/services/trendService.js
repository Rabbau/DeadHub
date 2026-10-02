/**
 * @fileoverview Динамика героя по неделям: из ответа hero-stats с недельными корзинами делает
 * ряды винрейта и пикрейта и считает координаты для графика. Без React и без API.
 *
 * API отдаёт одну строку на героя и неделю (`bucket` — начало недели, unix-секунды, воскресенье 00:00 UTC),
 * поэтому история «по дням» дала бы в семь раз больше данных: для динамики хватает недели.
 */

const DAY_S = 24 * 60 * 60;
const WEEK_S = 7 * DAY_S;

/** Сколько недель истории запрашиваем. */
export const TREND_WEEKS = 10;

/** Недели, в которых у героя меньше стольких матчей, на графике не показываем: цифры случайны. */
export const MIN_TREND_MATCHES = 200;

/**
 * Начало окна истории (unix-секунды), округлённое до суток, чтобы адрес запроса не менялся в течение дня.
 * @param {number} [nowMs]
 */
export function trendSince(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / DAY_S) * DAY_S - TREND_WEEKS * WEEK_S;
}

/**
 * Облегчённый вид недельной статистики (в кеш попадает несколько КБ вместо 250 КБ ответа).
 * @param {any[]} rows ответ hero-stats с bucket=start_time_week
 * @returns {{ weeks: number[], total: number[], byHero: Record<number, { matches: number[], wins: number[] }> }}
 *   weeks — начала недель по возрастанию; total — пики всех героев за неделю (для пикрейта);
 *   matches/wins героя выровнены по weeks (нет строки — 0)
 */
export function slimWeeklyStats(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && Number.isFinite(Number(row.bucket)));
  const weeks = [...new Set(list.map((row) => Number(row.bucket)))].sort((a, b) => a - b);
  const index = new Map(weeks.map((week, i) => [week, i]));
  const total = weeks.map(() => 0);
  const byHero = {};

  list.forEach((row) => {
    const i = index.get(Number(row.bucket));
    const matches = row.matches ?? 0;
    total[i] += matches;
    if (!byHero[row.hero_id]) byHero[row.hero_id] = { matches: weeks.map(() => 0), wins: weeks.map(() => 0) };
    byHero[row.hero_id].matches[i] += matches;
    byHero[row.hero_id].wins[i] += row.wins ?? 0;
  });

  return { weeks, total, byHero };
}

/**
 * Точки графика героя: по одной на неделю, в которой достаточно матчей.
 * partial — неделя неполная (окно истории началось посреди неё или она ещё идёт): такая точка менее надёжна.
 * @param {ReturnType<typeof slimWeeklyStats>|null} weekly
 * @param {number} heroId
 * @param {{ sinceSec?: number, nowSec?: number, minMatches?: number }} [options]
 * @returns {Array<{ week: number, wr: number, pr: number, matches: number, partial: boolean }>}
 */
export function heroTrend(weekly, heroId, { sinceSec = 0, nowSec = Date.now() / 1000, minMatches = MIN_TREND_MATCHES } = {}) {
  const hero = weekly?.byHero?.[heroId];
  if (!hero) return [];

  const points = [];
  weekly.weeks.forEach((week, i) => {
    const matches = hero.matches[i];
    if (matches < minMatches) return;
    points.push({
      week,
      matches,
      wr: hero.wins[i] / matches,
      pr: weekly.total[i] > 0 ? matches / weekly.total[i] : 0,
      partial: week < sinceSec || week + WEEK_S > nowSec,
    });
  });
  return points;
}

/**
 * Пределы оси Y с запасом: колебание в один-два пункта должно быть видно, а не прижато к линии.
 * @param {number[]} values
 * @returns {{ min: number, max: number }}
 */
export function axisRange(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.2, Math.abs(hi) * 0.01, 1e-6);
  return { min: lo - margin, max: hi + margin };
}

/**
 * Координаты точек ряда в рамке width × height с полями pad. Одна точка встаёт по центру.
 * @param {number[]} values
 * @param {{ width: number, height: number, pad?: number, min: number, max: number }} frame
 * @returns {Array<{ x: number, y: number }>}
 */
export function scaleSeries(values, { width, height, pad = 8, min, max }) {
  const span = max - min || 1;
  return values.map((value, i) => ({
    x: values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1),
    y: pad + (height - 2 * pad) * (1 - (value - min) / span),
  }));
}

/** Путь SVG через точки (ломаная). */
export function seriesPath(points) {
  const round = (n) => Math.round(n * 10) / 10;
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
}
