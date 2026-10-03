/**
 * @fileoverview История матчей игрока → форма: серия результатов, скользящий винрейт, тренд и ход ранга.
 * Работает со строками fetchMatchHistory (новые сверху). Без React и без API.
 *
 * История матчей — единственный полный и свежий источник по игроку: она приходит из Steam, а не из аналитики API,
 * которая знает только принятые в неё матчи. Поэтому «форма» и сравнение с метой считаются по ней.
 */
import { badgeSubtier, badgeTier } from './rankService.js';

/** match_mode в истории: 1 — обычный, 2 — кастомный, 3 — с ботами, 4 — рейтинг. */
export const MODE_UNRANKED = 1;
export const MODE_RANKED = 4;
/** game_mode в истории: 1 — обычный режим, 4 — Street Brawl. */
export const GAME_MODE_NORMAL = 1;

/** Меньше стольких матчей кривую формы не рисуем: на горстке игр скользящее среднее — одни колебания. */
export const MIN_FORM_MATCHES = 15;
/** Окно скользящего винрейта и сколько последних матчей уходит на график. */
export const FORM_WINDOW = 10;
export const FORM_LIMIT = 100;
/** Сколько матчей берём для «сейчас» и «до этого» в тренде. */
export const TREND_WINDOW = 20;
/** Тренд считаем только если «до этого» набралось хотя бы столько матчей. */
export const TREND_MIN_PREVIOUS = 10;
/** Порог заметности изменения (z-оценка разницы долей побед): ≈ 90% уверенности в одну сторону. */
export const TREND_Z = 1.28;

/**
 * Матч идёт в статистику героев и форму: рейтинг или обычная игра в основном режиме. Матчи с ботами, кастомные
 * игры и Street Brawl сюда не входят — аналитика API (с которой сравниваем) считает по умолчанию то же самое.
 * У записей кеша прежнего формата режима игры нет — их считаем обычными.
 * @param {{ mode: number, gameMode?: number|null }} row
 */
export function isStatsMatch(row) {
  const normal = row.gameMode == null || row.gameMode === GAME_MODE_NORMAL;
  return normal && (row.mode === MODE_RANKED || row.mode === MODE_UNRANKED);
}

/**
 * Матчи для статистики и формы, порядок сохраняется. `sinceSec` — не старше этого момента (unix-секунды).
 * @template {{ mode: number, gameMode?: number|null, at: number }} T
 * @param {T[]} history
 * @param {number} [sinceSec]
 * @returns {T[]}
 */
export function statsMatches(history, sinceSec = 0) {
  return (history || []).filter((row) => isStatsMatch(row) && row.at >= sinceSec);
}

/**
 * Итоги по набору матчей. KDA — отношение сумм, как у summarizeHeroStats.
 * @param {Array<{ win: boolean, kills: number, deaths: number, assists: number }>} rows
 */
export function summarizeRows(rows) {
  const total = { matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
  for (const row of rows) {
    total.matches += 1;
    if (row.win) total.wins += 1;
    total.kills += row.kills;
    total.deaths += row.deaths;
    total.assists += row.assists;
  }
  return {
    ...total,
    winrate: total.matches ? total.wins / total.matches : 0,
    kda: total.matches ? (total.kills + total.assists) / Math.max(1, total.deaths) : 0,
  };
}

/**
 * Текущая серия: сколько последних матчей подряд закончились одинаково.
 * @param {Array<{ win: boolean }>} rows новые сверху
 * @returns {{ win: boolean, length: number }|null}
 */
export function currentStreak(rows) {
  if (!rows.length) return null;
  const win = rows[0].win;
  let length = 0;
  while (length < rows.length && rows[length].win === win) length += 1;
  return { win, length };
}

/**
 * Скользящий винрейт по последним матчам, от старых к новым: точка i — доля побед в окне из `window` матчей,
 * заканчивающемся на i-м. Пока матчей меньше MIN_FORM_MATCHES, кривой нет.
 * @param {Array<{ win: boolean, at: number }>} rows новые сверху
 * @param {{ window?: number, limit?: number }} [options]
 * @returns {Array<{ at: number, winrate: number }>}
 */
export function formSeries(rows, { window = FORM_WINDOW, limit = FORM_LIMIT } = {}) {
  if (rows.length < Math.max(MIN_FORM_MATCHES, window)) return [];
  const chronological = rows.slice(0, limit + window - 1).reverse();
  const points = [];
  let wins = 0;
  for (let i = 0; i < chronological.length; i++) {
    if (chronological[i].win) wins += 1;
    if (i >= window && chronological[i - window].win) wins -= 1;
    if (i >= window - 1) points.push({ at: chronological[i].at, winrate: wins / window });
  }
  return points;
}

/**
 * Заметно ли изменилась форма: последние матчи против предыдущих такого же размера. Разницу долей побед
 * проверяем z-критерием, чтобы случайные колебания на двадцати играх не выдавать за «упал» или «растёт».
 * @param {Array<{ win: boolean, kills: number, deaths: number, assists: number }>} rows новые сверху
 * @param {number} [window]
 * @returns {{ recent: ReturnType<typeof summarizeRows>, previous: ReturnType<typeof summarizeRows>, deltaWinrate: number, deltaKda: number, z: number, verdict: 'up'|'down'|'steady' }|null}
 */
export function formTrend(rows, window = TREND_WINDOW) {
  const recent = summarizeRows(rows.slice(0, window));
  const previous = summarizeRows(rows.slice(window, window * 2));
  if (recent.matches < window || previous.matches < TREND_MIN_PREVIOUS) return null;

  const deltaWinrate = recent.winrate - previous.winrate;
  const pooled = (recent.wins + previous.wins) / (recent.matches + previous.matches);
  const spread = Math.sqrt(pooled * (1 - pooled) * (1 / recent.matches + 1 / previous.matches));
  // Все победы или все поражения в обеих выборках: разброса нет, значит и «заметного» изменения нет
  const z = spread > 0 ? deltaWinrate / spread : 0;
  const verdict = z >= TREND_Z ? 'up' : z <= -TREND_Z ? 'down' : 'steady';
  return { recent, previous, deltaWinrate, deltaKda: recent.kda - previous.kda, z, verdict };
}

/** Место бейджа на общей шкале: tier 1..11 × subtier 1..6 → 0..65. */
export function badgePosition(badge) {
  return (badgeTier(badge) - 1) * 6 + (badgeSubtier(badge) - 1);
}

/**
 * Ранг по рейтинговым матчам, от старых к новым: бейдж, который показывался игроку после матча. Подряд идущие
 * одинаковые бейджи схлопываются: остаются момент каждой смены ранга и последний рейтинговый матч (чтобы линия
 * дотянулась до «сейчас»).
 * @param {Array<{ at: number, mode: number, badge: number|null }>} history
 * @returns {Array<{ at: number, badge: number }>}
 */
export function rankSteps(history) {
  const ranked = (history || [])
    .filter((row) => row.mode === MODE_RANKED && row.badge)
    .sort((a, b) => a.at - b.at);
  const steps = [];
  for (const row of ranked) {
    if (!steps.length || steps[steps.length - 1].badge !== row.badge) steps.push({ at: row.at, badge: row.badge });
  }
  const last = ranked[ranked.length - 1];
  if (last && last.at > steps[steps.length - 1].at) steps.push({ at: last.at, badge: last.badge });
  return steps;
}
