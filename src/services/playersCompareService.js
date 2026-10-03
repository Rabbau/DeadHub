/**
 * @fileoverview Сравнение двух игроков: сводка каждого, строки таблицы с отметкой «кто впереди» и общие герои.
 * Без React и без API.
 *
 * Сравнивается только то, что есть у обоих и честно сопоставимо: ранг, винрейт и KDA по аналитике API, точность и
 * форма по последним матчам из истории. «Впереди» не ставится, если разница меньше порога шума, и вообще не ставится
 * там, где больше — не значит лучше (число матчей, дата последнего).
 */
import { summarizeHeroStats } from './playerService.js';
import { statsMatches, summarizeRows, TREND_WINDOW } from './playerHistoryService.js';

/** Сколько последних матчей берём в «форму» и сколько нужно, чтобы её показывать. */
export const RECENT_WINDOW = TREND_WINDOW;
export const RECENT_MIN = 8;
/** Общий герой попадает в сравнение, если у каждого игрока на нём не меньше стольких матчей. */
export const SHARED_HERO_MIN = 3;
export const SHARED_HERO_LIMIT = 8;

/** Различия меньше этих порогов — шум, «впереди» не отмечается. */
const EPSILON = { pct: 0.005, kda: 0.05, rank: 0, int: 0 };

/**
 * Account ID из параметра адреса: только цифры, как в адресе страницы игрока.
 * @param {string|null|undefined} raw
 * @returns {number|null}
 */
export function parseAccountParam(raw) {
  if (!/^\d{1,10}$/.test(String(raw ?? ''))) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

/**
 * Сводка игрока для сравнения.
 * @param {number} accountId
 * @param {{ steam: any, rank: any, history: any[], heroStats: any[] }} profile то, что отдаёт usePlayerProfile
 */
export function playerSnapshot(accountId, { steam, rank, history, heroStats }) {
  const summary = summarizeHeroStats(heroStats);
  const recentRows = statsMatches(history).slice(0, RECENT_WINDOW);
  const recent = summarizeRows(recentRows);
  return {
    id: accountId,
    name: steam?.name ?? `#${accountId}`,
    avatar: steam?.avatar ?? null,
    // Ранг из эндпоинта rank, а если его нет — из последнего рейтингового матча (так же, как на странице игрока)
    badge: rank?.badge ?? history.find((row) => row.badge)?.badge ?? null,
    matches: summary.matches || history.length,
    winrate: summary.matches ? summary.winrate : null,
    kda: summary.matches ? summary.kda : null,
    accuracy: summary.accuracy || null,
    recent: recent.matches >= RECENT_MIN ? { matches: recent.matches, winrate: recent.winrate, kda: recent.kda } : null,
    lastMatchAt: history[0]?.at ?? null,
    heroes: heroStats,
  };
}

/** Кто впереди по значению: 'a' | 'b' | null (поровну, шум или нет данных у одного из двоих). */
function leader(a, b, epsilon) {
  if (a == null || b == null) return null;
  if (Math.abs(a - b) <= epsilon) return null;
  return a > b ? 'a' : 'b';
}

/**
 * Строки таблицы сравнения. `type` подсказывает, как форматировать значения; `lead` — кто впереди.
 * @param {ReturnType<typeof playerSnapshot>} a
 * @param {ReturnType<typeof playerSnapshot>} b
 * @returns {Array<{ key: string, type: 'rank'|'int'|'pct'|'kda'|'date', a: number|null, b: number|null, lead: 'a'|'b'|null, scored: boolean }>}
 */
export function compareRows(a, b) {
  const row = (key, type, left, right, higherIsBetter) => ({
    key,
    type,
    a: left ?? null,
    b: right ?? null,
    lead: higherIsBetter ? leader(left, right, EPSILON[type] ?? 0) : null,
    // Строка идёт в общий счёт «кто впереди», только если «больше» значит «лучше» и данные есть у обоих
    scored: higherIsBetter && left != null && right != null,
  });
  return [
    row('rank', 'rank', a.badge, b.badge, true),
    row('matches', 'int', a.matches, b.matches, false),
    row('winrate', 'pct', a.winrate, b.winrate, true),
    row('kda', 'kda', a.kda, b.kda, true),
    row('accuracy', 'pct', a.accuracy, b.accuracy, true),
    row('recentWinrate', 'pct', a.recent?.winrate, b.recent?.winrate, true),
    row('recentKda', 'kda', a.recent?.kda, b.recent?.kda, true),
    row('lastMatch', 'date', a.lastMatchAt, b.lastMatchAt, false),
  ];
}

/**
 * Герои, на которых играли оба: у кого на них результат лучше (поровну — разница меньше двух пунктов).
 * @param {Array<{ heroId: number, matches: number, wins: number }>} left
 * @param {Array<{ heroId: number, matches: number, wins: number }>} right
 * @param {number} [min]
 */
export function sharedHeroes(left, right, min = SHARED_HERO_MIN) {
  const rightById = new Map(right.map((hero) => [hero.heroId, hero]));
  const rows = [];
  for (const hero of left) {
    const other = rightById.get(hero.heroId);
    if (!other || hero.matches < min || other.matches < min) continue;
    const a = { matches: hero.matches, winrate: hero.wins / hero.matches };
    const b = { matches: other.matches, winrate: other.wins / other.matches };
    rows.push({ heroId: hero.heroId, a, b, lead: leader(a.winrate, b.winrate, 0.02) });
  }
  return rows.sort((x, y) => (y.a.matches + y.b.matches) - (x.a.matches + x.b.matches) || x.heroId - y.heroId).slice(0, SHARED_HERO_LIMIT);
}

/**
 * Кто впереди по большему числу строк таблицы — для общей подписи; ничья — null.
 * @param {ReturnType<typeof compareRows>} rows
 * @returns {{ a: number, b: number, lead: 'a'|'b'|null }}
 */
export function tally(rows) {
  const a = rows.filter((row) => row.lead === 'a').length;
  const b = rows.filter((row) => row.lead === 'b').length;
  return { a, b, lead: a === b ? null : a > b ? 'a' : 'b' };
}
