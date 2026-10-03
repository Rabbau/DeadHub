/**
 * @fileoverview Идущие матчи: разбор ответа matches/active, ссылки на трансляции, фильтры, сортировка и сводка
 * «кто сейчас в эфире». Без React и без API.
 *
 * matches/active — это то, что показывает вкладка «Смотреть» в игре: не больше двухсот матчей, обновляется раз в
 * две минуты. Значит, список — витрина самых заметных матчей, а не все идущие игры, и сводки по нему нельзя
 * выдавать за статистику всей игры.
 */

/** game_mode: 1 — обычный режим, 4 — Street Brawl. match_mode: 1 — обычный матч, 4 — рейтинговый. */
export const LIVE_GAME_NORMAL = 1;
export const LIVE_GAME_STREET_BRAWL = 4;
export const LIVE_MATCH_UNRANKED = 1;
export const LIVE_MATCH_RANKED = 4;

/** Регионы, как их называет API (region_mode_parsed); остальное показывается как есть. */
export const LIVE_REGIONS = ['europe', 'russia', 'row', 'se_asia', 'oceania', 's_america', 'n_america'];

/** Сколько секунд список считается свежим: API кеширует ответ на две минуты. */
export const LIVE_REFRESH_S = 120;

/**
 * Матч из ответа API в нужном сайту виде. У строк без номера матча или без игроков показывать нечего — null.
 * @param {any} raw
 */
export function slimActiveMatch(raw) {
  const id = Number(raw?.match_id);
  if (!Number.isInteger(id) || id <= 0 || !Array.isArray(raw.players) || raw.players.length === 0) return null;
  const players = raw.players
    .filter((player) => Number.isInteger(player?.account_id) && Number.isInteger(player?.hero_id))
    .map((player) => ({ id: player.account_id, team: player.team === 1 ? 1 : 0, heroId: player.hero_id }));
  return {
    id,
    startedAt: Number.isFinite(raw.start_time) ? raw.start_time : null,
    gameMode: raw.game_mode ?? null,
    matchMode: raw.match_mode ?? null,
    region: typeof raw.region_mode_parsed === 'string' ? raw.region_mode_parsed.toLowerCase() : null,
    souls: [Number(raw.net_worth_team_0) || 0, Number(raw.net_worth_team_1) || 0],
    spectators: Number(raw.spectators) || 0,
    players,
  };
}

/**
 * Ответ matches/active целиком; повторы по номеру матча убираются.
 * @param {any} rows
 */
export function slimActiveMatches(rows) {
  const seen = new Set();
  const matches = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const match = slimActiveMatch(raw);
    if (match && !seen.has(match.id)) {
      seen.add(match.id);
      matches.push(match);
    }
  }
  return matches;
}

/**
 * Ответ matches/live/urls: адрес трансляции и когда он обновлялся. Адрес — это поток для программ, разбирающих демо
 * (не страница для браузера), поэтому сайт его только показывает и копирует, а ссылкой не делает.
 * @param {any} rows
 * @returns {Array<{ matchId: number, url: string, updatedAt: number|null }>}
 */
export function slimBroadcasts(rows) {
  const seen = new Set();
  const list = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const matchId = Number(raw?.match_id);
    const url = typeof raw?.broadcast_url === 'string' ? raw.broadcast_url.trim() : '';
    if (!Number.isInteger(matchId) || matchId <= 0 || !/^https?:\/\/\S+$/.test(url) || seen.has(matchId)) continue;
    seen.add(matchId);
    list.push({ matchId, url, updatedAt: Number.isFinite(raw.updated_at) ? raw.updated_at : null });
  }
  return list;
}

/** Ключ режима для подписи: 'streetBrawl' | 'ranked' | 'unranked'. */
export function liveModeKey(match) {
  if (match.gameMode === LIVE_GAME_STREET_BRAWL) return 'streetBrawl';
  return match.matchMode === LIVE_MATCH_RANKED ? 'ranked' : 'unranked';
}

/** Сколько секунд идёт матч. */
export function elapsedSeconds(match, nowMs = Date.now()) {
  if (match.startedAt == null) return null;
  return Math.max(0, Math.floor(nowMs / 1000) - match.startedAt);
}

/** Перевес меньше этой доли от суммы душ двух команд считается «поровну»: сотни душ в матче на сотни тысяч — не перевес. */
export const SOUL_LEAD_MIN_SHARE = 0.01;

