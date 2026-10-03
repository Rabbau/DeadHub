import { httpGet } from './httpClient.js';
import { ANALYTICS_API_BASE, API_BASE } from './config.js';
import { periodStart, toQueryString } from '../services/statsFilters.js';
import { CURVE_DAYS, slimCurve } from '../services/curveService.js';
import { summarizeForCard } from '../services/favoritesCardService.js';

const PROFILE_TTL_MS = 60 * 60 * 1000;
const FRESH_TTL_MS = 5 * 60 * 1000; // история и ранг меняются после каждого матча

/** Профиль Steam из ответов steam / steam-search. */
function slimProfile(raw) {
  return {
    id: raw.account_id,
    name: raw.personaname || `#${raw.account_id}`,
    avatar: raw.avatarmedium || raw.avatar || null,
    country: raw.countrycode || null,
    profileUrl: raw.profileurl || null,
    matches30d: raw.matches_played_last_30d ?? 0,
  };
}

/**
 * Профили нескольких игроков одним запросом (имя и аватар для таблицы матча): до двенадцати человек за раз.
 * Игроков без открытого профиля в ответе нет — их показывают по Account ID.
 * @param {number[]} accountIds
 * @returns {Promise<ReturnType<typeof slimProfile>[]>}
 */
export function fetchSteamProfiles(accountIds) {
  const ids = [...new Set((accountIds || []).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  if (ids.length === 0) return Promise.resolve([]);
  return httpGet(`${API_BASE}/v1/players/steam?account_ids=${ids.join(',')}`, {
    cacheKey: `player_steam_batch_${ids.join('-')}`,
    ttl: PROFILE_TTL_MS,
    transform: (rows) => (Array.isArray(rows) ? rows.map(slimProfile) : []),
  });
}

/**
 * Поиск по нику, Account ID или SteamID64 (API понимает все три формата).
 * Кеш отключён: запросы разные на каждый ввод.
 * @returns {Promise<ReturnType<typeof slimProfile>[]>}
 */
export function searchPlayers(query, limit = 20) {
  const qs = toQueryString({ search_query: query, limit });
  return httpGet(`${API_BASE}/v1/players/steam-search?${qs}`, {
    cache: false,
    transform: (rows) => (Array.isArray(rows) ? rows.map(slimProfile) : []),
  }).catch((error) => {
    // Пустой результат API отдаёт как 404 «No Steam profiles found» — это не сбой
    if (error.status === 404) return [];
    throw error;
  });
}

/** @returns {Promise<ReturnType<typeof slimProfile>|null>} */
export function fetchSteamProfile(accountId) {
  return httpGet(`${API_BASE}/v1/players/steam?account_ids=${accountId}`, {
    cacheKey: `player_steam_${accountId}`,
    ttl: PROFILE_TTL_MS,
    transform: (rows) => (Array.isArray(rows) && rows[0] ? slimProfile(rows[0]) : null),
  });
}

/**
 * Текущий ранг игрока: badge = tier * 10 + subtier. null — если рейтинговых матчей нет.
 * @returns {Promise<{ badge: number, tier: number, subtier: number }|null>}
 */
export function fetchPlayerRank(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/rank`, {
    cacheKey: `player_rank_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: (raw) => (raw && raw.badge ? { badge: raw.badge, tier: raw.rank, subtier: raw.subrank } : null),
  });
}

/**
 * Строки match-history → записи сайта, новые сверху. gameMode (1 — обычный, 4 — Street Brawl) нужен, чтобы не
 * смешивать Street Brawl с остальной статистикой.
 */
export function slimHistory(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((m) => ({
      id: m.match_id,
      heroId: m.hero_id,
      at: m.start_time,
      duration: m.match_duration_s ?? 0,
      kills: m.player_kills ?? 0,
      deaths: m.player_deaths ?? 0,
      assists: m.player_assists ?? 0,
      win: m.match_result === m.player_team,
      mode: m.match_mode,
      gameMode: m.game_mode ?? null,
      delta: m.ranked_delta ?? null,
      badge: m.ranked_display_badge ?? null,
      abandoned: (m.abandoned_time_s ?? 0) > 0,
    }))
    .sort((a, b) => b.at - a.at);
}

/**
 * История матчей, новые сверху. Победа — когда победила команда игрока (match_result === player_team);
 * так же считает ranked_delta (проверено: знак дельты совпал во всех рейтинговых матчах выборки).
 * Ключ кеша с цифрой 2: в записях появилось поле gameMode, старые записи без него не подходят.
 * @returns {Promise<Array<{ id: number, heroId: number, at: number, duration: number, kills: number, deaths: number, assists: number, win: boolean, mode: number, gameMode: number|null, delta: number|null, badge: number|null, abandoned: boolean }>>}
 */
export function fetchMatchHistory(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/match-history`, {
    cacheKey: `player_history2_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: slimHistory,
  });
}

