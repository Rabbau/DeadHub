/**
 * @fileoverview Страница матча: облегчённый вид ответа /v1/matches/{id}/metadata и производные величины
 * (итоги команд, перевес по душам, хроника убийств, сборки игроков). Без React и без API.
 *
 * Полный ответ — до мегабайта (траектории игроков, матрица урона, сотни полей статистики), странице нужна его
 * малая часть: по ней и строится облегчённый вид, он же кладётся в кеш (десятки КБ).
 *
 * Команды в данных — 0 и 1 (у API нет названий сторон), поэтому на сайте они «Команда 1» и «Команда 2».
 * Объект (`objectives[].team`) принадлежит команде, а разрушает его соперник.
 */
import { matchModeKey } from './playerService.js';

export const TEAMS = [0, 1];

/** Отметки разрушения объектов 0 и 1 с — это «не разрушен» и служебные значения, а не время. */
const MIN_OBJECTIVE_TIME_S = 5;

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** game_mode матча в данных: 1 — обычный, 4 — Street Brawl (так их различает и история игрока). */
export function gameModeKey(value) {
  if (value === 1) return 'normal';
  if (value === 4) return 'street_brawl';
  return 'other';
}

/** Ранговые данные игрока: рейтинг до матча и его изменение; null вне рейтинга. */
function rankChange(data) {
  if (!data || !Number.isFinite(Number(data.initial_display_rank))) return null;
  const before = num(data.initial_flat_progress, NaN);
  const after = num(data.final_flat_progress, NaN);
  return {
    badge: num(data.initial_display_rank),
    change: Number.isFinite(before) && Number.isFinite(after) ? after - before : null,
  };
}

function slimPlayer(raw) {
  const stats = (Array.isArray(raw.stats) ? raw.stats : [])
    .filter((snapshot) => snapshot && Number.isFinite(Number(snapshot.time_stamp_s)))
    .sort((a, b) => a.time_stamp_s - b.time_stamp_s);
  const last = stats[stats.length - 1] ?? {};

  return {
    slot: num(raw.player_slot),
    account: num(raw.account_id) > 0 ? num(raw.account_id) : null,
    team: num(raw.team),
    hero: num(raw.hero_id),
    level: num(raw.level),
    kills: num(raw.kills),
    deaths: num(raw.deaths),
    assists: num(raw.assists),
    netWorth: num(raw.net_worth),
    lastHits: num(raw.last_hits),
    denies: num(raw.denies),
    lane: raw.assigned_lane == null ? null : num(raw.assigned_lane),
    // Время, когда игрок покинул матч; null — доиграл до конца
    left: num(raw.abandon_match_time_s) > 0 ? num(raw.abandon_match_time_s) : null,
    // 1 — победа, 2 — поражение, остальное — штраф или матч без подсчёта (см. описание API)
    result: raw.player_match_outcome == null ? null : num(raw.player_match_outcome),
    // 1 — MVP, 2 и 3 — следующие по оценке Valve
    mvp: raw.mvp_rank ? num(raw.mvp_rank) : null,
    rank: rankChange(raw.player_rank_data),
    // Итоги за матч — последний срез статистики (он снят в конце игры)
    damage: num(last.player_damage),
    taken: num(last.player_damage_taken),
    healing: num(last.player_healing),
    boss: num(last.boss_damage),
    // Душа игрока по срезам: [время, душа] — по ним строится график перевеса
    series: stats.map((snapshot) => [num(snapshot.time_stamp_s), num(snapshot.net_worth)]),
    // Журнал предметов: покупки и очки способностей вперемешку — [предмет, когда куплен, когда продан, upgrade_id]
    items: (Array.isArray(raw.items) ? raw.items : []).map((item) => [
      num(item.item_id), num(item.game_time_s), num(item.sold_time_s), num(item.upgrade_id),
    ]),
    // Смерти игрока: [время, слот убийцы]
    deathLog: (Array.isArray(raw.death_details) ? raw.death_details : []).map((death) => [
      num(death.game_time_s), death.killer_player_slot == null ? null : num(death.killer_player_slot),
    ]),
  };
}

/**
 * Облегчённый вид матча. Бросает «notFound», если в ответе нет матча (кеш не должен хранить пустоту).
 * @param {any} raw ответ API
 */
