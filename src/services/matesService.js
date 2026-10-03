/**
 * @fileoverview Напарники и соперники игрока: с кем он чаще играет в одной команде и против кого, как у него
 * дела в этих встречах. Без React и без API.
 *
 * mate-stats / enemy-stats API считают только по матчам, которые попали в его аналитику (не по всей истории),
 * а `wins` в обоих — победы самого игрока в совместных матчах (проверено по истории матчей: 535 из 535 строк).
 * Поэтому рядом с каждым списком показывается охват: какую долю матчей игрока API вообще знает.
 */

export const MATES = {
  /** Столько общих матчей нужно, чтобы игрок попал в список (и столько просим у API: меньше — случайные встречи). */
  MIN_MATCHES: 3,
  /** Сколько строк в каждом списке. */
  TOP: 5,
  /** Соперник становится «немезидой», если встретился не реже стольких раз… */
  NEMESIS_MIN_MATCHES: 4,
  /** …и побед у него больше, чем у игрока, не меньше чем на столько. */
  NEMESIS_MIN_LEAD: 2,
};

/**
 * Охват: доля матчей игрока, которые знает аналитика API. Ниже половины данным о напарниках и соперниках нельзя
 * верить без оговорок.
 * @param {number} analyzed матчей в аналитике API (сумма матчей по героям из players/hero-stats)
 * @param {number} total матчей игрока в истории Steam (того же режима)
 * @returns {{ share: number, level: 'full'|'partial'|'low'|'unknown' }}
 */
export function dataCoverage(analyzed, total) {
  if (!total || total <= 0) return { share: 0, level: 'unknown' };
  const share = Math.min(1, Math.max(0, analyzed / total));
  return { share, level: share >= 0.8 ? 'full' : share >= 0.5 ? 'partial' : 'low' };
}

/**
 * @param {{ id: number, matches: number, wins: number }} row
 * @param {number} baseline винрейт самого игрока (для разницы)
 */
function withRates(row, baseline) {
  const winrate = row.matches ? row.wins / row.matches : 0;
  return { id: row.id, matches: row.matches, wins: row.wins, losses: row.matches - row.wins, winrate, diff: winrate - baseline };
}

/** Больше всего общих матчей, при равенстве — больше побед, затем меньший id (порядок не зависит от ответа API). */
const byMatches = (a, b) => b.matches - a.matches || b.wins - a.wins || a.id - b.id;

/**
 * Круг игрока: постоянные напарники, частые соперники и «немезида».
 * @param {Array<{ id: number, matches: number, wins: number }>} mates
 * @param {Array<{ id: number, matches: number, wins: number }>} enemies
 * @param {{ baseline?: number }} [options] общий винрейт игрока: с ним сравнивается винрейт с каждым напарником
 */
export function buildCircle(mates, enemies, { baseline = 0.5 } = {}) {
  const friends = mates.filter((row) => row.matches >= MATES.MIN_MATCHES).map((row) => withRates(row, baseline)).sort(byMatches).slice(0, MATES.TOP);
  const rivals = enemies.filter((row) => row.matches >= MATES.MIN_MATCHES).map((row) => withRates(row, baseline)).sort(byMatches).slice(0, MATES.TOP);

  const nemesis = enemies
    .filter((row) => row.matches >= MATES.NEMESIS_MIN_MATCHES && row.matches - row.wins - row.wins >= MATES.NEMESIS_MIN_LEAD)
    .map((row) => withRates(row, baseline))
    // Сначала самый большой перевес соперника, потом больше общих матчей
    .sort((a, b) => (b.losses - b.wins) - (a.losses - a.wins) || b.matches - a.matches || a.id - b.id)[0] ?? null;

  return { friends, rivals, nemesis };
}

/**
 * Account ID, чьи профили нужны для подписей (имя и аватар): напарники, соперники и «немезида», без повторов.
 * @param {ReturnType<typeof buildCircle>} circle
 */
export function circleIds(circle) {
  const ids = [...circle.friends, ...circle.rivals, ...(circle.nemesis ? [circle.nemesis] : [])].map((row) => row.id);
  return [...new Set(ids)];
}
