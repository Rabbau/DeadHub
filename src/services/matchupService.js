/**
 * @fileoverview Матчапы героев: индексы по матрицам counter/synergy, рейтинги и цвет ячеек.
 * Не знает ни про React, ни про API — только про строки вида [heroA, heroB, wins, matches].
 */

/** Минимум матчей, чтобы пара попала в списки «сильны против / лучшие напарники». */
export const MIN_MATCHUP_MATCHES = 100;

/** Выборка, начиная с которой цвет ячейки матрицы показываем в полную силу. */
const FULL_CONFIDENCE_MATCHES = 300;

/**
 * Индекс контрпиков: Map<героя, Map<соперник, { wins, matches, wr }>>. wr — винрейт героя против соперника.
 * @param {Array<[number, number, number, number]>} rows [hero, enemy, wins, matches]
 */
export function buildCounterIndex(rows) {
  const index = new Map();
  rows.forEach(([heroId, enemyId, wins, matches]) => {
    if (!matches) return;
    if (!index.has(heroId)) index.set(heroId, new Map());
    index.get(heroId).set(enemyId, { wins, matches, wr: wins / matches });
  });
  return index;
}

/**
 * Индекс синергии симметричен: пара (A, B) доступна и как A→B, и как B→A.
 * @param {Array<[number, number, number, number]>} rows [heroA, heroB, wins, matches]
 */
export function buildSynergyIndex(rows) {
  const index = new Map();
  const put = (a, b, wins, matches) => {
    if (!index.has(a)) index.set(a, new Map());
    index.get(a).set(b, { wins, matches, wr: wins / matches });
  };
  rows.forEach(([a, b, wins, matches]) => {
    if (!matches) return;
    put(a, b, wins, matches);
    put(b, a, wins, matches);
  });
  return index;
}

/**
 * Лучшие или худшие пары героя.
 * @param {Map<number, { wins: number, matches: number, wr: number }>|undefined} entries
 * @param {{ min?: number, limit?: number, order?: 'desc'|'asc' }} [options]
 * @returns {Array<{ id: number, wins: number, matches: number, wr: number }>}
 */
export function rankMatchups(entries, { min = MIN_MATCHUP_MATCHES, limit = 5, order = 'desc' } = {}) {
  if (!entries) return [];
  const list = [];
  entries.forEach((value, id) => {
    if (value.matches >= min) list.push({ id, ...value });
  });
  list.sort((a, b) => (order === 'desc' ? b.wr - a.wr : a.wr - b.wr) || b.matches - a.matches);
  return limit ? list.slice(0, limit) : list;
}

/**
 * Цвет ячейки матрицы: зелёный — выгодный матчап, красный — невыгодный.
 * Прозрачность растёт с отклонением от 50% и с размером выборки — шумные ячейки бледнеют.
 * @returns {string|null} null, если данных нет
 */
export function matchupColor(wr, matches) {
  if (!matches) return null;
  const delta = wr - 0.5;
  const strength = Math.min(1, Math.abs(delta) / 0.08);
  const confidence = Math.min(1, matches / FULL_CONFIDENCE_MATCHES);
  const alpha = (0.1 + 0.75 * strength) * confidence;
  const rgb = delta >= 0 ? '189, 255, 50' : '255, 75, 120';
  return `rgba(${rgb}, ${alpha.toFixed(2)})`;
}