/**
 * Краткая сводка последних матчей игрока для карточки в избранном (см. summarizeForCard). Тот же запрос, что и у
 * истории, но в кеш уходит только сводка — несколько сотен байт вместо сотен килобайт на каждого избранного.
 */
export function fetchPlayerCard(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/match-history`, {
    cacheKey: `player_card_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: (rows) => summarizeForCard(slimHistory(rows)),
  });
}

/**
 * Статистика игрока по героям (за всё время).
 * @returns {Promise<Array<{ heroId: number, matches: number, wins: number, kills: number, deaths: number, assists: number, accuracy: number, lastPlayed: number }>>}
 */
export function fetchPlayerHeroStats(accountId) {
  return httpGet(`${API_BASE}/v1/players/hero-stats?account_ids=${accountId}`, {
    cacheKey: `player_heroes_${accountId}`,
    ttl: FRESH_TTL_MS,
    transform: (rows) =>
      (Array.isArray(rows) ? rows : []).map((r) => ({
        heroId: r.hero_id,
        matches: r.matches_played ?? 0,
        wins: r.wins ?? 0,
        kills: r.kills ?? 0,
        deaths: r.deaths ?? 0,
        assists: r.assists ?? 0,
        accuracy: r.accuracy ?? 0,
        lastPlayed: r.last_played ?? 0,
      })),
  });
}

const CIRCLE_TTL_MS = 30 * 60 * 1000; // аналитика API пополняется медленно, а ответ на сервере кешируется на десять минут
/** Показываем людей, с которыми сыграно не меньше стольких матчей: меньше — случайные встречи, а ответ без этого весит сотни КБ. */
const CIRCLE_MIN_MATCHES = 3;

/**
 * Напарники игрока: с кем он чаще играл в одной команде и сколько матчей они выиграли вместе.
 * Только по матчам, которые знает аналитика API (не по всей истории).
 * @returns {Promise<Array<{ id: number, matches: number, wins: number }>>}
 */
export function fetchPlayerMates(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/mate-stats?min_matches_played=${CIRCLE_MIN_MATCHES}`, {
    cacheKey: `player_mates_${accountId}`,
    ttl: CIRCLE_TTL_MS,
    transform: (rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.mate_id, matches: r.matches_played ?? 0, wins: r.wins ?? 0 })),
  });
}

/**
 * Соперники игрока: против кого он чаще играл. wins — победы самого игрока в этих матчах.
 * @returns {Promise<Array<{ id: number, matches: number, wins: number }>>}
 */
export function fetchPlayerEnemies(accountId) {
  return httpGet(`${API_BASE}/v1/players/${accountId}/enemy-stats?min_matches_played=${CIRCLE_MIN_MATCHES}`, {
    cacheKey: `player_enemies_${accountId}`,
    ttl: CIRCLE_TTL_MS,
    transform: (rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.enemy_id, matches: r.matches_played ?? 0, wins: r.wins ?? 0 })),
  });
}

const CURVE_TTL_MS = 30 * 60 * 1000; // на стороне API кривая тоже кешируется (час), а считает её недёшево: у диапазона рангов — секунды

/**
 * Ход матчей игрока: средние души, убийства, смерти и помощь на каждой десятой доле матча за последние CURVE_DAYS
 * дней (player-performance-curve). Только по матчам, которые знает аналитика API. Начало периода округлено до
 * суток — иначе адрес менялся бы каждую секунду, и ни кеш браузера, ни CDN не срабатывали бы.
 * @returns {Promise<ReturnType<typeof slimCurve>>}
 */
export function fetchPlayerCurve(accountId, nowMs = Date.now()) {
  const since = periodStart(CURVE_DAYS, nowMs);
  const qs = toQueryString({ account_ids: accountId, min_unix_timestamp: since });
  return httpGet(`${ANALYTICS_API_BASE}/v1/analytics/player-performance-curve?${qs}`, {
    cacheKey: `player_curve_${accountId}_${since}`,
    ttl: CURVE_TTL_MS,
    transform: slimCurve,
  });
}

/**
 * Та же кривая для всех игроков диапазона рангов (тиры 1..11): «средний игрок ранга», с которым сравнивается игрок.
 * @param {{ rankMin: number, rankMax: number }} band
 * @returns {Promise<ReturnType<typeof slimCurve>>}
 */
export function fetchRankCurve({ rankMin, rankMax }, nowMs = Date.now()) {
  const since = periodStart(CURVE_DAYS, nowMs);
  const qs = toQueryString({ min_average_badge: rankMin * 10 + 1, max_average_badge: rankMax * 10 + 6, min_unix_timestamp: since });
  return httpGet(`${ANALYTICS_API_BASE}/v1/analytics/player-performance-curve?${qs}`, {
    cacheKey: `rank_curve_${rankMin}-${rankMax}_${since}`,
    ttl: CURVE_TTL_MS,
    transform: slimCurve,
  });
}