/**
 * Перевес по душам. В Street Brawl души команд в ответе — фиксированные заглушки (у обеих команд одно число),
 * поэтому там перевеса нет; нет его и когда счёт ровный или разница ничтожна.
 * @returns {{ leader: 0|1, lead: number, share: number }|null} share — доля души лидера в сумме двух команд
 */
export function soulLead(match) {
  if (match.gameMode === LIVE_GAME_STREET_BRAWL) return null;
  const [a, b] = match.souls;
  if (a + b <= 0 || Math.abs(a - b) / (a + b) < SOUL_LEAD_MIN_SHARE) return null;
  const leader = a > b ? 0 : 1;
  return { leader, lead: Math.abs(a - b), share: Math.max(a, b) / (a + b) };
}

/** Игроки одной команды. */
export function teamPlayers(match, team) {
  return match.players.filter((player) => player.team === team);
}

/**
 * Фильтры списка. mode: 'all' | 'ranked' | 'unranked' | 'streetBrawl'; region: 'all' или название региона;
 * heroId — только матчи с этим героем; withBroadcast — только матчи, у которых есть адрес трансляции.
 * @param {ReturnType<typeof slimActiveMatches>} matches
 * @param {{ mode?: string, region?: string, heroId?: number|null, withBroadcast?: boolean }} filters
 * @param {Set<number>|Map<number, unknown>} [broadcasts] номера матчей с трансляцией
 */
export function filterMatches(matches, { mode = 'all', region = 'all', heroId = null, withBroadcast = false } = {}, broadcasts) {
  return matches.filter((match) => {
    if (mode !== 'all' && liveModeKey(match) !== mode) return false;
    if (region !== 'all' && match.region !== region) return false;
    if (heroId != null && !match.players.some((player) => player.heroId === heroId)) return false;
    if (withBroadcast && !(broadcasts && broadcasts.has(match.id))) return false;
    return true;
  });
}

/**
 * Порядок списка: 'newest' — недавно начавшиеся первыми, 'longest' — самые долгие, 'spectators' — самые
 * просматриваемые. При равенстве — по номеру матча (новые первыми), чтобы порядок не прыгал между обновлениями.
 */
export function sortMatches(matches, sort = 'spectators') {
  const byId = (a, b) => b.id - a.id;
  const startedAt = (match) => match.startedAt ?? 0;
  const order = {
    newest: (a, b) => startedAt(b) - startedAt(a) || byId(a, b),
    longest: (a, b) => startedAt(a) - startedAt(b) || byId(a, b),
    spectators: (a, b) => b.spectators - a.spectators || startedAt(b) - startedAt(a) || byId(a, b),
  };
  return [...matches].sort(order[sort] ?? order.spectators);
}

/**
 * Самые частые герои в показанных матчах: [{ heroId, players, matches }] — сколько игроков и в скольких матчах.
 * @param {ReturnType<typeof slimActiveMatches>} matches
 */
export function heroesOnAir(matches, limit = 8) {
  const byHero = new Map();
  for (const match of matches) {
    const inThisMatch = new Set();
    for (const player of match.players) {
      const entry = byHero.get(player.heroId) ?? { heroId: player.heroId, players: 0, matches: 0 };
      entry.players += 1;
      if (!inThisMatch.has(player.heroId)) {
        entry.matches += 1;
        inThisMatch.add(player.heroId);
      }
      byHero.set(player.heroId, entry);
    }
  }
  return [...byHero.values()].sort((a, b) => b.players - a.players || b.matches - a.matches || a.heroId - b.heroId).slice(0, limit);
}

/**
 * Сводка списка: сколько матчей, сколько игроков, по режимам.
 * @param {ReturnType<typeof slimActiveMatches>} matches
 */
export function summarizeLive(matches) {
  const modes = { ranked: 0, unranked: 0, streetBrawl: 0 };
  let players = 0;
  for (const match of matches) {
    modes[liveModeKey(match)] += 1;
    players += match.players.length;
  }
  return { matches: matches.length, players, modes };
}

/** Регионы, которые есть в списке, в порядке LIVE_REGIONS; незнакомые — после известных, по алфавиту. */
export function regionsPresent(matches) {
  const present = new Set(matches.map((match) => match.region).filter(Boolean));
  const known = LIVE_REGIONS.filter((region) => present.has(region));
  const other = [...present].filter((region) => !LIVE_REGIONS.includes(region)).sort();
  return [...known, ...other];
}