export function slimMatch(raw) {
  const info = raw?.match_info;
  if (!info || !Array.isArray(info.players) || info.players.length === 0) {
    throw Object.assign(new Error('notFound'), { status: 404 });
  }

  const players = info.players
    .map(slimPlayer)
    .filter((player) => TEAMS.includes(player.team))
    // Сначала команда 1, внутри — по душам: так таблица читается как итоговая
    .sort((a, b) => a.team - b.team || b.netWorth - a.netWorth);

  return {
    id: num(info.match_id),
    startedAt: num(info.start_time),
    duration: num(info.duration_s),
    gameMode: gameModeKey(info.game_mode),
    mode: matchModeKey(info.match_mode),
    winner: info.winning_team === 0 || info.winning_team === 1 ? info.winning_team : null,
    // Счёт раундов есть только у Street Brawl
    score: Array.isArray(info.team_score) && info.team_score.length >= 2 ? [num(info.team_score[0]), num(info.team_score[1])] : null,
    // Средний ранг команды (0 — не считался)
    badges: [num(info.average_badge_team0) || null, num(info.average_badge_team1) || null],
    banned: Array.isArray(raw.banned_hero_ids) ? raw.banned_hero_ids.map(Number).filter(Number.isFinite) : [],
    midBoss: (Array.isArray(info.mid_boss) ? info.mid_boss : []).map((event) => ({
      time: num(event.destroyed_time_s),
      team: event.team_killed == null ? null : num(event.team_killed),
    })),
    objectives: (Array.isArray(info.objectives) ? info.objectives : [])
      .filter((objective) => num(objective.destroyed_time_s) >= MIN_OBJECTIVE_TIME_S)
      .map((objective) => ({ team: num(objective.team), time: num(objective.destroyed_time_s) }))
      .sort((a, b) => a.time - b.time),
    players,
  };
}

/**
 * Что пошло не так при загрузке матча: нет такого матча (404/400 или пустой ответ), лимит запросов (429),
 * сервис не смог отдать матч (5xx) или прочее (текст ошибки). На несуществующий номер API отвечает не 404,
 * а 503 («не удалось получить из Steam»), поэтому «нет такого матча» и «сервис временно недоступен» по коду
 * не различить — для 5xx текст объясняет оба случая.
 * @param {{ message?: string, status?: number }|null|undefined} error
 * @returns {'notFound'|'rateLimited'|'unavailable'|string}
 */
export function matchErrorKey(error) {
  if (error?.message === 'notFound' || error?.status === 404 || error?.status === 400) return 'notFound';
  if (error?.status === 429) return 'rateLimited';
  if (error?.status >= 500) return 'unavailable';
  return error?.message ?? 'unknown';
}

/** Игрок матча по слоту (в хронике убийств убийцу указывают слотом). */
export function playersBySlot(match) {
  return new Map(match.players.map((player) => [player.slot, player]));
}

/**
 * Итоги команд: убийства, душа, урон, лечение, разрушенные объекты и убитые боссы середины.
 * Объекты считаются у разрушившей их команды — то есть у соперника владельца.
 * @returns {Array<{ team: number, size: number, kills: number, deaths: number, assists: number, netWorth: number, damage: number, taken: number, healing: number, boss: number, objectives: number, midBoss: number }>}
 */
export function teamTotals(match) {
  return TEAMS.map((team) => {
    const members = match.players.filter((player) => player.team === team);
    const sum = (key) => members.reduce((total, player) => total + player[key], 0);
    return {
      team,
      size: members.length,
      kills: sum('kills'),
      deaths: sum('deaths'),
      assists: sum('assists'),
      netWorth: sum('netWorth'),
      damage: sum('damage'),
      taken: sum('taken'),
      healing: sum('healing'),
      boss: sum('boss'),
      objectives: match.objectives.filter((objective) => objective.team !== team).length,
      midBoss: match.midBoss.filter((event) => event.team === team).length,
    };
  });
}

/**
 * Перевес по душам во времени: сумма души команды 1 минус сумма души команды 2 в каждый момент, для которого есть
 * срез. У игрока, чей срез в этот момент отсутствует (ушёл из матча), берётся последнее известное значение.
 * @returns {Array<{ time: number, teams: [number, number], lead: number }>} lead > 0 — впереди команда 1
 */
export function soulsLead(match) {
  const times = new Set([0]);
  match.players.forEach((player) => player.series.forEach(([time]) => times.add(time)));

  return [...times]
    .sort((a, b) => a - b)
    .map((time) => {
      const teams = [0, 0];
      match.players.forEach((player) => {
        let value = 0;
        for (const [at, netWorth] of player.series) {
          if (at > time) break;
          value = netWorth;
        }
        teams[player.team] += value;
      });
      return { time, teams, lead: teams[0] - teams[1] };
    });
}

