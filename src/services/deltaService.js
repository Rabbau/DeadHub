/**
 * @fileoverview Изменение статистики героев к прошлому периоду: какое окно сравнивать, Δ винрейта
 * и пикрейта, проверка на значимость и «победители / проигравшие». Без React и без API.
 *
 * Разница в процентах без оговорок вводит в заблуждение: при выборке в сотни матчей винрейт «скачет» на
 * несколько пунктов просто от случайности. Поэтому у каждой Δ есть два признака:
 * - reliable — у героя достаточно матчей в обоих периодах (иначе Δ не показываем вовсе);
 * - significant — разница выходит за 95% доверительный интервал (|z| ≥ 1,96), то есть, скорее всего, не шум.
 */
import { PATCH_PERIOD, periodStart } from './statsFilters.js';

const DAY_S = 24 * 60 * 60;

/** Меньше стольких матчей у героя в любом из двух периодов — Δ не считаем. */
export const MIN_DELTA_MATCHES = 300;

/** |z| от этого значения — разница значима на уровне 95%. */
export const Z_SIGNIFICANT = 1.96;

/**
 * Окно прошлого периода, с которым сравнивается текущий.
 * - «с патча» → от предыдущего обновления до текущего (null, если предыдущего в списке нет);
 * - N дней → N дней перед текущим периодом, того же размера.
 * Границы округлены так же, как у текущего периода, поэтому адрес запроса не меняется в течение суток.
 * @param {{ period: number|'patch', since?: number }} filters
 * @param {Array<{ at: number, title?: string }>} [patches] обновления игры, новые сверху
 * @param {number} [nowMs]
 * @returns {{ since: number, until: number, kind: 'patch'|'days', title?: string }|null}
 */
export function previousWindow(filters, patches = [], nowMs = Date.now()) {
  if (filters.period === PATCH_PERIOD) {
    const previous = (Array.isArray(patches) ? patches : []).find((patch) => patch.at < filters.since);
    return previous ? { since: previous.at, until: filters.since, kind: 'patch', title: previous.title } : null;
  }
  const until = periodStart(filters.period, nowMs);
  return { since: until - filters.period * DAY_S, until, kind: 'days' };
}

/**
 * Δ каждого героя между двумя периодами.
 * @param {{ total: number, byHero: Record<number, { matches: number, wins: number }> }} current
 * @param {{ total: number, byHero: Record<number, { matches: number, wins: number }> }} previous
 * @param {{ minMatches?: number }} [options]
 * @returns {Record<number, {
 *   dWr: number, dPr: number, wr0: number, pr0: number, matches0: number, z: number, reliable: boolean, significant: boolean
 * }>} dWr и dPr — доли (0,012 = +1,2 п. п.), wr0/pr0 — значения в прошлом периоде
 */
export function computeHeroDeltas(current, previous, { minMatches = MIN_DELTA_MATCHES } = {}) {
  const deltas = {};
  const currentTotal = current?.total ?? 0;
  const previousTotal = previous?.total ?? 0;

  Object.entries(current?.byHero ?? {}).forEach(([id, now]) => {
    const before = previous?.byHero?.[id];
    if (!before) return;

    const n1 = now.matches;
    const n0 = before.matches;
    const wr1 = n1 > 0 ? now.wins / n1 : 0;
    const wr0 = n0 > 0 ? before.wins / n0 : 0;
    const reliable = n1 >= minMatches && n0 >= minMatches;

    // Стандартная ошибка разности двух долей
    const se = reliable ? Math.sqrt((wr1 * (1 - wr1)) / n1 + (wr0 * (1 - wr0)) / n0) : 0;
    const z = se > 0 ? (wr1 - wr0) / se : 0;

    deltas[id] = {
      dWr: wr1 - wr0,
      dPr: (currentTotal > 0 ? n1 / currentTotal : 0) - (previousTotal > 0 ? n0 / previousTotal : 0),
      wr0,
      pr0: previousTotal > 0 ? n0 / previousTotal : 0,
      matches0: n0,
      z,
      reliable,
      significant: reliable && Math.abs(z) >= Z_SIGNIFICANT,
    };
  });

  return deltas;
}

/**
 * Герои, у которых винрейт заметно вырос и заметно упал. В списки попадают только значимые изменения:
 * иначе «победителем» мог бы стать герой, у которого просто выпала удачная неделя.
 * @param {ReturnType<typeof computeHeroDeltas>} deltas
 * @param {{ count?: number }} [options]
 * @returns {{ winners: Array<{ id: number } & ReturnType<typeof computeHeroDeltas>[number]>, losers: Array<{ id: number } & ReturnType<typeof computeHeroDeltas>[number]> }}
 */
export function winnersLosers(deltas, { count = 5 } = {}) {
  const entries = Object.entries(deltas ?? {})
    .filter(([, delta]) => delta.significant)
    .map(([id, delta]) => ({ id: Number(id), ...delta }));

  return {
    winners: entries.filter((e) => e.dWr > 0).sort((a, b) => b.dWr - a.dWr).slice(0, count),
    losers: entries.filter((e) => e.dWr < 0).sort((a, b) => a.dWr - b.dWr).slice(0, count),
  };
}

/** Направление изменения для оформления: 'up' | 'down' | 'flat'. */
export function deltaDirection(delta) {
  if (!delta || !delta.reliable) return 'flat';
  if (delta.dWr > 0) return 'up';
  if (delta.dWr < 0) return 'down';
  return 'flat';
}
