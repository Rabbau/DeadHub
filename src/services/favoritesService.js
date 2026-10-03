/**
 * @fileoverview Избранные игроки и герои: правила списков. Без React и без API. Сводка последних матчей для карточки
 * лежит отдельно (favoritesCardService.js): этот файл нужен меню и странице героя, то есть основному файлу сайта. Сами списки живут в браузере (favoritesStore), поэтому всё, что приходит из localStorage, проходит
 * через normalizeFavorites: чужой или повреждённый JSON не должен ломать страницу.
 */

export const FAVORITES_LIMITS = { players: 12, heroes: 60 };

const ACCOUNT_ID_MAX = 4294967295; // 2^32 − 1: Account ID — 32-битное число
const NAME_MAX = 64;
const AVATAR_MAX = 300;

const isAccountId = (value) => Number.isInteger(value) && value > 0 && value <= ACCOUNT_ID_MAX;
const isHeroId = (value) => Number.isInteger(value) && value > 0 && value < 1_000_000;

/** Игрок в том виде, в котором его хранит список: id, имя и аватар (аватар — только https-ссылка). */
function cleanPlayer(raw) {
  if (!raw || typeof raw !== 'object' || !isAccountId(raw.id)) return null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, NAME_MAX) : null;
  const avatar = typeof raw.avatar === 'string' && /^https:\/\//.test(raw.avatar) && raw.avatar.length <= AVATAR_MAX ? raw.avatar : null;
  return { id: raw.id, name, avatar };
}

/**
 * Приводит сохранённое к допустимому виду: повторы и неверные записи отбрасываются, списки обрезаются до лимита.
 * @param {any} raw
 * @returns {{ players: Array<{ id: number, name: string|null, avatar: string|null }>, heroes: number[] }}
 */
export function normalizeFavorites(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const players = [];
  for (const entry of Array.isArray(source.players) ? source.players : []) {
    const player = cleanPlayer(entry);
    if (player && !players.some((p) => p.id === player.id)) players.push(player);
  }
  const heroes = [...new Set((Array.isArray(source.heroes) ? source.heroes : []).filter(isHeroId))];
  return { players: players.slice(0, FAVORITES_LIMITS.players), heroes: heroes.slice(0, FAVORITES_LIMITS.heroes) };
}

/**
 * Добавляет игрока в начало списка. Когда место закончилось, ничего не вытесняется молча: игрок не добавляется.
 * @returns {{ players: ReturnType<typeof normalizeFavorites>['players'], result: 'added'|'exists'|'full'|'invalid' }}
 */
export function addPlayer(players, raw, limit = FAVORITES_LIMITS.players) {
  const player = cleanPlayer(raw);
  if (!player) return { players, result: 'invalid' };
  if (players.some((p) => p.id === player.id)) return { players, result: 'exists' };
  if (players.length >= limit) return { players, result: 'full' };
  return { players: [player, ...players], result: 'added' };
}

/** Убирает игрока из списка. */
export function removePlayer(players, id) {
  return players.filter((p) => p.id !== id);
}

/**
 * Обновляет имя и аватар игрока, который уже в избранном (профиль пришёл свежее), и не трогает список,
 * если ничего не изменилось — чтобы не перезаписывать localStorage зря.
 */
export function refreshPlayer(players, raw) {
  const fresh = cleanPlayer(raw);
  if (!fresh) return players;
  const current = players.find((p) => p.id === fresh.id);
  if (!current || (current.name === fresh.name && current.avatar === fresh.avatar)) return players;
  return players.map((p) => (p.id === fresh.id ? { ...p, name: fresh.name ?? p.name, avatar: fresh.avatar ?? p.avatar } : p));
}

/**
 * Добавляет героя в избранное или убирает его, если он уже там.
 * @returns {{ heroes: number[], result: 'added'|'removed'|'full'|'invalid' }}
 */
export function toggleHero(heroes, id, limit = FAVORITES_LIMITS.heroes) {
  const heroId = Number(id);
  if (!isHeroId(heroId)) return { heroes, result: 'invalid' };
  if (heroes.includes(heroId)) return { heroes: heroes.filter((h) => h !== heroId), result: 'removed' };
  if (heroes.length >= limit) return { heroes, result: 'full' };
  return { heroes: [...heroes, heroId], result: 'added' };
}
