/**
 * @fileoverview Ход матча: средние души (и убийства, смерти, помощь) игрока по ходу игры рядом со средним игроком его
 * ранга. Без React и без API.
 *
 * player-performance-curve делит каждый матч на равные доли (по умолчанию десятую часть: 0%, 10% … 100%) и отдаёт
 * среднее значение на каждой. Считается по матчам, которые знает аналитика API (не по всей истории), поэтому это
 * «типичный матч игрока», а не итог его игры. Рядом с кривой игрока строится такая же по диапазону рангов (без
 * фильтра по игроку): так видно, раньше или позже, чем у среднего игрока ранга, растёт у него число душ.
 */

/** Меньше стольких долей матча кривую не рисуем. */
export const CURVE_MIN_POINTS = 5;
/** За сколько дней берутся матчи (по умолчанию API отдаёт 30 — на 90 у играющего не каждый день игрока набирается больше). */
export const CURVE_DAYS = 90;

/** Число или null: пустое значение (null, '', true) числом не считается, хотя Number(null) — это 0. */
function finite(value) {
  if (value === null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Ответ player-performance-curve → точки по возрастанию доли матча: { at (проценты 0..100), souls, kills, deaths, assists }.
 * Строки без числа душ и без доли матча отбрасываются.
 * @param {any} rows
 * @returns {Array<{ at: number, souls: number, kills: number, deaths: number, assists: number }>}
 */
export function slimCurve(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      at: finite(row?.game_time),
      souls: finite(row?.net_worth_avg),
      kills: finite(row?.kills_avg) ?? 0,
      deaths: finite(row?.deaths_avg) ?? 0,
      assists: finite(row?.assists_avg) ?? 0,
    }))
    .filter((point) => point.at != null && point.souls != null)
    .sort((a, b) => a.at - b.at);
}

/** Есть ли у кривой смысл: достаточно долей матча и к концу не нулевые души. */
export function isUsableCurve(curve) {
  return Array.isArray(curve) && curve.length >= CURVE_MIN_POINTS && curve[curve.length - 1].souls > 0;
}

/**
 * Итоги кривой игрока рядом с кривой ранга: значения в конце матча и отношение. Без кривой ранга (у игрока нет
 * ранга или её не загрузили) `average` пустой, а отношения нет.
 * @param {ReturnType<typeof slimCurve>} player
 * @param {ReturnType<typeof slimCurve>|null} average
 * @returns {null|{ rows: Array<{ key: 'souls'|'kills'|'deaths'|'assists', player: number, average: number|null, ratio: number|null }> }}
 */
export function compareCurves(player, average) {
  if (!isUsableCurve(player)) return null;
  const end = player[player.length - 1];
  const rankEnd = isUsableCurve(average) ? average[average.length - 1] : null;
  const row = (key) => ({
    key,
    player: end[key],
    average: rankEnd ? rankEnd[key] : null,
    // «Во сколько раз»: у убийств и помощи среднее в конце матча бывает нулевым — тогда отношения нет
    ratio: rankEnd && rankEnd[key] > 0 ? end[key] / rankEnd[key] : null,
  });
  return { rows: ['souls', 'kills', 'deaths', 'assists'].map(row) };
}

/**
 * Общие пределы оси Y для двух кривых, чтобы они рисовались в одном масштабе, с запасом по краям.
 * @param {Array<{ souls: number }>} player
 * @param {Array<{ souls: number }>|null} average
 */
export function soulsRange(player, average) {
  const values = [...player, ...(average ?? [])].map((point) => point.souls);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.08, 1);
  return { min: Math.max(0, lo - margin), max: hi + margin };
}