/**
 * Шкала графика перевеса: сколько душ откладывать вверх (команда 1 впереди) и вниз (команда 2) от нулевой линии.
 * Каждая сторона — по своему максимуму с запасом, но не меньше четверти большей стороны и не меньше `minimum`:
 * в матче, который один из соперников вёл всё время, нулевая линия уходит к нижнему краю и график не пропадает
 * наполовину, но на ней ещё остаётся место для отметок объектов и босса. Крошечный перевес в ровной игре
 * не раздувается в гору — его держит `minimum`.
 * @param {Array<{ lead: number }>} points
 * @returns {{ up: number, down: number }}
 */
export function leadRange(points, { minimum = 1000, headroom = 1.12, floorShare = 0.28 } = {}) {
  const up = Math.max(0, ...points.map((point) => point.lead)) * headroom;
  const down = -Math.min(0, ...points.map((point) => point.lead)) * headroom;
  const floor = Math.max(minimum, Math.max(up, down) * floorShare);
  return { up: Math.max(up, floor), down: Math.max(down, floor) };
}

/**
 * Хроника убийств по возрастанию времени: кто (слот) кого убил. Убийца неизвестен (null), если смерть
 * не от героя — например, от нейтрального босса.
 * @returns {Array<{ time: number, victim: number, killer: number|null }>}
 */
export function killFeed(match) {
  const bySlot = playersBySlot(match);
  const feed = [];
  match.players.forEach((victim) => {
    victim.deathLog.forEach(([time, killer]) => {
      feed.push({ time, victim: victim.slot, killer: killer != null && bySlot.has(killer) ? killer : null });
    });
  });
  return feed.sort((a, b) => a.time - b.time);
}

/**
 * Делит журнал предметов на покупки и очки способностей. Журнал не помечает, что есть что: покупкой считается
 * запись, чей предмет есть в каталоге улучшений (isUpgrade), остальное — способности.
 * @param {Array<[number, number, number, number]>} log player.items
 * @param {(itemId: number) => boolean} isUpgrade
 * @returns {{ purchases: Array<{ id: number, at: number, soldAt: number }>, abilities: Array<{ id: number, at: number }> }}
 */
export function splitItemLog(log, isUpgrade) {
  const purchases = [];
  const abilities = [];
  log.forEach(([id, at, soldAt]) => {
    if (isUpgrade(id)) purchases.push({ id, at, soldAt });
    else abilities.push({ id, at });
  });
  purchases.sort((a, b) => a.at - b.at);
  abilities.sort((a, b) => a.at - b.at);
  return { purchases, abilities };
}

/** Предметы в инвентаре к концу матча: купленные и не проданные. */
export function finalBuild(purchases) {
  return purchases.filter((purchase) => !purchase.soldAt);
}

/** (убийства + помощь) / смерти, смерти — не меньше одной. */
export function kdaOf(player) {
  return (player.kills + player.assists) / Math.max(1, player.deaths);
}

/** Победила ли команда игрока: true/false, а если победитель неизвестен (матч не доигран) — null. */
export function teamWon(match, team) {
  return match.winner == null ? null : match.winner === team;
}

/**
 * Средний ранг команды по игрокам с рейтингом: бейджи переводятся в линейную шкалу (6 подрангов на ранг), берётся
 * среднее и округляется обратно в бейдж. Своё поле API (average_badge_*) в части матчей приходит нулевым, поэтому
 * считаем сами, а его значение используем, только если по игрокам посчитать нечего.
 * @returns {number|null} бейдж вида tier * 10 + subtier; null — оценить нечем
 */
export function teamAverageBadge(match, team) {
  const scale = match.players
    .filter((player) => player.team === team && player.rank?.badge)
    .map((player) => Math.floor(player.rank.badge / 10) * 6 + Math.max(1, player.rank.badge % 10) - 1);
  if (scale.length === 0) return match.badges?.[team] ?? null;

  const mean = Math.round(scale.reduce((sum, value) => sum + value, 0) / scale.length);
  return Math.floor(mean / 6) * 10 + (mean % 6) + 1;
}

/** Игрок матча по Account ID (для подсветки «это вы», когда в матч пришли из профиля). */
export function playerByAccount(match, accountId) {
  if (!accountId) return null;
  return match.players.find((player) => player.account === accountId) ?? null;
}

/** Самое большое значение показателя среди игроков — для длины полосок. */
export function maxOf(match, key) {
  return Math.max(0, ...match.players.map((player) => player[key]));
}
