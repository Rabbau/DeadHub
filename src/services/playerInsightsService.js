/**
 * @fileoverview Разбор игрока: результаты на героях против меты на его ранге, сильные и слабые стороны, подсказки.
 * Без React и без API.
 *
 * Игрок — это десятки матчей на героя, мета — тысячи, поэтому «винрейт выше среднего» на пяти играх ничего не значит.
 * Каждое сравнение проходит проверку на заметность (z-оценка и минимальная разница), а вывод «сильная»/«слабая»
 * сторона делается только когда отклонение больше случайного разброса. Результаты игрока берутся из истории матчей
 * (полной и свежей), мета — из hero-stats на диапазоне рангов игрока.
 */
import { badgeTier } from './rankService.js';
import { MAX_TIER, MIN_TIER } from './statsFilters.js';
import { isStatsMatch } from './playerHistoryService.js';

export const INSIGHTS = {
  /** За сколько дней берём матчи игрока. */
  WINDOW_DAYS: 90,
  /** Меньше матчей на герое — героя в разборе нет. */
  MIN_MATCHES: 5,
  /** Вывод «сильная»/«слабая» сторона делается только с такого числа матчей: на пяти играх и случайность выглядит закономерностью. */
  VERDICT_MIN_MATCHES: 8,
  /** В мете на герое должно быть столько матчей, иначе сравнивать не с чем. */
  MIN_META_MATCHES: 200,
  /** «Заметно лучше/хуже»: отклонение не меньше полутора стандартных (≈ 7% шанс случайности) и не меньше трёх процентных пунктов. */
  Z: 1.5,
  MIN_DIFF: 0.03,
  /** «Вес» меты в сглаженном винрейте: столько воображаемых матчей с винрейтом меты добавляется игроку. */
  PRIOR: 10,
  /** Герой «ещё не пробовался»: не больше стольких матчей за период. */
  SUGGEST_MAX_PLAYED: 2,
  /** Сколько героев показываем в каждом списке. */
  TOP: 3,
};

const DAY_S = 24 * 60 * 60;

/** Граница периода игрока в unix-секундах. */
export function windowStart(nowMs = Date.now(), days = INSIGHTS.WINDOW_DAYS) {
  return Math.floor(nowMs / 1000) - days * DAY_S;
}

/**
 * Диапазон рангов для меты «на вашем ранге»: тир игрока и по одному соседнему (на одном тире выборка узкая).
 * null — ранга нет или он не из 1..11: тогда сравниваем с метой по всем рангам.
 * @param {number|null|undefined} badge tier * 10 + subtier
 * @returns {{ rankMin: number, rankMax: number }|null}
 */
export function rankBand(badge) {
  const tier = badge ? badgeTier(badge) : 0;
  if (tier < MIN_TIER || tier > MAX_TIER) return null;
  return { rankMin: Math.max(MIN_TIER, tier - 1), rankMax: Math.min(MAX_TIER, tier + 1) };
}

/**
 * Результаты игрока по героям из истории матчей: только матчи для статистики и не старше `sinceSec`.
 * @param {Array<{ heroId: number, at: number, win: boolean, kills: number, deaths: number, assists: number, mode: number, gameMode?: number|null }>} history
 * @param {number} [sinceSec]
 * @returns {Record<number, { heroId: number, matches: number, wins: number, kills: number, deaths: number, assists: number }>}
 */
