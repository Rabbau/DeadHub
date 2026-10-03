/**
 * @fileoverview Глобальный поиск по сайту: разбор запроса, оценка совпадений и группировка результатов.
 * Ищем среди героев, предметов и разделов сайта; для игроков запрос превращается в действие
 * («открыть профиль» или «искать по нику»), а к API идёт только после выбора. Без React и без API.
 */
import { toAccountId } from './playerService.js';

/** Разделы сайта, которые можно найти по названию (key — ключ перевода пункта меню). */
export const SEARCH_PAGES = [
  { to: '/', key: 'nav.home' },
  { to: '/heroes', key: 'nav.heroes' },
  { to: '/meta', key: 'nav.meta' },
  { to: '/matchups', key: 'nav.matchups' },
  { to: '/items', key: 'nav.items' },
  { to: '/tierlist', key: 'nav.tierlist' },
  { to: '/compare', key: 'nav.compare' },
  { to: '/draft', key: 'nav.draft' },
  { to: '/build', key: 'nav.randomBuild' },
  { to: '/calculator', key: 'nav.calculator' },
  { to: '/crosshair', key: 'nav.crosshair' },
  { to: '/live', key: 'nav.live' },
  { to: '/versus', key: 'nav.versus' },
  { to: '/favorites', key: 'nav.favorites' },
  { to: '/map', key: 'nav.map' },
  { to: '/leaderboard', key: 'nav.leaderboard' },
  { to: '/players', key: 'nav.players' },
  { to: '/ranks', key: 'nav.ranks' },
  { to: '/update', key: 'nav.update' },
];

/** Порядок групп в списке результатов. */
export const GROUP_ORDER = ['hero', 'item', 'page'];

/** Сколько результатов показываем в каждой группе. */
export const GROUP_LIMITS = { hero: 6, item: 6, page: 4 };

/**
 * Текст к виду для сравнения: нижний регистр, без диакритики, «ё» = «е», знаки препинания — пробелы.
 * «Mo & Krill» → «mo krill», «High-Velocity» → «high velocity». Запрос и названия проходят через одну функцию,
 * поэтому «й/и» и подобные замены не мешают совпадению.
 * @param {unknown} text
 */
export function normalizeQuery(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Насколько название подходит запросу, 0 — совсем не подходит. Оба аргумента уже нормализованы.
 * Точное совпадение лучше начала названия, начало — лучше начала любого слова, слово — лучше вхождения.
 * Запрос из нескольких слов подходит, только если подходит каждое слово.
 * @param {string} name
 * @param {string} query
 */
export function matchScore(name, query) {
  if (!query) return 0;
  if (name === query) return 100;
  if (name.startsWith(query)) return 85;

  const words = name.split(' ');
  let total = 0;
  const tokens = query.split(' ');
  for (const token of tokens) {
    if (words.some((word) => word.startsWith(token))) total += 60;
    else if (name.includes(token)) total += 35;
    else return 0;
  }
  return total / tokens.length;
}

/**
 * Готовит запись для поиска: нормализованное название считается один раз, а не при каждом нажатии клавиши.
 * @template T
 * @param {T & { name: string }} entry
 * @returns {T & { norm: string }}
 */
export function indexEntry(entry) {
  return { ...entry, norm: normalizeQuery(entry.name) };
}

/**
 * Результаты поиска по группам (герои, предметы, разделы), в каждой — лучшие совпадения.
 * @param {Array<{ type: string, name: string, norm: string }>} entries
 * @param {string} query
 * @param {Record<string, number>} [limits]
 * @returns {Array<{ type: string, results: Array<object> }>} только непустые группы
 */
export function searchEntries(entries, query, limits = GROUP_LIMITS) {
  const q = normalizeQuery(query);
  if (!q) return [];

  const scored = entries
    .map((entry) => ({ entry, score: matchScore(entry.norm, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.length - b.entry.name.length || a.entry.name.localeCompare(b.entry.name));

  return GROUP_ORDER
    .map((type) => ({
      type,
      results: scored.filter(({ entry }) => entry.type === type).slice(0, limits[type] ?? 5).map(({ entry }) => entry),
    }))
    .filter((group) => group.results.length > 0);
}

/**
 * Действие для игроков. Account ID, SteamID64 или ссылка на профиль — открыть профиль;
 * любой другой текст (от двух символов) — искать игроков по нику. В API запрос уходит только после выбора.
 * @param {string} query
 * @returns {{ kind: 'open', id: number, to: string }|{ kind: 'search', query: string, to: string }|null}
 */
export function playerAction(query) {
  const text = String(query ?? '').trim();
  const id = toAccountId(text);
  if (id) return { kind: 'open', id, to: `/player/${id}` };
  if (text.length >= 2) return { kind: 'search', query: text, to: `/players?q=${encodeURIComponent(text)}` };
  return null;
}

/**
 * Действие «открыть матч»: запрос из одних цифр, 6–12 знаков. Номер матча и Account ID — оба длинные числа и
 * друг от друга не отличаются, поэтому для такого запроса поиск предлагает оба варианта. SteamID64 (17 цифр)
 * сюда не попадает: это всегда игрок.
 * @param {string} query
 * @returns {{ id: number, to: string }|null}
 */
export function matchAction(query) {
  const text = String(query ?? '').trim();
  if (!/^\d{6,12}$/.test(text)) return null;
  const id = Number(text);
  return { id, to: `/match/${id}` };
}
