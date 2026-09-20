/**
 * @fileoverview Игроки: разбор ввода и агрегаты. Без React и без API.
 */

/** SteamID64 = 76561197960265728 + Account ID (32-bit). */
const STEAM_ID64_BASE = 76561197960265728n;
const ACCOUNT_ID_MAX = 4294967296n; // 2^32

/**
 * Достаёт Account ID из ввода: 17-значный SteamID64, ссылка steamcommunity.com/profiles/… или
 * готовый Account ID (8–10 цифр). Всё остальное — ник, его ищем через API.
 * @param {string} input
 * @returns {number|null}
 */
export function toAccountId(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;

  const fromUrl = /steamcommunity\.com\/profiles\/(\d{17})/i.exec(text);
  const candidate = fromUrl ? fromUrl[1] : text;

  if (/^\d{17}$/.test(candidate)) {
    const id = BigInt(candidate) - STEAM_ID64_BASE;
    return id > 0n && id < ACCOUNT_ID_MAX ? Number(id) : null;
  }
  if (/^\d{8,10}$/.test(candidate)) return Number(candidate);
  return null;
}

/**
 * Итоги по героям: матчи, победы, KDA и средняя точность стрельбы.
 * Точность считаем только по героям, где она отслеживается (у части героев API отдаёт 0).
 * @param {Array<{ matches: number, wins: number, kills: number, deaths: number, assists: number, accuracy: number }>} rows
 */
export function summarizeHeroStats(rows) {
  const totals = rows.reduce(
    (sum, r) => ({
      matches: sum.matches + r.matches,
      wins: sum.wins + r.wins,
      kills: sum.kills + r.kills,
      deaths: sum.deaths + r.deaths,
      assists: sum.assists + r.assists,
    }),
    { matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0 },
  );

  const tracked = rows.filter((r) => r.accuracy > 0);
  const trackedMatches = tracked.reduce((sum, r) => sum + r.matches, 0);
  const accuracy = trackedMatches > 0
    ? tracked.reduce((sum, r) => sum + r.accuracy * r.matches, 0) / trackedMatches
    : 0;

  return {
    ...totals,
    winrate: totals.matches > 0 ? totals.wins / totals.matches : 0,
    kda: totals.matches > 0 ? (totals.kills + totals.assists) / Math.max(1, totals.deaths) : 0,
    accuracy,
  };
}

/** Самые играемые герои. */
export function topHeroes(rows, limit = 10) {
  return [...rows].sort((a, b) => b.matches - a.matches || b.wins - a.wins).slice(0, limit);
}

/** Режим матча из истории: 1 — обычный, 2 — кастом, 3 — с ботами, 4 — рейтинг. */
export function matchModeKey(mode) {
  switch (mode) {
    case 4: return 'ranked';
    case 1: return 'unranked';
    case 2: return 'private';
    case 3: return 'bots';
    default: return 'other';
  }
}