export function heroResults(history, sinceSec = 0) {
  const byHero = {};
  for (const row of history || []) {
    if (!isStatsMatch(row) || row.at < sinceSec) continue;
    const entry = (byHero[row.heroId] ??= { heroId: row.heroId, matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0 });
    entry.matches += 1;
    if (row.win) entry.wins += 1;
    entry.kills += row.kills;
    entry.deaths += row.deaths;
    entry.assists += row.assists;
  }
  return byHero;
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** 'strong' / 'weak' — отклонение от меты заметнее случайного разброса, иначе 'even'. */
function verdictOf(matches, z, diff) {
  if (matches < INSIGHTS.VERDICT_MIN_MATCHES) return 'even';
  if (z >= INSIGHTS.Z && diff >= INSIGHTS.MIN_DIFF) return 'strong';
  if (z <= -INSIGHTS.Z && diff <= -INSIGHTS.MIN_DIFF) return 'weak';
  return 'even';
}

/**
 * Результаты игрока на каждом герое рядом с метой этого героя на его ранге.
 * Для каждого героя: разница винрейтов, z-оценка (насколько разница больше случайной при таком числе матчей),
 * сглаженный винрейт (игрока тянет к мете, пока матчей мало) и «лишние победы» — сколько побед сверх того, что
 * набрал бы средний игрок на этом герое за столько же матчей (со знаком).
 * @param {ReturnType<typeof heroResults>} results
 * @param {{ byHero: Record<number, { matches: number, wins: number, kills: number, deaths: number, assists: number }> }} meta
 * @param {{ minMatches?: number }} [options]
 */
export function compareWithMeta(results, meta, { minMatches = INSIGHTS.MIN_MATCHES } = {}) {
  const rows = [];
  for (const result of Object.values(results)) {
    if (result.matches < minMatches) continue;
    const base = meta?.byHero?.[result.heroId];
    if (!base || base.matches < INSIGHTS.MIN_META_MATCHES) continue;

    const metaWinrate = base.wins / base.matches;
    const winrate = result.wins / result.matches;
    // Для z нужна «ожидаемая» доля побед; у крайних значений дисперсия вырождается, поэтому берём её в разумных пределах
    const expected = clamp(metaWinrate, 0.2, 0.8);
    const z = (winrate - expected) / Math.sqrt((expected * (1 - expected)) / result.matches);
    const diff = winrate - metaWinrate;

    rows.push({
      heroId: result.heroId,
      matches: result.matches,
      wins: result.wins,
      winrate,
      metaWinrate,
      metaMatches: base.matches,
      diff,
      z,
      adjusted: (result.wins + INSIGHTS.PRIOR * metaWinrate) / (result.matches + INSIGHTS.PRIOR),
      extraWins: result.wins - result.matches * metaWinrate,
      kda: (result.kills + result.assists) / Math.max(1, result.deaths),
      metaKda: (base.kills + base.assists) / Math.max(1, base.deaths),
      verdict: verdictOf(result.matches, z, diff),
    });
  }
  return rows.sort((a, b) => b.matches - a.matches || a.heroId - b.heroId);
}

const roleOf = (hero) => (hero?.role ? String(hero.role).toLowerCase() : null);
const gunOf = (hero) => hero?.stats?.gunTag ?? null;

/**
 * Герои, которых игрок почти не пробовал, но которые сильны в мете его ранга и похожи по роли или по типу
 * стрельбы на героев, у которых у него получается. Образец — сильные стороны игрока, а если их нет — самые
 * играемые герои. Это подсказка по данным, а не прогноз: сходство определяется только ролью и оружием.
 * @param {{ rows: ReturnType<typeof compareWithMeta>, strengths: ReturnType<typeof compareWithMeta>, heroes: any[], results: ReturnType<typeof heroResults>, meta: { byHero: Record<number, { matches: number, wins: number }> } }} input
 * @returns {Array<{ heroId: number, metaWinrate: number, metaMatches: number, roleLike: number|null, gunLike: number|null }>}
 */
export function suggestHeroes({ rows, strengths, heroes, results, meta }) {
  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const anchors = (strengths.length ? strengths : [...rows].sort((a, b) => b.matches - a.matches).slice(0, INSIGHTS.TOP))
    .map((row) => heroById.get(row.heroId))
    .filter(Boolean);
  if (anchors.length === 0) return [];

  const candidates = [];
  for (const hero of heroes) {
    if (!hero.released) continue;
    if ((results[hero.id]?.matches ?? 0) > INSIGHTS.SUGGEST_MAX_PLAYED) continue;
    const base = meta?.byHero?.[hero.id];
    if (!base || base.matches < INSIGHTS.MIN_META_MATCHES) continue;
    const metaWinrate = base.wins / base.matches;
    if (metaWinrate < 0.5) continue;

    const sameRole = roleOf(hero) && anchors.find((anchor) => anchor.id !== hero.id && roleOf(anchor) === roleOf(hero));
    const sameGun = gunOf(hero) && anchors.find((anchor) => anchor.id !== hero.id && gunOf(anchor) === gunOf(hero));
    if (!sameRole && !sameGun) continue;

    candidates.push({
      heroId: hero.id,
      metaWinrate,
      metaMatches: base.matches,
      roleLike: sameRole ? sameRole.id : null,
      gunLike: sameGun ? sameGun.id : null,
      score: metaWinrate + (sameRole ? 0.02 : 0) + (sameGun ? 0.01 : 0),
    });
  }
  return candidates
    .sort((a, b) => b.score - a.score || b.metaMatches - a.metaMatches)
    .slice(0, INSIGHTS.TOP)
    .map(({ score: _score, ...rest }) => rest);
}

/**
 * Сильные и слабые стороны и подсказки (model — на кого похожи подсказки: 'strengths' или 'played'). Сильные — герои с заметно лучшим, чем в мете, результатом, по числу
 * «лишних побед»; слабые — наоборот, по числу побед, которых игроку не хватило до среднего.
 * @param {ReturnType<typeof compareWithMeta>} rows
 * @param {{ heroes?: any[], results?: ReturnType<typeof heroResults>, meta?: any }} [context]
 */
export function buildAdvice(rows, { heroes = [], results = {}, meta = { byHero: {} } } = {}) {
  const strengths = rows
    .filter((row) => row.verdict === 'strong')
    .sort((a, b) => b.extraWins - a.extraWins || b.z - a.z)
    .slice(0, INSIGHTS.TOP);
  const weaknesses = rows
    .filter((row) => row.verdict === 'weak')
    .sort((a, b) => a.extraWins - b.extraWins || a.z - b.z)
    .slice(0, INSIGHTS.TOP);
  const suggestions = suggestHeroes({ rows, strengths, heroes, results, meta });
  // На кого похожи подсказки: на сильные стороны игрока или, когда их нет, на самых играемых героев
  return { strengths, weaknesses, suggestions, model: strengths.length > 0 ? 'strengths' : 'played' };
}
