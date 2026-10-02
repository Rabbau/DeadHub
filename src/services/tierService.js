/**
 * @fileoverview Тир-лист по данным. Формула открытая и целиком описана здесь же — сайт показывает её посетителю:
 *
 *   оценка = 0,8 × процентиль винрейта + 0,2 × процентиль пикрейта (среди героев с достаточной выборкой);
 *   S — лучшие 10% героев по оценке, A — следующие 20%, B — 40%, C — 20%, D — последние 10%.
 *
 * Тиры относительны: S — не «сильный герой вообще», а «в лучшей десятке сегодняшней меты». Поэтому рядом
 * с тир-листом считается и разброс винрейта между лучшим и худшим героем. Без React и без API.
 */

export const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

/** Доля героев в каждом тире (по порядку TIER_ORDER); в сумме 1. */
export const TIER_SHARES = [0.1, 0.2, 0.4, 0.2, 0.1];

/** Вес показателей в оценке; в сумме 1. */
export const SCORE_WEIGHTS = { winrate: 0.8, pickrate: 0.2 };

// Герой попадает в тир-лист, если у него не меньше этой доли пиков выборки (и не меньше пола):
// иначе при узких фильтрах в верх списка выскакивали бы герои с горсткой матчей
export const MIN_SHARE = 0.004;
export const MIN_GAMES_FLOOR = 30;

/**
 * Процентили значений: 0 — наименьшее, 1 — наибольшее. Равные значения получают общий (средний) ранг.
 * @param {number[]} values
 * @returns {number[]} в том же порядке, что values
 */
export function percentileRanks(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];

  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array(n);
  let start = 0;
  while (start < n) {
    let end = start;
    while (end + 1 < n && order[end + 1].value === order[start].value) end++;
    const average = (start + end) / 2; // равные значения делят места поровну
    for (let i = start; i <= end; i++) ranks[order[i].index] = average / (n - 1);
    start = end + 1;
  }
  return ranks;
}

/**
 * Сколько матчей героя достаточно для тир-листа при данной выборке.
 * @param {number} totalPicks сумма матчей всех героев
 */
export function minGamesFor(totalPicks) {
  return Math.max(MIN_GAMES_FLOOR, Math.round(totalPicks * MIN_SHARE));
}

/**
 * Границы тиров по числу героев: накопленные доли округляются, поэтому ни один герой не теряется.
 * 38 героев → S 4, A 7, B 16, C 7, D 4.
 * @param {number} n
 * @param {number[]} [shares]
 * @returns {number[]} размеры тиров по порядку
 */
export function tierSizes(n, shares = TIER_SHARES) {
  const sizes = [];
  let previous = 0;
  let cumulative = 0;
  shares.forEach((share, i) => {
    cumulative += share;
    const edge = i === shares.length - 1 ? n : Math.round(n * cumulative);
    sizes.push(edge - previous);
    previous = edge;
  });
  return sizes;
}

/**
 * Тир-лист из героев со статистикой.
 * @param {Array<{ id: number, released?: boolean, stats: { winrate: number, pickrate: number, games_played: number } }>} heroes
 * @param {{ weights?: { winrate: number, pickrate: number }, shares?: number[] }} [options]
 * @returns {{
 *   tiers: Record<string, Array<object>>,
 *   ranked: Array<{ hero: object, tier: string, score: number, wrPct: number, prPct: number, rank: number }>,
 *   excluded: Array<object>,
 *   minGames: number,
 *   spread: { best: number, worst: number }|null
 * }} excluded — герои без достаточной выборки; spread — винрейт лучшего и худшего героя тир-листа
 */
export function buildTierList(heroes, { weights = SCORE_WEIGHTS, shares = TIER_SHARES } = {}) {
  const released = heroes.filter((hero) => hero.released !== false);
  const total = released.reduce((sum, hero) => sum + hero.stats.games_played, 0);
  const minGames = minGamesFor(total);

  const eligible = released.filter((hero) => hero.stats.games_played >= minGames);
  const excluded = released.filter((hero) => hero.stats.games_played < minGames);

  const wrPct = percentileRanks(eligible.map((hero) => hero.stats.winrate));
  const prPct = percentileRanks(eligible.map((hero) => hero.stats.pickrate));

  const scored = eligible
    .map((hero, i) => ({
      hero,
      wrPct: wrPct[i],
      prPct: prPct[i],
      score: weights.winrate * wrPct[i] + weights.pickrate * prPct[i],
    }))
    // При равной оценке выше тот, у кого больше винрейт, затем — по названию: порядок не «прыгает»
    .sort((a, b) => b.score - a.score || b.hero.stats.winrate - a.hero.stats.winrate || a.hero.name.localeCompare(b.hero.name));

  const sizes = tierSizes(scored.length, shares);
  const tiers = Object.fromEntries(TIER_ORDER.map((tier) => [tier, []]));
  const ranked = [];
  let cursor = 0;
  TIER_ORDER.forEach((tier, tierIndex) => {
    for (let k = 0; k < sizes[tierIndex]; k++) {
      const entry = { ...scored[cursor], tier, rank: cursor + 1 };
      tiers[tier].push(entry);
      ranked.push(entry);
      cursor++;
    }
  });

  const winrates = eligible.map((hero) => hero.stats.winrate);
  return {
    tiers,
    ranked,
    excluded,
    minGames,
    spread: winrates.length ? { best: Math.max(...winrates), worst: Math.min(...winrates) } : null,
  };
}
